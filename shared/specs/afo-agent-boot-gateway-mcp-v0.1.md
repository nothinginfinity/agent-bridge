# afo-agent-boot-gateway-mcp — Spec v0.1

> Given an agent, project, and mode, compose the startup context needed to boot the agent into the correct role with the right instructions, memory, tools, permissions, and first action.

---

## One-sentence purpose

This MCP exists to turn a simple mode request into a complete, ready-to-execute startup context packet for any AFO agent.

---

## Position in the system

```
versioned-agent-harness (GitHub)
  harnesses/                          ← boot command files
  harnesses/modes.json                ← mode routing manifest
         ↓
afo-harness-registry-mcp              ← boot file source (called live)
         ↓
afo-agent-boot-gateway-mcp            ← compositor layer (this MCP)
  ├─ calls harness registry for boot content
  ├─ reads agent-bridge for bulletins/handoffs
  ├─ reads Toolsmith registry for tool belt refs
  └─ assembles startup context packet
         ↓
Any agent (Alice / Claude / ChatGPT)
  → boot_agent({ agent: "claude", mode: "cloudflare-deploy" })
  ← one startup context packet, ready to execute
```

### Critical boundary

The gateway is a **compositor**, not a source reader or database. It:
- **Calls** `afo-harness-registry-mcp` for boot files (does not duplicate GitHub reads)
- **Reads** public agent-bridge GitHub files for bulletins/handoffs
- **Reads** public Toolsmith registry for tool belt refs (if available)
- **Assembles** the startup context packet
- **Never** reads secrets, private memory, or D1 data in v0.1

---

## Architecture

- Single Cloudflare Worker
- Two bindings: `GATEWAY_GITHUB_TOKEN` (GitHub reads), `HARNESS_REGISTRY_URL` (MCP endpoint)
- Reads `modes.json` live from `versioned-agent-harness` — mode routing is never hardcoded in the Worker
- All sources are independent — partial failure degrades gracefully, never fails completely
- Public-only in v0.1. Private/session memory is v0.2 (D1-backed with auth tokens)

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Worker health + binding status |
| `POST` | `/mcp` | JSON-RPC MCP surface |
| `OPTIONS` | `*` | CORS preflight |

---

## Health response shape

```json
{
  "status": "ok",
  "worker": "afo-agent-boot-gateway-mcp",
  "version": "0.1.0",
  "bindings": {
    "GATEWAY_GITHUB_TOKEN": true,
    "HARNESS_REGISTRY_URL": true
  }
}
```

Binding presence only. No values. No secrets.

---

## Startup context packet schema (v0.1)

```json
{
  "schema_version": "0.1",
  "agent": "chatgpt",
  "mode": "toolsmith-builder",
  "project": "automatic-application-builder",
  "boot": {
    "command": "boot-toolsmith",
    "agent": "chatgpt",
    "content": "...full markdown...",
    "source": "afo-harness-registry-mcp",
    "sha": "abc123"
  },
  "context_sources": [
    { "name": "harness_registry",       "status": "ok",       "fallback_used": false },
    { "name": "agent_bridge_bulletins",  "status": "ok",       "fallback_used": false },
    { "name": "agent_bridge_handoffs",   "status": "ok",       "fallback_used": false },
    { "name": "toolsmith_registry",      "status": "degraded", "fallback_used": true  }
  ],
  "recent_handoffs": [],
  "recent_bulletins": [],
  "available_tools": [
    { "name": "commit_manifest_atomic", "description": "Commit multiple files as one Git transaction." }
  ],
  "tool_belts": [
    { "name": "toolsmith-builder-belt", "description": "Tools needed to plan, compose, commit, deploy, test, and register generated apps." }
  ],
  "permissions": ["read_public_context", "load_boot_files"],
  "recommended_first_action": "Review the Toolsmith builder queue and ask Jared what to build next.",
  "fallback_used": true,
  "warnings": ["Toolsmith registry unavailable; tool belt metadata omitted."],
  "loaded_at": "2026-05-27T10:48:00Z"
}
```

---

## MCP tools (v0.1)

### 1. `boot_gateway_status`

First tool. Always present.

```typescript
inputSchema: { type: 'object', properties: {}, required: [] }
```

Returns: worker name, version, status, harness registry URL, github repo, current modes count, last_checked.

---

### 2. `list_boot_modes`

Returns all available modes from `modes.json` in `versioned-agent-harness`.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    agent: {
      type: 'string',
      description: 'Filter by default_agent (alice/claude/chatgpt). Omit for all.'
    }
  },
  required: []
}
```

Returns array of mode objects: `{ mode, aliases, default_agent, boot_command, project, tool_belts, context_sources, first_action }`

---

### 3. `boot_agent`

The core tool. Resolves mode → boot command → full startup context packet.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    agent:   { type: 'string', description: 'Agent identity: alice, claude, chatgpt' },
    mode:    { type: 'string', description: 'Boot mode name or alias, e.g. "cloudflare-deploy", "deploy", "toolsmith"' },
    project: { type: 'string', description: 'Optional project context override.' }
  },
  required: ['agent', 'mode']
}
```

Process:
1. Load `modes.json` from GitHub → find matching mode (exact name or alias match)
2. Call `afo-harness-registry-mcp` → `get_boot_command(boot_command)` → boot content + sha
3. Read `agent-bridge/shared/bulletin.md` → last 3 bulletin entries
4. Read `agent-bridge/shared/handoffs.md` → last 3 handoffs addressed to this agent
5. Read Toolsmith registry for tool belt refs matching `mode.tool_belts` (degraded OK)
6. Assemble and return startup context packet with `context_sources`, `fallback_used`, `warnings`

---

### 4. `load_project_context`

Loads project-specific context from agent-bridge specs.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    project: { type: 'string', description: 'Project slug, e.g. "toolsmith-automatic-application-builder"' }
  },
  required: ['project']
}
```

Returns: list of matching spec files in `agent-bridge/shared/specs/` with name, path, sha, github_url. Does not return full content (avoids context overload). Agent can call `get_boot_command` for full content.

---

### 5. `load_recent_handoffs`

Returns recent handoffs from `agent-bridge/shared/handoffs.md`, filtered by recipient agent.

```typescript
inputSchema: {
  type: 'object',
  properties: {
    agent: { type: 'string', description: 'Filter by recipient agent (alice/claude/chatgpt). Omit for all.' },
    limit: { type: 'number', description: 'Max number of handoffs to return. Default 5.' }
  },
  required: []
}
```

Returns: array of `{ id, from, to, project, type, date, status, priority, summary }` — summary is first 200 chars of body.

---

### 6. `load_tool_belt`

Returns tool names + descriptions for a named belt. No full inputSchemas (avoids context overload).

```typescript
inputSchema: {
  type: 'object',
  properties: {
    belt_name: { type: 'string', description: 'Belt name, e.g. "toolsmith-builder-belt"' }
  },
  required: ['belt_name']
}
```

Returns: `{ belt_name, description, tools: [{ name, description }], source, fallback_used }`

---

### 7. `compose_startup_context`

Fan-out compositor. Calls all sources in parallel and assembles a startup context packet from explicit inputs (for agents that want manual control vs `boot_agent` auto-resolution).

```typescript
inputSchema: {
  type: 'object',
  properties: {
    agent:        { type: 'string' },
    boot_command: { type: 'string', description: 'Explicit boot command name to load.' },
    project:      { type: 'string' },
    tool_belts:   { type: 'array', items: { type: 'string' }, description: 'Belt names to include.' },
    include_handoffs: { type: 'boolean', description: 'Include recent handoffs. Default true.' },
    include_bulletins: { type: 'boolean', description: 'Include recent bulletins. Default true.' }
  },
  required: ['agent', 'boot_command']
}
```

Returns: same startup context packet schema as `boot_agent`.

---

## modes.json (versioned in `versioned-agent-harness`)

Path: `harnesses/modes.json`

The Worker reads this file **live from GitHub** at request time. Mode routing is never hardcoded in the Worker. Add/edit a mode → immediately reflected without redeploying the gateway.

See: `nothinginfinity/versioned-agent-harness/harnesses/modes.json`

---

## Design decisions

### Q1: Calls harness registry live
The gateway calls `afo-harness-registry-mcp` for boot files. It does not duplicate GitHub reads. Clean dependency boundary.

### Q2: Startup packet fields
`context_sources` (per-source status), `fallback_used` (top-level boolean), `warnings` (array of human-readable strings) are all present. Partial failures are explicit, not silent.

### Q3: Public-only v0.1
Only public GitHub files and public Toolsmith entries. No D1 memory, no secrets, no private data ever in the packet. v0.2 adds D1-backed session tokens for private/user memory.

### Q4: modes.json phrase matching
Mode name = exact match. Aliases = substring/lowercase match. `"deploy"` → `cloudflare-deploy`. `"toolsmith"` → `toolsmith-builder`. Unmatched → error with `list_boot_modes` suggestion.

### Q5: Tool names/descriptions only
The startup packet includes tool names + one-line descriptions only. No full inputSchemas. Agents call `load_tool_belt` for detail, or the Toolsmith registry for full schema.

### Q6: Independent fallbacks
Each source (harness registry, bulletins, handoffs, Toolsmith) is fetched independently. Failure of one source adds a warning and sets `fallback_used: true` but does not abort the packet.

### Q7: Private mode is v0.2
v0.1 is public-only by design. Private context requires D1-backed auth/session tokens, out of scope for v0.1.

---

## Bindings

| Binding | Type | Required | Purpose |
|---|---|---|---|
| `GATEWAY_GITHUB_TOKEN` | Secret | Yes | GitHub reads: modes.json, bulletins, handoffs, specs |
| `HARNESS_REGISTRY_URL` | Var | Yes | `afo-harness-registry-mcp` base URL |

No D1. No KV. No R2.

---

## Fallback behavior

```json
{
  "fallback_used": true,
  "warnings": [
    "Harness registry unavailable; boot content not loaded.",
    "Toolsmith registry unavailable; tool belt metadata omitted."
  ]
}
```

The packet is always returned. Missing fields are empty arrays/objects, never null errors.

---

## Acceptance criteria (v0.1)

```
[ ] GET /health → 200 + { GATEWAY_GITHUB_TOKEN: true, HARNESS_REGISTRY_URL: true }
[ ] tools/list returns 7 tools
[ ] boot_gateway_status returns ok + modes count
[ ] list_boot_modes returns all modes from modes.json
[ ] boot_agent({ agent: "claude", mode: "cloudflare-deploy" }) returns full startup packet
[ ] boot_agent({ agent: "chatgpt", mode: "toolsmith" }) resolves alias correctly
[ ] boot_agent packet includes boot content from harness registry
[ ] boot_agent packet includes recent handoffs and bulletins
[ ] fallback_used + warnings present when a source is unavailable
[ ] no secrets in any response
[ ] compose_startup_context with explicit boot_command returns same packet shape
[ ] modes.json edit in GitHub → immediately reflected in list_boot_modes (no redeploy)
```

---

## Agent responsibility

| Agent | Responsibility |
|---|---|
| Alice | Spec, src/index.ts, wrangler.toml, schema, smoke tests, CHANGELOG; also commits modes.json to versioned-agent-harness |
| Claude | Deploy Worker, add secrets, add domain, run smoke tests |
| ChatGPT | Validate spec, review startup packet schema, confirm mode taxonomy |
| Jared | Add GATEWAY_GITHUB_TOKEN secret, confirm HARNESS_REGISTRY_URL var, domain sign-off |

---

## Post-deploy handoff checklist (for Claude)

```
[ ] deploy_worker: afo-agent-boot-gateway-mcp
[ ] wrangler secret put GATEWAY_GITHUB_TOKEN
[ ] wrangler vars set HARNESS_REGISTRY_URL=https://harness-registry.agentfeedoptimization.com
[ ] custom domain: agent-boot-gateway.agentfeedoptimization.com
[ ] GET /health → 200 + both bindings true
[ ] POST /mcp → tools/list → 7 tools
[ ] boot_agent({ agent: "claude", mode: "cloudflare-deploy" }) → full packet
[ ] confirm fallback degrades gracefully (test with bad HARNESS_REGISTRY_URL)
[ ] register in Toolsmith
[ ] post result to shared/bulletin.md
```

---

## v0.2 planned additions

```
D1-backed session memory       — per-agent private context
Vectorize semantic search      — find relevant specs/handoffs by embedding
build_job awareness            — surface active Toolsmith build jobs in packet
Toolsmith registration write   — gateway can register tools/belts on deploy
per-user permission tokens     — scoped private/public context modes
```

---

## Version

- Spec version: 0.1.0
- Created: 2026-05-27
- Author: Alice
- Status: ready for source build
