# Missing Tool Request Protocol

**status:** active-proposed
**created:** 2026-05-24
**from:** ChatGPT
**project:** AFO Toolsmith / Workcells

---

## 1. Purpose

When an agent hits a tool boundary, it should not stall, hallucinate a capability, or repeatedly retry a failing tool.

Instead, it should recognize:

```txt
This task needs a new tool.
```

Then it should emit a concise **Missing Tool Request** that Jared can paste into AFO Toolsmith to generate the new MCP.

This protocol turns tool failure into product discovery.

---

## 2. Core Pattern

```txt
Agent tries task
→ existing tools fail or are insufficient
→ agent identifies missing capability
→ agent writes Missing Tool Request
→ Jared builds/attaches MCP through AFO Toolsmith
→ task resumes with new capability
→ new tool is added to the right workcell/belt
```

This is central to the doctrine:

```txt
Workcells > Swarms
```

A workcell should evolve by adding exactly the missing tool required for the task.

---

## 3. When To Emit A Missing Tool Request

Emit one when:

- A needed API payload format is unsupported, such as `multipart/form-data`.
- A connected MCP only supports read, but the task needs write.
- A tool repeatedly fails due to a stable design gap, not a transient error.
- The task requires a new data source, such as Google Drive, Gmail, Calendar, Sheets, Linear, Notion, etc.
- The task requires a safety wrapper around a risky operation.
- The user is operating mobile-only and the manual UI path is too awkward.
- The current belt is missing the comms spine or another essential tool.

Do not emit one for:

- Simple user preference questions.
- Temporary network errors.
- Actions that are unsafe or should not be automated.
- Cases where the needed tool already exists but is simply not connected; ask Jared to connect the right belt instead.

---

## 4. Missing Tool Request Format

Use this compact format in chat, inboxes, specs, or Toolsmith entries.

```md
## Missing Tool Request: <tool-name>

**Problem:**
What failed or is impossible with current tools.

**Needed capability:**
What the new tool should do.

**Inputs:**
- input_name: type — description

**Outputs:**
- output_name: type — description

**Safety / risk:**
low | safe | dev-only | high-power

**Belongs in belt/workcell:**
Which workcell should include it.

**Example call:**
```json
{}
```

**Success criteria:**
How we know the tool works.
```

---

## 5. Example: Cloudflare Multipart Form Tool

```md
## Missing Tool Request: cloudflare-multipart-mcp

**Problem:**
Cloudflare Worker settings updates reject JSON payloads and require `multipart/form-data`. Existing `mcp-prax` raw API helper sends JSON only, so Worker binding updates fail.

**Needed capability:**
Send Cloudflare API requests using `multipart/form-data`, especially for Worker settings/bindings updates.

**Inputs:**
- method: POST | PUT | PATCH
- scope: account | zone
- path: string
- fields: array of text form fields
- json_fields: array of fields to JSON.stringify before appending
- dry_run: boolean

**Outputs:**
- ok: boolean
- status: number
- redacted_response: object
- before_after_manifest: object, when applicable

**Safety / risk:**
dev-only / high-power

**Belongs in belt/workcell:**
Claude Builder Workcell, Cloudflare Build Belt, Full Project Ops Belt.

**Example call:**
```json
{
  "method": "PATCH",
  "scope": "account",
  "path": "/workers/scripts/vector-lab-mcp/settings",
  "json_fields": [
    {
      "name": "settings",
      "value": {
        "bindings": [
          { "type": "d1", "name": "DB", "id": "7a675862-1284-45a6-941a-3bcef0e540ef" },
          { "type": "ai", "name": "AI" },
          { "type": "vectorize", "name": "VECTORIZE", "index_name": "afo-messages" }
        ]
      }
    }
  ]
}
```

**Success criteria:**
The Worker settings endpoint accepts the request and the Worker shows the requested bindings without exposing secret values.
```

---

## 6. Agent Behavior Rule

When blocked by tool capability, agents should say something like:

```txt
This is not a reasoning problem; it is a tool gap. I need a new MCP tool that can <capability>. Here is the smallest tool description to build it.
```

Then provide the Missing Tool Request.

---

## 7. Storage Locations

Missing tool requests may be stored in:

```txt
shared/specs/<tool-name>.md
shared/bulletin.md
chatgpt/inbox.md
claude/inbox.md
alice/inbox.md
```

For durable product-level tool requests, prefer:

```txt
shared/specs/<tool-name>.md
```

For urgent agent handoff, also send to the relevant agent inbox.

---

## 8. Toolsmith Integration Recommendation

AFO Toolsmith should eventually have a first-class object type:

```txt
missing_tool_request
```

Fields:

- id
- title
- problem
- needed_capability
- inputs_json
- outputs_json
- safety_profile
- target_belts_json
- status: proposed | building | ready | deprecated
- created_by
- created_at
- linked_connector_id

This would make Toolsmith not only a tool generator, but a tool-gap capture system.

---
