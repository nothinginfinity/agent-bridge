-- Message OS MVP D1 schema

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  from_user TEXT,
  to_user TEXT,
  from_agent TEXT,
  to_agent TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  summary TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  project TEXT,
  tags_json TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT,
  message_id TEXT,
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
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS ui_frames (
  id TEXT PRIMARY KEY,
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
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS notification_actions (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  frame_id TEXT,
  choice_id TEXT NOT NULL,
  choice_label TEXT,
  next_tool TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (frame_id) REFERENCES ui_frames(id)
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  scope TEXT NOT NULL,
  live_ttl_hours INTEGER,
  archive_to_drivemind INTEGER NOT NULL DEFAULT 0,
  vectorize_by_default INTEGER NOT NULL DEFAULT 0,
  update_transport_status_after_archive INTEGER NOT NULL DEFAULT 1,
  policy_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archive_exports (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  archive_target TEXT NOT NULL DEFAULT 'drivemind',
  export_format TEXT NOT NULL DEFAULT 'markdown_json',
  status TEXT NOT NULL DEFAULT 'created',
  bundle_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_to_user_status ON messages(to_user, status);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_ui_frames_status ON ui_frames(status);
CREATE INDEX IF NOT EXISTS idx_archive_exports_message_id ON archive_exports(message_id);
