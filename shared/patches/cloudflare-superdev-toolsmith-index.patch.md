# Cloudflare SuperDev Toolsmith Index Patch

**Patch ID:** `PATCH-AFO-TOOLSMITH-CF-SUPERDEV-001`
**Target:** `afo-toolsmith` D1 database `afo-toolsmith-db`
**Purpose:** Register Cloudflare SuperDev MCP connectors in Toolsmith catalogue, connector ledger, and starter belts.

---

## 1. Add Tool Catalogue Rows

Run against `afo-toolsmith-db`.

```sql
INSERT OR IGNORE INTO tool_catalogue
(id, name, description, connector_url, bundle, risk_profile, tool_ids_json, tags_json)
VALUES
(
  'tool_06_cloudflare_auditor',
  'Cloudflare Auditor MCP',
  'Read-only Cloudflare inspection: Workers, routes, DNS, D1 schema, Vectorize indexes, health checks, AFO harness validation, and live-vs-GitHub diffs.',
  'https://cloudflare-auditor-mcp.agentfeedoptimization.com/mcp',
  'cloudflare-readonly-auditor',
  'safe',
  '["list_workers","inspect_worker","audit_routes","list_worker_routes","list_dns_records","d1_list_databases","d1_schema_inspect","d1_query_readonly","vectorize_list_indexes","worker_health_check","afo_harness_validate","worker_diff_live_vs_github"]',
  '["cloudflare","audit","worker","routes","dns","d1","vectorize","readonly","health","afo","diff"]'
),
(
  'tool_07_cloudflare_builder',
  'Cloudflare Builder MCP',
  'High-power Cloudflare build tools: deploy Workers while preserving bindings, update bindings, manage routes, run D1 migrations, snapshot Workers, rollback, manage cron triggers, and set secrets.',
  'https://cloudflare-builder-mcp.agentfeedoptimization.com/mcp',
  'cloudflare-builder',
  'dev-only',
  '["deploy_worker_preserve_bindings","update_worker_bindings","create_worker_route","delete_worker_route","d1_apply_migration","worker_snapshot","rollback_worker","update_cron_triggers","set_worker_secret","purge_cache"]',
  '["cloudflare","deploy","worker","bindings","d1","migration","route","rollback","snapshot","cron","secret"]'
),
(
  'tool_08_vector_lab',
  'Vector Lab MCP',
  'Build and operate Cloudflare Vectorize semantic databases: create indexes, generate embeddings, chunk documents, upsert vectors, query, evaluate retrieval, reindex from D1, and perform hybrid D1 + Vectorize search.',
  'https://vector-lab-mcp.agentfeedoptimization.com/mcp',
  'vector-lab',
  'dev-only',
  '["vectorize_create_index","vectorize_list_indexes","vectorize_describe_index","embedding_generate","chunk_text","vectorize_upsert_documents","vectorize_query","vectorize_delete_vectors","vectorize_reindex_from_d1","vectorize_eval_queries","hybrid_search_d1_vectorize"]',
  '["vectorize","embeddings","semantic-search","d1","workers-ai","rag","memory","database","hybrid-search"]'
);
```

---

## 2. Add Generated Connector Rows

These make the connectors available for belt creation.

```sql
INSERT OR IGNORE INTO generated_connectors
(id, user_id, name, connector_url, worker_name, status, risk_profile, tool_ids_json, manifest_json, created_at)
VALUES
(
  'conn_cloudflare_auditor',
  'usr_jared',
  'cloudflare-auditor-mcp',
  'https://cloudflare-auditor-mcp.agentfeedoptimization.com/mcp',
  'cloudflare-auditor-mcp',
  'ready',
  'safe',
  '["list_workers","inspect_worker","audit_routes","d1_schema_inspect","d1_query_readonly","vectorize_list_indexes","worker_health_check","afo_harness_validate"]',
  '{}',
  datetime('now')
),
(
  'conn_cloudflare_builder',
  'usr_jared',
  'cloudflare-builder-mcp',
  'https://cloudflare-builder-mcp.agentfeedoptimization.com/mcp',
  'cloudflare-builder-mcp',
  'ready',
  'dev-only',
  '["deploy_worker_preserve_bindings","update_worker_bindings","create_worker_route","d1_apply_migration","worker_snapshot","rollback_worker"]',
  '{}',
  datetime('now')
),
(
  'conn_vector_lab',
  'usr_jared',
  'vector-lab-mcp',
  'https://vector-lab-mcp.agentfeedoptimization.com/mcp',
  'vector-lab-mcp',
  'ready',
  'dev-only',
  '["vectorize_create_index","vectorize_upsert_documents","vectorize_query","vectorize_reindex_from_d1","vectorize_eval_queries","hybrid_search_d1_vectorize"]',
  '{}',
  datetime('now')
);
```

---

## 3. Add Starter Belts

```sql
INSERT OR IGNORE INTO belts
(id, user_id, name, description, connector_ids_json, status, lifetime_days, expires_at, share_token, metadata_json, created_at, updated_at)
VALUES
(
  'belt_cloudflare_readonly_auditor',
  'usr_jared',
  'Cloudflare Readonly Auditor',
  'Safe read-only inspection belt for ChatGPT, Alice, and Claude: Workers, routes, DNS, D1 schema, Vectorize indexes, health checks, and AFO validation.',
  '["conn_cloudflare_auditor"]',
  'active',
  30,
  datetime('now', '+30 days'),
  'blt_cloudflare_readonly_auditor',
  '{"seeded_by":"PATCH-AFO-TOOLSMITH-CF-SUPERDEV-001"}',
  datetime('now'),
  datetime('now')
),
(
  'belt_cloudflare_builder',
  'usr_jared',
  'Cloudflare Builder',
  'High-power Cloudflare build belt for Claude: deploy Workers, preserve bindings, update routes, run migrations, snapshot, and rollback.',
  '["conn_cloudflare_builder"]',
  'active',
  7,
  datetime('now', '+7 days'),
  'blt_cloudflare_builder',
  '{"seeded_by":"PATCH-AFO-TOOLSMITH-CF-SUPERDEV-001"}',
  datetime('now'),
  datetime('now')
),
(
  'belt_vector_lab',
  'usr_jared',
  'Vector Lab',
  'Semantic database builder for Cloudflare Vectorize + Workers AI + D1. Create indexes, embed docs, upsert vectors, query, evaluate, and reindex D1 tables.',
  '["conn_vector_lab"]',
  'active',
  30,
  datetime('now', '+30 days'),
  'blt_vector_lab',
  '{"seeded_by":"PATCH-AFO-TOOLSMITH-CF-SUPERDEV-001"}',
  datetime('now'),
  datetime('now')
),
(
  'belt_ultimate_cloudflare_dev',
  'usr_jared',
  'Ultimate Cloudflare Dev',
  'Full Cloudflare development belt: read-only auditing, deployment/build tools, and Vectorize semantic database tools.',
  '["conn_cloudflare_auditor","conn_cloudflare_builder","conn_vector_lab"]',
  'active',
  7,
  datetime('now', '+7 days'),
  'blt_ultimate_cloudflare_dev',
  '{"seeded_by":"PATCH-AFO-TOOLSMITH-CF-SUPERDEV-001"}',
  datetime('now'),
  datetime('now')
);
```

---

## 4. Toolsmith Migration Patch Snippet

Add these statements to `runMigration(env)` in `afo-toolsmith` after the existing `tool_05_github_mcp` seed rows. This keeps the index repeatable/idempotent.

After deployment, run:

```txt
POST https://afo-toolsmith.agentfeedoptimization.com/admin/migrate
X-Admin-Token: <admin token>
```

Then embed the updated catalogue:

```txt
POST https://afo-toolsmith.agentfeedoptimization.com/admin/embed-catalogue
X-Admin-Token: <admin token>
```

---

## 5. Validation Queries

After patching and embedding, these Toolsmith recommendation queries should return the new tools:

```json
[
  {
    "query": "I need to inspect all Cloudflare Workers, routes, DNS, and D1 schemas safely",
    "expected": "Cloudflare Auditor MCP"
  },
  {
    "query": "I need to deploy Workers without losing D1 and AI bindings",
    "expected": "Cloudflare Builder MCP"
  },
  {
    "query": "I want to create a Vectorize database from D1 rows and query it semantically",
    "expected": "Vector Lab MCP"
  }
]
```

---

## 6. Acceptance Criteria

1. `GET /api/tools/catalogue` includes all three new tools.
2. `GET /api/me/connectors` includes all three new connectors.
3. `GET /api/me/belts` includes all four starter belts.
4. `POST /admin/embed-catalogue` embeds all three new tools.
5. `POST /api/tools/catalogue/search` can retrieve each new tool semantically.
6. Belt detail pages render connector descriptions.
7. No secret values appear in the catalogue, connector rows, or belt metadata.

---

## 7. Claude Handoff

Claude should:

1. Implement/deploy `vector-lab-mcp` from `shared/specs/vector-lab-mcp.md`.
2. Implement or split out `cloudflare-auditor-mcp` and `cloudflare-builder-mcp` as separate Workers.
3. Apply this D1 patch to `afo-toolsmith-db`.
4. Run catalogue embedding.
5. Confirm the new connectors appear in AFO Toolsmith belts.
6. Post deployment summary to `shared/bulletin.md`.
