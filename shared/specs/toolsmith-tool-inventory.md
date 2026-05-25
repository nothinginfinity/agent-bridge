# Toolsmith Tool Inventory

> Alice — drafted 2026-05-25
> Project: AFO Toolsmith / Message OS Cloud Social MVP v0.3
> Status: living document — update as MCPs are built/deployed

---

## Purpose

This file is the canonical inventory of planned and live MCPs/tools in the Agent Bridge / Message OS / Toolsmith ecosystem. It is used by:

- AFO Toolsmith to pre-populate the tool catalogue
- Agents to check tool status before requesting connections
- Jared to track build progress

---

## Status Key

| Status | Meaning |
|---|---|
| `live` | Deployed and connected |
| `planned` | Spec exists or agreed upon, not yet built |
| `in-progress` | Actively being built |
| `stub` | Skeleton exists, not functional |

---

## Core Infrastructure MCPs

| MCP | Status | Owner | Notes |
|---|---|---|---|
| `github-mcp` | `live` | GitHub | Used by Alice for all repo work |
| `mcp-prax` | `live` | Jared | Mobile MCP runner |
| `cloudflare-mcp` | `live` | Cloudflare | Used by Claude for D1/Worker/KV/R2 |
| `message-os-v08-mcp` | `live` | Jared/Claude | Core Message OS inbox/notify |
| `vector-lab-mcp` | `live` | Claude | Vectorize retrieval |
| `toolsmith-admin-mcp` | `live` | Claude | Toolsmith catalogue + belt management |
| `cloudflare-auditor-mcp` | `live` | Claude | Cloudflare resource auditing (v0.1.0) |

---

## Message OS Cloud Social MCPs

| MCP | Status | Owner | Notes |
|---|---|---|---|
| `message-os-cloud-social-mcp` | `planned` | Claude | Core social layer tools (see below) |
| `message-os-cloud-admin-mcp` | `planned` | Claude | Admin/pilot account management |
| `message-os-cloud-dashboard-builder` | `planned` | Claude | Dashboard tab/card rendering |

### message-os-cloud-social-mcp tools
```
whoami
get_activation_instructions
list_contacts
request_contact
accept_contact
block_contact
send_message
check_inbox
read_message
mark_message_seen
propose_inbox_notification_frame
```

### message-os-cloud-admin-mcp tools
```
list_accounts
inspect_tenant
create_pilot_account
disable_account
usage_status
resend_setup_email
```

### message-os-cloud-dashboard-builder tools
```
update_dashboard_tabs
render_setup_card
render_contacts_card
render_inbox_card
render_send_message_card
render_booking_card
```

---

## Boot / Context Belt MCPs

| MCP | Status | Owner | Notes |
|---|---|---|---|
| `message-os-boot-mcp` | `planned` | TBD | Boot context assembly |
| `handoff-mcp` | `planned` | TBD | Agent handoff management |
| `context-belt-mcp` | `planned` | TBD | Context packet assembly |
| `toolsmith-belt-manager-mcp` | `planned` | TBD | Belt creation and management |

### message-os-boot-mcp tools
```
boot_context
  → boot_doctrine
  → active_project
  → latest_handoff
  → inbox_summary
  → unread_messages
  → tool_status
  → missing_tools
  → recommended_next_actions
```

### handoff-mcp tools
```
create_handoff
read_latest_handoff
list_handoffs
mark_handoff_accepted
summarize_handoff
```

### context-belt-mcp tools
```
assemble_context_packet
load_project_context
load_toolsmith_belt
list_required_tools
compare_connected_tools
```

### toolsmith-belt-manager-mcp tools
```
create_belt
add_tool_to_belt
list_belt_tools
recommend_belt_for_task
generate_project_instructions_for_belt
```

---

## Email / Communication MCPs

| MCP | Status | Owner | Notes |
|---|---|---|---|
| `resend-email-mcp` | `planned` | TBD | Transactional email via Resend |

### resend-email-mcp tools
```
send_email
send_template_email
send_contact_invite_email
send_message_notification_email
verify_domain_status
```

---

## Booking MCPs

| MCP | Status | Owner | Notes |
|---|---|---|---|
| `calcom-booking-mcp` | `planned` | TBD | Cal.com booking link and event types |

### calcom-booking-mcp tools
```
get_booking_link
list_event_types
create_setup_call_link
create_booking_invite
```

---

## DriveMind MCPs

| MCP | Status | Owner | Notes |
|---|---|---|---|
| `drivemind-mcp` | `planned` | TBD | Local SSD index MCP |
| `drivemind-temp-cloud-mcp` | `planned` | TBD | Temp Cloudflare promotion |
| `mobile-code-packet-mcp` | `planned` | TBD | Mobile code packet delivery |
| `remote-build-bridge-mcp` | `planned` | Claude | Remote build bridge |
| `swift-playground-packager-mcp` | `planned` | TBD | Swift Playground packaging |
| `pythonista-prototype-packet-mcp` | `planned` | TBD | Pythonista prototype packaging |
| `cloudflare-multipart-mcp` | `planned` | Claude | Cloudflare multipart form handling |
| `agent-bridge-comms-mcp` | `planned` | Claude | Core comms spine MCP |

---

## Toolsmith Flagship Belt: message-os-cloud-social-builder-belt

See: `shared/specs/message-os-cloud-social-builder-belt.md`

This belt is the primary example belt for the Toolsmith public catalogue launch.

---

_Drafted by Alice — 2026-05-25_
_Update this file whenever an MCP moves from planned → in-progress → live._
