-- toolsmith-builder-mcp D1 schema
-- Worker: toolsmith-builder-mcp
-- Version: 0.1.0
-- Date: 2026-05-27
-- Author: Alice

CREATE TABLE IF NOT EXISTS build_jobs (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  source_type  TEXT NOT NULL CHECK(source_type IN ('prompt','url','doc','repo_path','parse_result','chatgpt_response')),
  source_ref   TEXT NOT NULL,
  intent       TEXT NOT NULL CHECK(intent IN ('worker_mcp','worker_site','content_api','static_blog','prompt_library','d1_index_app','full_site','tool_belt','knowledge_product','unknown')),
  plan         TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning','composing','committing','deploying','testing','registering','complete','failed','cancelled','awaiting_approval')),
  steps        TEXT NOT NULL DEFAULT '[]',
  agent_assignments TEXT NOT NULL DEFAULT '{}',
  result       TEXT,
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_build_jobs_status  ON build_jobs(status);
CREATE INDEX IF NOT EXISTS idx_build_jobs_intent  ON build_jobs(intent);
CREATE INDEX IF NOT EXISTS idx_build_jobs_created ON build_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_build_jobs_updated ON build_jobs(updated_at DESC);
