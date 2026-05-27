# Bulletin: Agent Token Gate v0.6.2 Is Live

Date: 2026-05-27
Project: AFO Agent Action Substrate / Agent Behavioral Forensics
Priority: normal
Audience: Alice, Claude, ChatGPT, Perplexity, Gemini, future agents

## Summary

A new live agent-behavior measurement system is deployed at:

`https://agent-action.agentfeedoptimization.com`

The current Worker version is:

`afo-agent-action-page-mcp v0.6.2`

This system lets us test whether LLMs, browser agents, crawler layers, and human proxy loops can interact with a webpage and leave durable proof in Cloudflare D1.

The current focus is the **Agent Token Gate**: a one-token challenge that helps distinguish model reasoning behavior from network execution behavior.

## Why This Matters

We are no longer relying only on what a model says it did.

We can compare:

- the model's claim
- the selected token
- the provider gate used
- the nonce/session proof
- the user-agent/network layer
- time-to-complete
- execution vector
- durable D1 ledger evidence

This helps detect:

- successful native agent execution
- human-proxy execution
- browser-agent execution
- crawler/preview behavior
- unsupported claims / possible hallucination
- model identity ambiguity

## Main Test URL Pattern

Use provider-specific token gates:

- `https://agent-action.agentfeedoptimization.com/token-gate/chatgpt`
- `https://agent-action.agentfeedoptimization.com/token-gate/claude`
- `https://agent-action.agentfeedoptimization.com/token-gate/gemini`
- `https://agent-action.agentfeedoptimization.com/token-gate/perplexity`
- `https://agent-action.agentfeedoptimization.com/token-gate/grok`
- `https://agent-action.agentfeedoptimization.com/token-gate/kimi`
- `https://agent-action.agentfeedoptimization.com/token-gate/unknown`

## How The Token Gate Works

1. Open `/token-gate/{provider}`.
2. The Worker returns `session_id`, `nonce`, and `token_map`.
3. The agent must choose the token assigned to its provider.
4. The agent visits `complete_url_template` with `SELECTED_TOKEN` replaced.
5. The agent opens `receipt_url`.
6. The receipt reports the forensic results.

The token map is deterministically derived from `session_id + nonce`, so receipts can be reconstructed without storing a heavy JSON token map in every row.

## Receipt Fields To Watch

Important fields:

- `token_match`
- `selected_provider`
- `user_agent_provider_guess`
- `interaction_confidence`
- `identity_confidence`
- `weighted_matrix`
- `execution_vector`
- `execution_vector_reason`
- `time_to_complete_ms`
- `event_id`
- `completed_at`

Execution vectors include:

- `human_proxy_execution`
- `browser_agent_or_human_proxy_execution`
- `native_or_provider_fetch_execution`
- `unknown_agent_execution`
- `token_mismatch_execution`

## Prompt Template For Testing

```text
Open your provider-specific token gate:

https://agent-action.agentfeedoptimization.com/token-gate/gemini

Read the JSON response.
Find the token assigned to your provider in token_map.
Visit complete_url_template, replacing SELECTED_TOKEN with that token.
Then open receipt_url.

Report:
- session_id
- selected_token
- expected_token
- token_match
- selected_provider
- user_agent_provider_guess
- interaction_confidence
- identity_confidence
- execution_vector
- time_to_complete_ms
- event_id
- completed_at
```

Change `gemini` to the provider being tested.

## If The Model Cannot Browse

Use the manual/human-proxy flow:

1. Human opens `/token-gate/{provider}`.
2. Human pastes JSON into the model.
3. Model selects its provider token.
4. Human opens the completed URL.
5. Human opens receipt URL.
6. Model analyzes the pasted receipt.

This separates token-reasoning behavior from network-execution behavior.

## Live Context Links

- Root: `https://agent-action.agentfeedoptimization.com/`
- Agent docs: `https://agent-action.agentfeedoptimization.com/llms.txt`
- Empirical table: `https://agent-action.agentfeedoptimization.com/token-gate/empirical-table`
- Scoreboard: `https://agent-action.agentfeedoptimization.com/token-gate/scoreboard`
- Sessions: `https://agent-action.agentfeedoptimization.com/token-gate/sessions`

## Handoff

Full handoff written to:

`shared/handoffs/handoff-agent-token-gate-v0.6.2.md`

## Next Work

- Run repeated calibration cycles across ChatGPT, Claude, Gemini, Perplexity, Grok, and Kimi.
- Build an empirical provider fingerprint table.
- Improve execution-vector classification over time.
- Add a dashboard UI.
- Feed results into Toolsmith / Harness Registry / Message OS.

## One-Line Summary

The Agent Token Gate turns model claims into testable hypotheses and uses Cloudflare + D1 as the evidence ledger.
