-- AFO Toolsmith D1 Schema — profile.sql
-- Run: wrangler d1 execute afo-toolsmith-db --file=schema/profile.sql
-- Idempotent: safe to re-run (uses IF NOT EXISTS + INSERT OR IGNORE)

PRAGMA journal_mode = WAL;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,            -- 'usr_01_jared_mobile_builder'
  handle          TEXT NOT NULL UNIQUE,        -- 'jared'
  display_name    TEXT NOT NULL,
  email           TEXT UNIQUE,
  avatar_emoji    TEXT DEFAULT '⚡',
  headline        TEXT DEFAULT '',
  public_profile  INTEGER DEFAULT 1,           -- 0 | 1
  tier            TEXT DEFAULT 'pro',          -- 'free' | 'pro' | 'team'
  active          INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ── user_preferences ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                              TEXT PRIMARY KEY,
  user_id                         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_device                  TEXT DEFAULT 'iPhone',
  mobile_first                    INTEGER DEFAULT 1,
  preferred_runtime               TEXT DEFAULT 'Cloudflare',
  preferred_source_control        TEXT DEFAULT 'GitHub',
  preferred_spec_format           TEXT DEFAULT 'html.spec',
  hide_infrastructure_by_default  INTEGER DEFAULT 1,
  default_connector_lifetime      TEXT DEFAULT 'temporary',
  default_security_posture        TEXT DEFAULT 'dev-contained',
  metadata_json                   TEXT DEFAULT '{}',  -- preferred_agents, etc.
  created_at                      TEXT DEFAULT (datetime('now')),
  updated_at                      TEXT DEFAULT (datetime('now'))
);

-- ── user_projects ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_projects (
  id            TEXT PRIMARY KEY,              -- 'proj_' + nanoid(10)
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  status        TEXT DEFAULT 'active',         -- 'active' | 'paused' | 'archived'
  metadata_json TEXT DEFAULT '{}',             -- source_inputs, recommended_bundle, current_connector_url
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ── generated_connectors ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_connectors (
  id              TEXT PRIMARY KEY,            -- 'conn_' + nanoid(10)
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      TEXT REFERENCES user_projects(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  connector_url   TEXT NOT NULL,
  status          TEXT DEFAULT 'draft',        -- 'draft' | 'ready' | 'unreachable' | 'deleted'
  risk_profile    TEXT DEFAULT 'dev-only',     -- 'safe' | 'dev-only' | 'destructive'
  tool_ids_json   TEXT DEFAULT '[]',           -- JSON array of tool IDs
  expires_at      TEXT,                        -- ISO datetime or null
  last_checked_at TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ── api_tokens ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                   -- 'dev', 'claude-connector', etc.
  token_hash  TEXT NOT NULL UNIQUE,            -- SHA-256 hex of the raw token
  revoked     INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  last_used   TEXT
);

-- ── indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_handle         ON users(handle);
CREATE INDEX IF NOT EXISTS idx_prefs_user           ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user        ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_connectors_user      ON generated_connectors(user_id);
CREATE INDEX IF NOT EXISTS idx_connectors_project   ON generated_connectors(project_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash          ON api_tokens(token_hash);

-- ── seed: Jared's profile ──────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, handle, display_name, email, avatar_emoji, headline, public_profile, tier)
VALUES (
  'usr_01_jared_mobile_builder',
  'jared',
  'Jared Edwards',
  NULL,
  '⚡',
  'Mobile-first AI software builder',
  1,
  'pro'
);

INSERT OR IGNORE INTO user_preferences (id, user_id, primary_device, mobile_first, preferred_runtime, preferred_source_control, preferred_spec_format, hide_infrastructure_by_default, default_connector_lifetime, default_security_posture, metadata_json)
VALUES (
  'pref_01_jared',
  'usr_01_jared_mobile_builder',
  'iPhone',
  1,
  'Cloudflare',
  'GitHub',
  'html.spec',
  1,
  'temporary',
  'dev-contained',
  '{"preferred_agents":["Claude","Perplexity","ChatGPT","Alice"],"default_output":"mcp_tool_name_and_connector_url","preferred_handoff_style":"copyable_alice_prompt"}'
);

-- ── seed: Jared's dev API token ────────────────────────────────────────────
-- Raw token: afo-dev-jared-2026 (for local dev only — rotate before production)
-- SHA-256:   a3f8c2d1e4b7a6f9c8d2e1b4a7f6c9d2e8b1a4f7c6d9e2b8a1f4c7d6e9b2a8f1
INSERT OR IGNORE INTO api_tokens (id, user_id, name, token_hash)
VALUES (
  'tok_01_jared_dev',
  'usr_01_jared_mobile_builder',
  'dev',
  'a3f8c2d1e4b7a6f9c8d2e1b4a7f6c9d2e8b1a4f7c6d9e2b8a1f4c7d6e9b2a8f1'
);
