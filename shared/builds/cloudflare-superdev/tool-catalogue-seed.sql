-- Cloudflare SuperDev tool_catalogue seed
-- Target: afo-toolsmith-db

INSERT OR IGNORE INTO tool_catalogue
(id, name, description, connector_url, bundle, risk_profile, tool_ids_json, tags_json)
VALUES
(
  'tool_06_cloudflare_auditor',
  'Cloudflare Auditor MCP',
  'Read-only Cloudflare inspection: Workers, routes, DNS, health checks, AFO harness validation, and live-vs-GitHub diffs.',
  'https://cloudflare-auditor-mcp.agentfeedoptimization.com/mcp',
  'cloudflare-readonly-auditor',
  'safe',
  '["list_workers","inspect_worker","audit_routes","list_worker_routes","list_dns_records","worker_health_check","afo_harness_validate"]',
  '["cloudflare","audit","worker","routes","dns","readonly","health","afo","diff"]'
),
(
  'tool_07_cloudflare_builder',
  'Cloudflare Builder MCP',
  'Guarded Cloudflare build tools: route creation/deletion with confirmation, cache purge by URL, binding manifest guidance, deployment checklist, and secret-setting instructions.',
  'https://cloudflare-builder-mcp.agentfeedoptimization.com/mcp',
  'cloudflare-builder',
  'dev-only',
  '["get_worker_metadata","create_worker_route","delete_worker_route","set_worker_secret_instruction","purge_cache_urls","deploy_worker_instruction","binding_manifest_instruction"]',
  '["cloudflare","deploy","worker","bindings","route","cache","guarded","snapshot","secret"]'
),
(
  'tool_08_vector_lab',
  'Vector Lab MCP',
  'Build and operate Cloudflare Vectorize semantic databases: generate embeddings, chunk documents, upsert vectors, query, evaluate retrieval, reindex from D1, and hybrid D1 + Vectorize search.',
  'https://vector-lab-mcp.agentfeedoptimization.com/mcp',
  'vector-lab',
  'dev-only',
  '["vectorize_list_indexes","vectorize_describe_index","embedding_generate","chunk_text","vectorize_upsert_documents","vectorize_query","vectorize_eval_queries","vectorize_reindex_from_d1","hybrid_search_d1_vectorize"]',
  '["vectorize","embeddings","semantic-search","d1","workers-ai","rag","memory","database","hybrid-search"]'
);
