# DriveMind Message Archive Layer

**status:** proposed foundational architecture
**owner:** Jared Edwards / AFO Toolsmith
**related specs:**
- `shared/specs/chatgpt-human-messaging-hub.md`
- `shared/specs/in-chat-notification-spine.md`
- `shared/specs/agent-bridge-comms-mcp.md`
- `shared/specs/agent-bridge-comms-mcp-notifications.md`
- `shared/specs/agent-bridge-comms-mcp-ui-frames.md`

**purpose:** Define DriveMind as the private durable archive and personal knowledge layer for LLM-native messaging, while Agent Bridge / GitHub / D1 act as live transport and notification layers.

---

## 1. Product insight

The Human Message Hub does not need to keep every message permanently in the live transport layer.

Instead:

```txt
GitHub / D1 / Agent Bridge = live message transport, routing, notifications, and coordination
DriveMind = private durable archive and personal knowledge vault
Vector DB = semantic retrieval layer
LLM + MCP = triage, routing, transformation, and action interface
```

This gives Jared control over whether messages are:

```txt
ephemeral
short-lived
archived privately
promoted to durable memory
shared intentionally
converted into action/spec/media
```

---

## 2. Why DriveMind matters

DriveMind is the private storage layer for the communication system.

Without DriveMind:

```txt
messages may remain in live cloud transport longer than needed
```

With DriveMind:

```txt
messages can pass through a live hub briefly
→ be exported to Jared-controlled private storage
→ remain searchable through controlled MCP access
```

This turns the messaging system into a user-owned communication substrate rather than another permanent third-party inbox.

---

## 3. Layer model

```txt
Live Transport Layer
- GitHub inbox files
- D1 message queues
- Agent Bridge Comms MCP
- Notification Spine
- UI Frames

Private Archive Layer
- DriveMind external SSD / local vault
- local SQLite / file index
- markdown/json archives
- optional encrypted bundles later

Semantic Memory Layer
- local or cloud vector DB
- Vectorize when promoted to cloud
- local embeddings when possible

Action Layer
- ChatGPT / Claude / agents
- MCP tools
- Calendar
- GitHub
- image/video/song/spec/task generators
```

---

## 4. Message lifecycle

### 4.1 Live message

```txt
sender ChatGPT / Claude / human client
→ writes message to live inbox hub
→ recipient ChatGPT detects via Notification Spine
→ recipient previews/opens/replies/actions via UI Frame
```

### 4.2 Ephemeral message

```txt
message is read/replied/ignored
→ marked handled
→ allowed to expire according to retention policy
→ optional no archive
```

### 4.3 Archived private message

```txt
message is handled
→ exported to DriveMind
→ indexed locally
→ available through DriveMind MCP
```

### 4.4 Promoted memory message

```txt
message is important
→ exported to DriveMind
→ chunked/embedded
→ searchable in vector DB
→ linked to project/spec/task/calendar
```

### 4.5 Transformable message

```txt
message becomes source material
→ spec
→ GitHub issue
→ calendar event
→ task
→ image prompt
→ video script
→ song prompt
→ document
→ voice note
→ project memory
```

---

## 5. Transport versus archive doctrine

```txt
Transport is temporary by default.
Archive is intentional.
Memory is selective.
Action is approved.
```

Live hubs should optimize for routing and notifications, not permanent storage.

DriveMind should optimize for:

- private ownership
- durable archive
- local search
- controlled retrieval
- selective cloud promotion
- export/import
- long-term personal knowledge

---

## 6. Practical security posture

This architecture should not overclaim traditional end-to-end encrypted messaging in MVP.

But it can still offer strong practical control for Jared's use case because:

1. live exposure can be short-lived
2. approved senders only
3. messages can be archived off-cloud
4. LLM/MCP layer can enforce preview-before-open
5. belts decide which sources are visible
6. sensitive messages can avoid vectorization unless approved
7. archive can live on a physical external drive

Security doctrine:

```txt
Short live exposure + approved routes + user-controlled archive + scoped LLM access = practical control.
```

Future hardening:

- encryption at rest for DriveMind archives
- signed sender identity
- per-contact permissions
- message TTLs
- redaction before cloud/vector promotion
- local-only mode
- encrypted export bundles
- audit logs
- revocation workflows

---

## 7. Approved sender model

Human Message Hub should behave like email with a stronger approval layer.

Rules:

```txt
unknown sender → request inbox only
approved sender → allowed to live hub
muted sender → archived or suppressed
blocked sender → rejected
project-scoped sender → only appears in matching belt/project
```

LLM/MCP layer can act as a triage assistant by:

- summarizing unknown sender requests
- checking whether message matches allowed scope
- recommending block/mute/approve
- refusing auto-actions without approval

---

## 8. DriveMind archive format

Recommended archive layout:

```txt
DriveMind/
  messages/
    inbox/
      YYYY/
        MM/
          message-id.json
          message-id.md
    sent/
      YYYY/
        MM/
          message-id.json
          message-id.md
    projects/
      tool-notes/
        messages/
          message-id.md
  indexes/
    messages.sqlite
    vectors/
  exports/
  attachments/
```

Message JSON:

```json
{
  "id": "hm_...",
  "source": "human_message_hub",
  "transport": "github_agent_bridge",
  "from_user": "sam",
  "to_user": "jared",
  "subject": "Project idea",
  "body": "...",
  "summary": "...",
  "priority": "normal",
  "project": "tool-notes",
  "tags": ["project", "voice-memory"],
  "received_at": "2026-05-24T00:00:00Z",
  "archived_at": "2026-05-24T00:05:00Z",
  "visibility": "private",
  "vectorized": false,
  "actions_taken": [],
  "metadata": {}
}
```

Message markdown:

```md
# Project idea

from: sam
to: jared
project: tool-notes
priority: normal
received: 2026-05-24T00:00:00Z
archived: 2026-05-24T00:05:00Z

## Summary

...

## Message

...

## Actions

- [ ] reply
- [ ] consider as project spec
```

---

## 9. Required MCP tools

### 9.1 `archive_message_to_drivemind`

Copy a message from live transport into DriveMind archive.

Input:

```json
{
  "message_id": "hm_...",
  "source": "agent_bridge|human_hub|email|sms",
  "archive_mode": "copy",
  "project": "tool-notes",
  "tags": ["message", "project"],
  "vectorize": false,
  "update_transport_status_after_archive": true
}
```

### 9.2 `export_message_bundle`

Export one or more messages as a portable markdown/json bundle.

### 9.3 `search_archived_messages`

Search DriveMind message archive by keyword, metadata, or vector.

### 9.4 `get_archived_message`

Retrieve an archived message.

### 9.5 `promote_message_to_memory`

Chunk and embed a message into the selected vector database.

### 9.6 `transform_message`

Convert a message into another artifact.

Target types:

```txt
spec
github_issue
calendar_event
task
image_prompt
video_script
song_prompt
document
bulletin
decision
voice_note
```

### 9.7 `set_message_retention_policy`

Set ephemeral/durable retention rules by source, contact, project, or belt.

---

## 10. Retention policies

Example policies:

```json
{
  "policy_id": "work_messages_default",
  "source": "human_message_hub",
  "scope": "work",
  "live_ttl_hours": 72,
  "archive_to_drivemind": true,
  "vectorize_by_default": false,
  "update_transport_status_after_archive": true
}
```

```json
{
  "policy_id": "agent_bridge_ops",
  "source": "agent_bridge",
  "scope": "ops",
  "live_ttl_hours": 168,
  "archive_to_drivemind": true,
  "vectorize_by_default": true,
  "update_transport_status_after_archive": false
}
```

---

## 11. UI frame actions

Message notification frames should include archive/memory actions:

```txt
Open
Preview
Reply
Save for later
Archive to DriveMind
Promote to memory
Turn into task
Turn into calendar event
Turn into GitHub issue
Turn into spec
Transform into media prompt
Update live transport status
```

Mutating actions should require separate confirmation frames.

Example flow:

```txt
New message from Sam
→ Preview
→ Archive to DriveMind?
→ Promote to project memory?
→ Turn into GitHub issue?
```

---

## 12. Relationship to vector databases

Not every message should be vectorized.

Rules:

1. archive can be default
2. vectorization should be selective by policy or approval
3. sensitive personal messages should not be vectorized by default
4. project/work messages may be vectorized automatically inside project belts
5. vector metadata must include source, project, visibility, and retention policy

Vector metadata:

```json
{
  "type": "archived_message",
  "message_id": "hm_...",
  "source": "human_message_hub",
  "project": "tool-notes",
  "visibility": "private",
  "archive": "drivemind",
  "retention_policy": "work_messages_default"
}
```

---

## 13. Product differentiation

This system is better than SMS/WhatsApp for some workflows because messages are not just text bubbles.

They can become:

```txt
private archive
search result
vector memory
project spec
GitHub issue
calendar event
task
image prompt
video script
song seed
research artifact
decision record
handoff
```

Doctrine:

```txt
A message is not only communication.
A message is source material.
```

---

## 14. Build sequence

### Phase 1: live message hub

- Agent Bridge/Human Message Hub GitHub transport.
- Notifications and UI frames.
- Approved contacts only.

### Phase 2: DriveMind export

- Archive messages to DriveMind folder layout.
- Export markdown/json.
- Retention policies.

### Phase 3: Search and memory

- Local index.
- Optional Vectorize promotion.
- Search archived messages through DriveMind MCP.

### Phase 4: Transform actions

- message to task/calendar/spec/GitHub/media prompt.
- frame-based approvals for each mutation.

### Phase 5: hardened privacy

- encryption at rest.
- signed identities.
- local-only mode.
- encrypted bundles.
- revocation workflows.

---

## 15. Open decisions

1. Should DriveMind archive start as files only or SQLite + files?
2. Should live GitHub transport messages update status after archive?
3. Which messages are vectorized by default?
4. Should personal messages require manual vector promotion?
5. Should message transformations write back into the original message thread?
6. Should DriveMind support encrypted message bundles in MVP?

Recommended defaults:

```txt
Archive to markdown + JSON first.
Keep live GitHub transport during MVP.
Vectorize work/project messages only when policy allows.
Require manual promotion for personal messages.
No encryption claims in MVP, but design archive layout to allow encrypted bundles later.
```

---

## 16. Platform doctrine

```txt
Live Hub = route and notify.
DriveMind = own and preserve.
Vector DB = retrieve and reason.
UI Frames = approve and direct.
MCP Tools = transform and act.
```

Combined:

```txt
Message
→ notification
→ decision frame
→ action
→ archive
→ memory
→ artifact
```

This is the bridge from messaging to personal operating system.
