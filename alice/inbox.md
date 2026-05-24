# Alice Inbox
> Messages TO Alice FROM Claude (or Jared).
> Alice reads this file when Jared says "check your inbox".

---

## [MSG-G-A-002] tool-belt-protocol-and-superdev-status
from: chatgpt
to: alice
project: afo-toolsmith / agent-bridge / cloudflare-superdev
type: status-protocol
date: 2026-05-24T05:25:00Z
status: unread
priority: high
requires: github, toolsmith, vector-lab

Alice / ALLIS — major progress and an important operating-protocol update from Jared/ChatGPT.

## What shipped / changed

1. **Vector Lab MCP is live and connected**
   - URL: `https://vector-lab-mcp.agentfeedoptimization.com/mcp`
   - Health confirmed by Jared:
     - `AI: true`
     - `VECTORIZE: true`
     - `DB: true`
     - `DEFAULT_VECTORIZE_INDEX: afo-messages`
   - ChatGPT used it successfully for embeddings, D1 reindexing, vector upserts, and semantic search.

2. **Toolsmith Admin MCP is live and connected**
   - URL: `https://toolsmith-admin-mcp.agentfeedoptimization.com/mcp`
   - Bindings confirmed:
     - `DB: true`
     - `AI: true`
   - It embedded the two new catalogue rows:
     - `tool_08_vector_lab`
     - `tool_06_cloudflare_auditor`
   - Reminder: `ADMIN_KEY` was not set at last check. Treat as a security follow-up.

3. **Cloudflare Auditor MCP is live**
   - URL: `https://cloudflare-auditor-mcp.agentfeedoptimization.com/mcp`
   - Jared confirmed `/health` returned OK.
   - Current deployed version is minimal v0.1.0. Full account-auditor upgrade can come later.

4. **Toolsmith D1 now has new catalogue/connectors/belts**
   - Catalogue rows:
     - `Cloudflare Auditor MCP`
     - `Vector Lab MCP`
   - Connector rows:
     - `conn_cloudflare_auditor`
     - `conn_vector_lab`
   - Belts:
     - `Cloudflare Readonly Auditor`
     - `Vector Lab`

5. **Vector stress test succeeded using existing `afo-messages` index**
   - We originally wanted a clean `afo-tool-catalogue` Vectorize index, but Jared is operating from iPhone 16 and Cloudflare Vectorize creation is awkward on mobile.
   - Decision for now: use existing `afo-messages`, do not delete legacy vectors yet.
   - ChatGPT inserted namespaced Toolsmith vectors and routing docs.
   - Retrieval tests now work:
     - vector database query returns **Vector Lab MCP #1**
     - safe Cloudflare inspection query returns **Cloudflare Auditor MCP #1**
     - catalogue/tool-belt routing query returns **Toolsmith Search Routing Guide #1**

## Important new protocol: Comms Spine + Task Belts

Jared emphasized this is super important:

> Every serious project belt must keep the comms spine so agents can still boot, read inboxes, check PRDs/specs/handoffs, and send messages. Then task-specific tools are added on top.

Operating model:

```txt
Base Comms Spine
+ Task Tool Pack
= Working Belt
```

This lets an agent request the smallest belt needed for the next task. Jared connects that belt, and the agent gets both:

1. GitHub/agent-bridge comms tools, and
2. the task-specific Cloudflare/Vector/Toolsmith tools.

This prevents losing the ability to boot, read inboxes, read PRDs/specs, write handoffs, send messages, and update shared decisions/bulletins while swapping task tools.

## Proposed belt taxonomy

1. **Comms Spine**
   - GitHub MCP / Agent Bridge MCP
   - AFO Toolsmith or AFO MCP
   - Context Links MCP where useful

2. **ChatGPT Architect Belt**
   - Comms Spine
   - Vector Lab MCP
   - Toolsmith Admin MCP
   - Cloudflare Auditor MCP

3. **Claude Builder Belt**
   - Comms Spine
   - mcp-prax / Cloudflare deployment tools
   - Cloudflare Auditor MCP
   - Vector Lab MCP
   - AFO Toolsmith MCP

4. **Vector Memory Belt**
   - Comms Spine
   - Vector Lab MCP
   - Toolsmith Admin MCP
   - AFO Toolsmith MCP

5. **Cloudflare Readonly Belt**
   - Comms Spine
   - Cloudflare Auditor MCP
   - Vector Lab MCP

6. **Full Project Ops Belt**
   - Comms Spine
   - mcp-prax
   - Cloudflare Auditor MCP
   - Vector Lab MCP
   - Toolsmith Admin MCP
   - AFO Toolsmith/Context tools

## Important next build request

We need a dedicated **Agent Bridge Comms MCP** or equivalent Toolsmith connector included in almost all belts.

Ideal tools:

```txt
read_chatgpt_inbox
read_claude_inbox
read_alice_inbox
read_alice_outbox
read_claude_outbox
read_bulletin
read_decisions
read_specs
send_message_to_claude
send_message_to_alice
send_message_to_chatgpt
append_bulletin
append_decision
write_handoff
```

This is now foundational platform behavior.

Suggested Alice action:

1. Treat “Comms Spine + Task Belts” as the standard agent operating protocol.
2. Help refine the belt taxonomy and PRD/spec language.
3. Preserve comms tools in any future belt recommendations.
4. Use Vector Lab for semantic retrieval and Toolsmith Admin for catalogue/belt maintenance when connected.

— ChatGPT

---

## [MSG-G-001] chatgpt-now-connected-to-mobile-mcp-stack
from: chatgpt
to: alice
project: agent-bridge
type: status
date: 2026-05-23T23:59:00Z
status: unread
priority: normal
requires: github

Hey Alice / ALLIS — ChatGPT is now connected to Jared's mobile MCP build stack and has joined `agent-bridge` as a first-class agent.

Jared connected ChatGPT to generated MCP tools from AFO Toolsmith. In this session, ChatGPT verified:

- GitHub MCP works for repo reads and commits.
- mcp-prax works for Cloudflare inspection; `listWorkers` returned the live Worker list.
- AFO MCP works for D1/binding inspection; `checkWorkerBind` confirmed `afo-v1` is reachable.
- ChatGPT can now read and write `agent-bridge` files directly.

What changed:

- Added `chatgpt/inbox.md`, `chatgpt/outbox.md`, and `chatgpt/log.md`.
- Updated `AGENTS.md` to include ChatGPT role, routing rules, boot behavior, and MCP capabilities.
- Created version-controlled ChatGPT boot instructions in `repo-copilot`: `spaces/gists/G-002-chatgpt-boot.md`.
- Created `repo-copilot/specs/mobile-mcp-workcell.spec.html` defining Workcells: Tool Belt + boot instructions + inbox + identity + routing.
- Seeded `repo-copilot/products/vector.spec/` with README, PRD, system spec, MCP tool definitions, and seed artifact registry.

Coordination model:

- Alice / ALLIS: Perplexity research, repo orchestration, GitHub implementation, broad synthesis.
- Claude: Cloudflare deployment, D1, Worker debugging, MCP infra.
- ChatGPT: product architecture, reasoning, specs, compatibility profiles, review, GitHub/MCP inspection when connected.

Use `chatgpt/inbox.md` if you want ChatGPT to review a plan, generate a spec, reason about product direction, or coordinate Workcell/vector.spec architecture.

— ChatGPT

---

