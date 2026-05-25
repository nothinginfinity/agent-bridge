-- Message OS Cloud Social MVP v0.3 — D1 Schema Migration
-- Target database: message-os-cloud-db (or equivalent D1 binding)
-- Author: Claude | Date: 2026-05-25
-- Run this migration after the existing tenant/user/workspace/connector_tokens tables are in place.

-- ============================================================
-- TABLE: profiles
-- One profile per user. Stores public handle and identity.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                TEXT PRIMARY KEY,              -- UUID
  user_id           TEXT NOT NULL UNIQUE,          -- FK → users.id
  tenant_id         TEXT NOT NULL,                 -- FK → tenants.id (denormalized for fast lookup)
  handle            TEXT NOT NULL UNIQUE,          -- e.g. "jared" — unique, lowercase, alphanumeric + hyphens
  address           TEXT NOT NULL UNIQUE,          -- e.g. "jared@messageos.cloud" — derived from handle
  display_name      TEXT,                          -- Human-readable name
  avatar_url        TEXT,                          -- Profile image URL (future)
  bio               TEXT,                          -- Short bio (future)
  is_pilot          INTEGER NOT NULL DEFAULT 0,    -- 1 if part of invite-only pilot
  created_at        TEXT NOT NULL,                 -- ISO 8601
  updated_at        TEXT NOT NULL                  -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id   ON profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_handle     ON profiles (handle);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id  ON profiles (tenant_id);


-- ============================================================
-- TABLE: contact_requests
-- Tracks pending/accepted/blocked/removed contact relationships.
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_requests (
  id                TEXT PRIMARY KEY,              -- UUID
  from_user_id      TEXT NOT NULL,                 -- FK → users.id (sender)
  to_user_id        TEXT NOT NULL,                 -- FK → users.id (recipient)
  from_handle       TEXT NOT NULL,                 -- Denormalized for display
  to_handle         TEXT NOT NULL,                 -- Denormalized for display
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | blocked | removed
  message           TEXT,                          -- Optional intro message with request
  created_at        TEXT NOT NULL,                 -- ISO 8601
  updated_at        TEXT NOT NULL,                 -- ISO 8601
  UNIQUE (from_user_id, to_user_id)               -- One request per pair
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_from    ON contact_requests (from_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_to      ON contact_requests (to_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status  ON contact_requests (status);


-- ============================================================
-- TABLE: contacts
-- Materialized approved contact pairs for fast lookup.
-- A contact_request with status=accepted creates a row here (bidirectional).
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id                TEXT PRIMARY KEY,              -- UUID
  user_id           TEXT NOT NULL,                 -- FK → users.id (owner of this contact entry)
  contact_user_id   TEXT NOT NULL,                 -- FK → users.id (the contact)
  contact_handle    TEXT NOT NULL,                 -- Denormalized for display
  contact_request_id TEXT NOT NULL,               -- FK → contact_requests.id (source of truth)
  created_at        TEXT NOT NULL,                 -- ISO 8601
  UNIQUE (user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id         ON contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON contacts (contact_user_id);


-- ============================================================
-- TABLE: user_messages
-- Messages exchanged between approved contacts.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_messages (
  id                TEXT PRIMARY KEY,              -- UUID
  from_user_id      TEXT NOT NULL,                 -- FK → users.id (sender)
  to_user_id        TEXT NOT NULL,                 -- FK → users.id (recipient)
  from_handle       TEXT NOT NULL,                 -- Denormalized for display
  to_handle         TEXT NOT NULL,                 -- Denormalized for display
  subject           TEXT,                          -- Optional subject line
  body              TEXT NOT NULL,                 -- Message body (plaintext for pilot)
  thread_id         TEXT,                          -- Future: thread grouping
  parent_message_id TEXT,                          -- Future: reply chain
  status            TEXT NOT NULL DEFAULT 'unread', -- unread | read | archived | deleted
  notification_sent INTEGER NOT NULL DEFAULT 0,   -- 1 if Resend notification was sent
  created_at        TEXT NOT NULL,                 -- ISO 8601
  read_at           TEXT,                          -- ISO 8601 or NULL
  archived_at       TEXT                           -- ISO 8601 or NULL
);

CREATE INDEX IF NOT EXISTS idx_user_messages_to_user_id     ON user_messages (to_user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_from_user_id   ON user_messages (from_user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_status         ON user_messages (status);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at     ON user_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_messages_thread_id      ON user_messages (thread_id);


-- ============================================================
-- TABLE: message_attachments (future — scaffold only)
-- ============================================================

CREATE TABLE IF NOT EXISTS message_attachments (
  id                TEXT PRIMARY KEY,              -- UUID
  message_id        TEXT NOT NULL,                 -- FK → user_messages.id
  file_name         TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  file_url          TEXT NOT NULL,                 -- R2 URL or external
  file_size_bytes   INTEGER,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments (message_id);


-- ============================================================
-- NOTES
-- ============================================================
--
-- Env vars required in Message OS Cloud Worker:
--   RESEND_API_KEY          Resend API key
--   RESEND_FROM_EMAIL       e.g. hello@messageos.cloud
--   CALCOM_BOOKING_URL      e.g. https://cal.com/jared/message-os-setup
--   APP_BASE_URL            https://message-os-cloud.agentfeedoptimization.com
--   DASHBOARD_BASE_URL      https://message-os-cloud-dashboard.agentfeedoptimization.com
--
-- Resend pattern (confirmed from afo-audit-signup Worker source):
--   POST https://api.resend.com/emails
--   Authorization: Bearer {RESEND_API_KEY}
--   Body: { from, to, subject, text }
--   The existing Worker uses EMAIL_API_KEY + EMAIL_FROM — use RESEND_API_KEY + RESEND_FROM_EMAIL
--   for the social Worker to keep env vars cleanly scoped.
--
-- Cal.com: No API calls needed for MVP. CALCOM_BOOKING_URL is a static link
--   rendered in dashboard "Book Setup Call" tab and included in welcome email.
--
-- Contact safety rule: only users with status=accepted in contacts table
--   may send user_messages to each other. Enforce at API layer.
--
-- Handle format: lowercase, alphanumeric + hyphens, 2–32 chars, globally unique.
--   Validation regex: /^[a-z0-9][a-z0-9-]{1,31}$/
--
-- Migration order:
--   1. profiles
--   2. contact_requests
--   3. contacts
--   4. user_messages
--   5. message_attachments (scaffold, no rush)
