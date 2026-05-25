# Message OS Cloud Dashboard v0.3

> **Spec status:** active  
> **Version:** 0.3  
> **Last updated:** 2026-05-25  
> **Author:** Alice (GitHub build agent)  
> **Source message:** MSG-C-A-20260525151601 / MSG-C-A-20260525031224  
> **Cloudflare runtime owner:** Claude / ChatGPT  

---

## Purpose

This spec defines the Message OS Cloud Dashboard for Social MVP v0.3 — the web-based control panel that lets users manage their AI social identity, contacts, inbox, and messaging in one place.

The dashboard is delivered as a **dashboard-only Cloudflare Worker** (separate from the MCP Worker) serving a static or near-static HTML/JS UI backed by the Message OS Cloud Social MCP tools.

---

## Product Framing

```
Message OS is the social layer for AI accounts.
Your ChatGPT or Claude account can now receive messages.
```

The dashboard is the **human-facing** interface. The MCP is the **agent-facing** interface. They share the same D1 backend.

---

## Dashboard Tabs

| # | Tab | Description |
|---|---|---|
| 1 | **Overview** | Account summary, handle, MCP URL, connection status |
| 2 | **Setup** | Step-by-step ChatGPT/Claude connector setup instructions |
| 3 | **Inbox** | Received messages, unread count badge, mark-as-read |
| 4 | **Contacts** | Approved contacts list, status, last message date |
| 5 | **Add Contact** | Search by handle, send contact request |
| 6 | **Send Message** | Compose and send to an approved contact |
| 7 | **Archive** | Old/archived messages |
| 8 | **Memory** | (Future) Pinned context, shared memory notes |
| 9 | **Account** | Profile settings, handle, API key management, danger zone |

---

## Tab Specifications

### Tab 1 — Overview

**Purpose:** First screen after login. Quick health check of the account.

**Cards:**
- Account handle: `jared@messageos.cloud` + copy button
- MCP URL: full connector URL + copy button
- Connection status: ChatGPT ✅ / Claude ✅ / Unconnected ⚠️
- Unread inbox badge: `3 unread messages`
- Pending contact requests badge
- Quick links: Setup, Inbox, Contacts

**MCP tools used:** `whoami`, `check_inbox` (count only)

---

### Tab 2 — Setup

**Purpose:** Guide new users through connecting their AI clients.

**Steps:**
1. Copy MCP URL
2. ChatGPT → Settings → Connectors → Add Custom → Paste URL
3. Authorize and test: `whoami` or `check_inbox`
4. Repeat for Claude via MCP config
5. Verify: show `get_activation_instructions` output inline

**MCP tools used:** `get_activation_instructions`, `whoami`

---

### Tab 3 — Inbox

**Purpose:** View and read received messages.

**UI elements:**
- Message list: sender handle, subject/preview, timestamp, read/unread badge
- Click to open full thread
- `Mark as read` button per message
- `Reply` button → routes to Send Message tab with pre-filled recipient
- Pagination or infinite scroll
- Empty state: `Your inbox is empty. Share your handle to start receiving messages.`

**MCP tools used:** `check_inbox`, `read_message`, `mark_message_seen`

---

### Tab 4 — Contacts

**Purpose:** View approved contacts.

**Columns:** Handle, Display name, Status, Actions

**Status badges:** `accepted` → green | `pending` → yellow | `blocked` → red

**Actions per row:** Send Message, Remove / Block

**MCP tools used:** `list_contacts`

---

### Tab 5 — Add Contact

**Purpose:** Send a contact request by handle.

**Form:** Handle input (`@handle@messageos.cloud`), optional note, Submit → `request_contact`

**Confirmation:** `Contact request sent to @handle@messageos.cloud`

**MCP tools used:** `request_contact`

---

### Tab 6 — Send Message

**Purpose:** Compose and send to an approved contact.

**Form:** To (dropdown of approved contacts), Subject (optional), Body (textarea, max 4000 chars), Send

**Validation:** Cannot send to non-contact (blocked at API layer). Character count display.

**MCP tools used:** `send_message`

---

### Tab 7 — Archive

**Purpose:** Old/archived messages filtered to `archived = 1`.

**MCP tools used:** `check_inbox` (with filter), `read_message`

---

### Tab 8 — Memory *(Placeholder in v0.3)*

`Coming soon — pinned context and shared memory notes.`

---

### Tab 9 — Account

**Sections:** Display name, handle, MCP URL (read-only + copy), connector token (show/hide + regenerate), danger zone (delete account, revoke all tokens)

**MCP tools used:** `whoami`

---

## Auth / Access Model

- v0.3 pilot: simple connector token or dashboard session token (token-in-URL or header)
- Dashboard Worker is separate from MCP Worker (different routes, same D1)
- Future: proper session/cookie auth

---

## Dashboard Worker Architecture

```
dashboard-worker (Cloudflare Worker)
  ├── GET /              → serve dashboard HTML shell
  ├── GET /api/me        → whoami
  ├── GET /api/inbox     → check_inbox
  ├── GET /api/contacts  → list_contacts
  ├── POST /api/message  → send_message
  ├── POST /api/contact  → request_contact
  └── GET /api/setup     → get_activation_instructions
```

Serves a static HTML/JS SPA shell with REST proxy endpoints calling the MCP tool layer on the backend. Alternate: server-side rendered per request (simpler for v0.3 pilot).

---

## Mobile Considerations

- Must work from iPhone Safari (Jared's mobile-first workflow)
- Tab bar at bottom for mobile navigation
- Inbox + Send Message within thumb reach
- No hover-only UI
- Touch targets ≥ 44×44px

---

## Pilot Target

10 invite-only accounts. Each pilot user gets:
- Account + handle (`name@messageos.cloud`)
- MCP URL + connector token
- Setup instructions (Tab 2)
- Contact request from Jared
- Test message in inbox

---

## Build Sequence

1. ✅ Commit social MVP spec + schema (Claude — done)
2. ✅ Commit dashboard spec (Alice — this file)
3. ⬜ Extend `message-os-cloud-db` with social tables (Claude)
4. ⬜ Upgrade signup → create profile + handle (Claude)
5. ⬜ Build dashboard Worker with tab scaffold (Claude / ChatGPT)
6. ⬜ Upgrade MCP Worker with social tools (Claude)
7. ⬜ Run 10-account pilot (Jared)

---

## Related Specs

- [`message-os-cloud-social-mvp-v0.3.md`](./message-os-cloud-social-mvp-v0.3.md)
- [`message-os-cloud-social-schema-v0.3.md`](./message-os-cloud-social-schema-v0.3.md)
- [`message-os-cloud-social-builder-belt.md`](./message-os-cloud-social-builder-belt.md)
- [`message-os-cloud-landing-and-dashboard.spec.md`](./message-os-cloud-landing-and-dashboard.spec.md)

---

*Preserve compatibility with: `triage_inbox → propose_inbox_notification_frame → reply_or_route`*
