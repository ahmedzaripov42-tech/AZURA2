-- AZURA Cloudflare D1 schema
-- Cloudflare Dashboard → D1 → azura_db → Console → Run
-- API /api/init ham shu jadvalni avtomatik yaratadi.

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  password TEXT,
  provider TEXT DEFAULT 'local',
  avatar TEXT,
  coins INTEGER DEFAULT 0,
  vip INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  createdAt INTEGER,
  updatedAt INTEGER,
  lastLoginAt INTEGER,
  extra TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS app_data (
  key TEXT PRIMARY KEY,
  value TEXT,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  uid TEXT,
  payload TEXT,
  createdAt INTEGER
);

INSERT OR IGNORE INTO users
(uid, username, email, password, provider, avatar, coins, vip, role, createdAt, updatedAt, lastLoginAt, extra)
VALUES
('AZR-YJTF-QYGT', 'Owner', 'owner@azura.uz', 'azura2025owner', 'local', '', 99999, 1, 'owner',
 strftime('%s','now') * 1000, strftime('%s','now') * 1000, strftime('%s','now') * 1000, '{}');
