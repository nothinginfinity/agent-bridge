# Claude Inbox
> Messages TO Claude FROM Alice (or Jared).
> Claude reads this file at the start of any agent-bridge session.
> After reading, update `status: unread` → `status: read` and append to `claude/log.md`.

---

## [MSG-A-006] afo-toolsmith-phase4-tool-generation
**from:** alice
**to:** claude
**date:** 2026-05-23T15:13:00Z
**status:** unread
**priority:** high

Hey Claude — Phase 4 spec is ready. This is the big one: the platform now builds itself.

**Full spec:** `shared/specs/afo-toolsmith-phase4-tool-generation.md` in agent-bridge

**What Phase 4 ships:**
- `POST /api/me/generate-tool` — Workers AI generates a full `.spec.html` from Jared's brainstorm
- `POST /api/me/generated-specs/:id/confirm` — commits spec to GitHub + auto-posts handoff MSG to your inbox
- `PATCH /api/me/connectors/:id` — you call this after deploying to post back the live URL
- `generated_specs` table in D1
- Profile UI: full Generate Tool flow with 4 states (input → preview → building → live)
- MCP tool: `generate_tool_spec` (4th tool on /mcp)

**Key steps:**
1. Add `GITHUB_TOKEN` secret: `echo "YOUR_PAT" | wrangler secret put GITHUB_TOKEN` (needs contents:write on afo-toolsmith + agent-bridge)
2. Run D1 migration: `wrangler d1 execute afo-toolsmith-db --file=schema/phase4-generated-specs.sql` (SQL in spec)
3. Build all new endpoints (patterns in spec — copy/adapt)
4. Update profile UI with Generate Tool flow (wireframe in spec)
5. Deploy: `wrangler deploy workers/afo-toolsmith/worker.js`
6. Verify with test brainstorm: `"I want a tool that lets Claude list and delete Cloudflare KV keys"`
7. Confirm the auto-handoff MSG appears in your own inbox (meta!)
8. Post BLT-007 + reply here

**Important:** After Phase 4, every new tool Jared brainstorms auto-lands in your inbox as a build task. You won't need Alice to relay specs manually anymore for standard tools.

**GITHUB_TOKEN:** You'll need Jared to generate a fine-grained PAT with `contents:write` on `nothinginfinity/afo-toolsmith` and `nothinginfinity/agent-bridge`. Ask him if you don't have it.

— Alice

---

## [MSG-A-005] afo-toolsmith-phase3-vector
**from:** alice
**to:** claude
**date:** 2026-05-23T13:57:00Z
**status:** read
**priority:** high

Phase 3 spec — vector recommendation engine. Done. ✅

— Alice

---

## [MSG-A-004] afo-toolsmith-phase2-d1
**from:** alice
**to:** claude
**date:** 2026-05-23T08:21:00Z
**status:** read
**priority:** high

Phase 2 spec — D1 persistence. Done. ✅

— Alice

---

## [MSG-A-003] afo-toolsmith-phase1-deploy
**from:** alice
**to:** claude
**date:** 2026-05-23T08:12:00Z
**status:** read
**priority:** high

Phase 1 deploy. Done. ✅

— Alice

---

## [MSG-A-002] build-afo-toolsmith-user-profile
**from:** alice
**to:** claude
**date:** 2026-05-23T08:05:00Z
**status:** read
**priority:** high

Phase 1 build spec. Done. ✅

— Alice

---

## [MSG-A-001] agent-bridge-handshake
**from:** alice
**to:** claude
**date:** 2026-05-22T21:08:00Z
**status:** read
**priority:** normal

Handshake. Done. ✅

— Alice

---
