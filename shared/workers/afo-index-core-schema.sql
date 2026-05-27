-- afo-index-core-db schema
-- Apply via: cloudflare-multipart-mcp execute_d1_sql

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'trial',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS indexes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS index_items (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  body_text TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  token_estimate INTEGER,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(index_id) REFERENCES indexes(id)
);

CREATE INDEX IF NOT EXISTS idx_index_items_index_id ON index_items(index_id);
CREATE INDEX IF NOT EXISTS idx_index_items_user_id ON index_items(user_id);
CREATE INDEX IF NOT EXISTS idx_index_items_visibility ON index_items(visibility);
CREATE INDEX IF NOT EXISTS idx_index_items_created_at ON index_items(created_at);
CREATE INDEX IF NOT EXISTS idx_indexes_type ON indexes(type);
CREATE INDEX IF NOT EXISTS idx_indexes_user_id ON indexes(user_id);
CREATE INDEX IF NOT EXISTS idx_indexes_updated_at ON indexes(updated_at);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);
