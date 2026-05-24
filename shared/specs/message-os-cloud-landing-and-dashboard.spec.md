# Message OS Cloud — Landing Page + Dashboard Spec

**status:** draft v0.1
**related:** `message-os-cloud-product.spec.md`, `message-os-cloud.schema.sql`

## Purpose

This spec defines the first public UI for Message OS Cloud:

```txt
Landing page
→ signup/account creation
→ user profile dashboard
→ MCP connector activation
→ usage/memory/archive controls
```

The UI should make Message OS feel like signing up for a premium AI-native Gmail account:

```txt
Create your AI messaging account.
Get your private MCP connector.
Turn ChatGPT and Claude into persistent, searchable workspaces.
```

## Landing page goals

1. Explain the product in plain language.
2. Make the premium value obvious.
3. Collect signups / create accounts.
4. Explain the activation flow.
5. Set expectation that vector memory and archive storage are paid resources.
6. Lead users toward the broader AFO/DriveMind ecosystem.

## Hero section

### Headline options

```txt
Give your AI accounts a real inbox and memory.
```

```txt
Your private message layer for ChatGPT, Claude, and AI workcells.
```

```txt
A premium AI inbox, archive, and vector memory for every conversation.
```

### Subheadline

```txt
Message OS Cloud gives you a private AI messaging account, searchable memory, and an MCP connector you can plug into ChatGPT, Claude, and future AI clients.
```

### Primary CTA

```txt
Create your Message OS account
```

### Secondary CTA

```txt
See how it works
```

## Above-the-fold layout

```txt
[Logo] Message OS Cloud
[Nav] How it works · Pricing · Docs · Sign in

Hero:
  Give your AI accounts a real inbox and memory.
  Private AI messages, searchable archive, and MCP connector for ChatGPT + Claude.

  [Create your account] [Watch demo]

Right-side product card:
  New message from Claude
  HIGH · Agent Bridge
  Cloudflare deploy complete
  Actions: Open · Reply · Archive · Later
```

## Product explanation section

### Title

```txt
What you get when you sign up
```

### Cards

#### Private AI inbox

```txt
Receive messages from your connected AI assistants and workcells inside your chat workflow.
```

#### Persistent archive

```txt
Save important messages, specs, handoffs, and decisions into a durable private archive.
```

#### Vector memory

```txt
Promote selected messages into searchable semantic memory, scoped to your account and projects.
```

#### MCP connector

```txt
Get a private connector URL and setup instructions for ChatGPT, Claude, and future AI clients.
```

#### Profile dashboard

```txt
Manage your account, connectors, usage, memory, archives, and activation instructions.
```

## How it works section

```txt
1. Create your Message OS account.
2. Copy your private MCP connector URL.
3. Paste setup instructions into ChatGPT or Claude.
4. Let Message OS check your inbox at session start.
5. Open, reply, archive, or promote messages to memory.
```

## Pricing page section

### Trial

```txt
For testing the Message OS workflow.
Limited messages, limited archive, small memory allowance.
```

### Personal

```txt
For daily ChatGPT/Claude users who want persistent private memory.
Private inbox, archive, vector memory, and connector setup.
```

### Pro

```txt
For builders running projects, agents, and AI workcells.
More storage, routing, DriveMind exports, multiple workspaces, and larger vector memory.
```

### Team

```txt
For shared AI workspaces and multi-person workcells.
Team inboxes, admin controls, shared project memory.
```

## Signup flow

### Step 1 — Create account

Fields:

```txt
email
display_name
intended_use: personal | builder | team | enterprise
password / magic-link auth provider later
```

MVP can start as waitlist or manual provisioning:

```txt
email
name
intended use
```

### Step 2 — Create profile

Fields:

```txt
workspace_name
primary_ai_clients: ChatGPT, Claude, Perplexity, other
memory_default: off | archive_only | ask_to_vectorize
retention_default: keep_until_deleted | 30_days | 90_days | custom
```

### Step 3 — Choose plan

MVP can show:

```txt
Trial
Personal
Pro
Team / Contact us
```

Billing can be manual/placeholder before Stripe integration.

### Step 4 — Provision connector

System creates:

```txt
tenant_id
user_id
workspace_id
connector_token
vector_namespace
```

Dashboard displays:

```txt
MCP URL
Connector token status
Copy setup instructions
Run test
```

## Dashboard IA

Primary dashboard navigation:

```txt
Overview
Connector Setup
Inbox
Archive
Memory
Usage
Billing
Settings
```

## Dashboard — Overview

Show:

```txt
Account status
Plan
Default workspace
MCP connector status
Unread messages
Archived messages
Memory items
Monthly usage
```

Example cards:

```txt
Connector: Active
Unread messages: 3
Archive: 148 messages
Memory: 42 promoted items
Usage: 1,240 / 5,000 messages this month
```

## Dashboard — Connector Setup

Must include copy-paste blocks.

### MCP URL

```txt
https://message-os-cloud.agentfeedoptimization.com/mcp
```

### Connector token

Display only once if possible:

```txt
mos_live_••••••••••••abcd
```

### ChatGPT Project instructions

```txt
At the start or end of every substantive response, call Message OS triage_inbox.

If messages exist, tell me the sender, priority, and title. Ask whether to open, preview, reply, archive, ignore, or later.

Do not open full messages without approval.
Do not mark handled unless I choose ignore/archive/done.
```

### Claude Project instructions

```txt
At session boot, call Message OS triage_inbox.

If messages exist, summarize sender, priority, and title. Ask what to do.
Use propose_inbox_notification_frame when available.
Do not open full messages or mark messages handled without approval.
```

### Test button

```txt
Send test message
Check inbox
Create test frame
Archive test message
```

## Dashboard — Inbox

Show unified messages from:

```txt
human_message_hub
agent_bridge
future email/text/app integrations
```

Columns:

```txt
status
priority
sender
source
title
project
created_at
actions
```

Actions:

```txt
Open
Preview
Reply
Archive
Promote to memory
Ignore
Later
```

## Dashboard — Archive

Show archive bundles.

Columns:

```txt
subject
source
project
tags
archived_at
vectorized
export
```

Actions:

```txt
View markdown
View JSON
Download bundle
Promote to memory
Delete / tombstone
```

## Dashboard — Memory

Show vector memory items.

Features:

```txt
semantic search
filter by project
filter by source
filter by tag
show linked archive/message
remove from memory
```

Search placeholder:

```txt
Search your AI memory…
```

## Dashboard — Usage

Show:

```txt
messages this month
archives created
memory items
vector queries
embedding operations
storage estimate
plan limits
```

Warn users before costly operations:

```txt
Promoting this thread to vector memory uses embedding/storage quota.
```

## Dashboard — Billing

Show:

```txt
current plan
monthly price
usage limits
upgrade/downgrade
payment method
invoice history
```

MVP may show manual billing placeholder:

```txt
Billing is invite-only during early access.
```

## Dashboard — Settings

Settings:

```txt
profile
workspace name
default retention
default memory behavior
connector token rotation
export/delete account
```

## UI style direction

Use a clean, premium SaaS style:

```txt
AI-native Gmail + developer dashboard + private memory vault
```

Visual themes:

```txt
dark mode first
soft cards
clear status badges
copy buttons everywhere
minimal friction
mobile-friendly
```

## Landing page HTML wireframe

```html
<header>
  <div>Message OS Cloud</div>
  <nav>
    <a>How it works</a>
    <a>Pricing</a>
    <a>Docs</a>
    <a>Sign in</a>
  </nav>
</header>

<section class="hero">
  <div>
    <h1>Give your AI accounts a real inbox and memory.</h1>
    <p>Private AI messages, searchable archive, and MCP connector for ChatGPT + Claude.</p>
    <button>Create your account</button>
    <button>See how it works</button>
  </div>
  <aside class="message-card">
    <p>New message from Claude</p>
    <strong>Cloudflare deploy complete</strong>
    <p>High priority · Agent Bridge</p>
    <button>Open</button>
    <button>Reply</button>
    <button>Archive</button>
  </aside>
</section>

<section>
  <h2>What you get</h2>
  <div class="cards">
    <article>Private AI inbox</article>
    <article>Persistent archive</article>
    <article>Vector memory</article>
    <article>MCP connector</article>
  </div>
</section>
```

## MVP routes

```txt
GET  /                         landing page
GET  /pricing                  pricing page
GET  /signup                   signup page
POST /api/signup               create waitlist/account
GET  /dashboard                dashboard shell
GET  /dashboard/setup          connector setup
GET  /dashboard/inbox          inbox
GET  /dashboard/archive        archive
GET  /dashboard/memory         memory
POST /api/test-message         create test message
POST /api/create-connector     create connector token
POST /api/promote-memory       promote archive/message to memory
GET  /mcp                      MCP endpoint
POST /mcp                      MCP endpoint
```

## MVP acceptance criteria

1. Landing page explains product and CTA.
2. Signup form records waitlist/account intent.
3. Dashboard shows MCP URL and setup instructions.
4. Dashboard shows connector status.
5. User can send/check a test message.
6. User can see usage placeholders.
7. User understands that vector memory is paid/premium.

## Future UI extensions

```txt
team admin
shared workspaces
DriveMind mobile setup
Stripe portal
memory graph
message search
notification integrations
email/SMS/Slack/Discord bridges
```
