# ChatGPT Handoff

> Handoff for the next ChatGPT instance joining Jared's AFO / Mobile MCP / Agent Bridge build system.

## Current State

ChatGPT is now a first-class agent in `nothinginfinity/agent-bridge`.

Jared connected ChatGPT to generated MCP tools from AFO Toolsmith, including GitHub MCP, mcp-prax, and AFO MCP. This means ChatGPT can now participate in the build loop rather than only providing copy/paste instructions.

## Verified Tool Access

During the session that created this handoff, ChatGPT verified:

- GitHub MCP can list/read/commit files.
- mcp-prax can inspect Cloudflare state. `listWorkers` returned 25 Workers.
- AFO MCP can inspect D1/bindings. `checkWorkerBind` confirmed `D1 — afo-v1` is reachable.
- GitHub MCP was used to commit files to `agent-bridge` and `repo-copilot`.

## Files Created or Updated

### agent-bridge

- `chatgpt/inbox.md` created and later updated with MSG-G-001.
- `chatgpt/outbox.md` created.
- `chatgpt/log.md` created.
- `chatgpt/handoff.md` created.
- `AGENTS.md` updated to include ChatGPT as a first-class agent.
- `claude/inbox.md` updated with a ChatGPT hello/status message.
- `alice/inbox.md` updated with a ChatGPT hello/status message.

### repo-copilot

- `spaces/gists/G-002-chatgpt-boot.md` created as ChatGPT's version-controlled boot file.
- `specs/mobile-mcp-workcell.spec.html` created.
- `products/vector.spec/README.md` created.
- `products/vector.spec/PRD.md` created.
- `products/vector.spec/SPEC.md` created.
- `products/vector.spec/mcp-tools.md` created.
- `products/vector.spec/registry/seed-artifacts.json` created.

## Important Concepts from the Session

### AFO Toolsmith

AFO Toolsmith generates project-specific MCP tools and Tool Belts. Jared can create a new tool quickly, give ChatGPT/Claude/Alice a connector link, and expand agent capabilities on demand.

### Tool Belt

A Tool Belt is a coordinated set of MCP tools designed for a project or role.

### Workcell

A Workcell is the next abstraction:

```txt
Workcell = Tool Belt + boot instructions + inbox/outbox/log + identity + routing
```

This lets Jared run multiple ChatGPT projects, Claude projects, and Perplexity spaces from mobile, each with its own tools, instructions, lane, and mailbox.

### vector.spec

`vector.spec` is a new product seed for a searchable, GitHub-backed vector index of specs, templates, boot files, tool manifests, Workcell manifests, recipes, and examples.

Purpose:

```txt
small boot instructions
+ searchable spec index
+ fetch exact source when needed
= lower token cost, better consistency, faster mobile builds
```

The planned MCP tools are:

- `search_specs`
- `fetch_spec`
- `index_spec`
- `refresh_index`
- `recommend_templates`
- `create_spec_from_template`

## Boot Instructions for Next ChatGPT Instance

1. Load ChatGPT's version-controlled boot file:
   `https://raw.githubusercontent.com/nothinginfinity/repo-copilot/main/spaces/gists/G-002-chatgpt-boot.md`

2. Read agent registry:
   `nothinginfinity/agent-bridge/AGENTS.md`

3. Read ChatGPT inbox:
   `nothinginfinity/agent-bridge/chatgpt/inbox.md`

4. Read recent outboxes if relevant:
   - `alice/outbox.md`
   - `claude/outbox.md`

5. For project work, look for project-specific Workcell files once they exist.

## Routing Rules

- Product architecture, specs, review, compatibility profiles: ChatGPT.
- Cloudflare deployment, D1, Worker debugging: Claude, unless ChatGPT has the tool and Jared asks it to act.
- Perplexity web research, repo orchestration, external synthesis: Alice / ALLIS.
- Destructive actions or unclear authority: Jared.

## Current Recommended Next Steps

1. Have Alice/Claude read their new inbox messages.
2. Build the `vector.spec` Cloudflare/MCP backend:
   - D1 artifact registry.
   - Vectorize index.
   - MCP tools for `search_specs`, `fetch_spec`, and `index_spec`.
3. Add Workcell generation to AFO Toolsmith:
   - MCP connector URL.
   - boot instruction URL.
   - inbox/outbox/log paths.
   - manifest.json.
   - setup card.
4. Eventually promote `products/vector.spec/` into its own dedicated GitHub repo when a create-repo tool or manual GitHub step is available.

## Session Tone / Strategic Summary

Jared has effectively built a mobile-first agent capability factory. The core pattern is:

```txt
Generate tool → expose MCP URL → connect assistant → assistant gains capability → use capability to build more tools
```

ChatGPT is now connected into that loop.

---

