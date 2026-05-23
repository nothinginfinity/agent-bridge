# AFO Toolsmith — Phase 3 Spec: Vector Recommendation Engine

**from:** alice  
**to:** claude  
**date:** 2026-05-23  
**status:** ready-to-build  
**repo:** `nothinginfinity/afo-toolsmith`

---

## Overview

Replace the keyword stub in `POST /api/me/recommend-tool` with a real semantic recommendation engine backed by Cloudflare Vectorize. When Jared types a brainstorm, the system finds the most relevant MCP tool from the catalogue using vector similarity — not keyword matching.

Phase 3 ships:
1. Vectorize index creation + tool catalogue embedding
2. `POST /api/me/recommend-tool` upgraded to vector search
3. `GET /api/tools/catalogue` — public tool catalogue endpoint
4. `POST /api/tools/catalogue/search` — semantic search endpoint
5. Tool catalogue seeded with all known AFO tools (22+ tools, 5 bundles)
6. Profile UI updated — recommend tab shows real results with confidence scores
7. MCP tool `recommend_tools` upgraded to use vector search

---

## Step 1 — Create the Vectorize index

```bash
wrangler vectorize create afo-tools-index \
  --dimensions=768 \
  --metric=cosine
```

Copy the index name. Add the binding to `workers/afo-toolsmith/wrangler.toml`:

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "afo-tools-index"
```

Also add Workers AI binding (needed for embedding generation):

```toml
[ai]
binding = "AI"
```

---

## Step 2 — Add tool catalogue table to D1

Run this migration against `afo-toolsmith-db`:

```sql
-- Migration: add tool_catalogue table
CREATE TABLE IF NOT EXISTS tool_catalogue (
  id              TEXT PRIMARY KEY,          -- 'tool_01_repo_builder', etc.
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,             -- used for embedding
  connector_url   TEXT NOT NULL,
  bundle          TEXT DEFAULT '',           -- 'full-session-belt', 'context-belt', etc.
  risk_profile    TEXT DEFAULT 'dev-only',   -- 'safe' | 'dev-only' | 'destructive'
  tool_ids_json   TEXT DEFAULT '[]',         -- JSON array of individual tool names
  tags_json       TEXT DEFAULT '[]',         -- JSON array of tags
  vector_id       TEXT,                      -- ID in Vectorize index
  active          INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_catalogue_bundle ON tool_catalogue(bundle);
CREATE INDEX IF NOT EXISTS idx_catalogue_active ON tool_catalogue(active);
```

Seed the known catalogue tools:

```sql
INSERT OR IGNORE INTO tool_catalogue (id, name, description, connector_url, bundle, risk_profile, tool_ids_json, tags_json) VALUES
('tool_01_repo_builder', 'AFO Repo Builder', 'Creates GitHub repositories from html.spec files. Scaffolds README, AGENTS, ROADMAP docs and posts status back to the message board. Best for starting a new project from a spec.', 'https://afo-repo-builder.agentfeedoptimization.com/mcp', 'full-session-belt', 'dev-only', '["create_repo","push_spec","post_bulletin"]', '["github","repo","scaffold","spec","html"]'),
('tool_02_cloudflare_tools', 'Cloudflare Tools MCP', 'Deploy Cloudflare Workers, manage D1 databases, KV namespaces, R2 buckets, and DNS records directly from Claude. Full infrastructure control from a single connector.', 'https://cloudflare-tools-mcp.agentfeedoptimization.com/mcp', 'full-session-belt', 'dev-only', '["deploy_worker","manage_d1","manage_kv","manage_r2","manage_dns"]', '["cloudflare","worker","deploy","d1","kv","r2","dns","infra"]'),
('tool_03_context_links', 'Context Links MCP', 'Create and manage context links — shareable slugs with rich metadata, expiry, and click tracking. Best for sharing specs, prompts, and project context between agents.', 'https://context-links-mcp.agentfeedoptimization.com/mcp', 'context-belt', 'safe', '["create_link","get_link","list_links","delete_link"]', '["link","slug","share","context","url","metadata"]'),
('tool_04_afo_toolsmith', 'AFO Toolsmith MCP', 'Manage your AFO Toolsmith profile, projects, and connectors. Get tool recommendations from brainstorms. Generate connector URLs.', 'https://afo-toolsmith.agentfeedoptimization.com/mcp', 'full-session-belt', 'safe', '["get_profile_manifest","recommend_tools","generate_connector"]', '["profile","recommend","brainstorm","connector","tool"]'),
('tool_05_github_mcp', 'GitHub MCP', 'Full GitHub access — create and manage repos, branches, files, pull requests, issues, and commits. The backbone of the Alice workflow.', 'https://github-mcp.agentfeedoptimization.com/mcp', 'full-session-belt', 'dev-only', '["create_repo","push_files","create_pr","manage_issues","list_commits"]', '["github","repo","pr","issue","commit","branch","file"]');
```

---

## Step 3 — Embed the catalogue into Vectorize

Add an admin endpoint `POST /admin/embed-catalogue` that:
1. Fetches all active tools from `tool_catalogue` D1 table
2. For each tool, generates an embedding using Workers AI:

```js
const { data } = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
  text: [`${tool.name}. ${tool.description}. Tags: ${JSON.parse(tool.tags_json).join(', ')}`]
});
const vector = data[0];
```

3. Upserts each vector into Vectorize:

```js
await env.VECTORIZE.upsert([{
  id: tool.id,
  values: vector,
  metadata: {
    name: tool.name,
    connector_url: tool.connector_url,
    bundle: tool.bundle,
    risk_profile: tool.risk_profile
  }
}]);
```

4. Updates `vector_id` in D1 for each tool
5. Returns `{ embedded: N, errors: [] }`

Run it once after deploy:
```
POST /admin/embed-catalogue   X-Admin-Token: afo-migrate-2026
```

---

## Step 4 — Upgrade POST /api/me/recommend-tool

Replace keyword stub with:

```js
async function recommendToolVector(brainstorm, env) {
  // 1. Embed the brainstorm
  const { data } = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [brainstorm]
  });
  const queryVector = data[0];

  // 2. Query Vectorize
  const results = await env.VECTORIZE.query(queryVector, {
    topK: 3,
    returnMetadata: 'all'
  });

  if (!results.matches || results.matches.length === 0) {
    return FALLBACK_RECOMMENDATION;
  }

  // 3. Fetch full tool row from D1 for top match
  const topMatch = results.matches[0];
  const tool = await env.DB.prepare(
    'SELECT * FROM tool_catalogue WHERE id = ?'
  ).bind(topMatch.id).first();

  return {
    tool_name: tool.name,
    connector_url: tool.connector_url,
    description: tool.description,
    bundle: tool.bundle,
    risk: tool.risk_profile,
    confidence: topMatch.score,
    source: 'vector',
    alternatives: results.matches.slice(1).map(m => ({
      tool_id: m.id,
      name: m.metadata?.name,
      connector_url: m.metadata?.connector_url,
      score: m.score
    }))
  };
}
```

Fallback to keyword stub if Vectorize is unavailable or confidence < 0.5.

---

## Step 5 — Add public catalogue endpoints

### GET /api/tools/catalogue

Returns all active tools. Optional query params:
- `?bundle=full-session-belt` — filter by bundle
- `?risk=safe` — filter by risk profile

### POST /api/tools/catalogue/search

Body: `{ "query": "I want to build a video hosting platform" }`

Returns top 5 vector matches with scores. Same embedding logic as recommend-tool.

---

## Step 6 — Update profile UI

In `src/index.html`, update the Overview tab:
- Add a brainstorm input textarea: `"What do you want to build?"`
- On submit: `POST /api/me/recommend-tool` with the input
- Show result card: tool name, connector URL (copyable), confidence score badge, 2 alternatives
- Show `source: vector` or `source: stub` badge so Jared can see when vector is live

Also update the MCP `recommend_tools` tool to pass brainstorm text through the new vector endpoint.

---

## Step 7 — Redeploy

```bash
wrangler deploy workers/afo-toolsmith/worker.js
```

Then run embed:
```
POST /admin/embed-catalogue   X-Admin-Token: afo-migrate-2026
```

---

## Step 8 — Verify

- `POST /api/me/recommend-tool` with `{ "brainstorm": "I want to deploy a Cloudflare Worker" }` → returns Cloudflare Tools MCP, `source: "vector"`, confidence > 0.7
- `POST /api/me/recommend-tool` with `{ "brainstorm": "build me a github repo from my spec file" }` → returns AFO Repo Builder, `source: "vector"`
- `GET /api/tools/catalogue` → returns all 5 seeded tools
- `POST /api/tools/catalogue/search` with `{ "query": "share a link with someone" }` → Context Links MCP at top
- Profile UI brainstorm input → real vector results rendered in card

---

## Step 9 — Post status

Post `BLT-005` to `shared/bulletin.md` with:
- Vectorize index name + dimension count
- Number of tools embedded
- Sample recommend-tool result with confidence score
- Phase 4 ready flag

Write reply to `alice/inbox.md`.

---

## Notes

- Model: `@cf/baai/bge-base-en-v1.5` — 768 dimensions, fast, free tier on Workers AI
- Vectorize free tier: 30M queried vector dimensions/month — plenty for this stage
- Keep keyword stub as fallback: if `env.VECTORIZE` not bound or score < 0.5, fall back to keyword
- `wrangler.toml` needs both `[[vectorize]]` AND `[ai]` bindings — don't forget the AI binding
- Embed text format: `"{name}. {description}. Tags: {tags}"` — keeps it short and precise
- After embedding, test with varied brainstorm phrasings to confirm recall quality
