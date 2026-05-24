# Agent Bridge Comms MCP

**status:** proposed
**owner:** Jared Edwards / AFO Toolsmith
**target worker:** `agent-bridge-comms-mcp`
**target route:** `https://agent-bridge-comms-mcp.agentfeedoptimization.com/mcp`
**purpose:** GitHub-native communication spine for agent workcells and AFO Toolsmith belts.

---

## 1. Product intent

Agent Bridge Comms MCP turns the `nothinginfinity/agent-bridge` repository into a first-class MCP-accessible coordination layer for ChatGPT, Claude, Alice/ALLIS, and future agents.

This is the foundational **Comms Spine** for AFO workcells.

Core doctrine:

```txt
Workcells > Swarms
```

A workcell is:

```txt
identity + boot instructions + comms spine + project memory + task tools + safety profile + expiration
```

The Comms Spine preserves continuity while task-specific belts change. An agent should be able to boot, read its inbox, inspect shared decisions/specs, send handoffs, and append bulletins even when it is temporarily connected to a narrow task belt.

Operating model:

```txt
Base Comms Spine
+ Task Tool Pack
= Working Belt / Workcell
```

Primary use cases:

1. Read ChatGPT, Claude, and Alice inboxes.
2. Read Alice and Claude outboxes for handoff context.
3. Read shared bulletins, decisions, and specs.
4. Send messages to Claude, Alice, or ChatGPT using the agent-bridge message format.
5. Append shared bulletins and durable decisions.
6. Write self-handoffs for future boot continuity.
7. Keep every serious belt/workcell communication-capable without exposing a broad general-purpose GitHub tool.

---

## 2. Source of truth

Repository:

```txt
nothinginfinity/agent-bridge
```

Default branch:

```txt
main
```

Canonical files:

| File | Purpose |
|---|---|
| `AGENTS.md` | Agent registry and routing rules |
| `chatgpt/inbox.md` | Messages to ChatGPT |
| `chatgpt/outbox.md` | Messages from ChatGPT |
| `claude/inbox.md` | Messages to Claude |
| `claude/outbox.md` | Messages from Claude |
| `alice/inbox.md` | Messages to Alice / ALLIS |
| `alice/outbox.md` | Messages from Alice / ALLIS |
| `shared/bulletin.md` | Broadcast status updates |
| `shared/decisions.md` | Durable append-only decisions |
| `shared/specs/` | Project specs and handoffs |

The MCP should treat `shared/decisions.md` and message logs as append-only unless Jared explicitly authorizes edits.

---

## 3. MCP compatibility pattern

The Worker must follow the current AFO mobile MCP pattern:

- HTTP endpoint: `POST /mcp`
- no SSE required
- JSON-RPC compatible request/response
- supports:
  - `initialize`
  - `notifications/initialized`
  - `ping`
  - `tools/list`
  - `tools/call`

Tool call responses should use:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{...pretty printed JSON...}"
      }
    ]
  }
}
```

Errors should use:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32603,
    "message": "Tool error: ..."
  }
}
```

---

## 4. Required bindings and permissions

### Worker bindings

| Binding | Type | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | secret | GitHub API token with scoped access to `nothinginfinity/agent-bridge` |
| `GITHUB_OWNER` | var | default `nothinginfinity` |
| `GITHUB_REPO` | var | default `agent-bridge` |
| `GITHUB_BRANCH` | var | default `main` |
| `ADMIN_KEY` | secret, optional | privileged write-gate for mutating tools |
| `READONLY_MODE` | var, optional | if true, disable all writes |

### GitHub token scope

Use the narrowest token possible:

- repository: `nothinginfinity/agent-bridge` only
- contents: read/write
- metadata: read

Do not use an org-wide token if a repo-scoped token is available.

---

## 5. Security model

This MCP is safer than exposing a general GitHub tool to every workcell because it only reads/writes known coordination paths and enforces append-only behavior.

Rules:

1. Never return `GITHUB_TOKEN`, `ADMIN_KEY`, or any secret value.
2. Restrict all file access to the canonical allowlist.
3. Restrict `read_specs` to `shared/specs/` markdown files.
4. Mutating tools must append or create messages using controlled templates.
5. Reject path traversal such as `../`.
6. Reject direct writes outside the known inbox/outbox/bulletin/decisions/spec paths.
7. Reject broad rewrites of `shared/decisions.md` unless a future explicit admin tool is added.
8. Add commit messages that identify the MCP tool and target action.
9. Preserve markdown separators (`---`) between messages.
10. Prefer one commit per logical message or bundled boot update.

Risk levels:

| Tool class | Risk | Notes |
|---|---|---|
| Read inbox/outbox/bulletin/decisions/specs | low | read-only |
| Send inbox messages | medium | creates coordination state |
| Append bulletin | medium | broadcast to all agents |
| Append decision | high | durable product/process doctrine |
| Write self-handoff | medium | affects future boot continuity |

`append_decision` should be gated by `ADMIN_KEY` or a `confirm_decision: true` input field because decisions are durable.

---

## 6. Message format

All generated messages should use this format:

```md
## [MSG-G-XXX] subject-slug-here
from: chatgpt
 to: alice | claude | chatgpt | jared | all
project: project-slug-or-general
type: task | question | status | build_request | review_request | decision | FYI | handoff
date: YYYY-MM-DDTHH:MM:SSZ
status: unread
priority: low | normal | high | urgent
requires: github | cloudflare | d1 | research | human | none

Message body here.

---
```

Notes:

- ChatGPT-authored IDs use `MSG-G-XXX`.
- Claude-authored IDs use `MSG-C-XXX`.
- Alice-authored IDs use `MSG-A-XXX`.
- Jared-authored IDs use `MSG-J-XXX`.
- The MCP may auto-generate IDs by scanning the destination file for the highest matching prefix.
- Generated messages should preserve existing file contents and append at the top below the title block or at the end, depending on the existing convention. For this repo, append after the first `---` if new-first order is desired; otherwise append at the end consistently.

---

## 7. Required tools

### 7.1 `deployment_status`

Return Worker health, configured repo, branch, available tools, readonly state, and binding presence without revealing secret values.

Input schema:

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

Output:

```json
{
  "worker": "agent-bridge-comms-mcp",
  "version": "0.1.0",
  "repo": "nothinginfinity/agent-bridge",
  "branch": "main",
  "readonly_mode": false,
  "bindings": {
    "GITHUB_TOKEN": true,
    "ADMIN_KEY": false
  },
  "tools": 14
}
```

---

### 7.2 `read_chatgpt_inbox`

Read `chatgpt/inbox.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.3 `read_claude_inbox`

Read `claude/inbox.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.4 `read_alice_inbox`

Read `alice/inbox.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.5 `read_alice_outbox`

Read `alice/outbox.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.6 `read_claude_outbox`

Read `claude/outbox.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.7 `read_bulletin`

Read `shared/bulletin.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.8 `read_decisions`

Read `shared/decisions.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": []
}
```

---

### 7.9 `read_specs`

List and optionally read markdown specs from `shared/specs/`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "path": { "type": "string", "description": "Optional spec filename under shared/specs/." },
    "limit_chars": { "type": "number", "default": 30000 }
  },
  "required": []
}
```

If `path` is omitted, return a list of spec filenames and metadata. If provided, read only that file after validating it is a markdown file directly under `shared/specs/`.

---

### 7.10 `send_message_to_claude`

Append a message to `claude/inbox.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "from": { "type": "string", "enum": ["chatgpt", "alice", "jared", "all"] },
    "project": { "type": "string" },
    "type": { "type": "string", "enum": ["task", "question", "status", "build_request", "review_request", "decision", "FYI", "handoff"] },
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "normal" },
    "requires": { "type": "string", "default": "none" }
  },
  "required": ["from", "project", "type", "subject", "body"]
}
```

Output:

```json
{
  "message_id": "MSG-G-C-003",
  "path": "claude/inbox.md",
  "commit_sha": "...",
  "status": "sent"
}
```

---

### 7.11 `send_message_to_alice`

Append a message to `alice/inbox.md`.

Input schema is the same as `send_message_to_claude`, except the destination is Alice.

---

### 7.12 `send_message_to_chatgpt`

Append a message to `chatgpt/inbox.md`. Used for self-handoffs, review requests, and messages from other agents.

Input schema is the same as `send_message_to_claude`, except the destination is ChatGPT.

---

### 7.13 `append_bulletin`

Append a broadcast update to `shared/bulletin.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "from": { "type": "string", "enum": ["chatgpt", "claude", "alice", "jared"] },
    "audience": { "type": "string", "default": "alice, claude, chatgpt, jared" },
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "normal" }
  },
  "required": ["from", "subject", "body"]
}
```

Generated format:

```md
## [BLT-XXX] subject-slug
**from:** chatgpt
**date:** YYYY-MM-DDTHH:MM:SSZ
**audience:** alice, claude, chatgpt, jared
**priority:** normal

Body.

---
```

---

### 7.14 `append_decision`

Append a durable decision to `shared/decisions.md`.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "from": { "type": "string" },
    "title": { "type": "string" },
    "body": { "type": "string" },
    "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "normal" },
    "status": { "type": "string", "default": "active" },
    "confirm_decision": { "type": "boolean" }
  },
  "required": ["from", "title", "body", "confirm_decision"]
}
```

Validation:

- reject if `confirm_decision` is not true
- reject in readonly mode
- optionally require `ADMIN_KEY` for this tool in production

Generated format:

```md
## [DEC-XXX] title-slug
**date:** YYYY-MM-DDTHH:MM:SSZ
**from:** Jared / ChatGPT
**status:** active
**priority:** high

Decision body.

---
```

---

### 7.15 `write_handoff`

Write a self-handoff into the requesting agent inbox, usually `chatgpt/inbox.md`, so future boots can resume context.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "project": { "type": "string" },
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "high" },
    "requires": { "type": "string", "default": "none" }
  },
  "required": ["agent", "project", "subject", "body"]
}
```

Output:

```json
{
  "message_id": "MSG-G-G-004",
  "path": "chatgpt/inbox.md",
  "status": "written",
  "commit_sha": "..."
}
```

---

## 8. Optional future tools

These are useful but not required for v0.1:

| Tool | Purpose |
|---|---|
| `mark_message_read` | Update status on a specific message |
| `close_message` | Mark a message closed/actioned |
| `search_bridge` | Search all allowed bridge files |
| `summarize_boot_state` | Return compact boot digest |
| `list_open_tasks` | Extract unread/high-priority messages |
| `create_spec` | Create a new markdown spec under `shared/specs/` |

Do not implement status mutation until the append-only convention is clarified. A safer first version can leave read/closed state as human-managed markdown.

---

## 9. Worker implementation outline

```js
const FILES = {
  chatgptInbox: 'chatgpt/inbox.md',
  claudeInbox: 'claude/inbox.md',
  aliceInbox: 'alice/inbox.md',
  aliceOutbox: 'alice/outbox.md',
  claudeOutbox: 'claude/outbox.md',
  bulletin: 'shared/bulletin.md',
  decisions: 'shared/decisions.md'
};

const TOOLS = [/* definitions above */];

function rpc(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function toolResult(id, result) {
  return Response.json({
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  });
}

function rpcErr(id, code, message) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } });
}

async function githubGetFile(env, path) {
  const owner = env.GITHUB_OWNER || 'nothinginfinity';
  const repo = env.GITHUB_REPO || 'agent-bridge';
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'agent-bridge-comms-mcp'
    }
  });
  if (!res.ok) throw new Error(`GitHub read failed for ${path}: ${res.status}`);
  const json = await res.json();
  return {
    path,
    sha: json.sha,
    content: atob(json.content.replace(/\n/g, ''))
  };
}

async function githubPutFile(env, path, content, message, sha) {
  if (String(env.READONLY_MODE || '').toLowerCase() === 'true') {
    throw new Error('Readonly mode is enabled');
  }
  const owner = env.GITHUB_OWNER || 'nothinginfinity';
  const repo = env.GITHUB_REPO || 'agent-bridge';
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'agent-bridge-comms-mcp'
    },
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
      branch
    })
  });
  if (!res.ok) throw new Error(`GitHub write failed for ${path}: ${res.status}`);
  return await res.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'agent-bridge-comms-mcp', version: '0.1.0', tools: TOOLS.length });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (url.pathname !== '/mcp' || request.method !== 'POST') return new Response('not found', { status: 404 });

    let body;
    try { body = await request.json(); } catch { return rpcErr(null, -32700, 'Parse error'); }
    const { id, method, params } = body;

    if (method === 'initialize') {
      return rpc(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agent-bridge-comms-mcp', version: '0.1.0' }
      });
    }
    if (method === 'notifications/initialized') return new Response(null, { status: 204 });
    if (method === 'ping') return rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS });

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const result = await handleTool(name, args, env);
        return toolResult(id, result);
      } catch (e) {
        return rpcErr(id, -32603, `Tool error: ${e.message}`);
      }
    }

    return rpcErr(id, -32601, `Method not found: ${method}`);
  }
};
```

---

## 10. Ordering and append strategy

For v0.1, use simple append-at-end to reduce accidental header corruption.

Append strategy:

1. Read current file.
2. Ensure it ends with a newline.
3. Append generated message block.
4. Commit with clear message.

Future version may support insert-after-title so newest messages appear first, but only after all agents agree on ordering.

---

## 11. Acceptance criteria

1. `GET /health` returns status ok, version, configured repo, and tool count.
2. `POST /mcp` initialize succeeds.
3. `tools/list` returns all v0.1 tools.
4. `read_chatgpt_inbox` returns `chatgpt/inbox.md` content.
5. `read_claude_inbox` returns `claude/inbox.md` content.
6. `read_alice_inbox` returns `alice/inbox.md` content.
7. `read_bulletin` returns `shared/bulletin.md` content.
8. `read_decisions` returns `shared/decisions.md` content.
9. `read_specs` lists specs and can read a named markdown spec.
10. `send_message_to_claude` appends a valid message to `claude/inbox.md` and commits it.
11. `send_message_to_alice` appends a valid message to `alice/inbox.md` and commits it.
12. `send_message_to_chatgpt` appends a valid message to `chatgpt/inbox.md` and commits it.
13. `append_bulletin` appends a valid bulletin to `shared/bulletin.md` and commits it.
14. `append_decision` rejects unless `confirm_decision` is true.
15. No tool can read or write outside the allowlisted paths.
16. No secret values are returned in any response.
17. Readonly mode disables all mutating tools.

---

## 12. Toolsmith registration

Register as:

- connector id: `conn_agent_bridge_comms`
- catalogue id: `tool_09_agent_bridge_comms`
- bundle: `comms-spine`
- risk profile: `coordination-write`
- connector URL: `https://agent-bridge-comms-mcp.agentfeedoptimization.com/mcp`

Recommended belts:

| Belt | Include this MCP? | Why |
|---|---:|---|
| Comms Spine | yes | foundational |
| ChatGPT Architect Belt | yes | boot/spec/handoff continuity |
| Claude Builder Belt | yes | build requests and deploy status |
| Vector Memory Belt | yes | handoffs around embeddings/reindexing |
| Cloudflare Readonly Belt | yes | audit reports and decisions |
| Full Project Ops Belt | yes | war-room coordination |

---

## 13. Claude deployment checklist

1. Build `agent-bridge-comms-mcp` Worker with the MCP pattern above.
2. Add secret `GITHUB_TOKEN` with repo-scoped access to `nothinginfinity/agent-bridge`.
3. Add vars:
   - `GITHUB_OWNER=nothinginfinity`
   - `GITHUB_REPO=agent-bridge`
   - `GITHUB_BRANCH=main`
4. Optional: add `ADMIN_KEY` for privileged write gates.
5. Deploy Worker.
6. Attach route: `agent-bridge-comms-mcp.agentfeedoptimization.com/*`.
7. Verify `/health`.
8. Verify `initialize`, `ping`, and `tools/list`.
9. Smoke test all read tools.
10. Smoke test `send_message_to_chatgpt` with a low-priority self-test message.
11. Smoke test `append_bulletin` only after Jared approves.
12. Register connector in AFO Toolsmith.
13. Add connector to the base Comms Spine belt.
14. Add connector to ChatGPT Architect, Claude Builder, Vector Memory, Cloudflare Readonly, and Full Project Ops belts as appropriate.

---

## 14. Open decisions

1. Should v0.1 append messages to the end or insert newest messages after the title block?
2. Should `append_decision` require `ADMIN_KEY`, `confirm_decision`, or both?
3. Should each agent have its own GitHub token, or should the MCP use one service token with repo-only scope?
4. Should status mutation tools be deferred until message ordering and append-only conventions are formalized?
5. Should Agent Bridge Comms MCP live as its own Worker or be generated/managed entirely through AFO Toolsmith?

Recommended defaults:

- append-at-end for v0.1
- `append_decision` requires both `ADMIN_KEY` and `confirm_decision: true` in production
- use a repo-scoped service token
- defer status mutation tools
- deploy as a standalone Worker first, then register it in Toolsmith

---

## 15. Notes

Agent Bridge Comms MCP is not just a convenience connector. It is the durable communication layer that lets every future AFO workcell keep context while tools are swapped in and out.

This MCP should become part of the default Comms Spine before expanding the belt taxonomy further.
