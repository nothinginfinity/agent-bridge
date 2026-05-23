# AGENTS.md — Agent Registry & Routing Rules
_version: 1.0 | last-updated: 2026-05-22_

---

## Alice

| Property | Value |
|----------|-------|
| **Platform** | Perplexity AI |
| **Repo access** | GitHub MCP (nothinginfinity org) |
| **Primary skills** | Spec writing, GitHub file ops, orchestration, HTML/TypeScript/Next.js |
| **Cannot do** | Cloudflare API calls, D1 queries, Worker deployment |
| **Inbox** | `alice/inbox.md` (Claude writes here for Alice to read) |
| **Outbox** | `alice/outbox.md` (Alice writes here; also writes directly to `claude/inbox.md`) |
| **Log** | `alice/log.md` |
| **Boot file** | `nothinginfinity/repo-copilot` → `spaces/gists/G-000-alice-boot.md` |

### Alice routing rules
- GitHub work → do it directly
- Cloudflare Worker deploy → write spec to `shared/specs/`, message Claude via `claude/inbox.md`
- D1 query / migration → message Claude via `claude/inbox.md`
- Research / web data → handle directly (Perplexity has web search)

---

## Claude

| Property | Value |
|----------|-------|
| **Platform** | Anthropic Claude |
| **Repo access** | GitHub MCP (nothinginfinity org) |
| **Primary skills** | Cloudflare Workers, D1, MCP deployment, API integration, Worker debugging |
| **Cannot do** | Perplexity web search, long-horizon GitHub orchestration |
| **Inbox** | `claude/inbox.md` (Alice writes here for Claude to read) |
| **Outbox** | `claude/outbox.md` (Claude writes here; also writes directly to `alice/inbox.md`) |
| **Log** | `claude/log.md` |
| **Boot file** | `nothinginfinity/repo-copilot` → `spaces/claude/boot.md` |

### Claude routing rules
- Cloudflare deploy / D1 / secrets → do it directly via afo-mcp / mcp-prax
- GitHub file writes → do it directly via github-mcp
- Spec writing / PRD / architecture → message Alice via `alice/inbox.md`
- Web research → message Alice via `alice/inbox.md` (Alice has Perplexity search)

---

## Jared

| Property | Value |
|----------|-------|
| **Role** | Human lead, final authority |
| **Preferred involvement** | Initiate tasks, approve decisions, unblock agents |
| **Not needed for** | Agent-to-agent message relay |

---

## Routing Decision Tree

```
Task arrives
    ├── Needs GitHub write / spec / HTML / TypeScript? → Alice
    ├── Needs Cloudflare deploy / D1 / Worker debug? → Claude
    ├── Needs web research? → Alice (has Perplexity search)
    ├── Needs both GitHub + Cloudflare? → Alice specs, Claude deploys
    └── Needs human decision? → Jared
```

---

## Message Priority Levels

| Priority | Meaning | Expected response |
|----------|---------|------------------|
| `low` | FYI, no action needed | Read and log |
| `normal` | Task or question, respond when convenient | Next session |
| `high` | Blocking another task | Same session if possible |
| `urgent` | Production issue or deploy blocker | Immediate |
