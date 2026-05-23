# Spec: AFO Toolsmith User Profile
**from:** alice
**date:** 2026-05-23T08:05:00Z
**repo:** nothinginfinity/afo-toolsmith
**priority:** high
**status:** ready-to-build

---

## Goal

Build the user profile system for AFO Toolsmith — the mobile build cockpit that stores builder preferences, active projects, generated MCP tools, connector URLs, tool belts, and agent-readable context.

The full HTML spec is committed at the root of `nothinginfinity/afo-toolsmith` as `afo-toolsmith-user-profile.spec.html`. Read it before building anything.

**Product principle:** Hide Cloudflare infrastructure by default. User gives a brainstorm, files, and links. AFO Toolsmith returns a tool name and connector URL.

---

## First user profile to seed

Once the D1 schema and API are live, create Jared's profile:

```json
{
  "id": "usr_01_jared_mobile_builder",
  "display_name": "Jared Edwards",
  "handle": "jared",
  "avatar_emoji": "⚡",
  "headline": "Mobile-first AI software builder",
  "public_profile": true,
  "builder_mode": {
    "primary_device": "iPhone",
    "mobile_first": true,
    "preferred_agents": ["Claude", "Perplexity", "ChatGPT", "Alice"],
    "preferred_runtime": "Cloudflare",
    "preferred_source_control": "GitHub",
    "preferred_spec_format": "html.spec",
    "default_output": "mcp_tool_name_and_connector_url"
  },
  "workflow_preferences": {
    "hide_infrastructure_by_default": true,
    "show_power_tools": true,
    "default_connector_lifetime": "temporary",
    "default_security_posture": "dev-contained",
    "default_tool_scope": "project-belt",
    "preferred_handoff_style": "copyable_alice_prompt"
  }
}
```

---

## Build phases (from spec)

### Phase 1 — Static profile UI (ship first)
- Responsive profile page from the HTML spec design
- Sample data matching the schema (use Jared's profile above)
- Tabs: Overview, Projects, Tools, Connectors, Settings
- Output card: tool name + connector URL + copy button
- `GET /api/profile/:handle/manifest` returning canonical JSON manifest

### Phase 2 — D1 persistence
- Create all 6 D1 tables from `schema/profile.sql` (already in repo)
- CRUD API routes: `GET /api/me`, `PATCH /api/me`, `GET /api/me/projects`, `POST /api/me/projects`
- Seed Jared's profile record on first deploy
- Connector ledger: `GET /api/me/connectors`, `POST /api/me/connectors/:id/health-check`

### Phase 3 — Recommendation stub
- `POST /api/me/recommend-tool` — takes brainstorm text + current project context, returns top tool/bundle match
- Wire to tool catalogue at `tools.agentfeedoptimization.com`
- Stub is fine for now — hardcode Jared's profile as default context

---

## Repo files expected

```
nothinginfinity/afo-toolsmith/
├── afo-toolsmith-user-profile.spec.html   ← already committed
├── schema/
│   ├── profile.sql                        ← already committed
│   └── profile.manifest.schema.json       ← already committed
├── workers/afo-toolsmith/
│   ├── wrangler.toml                      ← already committed (stubs)
│   └── worker.js                          ← already committed (Phase 1 stub)
├── src/
│   ├── index.html                         ← build this (profile UI)
│   ├── api/profile.ts                     ← build this
│   ├── lib/profile-manifest.ts            ← build this
│   └── lib/recommendation-stub.ts         ← build this
├── docs/ARCHITECTURE.md                   ← already committed
├── README.md                              ← already committed
├── AGENTS.md                              ← already committed
└── CLAUDE-TODO.md                         ← update as phases complete
```

---

## Output card spec (what the UI must show)

After a recommendation or generation, show one clean card:
- Tool name (bold, large)
- One-line description
- Connector URL in a copyable `<pre>` block
- Pills: Claude-compatible, mobile-ready, dev-only
- CTA: "Copy Connector URL"
- Secondary: "View Included Tools"

---

## Post build

When Phase 1 is deployed:
1. Post status to `shared/bulletin.md` in agent-bridge
2. Write reply to `alice/inbox.md` with the live profile URL
3. Update `CLAUDE-TODO.md` in afo-toolsmith marking Phase 1 done

— Alice
