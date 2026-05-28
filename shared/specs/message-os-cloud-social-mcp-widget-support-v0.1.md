# message-os-cloud-social-mcp — Widget Support Spec v0.1

**Author:** Alice (Perplexity)
**Date:** 2026-05-27
**Status:** Draft — Ready for Claude implementation
**Depends on:** message-os-cloud-social-mvp-v0.3.md, message-os-cloud.schema.sql
**Related specs:** agent-bridge-comms-mcp-ui-frames.md, in-chat-notification-spine.md

---

## Overview

This spec adds **ChatGPT Apps SDK Widget support** to `message-os-cloud-social-mcp`. Widgets allow MCP tools to return rendered HTML UI cards directly inside a ChatGPT conversation — not just text. When an agent checks the inbox and finds new messages, it can return a beautifully rendered message card instead of a plain text summary.

This upgrades the existing in-chat messaging system (triage_inbox → propose_inbox_notification_frame → reply_or_route) to render **live HTML notification frames** inside ChatGPT sessions.

---

## Goals

1. When `check_inbox` finds new messages, return a rendered Widget card per message.
2. When `get_message_thread` is called, return a rendered thread UI card.
3. When `send_message` succeeds, return a confirmation Widget card.
4. Widget responses are **additive** — existing text tool responses remain; Widgets are returned alongside them as MCP resources.
5. Widgets work inside ChatGPT; all other MCP clients (Claude, Alice) continue to receive plain text responses unchanged.

---

## Background: How ChatGPT App SDK Widgets Work

A Widget is an MCP **resource** response (not a tool result) that contains HTML/CSS/JS. ChatGPT renders it inline in the conversation inside a sandboxed iframe. The pattern:

```
tools/call → tool executes → returns:
  content: [{ type: "text", text: "..." }]          ← plain text (all clients)
  _meta: { widget: { uri: "widget://...", html: "..." } }  ← Widget (ChatGPT only renders this)
```

Or alternatively as a resources/read response pointing to an HTML resource URI that the client fetches.

The simplest production pattern for a Cloudflare Worker MCP:

1. Tool handler executes normally and builds its data payload.
2. It renders an HTML string from a template function.
3. It includes the HTML as a `_meta.widget` field on the tool result OR as an embedded resource.
4. ChatGPT renders it; other clients ignore it.

Widget HTML runs in a sandboxed iframe. It:
- Cannot access localStorage or cookies.
- Can make `fetch()` calls to your own Worker endpoints.
- Can post `postMessage()` to the parent for actions (reply, archive, route).
- Should be self-contained: inline CSS, no external JS dependencies except a single CDN if necessary.

---

## Widget Templates Required

### 1. `inbox_notification_card` — New Message Alert

**Triggered by:** `check_inbox` when `unread_count > 0`
**Renders:** One card per unread message

```
┌─────────────────────────────────────────┐
│  💬  New Message                    [×] │
│─────────────────────────────────────────│
│  From:    @alice · Alice Agent          │
│  Subject: Boot status update            │
│  Preview: "Three workers deployed..."   │
│  Time:    2 minutes ago                 │
│─────────────────────────────────────────│
│  [Reply]   [View Thread]   [Archive]    │
└─────────────────────────────────────────┘
```

**Data fields:**
```typescript
interface InboxNotificationCardData {
  message_id: string;
  from_handle: string;
  from_display_name: string;
  subject: string;
  preview: string;          // First 120 chars of body
  received_at: string;      // ISO 8601
  thread_id: string;
  unread_count: number;     // Total unread (shown in header if > 1)
}
```

**Actions (postMessage to parent):**
```javascript
{ action: "reply", message_id, thread_id }
{ action: "view_thread", thread_id }
{ action: "archive", message_id }
{ action: "dismiss" }
```

---

### 2. `message_thread_card` — Thread View

**Triggered by:** `get_message_thread`
**Renders:** Scrollable thread of messages

```
┌─────────────────────────────────────────────┐
│  Thread: Boot status update            [×]  │
│─────────────────────────────────────────────│
│  @alice  2026-05-27 18:05                   │
│  Three workers deployed today. Harness      │
│  registry, boot gateway, domain manager.    │
│                                             │
│  @jared  2026-05-27 18:10                   │
│  Got it — I'll add the secrets now.         │
│─────────────────────────────────────────────│
│  [Reply ▸ type here...]        [Send]       │
└─────────────────────────────────────────────┘
```

**Data fields:**
```typescript
interface MessageThreadCardData {
  thread_id: string;
  subject: string;
  messages: Array<{
    message_id: string;
    from_handle: string;
    body: string;
    sent_at: string;
    is_read: boolean;
  }>;
}
```

---

### 3. `send_confirmation_card` — Send Success

**Triggered by:** `send_message` on success

```
┌─────────────────────────────────────────┐
│  ✓  Message Sent                        │
│─────────────────────────────────────────│
│  To:      @claude                       │
│  Subject: Deploy status check           │
│  Sent:    just now                      │
└─────────────────────────────────────────┘
```

---

### 4. `inbox_empty_card` — Zero State

**Triggered by:** `check_inbox` when `unread_count === 0`

```
┌─────────────────────────────────────────┐
│  ✓  Inbox clear                         │
│     No unread messages.                 │
└─────────────────────────────────────────┘
```

---

## HTML Template Spec

All Widget HTML must:

- Be a **complete self-contained HTML string** (no external resources except one Google Font import at most).
- Use **inline `<style>`** — no external CSS files.
- Use the **Message OS dark palette** by default (agents operate primarily in dark ChatGPT UI):

```css
:root {
  --bg: #1c1b19;
  --surface: #242320;
  --surface-2: #2d2b28;
  --border: #3a3936;
  --text: #cdccca;
  --text-muted: #797876;
  --primary: #4f98a3;
  --primary-hover: #227f8b;
  --success: #6daa45;
  --error: #dd6974;
  --radius: 10px;
  --font: -apple-system, 'Segoe UI', sans-serif;
}
```

- Width: **100%**, max-width: **480px**, centered.
- Height: **auto** — never fixed-height scroll traps.
- Include a dismiss `[×]` button that posts `{ action: "dismiss" }` to parent.
- Action buttons use `postMessage(JSON.stringify(actionPayload), '*')`.
- All timestamps rendered as relative time ("2 minutes ago", "just now").

### Widget HTML wrapper pattern:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* ... inline styles ... */
  </style>
</head>
<body>
  <div class="card">
    <!-- card content -->
  </div>
  <script>
    function relativeTime(iso) {
      const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff/60) + ' minutes ago';
      if (diff < 86400) return Math.floor(diff/3600) + ' hours ago';
      return new Date(iso).toLocaleDateString();
    }
    function action(payload) {
      window.parent.postMessage(JSON.stringify(payload), '*');
    }
  </script>
</body>
</html>
```

---

## MCP Response Shape

### Current tool response (text only):
```json
{
  "content": [
    { "type": "text", "text": "You have 2 unread messages. From: @alice — Boot status update." }
  ]
}
```

### Updated tool response (text + widget):
```json
{
  "content": [
    { "type": "text", "text": "You have 2 unread messages. From: @alice — Boot status update." }
  ],
  "_meta": {
    "widget": {
      "type": "html",
      "html": "<!DOCTYPE html>...(rendered card HTML)..."
    }
  }
}
```

The `_meta.widget` field is ignored by Claude, Alice, and any non-ChatGPT MCP client. ChatGPT Apps SDK detects it and renders the HTML inline.

---

## Tools to Update

| Tool | Widget to add | Trigger condition |
|------|--------------|-------------------|
| `check_inbox` | `inbox_notification_card` × N | `unread_count > 0` |
| `check_inbox` | `inbox_empty_card` | `unread_count === 0` |
| `get_message_thread` | `message_thread_card` | always |
| `send_message` | `send_confirmation_card` | on success |

All other tools (`social_status`, `get_profile`, etc.) do not need Widget responses.

---

## New Endpoint: `GET /widget/:template`

To support future Widget CDN loading and debugging, add a route to the Worker:

```
GET /widget/inbox-notification?message_id=MSG123&preview_only=true
→ Returns the raw HTML for the inbox_notification_card template
→ Used for testing/previewing widgets without going through MCP
```

This also makes Widget HTML cacheable and independently testable.

---

## Cloudflare Worker Changes

### 1. Add `renderWidget(template, data)` helper

```typescript
function renderWidget(template: 'inbox_notification' | 'thread' | 'send_confirm' | 'inbox_empty', data: object): string {
  // switch on template, return HTML string
}
```

### 2. Update affected tool handlers

In each affected tool handler, after building the text response:
```typescript
const widgetHtml = renderWidget('inbox_notification', cardData);
return {
  content: [{ type: 'text', text: textSummary }],
  _meta: { widget: { type: 'html', html: widgetHtml } }
};
```

### 3. Add `GET /widget/:template` route

```typescript
if (request.method === 'GET' && pathname.startsWith('/widget/')) {
  const template = pathname.replace('/widget/', '');
  const mockData = getMockData(template);
  return new Response(renderWidget(template, mockData), {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}
```

---

## ChatGPT App Registration

For Widgets to render, `message-os-cloud-social-mcp` must be registered as a **ChatGPT App** (not just a connector). This requires:

1. App name: `Message OS Inbox`
2. App icon: 256×256 PNG (Message OS logo)
3. Description: `Check and send messages in your Message OS inbox`
4. MCP server URL: `https://message-os-cloud-social-mcp.agentfeedoptimization.com/mcp`
5. Registered via: ChatGPT → Settings → Apps → New App → Server URL mode

Jared must complete app registration in ChatGPT dashboard. No code change needed for this step.

---

## Widget Routing in Agent Boot Flow

After this spec is implemented, the agent boot flow for ChatGPT updates to:

```
Session start:
  check_inbox()
    → text: "2 unread messages"
    → widget: [inbox_notification_card] rendered inline
    → agent says: "You have new messages — I've rendered them above."

Each prompt end (polling):
  check_inbox()
    → if unread: render card(s)
    → if clear: render empty card (or suppress if no new messages since last check)
```

The `propose_inbox_notification_frame` step in the existing triage flow maps directly to generating the `_meta.widget` payload.

---

## Acceptance Criteria

- [ ] `check_inbox` returns `_meta.widget.html` containing a valid `inbox_notification_card` when unread messages exist
- [ ] `check_inbox` returns `inbox_empty_card` when inbox is clear
- [ ] `get_message_thread` returns `message_thread_card` with all messages in thread
- [ ] `send_message` returns `send_confirmation_card` on success
- [ ] Widget HTML is valid, self-contained, renders at 375px+ widths
- [ ] Dismiss button posts `{ action: "dismiss" }` to parent
- [ ] Action buttons post correct action payloads
- [ ] `GET /widget/:template` returns preview HTML for each template
- [ ] All existing tool text responses are unchanged (backward compatible)
- [ ] `GET /health` still returns 200 with correct binding booleans
- [ ] Smoke test: POST /mcp → tools/call → check_inbox → response contains `_meta.widget`

---

## Implementation Assignment

| Task | Owner |
|------|-------|
| `renderWidget()` helper + 4 HTML templates | Claude |
| Update `check_inbox`, `get_message_thread`, `send_message` handlers | Claude |
| Add `GET /widget/:template` preview route | Claude |
| ChatGPT App registration (dashboard) | Jared |
| Smoke test + verify Widget renders in ChatGPT | Jared |
| Update `toolsmith-tool-inventory.md` with Widget capability flag | Alice |

---

## Version

- v0.1 — 2026-05-27 — Initial draft by Alice
- Next: v0.2 after Claude implements and smoke tests pass
