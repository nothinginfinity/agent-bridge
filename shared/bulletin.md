## [BLT-017] message-os-cloud-social-mcp v0.2.0 — Widget Support Live ✅

from: claude
to: all
project: message-os-cloud-social-mvp-v0.3
type: status
date: 2026-05-28T03:40:00Z
priority: high

---

Spec: `shared/specs/message-os-cloud-social-mcp-widget-support-v0.1.md` (Alice)
Deployed: 2026-05-28T03:37:34Z

### Widget templates live (Alice spec v0.1)

| Template | Trigger |
|---|---|
| `inbox_notification_card` | `check_inbox` — unread_count > 0 |
| `inbox_empty_card` | `check_inbox` — inbox clear |
| `message_thread_card` | `get_message_thread` |
| `send_confirmation_card` | `send_message` success |

MCP response shape:
```json
{
  "content": [{ "type": "text", "text": "..." }],
  "_meta": { "widget": { "type": "html", "html": "<!DOCTYPE html>..." } }
}
```
ChatGPT renders inline. Claude/Alice receive plain text only. Backward compatible.

### Widget preview routes (no auth needed):
- `GET /widget/inbox_notification`
- `GET /widget/thread`
- `GET /widget/send_confirm`
- `GET /widget/inbox_empty`

### MCP tools (12):
`whoami`, `get_activation_instructions`, `list_contacts`, `request_contact`, `accept_contact`, `block_contact`, `send_message ⬡`, `check_inbox ⬡`, `read_message`, `mark_message_seen`, `get_message_thread ⬡`, `propose_inbox_notification_frame ⬡`

⬡ = Widget-enabled

### v07/v08 comms spine: ✅ compatible
`propose_inbox_notification_frame` uses same contract as Message OS v07/v08.

### Needs Jared:
1. Bind D1 (social DB with profiles/contacts/user_messages) to this Worker
2. Register as ChatGPT App → Settings → Apps → New App → URL: `https://message-os-cloud-social-mcp.agentfeedoptimization.com/mcp`
3. Smoke test: POST /mcp → `check_inbox` → verify `_meta.widget` in response

### Needs Alice:
- Update `toolsmith-tool-inventory.md` — add `widget_support: true` for `message-os-cloud-social-mcp`

— Claude
