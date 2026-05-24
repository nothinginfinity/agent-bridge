# ChatGPT Human Messaging Hub

**status:** proposed platform extension
**owner:** Jared Edwards / AFO Toolsmith
**related specs:**
- `shared/specs/agent-bridge-comms-mcp.md`
- `shared/specs/agent-bridge-comms-mcp-notifications.md`
- `shared/specs/agent-bridge-comms-mcp-ui-frames.md`
- `shared/specs/in-chat-notification-spine.md`

**purpose:** Extend the GitHub-backed Agent Bridge / Inbox Hub pattern from agent-to-agent coordination into opt-in human-to-human messaging mediated by ChatGPT, Claude, or other LLM clients.

---

## 1. Product insight

If a GitHub repo can act as an inbox/outbox hub for agent messages, then it can also act as an inbox/outbox hub for human messages.

The key pattern:

```txt
Person A talks to their ChatGPT
→ ChatGPT writes a message into Person B's inbox hub
→ Person B's ChatGPT detects the new inbox item
→ Person B receives an in-chat notification frame
→ Person B opens, previews, replies, ignores, saves, routes, or schedules follow-up
```

This creates a new form of messaging:

```txt
LLM-mediated human-to-human messaging inside ChatGPT-style clients
```

It is not SMS, email, or DM.
It is a user-controlled inbox hub where messages become structured, searchable, routable, and agent-operable.

---

## 2. Core thesis

```txt
ChatGPT can become a user-controlled communication interface when messages are stored in a user-owned inbox hub and surfaced through scoped notification frames.
```

This means Jared can build a communication layer where:

- users control their own inbox storage
- LLMs help write, summarize, translate, route, and reply
- messages are searchable and can become memory
- notifications are contextual and belt-scoped
- the user decides which inboxes/tools are active in a session

---

## 3. Why this is different from SMS/email

Traditional messaging:

```txt
sender app → recipient app → notification → user reads raw message
```

LLM-mediated inbox hub:

```txt
sender's LLM → sender outbox hub → recipient inbox hub → recipient's LLM → notification frame → action belt
```

Advantages:

1. Messages are structured from birth.
2. Messages can carry intent, priority, project, actions, and context.
3. LLMs can summarize and route messages before exposing full content.
4. Recipient can reply through their own assistant.
5. Messages can connect directly to GitHub, calendar, tasks, memory, specs, files, or web links.
6. Users can own the repo/database rather than relying only on third-party messaging apps.

---

## 4. MVP architecture

```txt
User A ChatGPT Project
→ send_human_message tool
→ shared GitHub inbox repo or federated inbox endpoint
→ User B Agent Bridge Comms MCP
→ check_notifications
→ propose_notification_frame
→ User B chooses preview/open/reply/ignore/later/calendar/task
→ reply_human_message tool
```

Possible storage backends:

```txt
GitHub repo inbox files
D1 inbox tables
hybrid GitHub audit log + D1 fast index
```

Recommended MVP:

```txt
GitHub repo for auditability + D1 notification index for speed
```

---

## 5. Inbox topology options

### Option A: single shared hub repo

```txt
nothinginfinity/human-message-hub
  users/jared/inbox.md
  users/jared/outbox.md
  users/alice-human/inbox.md
  users/alice-human/outbox.md
```

Pros:

- Simple.
- GitHub file model mirrors Agent Bridge.
- Easy to inspect and version.

Cons:

- Shared repo permissions are difficult for private human messaging.
- Not ideal for many users.

### Option B: per-user inbox repo

```txt
jared/inbox-hub
other-user/inbox-hub
```

Pros:

- User-owned.
- Better privacy boundary.
- Works as a personal communication vault.

Cons:

- Cross-repo routing and permissions are harder.

### Option C: Cloudflare D1/R2 inbox service

```txt
message-hub.agentfeedoptimization.com
```

Pros:

- Better for productized messaging.
- Cleaner auth, routing, notification state, indexing.
- Easier mobile/client rendering.

Cons:

- Less GitHub-native/auditable unless mirrored.

Recommended path:

```txt
Start GitHub-native for Jared/agent-team proof of concept.
Move to D1 service for multi-user productization.
```

---

## 6. Message schema

Human message object:

```json
{
  "id": "hm_...",
  "from_user": "jared",
  "to_user": "recipient_handle",
  "from_agent": "chatgpt",
  "to_agent": "chatgpt",
  "subject": "Project question",
  "body": "Message text here.",
  "summary": "Short summary.",
  "priority": "normal",
  "project": "tool-notes",
  "tags": ["work", "mcp"],
  "requires_response": true,
  "actions": ["reply", "calendar", "task", "github", "save"],
  "created_at": "2026-05-24T00:00:00Z",
  "status": "unread",
  "visibility": "private",
  "metadata": {}
}
```

Markdown inbox format:

```md
## [HM-001] project-question
from_user: jared
from_agent: chatgpt
to_user: recipient_handle
to_agent: chatgpt
project: tool-notes
type: human_message
date: 2026-05-24T00:00:00Z
status: unread
priority: normal
requires_response: true

Message body here.

---
```

---

## 7. MCP tools

### 7.1 `send_human_message`

Send a structured human-to-human message into the target user's inbox hub.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "from_user": { "type": "string" },
    "to_user": { "type": "string" },
    "subject": { "type": "string" },
    "body": { "type": "string" },
    "summary": { "type": "string" },
    "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "normal" },
    "project": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "requires_response": { "type": "boolean", "default": false }
  },
  "required": ["from_user", "to_user", "subject", "body"]
}
```

### 7.2 `check_human_inbox`

Check for new human messages relevant to the current user/workcell.

### 7.3 `propose_human_message_frame`

Render a human message as an in-chat notification/decision frame.

Default actions:

```txt
preview
open
reply
save_for_later
ignore
calendar
task
github
memory
```

### 7.4 `read_human_message`

Read the full selected message after user approval.

### 7.5 `reply_human_message`

Reply to a human message through the recipient's inbox hub.

### 7.6 `mark_human_message_seen`

Mark read/seen/handled/deferred.

### 7.7 `block_sender`

Block a sender or source.

### 7.8 `approve_sender`

Approve a sender/contact for future messages.

### 7.9 `list_contacts`

List approved contacts and inbox routes.

---

## 8. In-chat notification behavior

When a message arrives:

```txt
check_human_inbox
→ new message detected
→ propose_human_message_frame
→ native MCP approval frame appears
→ Jared chooses preview/open/reply/later/ignore/etc.
```

Example frame:

```json
{
  "frame_type": "human_message_notification",
  "title": "New message from Sam",
  "summary": "Sam asks if you want to meet tomorrow about the project.",
  "priority": "normal",
  "source": "human_message_hub",
  "actions": [
    { "id": "preview", "label": "Preview" },
    { "id": "open", "label": "Open full message" },
    { "id": "reply", "label": "Reply" },
    { "id": "calendar", "label": "Add to calendar" },
    { "id": "later", "label": "Save for later" },
    { "id": "ignore", "label": "Ignore" }
  ]
}
```

---

## 9. Contact and permission model

Human-to-human messaging requires stronger permission rules than agent bridge messages.

Rules:

1. Unknown senders should not bypass approval.
2. First message from a new sender should show a contact approval frame.
3. Users can approve, block, mute, or restrict senders.
4. Messages should support work/personal/project scopes.
5. Personal messages should not appear in work belts unless explicitly allowed.
6. Work messages should not appear in personal belts unless explicitly allowed.
7. User-controlled inbox ownership is central.
8. Sender identity should be signed or authenticated before productization.

---

## 10. Trust and identity

MVP identity can be manual:

```txt
approved_contacts.json
```

Product identity should use one or more:

```txt
GitHub identity
OAuth identity
AFO account identity
signed inbox route tokens
public key signatures
```

Potential contact record:

```json
{
  "handle": "sam",
  "display_name": "Sam",
  "approved": true,
  "allowed_scopes": ["personal", "project:tool-notes"],
  "inbox_route": "https://.../users/sam/inbox",
  "identity_provider": "github",
  "identity_id": "github:sam-user",
  "muted": false,
  "blocked": false
}
```

---

## 11. Spam and abuse controls

Messaging requires anti-spam even in a prototype.

Minimum controls:

1. Approved contacts only by default.
2. Unknown senders go to requests, not main inbox.
3. Rate limits per sender.
4. Block/mute sender tools.
5. Message size limits.
6. Attachment restrictions.
7. Audit logs.
8. No auto-open for unknown contacts.
9. No auto-action on human messages without explicit approval.

---

## 12. Workcell/belt scoping

A user may have different messaging policies by belt.

Work belt:

```json
{
  "human_messages": true,
  "allowed_scopes": ["work", "project"],
  "personal_messages": false,
  "unknown_senders": "requests_only"
}
```

Personal belt:

```json
{
  "human_messages": true,
  "allowed_scopes": ["personal", "family", "delivery"],
  "work_messages": "high_priority_only",
  "unknown_senders": "requests_only"
}
```

Focus belt:

```json
{
  "human_messages": false,
  "exceptions": ["urgent", "approved_emergency_contacts"]
}
```

---

## 13. Relationship to email/SMS

This system does not need to replace email/SMS immediately.

It can start as:

```txt
LLM-native side channel for people who opt in.
```

Then bridge with email/SMS later:

```txt
email → notification spine → ChatGPT frame → reply via email
sms → notification spine → ChatGPT frame → reply via SMS
human hub → native LLM-to-LLM message
```

Long-term thesis:

```txt
If the conversation is mediated by LLMs anyway, the message should be structured, routable, memory-aware, and tool-aware from birth.
```

---

## 14. MVP build path

### Phase 1: private Jared prototype

- Add `human/inbox.md` and `human/outbox.md` to a hub repo or existing bridge.
- Add `send_human_message` and `check_human_inbox` tools.
- Use manually approved contacts only.
- Use notification frames for preview/open/reply.

### Phase 2: cross-user GitHub prototype

- Each participant has a GitHub-backed inbox route.
- ChatGPT writes to target inbox with a repo-scoped token or approved endpoint.
- Recipient ChatGPT checks inbox notifications.

### Phase 3: Cloudflare message hub

- D1 stores messages, contacts, routes, and notification state.
- GitHub is optional audit/export layer.
- OAuth/token identity.

### Phase 4: app-style UI

- Real buttons in AFO mobile workcell client.
- ChatGPT/Claude app surfaces where available.
- Notification frame contract reused.

---

## 15. Open decisions

1. Should human messaging live in `agent-bridge`, a new `human-message-hub` repo, or D1 first?
2. Should initial contacts be GitHub identities only?
3. Should messages be encrypted at rest before productization?
4. How should attachments work?
5. Should users be able to expose specific inboxes to specific ChatGPT Projects?
6. Should this become part of AFO Toolsmith as a generated MCP template?

Recommended defaults:

```txt
MVP: GitHub-native, approved contacts only, no attachments, no encryption claims, notification frames required before open/reply.
Product: Cloudflare D1 hub with identity, permissions, audit/export, and optional GitHub mirror.
```

---

## 16. Platform doctrine

```txt
Agent Bridge proves repo-backed agent messaging.
Notification Spine makes messages visible in chat.
UI Frames make messages actionable.
Human Message Hub extends the same pattern to people.
```

The result:

```txt
LLM-native communication controlled by the user.
```

This is not just another inbox. It is a user-owned communication substrate where every message can become context, memory, task, calendar event, GitHub issue, spec, or decision.
