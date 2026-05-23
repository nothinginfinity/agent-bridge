# AGENTS.md — Agent Registry & Routing Rules
_version: 1.1 | last-updated: 2026-05-23_

---

## Alice

| Property | Value |
|----------|-------|
| Platform | Perplexity AI |
| Repo access | GitHub MCP, nothinginfinity org |
| Primary skills | Spec writing, GitHub file ops, orchestration, HTML, TypeScript, Next.js, web research |
| Inbox | `alice/inbox.md` |
| Outbox | `alice/outbox.md` |
| Log | `alice/log.md` |
| Boot file | `nothinginfinity/repo-copilot` / `spaces/gists/G-000-alice-boot.md` |

### Alice routing rules
- GitHub work: do it directly.
- Spec writing, PRDs, architecture docs: do it directly.
- Cloudflare Worker deployment: write a spec in `shared/specs/` and message Claude in `claude/inbox.md`.
- D1 query or migration work: message Claude in `claude/inbox.md`.
- Web research: handle directly.
- Product framing, review, and cross-agent planning: coordinate with ChatGPT in `chatgpt/inbox.md`.

---

## Claude

| Property | Value |
|----------|-------|
| Platform | Anthropic Claude |
| Repo access | GitHub MCP, nothinginfinity org |
| Primary skills | Cloudflare Workers, D1, MCP deployment, API integration, Worker debugging |
| Inbox | `claude/inbox.md` |
| Outbox | `claude/outbox.md` |
| Log | `claude/log.md` |
| Boot file | `nothinginfinity/repo-copilot` / `spaces/claude/boot.md` |

### Claude routing rules
- Cloudflare deployment, D1, and Worker debugging: handle directly through available MCP tools.
- GitHub file writes: do directly through GitHub MCP when available.
- Spec writing, PRDs, and architecture docs: message Alice in `alice/inbox.md`.
- Product reasoning and compatibility review: message ChatGPT in `chatgpt/inbox.md`.
- Web research: message Alice in `alice/inbox.md`.

---

## ChatGPT

| Property | Value |
|----------|-------|
| Platform | OpenAI ChatGPT |
| Repo access | GitHub MCP, nothinginfinity org, when connected |
| Cloudflare access | mcp-prax and AFO MCP tools, when connected |
| Primary skills | Product architecture, reasoning, spec writing, review, HTML specs, compatibility profiles, generated artifacts, multi-agent planning, GitHub and Cloudflare inspection through MCP |
| Inbox | `chatgpt/inbox.md` |
| Outbox | `chatgpt/outbox.md` |
| Log | `chatgpt/log.md` |
| Boot file | Current ChatGPT project instructions plus this repo |

### ChatGPT routing rules
- Product strategy, architecture, pricing, and positioning: handle directly.
- HTML specs, documentation, and compatibility profiles: handle directly and commit when GitHub MCP is available.
- GitHub reads and writes: do directly through GitHub MCP when connected and appropriate.
- Cloudflare inspection, Worker state, and D1 reachability: do directly through mcp-prax or AFO MCP when connected.
- Cloudflare deployment or deep Worker debugging: coordinate with Claude in `claude/inbox.md` unless Jared asks ChatGPT to act directly and the required MCP tool is available.
- Current web research: coordinate with Alice in `alice/inbox.md` when Alice is the better source.
- Cross-agent planning and bridge maintenance: update `shared/*` and message relevant inboxes.

---

## Jared

| Property | Value |
|----------|-------|
| Role | Human lead, final authority |
| Preferred involvement | Initiate tasks, approve decisions, unblock agents |
| Not needed for | Routine agent-to-agent message relay once routing is clear |

---

## Routing Decision Tree

- Needs GitHub write, spec, HTML, or TypeScript: Alice or ChatGPT, depending on who is active and connected.
- Needs Cloudflare deployment, D1, or Worker debugging: Claude first; ChatGPT may inspect or act when mcp-prax is connected.
- Needs web research: Alice.
- Needs product architecture, pricing, or ecosystem positioning: ChatGPT.
- Needs both GitHub and Cloudflare: Alice or ChatGPT specs, Claude deploys, ChatGPT verifies when connected.
- Needs multi-agent coordination: use agent-bridge shared files and target inboxes.
- Needs human decision: Jared.

---

## Message Format

All inbox and outbox messages should use this header:

```
## [MSG-XXX] subject-slug-here
from: alice | claude | chatgpt | jared
to: alice | claude | chatgpt | both | all
project: project-slug-or-general
type: task | question | status | build_request | review_request | decision | FYI
date: YYYY-MM-DDTHH:MM:SSZ
status: unread | read | actioned | closed
priority: low | normal | high | urgent
requires: github | cloudflare | d1 | research | human | none

[message body]

---
```

Suggested message prefixes:
- Alice messages: `MSG-A-001+`
- Claude messages: `MSG-C-001+`
- ChatGPT messages: `MSG-G-001+`
- Jared messages: `MSG-J-001+`

---

## Message Priority Levels

| Priority | Meaning | Expected response |
|----------|---------|------------------|
| low | FYI, no action needed | Read and log |
| normal | Task or question, respond when convenient | Next session |
| high | Blocking another task | Same session if possible |
| urgent | Production issue or deploy blocker | Immediate |

---

## Boot Instructions

Alice: On any session, read `alice/inbox.md`, `claude/outbox.md`, `chatgpt/outbox.md`, and `shared/*` as needed. Write responses to the relevant target inbox. Append session summary to `alice/log.md`. Bundle writes when possible.

Claude: On any session, read `claude/inbox.md`, `alice/outbox.md`, `chatgpt/outbox.md`, and `shared/*` as needed. Write responses to the relevant target inbox. Append session summary to `claude/log.md`. Bundle writes when possible.

ChatGPT: On any session with GitHub MCP available, read `chatgpt/inbox.md`, `alice/outbox.md`, `claude/outbox.md`, and `shared/*` as needed. Write responses to the relevant target inbox. Append session summary to `chatgpt/log.md`. Use mcp-prax or AFO tools for Cloudflare inspection when connected.
