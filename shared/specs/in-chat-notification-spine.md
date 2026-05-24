# In-Chat Notification Spine

**status:** proposed foundational platform spec
**owner:** Jared Edwards / AFO Toolsmith
**related specs:**
- `shared/specs/agent-bridge-comms-mcp.md`
- `shared/specs/agent-bridge-comms-mcp-notifications.md`
- `shared/specs/agent-bridge-comms-mcp-ui-frames.md`

**purpose:** Generalize Agent Bridge message notifications into a belt-scoped in-chat event notification system for agents, apps, deliveries, email, SMS, calendar, GitHub, Cloudflare, and other connected sources.

---

## 1. Product insight

The Agent Bridge Comms MCP notification idea is bigger than agent inboxes.

It becomes a general platform pattern:

```txt
Event happens anywhere
→ connector detects it
→ notification router normalizes it
→ workcell context filters it
→ UI frame presents it in chat
→ Jared chooses an action
→ the correct next MCP tool runs
```

This creates an **in-chat notification system** for mobile-first agent work.

The important shift:

```txt
Notifications should not be raw alerts.
They should be actionable, scoped decision frames.
```

---

## 2. Why this matters

Jared is building from a phone. He does not want noisy global notifications interrupting every work session.

Instead, each workcell/belt should decide which notifications matter.

Examples:

```txt
Work Belt
- Claude / Alice / ChatGPT messages
- GitHub PRs/issues/commits
- Cloudflare deploy alerts
- Toolsmith build status
- work calendar events
```

```txt
Personal / Delivery Belt
- Amazon delivery status
- DoorDash / Instacart status
- SMS from selected people
- personal reminders
```

```txt
Ops Belt
- Cloudflare errors
- GitHub deploy failures
- D1 migration status
- billing/API quota alerts
```

```txt
Memory Belt
- brainstorm capture failures
- vector indexing complete
- voice memo import complete
- semantic search matches needing review
```

The same notification infrastructure can serve all of these, but the belt/workcell decides what is active.

---

## 3. Relationship to Comms Spine

The Comms Spine originally meant:

```txt
boot instructions
+ inbox/outbox access
+ specs/handoffs
+ send messages
+ decisions/bulletins
```

Now extend it with:

```txt
+ notification awareness
+ UI decision frames
+ next-action routing
```

Updated doctrine:

```txt
A serious Comms Spine should not only read and write messages.
It should cheaply detect important coordination state and present it as actionable in-chat frames.
```

This makes the Comms Spine feel alive without requiring true background autonomy.

---

## 4. Core architecture

```txt
Source Connector
→ Event Collector
→ Notification Router
→ Context/Belt Filter
→ UI Frame Tool
→ Choice Recorder
→ Action Router
→ Next MCP Tool
```

### Source Connector

Detects source-specific events.

Examples:

```txt
agent_bridge
email
gmail
icloud_mail
sms
calendar
amazon
doordash
github
cloudflare
toolsmith
voice_memory
brainstorm_memory
```

### Event Collector

Receives or polls raw events.

Methods:

```txt
polling
webhook
email parser
API query
Shortcuts push
manual capture
```

### Notification Router

Normalizes raw events into a standard notification object.

### Context/Belt Filter

Determines whether this notification belongs in the current workcell.

### UI Frame Tool

Creates a structured tool-call approval frame that Jared can quickly understand.

### Choice Recorder

Records Jared's selected action.

### Action Router

Maps the selected action to the next MCP call.

---

## 5. Standard notification object

All notification connectors should normalize into this shape:

```json
{
  "id": "notif_...",
  "source": "agent_bridge",
  "source_account": "nothinginfinity/agent-bridge",
  "category": "work",
  "event_type": "message_received",
  "priority": "high",
  "title": "New message from Claude",
  "summary": "Claude sent a high-priority Cloudflare deploy update.",
  "preview": "Deploy completed; needs verification and Toolsmith registration.",
  "actor": "claude",
  "project": "agent-bridge",
  "created_at": "2026-05-24T00:00:00Z",
  "visibility": "workcell",
  "requires_attention": true,
  "actions": [
    {
      "id": "open",
      "label": "Open message",
      "next_tool": "read_new_messages",
      "risk": "low"
    },
    {
      "id": "preview",
      "label": "Show preview",
      "next_tool": "read_new_messages",
      "risk": "low"
    },
    {
      "id": "ignore",
      "label": "Ignore for now",
      "next_tool": "mark_notifications_seen",
      "risk": "low"
    },
    {
      "id": "later",
      "label": "Save for later",
      "next_tool": "save_notification_for_later",
      "risk": "low"
    }
  ],
  "metadata": {}
}
```

---

## 6. Belt-scoped notification policy

Every belt/workcell should declare a notification policy.

Example:

```json
{
  "belt_id": "belt_chatgpt_architect",
  "notification_policy": {
    "enabled": true,
    "sources": ["agent_bridge", "github", "toolsmith", "cloudflare"],
    "categories": ["work", "ops", "build"],
    "priority_min": "normal",
    "personal_sources_allowed": false,
    "surface_mode": "ask_before_open",
    "quiet_sources": ["delivery", "personal_sms"]
  }
}
```

Personal/delivery belt:

```json
{
  "belt_id": "belt_delivery_watch",
  "notification_policy": {
    "enabled": true,
    "sources": ["amazon", "doordash", "calendar", "sms"],
    "categories": ["delivery", "personal"],
    "priority_min": "low",
    "personal_sources_allowed": true,
    "surface_mode": "frame_on_match"
  }
}
```

Rules:

1. Work belts should not surface personal notifications by default.
2. Personal/delivery belts should not surface work agent messages unless explicitly enabled.
3. High/urgent notifications can be surfaced immediately inside the next assistant response.
4. Low/normal notifications should be batched or summarized unless the belt asks for all events.
5. Full event content should not be opened until Jared approves, unless the belt has explicit pre-authorization.

---

## 7. Core MCP tools

These tools may live inside `agent-bridge-comms-mcp` for bridge events and later in a generalized `notification-spine-mcp`.

### 7.1 `check_events`

Check event sources enabled for the current belt.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "belt_id": { "type": "string" },
    "agent": { "type": "string" },
    "sources": { "type": "array", "items": { "type": "string" } },
    "priority_min": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "normal" },
    "limit": { "type": "number", "default": 10 }
  },
  "required": []
}
```

### 7.2 `normalize_notification`

Convert a source-specific event into a standard notification object.

### 7.3 `propose_notification_frame`

Render a normalized notification into a structured tool-call approval frame.

### 7.4 `record_notification_choice`

Record Jared's selected action.

### 7.5 `route_notification_action`

Return or execute the next MCP tool call needed for the selected action.

### 7.6 `save_for_later`

Defer notification to a later time/session/belt.

### 7.7 `snooze_notification`

Snooze for a specified amount of time.

### 7.8 `mark_notification_seen`

Mark seen/dismissed/handled.

---

## 8. Source-specific examples

### Agent Bridge

```txt
Source: agent_bridge
Event: Claude wrote to chatgpt/inbox.md
Frame actions:
- Open message
- Preview
- Reply
- Save for later
- Add to bulletin
- Create GitHub issue
```

### Email

```txt
Source: email
Event: important email received
Frame actions:
- Preview
- Open full email
- Draft reply
- Archive
- Snooze
- Add calendar follow-up
```

### SMS / Messages

```txt
Source: sms
Event: message from selected contact
Frame actions:
- Preview
- Reply
- Remind me later
- Save to notes
```

SMS/iMessage access may require platform-specific shortcuts, device permissions, or a different bridge. Do not assume direct cloud access.

### Amazon / delivery

```txt
Source: amazon
Event: package delivered or out for delivery
Frame actions:
- View status
- Ignore
- Remind me to bring it inside
- Add delivery note
```

Amazon access may require email parsing, app notification capture, or official API availability depending on account/type. Do not assume unrestricted API access.

### DoorDash / food delivery

```txt
Source: doordash
Event: driver nearby or order delivered
Frame actions:
- View status
- Message driver if supported
- Ignore
- Remind me in 5 minutes
```

DoorDash access may require email/SMS/app-notification parsing unless official integration is available.

### GitHub

```txt
Source: github
Event: issue/PR/commit/deploy activity
Frame actions:
- Open issue
- Summarize diff
- Reply/comment
- Create follow-up task
- Ask Claude to inspect
```

### Cloudflare

```txt
Source: cloudflare
Event: deploy/error/binding/route status
Frame actions:
- Show status
- Ask Claude to debug
- Open Worker
- Add bulletin
- Save incident note
```

---

## 9. UI-frame contract

The UI-frame layer should produce a compact, human-readable approval payload.

```json
{
  "frame_id": "frame_...",
  "frame_type": "notification_triage",
  "title": "New high-priority message from Claude",
  "summary": "Claude sent a Cloudflare deploy update.",
  "priority": "high",
  "source": "agent_bridge",
  "preview": "Deploy completed; needs verification.",
  "recommended_action": "open",
  "actions": [
    { "id": "open", "label": "Open message" },
    { "id": "preview", "label": "Preview" },
    { "id": "ignore", "label": "Ignore" },
    { "id": "later", "label": "Save for later" },
    { "id": "reply", "label": "Reply" }
  ]
}
```

Important: if the host client only offers Allow/Deny, then Allow means:

```txt
Record/display this frame and proceed to ask Jared which action to take.
```

If a future AFO mobile client supports true buttons, the same contract can render native buttons.

---

## 10. Action routing

The notification action is not the final behavior. It routes to the next tool.

Examples:

```txt
open → read_new_messages
reply → send_message_to_claude / send_email / send_sms
calendar → create_calendar_item / create_reminder
github → open_github_context / create_issue / comment_on_pr
website → create_context_link / open_url_summary
memory → capture_turn / save_to_voice_memory / save_to_brainstorm_memory
ignore → mark_notification_seen
later → save_for_later / snooze_notification
```

This means the notification frame does not need to do everything. It selects the next step.

---

## 11. D1 schema

```sql
CREATE TABLE IF NOT EXISTS notification_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  auth_status TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT,
  category TEXT,
  event_type TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  summary TEXT,
  preview TEXT,
  actor TEXT,
  project TEXT,
  visibility TEXT DEFAULT 'workcell',
  requires_attention INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unread',
  actions_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_belt_policies (
  id TEXT PRIMARY KEY,
  belt_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sources_json TEXT,
  categories_json TEXT,
  priority_min TEXT DEFAULT 'normal',
  personal_sources_allowed INTEGER NOT NULL DEFAULT 0,
  surface_mode TEXT DEFAULT 'ask_before_open',
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_actions (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  frame_id TEXT,
  choice_id TEXT NOT NULL,
  choice_label TEXT,
  next_tool TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (notification_id) REFERENCES notifications(id)
);
```

---

## 12. Security and privacy rules

1. No source should be enabled globally by default.
2. Workcell/belt policy controls what notification sources are active.
3. Personal sources require explicit opt-in.
4. Preview-only mode should be available for sensitive sources.
5. Full message/email/SMS content requires approval unless the belt says otherwise.
6. Mutating actions such as reply, purchase, cancel, deploy, delete, or send should require a separate approval frame.
7. Notification tools should not expose secrets or auth tokens.
8. If a connector can only infer events from email/SMS/app notifications, label that clearly.
9. Add audit logs for every surfaced notification and selected action.
10. Support `quiet mode` and `focus mode` per belt.

---

## 13. Toolsmith productization

This should become a Toolsmith capability pack:

```txt
In-Chat Notification Spine
```

Catalogue row draft:

```json
{
  "id": "tool_12_in_chat_notification_spine",
  "name": "In-Chat Notification Spine",
  "description": "Belt-scoped event notifications rendered as actionable in-chat MCP approval frames.",
  "connector_id": "conn_in_chat_notification_spine",
  "risk_profile": "notification-routing-medium",
  "bundle": "comms-spine",
  "tags": ["notifications", "ui-frames", "workcells", "routing", "mobile-first"]
}
```

Recommended belts:

```txt
Comms UI Action Belt
Work Notifications Belt
Personal Delivery Belt
Ops Alert Belt
Memory Notification Belt
Full Project Ops Belt
```

---

## 14. Build sequence

### Phase 1: Agent Bridge notifications

- Build `check_notifications`.
- Build `propose_notification_frame`.
- Build `record_frame_choice`.
- Route actions: open, preview, ignore, later, reply.

### Phase 2: Belt notification policy

- Add belt-level source/category filters.
- Store policies in D1 or Toolsmith DB.
- Let workcells declare notification scope.

### Phase 3: Generic notification spine

- Normalize non-bridge events.
- Add email/GitHub/Cloudflare sources first.
- Add delivery/personal sources later.

### Phase 4: Webhook mode

- GitHub webhooks.
- Email parser / inbound webhook.
- Cloudflare events.
- Optional Shortcuts push for iPhone events.

### Phase 5: Custom UI renderer

- Use native MCP approval frames now.
- Later render the same frame contract in an AFO mobile workcell client with real buttons.

---

## 15. Acceptance criteria

1. A belt can declare which notification sources are active.
2. `check_events` returns only relevant notifications for the current belt.
3. Notifications are normalized to a standard object.
4. UI frames show source, priority, summary, preview, and actions.
5. Jared can choose open, preview, ignore, later, reply, calendar, GitHub, or other next action.
6. The selected action routes to the correct next MCP when connected.
7. Work sessions do not surface personal notifications unless explicitly enabled.
8. Personal/delivery sessions can surface delivery/personal notifications without surfacing work noise.
9. Full content is not opened without approval by default.
10. Mutating actions require separate approval.

---

## 16. Platform doctrine

```txt
Comms Spine = coordination continuity.
Memory Spine = durable recall.
Notification Spine = contextual awareness.
UI Frames = human-readable decision gates.
Task Tools = action execution.
```

Together:

```txt
Comms Spine
+ Memory Spine
+ Notification Spine
+ UI Frames
+ Task Tool Pack
= high-continuity mobile workcell
```

This may be the most important layer for making mobile-first agentic work feel usable.
