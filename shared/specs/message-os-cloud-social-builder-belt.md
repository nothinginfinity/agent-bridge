# message-os-cloud-social-builder-belt

> Alice — drafted 2026-05-25
> Project: Message OS Cloud Social MVP v0.3 / AFO Toolsmith
> Status: draft — pending Toolsmith registration

---

## Purpose

The `message-os-cloud-social-builder-belt` is the primary working belt for building, deploying, and managing the Message OS Cloud Social MVP. It is also a flagship example belt for the AFO Toolsmith public catalogue.

This belt enables an agent team (Alice + Claude + ChatGPT) to:
- Read and write project specs and schemas in GitHub
- Deploy Cloudflare Workers, D1 databases, and KV/R2 resources
- Manage Message OS accounts and social layer features
- Send transactional emails via Resend
- Surface Cal.com booking links
- Boot into the correct project context automatically
- Coordinate via agent-bridge handoffs and bulletins

---

## Belt Metadata

```yaml
belt_id: message-os-cloud-social-builder-belt
version: 0.3.0
project: Message OS Cloud Social MVP v0.3
owner: jared@messageos.cloud
created: 2026-05-25
status: draft
catalogue: afo-toolsmith
tags:
  - message-os
  - social-layer
  - cloudflare
  - mcp
  - ai-identity
  - builder-belt
```

---

## Included Tools / MCPs

| Tool / MCP | Status | Role |
|---|---|---|
| `github-mcp` | live | Alice — repo builder, specs, schemas, docs |
| `mcp-prax` | live | Jared — mobile MCP runner |
| `cloudflare-mcp` | live | Claude — D1, Worker, KV, R2 deployment |
| `message-os-v08-mcp` | live | All — inbox, notify, triage |
| `vector-lab-mcp` | live | Claude — Vectorize retrieval |
| `toolsmith-admin-mcp` | live | All — belt/catalogue management |
| `message-os-cloud-social-mcp` | planned | Claude — social layer tools |
| `message-os-cloud-admin-mcp` | planned | Claude — pilot account admin |
| `message-os-cloud-dashboard-builder` | planned | Claude — dashboard rendering |
| `resend-email-mcp` | planned | TBD — transactional email |
| `calcom-booking-mcp` | planned | TBD — booking links |
| `message-os-boot-mcp` | planned | All — boot context assembly |
| `handoff-mcp` | planned | All — agent handoffs |
| `context-belt-mcp` | planned | All — context packet assembly |
| `agent-bridge-comms-mcp` | planned | All — comms spine |

---

## Capabilities

With this belt connected, an agent can:

1. **Build** — Read/write all Social MVP specs, schemas, and docs in `nothinginfinity/agent-bridge`
2. **Deploy** — Push D1 migrations, Workers, KV/R2 bindings for Message OS Cloud
3. **Manage accounts** — Create/inspect/disable pilot accounts
4. **Social layer** — whoami, list contacts, send messages, check inbox, manage contact requests
5. **Email** — Send setup, invite, and notification emails via Resend
6. **Booking** — Generate Cal.com setup call links
7. **Boot** — Load project context, active mission, connected tools, and recommended next actions
8. **Coordinate** — Post/read agent-bridge bulletins and handoffs
9. **Vectorize** — Index and retrieve message content
10. **Admin** — Run Toolsmith belt/catalogue operations

---

## Required Connections

To use this belt, the following must be connected:

- GitHub PAT with write access to `nothinginfinity/agent-bridge`
- Cloudflare API token with D1/Worker/KV/R2 access
- Message OS v08 MCP URL + connector token
- AFO Toolsmith Admin MCP URL
- Vector Lab MCP URL

Planned (not yet required for v0.3 build):
- Resend API key
- Cal.com API key / OAuth
- message-os-boot-mcp URL

---

## Prerequisites

- Message OS Cloud account provisioned (tenant + user + workspace)
- D1 database `message-os-cloud-db` exists with base schema
- Cloudflare Worker `message-os-cloud-worker` is deployed
- `agent-bridge` repo initialized with `shared/`, `alice/`, `claude/`, `chatgpt/` structure

---

## Role Split

| Agent | Role |
|---|---|
| Alice (Perplexity) | GitHub: specs, schemas, docs, checklists, repo organization |
| Claude | Cloudflare: D1 migrations, Worker deployments, MCP runtime, debugging |
| ChatGPT | Product architecture, reasoning, specs, compatibility, review |
| Jared | Final authority, mobile command center, pilot testing |

---

## Message OS Compatibility

All tools and flows in this belt preserve:

```
triage_inbox → propose_inbox_notification_frame → reply_or_route
```

The social layer is an extension of this flow — not a replacement.

---

## Smoke Tests

Before marking belt as `live`, verify:

- [ ] `github-mcp` can read and write `shared/specs/` files
- [ ] `cloudflare-mcp` can run D1 migration for social tables
- [ ] `message-os-v08-mcp` `triage_inbox` returns current inbox state
- [ ] `message-os-cloud-social-mcp` `whoami` returns handle and account info
- [ ] `message-os-cloud-social-mcp` `send_message` delivers to an approved contact
- [ ] `message-os-cloud-social-mcp` `check_inbox` returns messages
- [ ] `resend-email-mcp` `send_message_notification_email` sends successfully
- [ ] `calcom-booking-mcp` `get_booking_link` returns valid URL
- [ ] `message-os-boot-mcp` `boot_context` returns active_project = Message OS Cloud Social MVP v0.3
- [ ] `toolsmith-admin-mcp` can list this belt from the catalogue

---

## Handoff / Bulletin Protocol

After significant work using this belt:

1. Post a concise status update to `shared/bulletin.md` with:
   - What was done
   - Commit SHAs (if applicable)
   - Next recommended actions
2. If handing off to another agent, write to their inbox (`claude/inbox.md`, `chatgpt/inbox.md`, `alice/inbox.md`)
3. Always include `from`, `to`, `project`, `type`, `date`, `status`, `priority`, and `requires` fields

---

## Toolsmith Registration Target

When AFO Toolsmith public catalogue launches, register this belt with:

- **Belt name:** Message OS Cloud Social Builder
- **Tagline:** Build the social layer for AI accounts
- **Category:** Social / Messaging / AI Identity
- **Tier:** Pro
- **Example use cases:**
  - Set up a 10-account Message OS pilot
  - Deploy social layer D1 schema + Worker
  - Send invite emails to pilot users
  - Build dashboard inbox + contacts UI

---

_Drafted by Alice — 2026-05-25_
