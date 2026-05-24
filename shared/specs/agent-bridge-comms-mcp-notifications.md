# Agent Bridge Comms MCP — Notifications Addendum

**status:** proposed addendum
**parent spec:** `shared/specs/agent-bridge-comms-mcp.md`
**target worker:** `agent-bridge-comms-mcp`
**purpose:** Add lightweight notification awareness to the Agent Bridge Comms MCP so ChatGPT, Claude, Alice/ALLIS, and Jared can detect new bridge messages without fully reading inboxes every turn.

---

## 1. Product decision

Notifications should be folded into **Agent Bridge Comms MCP**, not built as a separate MCP.

Reason:

```txt
Inbox notification is part of the Comms Spine.
```

The Comms Spine should support:

- booting from version-controlled instructions
- reading inboxes/outboxes
- sending messages
- reading bulletins/decisions/specs
- writing handoffs
- detecting new messages cheaply
- asking Jared whether to open or act on new messages

This means every serious workcell can remain aware of bridge activity while using task-specific tools.

---

## 2. User behavior target

Desired behavior inside a ChatGPT conversation:

```txt
Jared is chatting with ChatGPT.
Claude or Alice sends a new message through agent-bridge.
On ChatGPT's next response, ChatGPT quickly checks the notification state.
ChatGPT says:
"Claude appears to have sent a new high-priority message. Want me to open it?"
```

This is not true autonomous background awareness. ChatGPT still needs to be active and call a tool during a response. But this gives the practical behavior Jared wants:

```txt
every response → quick notification check → alert if new bridge activity
```

---

## 3. Two-phase build plan

### Option A / v0.2: polling-based notifications

This is the first build.

Flow:

```txt
ChatGPT response starts or ends
→ call check_notifications
→ MCP checks GitHub file SHAs / message IDs
→ compares against last-seen state
→ returns new/unseen items
→ ChatGPT alerts Jared if relevant
```

Pros:

- Simple.
- Works with GitHub as source of truth.
- No webhook setup required.
- Fits current MCP/tool-call behavior.
- Best MVP.

Limitations:

- Only checks when the assistant is already responding.
- Not true push notification.
- Requires project instructions to tell ChatGPT to call `check_notifications` every turn.

### Option B / v0.3: GitHub webhook notification state

This is the second build.

Flow:

```txt
GitHub push event on agent-bridge
→ Cloudflare Worker webhook endpoint
→ Worker parses changed files
→ Worker stores notification records in D1/KV
→ ChatGPT calls check_notifications
→ response is instant and precomputed
```

Pros:

- More efficient than checking GitHub contents every turn.
- Can precompute latest sender, subject, priority, and message ID.
- Future-compatible with phone push notifications or dashboards.

Limitations:

- Requires GitHub webhook setup.
- Requires webhook secret validation.
- Still cannot force ChatGPT to speak unless a ChatGPT interaction is happening.

---

## 4. New bindings

For polling-only v0.2:

| Binding | Type | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | secret | Read repo contents and metadata |
| `DB` or `KV` | D1 or KV | Store last-seen state per agent/user |
| `GITHUB_OWNER` | var | default `nothinginfinity` |
| `GITHUB_REPO` | var | default `agent-bridge` |
| `GITHUB_BRANCH` | var | default `main` |

For webhook v0.3:

| Binding | Type | Purpose |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` | secret | Validate GitHub webhook signatures |
| `DB` or `KV` | D1 or KV | Store notification queue/state |

D1 is preferred if we want notification history. KV is enough for a small last-seen flag.

---

## 5. Watched files

Default watched files for ChatGPT:

```txt
chatgpt/inbox.md
claude/outbox.md
alice/outbox.md
shared/bulletin.md
shared/decisions.md
```

Default watched files for Claude:

```txt
claude/inbox.md
chatgpt/outbox.md
alice/outbox.md
shared/bulletin.md
shared/decisions.md
```

Default watched files for Alice:

```txt
alice/inbox.md
chatgpt/outbox.md
claude/outbox.md
shared/bulletin.md
shared/decisions.md
```

The tool should allow overrides, but default to the agent's normal boot files.

---

## 6. D1 schema option

```sql
CREATE TABLE IF NOT EXISTS bridge_notification_state (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  file_path TEXT NOT NULL,
  last_seen_sha TEXT,
  last_seen_message_id TEXT,
  last_checked_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bridge_notifications (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  source_file TEXT NOT NULL,
  sender TEXT,
  message_id TEXT,
  subject TEXT,
  priority TEXT,
  project TEXT,
  message_type TEXT,
  commit_sha TEXT,
  detected_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_bridge_notifications_agent_status ON bridge_notifications(agent, status);
CREATE INDEX IF NOT EXISTS idx_bridge_notifications_detected_at ON bridge_notifications(detected_at);
```

KV alternative:

```txt
notif:state:chatgpt:chatgpt/inbox.md → { last_seen_sha, last_seen_message_id, last_checked_at }
notif:queue:chatgpt → JSON array of compact notifications
```

---

## 7. New MCP tools

### 7.1 `check_notifications`

Lightweight check for unseen bridge activity.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "include_bulletin": { "type": "boolean", "default": true },
    "include_decisions": { "type": "boolean", "default": true },
    "include_outboxes": { "type": "boolean", "default": true },
    "mark_seen": { "type": "boolean", "default": false },
    "priority_min": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "low" }
  },
  "required": ["agent"]
}
```

Output:

```json
{
  "has_new": true,
  "agent": "chatgpt",
  "new_count": 2,
  "high_priority_count": 1,
  "items": [
    {
      "source_file": "chatgpt/inbox.md",
      "sender": "claude",
      "message_id": "MSG-C-G-002",
      "subject": "cloudflare deploy complete",
      "priority": "high",
      "project": "agent-bridge",
      "recommendation": "Ask Jared whether to read the full message."
    }
  ]
}
```

Behavior:

1. Determine watched files for agent.
2. Fetch file metadata or content from GitHub.
3. Compare SHA and latest message IDs to stored last-seen state.
4. If changed, parse message headers only.
5. Return compact notifications.
6. If `mark_seen=true`, update state.

Do not return full message bodies from `check_notifications` unless a future `include_body` flag is explicitly added. This tool is meant to be cheap and low-noise.

---

### 7.2 `get_notification_summary`

Return the current notification queue for an agent without rechecking GitHub.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "status": { "type": "string", "enum": ["unread", "seen", "dismissed", "all"], "default": "unread" },
    "limit": { "type": "number", "default": 10 }
  },
  "required": ["agent"]
}
```

---

### 7.3 `mark_notifications_seen`

Mark notification state as seen after Jared approves or after the agent reads the relevant inbox.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "notification_ids": { "type": "array", "items": { "type": "string" } },
    "source_files": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["agent"]
}
```

---

### 7.4 `read_new_messages`

After Jared approves, read the full message bodies for new notifications.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "agent": { "type": "string", "enum": ["chatgpt", "claude", "alice"] },
    "notification_ids": { "type": "array", "items": { "type": "string" } },
    "limit_chars": { "type": "number", "default": 20000 }
  },
  "required": ["agent"]
}
```

Output should include source file, message ID, header metadata, and body snippets.

---

## 8. Webhook endpoint for Option B

Add a non-MCP endpoint:

```txt
POST /webhooks/github
```

Behavior:

1. Validate `X-Hub-Signature-256` using `GITHUB_WEBHOOK_SECRET`.
2. Parse push event payload.
3. If changed files include watched bridge files, fetch changed file content.
4. Parse latest message blocks.
5. Write compact notification records to D1/KV.
6. Return `{ ok: true, notifications_created: n }`.

Security rules:

- Reject unsigned requests.
- Reject invalid signatures.
- Do not expose full file contents in webhook response.
- Store only compact notification metadata unless full content is needed later.

---

## 9. Header parser

Notification checks should parse only message headers and a small preview.

Supported message formats:

```md
## [MSG-C-G-002] subject-slug
from: claude
to: chatgpt
project: project-slug
type: status
date: 2026-05-24T00:00:00Z
status: unread
priority: high
requires: cloudflare
```

Also support older bold-header style:

```md
## [OUT-G-001] re-chatgpt-now-connected
**from:** claude
**to:** chatgpt
**date:** 2026-05-24T00:40:00Z
**status:** delivered
```

The parser should return:

```json
{
  "message_id": "MSG-C-G-002",
  "subject": "subject-slug",
  "from": "claude",
  "to": "chatgpt",
  "project": "project-slug",
  "type": "status",
  "date": "2026-05-24T00:00:00Z",
  "status": "unread",
  "priority": "high",
  "requires": "cloudflare"
}
```

---

## 10. ChatGPT Project Instruction

Recommended instruction once v0.2 is live:

```txt
At the beginning or end of every substantive response, call Agent Bridge Comms MCP `check_notifications` for agent=`chatgpt`.

If new high-priority or urgent bridge messages exist, briefly tell Jared who sent it and ask whether to read the full message.

Do not read full inbox bodies automatically unless Jared has already instructed you to do so for this session.
```

Expected assistant behavior:

```txt
Also, I see a new high-priority Claude message in the bridge. Want me to open it?
```

---

## 11. Acceptance criteria for v0.2 polling

1. `check_notifications` checks ChatGPT watched files.
2. It compares current file SHA or latest message ID against last-seen state.
3. It returns compact message metadata, not full bodies.
4. It can identify sender, message ID, subject, project, and priority when present.
5. It can mark state seen when requested.
6. It does not modify inbox files.
7. It does not expose secrets.
8. It handles files with no new messages gracefully.

---

## 12. Acceptance criteria for v0.3 webhook

1. GitHub webhook endpoint validates signatures.
2. GitHub push events create notification records when watched files change.
3. Duplicate webhook deliveries do not create duplicate active notifications.
4. `get_notification_summary` returns webhook-created notifications.
5. `mark_notifications_seen` marks records seen.
6. Webhook endpoint never returns full file content or secrets.

---

## 13. Open decisions

1. Use D1 or KV for notification state first?
2. Should `check_notifications` default to `mark_seen=false`? Recommended: yes.
3. Should high-priority notifications be surfaced automatically, while low/normal are batched?
4. Should decisions and bulletins always trigger notifications?
5. Should this notification system later send iPhone push notifications through a separate app/shortcut?

Recommended defaults:

```txt
v0.2: polling + D1 state + compact metadata only
v0.3: GitHub webhook + D1 notification queue
mark_seen=false by default
ask Jared before reading full message bodies
```

---

## 14. Platform doctrine update

Add to Comms Spine definition:

```txt
A serious Comms Spine should not only read and write messages.
It should also cheaply detect when new coordination state exists.
```

This gives every workcell a low-noise coordination radar without requiring full inbox reads every turn.
