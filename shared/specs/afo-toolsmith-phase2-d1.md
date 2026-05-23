# AFO Toolsmith — Phase 2 Spec: D1 Persistence

**from:** alice  
**to:** claude  
**date:** 2026-05-23  
**status:** ready-to-build  
**repo:** `nothinginfinity/afo-toolsmith`

---

## Overview

Wire the live D1 database into the worker so Jared's profile is stored in real rows, not a seed constant. Phase 2 adds:

1. D1 database creation + migration
2. Jared's seed row inserted at migration time
3. Worker bindings updated
4. All API endpoints reading from D1 instead of `JARED_SEED_MANIFEST`
5. `PATCH /api/me` for profile edits
6. `GET/POST /api/me/projects` for project management
7. `GET/POST /api/me/connectors` + health-check endpoint

---

## Step 1 — Create the D1 database

```bash
wrangler d1 create afo-toolsmith-db
```

Copy the database ID from the output — you'll need it for `wrangler.toml`.

---

## Step 2 — Run the migration

The full SQL is in `schema/profile.sql` in this repo. Run it:

```bash
wrangler d1 execute afo-toolsmith-db --file=schema/profile.sql
```

This creates all tables AND seeds Jared's profile row in one shot.

---

## Step 3 — Update wrangler.toml

Add this block to `workers/afo-toolsmith/wrangler.toml` (create the file if it doesn't exist):

```toml
name = "afo-toolsmith"
main = "worker.js"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "DB"
database_name = "afo-toolsmith-db"
database_id = "PASTE_YOUR_DB_ID_HERE"
```

---

## Step 4 — Replace the seed manifest with D1 queries

In `workers/afo-toolsmith/worker.js`, replace the `JARED_SEED_MANIFEST` constant usage with real D1 calls.

The pattern for each endpoint:

### GET /api/profile/:handle/manifest

```js
const user = await env.DB.prepare(
  'SELECT * FROM users WHERE handle = ? AND active = 1'
).bind(handle).first();
if (!user) return json({ error: 'Profile not found' }, 404);

const prefs = await env.DB.prepare(
  'SELECT * FROM user_preferences WHERE user_id = ?'
).bind(user.id).first();

const { results: projects } = await env.DB.prepare(
  'SELECT * FROM user_projects WHERE user_id = ? AND status = ?'
).bind(user.id, 'active').all();

const { results: tools } = await env.DB.prepare(
  'SELECT * FROM generated_connectors WHERE user_id = ? AND status != ?'
).bind(user.id, 'deleted').all();

return json(buildManifest(user, prefs, projects, tools));
```

### PATCH /api/me

Accepts partial updates. Supported fields:
- `display_name`, `headline`, `avatar_emoji` → update `users` table
- `primary_device`, `preferred_runtime`, `preferred_source_control` → update `user_preferences`
- `metadata_json` fields (`preferred_agents`) → merge into existing JSON

Always update `users.updated_at = datetime('now')` on any write.

Return the full updated manifest after patching.

### GET /api/me/projects

```js
const { results } = await env.DB.prepare(
  'SELECT * FROM user_projects WHERE user_id = ? ORDER BY created_at DESC'
).bind(userId).all();
return json({ projects: results });
```

### POST /api/me/projects

Insert a new row into `user_projects`. Required body fields: `name`. Optional: `status`, `metadata_json`.

Generate `id` as `proj_` + nanoid(10).

### GET /api/me/connectors

```js
const { results } = await env.DB.prepare(
  'SELECT * FROM generated_connectors WHERE user_id = ? AND status != ? ORDER BY created_at DESC'
).bind(userId, 'deleted').all();
return json({ connectors: results });
```

### POST /api/me/connectors/:id/health-check

Fetch `HEAD connector_url` with 5s timeout. Update `last_checked_at` and `status` ('ready' or 'unreachable'). Return `{ connector_url, status, checked_at }`.

---

## Step 5 — Auth (simple token for now)

For `/api/me` and write endpoints, check for a Bearer token in the `Authorization` header:

```js
const auth = request.headers.get('Authorization') || '';
const token = auth.replace('Bearer ', '').trim();
const row = await env.DB.prepare(
  'SELECT user_id FROM api_tokens WHERE token_hash = ? AND revoked = 0'
).bind(sha256hex(token)).first();
if (!row) return json({ error: 'Unauthorized' }, 401);
const userId = row.user_id;
```

Jared's dev token is in `schema/profile.sql` (seeded as a known hash). Use it for testing. We'll add Cloudflare Access in Phase 4.

---

## Step 6 — Redeploy

```bash
wrangler deploy workers/afo-toolsmith/worker.js
```

---

## Step 7 — Verify

- `GET /api/profile/jared/manifest` → returns live D1 data (not seed constant)
- `PATCH /api/me` with `{ "headline": "Updated from D1" }` → returns updated manifest
- `POST /api/me/projects` with `{ "name": "Test Project" }` → creates row, returns project
- `GET /api/me/projects` → returns the new project
- Profile UI Settings tab → manifest preview shows live D1 data

---

## Step 8 — Post status

Post live confirmation to `shared/bulletin.md` and write reply to `alice/inbox.md` with:
- Confirmation D1 is wired
- Jared's dev token (or confirm it's in D1)
- Any schema changes you made
- Phase 3 ready flag

---

## Notes

- Keep `JARED_SEED_MANIFEST` in the worker as a fallback for local dev (`wrangler dev` without D1 binding)
- The `buildManifest()` function in `src/lib/profile-manifest.ts` already handles the D1 row → manifest mapping — reference it for the vanilla JS port in worker.js
- `metadata_json` columns store JSON strings — always `JSON.parse()` before reading, `JSON.stringify()` before writing
- D1 does not support `RETURNING` in all versions — do a SELECT after INSERT to get the new row
