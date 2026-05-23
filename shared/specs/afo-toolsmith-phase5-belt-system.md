# AFO Toolsmith — Phase 5 Spec: Belt System

**from:** alice  
**to:** claude  
**date:** 2026-05-23  
**status:** ready-to-build  
**repo:** `nothinginfinity/afo-toolsmith`

---

## Overview

Belts are named bundles of connectors. A belt has a lifecycle (active / expired), an optional expiry date, and a shareable public URL. Jared can group his MCP connectors into belts by project, client, or use case — and share a single URL that gives anyone a read-only view of that belt's tools.

Phase 5 adds: D1 `belts` table, CRUD endpoints, a health-check endpoint, a public share URL, a cron job for auto-expiry, and a full Belts tab in the profile UI.

---

## New D1 Table

```sql
-- schema/phase5-belts.sql
CREATE TABLE IF NOT EXISTS belts (
  id              TEXT PRIMARY KEY,          -- 'belt_' + nanoid(10)
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,             -- display name
  description     TEXT DEFAULT '',
  connector_ids_json TEXT DEFAULT '[]',      -- JSON array of generated_connectors.id
  status          TEXT DEFAULT 'active',     -- 'active' | 'expired' | 'archived'
  lifetime_days   INTEGER,                   -- null = no expiry
  expires_at      TEXT,                      -- ISO datetime or null
  share_token     TEXT UNIQUE,               -- 'blt_' + nanoid(16) — for public URL
  metadata_json   TEXT DEFAULT '{}',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_belts_user        ON belts(user_id);
CREATE INDEX IF NOT EXISTS idx_belts_share_token ON belts(share_token);
CREATE INDEX IF NOT EXISTS idx_belts_status      ON belts(status);
```

Run migration:
```bash
wrangler d1 execute afo-toolsmith-db --file=schema/phase5-belts.sql
```

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/me/belts` | Bearer | List all belts for user |
| POST | `/api/me/belts` | Bearer | Create a new belt |
| GET | `/api/me/belts/:id` | Bearer | Get belt detail + connectors |
| PATCH | `/api/me/belts/:id` | Bearer | Update name, description, connectors, expiry |
| DELETE | `/api/me/belts/:id` | Bearer | Archive belt (soft delete) |
| POST | `/api/me/belts/:id/health-check` | Bearer | Check all connectors in belt |
| GET | `/api/belts/:share_token` | Public | Public belt view |

---

## Endpoint Logic

### POST /api/me/belts — Create

```js
const body = await request.json();
const { name, description, connector_ids, lifetime_days } = body;

if (!name?.trim()) return error(400, 'name required');

const id = 'belt_' + uid();
const shareToken = 'blt_' + uid(16);
const expiresAt = lifetime_days
  ? new Date(Date.now() + lifetime_days * 86400000).toISOString()
  : null;

await env.DB.prepare(
  `INSERT INTO belts (id, user_id, name, description, connector_ids_json, lifetime_days, expires_at, share_token)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
).bind(
  id, userId,
  name.trim(),
  description || '',
  JSON.stringify(connector_ids || []),
  lifetime_days || null,
  expiresAt,
  shareToken
).run();

return json({ id, share_token: shareToken, share_url: `https://afo-toolsmith.agentfeedoptimization.com/belt/${shareToken}`, expires_at: expiresAt });
```

### PATCH /api/me/belts/:id — Update

Allow partial updates: name, description, connector_ids, lifetime_days, status.
If `lifetime_days` is updated, recalculate `expires_at` from `created_at`.
Never allow patching `share_token` or `user_id`.

```js
const fields = [];
const vals = [];

if (body.name)            { fields.push('name = ?');                  vals.push(body.name); }
if (body.description !== undefined) { fields.push('description = ?'); vals.push(body.description); }
if (body.connector_ids)   { fields.push('connector_ids_json = ?');    vals.push(JSON.stringify(body.connector_ids)); }
if (body.status)          { fields.push('status = ?');                vals.push(body.status); }
if (body.lifetime_days !== undefined) {
  fields.push('lifetime_days = ?');
  vals.push(body.lifetime_days);
  const belt = await env.DB.prepare('SELECT created_at FROM belts WHERE id = ?').bind(beltId).first();
  const newExpiry = body.lifetime_days
    ? new Date(new Date(belt.created_at).getTime() + body.lifetime_days * 86400000).toISOString()
    : null;
  fields.push('expires_at = ?');
  vals.push(newExpiry);
}

fields.push('updated_at = datetime(\'now\')');
vals.push(beltId, userId);

await env.DB.prepare(
  `UPDATE belts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
).bind(...vals).run();
```

### POST /api/me/belts/:id/health-check

For each connector in the belt, attempt a HEAD/GET to its connector_url and record reachability.

```js
const belt = await env.DB.prepare(
  'SELECT * FROM belts WHERE id = ? AND user_id = ?'
).bind(beltId, userId).first();

const connectorIds = JSON.parse(belt.connector_ids_json || '[]');
const results = await Promise.allSettled(
  connectorIds.map(async (cid) => {
    const conn = await env.DB.prepare(
      'SELECT id, name, connector_url FROM generated_connectors WHERE id = ?'
    ).bind(cid).first();
    if (!conn) return { id: cid, status: 'not_found' };
    try {
      const res = await fetch(conn.connector_url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return { id: cid, name: conn.name, url: conn.connector_url, status: res.ok ? 'reachable' : 'error', http: res.status };
    } catch (e) {
      return { id: cid, name: conn.name, url: conn.connector_url, status: 'unreachable', error: e.message };
    }
  })
);

const checks = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error' });
const allOk = checks.every(c => c.status === 'reachable');

return json({ belt_id: beltId, checked_at: new Date().toISOString(), all_healthy: allOk, connectors: checks });
```

### GET /api/belts/:share_token — Public view

No auth required. Returns belt name, description, status, expiry, and connector list (name + url only, no internal IDs).

```js
const belt = await env.DB.prepare(
  `SELECT b.*, b.connector_ids_json FROM belts b WHERE b.share_token = ? AND b.status != 'archived'`
).bind(shareToken).first();

if (!belt) return error(404, 'Belt not found');

if (belt.expires_at && new Date(belt.expires_at) < new Date()) {
  return json({ expired: true, name: belt.name, expired_at: belt.expires_at });
}

const connectorIds = JSON.parse(belt.connector_ids_json || '[]');
const connectors = connectorIds.length
  ? await env.DB.prepare(
      `SELECT name, connector_url, status FROM generated_connectors WHERE id IN (${connectorIds.map(() => '?').join(',')})`
    ).bind(...connectorIds).all()
  : { results: [] };

return json({
  name: belt.name,
  description: belt.description,
  status: belt.status,
  expires_at: belt.expires_at,
  share_url: `https://afo-toolsmith.agentfeedoptimization.com/belt/${shareToken}`,
  connectors: connectors.results.map(c => ({ name: c.name, url: c.connector_url, status: c.status }))
});
```

---

## Cron: Auto-expiry

Add a `scheduled` handler to expire belts past their `expires_at`:

```js
export default {
  async fetch(request, env, ctx) { /* existing router */ },

  async scheduled(event, env, ctx) {
    // Auto-expire belts
    await env.DB.prepare(
      `UPDATE belts SET status = 'expired', updated_at = datetime('now')
       WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at < datetime('now')`
    ).run();

    // FUTURE: FP-2 hook — notify user's agent_bridge when a belt expires
  }
};
```

Add cron trigger to `wrangler.toml`:
```toml
[triggers]
crons = ["0 * * * *"]   # run every hour
```

---

## Profile UI — Belts Tab

Add a **Belts** tab between Connectors and Tools in the nav.

### Belt list view

```
┌─ MY BELTS ───────────────────── [+ New Belt] ┐
│                                                │
│  ● AGI Dev Stack                   active      │
│  4 connectors · no expiry · 🔗 share         │
│                                                │
│  ● Cloudflare Tools               active      │
│  2 connectors · expires Jun 1 · 🔗 share     │
│                                                │
│  ○ kv-test-belt                  expired      │
│  1 connector · expired May 20                  │
└────────────────────────────────────────────┘
```

### New belt form (modal or inline expand)

```
Belt name: [________________]
Description: [________________]
Expiry: [ None ▼ ]  (None / 7 days / 30 days / 90 days / custom)

Connectors:
[ ] KV Manager MCP          live
[ ] Vector DB Builder       building
[x] Cloudflare Tools MCP    live
[x] AFO Toolsmith           live

[Create Belt]
```

### Belt detail view (tap a belt)

```
┌─ AGI DEV STACK ───────────────────── active ┐
│                                                │
│  Share URL                                     │
│  afo-toolsmith.afo.../belt/blt_xxxxx           │
│  [Copy Link] [Health Check]                    │
│                                                │
│  CONNECTORS                                    │
│  • KV Manager MCP        ✓ reachable           │
│  • Cloudflare Tools      ✓ reachable           │
│  • AFO Toolsmith         ✓ reachable           │
│                                                │
│  Expires: never  ·  Created: May 23            │
│  [Edit] [Archive]                              │
└────────────────────────────────────────────┘
```

### Public belt page (GET /belt/:share_token)

A minimal read-only HTML page served by the worker at that route. No auth. Shows:
- Belt name + description
- Connector list (name + URL + status pill)
- Expiry notice if applicable
- "Powered by AFO Toolsmith" footer

---

## MCP Tool: manage_belt

Add a 5th tool to `/mcp`:

```js
{
  name: 'manage_belt',
  description: 'Create, update, or list belts. Belts are named bundles of MCP connectors with optional expiry and a shareable public URL.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'create', 'update', 'health_check'], description: 'Action to perform' },
      belt_id: { type: 'string', description: 'Belt ID for update/health_check' },
      name: { type: 'string', description: 'Belt name (for create/update)' },
      description: { type: 'string', description: 'Belt description' },
      connector_ids: { type: 'array', items: { type: 'string' }, description: 'Connector IDs to include' },
      lifetime_days: { type: 'number', description: 'Days until expiry (omit for no expiry)' }
    },
    required: ['action']
  }
}
```

---

## Live card update from Phase 4

In the Generate tab Live card, add a **"+ Add to Belt"** button below **Copy URL**:

```html
<!-- BELT_HOOK from Phase 4 -->
<button onclick="showAddToBeltModal(connectorId)">+ Add to Belt</button>
```

Modal: shows existing belt list with checkboxes. On confirm, calls `PATCH /api/me/belts/:id` to add connector.

---

## Stats card update

Update the Overview tab stats row to include Belts:

```
[ 4 projects ] [ 4 connectors ] [ 2 belts ] [ 1 specs ]
```

Query: `SELECT COUNT(*) FROM belts WHERE user_id = ? AND status = 'active'`

---

## Deploy + Verify

```bash
# Run migration
wrangler d1 execute afo-toolsmith-db --file=schema/phase5-belts.sql

# Deploy
wrangler deploy workers/afo-toolsmith/worker.js
```

**Test sequence:**
```
POST /api/me/belts
{ "name": "AGI Dev Stack", "connector_ids": ["conn_xxx", "conn_yyy"], "lifetime_days": 30 }
→ { id: 'belt_xxx', share_token: 'blt_xxx', share_url: '...', expires_at: '2026-06-22...' }

GET /api/belts/blt_xxx   (no auth)
→ { name: 'AGI Dev Stack', connectors: [...], expires_at: '...' }

POST /api/me/belts/belt_xxx/health-check
→ { all_healthy: true, connectors: [{ status: 'reachable' }, ...] }

GET /belt/blt_xxx  (public HTML page)
→ renders public belt view
```

---

## Post-phase

Post `BLT-008` confirming:
- `belts` table migrated
- All endpoints live
- Public share URL working
- Health check verified
- Belts tab in UI
- Phase 6 ready flag

Reply to `alice/inbox.md`.

---

## Future Extension Points

```js
// FUTURE: FP-2 hook — Agent Bridge
// On belt create/update, broadcast to user's agent_bridge bulletin
// so linked spaces see which connector bundles are active.

// FUTURE: FP-3 hook — Marketplace
// Public belt page gets an "Install all connectors" button.
// Installs each connector in the belt to the viewer's profile.

// FUTURE: FP-1 hook — Instruction Factory
// Belt share URL can be embedded in boot instructions:
// "Load belt at https://afo-toolsmith.../belt/blt_xxx before starting."
```
