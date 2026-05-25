# Message OS Cloud Social MVP v0.3 — Product Spec

_version: 0.3 | status: draft | author: claude | date: 2026-05-25_

---

## 1. Vision

Message OS Cloud is the social layer for AI accounts.

Every ChatGPT, Claude, or other AI client user gets:
- A persistent identity and public handle (`jared@messageos.cloud`)
- An approved contacts list
- Permissioned messaging (only approved contacts can message you)
- A dashboard inbox and send-message UI
- MCP tools so their AI assistant can read and send messages natively

Product framing: **"Facebook Messenger / Gmail-style identity for AI clients."**

---

## 2. Current State (v0.2 baseline)

Working today:
- Message OS Cloud signup page
- Tenant provisioning
- User + workspace creation
- Connector token generation
- MCP URL display
- Mobile dashboard (dashboard-only Worker)
- ChatGPT/Claude setup instructions

---

## 3. v0.3 Goals

1. Accounts get a public handle/address (`@jared` or `jared@messageos.cloud`)
2. Users can add contacts by handle or email (with approval flow)
3. Approved contacts can exchange messages
4. Messages appear in dashboard inbox and through MCP in ChatGPT/Claude
5. Resend sends notification emails (welcome, contact request, new message)
6. Dashboard includes Cal.com setup booking card
7. 10-account invite-only pilot

---

## 4. Account Model

```
tenant
  └── user
        ├── profile (handle, display_name, avatar_url, bio)
        ├── workspace
        ├── connector_token → MCP URL
        ├── contacts (approved list)
        ├── contact_requests (pending/accepted/blocked/removed)
        └── user_messages (inbox + sent)
```

### Handle format
- Primary: `@handle` (unique, lowercase, alphanumeric + hyphens)
- Address form: `handle@messageos.cloud`
- Pilot handles assigned by Jared; self-serve in future

---

## 5. Database Schema Changes

See `shared/specs/message-os-cloud-social-schema-v0.3.md` for the full migration SQL.

New tables:
- `profiles`
- `contacts`
- `contact_requests`
- `user_messages`

Future:
- `message_attachments`

---

## 6. Dashboard Tabs

| Tab | Description |
|---|---|
| Overview | Account summary, handle, MCP URL, quick stats |
| Setup | MCP connection instructions for ChatGPT + Claude |
| Inbox | Received messages, mark read, reply |
| Contacts | Approved contacts list |
| Add Contact | Search by handle/email, send contact request |
| Send Message | Compose and send to approved contact |
| Archive | Past/archived messages |
| Memory | Future: vector memory / context |
| Account | Profile, handle, settings |
| Book Setup Call | Cal.com booking card |

---

## 7. MCP Tools (Social Layer)

Tools added to the Message OS Cloud Social MCP Worker:

| Tool | Description |
|---|---|
| `whoami` | Returns current user's profile, handle, workspace, MCP URL |
| `get_activation_instructions` | Returns setup steps for ChatGPT/Claude |
| `list_contacts` | Returns approved contacts list |
| `request_contact` | Sends a contact request by handle or email |
| `accept_contact` | Accepts a pending contact request |
| `block_contact` | Blocks a contact or request |
| `send_message` | Sends a message to an approved contact |
| `check_inbox` | Returns unread messages |
| `read_message` | Returns full message content, marks seen |
| `mark_message_seen` | Marks a message as read |
| `propose_inbox_notification_frame` | Creates an inbox notification card (compatible with v07/v08 flow) |

All tools are scoped to the authenticated connector token (one token = one user).

---

## 8. Resend Email Integration

Worker: extend existing `afo-audit-signup` Resend pattern.

**Confirmed from source inspection of `afo-audit-signup`:**
- Resend is already wired via `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM`
- Pattern: `fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer {EMAIL_API_KEY}" }, body: { from, to, subject, text } })`

**New env vars for Message OS Cloud Worker:**
```
RESEND_API_KEY        # Resend API key (same key, separate var for clarity)
RESEND_FROM_EMAIL     # e.g. hello@messageos.cloud
APP_BASE_URL          # https://message-os-cloud.agentfeedoptimization.com
DASHBOARD_BASE_URL    # https://message-os-cloud-dashboard.agentfeedoptimization.com
```

**Email triggers:**
| Event | Email |
|---|---|
| Signup | Welcome + handle + MCP URL + setup instructions |
| Contact request received | "X wants to connect on Message OS" |
| Contact request accepted | "X accepted your connection" |
| New message received | "You have a new message from X" |
| Pilot invite | Custom invite email with handle + booking link |

---

## 9. Cal.com Integration

**New env var:**
```
CALCOM_BOOKING_URL    # e.g. https://cal.com/jared/message-os-setup
```

Used in:
- Dashboard "Book Setup Call" tab — rendered as a booking card with CTA button
- Welcome email — include booking link for new pilot users
- Setup tab — secondary CTA after MCP instructions

No Cal.com API calls needed for MVP — just a link. Future: `calcom-booking-mcp` for dynamic slot availability.

---

## 10. Privacy + Safety Model

- Only approved contacts can send messages (default: closed)
- Contact states: `pending` → `accepted` | `blocked` | `removed`
- Messages are stored encrypted at rest (future); plaintext for pilot
- No public profile discovery in pilot — invite only
- Connector tokens are per-user and scoped to one workspace

---

## 11. Build Sequence

1. **Commit spec + schema** (this file + schema migration) ✅
2. **Extend D1** — run migration on message-os-cloud-db
3. **Extend signup Worker** — create profile + handle on new user signup
4. **Extend dashboard Worker** — add Contacts, Inbox, Send Message, Book Setup Call tabs
5. **Build Social MCP Worker** — deploy `message-os-cloud-social-mcp` with tools above
6. **Wire Resend** — welcome + contact + message notification emails
7. **Run 10-account pilot** — Jared invites pilot users, monitors via admin dashboard
8. **Register belt** — `message-os-cloud-social-builder-belt` in Toolsmith catalogue

---

## 12. Pilot Target

- 10 invite-only accounts
- Each gets: account, handle, MCP URL, setup instructions, contact request from Jared, test message
- Jared monitors via admin dashboard and `message-os-cloud-admin-mcp`

---

## 13. Compatibility

All social MCP tools must be compatible with the existing Message OS comms flow:

```
triage_inbox → propose_inbox_notification_frame → reply_or_route
```

`propose_inbox_notification_frame` in the social MCP should accept and return the same contract as Message OS v07/v08.

---

## 14. New MCPs to Build

| MCP | Priority | Notes |
|---|---|---|
| `message-os-cloud-social-mcp` | P0 | Core social tools, authenticated per connector token |
| `resend-email-mcp` | P0 | Reusable email tool; wraps Resend API |
| `message-os-cloud-admin-mcp` | P1 | Pilot account management, usage status |
| `message-os-cloud-dashboard-builder` | P1 | Dashboard tab rendering |
| `calcom-booking-mcp` | P2 | Dynamic Cal.com slot/booking tools |

---

## 15. Toolsmith Belt

Primary belt: `message-os-cloud-social-builder-belt`

Contents:
- GitHub MCP
- mcp-prax
- Cloudflare MCP
- Message OS v08 MCP
- Vector Lab MCP
- Toolsmith Admin MCP
- Resend email MCP
- Cal.com booking MCP
- Message OS Cloud Social MCP
- Message OS Cloud Admin MCP
- Boot/Context MCP
- Handoff MCP

---

_Authored by Claude · 2026-05-25 · agent-bridge/shared/specs/_
