# Toolsmith Tool Inventory

> **Spec status:** active — updated Batch 2: Social MVP + AFO Mobile MCP Protocol entries  
> **Last updated:** 2026-05-25  
> **Author:** Alice (GitHub build agent)  
> **Source messages:** MSG-C-A-20260525050146, MSG-C-A-20260525151601, MSG-C-A-20260525170311, MSG-C-A-20260525190336  

Canonical Toolsmith catalogue of all planned, candidate, active, and stable MCP tools and Workers across the AFO / Message OS / Toolsmith ecosystem.

Status stages: `experimental` → `candidate` → `active` → `stable` → `deprecated` → `archived`

---

## 1. Message OS Cloud Social Layer

### `message-os-cloud-social-mcp`
- **status:** candidate
- **worker:** `message-os-cloud-social-mcp` (to be created)
- **domain:** `message-os-cloud-social-mcp.agentfeedoptimization.com/mcp`
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `whoami` — return current account identity and handle
  - `get_activation_instructions` — return setup steps for ChatGPT/Claude
  - `list_contacts` — list approved contacts
  - `request_contact` — send contact request by handle
  - `accept_contact` — accept a pending contact request
  - `block_contact` — block a contact
  - `send_message` — send message to approved contact
  - `check_inbox` — list received messages (unread first)
  - `read_message` — read full message by ID
  - `mark_message_seen` — mark message as read
  - `propose_inbox_notification_frame` — propose UI frame for in-chat notification
- **dependencies:** `message-os-cloud-db` D1, social tables (profiles, contacts, contact_requests, user_messages)
- **notes:** Do NOT patch Message OS v08 directly. New standalone Worker per AFO Versioned MCP Lifecycle.

---

### `message-os-cloud-admin-mcp`
- **status:** candidate
- **worker:** `message-os-cloud-admin-mcp` (to be created)
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `list_accounts` — list all tenant accounts
  - `inspect_tenant` — get tenant details by ID or handle
  - `create_pilot_account` — provision a new invite-only pilot account
  - `disable_account` — disable an account
  - `usage_status` — return usage metrics
  - `resend_setup_email` — resend setup email via Resend
- **dependencies:** `message-os-cloud-db` D1, Resend API
- **notes:** Jared-only admin access. Do not expose to pilot users.

---

### `message-os-cloud-dashboard-builder`
- **status:** candidate
- **worker:** `message-os-cloud-dashboard` (HTML-serving Cloudflare Worker)
- **protocol:** REST / HTML — NOT MCP
- **belt:** `message-os-cloud-social-builder-belt`
- **routes / tools:**
  - `update_dashboard_tabs`
  - `render_setup_card`
  - `render_contacts_card`
  - `render_inbox_card`
  - `render_send_message_card`
  - `render_booking_card`
- **dependencies:** `message-os-cloud-db` D1, social MCP tools
- **notes:** Dashboard spec → `shared/specs/message-os-cloud-dashboard-v0.3.md`. Separate Worker from MCP Worker.

---

## 2. Boot / Context Layer

### `message-os-boot-mcp`
- **status:** candidate
- **worker:** `message-os-boot-mcp` (to be created)
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `boot_context` — load boot doctrine, check inbox, find latest handoff, summarize active project, list connected/missing tools, return recommended next actions
- **boot_context output fields:**
  - `boot_doctrine`, `active_project`, `latest_handoff`, `inbox_summary`, `unread_messages`, `tool_status`, `missing_tools`, `recommended_next_actions`
- **dependencies:** `agent-bridge` repo reads, Message OS inbox, Toolsmith D1
- **notes:** Fixes boot assembly friction identified in MSG-C-A-20260525050146.

---

### `handoff-mcp`
- **status:** candidate
- **worker:** `handoff-mcp` (to be created)
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `create_handoff`
  - `read_latest_handoff`
  - `list_handoffs`
  - `mark_handoff_accepted`
  - `summarize_handoff`
- **dependencies:** `agent-bridge` D1 or GitHub file store

---

### `context-belt-mcp`
- **status:** experimental
- **worker:** `context-belt-mcp` (to be created)
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `assemble_context_packet`
  - `load_project_context`
  - `load_toolsmith_belt`
  - `list_required_tools`
  - `compare_connected_tools` — diff required vs connected tools, surface gaps
- **notes:** Context belts answer "what world is the assistant entering?" Not just tool belts.

---

### `toolsmith-belt-manager-mcp`
- **status:** candidate
- **worker:** standalone or extension of Toolsmith Admin MCP
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `create_belt`
  - `add_tool_to_belt`
  - `list_belt_tools`
  - `recommend_belt_for_task`
  - `generate_project_instructions_for_belt`
- **dependencies:** Toolsmith D1

---

## 3. Communication / Email / Booking

### `resend-email-mcp`
- **status:** candidate
- **worker:** `resend-email-mcp` (to be created)
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `send_email`
  - `send_template_email`
  - `send_contact_invite_email`
  - `send_message_notification_email`
  - `verify_domain_status`
- **dependencies:** Resend API key, verified domain

---

### `calcom-booking-mcp`
- **status:** candidate
- **worker:** `calcom-booking-mcp` (to be created)
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `message-os-cloud-social-builder-belt`
- **tools:**
  - `get_booking_link`
  - `list_event_types`
  - `create_setup_call_link`
  - `create_booking_invite`
- **dependencies:** Cal.com API key

---

## 4. Cloudflare Infrastructure

### `cloudflare-multipart-mcp`
- **status:** active ✅
- **worker:** `cloudflare-multipart-mcp`
- **version:** `1.0.1`
- **url:** `https://cloudflare-multipart-mcp.agentfeedoptimization.com/mcp`
- **protocol:** AFO Mobile MCP Protocol
- **belt:** `cloudflare-worker-builder-belt`
- **tools (verified ✅):**
  - `deployment_status` ✅
  - `list_workers` ✅ (returns 41 workers)
  - `get_worker_source`
  - `deploy_worker_with_bindings` ✅ (used for tool-notes Phase 1)
  - `update_worker_bindings_multipart`
  - `query_d1_sql`
  - `execute_d1_sql`
  - `list_d1_tables`
- **notes:** Built manually by Jared. Replaces blocked `mcp-prax` multipart path. Binding names: `CF_ACCOUNT_ID` ✅ / `CF_API_TOKEN` ✅ required exactly.

---

## 5. Protocol / Template Registry

### `afo-mobile-mcp-protocol`
- **status:** stable ✅
- **type:** protocol spec (not a Worker)
- **spec:** `shared/specs/afo-mobile-mcp-protocol.md` *(Batch 1 — pending)*
- **template:** `shared/templates/afo-mobile-mcp-worker-template.js` *(Batch 1 — pending)*
- **key rules:**
  - `POST /mcp` only
  - Hand-rolled JSON-RPC 2.0
  - Raw Cloudflare Worker ES module — no npm, no build, no SSE, no sessions
  - Custom domain on `agentfeedoptimization.com` (not `workers.dev`)
  - No Cloudflare Access on MCP endpoints
  - `initialize`, `ping`, `tools/list` → raw JSON-RPC result
  - `tools/call` → content-wrapped result only
  - Binding names must match exactly
  - After failed connector: remove + re-add
- **mandatory for:** all ChatGPT/Claude mobile-compatible MCPs
- **validated by:** `cloudflare-multipart-mcp` v1.0.1 production test 2026-05-25

---

### `afo-versioned-mcp-lifecycle`
- **status:** active ✅
- **type:** process doctrine (not a Worker)
- **spec:** `shared/specs/afo-versioned-mcp-lifecycle.md` *(Batch 1 — pending)*
- **key rules:**
  - Material change = new Worker
  - Risky capability = new Worker first
  - Do not mutate critical MCPs like `mcp-prax` in place
  - Keep old versions as rollback/reference
  - Promote only after smoke tests
  - Stages: experimental → candidate → active → stable → deprecated → archived
- **validated examples:**
  - `cloudflare-multipart-mcp` instead of patching `mcp-prax`
  - `message-os-cloud-social-mcp` instead of patching v08
  - `message-os-boot-mcp` instead of patching Toolsmith Admin

---

## 6. tool-notes

### `tool-notes` Worker
- **status:** active ✅ (Phase 1 complete)
- **worker:** `tool-notes`
- **db:** `tool-notes-db` (D1, uuid: `9e296f79-b9a0-4598-a05b-37eafc12a924`)
- **repo:** `nothinginfinity/tool-notes`
- **routes:** `GET /health`, `GET /manifest`, `GET /api/belts`, `GET /tools`, `POST /tools`, `GET /tools/:id/notes`, `POST /tools/:id/notes`, `POST /seed/social-builder`
- **seeded:** `message-os-cloud-social-builder-belt` (1 belt + 8 MCPs + 1 builder = 9 rows ✅)
- **remaining:** external HTTP smoke test once domain/route confirmed

---

## Inventory Summary

| Tool / MCP | Status | Worker Exists | Belt |
|---|---|---|---|
| `message-os-cloud-social-mcp` | candidate | ❌ | social-builder-belt |
| `message-os-cloud-admin-mcp` | candidate | ❌ | social-builder-belt |
| `message-os-cloud-dashboard-builder` | candidate | ❌ | social-builder-belt |
| `message-os-boot-mcp` | candidate | ❌ | social-builder-belt |
| `handoff-mcp` | candidate | ❌ | social-builder-belt |
| `context-belt-mcp` | experimental | ❌ | social-builder-belt |
| `toolsmith-belt-manager-mcp` | candidate | ❌ | social-builder-belt |
| `resend-email-mcp` | candidate | ❌ | social-builder-belt |
| `calcom-booking-mcp` | candidate | ❌ | social-builder-belt |
| `cloudflare-multipart-mcp` | **active ✅** | ✅ v1.0.1 | cf-worker-builder-belt |
| `afo-mobile-mcp-protocol` | **stable ✅** | N/A (spec) | mandatory all MCPs |
| `afo-versioned-mcp-lifecycle` | **active ✅** | N/A (doctrine) | mandatory all MCPs |
| `tool-notes` Worker | **active ✅** | ✅ Phase 1 | toolsmith |

---

*Batch 1 docs (AFO Mobile MCP Protocol spec, lifecycle spec, worker template, skill docs, cloudflare-worker-builder-belt) — next commit.*
