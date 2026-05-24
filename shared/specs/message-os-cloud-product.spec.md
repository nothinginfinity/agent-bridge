# Message OS Cloud — Product Spec

**status:** draft v0.1
**owner:** Jared / AFO Toolsmith
**related:** Message OS v06-v09, Agent Bridge, DriveMind, AFO Toolsmith, Workcells > Swarms

## One-line product

```txt
Message OS Cloud gives every user a private AI inbox, searchable conversation memory, and MCP connector for ChatGPT, Claude, and future AI clients.
```

## Product thesis

Current LLM chats are powerful but isolated. They do not have a user-owned, persistent, searchable message layer that works across assistants.

Message OS Cloud creates that layer:

```txt
sign up
→ get a private Message OS account
→ get an MCP connector URL
→ connect it to ChatGPT / Claude
→ receive in-chat messages
→ archive important messages
→ promote selected messages to vector memory
→ search/reuse that memory across sessions
```

This is not just an MCP. It is a paid account system with backend storage, memory, dashboard, billing, and activation instructions.

## Target users

### Personal power users

People who use ChatGPT/Claude daily and want durable private memory, searchable message history, and cross-agent handoff.

### Builders / founders

People coordinating multiple AI assistants, projects, specs, deploys, research, and human-to-AI workflows.

### Teams / workcells

Small teams that want AI-native inboxes, project memory, and explicit workcell messaging.

## Core promise

```txt
A private Gmail-like account for your AI conversations.
```

But instead of only email, the user receives:

```txt
private AI inbox
private message archive
private vector memory
MCP connector URL
activation instructions
profile dashboard
usage/billing controls
```

## MVP user flow

```txt
Landing page
→ Sign up
→ Create profile
→ Choose plan / start trial
→ Provision tenant
→ Generate connector token
→ Show MCP connector URL
→ Show ChatGPT/Claude setup instructions
→ User connects MCP
→ User runs test message
→ Message OS starts triage/archive/memory flow
```

## Account onboarding

After signup, the dashboard should show:

1. Account/profile status
2. MCP connector URL
3. Connector token status
4. Copy-paste instructions for ChatGPT Projects
5. Copy-paste instructions for Claude Projects
6. Test connector button
7. Message inbox status
8. Archive and memory settings
9. Usage meter
10. Billing/plan status

## Product components

### 1. Landing page

Public marketing and signup page.

Primary CTA:

```txt
Create your AI messaging account
```

Secondary CTA:

```txt
See how it works
```

### 2. Account/profile dashboard

Private user interface for activation, profile, usage, memory settings, and connector management.

### 3. Message OS MCP connector

Per-user or multi-tenant MCP endpoint.

Initial MVP can use one shared Worker with tenant tokens:

```txt
https://message-os-cloud.agentfeedoptimization.com/mcp
```

Later enterprise tiers may receive dedicated connectors:

```txt
https://<tenant>.message-os.agentfeedoptimization.com/mcp
```

### 4. Message database

D1-backed message hub with tenant isolation.

Stores:

- inbound messages
- outbound messages
- notifications
- frames/cards
- routing records
- archive metadata
- usage counters

### 5. Vector memory

Cloudflare Vectorize-backed semantic memory.

MVP:

```txt
one shared Vectorize index
namespace by tenant_id / workspace_id
```

Higher tiers:

```txt
dedicated namespace
or dedicated Vectorize index
```

### 6. DriveMind archive

Archive bundles can be exported to DriveMind-compatible markdown/json.

Modes:

```txt
local_bundle
cloud_export
project_vault
vector_memory
```

### 7. Billing

Stripe or equivalent subscription billing.

Plans should be tied to storage, vector memory, usage, and number of connectors/workspaces.

## Suggested pricing model

### Free trial

- limited message volume
- limited archive
- no or tiny vector memory
- one connector
- watermark/limited retention optional

### Personal

- private inbox
- persistent archive
- limited vector memory
- ChatGPT + Claude setup

### Pro

- higher message limits
- larger vector memory
- DriveMind exports
- reply/routing
- multiple projects/workspaces

### Team

- shared workspaces
- team inboxes
- admin controls
- workcell routing

### Enterprise

- dedicated resources
- custom retention
- export/deletion support
- compliance/security review

## Cost drivers

The service cannot be free because it uses:

```txt
D1 reads/writes
Vectorize storage and queries
Workers AI / embeddings
R2 archive storage
Worker requests
GitHub/API writes for bridge routing
long-term retention
```

## Core MCP tools by phase

### v06 detector

```txt
triage_inbox
check_message_inbox
check_bridge_inbox
```

### v07 card layer

```txt
propose_inbox_notification_frame
```

### v08 reply/routing

```txt
reply_or_route
```

### v09 memory/archive

```txt
archive_to_drivemind
promote_message_to_memory
search_memory
export_message_bundle
usage_status
```

## Multi-tenant architecture

Every object must be scoped by:

```txt
tenant_id
user_id
workspace_id
```

No tool should return messages, archives, or vectors unless the connector token maps to the same tenant/user/workspace.

## Tenant model

```txt
tenant = billing/account boundary
user = login identity
workspace = project/memory boundary
connector = MCP access credential
```

A personal account may have:

```txt
one tenant
one user
one default workspace
one or more connectors
```

A team account may have:

```txt
one tenant
many users
many workspaces
many connectors
```

## Security principles

- Never expose raw GitHub tokens to users.
- Store connector tokens hashed where possible.
- Each MCP request must resolve tenant context.
- Every DB query must be tenant-scoped.
- Vector namespaces must include tenant/workspace IDs.
- Archive deletion and export should be supported.
- Full message body should only be opened after explicit user action.

## MVP scope

### Build now

```txt
landing page
signup waitlist / create account form
D1 schema
profile dashboard spec
connector activation instructions
single shared MCP endpoint
manual/early billing flag
archive_to_drivemind
promote_message_to_memory
search_memory
usage_status
```

### Defer

```txt
full Stripe automation
team admin
dedicated indexes per tenant
mobile app
true push notifications
enterprise compliance tooling
```

## Activation instructions template

ChatGPT Project instructions:

```txt
At the start or end of every substantive response, call Message OS triage_inbox.

If messages exist, tell me the sender, priority, and title. Ask whether to open, preview, reply, archive, ignore, or later.

Do not open full messages without approval.
Do not mark handled unless I choose ignore/archive/done.
```

Claude Project instructions:

```txt
At session boot, call Message OS triage_inbox.

If messages exist, summarize sender/priority/title and ask Jared what to do.
Use propose_inbox_notification_frame when available.
Do not open or mark handled without approval.
```

## Success criteria

MVP is successful when:

1. A user can create an account.
2. The system provisions tenant/workspace/connector records.
3. The dashboard shows an MCP URL and instructions.
4. ChatGPT/Claude can connect the MCP.
5. triage_inbox works for the tenant.
6. A message can be archived.
7. A message can be promoted to vector memory.
8. Memory can be searched from the MCP.
9. Usage is tracked.

## Product positioning

```txt
Message OS Cloud is your private AI inbox and memory layer.
```

Alternative tagline:

```txt
Give your AI accounts a real inbox, memory, and messaging system.
```
