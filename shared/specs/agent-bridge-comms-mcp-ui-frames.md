# Agent Bridge Comms MCP — UI Frames and Action Belt Addendum

**status:** proposed addendum
**parent specs:**
- `shared/specs/agent-bridge-comms-mcp.md`
- `shared/specs/agent-bridge-comms-mcp-notifications.md`

**target worker:** `agent-bridge-comms-mcp`
**purpose:** Use MCP tool-call approval frames as structured, near-iframe interaction cards for bridge notifications, message triage, and next-action workflows.

---

## 1. Product insight

The ChatGPT/Claude client already renders a native approval UI whenever a tool call needs user approval.

That approval UI is not a fully custom iframe, but it can be used as a structured interaction surface if the MCP tool is designed carefully.

Core leverage pattern:

```txt
MCP tool call
→ native client approval frame
→ structured title/summary/options/action in tool arguments
→ Jared clicks Allow / Deny
→ tool records approval or action intent
→ assistant takes the next step
```

This addendum turns Agent Bridge Comms MCP notifications into an interactive triage experience instead of plain text.

---

## 2. Desired user experience

When ChatGPT is responding and detects a new bridge message:

```txt
check_notifications finds new Claude/Alice/ALLIS message
→ assistant calls propose_notification_frame
→ native approval frame appears
→ Jared chooses whether to allow the frame/action
→ assistant follows up with the selected workflow
```

Target frame content:

```txt
New bridge message detected
From: Claude
Priority: high
Subject: Cloudflare deploy complete

Actions:
A. Open full message
B. Show preview
C. Ignore for now
D. Save for later
E. Reply
F. Add follow-up to calendar/reminders
G. Open related GitHub/spec/link
```

The native client may only expose Allow/Deny at first. In that case, the frame is used as an approval gate and the assistant asks Jared to reply with the choice letter or uses a follow-up `record_frame_choice` tool call.

---

## 3. Boundary: what this can and cannot do

### It can

- Use tool-call approval frames as readable decision cards.
- Put structured message metadata into the approval card.
- Show a preview/snippet as a tool argument.
- Record Jared's approval, dismissal, or selected action.
- Chain to the next MCP call: read message, reply, calendar, GitHub, website, spec, task, etc.
- Store frame state so the next step knows what Jared approved.

### It cannot guarantee in standard clients

- Replace the client’s native Allow/Deny buttons with arbitrary A/B/C/D/E buttons.
- Force ChatGPT to render a fully custom iframe from a normal MCP server.
- Run autonomously in the background when ChatGPT is not active.

### Product interpretation

This is still worth building because it creates a **near-iframe workflow** using existing MCP approval UX:

```txt
Structured tool-call arguments + approval frame + frame state + next-action belt = near-custom UI
```

---

## 4. Tool belt concept

Name:

```txt
Comms UI Action Belt
```

Purpose:

```txt
Turn new agent-bridge messages into structured interactive triage flows.
```

Suggested connectors:

```txt
conn_agent_bridge_comms
conn_agent_bridge_notifications
conn_ui_frames
conn_github_mcp
conn_calendar_or_reminders
conn_context_links
conn_vector_memory
```

Minimum v1 belt:

```txt
Agent Bridge Comms MCP
+ Notification tools
+ UI frame tools
```

Expanded belt:

```txt
Agent Bridge Comms MCP
+ Notification tools
+ UI frame tools
+ GitHub MCP
+ Calendar/Reminders MCP
+ Browser/Context Links MCP
+ Brainstorm Memory MCP
```

---

## 5. Frame lifecycle

```txt
1. check_notifications detects new message.
2. propose_notification_frame creates a frame record and requests approval.
3. Jared approves/denies or replies with an action letter.
4. record_frame_choice stores the chosen action.
5. assistant calls the next tool:
   - read_new_messages
   - send_message_to_claude
   - send_message_to_alice
   - append_bulletin
   - create_calendar_item
   - open_context_link
   - create_github_issue
   - write_handoff
6. mark_notifications_seen or save_for_later updates notification state.
```

---

## 6. New MCP tools

These tools can live inside `agent-bridge-comms-mcp` or be implemented as a small internal module named `ui_frames`.

### 6.1 `propose_notification_frame`

Create a structured notification decision frame for a new bridge message.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "notification_id": { "type": "string" },
    "source_file": { "type": "string" },
    "sender": { "type": "string" },
    "message_id": { "type": "string" },
    "subject": { "type": "string" },
    "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"] },
    "project": { "type": "string" },
    "preview": { "type": "string" },
    "recommended_action": { "type": "string" },
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "next_tool": { "type": "string" },
          "risk": { "type": "string", "enum": ["low", "medium", "high"] }
        },
        "required": ["id", "label"]
      }
    }
  },
  "required": ["agent", "sender", "subject", "priority"]
}
```

Default actions:

```json
[
  { "id": "open", "label": "Open full message", "next_tool": "read_new_messages", "risk": "low" },
  { "id": "preview", "label": "Show preview", "next_tool": "read_new_messages", "risk": "low" },
  { "id": "ignore", "label": "Ignore for now", "next_tool": "mark_notifications_seen", "risk": "low" },
  { "id": "later", "label": "Save for later", "next_tool": "save_notification_for_later", "risk": "low" },
  { "id": "reply", "label": "Reply to sender", "next_tool": "send_message_to_agent", "risk": "medium" },
  { "id": "calendar", "label": "Add follow-up to calendar/reminders", "next_tool": "create_calendar_item", "risk": "medium" },
  { "id": "github", "label": "Open related GitHub/spec", "next_tool": "open_github_context", "risk": "low" }
]
```

Output:

```json
{
  "frame_id": "frame_notif_...",
  "type": "notification_frame",
  "title": "New high-priority message from Claude",
  "summary": "Claude sent a message about Cloudflare deploy status.",
  "actions": ["open", "preview", "ignore", "later", "reply", "calendar", "github"],
  "approval_meaning": "Allow records this notification frame and lets the assistant proceed to ask Jared which action to take."
}
```

---

### 6.2 `record_frame_choice`

Record Jared's selected action from a notification/decision frame.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "frame_id": { "type": "string" },
    "choice_id": { "type": "string" },
    "choice_label": { "type": "string" },
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "notification_id": { "type": "string" },
    "notes": { "type": "string" }
  },
  "required": ["frame_id", "choice_id"]
}
```

Output:

```json
{
  "frame_id": "frame_notif_...",
  "choice_id": "open",
  "next_tool": "read_new_messages",
  "status": "recorded"
}
```

---

### 6.3 `propose_action_frame`

Create a general-purpose approval frame for an action the agent wants to take.

Use cases:

- reply to Claude/Alice
- commit a GitHub file
- append a decision
- deploy a Worker
- create calendar item
- save memory
- open a website/context link

Input schema:

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "summary": { "type": "string" },
    "proposed_action": { "type": "string" },
    "risk_level": { "type": "string", "enum": ["low", "medium", "high", "urgent"] },
    "requires": { "type": "array", "items": { "type": "string" } },
    "next_tool": { "type": "string" },
    "payload_preview": { "type": "object" },
    "alternatives": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" }
        }
      }
    }
  },
  "required": ["title", "summary", "proposed_action", "risk_level"]
}
```

---

### 6.4 `save_notification_for_later`

Mark a notification as deferred instead of seen/dismissed.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "notification_id": { "type": "string" },
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "remind_after": { "type": "string" },
    "notes": { "type": "string" }
  },
  "required": ["notification_id", "agent"]
}
```

---

### 6.5 `get_frame_templates`

Return reusable templates for notification/action frames.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "template_type": { "type": "string" }
  },
  "required": []
}
```

Template types:

```txt
notification_triage
message_reply
calendar_followup
github_action
cloudflare_action
memory_capture
risk_review
multi_choice_decision
```

---

## 7. D1 schema additions

```sql
CREATE TABLE IF NOT EXISTS ui_frames (
  id TEXT PRIMARY KEY,
  frame_type TEXT NOT NULL,
  agent TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  source_notification_id TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  selected_choice_id TEXT,
  selected_choice_label TEXT,
  next_tool TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ui_frame_events (
  id TEXT PRIMARY KEY,
  frame_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (frame_id) REFERENCES ui_frames(id)
);

CREATE INDEX IF NOT EXISTS idx_ui_frames_agent_status ON ui_frames(agent, status);
CREATE INDEX IF NOT EXISTS idx_ui_frames_notification ON ui_frames(source_notification_id);
```

---

## 8. Notification-to-frame flow

### Step 1: assistant checks notifications

```json
{
  "tool": "check_notifications",
  "args": {
    "agent": "chatgpt",
    "include_bulletin": true,
    "include_decisions": true,
    "include_outboxes": true,
    "mark_seen": false
  }
}
```

### Step 2: if new message exists, assistant proposes a frame

```json
{
  "tool": "propose_notification_frame",
  "args": {
    "agent": "chatgpt",
    "sender": "claude",
    "subject": "cloudflare deploy complete",
    "priority": "high",
    "preview": "Claude says the deploy completed and needs verification.",
    "recommended_action": "open",
    "actions": [
      { "id": "open", "label": "Open full message", "next_tool": "read_new_messages" },
      { "id": "ignore", "label": "Ignore for now", "next_tool": "mark_notifications_seen" },
      { "id": "reply", "label": "Reply to Claude", "next_tool": "send_message_to_claude" },
      { "id": "calendar", "label": "Add follow-up", "next_tool": "create_calendar_item" }
    ]
  }
}
```

### Step 3: assistant asks for action if native UI only provides Allow/Deny

```txt
I created a notification frame for Claude's new message. Reply with:
open, preview, ignore, later, reply, calendar, or github.
```

### Step 4: assistant records selected choice

```json
{
  "tool": "record_frame_choice",
  "args": {
    "frame_id": "frame_notif_...",
    "choice_id": "open",
    "choice_label": "Open full message",
    "agent": "chatgpt"
  }
}
```

### Step 5: assistant calls next MCP tool

```json
{
  "tool": "read_new_messages",
  "args": {
    "agent": "chatgpt",
    "notification_ids": ["notif_..."]
  }
}
```

---

## 9. Example assistant behavior

```txt
I found a new high-priority bridge message from Claude.

I can open it, preview it, ignore it, save it for later, reply, add a follow-up, or open related GitHub context.
```

Then a native approval frame appears from `propose_notification_frame` with the structured payload.

If Jared approves and chooses `open`, the next tool call reads the full message.

If Jared chooses `reply`, the assistant drafts a reply and calls a send-message tool after approval.

If Jared chooses `calendar`, the assistant passes the message context to a Calendar/Reminders MCP if connected.

---

## 10. Project instruction for ChatGPT

Recommended instruction once this module is live:

```txt
At the beginning or end of every substantive response, call Agent Bridge Comms MCP `check_notifications`.

If new bridge messages exist, do not silently read the full message body. Instead call `propose_notification_frame` with sender, priority, subject, preview if available, and action choices.

Use the frame to let Jared decide whether to open, preview, ignore, save for later, reply, add a follow-up, open GitHub/context, or take another connected action.

If the native approval UI only allows Allow/Deny, ask Jared to reply with the desired action word after the frame is approved.
```

---

## 11. Toolsmith registration addition

Add this capability to the existing Agent Bridge Comms connector row, or register as an internal module:

```json
{
  "module": "ui_frames",
  "parent_connector": "conn_agent_bridge_comms",
  "description": "Structured approval-frame workflows for message triage and next-action routing.",
  "risk_profile": "coordination-ui-medium",
  "tools": [
    "propose_notification_frame",
    "record_frame_choice",
    "propose_action_frame",
    "save_notification_for_later",
    "get_frame_templates"
  ]
}
```

Suggested belt:

```txt
Comms UI Action Belt
```

Belt composition:

```txt
Comms Spine
+ Notification Check
+ UI Frames
+ Task-specific next-action tools
= interactive workcell coordination
```

---

## 12. Acceptance criteria

1. A new bridge notification can be converted into a structured notification frame.
2. Frame output is compact and readable inside native tool approval UI.
3. Frame state is stored with `frame_id`.
4. Jared can choose an action in chat after approving the frame.
5. `record_frame_choice` stores the chosen action.
6. The assistant can route to the next MCP tool based on choice.
7. Full message bodies are not read until Jared approves or explicitly asks.
8. Ignored/deferred messages update notification state correctly.
9. Replies and calendar actions require separate approval before mutation.
10. The design works even if the client only supports Allow/Deny approval buttons.

---

## 13. Future custom iframe path

This module should later power true custom UI inside an AFO mobile workcell client or compatible ChatGPT/Claude app surface.

Future renderer contract:

```json
{
  "frame_id": "frame_...",
  "type": "notification_triage",
  "title": "New high-priority message from Claude",
  "body": "Claude says deploy completed and needs verification.",
  "buttons": [
    { "id": "open", "label": "Open message" },
    { "id": "preview", "label": "Preview" },
    { "id": "ignore", "label": "Ignore" },
    { "id": "reply", "label": "Reply" },
    { "id": "calendar", "label": "Add follow-up" }
  ]
}
```

The same MCP tools can support both:

```txt
native approval-frame approximation today
custom iframe/button renderer tomorrow
```

---

## 14. Platform doctrine

AFO Toolsmith should treat UI-frame tools as part of the belt/workcell pattern.

```txt
Tool calls are not only backend actions.
They can also be structured decision gates.
```

For mobile-first agentic development, this matters because Jared needs low-friction approve/ignore/open/reply workflows from a phone.
