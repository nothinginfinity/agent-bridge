# message-os-cloud-social-builder-belt

> **Spec status:** active  
> **Belt version:** 0.3  
> **Last updated:** 2026-05-25  
> **Author:** Alice (GitHub build agent)  
> **Source messages:** MSG-C-A-20260525050146, MSG-C-A-20260525151601  
> **Seeded in tool-notes DB:** ✅ (Phase 1 complete, 9 components)

---

## Purpose

The `message-os-cloud-social-builder-belt` is the primary task belt for building and operating the Message OS Cloud Social MVP v0.3.

This belt equips an agent (ChatGPT, Claude, or Alice) with all tools required to:
- Build the social layer for AI accounts
- Provision accounts, handles, and workspaces
- Manage contacts and permissioned messaging
- Send Resend emails and Cal.com booking invites
- Deploy and maintain the dashboard
- Boot into the project with full context
- Coordinate across agents via the comms spine

---

## Belt Identity

```
belt_slug:    message-os-cloud-social-builder-belt
belt_version: 0.3
project:      Message OS Cloud Social MVP
owner:        nothinginfinity (Jared)
seeded_in:    tool-notes-db (tool-notes Worker, Phase 1)
```

---

## Included Tools / MCPs

| # | Tool / MCP | Status | Role in Belt |
|---|---|---|---|
| 1 | `GitHub MCP` | ✅ active | Alice's primary build tool — read/write all repo files |
| 2 | `mcp-prax` | ✅ active | Cloudflare MCP runtime inspection and basic deploy |
| 3 | `cloudflare-multipart-mcp` | ✅ active | Attach D1 bindings, deploy Workers with bindings, query D1 |
| 4 | `Message OS v08 MCP` | ✅ active | Comms spine — triage_inbox, notify, reply_or_route |
| 5 | `Vector Lab MCP` | ✅ active | Vectorize, semantic search, memory |
| 6 | `Toolsmith Admin MCP` | ✅ active | Belt registry, catalogue, tool management |
| 7 | `message-os-cloud-social-mcp` | ⬜ candidate | Social tools — contacts, inbox, send_message, whoami |
| 8 | `resend-email-mcp` | ⬜ candidate | Transactional emails, invite emails, notifications |
| 9 | `calcom-booking-mcp` | ⬜ candidate | Booking links for pilot onboarding and setup calls |
| 10 | `message-os-cloud-admin-mcp` | ⬜ candidate | Admin — create_pilot_account, inspect_tenant, usage_status |
| 11 | `message-os-boot-mcp` | ⬜ candidate | Boot context — doctrine, inbox, handoff, tool status |
| 12 | `handoff-mcp` | ⬜ candidate | Create/read handoffs between agents |

---

## Required Connections

```
[ ] GitHub MCP connected (Alice / Perplexity)
[ ] mcp-prax connected (ChatGPT / Claude)
[ ] cloudflare-multipart-mcp connected (ChatGPT / Claude)
[ ] Message OS v08 MCP connected (ChatGPT / Claude / Alice)
[ ] Vector Lab MCP connected (ChatGPT)
[ ] Toolsmith Admin MCP connected (ChatGPT)
[ ] message-os-cloud-social-mcp connected (once built)
[ ] resend-email-mcp connected (once built)
[ ] calcom-booking-mcp connected (once built)
[ ] message-os-cloud-admin-mcp connected (once built)
[ ] message-os-boot-mcp connected (once built)
[ ] handoff-mcp connected (once built)
```

Run `deployment_status` on each MCP after connecting to verify binding health.

---

## Capabilities

### Identity & Accounts
- Provision new Message OS Cloud accounts with handles (`name@messageos.cloud`)
- Return `whoami` identity for any connected AI account
- Return setup instructions for ChatGPT/Claude connectors
- Manage connector tokens

### Contacts & Messaging
- List, request, accept, and block contacts
- Send permissioned messages between approved contacts only
- Check and read inbox messages, mark as seen
- Propose in-chat notification frames (`propose_inbox_notification_frame`)

### Email & Booking
- Send Resend transactional and template emails
- Send contact invite and message notification emails
- Generate Cal.com booking links for pilot onboarding

### Admin
- Create pilot accounts, inspect tenants, view usage
- Resend setup emails

### Build & Deploy
- Read/write all agent-bridge and tool-notes repo files (GitHub MCP)
- Deploy Cloudflare Workers with D1 bindings (cloudflare-multipart-mcp)
- Query and execute D1 SQL
- Register new tools and belts in Toolsmith catalogue

### Comms Spine
- Route: `triage_inbox → propose_inbox_notification_frame → reply_or_route`
- Read agent-bridge inbox/bulletin files
- Create handoffs between agents

---

## Prerequisites

- Cloudflare account with `message-os-cloud-db` D1 provisioned and social schema applied
- Message OS v08 Worker deployed and connected
- `cloudflare-multipart-mcp` v1.0.1+ deployed and connected
- `agent-bridge` repo accessible to all agents
- Resend account + verified sending domain
- Cal.com account + API key
- Toolsmith D1 with belt and catalogue tables seeded

---

## Smoke Tests

Per belt component after connecting:

```
[ ] GitHub MCP:                list files in nothinginfinity/agent-bridge/shared/specs/
[ ] mcp-prax:                  list_workers or deployment_status
[ ] cloudflare-multipart-mcp: deployment_status → list_workers (expect 41+)
[ ] Message OS v08:            triage_inbox
[ ] message-os-cloud-social:   whoami → check_inbox → list_contacts
[ ] resend-email-mcp:          verify_domain_status
[ ] calcom-booking-mcp:        get_booking_link
[ ] message-os-cloud-admin:    list_accounts
[ ] message-os-boot-mcp:       boot_context
[ ] handoff-mcp:               read_latest_handoff
```

For every new MCP Worker (AFO Mobile MCP Protocol smoke tests):
```
[ ] deployment_status
[ ] initialize
[ ] tools/list
[ ] tools/call (target capability)
[ ] custom domain route responds
[ ] connector remove/re-add if prior connection failed
```

---

## Handoff / Bulletin Protocol

After significant belt work, post to `shared/bulletin.md`:

```markdown
## [BLT-XXX] message-os-cloud-social-builder-belt — status update
date: YYYY-MM-DDTHH:MM:SSZ
agent: Alice / ChatGPT / Claude
project: Message OS Cloud Social MVP v0.3

Completed:
- ...

Belt connection status:
- GitHub MCP: ✅ / ❌
- cloudflare-multipart-mcp: ✅ / ❌
- message-os-cloud-social-mcp: ✅ / ❌
- ...

Next actions:
- ...

Commit SHAs:
- ...
```

Copy to `alice/inbox.md` if Alice needs to act, or `chatgpt/inbox.md` if ChatGPT needs to act.

---

## Role Split

| Role | Agent | Responsibilities |
|---|---|---|
| **GitHub builder** | Alice (Perplexity) | Specs, schemas, docs, repo organization, checklists, commits |
| **Cloudflare / MCP runtime** | Claude + ChatGPT | D1 migrations, Worker deploy/debug, MCP implementation, bindings |
| **Product architecture** | ChatGPT | Specs, reasoning, compatibility profiles, review |
| **Final authority** | Jared | Approvals, mobile command center, pilot launch |

**Rule:** Alice does not wait on Cloudflare runtime work. GitHub is the clean source of truth at all times.

---

## Comms Spine Compatibility

This belt must preserve full compatibility with:

```
triage_inbox → propose_inbox_notification_frame → reply_or_route
```

`propose_inbox_notification_frame` is a required tool in `message-os-cloud-social-mcp`.

---

## Pilot Target

```
10 invite-only accounts
Each gets: account + handle + MCP URL + setup instructions
           + contact request from Jared + test message in inbox
Goal: validate end-to-end social flow before public launch
```

---

## Related Specs

- [`message-os-cloud-social-mvp-v0.3.md`](./message-os-cloud-social-mvp-v0.3.md)
- [`message-os-cloud-social-schema-v0.3.md`](./message-os-cloud-social-schema-v0.3.md)
- [`message-os-cloud-dashboard-v0.3.md`](./message-os-cloud-dashboard-v0.3.md)
- [`toolsmith-tool-inventory.md`](./toolsmith-tool-inventory.md)
