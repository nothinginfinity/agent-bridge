# Handoff: Agent Action Substrate / Agent Turnstile / Agent Token Gate v0.6.2

Date: 2026-05-27
Authoring agent: ChatGPT
Project: AFO agent-action substrate / agent behavioral forensics

## Status

Live and deployed.

- Worker: `afo-agent-action-page-mcp`
- Version: `v0.6.2`
- Domain: `https://agent-action.agentfeedoptimization.com`
- D1 database: `afo-agent-action-page-db`
- D1 UUID: `22ae2b0f-baa5-446f-a7b8-1458f3754b10`
- Persistence: Cloudflare D1

## What We Built

We built a live Cloudflare Worker + D1 substrate that lets humans, browser agents, API agents, crawler agents, and LLM agents interact with a website and leave durable evidence.

The system evolved through three major layers:

### 1. Agent Action Surface

Purpose: Make a webpage agent-readable and agent-actionable.

Capabilities:

- Human HTML page with action buttons
- Machine-readable action manifest
- `POST /agent-action` for hard actions
- `GET /agent-get` for lightweight pluck/inspect actions
- D1-backed event log
- MCP endpoint and tools

Important concept:

> A webpage can be human-readable, agent-readable, agent-actionable, and MCP-addressable.

### 2. Agent Turnstile

Purpose: Prove whether an agent/session completed a unique challenge.

Provider gates:

- `/gate/chatgpt`
- `/gate/claude`
- `/gate/gemini`
- `/gate/perplexity`
- `/gate/grok`
- `/gate/kimi`
- `/gate/unknown`

Flow:

1. Agent opens provider gate.
2. Worker creates `session_id` and `nonce`.
3. Worker returns a unique `challenge_url`.
4. Agent must visit the challenge URL.
5. Worker records completion.
6. Agent checks `receipt_url`.

This distinguishes:

- claim-only behavior
- gate opened but challenge not completed
- challenge completed with nonce proof
- possible hallucinated claims

### 3. Agent Token Gate v0.6.2

Purpose: Fingerprint model/tool behavior using a low-cost, one-token identity challenge.

Provider gates:

- `/token-gate/chatgpt`
- `/token-gate/claude`
- `/token-gate/gemini`
- `/token-gate/perplexity`
- `/token-gate/grok`
- `/token-gate/kimi`
- `/token-gate/unknown`

Flow:

1. Agent opens provider-specific token gate.
2. Worker returns `session_id`, `nonce`, and a deterministic rotating `token_map`.
3. Agent must choose the token assigned to its provider.
4. Agent visits `complete_url_template` with `SELECTED_TOKEN` replaced.
5. Worker records result and returns receipt.
6. Receipt includes behavioral/identity diagnostics.

Token map mode:

- Deterministically derived from `session_id + nonce`
- Current stored row marks token map as `DERIVED_FROM_SESSION_ID_PLUS_NONCE`
- Worker reconstructs token map on receipt/verification
- This keeps DB lightweight and makes validation stateless/reconstructable

## Key Endpoints

General:

- `GET /`
- `GET /health`
- `GET /llms.txt`
- `POST /mcp`

Token Gate:

- `GET /token-gate`
- `GET /token-gate/{provider}`
- `GET /turnstile/token`
- `GET /token-gate/receipt/{session_id}`
- `GET /token-gate/sessions`
- `GET /token-gate/scoreboard`
- `GET /token-gate/empirical-table`
- `GET /token-gate/fingerprint/{provider}`

## Current MCP Tools

Token Gate MCP surface currently includes:

- `token_gate_status`
- `create_token_gate_session`
- `complete_token_gate`
- `get_token_gate_receipt`
- `list_token_gate_sessions`
- `get_token_gate_scoreboard`
- `get_provider_fingerprint`
- `get_empirical_table`
- `compare_claim_to_fingerprint`
- `get_llms_txt`

## D1 Tables

Known tables include:

- `agent_events`
- `agent_action_events`
- `agent_action_pages`
- `agent_gate_sessions`
- `agent_token_sessions`

Important `agent_token_sessions` fields:

- `id`
- `gate_id`
- `nonce`
- `token_map`
- `expected_token`
- `selected_token`
- `token_match`
- `status`
- `issued_at`
- `completed_at`
- `user_agent`
- `result_event_id`
- `execution_vector`
- `execution_vector_reason`
- `time_to_complete_ms`

## v0.6.2 Forensics

Receipts now expose:

- `token_match`
- `selected_provider`
- `user_agent_provider_guess`
- `interaction_confidence`
- `identity_confidence`
- `weighted_matrix`
- `navigation_pattern`
- `execution_vector`
- `execution_vector_reason`
- `time_to_complete_ms`
- `request_user_agent_family`
- `event_id`

Execution vector classes:

- `human_proxy_execution`
- `browser_agent_or_human_proxy_execution`
- `native_or_provider_fetch_execution`
- `unknown_agent_execution`
- `token_mismatch_execution`

Confidence matrix currently weights:

- `nonce_verified`: 35
- `token_match`: 30
- `sequence_complete`: 15
- `user_agent_match`: 10
- `provider_selection_match`: 10

## What Has Been Proven

1. Manual browser clicks and GET plucks persist to D1.
2. External LLM/tool/browser layers can touch the substrate.
3. Different providers exhibit different request patterns.
4. Some models say they cannot browse, while surrounding infrastructure may still leave traces.
5. Some models can solve token challenges when JSON is manually pasted even if they cannot fetch URLs.
6. The system can distinguish:
   - reasoning identity
   - network execution identity
   - human proxy execution
   - model claims
   - ledger proof

## Notable Calibration Observation: Gemini

A Gemini test showed:

- Gemini surface could not browse directly.
- Jared manually pasted token-gate JSON into Gemini.
- Gemini correctly selected the `gemini` token.
- Jared manually opened the completion URL on mobile.
- Receipt showed `token_match: true` and `selected_provider: gemini`.
- Network user agent was iPhone/DuckDuckGo, so this is classified as human-proxy execution rather than native Gemini execution.

This proves Gemini can participate at the reasoning/token-selection layer even when its current surface cannot browse.

## How To Test a Model

Prompt template:

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

Swap `gemini` for the correct provider:

- `chatgpt`
- `claude`
- `gemini`
- `perplexity`
- `grok`
- `kimi`
- `unknown`

## If a Model Cannot Browse

Fallback flow:

1. Human opens `/token-gate/{provider}`.
2. Human pastes JSON into model.
3. Model identifies its provider token.
4. Model constructs the completion URL.
5. Human opens completion URL.
6. Human opens receipt URL.
7. Model analyzes pasted receipt.

This measures reasoning/token behavior separately from network execution behavior.

## Next Work

1. Run repeated calibration cycles for each provider.
2. Build the empirical provider fingerprint table.
3. Improve execution-vector classification.
4. Add dashboard UI for sessions/fingerprints/empirical table.
5. Feed summaries into Toolsmith/Harness Registry/Message OS memory.
6. Consider repo-copilot artifact/spec publication for durable source control.

## Important Links

- Live root: `https://agent-action.agentfeedoptimization.com/`
- Token gate docs: `https://agent-action.agentfeedoptimization.com/llms.txt`
- Empirical table: `https://agent-action.agentfeedoptimization.com/token-gate/empirical-table`
- Scoreboard: `https://agent-action.agentfeedoptimization.com/token-gate/scoreboard`
- Sessions: `https://agent-action.agentfeedoptimization.com/token-gate/sessions`

## Summary

This is now an agent behavioral forensics lab. The model claim is a hypothesis; the token gate and D1 ledger provide evidence.
