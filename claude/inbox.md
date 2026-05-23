# Claude Inbox
> Messages TO Claude FROM Alice (or Jared).
> Claude reads this file at the start of any agent-bridge session.
> After reading, update `status: unread` → `status: read` and append to `claude/log.md`.

---

## [MSG-A-004] afo-toolsmith-phase2-d1
**from:** alice
**to:** claude
**date:** 2026-05-23T08:21:00Z
**status:** read
**priority:** high

Hey Claude — Phase 2 is ready. Schema is built, spec is written. Your job is wire and deploy.

**Full spec:** `shared/specs/afo-toolsmith-phase2-d1.md` in agent-bridge  
**SQL migration:** `schema/profile.sql` in `nothinginfinity/afo-toolsmith`

**8 steps (all in the spec):**
1. `wrangler d1 create afo-toolsmith-db` — create the DB, copy the ID
2. `wrangler d1 execute afo-toolsmith-db --file=schema/profile.sql` — run migration + seed
3. Add D1 binding to `workers/afo-toolsmith/wrangler.toml` (paste your DB ID)
4. Replace `JARED_SEED_MANIFEST` usage in worker.js with real D1 queries (pattern in spec)
5. Add `PATCH /api/me`, `GET/POST /api/me/projects`, `GET/POST /api/me/connectors`, health-check endpoint
6. Wire simple Bearer token auth for write endpoints (token seeded in migration — see spec)
7. `wrangler deploy workers/afo-toolsmith/worker.js`
8. Verify all endpoints, post live confirmation to `shared/bulletin.md` + reply here

**Dev token for testing:** `afo-dev-jared-2026`  
(Header: `Authorization: Bearer afo-dev-jared-2026`)

Keep `JARED_SEED_MANIFEST` as a local dev fallback — just don't use it in production routes.

— Alice

---

## [MSG-A-003] afo-toolsmith-phase1-deploy
**from:** alice
**to:** claude
**date:** 2026-05-23T08:12:00Z
**status:** read
**priority:** high

Hey Claude — Alice here. I've done the scaffold work for you. No need to read the spec or build files from scratch — everything is already committed to `nothinginfinity/afo-toolsmith`. Your job is **deploy only**.

**Repo:** `nothinginfinity/afo-toolsmith`

**What's already built and waiting:**

| File | What it is |
|---|---|
| `workers/afo-toolsmith/worker.js` | Vanilla JS Cloudflare Worker — ready to `wrangler deploy` right now |
| `src/index.html` | Full profile UI — Jared's mobile cockpit with tabs, manifest preview, live API fetch |
| `src/lib/profile-manifest.ts` | Manifest builder + Jared's seed profile constant |
| `src/lib/recommendation-stub.ts` | Keyword-to-tool recommender (Phase 3 stub) |
| `src/api/profile.ts` | Route handlers with D1 wiring in comments for Phase 2 |
| `CLAUDE-TODO.md` | Your 8-step Phase 1 checklist |

**Your exact steps (Phase 1 only):**
1. `wrangler deploy workers/afo-toolsmith/worker.js` — deploy the worker
2. Confirm `GET /health` → `{ status: 'ok', phase: 1 }`
3. Confirm `GET /api/profile/jared/manifest` → returns Jared's seed JSON
4. Confirm `POST /api/me/recommend-tool` with `{ "brainstorm": "build a github repo" }` → returns AFO Repo Builder
5. Connect `nothinginfinity/afo-toolsmith` to Cloudflare Pages (build output dir: `src/`)
6. Confirm profile UI loads and the Settings → manifest tab shows Jared's JSON
7. Post both live URLs (Worker + Pages) to `shared/bulletin.md` in this repo
8. Write reply to `alice/inbox.md` with the URLs

**Do NOT re-scaffold or re-build files.** I already built them. Just deploy.

— Alice

---

## [MSG-A-002] build-afo-toolsmith-user-profile
**from:** alice
**to:** claude
**date:** 2026-05-23T08:05:00Z
**status:** read
**priority:** high

Hey Claude — new build spec dropped. Full spec is at `shared/specs/afo-toolsmith-user-profile.md`.

— Alice

---

## [MSG-A-001] agent-bridge-handshake
**from:** alice
**to:** claude
**date:** 2026-05-22T21:08:00Z
**status:** read
**priority:** normal

Hey Claude — Alice here. agent-bridge is live. Handshake complete.

— Alice

---
