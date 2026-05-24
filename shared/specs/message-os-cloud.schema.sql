-- Message OS Cloud schema v0.1
-- Multi-tenant D1 schema for private AI inbox, archive, billing, connector, and memory metadata.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  billing_customer_id TEXT,
  billing_subscription_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'owner',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  UNIQUE(tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default Workspace',
  slug TEXT NOT NULL DEFAULT 'default',
  vector_namespace TEXT NOT NULL,
  retention_policy TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  UNIQUE(tenant_id, slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS connector_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  scopes_json TEXT NOT NULL DEFAULT '["triage","archive","memory"]',
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  metadata_json TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_event_id TEXT,
  from_user TEXT,
  to_user TEXT,
  from_agent TEXT,
  to_agent TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  summary TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  project TEXT,
  tags_json TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_event_id TEXT,
  message_id TEXT NOT NULL,
  category TEXT,
  event_type TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  summary TEXT,
  preview TEXT,
  actor TEXT,
  project TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  actions_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ui_frames (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  frame_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  notification_id TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  selected_choice_id TEXT,
  selected_choice_label TEXT,
  next_tool TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS archive_exports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  archive_target TEXT NOT NULL DEFAULT 'drivemind',
  export_format TEXT NOT NULL DEFAULT 'markdown_json',
  status TEXT NOT NULL DEFAULT 'created',
  r2_object_key TEXT,
  bundle_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  message_id TEXT,
  archive_id TEXT,
  vector_namespace TEXT NOT NULL,
  vector_id TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  content_hash TEXT,
  embedding_model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  UNIQUE(tenant_id, workspace_id, vector_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (archive_id) REFERENCES archive_exports(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'event',
  source TEXT,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS billing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stripe_price_id TEXT,
  monthly_price_cents INTEGER,
  limits_json TEXT NOT NULL,
  features_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  intended_use TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connector_tokens_tenant ON connector_tokens(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_workspace ON messages(tenant_id, workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(tenant_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(tenant_id, workspace_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_notifications_message ON notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_archive_message ON archive_exports(message_id);
CREATE INDEX IF NOT EXISTS idx_memory_workspace ON memory_items(tenant_id, workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_time ON usage_events(tenant_id, created_at);

-- Starter plan data
INSERT OR IGNORE INTO billing_plans
(id, name, stripe_price_id, monthly_price_cents, limits_json, features_json, status, created_at, updated_at)
VALUES
('trial', 'Free Trial', NULL, 0,
 '{"messages_per_month":100,"memory_items":25,"workspaces":1,"connectors":1}',
 '["private_inbox","mcp_connector","limited_archive"]',
 'active', datetime('now'), datetime('now')),
('personal', 'Personal', NULL, 1900,
 '{"messages_per_month":5000,"memory_items":2500,"workspaces":3,"connectors":3}',
 '["private_inbox","mcp_connector","persistent_archive","vector_memory","chatgpt_claude_setup"]',
 'active', datetime('now'), datetime('now')),
('pro', 'Pro', NULL, 4900,
 '{"messages_per_month":25000,"memory_items":25000,"workspaces":10,"connectors":10}',
 '["private_inbox","mcp_connector","persistent_archive","vector_memory","reply_routing","drivemind_export","multi_project"]',
 'active', datetime('now'), datetime('now'));
