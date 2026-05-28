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

---

## [MSG-C-S-20260528134544] afo-control-center-mcp v0.6.1 LIVE — queue dedupe + resolve-fixed + MCP tools
from: claude
to: shared
project: afo-control-center-mcp
type: bulletin
date: 2026-05-28T13:45:44Z
status: unread
priority: high
requires: review

## afo-control-center-mcp v0.6.1 — DEPLOYED ✅

Deployed: 2026-05-28T13:43:58Z
Source SHA: d0c64c11e89eca4c25a2a755587bba5edb7ab163
Worker size: 32KB

### What's new in v0.6.1

**Queue dedupe + resolution engine:**
- `normalizeTargetId(row)` — handles worker- prefix stripping, alias mapping (agent-action-root, control-center-root, toolsmith-ui), and fallback to target_id
- `upsertQueueIssue(db, issue)` — deterministic ID `${item_type}-${target_id}-${issue}`, INSERT ON CONFLICT using UNIQUE INDEX on (target_id, issue, status)
- `resolveMissingIssues(db, source, activeIssueKeys)` — after each audit run, marks rows `resolved` with `resolved_reason = audit_no_longer_detects_issue`

**Patched routes:**
- `GET /audit/workers` — builds activeIssueKeys, upserts each issue, resolves stale. Returns `{ok, issues_count, upserted_count, resolved_count, issues}`
- `GET /audit/tools` — same pattern, source = "audit/tools"
- `GET /registration/queue` — supports ?status=open|resolved|done|all, ?item_type, ?severity, ?target_id, ?limit. Default: status=open
- `POST /registration/queue/mark-done` — sets status=done, resolved_at, resolved_reason, updated_at
- `GET /registration/queue/resolve-fixed` — runs both audits, returns combined result

**Dashboard Needs Attention section:**
- Open queue count, resolved today, done count, duplicate count (always 0 with dedupe)
- Newest 10 open queue items table
- Action buttons: View Full Queue, Resolve Fixed, Audit Workers, Audit Tools

**New MCP tools:**
- audit_workers
- audit_tools
- get_registration_queue (with filters)
- mark_registration_item_done
- resolve_fixed_registration_items
- list_workers, get_control_links (existing, now exposed via MCP)

### Bindings deployed
- DB ✅ afo-control-center-db (401ec52e-2695-4770-a0d1-7f2ec7392669)
- ENVIRONMENT ✅ "production"
- CONTROL_CENTER_VERSION ✅ "0.6.1"
- CF_ACCOUNT_ID ⚠️ NOT in deploy payload — needs Jared to re-add via dashboard if wiped
- CF_API_TOKEN ⚠️ NOT in deploy payload — secret, needs Jared to re-add via dashboard if wiped

Note: CF_ACCOUNT_ID and CF_API_TOKEN are only required for /sync/workers. All audit, queue, and dashboard routes work without them.

### Test URLs
- https://control.agentfeedoptimization.com/health
- https://control.agentfeedoptimization.com/audit/workers
- https://control.agentfeedoptimization.com/audit/tools
- https://control.agentfeedoptimization.com/registration/queue
- https://control.agentfeedoptimization.com/registration/queue?status=resolved
- https://control.agentfeedoptimization.com/registration/queue/resolve-fixed

— Claude


