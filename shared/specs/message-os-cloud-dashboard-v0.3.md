# Message OS Cloud Dashboard v0.3 Spec

> Alice — drafted 2026-05-25
> Project: Message OS Cloud Social MVP v0.3
> Status: draft

---

## Overview

The Message OS Cloud Dashboard is the primary user interface for managing an AI-native social account. It gives users a single-page mobile-optimized view of their identity, contacts, inbox, and messaging tools.

This spec covers the v0.3 dashboard — the first version with full social layer support.

---

## Product Framing

```
Message OS is the social layer for AI accounts.
Your ChatGPT and Claude accounts can now receive messages.
```

---

## Dashboard URL Pattern

```
https://dashboard.messageos.cloud/{tenant_slug}
```

Or served by the dashboard-only Cloudflare Worker.

---

## Tab Structure

### 1. Overview
- Account handle display: `jared@messageos.cloud`
- Account status badge (active / pending setup)
- Quick stats: contact count, unread message count
- Setup completion checklist (% complete)
- Quick links to Setup, Inbox, Contacts

### 2. Setup
- MCP URL display (copyable)
- ChatGPT setup instructions
- Claude setup instructions
- Connector token display (masked, with reveal)
- Re-generate token button
- Setup status indicators

### 3. Inbox
- List of received messages ordered by date desc
- Each row: sender handle, subject/preview, timestamp, read/unread indicator
- Click to read full message
- Mark as read / archive actions
- Empty state: "No messages yet. Share your handle to get started."

### 4. Contacts
- List of approved contacts
- Each row: handle, display name, contact status badge
- Status values: `pending` | `accepted` | `blocked` | `removed`
- Remove / block actions
- Empty state: "No contacts yet."

### 5. Add Contact
- Search by handle (`@handle@messageos.cloud`)
- Send contact request form
- Pending outbound requests list
- Incoming contact requests list with Accept / Decline

### 6. Send Message
- To: field (handle search / autocomplete from contacts)
- Subject field
- Body (text, markdown-friendly)
- Send button
- Only approved contacts can receive messages (enforced server-side)
- Success / error state display

### 7. Archive
- Archived messages list
- Restore to Inbox action
- Permanent delete action

### 8. Memory
- Reserved for future Vectorize / Memory OS integration
- v0.3 placeholder: "Memory coming soon. Your messages will be searchable here."

### 9. Account
- Display name edit
- Handle display (read-only)
- Email
- Timezone
- Notification preferences (email on new message — Resend)
- Cal.com booking link field
- Delete account (danger zone)

---

## MCP Tools Surfaced in Dashboard

The dashboard calls (or displays results from) the following MCP tools:

| Tab | Tool |
|---|---|
| Overview | `whoami` |
| Setup | `get_activation_instructions` |
| Inbox | `check_inbox`, `read_message`, `mark_message_seen` |
| Contacts | `list_contacts`, `block_contact` |
| Add Contact | `request_contact`, `accept_contact` |
| Send Message | `send_message` |
| Archive | `mark_message_seen` |
| Account | `whoami` |

---

## Responsive / Mobile Requirements

- Mobile-first layout (Jared's primary device is iPhone)
- Bottom tab bar navigation on mobile
- Side nav on desktop
- Each tab loads independently (no full-page reload)
- Optimistic UI for send/accept/block actions

---

## Notification Integration

- On new message received: trigger Resend email via `resend-email-mcp → send_message_notification_email`
- On contact request received: trigger Resend email via `send_contact_invite_email`
- User can disable email notifications in Account tab

---

## Booking Integration

- Account tab includes Cal.com booking link
- Can be shared with contacts
- `calcom-booking-mcp → get_booking_link` surfaces the link

---

## Dashboard Builder MCP

The `message-os-cloud-dashboard-builder` MCP exposes the following tools to allow agents to render/update dashboard sections:

```
update_dashboard_tabs
render_setup_card
render_contacts_card
render_inbox_card
render_send_message_card
render_booking_card
```

---

## Compatibility

Preserves Message OS v08 flow:
```
triage_inbox → propose_inbox_notification_frame → reply_or_route
```

The dashboard Inbox tab is the human-facing layer of the same message store that MCP tools access.

---

## Build Sequence

1. Extend message-os-cloud-db with social tables (Claude / D1 migration)
2. Upgrade signup flow to create profile + handle (Claude)
3. Build dashboard HTML/Worker with tabs (Claude / Cloudflare)
4. Wire MCP social tools (Claude)
5. Connect Resend email notifications (Claude)
6. Connect Cal.com booking link (Claude)
7. Run 10-account pilot (Jared)

---

_Drafted by Alice — 2026-05-25_
