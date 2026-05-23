# AFO Toolsmith — Master Roadmap

**maintained by:** alice  
**last updated:** 2026-05-23  
**status:** phases 1-3 shipped ✅ | phase 4 next

---

## Shipped

| Phase | Name | Status |
|---|---|---|
| 1 | Static Profile UI + Manifest API | ✅ live |
| 2 | D1 Persistence | ✅ live |
| 3 | Vector Recommendation Engine | ✅ live |

**Live:** https://afo-toolsmith.agentfeedoptimization.com

---

## Build Queue (Phases 4–7)

These 4 phases complete the core product. Build in order.

---

### Phase 4 — Tool Generation
> Jared types a brainstorm → system generates a full MCP tool spec → hands off to Claude to build it.

**What ships:**
- `POST /api/me/generate-tool` — takes brainstorm + context, returns full `.spec.html` file
- Spec generator prompt engine (system prompt + Jared's profile context + tool catalogue for deduplication)
- Claude handoff: generated spec auto-committed to `nothinginfinity/afo-toolsmith` and MSG posted to Claude's inbox
- Profile UI: "Generate Tool" flow — brainstorm input → spec preview → confirm → send to Claude
- `GET /api/me/generated-specs` — history of generated specs
- Tool catalogue auto-updated when Claude confirms a new tool is live

**Why first:** Claude can start building his own tools using this system immediately. It dogfoods the whole platform.

**Stub note:** `recommendation-stub.ts` already has the generate_connector MCP tool shell. Extend it.

---

### Phase 5 — Belt System
> Bundle connectors into named, shareable belts with lifetime and expiry management.

**What ships:**
- `belts` table in D1: id, user_id, name, description, connector_ids_json, lifetime, expires_at, share_token, active
- `GET/POST /api/me/belts` — list and create belts
- `PATCH /api/me/belts/:id` — update name, add/remove connectors, set expiry
- `GET /api/belts/:share_token` — public belt view (no auth) — returns belt name + connector list
- `POST /api/me/belts/:id/health-check` — checks all connectors in a belt
- Profile UI Connectors tab: belt grouping, drag-to-add, expiry countdown, shareable link
- Belt share URL format: `https://afo-toolsmith.agentfeedoptimization.com/belt/:share_token`
- Auto-expire: worker cron job (`scheduled`) marks expired connectors unreachable

---

### Phase 6 — Multi-User + Auth
> Cloudflare Access + real user accounts. Turn Toolsmith into a multi-tenant product.

**What ships:**
- Cloudflare Access policy on `/api/me/*` and `/admin/*` routes (replaces dev Bearer token)
- `POST /api/auth/register` — creates new user row from Cloudflare Access JWT
- User handle claim from Access JWT — auto-set on first login
- `GET /api/users/:handle/profile` — public profile page for any user
- Profile UI: login gate, onboarding flow for new users (set handle, headline, preferred agents)
- Rate limiting via Cloudflare WAF rules
- Admin panel: `GET /admin/users` — list all users, tier, last active

---

### Phase 7 — Mobile PWA
> Installable app shell with push notifications. AFO Toolsmith becomes a real mobile app.

**What ships:**
- `manifest.json` — PWA manifest (name, icons, theme_color, display: standalone)
- `sw.js` — service worker: cache-first for UI assets, network-first for API calls
- Web Push: `POST /api/me/push-subscribe` stores push subscription in D1
- Push triggers: new tool deployed by Claude → push to Jared; connector goes unreachable → push alert
- `workers/afo-toolsmith/push.js` — Web Push sender using VAPID keys stored as Worker secrets
- Home screen install prompt (deferred, shown after 2nd visit)
- iOS Safari meta tags: `apple-mobile-web-app-capable`, splash screens
- Offline fallback page

---

## Future Platform Features (Post Phase 7)

These are scoped and understood. No spec needed yet — stubs and extension points will be noted in each phase build so adding them later is clean.

---

### FP-1 — Instruction Factory + Prompt Generator

**What it is:**  
Users generate version-controlled boot instructions for Claude (and other agents). Instructions are stored as context links — shareable URLs. Jared pastes a link into Claude, Claude boots the right project/persona/context automatically.

**Key pieces:**
- Instruction generator: takes project context + agent name + desired behavior → generates structured boot prompt
- Prompt generator: standalone prompt builder for one-off tasks
- Both outputs stored via Context Links MCP as durable slugs
- Boot link format: `https://ctx.agentfeedoptimization.com/:slug` — Claude fetches and executes on paste
- Version control: each edit creates a new version, old versions stay accessible
- UI: "Instruction Factory" tab in profile cockpit

**Stub note:** Context Links MCP is already live. Phase 4 spec generator is the template for this.

---

### FP-2 — Per-User Agent Bridge

**What it is:**  
Every user gets their own `agent-bridge`-style coordination layer. Users communicate with each other via a "linked spaces/projects" system — like the Alice↔Claude↔Jared setup now, but for any user pair or team.

**Key pieces:**
- `agent_bridges` table: user_id, bridge_slug, repo (GitHub or D1-backed), linked_users_json
- Bridge provisioning: on user registration, create a private coordination space
- Linked spaces: two users can link their bridges — shared bulletin, cross-inbox messaging
- Project linking: a project can be shared across two user spaces with scoped read/write
- GitHub-backed option (like current setup) or D1-backed for users without GitHub
- UI: "My Bridge" tab — inbox, outbox, linked spaces, active projects

**Stub note:** Phase 6 multi-user work lays the foundation. Design Phase 6 DB schema with `agent_bridges` in mind.

---

### FP-3 — Tool Marketplace

**What it is:**  
Users can publish their generated MCP tools to a public catalogue. Others can one-click add a connector to their belt.

**Key pieces:**
- `published_tools` table: extends `tool_catalogue` with author, installs, ratings
- `POST /api/tools/publish` — submit a generated tool for review
- `POST /api/me/belts/:id/install/:tool_id` — add a marketplace tool to a belt
- Public catalogue page: searchable, filterable, vector-ranked
- Revenue model hook: paid tools, revenue share with tool authors

---

## Decision: Stubs vs. Notes for Future Features

**Recommendation (Alice):** Notes only for FP-1, FP-2, FP-3 right now. Reasons:

1. **Phases 4-7 will naturally create the right extension points.** Phase 4 spec generator → Instruction Factory. Phase 6 multi-user → Agent Bridge. No need to pre-build stubs that may be wrong.
2. **Stub debt is real.** Premature stubs that don't match the final architecture cost more time to remove/rewrite than starting fresh.
3. **The right move:** in each Phase 4-7 spec, Alice will add a "Future Extension Points" section with specific function signatures, table columns, and API routes that FP-1/2/3 will hook into. Claude leaves those hooks in the code as comments.

**What we will do:** Add a `// FUTURE: FP-1 hook here` comment pattern in the relevant Phase 4-7 files so future phases have clean, obvious attach points.

---

## Agent Coordination

- Specs drop in `shared/specs/` before each phase
- Claude picks up via `claude/inbox.md` MSG
- Status posts to `shared/bulletin.md` BLT entries
- This roadmap is the canonical source of truth — update it when phases ship

---

*AFO Toolsmith — Brainstorm in, MCP tool out.*
