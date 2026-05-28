# Toolsmith MCP Metering & Billing Layer — Spec v0.1

**Author:** Alice (Perplexity)
**Date:** 2026-05-27
**Status:** Draft — Ready for review by Jared + ChatGPT
**Depends on:** toolsmith-tool-inventory.md, afo-mobile-mcp-protocol (stable)
**Related specs:** toolsmith-builder-mcp-v0.1.md, toolsmith-tool-inventory.md

---

## Vision

Toolsmith becomes the **AWS of MCP tools** — every tool call is logged, metered, and billable. Tool authors earn revenue from usage. Users pay per call or by subscription. The AI platform (ChatGPT, Claude) is just the surface; Toolsmith owns the billing relationship.

This is the **metering + billing layer** that sits underneath all AFO and Message OS MCP Workers. It does not require OpenAI or Anthropic to build anything. It runs entirely on Cloudflare Workers + D1 + your existing MCP infrastructure.

---

## What Can Be Built Today (No Ecosystem Buy-In Needed)

| Capability | Built where | Status |
|---|---|---|
| Per-call usage logging (tool, account, timestamp, latency) | Every Worker | ✅ Add middleware now |
| API key issuance + validation | `toolsmith-metering-mcp` + D1 | New Worker |
| Per-key call counting + rate limiting | `toolsmith-metering-mcp` | New Worker |
| Wallet / credit balance enforcement | `toolsmith-metering-mcp` + D1 | New Worker |
| Usage dashboard (top tools, worst tools, spend) | `toolsmith-metering-web` | New Worker |
| `usage_cost` field in tool responses | All metered Workers | Add to response shape |
| Tool revenue share accounting | `toolsmith-metering-mcp` D1 | New logic |
| Email billing alerts (low balance, quota hit) | `resend-email-mcp` | Connect existing |

## What Requires Ecosystem Buy-In (Future)

| Capability | Requires |
|---|---|
| Platform pays tool providers directly | OpenAI/Anthropic payment passthrough protocol (doesn't exist yet) |
| Per-session billing from ChatGPT to your Worker | OpenAI billing API for MCP (not built) |
| OAuth identity from ChatGPT to identify users | OpenAI MCP OAuth (partial — exists but not universal) |

**Strategy:** Build everything in column 1 now. Design the data model so column 2 plugs in later as a payment rail, not a rewrite.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  AI Client (ChatGPT / Claude / Alice / Perplexity)       │
│  passes: X-API-Key header (or api_key in tool params)    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Any AFO MCP Worker (e.g. message-os-cloud-social-mcp)  │
│                                                          │
│  1. Extract API key from request                        │
│  2. Call validate_key() → toolsmith-metering-mcp        │
│  3. If invalid/over-quota → return 402/429 error         │
│  4. Execute tool                                         │
│  5. Log usage (fire-and-forget) → toolsmith-metering-mcp │
│  6. Return result + usage_cost in _meta                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  toolsmith-metering-mcp (new Worker)                    │
│  D1: toolsmith-metering-db                              │
│                                                          │
│  Tables: api_keys, usage_events, wallets, tool_pricing   │
│  Tools: validate_key, log_usage, get_usage_summary,      │
│         create_api_key, get_balance, top_up_credits       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  toolsmith-metering-web (new Worker / dashboard)         │
│  Routes: /dashboard, /usage, /api-keys, /billing         │
│  Shows: call volume, cost, top tools, error rates,        │
│         revenue share (future), wallet balance            │
└─────────────────────────────────────────────────────────┘
```

---

## D1 Schema: `toolsmith-metering-db`

```sql
-- API keys issued to accounts / agents
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,              -- uuid
  account_id TEXT NOT NULL,         -- owner (jared, alice, claude, pilot-user-001, etc.)
  key_hash TEXT NOT NULL UNIQUE,    -- SHA-256 of the actual key (never store plaintext)
  label TEXT,                       -- human-readable label
  tier TEXT NOT NULL DEFAULT 'free', -- free | pilot | paid | internal
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | revoked
  rate_limit_per_minute INTEGER DEFAULT 60,
  monthly_quota INTEGER DEFAULT 1000,   -- NULL = unlimited
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT                    -- NULL = no expiry
);

-- Every tool call logged here
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,              -- uuid
  api_key_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,        -- e.g. 'message-os-cloud-social-mcp'
  tool_name TEXT NOT NULL,          -- e.g. 'check_inbox'
  called_at TEXT NOT NULL DEFAULT (datetime('now')),
  latency_ms INTEGER,
  status TEXT NOT NULL,             -- success | error | rate_limited | quota_exceeded
  error_code TEXT,
  credits_charged INTEGER DEFAULT 0, -- credits deducted for this call
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

-- Credit wallets (one per account)
CREATE TABLE wallets (
  account_id TEXT PRIMARY KEY,
  balance_credits INTEGER NOT NULL DEFAULT 0,
  total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-tool pricing (credits per call)
CREATE TABLE tool_pricing (
  id TEXT PRIMARY KEY,
  worker_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  credits_per_call INTEGER NOT NULL DEFAULT 1,
  tier_overrides TEXT,  -- JSON: { "free": 2, "paid": 1, "internal": 0 }
  enabled INTEGER NOT NULL DEFAULT 1,
  UNIQUE(worker_name, tool_name)
);

-- Aggregate daily rollups (for dashboard performance)
CREATE TABLE usage_daily (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  call_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  UNIQUE(account_id, worker_name, tool_name, date)
);

CREATE INDEX idx_usage_events_account ON usage_events(account_id, called_at);
CREATE INDEX idx_usage_events_tool ON usage_events(worker_name, tool_name, called_at);
CREATE INDEX idx_usage_events_key ON usage_events(api_key_id, called_at);
```

---

## New Worker: `toolsmith-metering-mcp`

**Domain:** `toolsmith-metering-mcp.agentfeedoptimization.com/mcp`
**Protocol:** AFO Mobile MCP Protocol (standard POST /mcp)
**D1 binding:** `METERING_DB` → `toolsmith-metering-db`

### Tools

#### `metering_status`
Standard health/status tool (mandatory per AFO doctrine).
```json
{ "name": "metering_status", "description": "Returns metering service status and version" }
```

#### `validate_key`
Called by other Workers before executing a tool. Returns key validity, tier, and rate limit state.
```json
{
  "name": "validate_key",
  "inputSchema": {
    "type": "object",
    "properties": {
      "api_key": { "type": "string" },
      "worker_name": { "type": "string" },
      "tool_name": { "type": "string" }
    },
    "required": ["api_key", "worker_name", "tool_name"]
  }
}
```
**Returns:**
```json
{
  "valid": true,
  "account_id": "jared",
  "tier": "internal",
  "credits_per_call": 0,
  "rate_limit_remaining": 59,
  "quota_remaining": null,
  "allowed": true
}
```
If `allowed: false`, calling Worker returns MCP error with code `402` (insufficient credits) or `429` (rate limited).

#### `log_usage`
Fire-and-forget. Called after every tool execution to record the event.
```json
{
  "name": "log_usage",
  "inputSchema": {
    "properties": {
      "api_key_id": { "type": "string" },
      "account_id": { "type": "string" },
      "worker_name": { "type": "string" },
      "tool_name": { "type": "string" },
      "latency_ms": { "type": "integer" },
      "status": { "type": "string" },
      "error_code": { "type": "string" },
      "credits_charged": { "type": "integer" }
    },
    "required": ["api_key_id", "worker_name", "tool_name", "status"]
  }
}
```

#### `create_api_key`
Admin tool. Issues a new API key for an account.
```json
{
  "name": "create_api_key",
  "inputSchema": {
    "properties": {
      "account_id": { "type": "string" },
      "label": { "type": "string" },
      "tier": { "type": "string", "enum": ["free", "pilot", "paid", "internal"] },
      "rate_limit_per_minute": { "type": "integer" },
      "monthly_quota": { "type": "integer" }
    },
    "required": ["account_id", "tier"]
  }
}
```
**Returns:** `{ api_key: "sk-afo-...", api_key_id: "uuid" }` — plaintext key shown ONCE, then only hash stored.

#### `get_usage_summary`
Returns aggregated usage for an account or a specific tool.
```json
{
  "name": "get_usage_summary",
  "inputSchema": {
    "properties": {
      "account_id": { "type": "string" },
      "worker_name": { "type": "string" },
      "tool_name": { "type": "string" },
      "period": { "type": "string", "enum": ["today", "7d", "30d", "all"] }
    },
    "required": ["account_id"]
  }
}
```
**Returns:** call counts, error rates, avg latency, credits used, top tools by volume, worst tools by error rate.

#### `get_balance`
```json
{
  "name": "get_balance",
  "inputSchema": {
    "properties": { "account_id": { "type": "string" } },
    "required": ["account_id"]
  }
}
```

#### `set_tool_pricing`
Admin. Set credits per call for a specific tool.
```json
{
  "name": "set_tool_pricing",
  "inputSchema": {
    "properties": {
      "worker_name": { "type": "string" },
      "tool_name": { "type": "string" },
      "credits_per_call": { "type": "integer" },
      "tier_overrides": { "type": "object" }
    },
    "required": ["worker_name", "tool_name", "credits_per_call"]
  }
}
```

#### `list_top_tools`
Returns usage leaderboard — most-called tools, highest error rates, slowest tools.
```json
{
  "name": "list_top_tools",
  "inputSchema": {
    "properties": {
      "period": { "type": "string", "enum": ["today", "7d", "30d"] },
      "sort_by": { "type": "string", "enum": ["calls", "errors", "latency", "credits"] },
      "limit": { "type": "integer", "default": 20 }
    }
  }
}
```

---

## Middleware: Adding Metering to Existing Workers

Every AFO Worker gets a **metering middleware** block inserted at the start of `tools/call` handling. This is a ~30-line addition:

```typescript
// Metering middleware — add to every metered Worker
async function meteringCheck(
  apiKey: string | null,
  workerName: string,
  toolName: string,
  meteringUrl: string
): Promise<{ allowed: boolean; account_id: string; api_key_id: string; credits_per_call: number; error?: string }> {
  if (!apiKey) {
    return { allowed: false, account_id: 'anonymous', api_key_id: '', credits_per_call: 0, error: 'no_api_key' };
  }
  const resp = await fetch(`${meteringUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'validate_key', arguments: { api_key: apiKey, worker_name: workerName, tool_name: toolName } }
    })
  });
  const data = await resp.json();
  return data.result?.content?.[0]?.parsed ?? { allowed: false, error: 'metering_unavailable' };
}

// Fire-and-forget usage log — does NOT block tool response
function logUsage(meteringUrl: string, payload: object): void {
  fetch(`${meteringUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'log_usage', arguments: payload }
    })
  }).catch(() => {}); // intentionally fire-and-forget
}
```

### In each tool handler:
```typescript
case 'tools/call': {
  const apiKey = req.headers.get('X-API-Key') ?? params.arguments?.api_key ?? null;
  const start = Date.now();
  let meteringResult;

  // Phase 1: internal keys bypass metering (METERING_ENABLED binding = false)
  if (env.METERING_ENABLED === 'true') {
    meteringResult = await meteringCheck(apiKey, 'message-os-cloud-social-mcp', params.name, env.METERING_URL);
    if (!meteringResult.allowed) {
      return jsonRpcError(params.id, meteringResult.error === 'no_credits' ? 402 : 429, meteringResult.error);
    }
  }

  // Execute tool normally
  const result = await executeToolCall(params, env);
  const latency = Date.now() - start;

  // Fire-and-forget log
  if (env.METERING_ENABLED === 'true' && meteringResult) {
    logUsage(env.METERING_URL, {
      api_key_id: meteringResult.api_key_id,
      account_id: meteringResult.account_id,
      worker_name: 'message-os-cloud-social-mcp',
      tool_name: params.name,
      latency_ms: latency,
      status: result.isError ? 'error' : 'success',
      credits_charged: meteringResult.credits_per_call
    });
  }

  // Add usage_cost to _meta
  result._meta = {
    ...result._meta,
    usage_cost: { credits: meteringResult?.credits_per_call ?? 0, currency: 'afo-credits' }
  };

  return jsonRpcResult(params.id, result);
}
```

### Wrangler bindings to add to every metered Worker:
```toml
[vars]
METERING_ENABLED = "false"   # flip to "true" when metering Worker is live
METERING_URL = "https://toolsmith-metering-mcp.agentfeedoptimization.com"
```

---

## `usage_cost` Field in Tool Responses

Every metered tool response gains a `_meta.usage_cost` field:

```json
{
  "content": [{ "type": "text", "text": "You have 2 unread messages." }],
  "_meta": {
    "usage_cost": {
      "credits": 1,
      "currency": "afo-credits",
      "balance_remaining": 842,
      "tier": "pilot"
    }
  }
}
```

Agents can read this and surface spend information. ChatGPT Widgets can render a live balance display. Other MCP clients ignore `_meta`.

---

## Pricing Model: AFO Credits

### Credit tiers (default, configurable via `set_tool_pricing`):

| Tool type | Example | Credits/call |
|---|---|---|
| Status / health | `metering_status`, `whoami` | 0 |
| Read / query | `check_inbox`, `list_contacts`, `get_usage_summary` | 1 |
| Write / mutate | `send_message`, `create_api_key`, `deploy_worker` | 2 |
| AI-intensive | `generate_tool_spec`, `compose_worker_site` | 5 |
| Batch / expensive | `commit_manifest_atomic`, `run_smoke_tests` | 10 |

### Account tiers:

| Tier | Monthly quota | Rate limit | Notes |
|---|---|---|---|
| `free` | 100 calls | 10/min | Public / unauthenticated |
| `pilot` | 5,000 calls | 60/min | Invite-only early users |
| `paid` | Unlimited (wallet-gated) | 120/min | Credit wallet required |
| `internal` | Unlimited | Unlimited | Jared + agents |

### Internal keys (Jared + agents) always `tier: internal` — 0 credits, no rate limit.

---

## Usage Dashboard: `toolsmith-metering-web`

**Domain:** `metering.agentfeedoptimization.com` (or `usage.toolsmith.agentfeedoptimization.com`)

### Pages:

1. **Overview** — Total calls today / this week / this month. Top 10 tools by volume. Error rate graph.
2. **Tools** — Per-tool leaderboard: calls, errors, avg latency, credits generated. Sort by any column.
3. **Accounts** — Per-key usage: calls, credits used, balance remaining, last seen.
4. **Pricing** — View / edit credits-per-call per tool. Tier override table.
5. **API Keys** — Create / revoke keys. Assign tiers. Show key prefix only (never full key).
6. **Billing** (future) — Stripe integration, credit top-up, invoice history.

Dashboard is Jared-only for now. Authentication: simple API-key-in-URL or basic auth header.

---

## API Key Format

```
sk-afo-{tier_prefix}-{random_32_chars}

Examples:
  sk-afo-int-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6   ← internal
  sk-afo-plt-z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4   ← pilot
  sk-afo-free-...                                 ← free
```

How agents pass the key:
- **Option A (preferred):** HTTP header: `X-API-Key: sk-afo-int-...`
- **Option B (fallback):** Tool parameter: `{ ..., "api_key": "sk-afo-int-..." }`

ChatGPT passes headers when the App is registered with auth. Claude supports custom headers. For no-header clients, Option B works.

---

## Rollout Plan

### Phase 1 — Logging Only (no enforcement) 🔨
1. Claude deploys `toolsmith-metering-mcp` Worker + creates `toolsmith-metering-db` D1
2. Run D1 migration with schema above
3. Alice adds `METERING_ENABLED=false` + `METERING_URL` bindings to all active Workers
4. Alice updates tool handler template to include fire-and-forget `logUsage()` call
5. All tool calls start logging to D1 with no blocking
6. Jared verifies usage_events are accumulating

### Phase 2 — Enforcement + API Keys 🔒
1. Jared creates internal keys for himself, Alice, Claude via `create_api_key`
2. Agent harnesses updated to include `X-API-Key` in MCP calls
3. Claude flips `METERING_ENABLED=true` on one Worker (e.g. `message-os-cloud-social-mcp`)
4. Smoke test: call with valid key → success + usage logged; call with no key → 402
5. Jared confirms dashboard shows call counts
6. Roll enforcement out to remaining Workers one at a time

### Phase 3 — Wallet + Credits 💳
1. Add `wallets` table and credit deduction logic to `toolsmith-metering-mcp`
2. Issue pilot API keys with credit budgets to first external users
3. Implement low-balance email alert via `resend-email-mcp`
4. Add credit balance widget to Message OS dashboard

### Phase 4 — Billing Rail (future) 💰
1. Stripe integration on `toolsmith-metering-web`
2. Credit top-up flow (buy X credits)
3. Invoice export
4. Revenue share ledger for external tool authors
5. (When available) OpenAI/Anthropic payment passthrough hookup

---

## The "Tool Quality" Incentive Loop

The usage data creates a natural quality enforcement mechanism:

```
high error rate → visible in dashboard → fix or deprecate
low latency     → promoted in Toolsmith catalogue
high usage      → revenue for tool author (Phase 4)
zero usage      → candidate for deprecation
```

This is the AWS Lambda model: tools earn their keep through actual usage. Tools that break accumulate error rates. Tools that are fast and reliable earn more calls.

The `list_top_tools` leaderboard sorted by `calls` IS the organic quality signal — no manual curation needed.

---

## Implementation Assignment

| Task | Owner |
|------|-------|
| Deploy `toolsmith-metering-mcp` Worker | Claude |
| Create + migrate `toolsmith-metering-db` D1 | Claude |
| Add `METERING_ENABLED` + `METERING_URL` bindings to all active Workers | Claude |
| Update Worker source template with metering middleware | Alice |
| Add `usage_cost` to AFO Mobile MCP Protocol spec | Alice |
| Build `toolsmith-metering-web` dashboard | Claude + Alice |
| Create internal API keys for agents | Jared |
| Update agent harnesses to pass `X-API-Key` | Alice |
| Phase 1 smoke test: verify events are logging | Jared |

---

## Acceptance Criteria (Phase 1)

- [ ] `GET /health` on `toolsmith-metering-mcp` returns 200 with version
- [ ] `validate_key` returns `allowed: true` for valid internal key
- [ ] `validate_key` returns `allowed: false` for unknown key (when METERING_ENABLED=true)
- [ ] `log_usage` writes a row to `usage_events` D1 table
- [ ] Calling `check_inbox` on social MCP with valid key → usage_events row appears
- [ ] `get_usage_summary` returns accurate call count for account
- [ ] `list_top_tools` returns leaderboard sorted by calls
- [ ] Tool response includes `_meta.usage_cost.credits`

---

## Version

- v0.1 — 2026-05-27 — Initial draft by Alice
- Next: v0.2 after Phase 1 logging is live and D1 events confirmed
