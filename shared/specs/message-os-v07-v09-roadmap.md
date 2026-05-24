# Message OS v07-v09 Roadmap

**status:** planned
**current stable:** v06 `triage_inbox`
**goal:** turn Message OS from inbox detection into in-chat messaging, routing, archive, and memory.

## Current baseline

```txt
v06 = triage_inbox detection
```

v06 is the stable boot/session check layer.

It should be called at the start or end of substantive assistant responses when Message OS awareness is enabled.

```txt
triage_inbox
→ sync Agent Bridge GitHub inbox
→ check human Message OS inbox
→ check bridge notifications
→ combine into one prioritized list
```

## v07 — Inbox notification frame layer

### Goal

Create a shared cross-client card contract for ChatGPT and Claude so unread messages can be surfaced through MCP tool-call approval UI as message cards.

This does not create true push notifications. It creates poll-on-response in-chat messaging:

```txt
assistant response begins/ends
→ triage_inbox
→ if unread messages exist
→ propose_inbox_notification_frame
→ approval/card UI appears
→ Jared chooses next action
```

### New tool

```txt
propose_inbox_notification_frame
```

### Input shape

```json
{
  "message_id": "...",
  "notification_id": "...",
  "source": "message_hub | agent_bridge",
  "sender": "...",
  "recipient": "jared",
  "priority": "low | normal | high | urgent",
  "title": "...",
  "preview": "...",
  "available_actions": ["open", "preview", "reply", "archive", "ignore", "later"],
  "recommended_action": "preview",
  "project": "...",
  "created_at": "..."
}
```

### Output shape

```json
{
  "frame_id": "...",
  "message_id": "...",
  "notification_id": "...",
  "selected_action_ready": false,
  "next_tools": {
    "open": "read_human_message",
    "preview": "preview_message",
    "reply": "reply_or_route",
    "archive": "archive_to_drivemind",
    "ignore": "mark_human_message_seen",
    "later": "defer_message"
  },
  "display_payload": {
    "title": "New message from Claude",
    "subtitle": "High priority · Agent Bridge",
    "preview": "...",
    "actions": ["open", "preview", "reply", "archive", "ignore", "later"]
  }
}
```

### Cross-client rule

```txt
Same message semantics, different rendered UI.
```

Claude and ChatGPT may render MCP approval cards differently, but both should use the same tool contract and action semantics.

### Assistant behavior

- Do not open full message body automatically.
- Show sender, priority, title, short preview.
- Ask Jared to choose open, preview, reply, archive, ignore, or later.
- Do not mark handled unless Jared chooses ignore/archive/done.

## v08 — Reply or route layer

### Goal

Let Jared reply to messages or route them into the correct communication surface.

### New tool

```txt
reply_or_route
```

### Supported destinations

```txt
claude/inbox.md
alice/inbox.md
chatgpt/inbox.md
shared/bulletin.md
shared/decisions.md
Message OS human hub
```

### Input shape

```json
{
  "source_message_id": "...",
  "route_type": "reply | forward | bulletin | decision | handoff",
  "to": "claude | alice | chatgpt | jared | shared",
  "subject": "...",
  "body": "...",
  "priority": "low | normal | high | urgent",
  "project": "...",
  "mark_source_handled": true
}
```

### Behavior

```txt
read/source message context
→ create reply body or accept provided body
→ write to destination
→ optionally mark source handled
→ return commit/message IDs
```

### Safety rules

- Ask before sending any reply.
- Clearly show destination and body summary before commit.
- Never write secrets/tokens into GitHub message files.
- For shared bulletin/decisions, use explicit route_type and include project context.

## v09 — DriveMind archive + vector memory promotion

### Goal

Move from simple archive bundle creation to durable private archive and optional semantic memory.

### New tools

```txt
archive_to_drivemind
promote_message_to_memory
export_message_bundle
list_archived_messages
```

### Archive modes

```txt
local_bundle
cloud_export
project_vault
vector_memory
```

### Archive bundle shape

```json
{
  "message_id": "...",
  "source": "message_hub | agent_bridge",
  "subject": "...",
  "body": "...",
  "summary": "...",
  "project": "...",
  "tags": [],
  "received_at": "...",
  "archived_at": "...",
  "visibility": "private",
  "vectorized": false,
  "markdown": "# ...",
  "json": {}
}
```

### Memory promotion behavior

- Archive first.
- Ask Jared before vectorizing.
- Allow project-scoped namespaces.
- Preserve source IDs and timestamps.
- Support deletion/tombstone later.

## Suggested implementation order

```txt
1. Keep v06 stable.
2. Deploy v07 as message-os-v07-mcp with propose_inbox_notification_frame.
3. Smoke test cards in ChatGPT and Claude.
4. Deploy v08 with reply_or_route.
5. Test replies to claude/inbox.md, alice/inbox.md, and shared/bulletin.md.
6. Deploy v09 with DriveMind archive/memory promotion.
```

## Boot instruction update

When Message OS v07+ is connected:

```txt
At the start or end of every substantive response, call triage_inbox.

If messages exist, call propose_inbox_notification_frame for the highest priority message.

Tell Jared the sender, priority, and title. Ask whether to open, preview, reply, archive, ignore, or later.
```
