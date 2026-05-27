# afo-harness-registry-mcp — Spec v0.1

> Live, always-in-sync registry for AFO agent boot commands.
> Read-only. GitHub-backed. No D1 required.

---

## One-sentence purpose

This MCP exists to let any agent discover and load AFO boot commands without needing direct GitHub access.

---

## Position in the system

```
versioned-agent-harness (GitHub)
  harnesses/alice/
  harnesses/claude/
  harnesses/chatgpt/
  harnesses/boot-list.md    ← static fallback
         ↓
afo-harness-registry-mcp   ← live queryable layer
         ↓
Any agent (Alice / Claude / ChatGPT)
  → list_boot_commands
  → get_boot_command("boot-deploy")
  ← structured object with full content
```

---

## Architecture: Option A — GitHub-backed

- The Worker reads **live from GitHub** at request time via GitHub Contents API
- Auto-discovers all `.md` files in `harnesses/alice/`, `harnesses/claude/`, `harnesses/chatgpt/`
- Alice commits a new harness → immediately available via the MCP (zero sync lag)
- No D1, no webhook, no extra sync infrastructure
- Single binding: `GITHUB_TOKEN` secret

**v0.2 upgrade path:** Add D1 caching layer when list grows beyond 50 commands or sub-100ms reads are needed.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Worker health + GitHub binding status |
| `POST` | `/mcp` | JSON-RPC MCP surface |
| `OPTIONS` | `*` | CORS preflight |

---

## Health response shape

```json
{
  "status": "ok",
  "worker": "afo-harness-registry-mcp",
  "version": "0.1.0",
  "bindings": {
    "GITHUB_TOKEN": true
  }
}
```

Binding presence only. No token values. No secrets.

---

## MCP tools (v0.1 — read-only)

### 1. `harness_status`

First tool. Always present.

```typescript
inputSchema: {
  type: 'object',
  properties: {},
  required: []
}
```

Returns:
```json
{
  "worker": "afo-harness-registry-mcp",
  "version": "0.1.0",
  "status": "ok",
  "github_repo": "nothinginfinity/versioned-agent-harness",
  "total_commands": 16,
  "agents": ["alice", "claude", "chatgpt"],
  "last_checked": "2026-05-27T09:51:00Z"
}
```

---

### 2. `list_boot_commands`

Returns full registry. Filterable by agent.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    agent: {
      type: 'string',
      enum: ['alice', 'claude', 'chatgpt', 'all'],
      description: 'Filter by agent. Omit or pass "all" for the full list.'
    }
  },
  required: []
}
```

Returns array of command objects:
```json
[
  {
    "name": "boot-deploy",
    "agent": "claude",
    "path": "harnesses/claude/boot-deploy.md",
    "description": "Focused deploy — one Worker from Alice handoff to live on Cloudflare",
    "load_instruction": "Load: nothinginfinity/versioned-agent-harness \u2192 harnesses/claude/boot-deploy.md",
    "sha": "abc123"
  }
]
```

**Auto-discovery:** `list_boot_commands` calls the GitHub Contents API to list files in each `harnesses/<agent>/` subfolder. No hardcoded registry. Adding a file to the repo is the only step needed to register a new command.

**Description extraction:** Reads the first `> ` blockquote line from each harness file as the description. Convention: every harness file has a one-line blockquote at the top.

---

### 3. `get_boot_command`

Returns full structured object including complete markdown content.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Boot command name, e.g. "boot-deploy" or "boot-list"'
    }
  },
  required: ['name']
}
```

Returns:
```json
{
  "name": "boot-deploy",
  "agent": "claude",
  "path": "harnesses/claude/boot-deploy.md",
  "description": "Focused deploy — one Worker from Alice handoff to live on Cloudflare",
  "load_instruction": "Load: nothinginfinity/versioned-agent-harness \u2192 harnesses/claude/boot-deploy.md",
  "content": "# boot-deploy\n\n> Focused deploy harness...",
  "sha": "abc123",
  "github_url": "https://github.com/nothinginfinity/versioned-agent-harness/blob/main/harnesses/claude/boot-deploy.md"
}
```

**The killer feature:** An agent with no GitHub access can call `get_boot_command` and receive the full harness content to execute immediately. Boot commands become first-class callable objects.

---

### 4. `search_boot_commands`

Keyword search across command names and descriptions.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search keyword, e.g. "deploy", "D1", "spec"'
    }
  },
  required: ['query']
}
```

Returns same array shape as `list_boot_commands`, filtered to matches. Searches: name, description, agent.

Example: `{ query: "deploy" }` → returns `boot-deploy`, `boot-d1`, `boot-ops`.

---

## Bindings

| Binding | Type | Required | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | Secret | Yes | GitHub Contents API reads from `versioned-agent-harness` |

No D1. No KV. No R2. No other bindings for v0.1.

---

## Worker skeleton notes

```
GET  /health   → binding presence check (GITHUB_TOKEN boolean)
POST /mcp      → JSON-RPC: initialize, notifications/initialized, tools/list, tools/call
OPT  *         → CORS 204
*    *         → 404
```

CORS headers on every response. No auth on the MCP surface (read-only, public registry).

GitHub API base: `https://api.github.com/repos/nothinginfinity/versioned-agent-harness/contents/`

Headers for GitHub API calls:
```
Authorization: Bearer ${GITHUB_TOKEN}
Accept: application/vnd.github.v3+json
User-Agent: afo-harness-registry-mcp/0.1.0
```

---

## `boot-list.md` fallback policy

`harnesses/boot-list.md` remains in the repo as a **static fallback** for agents that do not have MCP access. Once the MCP is live, `boot-list.md` will include a note at the top pointing to the live MCP URL. The static file is never deprecated — it is the zero-dependency offline fallback.

---

## Toolsmith registration (post-deploy)

After Claude deploys and smoke tests pass:
1. Register `afo-harness-registry-mcp` in Toolsmith via `register_tool`
2. Attach: repo URL, deploy URL, commit SHA, smoke test results
3. Tag: `infrastructure`, `registry`, `agent-tooling`
4. Belt: `message-os-cloud-social-builder-belt` (and any future meta-belt)

This makes the harness registry itself discoverable via Toolsmith — agents can find boot commands through either surface.

---

## Acceptance criteria (v0.1)

```
[ ] GET /health returns 200 + { GITHUB_TOKEN: true }
[ ] POST /mcp → tools/list returns 4 tools
[ ] harness_status returns total_commands count matching actual file count in repo
[ ] list_boot_commands returns all 16 current harnesses
[ ] list_boot_commands?agent=claude returns 5 commands
[ ] get_boot_command("boot-deploy") returns structured object with full content
[ ] search_boot_commands("deploy") returns boot-deploy + related commands
[ ] Adding a new harness file to GitHub → immediately appears in list_boot_commands (no redeploy)
[ ] boot-list.md updated with MCP URL pointer
[ ] Registered in Toolsmith
```

---

## v0.2 planned additions

```
register_boot_command   — Alice self-registers after committing a new harness
unregister_boot_command — deprecate a harness
list_agents             — agents + command counts
D1 caching layer        — if list grows beyond 50 commands
tag filtering           — filter by tag (deploy, spec, research, ops)
```

---

## Agent responsibility

| Agent | Responsibility |
|---|---|
| Alice | Spec (this file), src/index.ts, wrangler.toml, MCP_SCHEMA.json, smoke-test.json, CHANGELOG.md |
| Claude | Deploy Worker, add GITHUB_TOKEN secret, add custom domain, run smoke tests |
| ChatGPT | Validate spec, review inputSchema shapes, confirm Toolsmith registration plan |
| Jared | Add GITHUB_TOKEN secret in CF dashboard, confirm domain, final smoke test sign-off |

---

## Post-deploy handoff checklist (for Claude)

```
[ ] deploy_worker_with_bindings: afo-harness-registry-mcp
[ ] Add GITHUB_TOKEN secret
[ ] Add custom domain: harness-registry.agentfeedoptimization.com
[ ] GET /health — confirm 200 + GITHUB_TOKEN: true
[ ] POST /mcp → tools/list — confirm 4 tools
[ ] POST /mcp → harness_status — confirm total_commands
[ ] POST /mcp → list_boot_commands — confirm all 16 commands returned
[ ] POST /mcp → get_boot_command { name: "boot-deploy" } — confirm content returned
[ ] POST /mcp → search_boot_commands { query: "deploy" } — confirm results
[ ] Register in Toolsmith
[ ] Post result to shared/bulletin.md
```

---

## Version

- Spec version: 0.1.0
- Created: 2026-05-27
- Author: Alice
- Status: ready for source build
