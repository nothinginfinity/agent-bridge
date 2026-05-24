-- Cloudflare SuperDev belts seed
-- Target: afo-toolsmith-db

INSERT OR IGNORE INTO belts
(id, user_id, name, description, connector_ids_json, status, lifetime_days, expires_at, share_token, metadata_json, created_at, updated_at)
VALUES
(
  'belt_cloudflare_readonly_auditor',
  'usr_jared',
  'Cloudflare Readonly Auditor',
  'Safe read-only inspection belt for ChatGPT, Alice, and Claude: Workers, routes, DNS, health checks, and AFO validation.',
  '["conn_cloudflare_auditor"]',
  'active',
  30,
  datetime('now', '+30 days'),
  'blt_cloudflare_readonly_auditor',
  '{"seeded_by":"cloudflare-superdev/belts-seed.sql"}',
  datetime('now'),
  datetime('now')
),
(
  'belt_cloudflare_builder',
  'usr_jared',
  'Cloudflare Builder',
  'Guarded Cloudflare build belt: routes, cache purge, binding manifests, and deployment checklists.',
  '["conn_cloudflare_builder"]',
  'active',
  7,
  datetime('now', '+7 days'),
  'blt_cloudflare_builder',
  '{"seeded_by":"cloudflare-superdev/belts-seed.sql"}',
  datetime('now'),
  datetime('now')
),
(
  'belt_vector_lab',
  'usr_jared',
  'Vector Lab',
  'Semantic database builder for Cloudflare Vectorize + Workers AI + D1.',
  '["conn_vector_lab"]',
  'active',
  30,
  datetime('now', '+30 days'),
  'blt_vector_lab',
  '{"seeded_by":"cloudflare-superdev/belts-seed.sql"}',
  datetime('now'),
  datetime('now')
),
(
  'belt_ultimate_cloudflare_dev',
  'usr_jared',
  'Ultimate Cloudflare Dev',
  'Full Cloudflare development belt: read-only auditing, guarded builder operations, and Vectorize semantic database tools.',
  '["conn_cloudflare_auditor","conn_cloudflare_builder","conn_vector_lab"]',
  'active',
  7,
  datetime('now', '+7 days'),
  'blt_ultimate_cloudflare_dev',
  '{"seeded_by":"cloudflare-superdev/belts-seed.sql"}',
  datetime('now'),
  datetime('now')
);
