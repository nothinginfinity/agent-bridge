-- Cloudflare SuperDev generated_connectors seed
-- Target: afo-toolsmith-db

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
  '["list_workers","inspect_worker","audit_routes","list_dns_records","worker_health_check","afo_harness_validate"]',
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
  '["get_worker_metadata","create_worker_route","delete_worker_route","purge_cache_urls","deploy_worker_instruction","binding_manifest_instruction"]',
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
  '["vectorize_upsert_documents","vectorize_query","vectorize_reindex_from_d1","vectorize_eval_queries","hybrid_search_d1_vectorize"]',
  '{}',
  datetime('now')
);
