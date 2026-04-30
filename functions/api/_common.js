export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...headers,
    },
  });
}

export async function readJSON(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

export function now() { return Date.now(); }

export const OWNER_ID = "AZR-YJTF-QYGT";
export const OWNER_PASSWORD = "azura2025owner";

export function makeUID(prefix = "AZR") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let a = "", b = "";
  for (let i = 0; i < 4; i++) a += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) b += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${a}-${b}`;
}

export async function ensureSchema(DB) {
  await DB.exec(`
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
  `);

  const owner = await DB.prepare("SELECT uid FROM users WHERE uid=?").bind(OWNER_ID).first();
  if (!owner) {
    await DB.prepare(`
      INSERT INTO users (uid, username, email, password, provider, avatar, coins, vip, role, createdAt, updatedAt, lastLoginAt, extra)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      OWNER_ID, "Owner", "owner@azura.uz", OWNER_PASSWORD, "local", "",
      99999, 1, "owner", now(), now(), now(), "{}"
    ).run();
  }
}

export function normalizeUser(row) {
  if (!row) return null;
  let extra = {};
  try { extra = row.extra ? JSON.parse(row.extra) : {}; } catch (_) {}
  return {
    ...extra,
    uid: row.uid,
    username: row.username,
    email: row.email || "",
    password: row.password || "",
    provider: row.provider || "local",
    avatar: row.avatar || "",
    coins: Number(row.coins || 0),
    vip: !!row.vip,
    role: row.role || "user",
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    lastLoginAt: Number(row.lastLoginAt || 0),
  };
}

export async function upsertUser(DB, raw) {
  const t = now();
  const uid = String(raw.uid || raw.id || makeUID()).trim();
  const username = String(raw.username || raw.name || raw.displayName || (raw.email ? String(raw.email).split("@")[0] : "user")).trim();
  const email = String(raw.email || "").trim();
  const password = String(raw.password || "").trim();
  const provider = String(raw.provider || "local").trim();
  const avatar = String(raw.avatar || raw.picture || "").trim();
  const coins = Number.isFinite(Number(raw.coins)) ? Number(raw.coins) : 0;
  const vip = raw.vip ? 1 : 0;
  let role = String(raw.role || "user").trim().toLowerCase();
  if (uid === OWNER_ID) role = "owner";
  if (!["owner", "admin", "user"].includes(role)) role = "user";
  const createdAt = Number(raw.createdAt || t);
  const extra = JSON.stringify(raw.extra || {});

  const existing = await DB.prepare("SELECT * FROM users WHERE uid=?").bind(uid).first();

  if (existing) {
    await DB.prepare(`
      UPDATE users
      SET username=?, email=?, password=COALESCE(NULLIF(?, ''), password),
          provider=?, avatar=?, coins=?, vip=?, role=?, updatedAt=?, extra=?
      WHERE uid=?
    `).bind(username, email, password, provider, avatar, coins, vip, role, t, extra, uid).run();
  } else {
    await DB.prepare(`
      INSERT INTO users (uid, username, email, password, provider, avatar, coins, vip, role, createdAt, updatedAt, lastLoginAt, extra)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(uid, username, email, password, provider, avatar, coins, vip, role, createdAt, t, t, extra).run();
  }

  return normalizeUser(await DB.prepare("SELECT * FROM users WHERE uid=?").bind(uid).first());
}

export async function audit(DB, action, uid, payload = {}) {
  try {
    await DB.prepare("INSERT INTO audit_log (action, uid, payload, createdAt) VALUES (?, ?, ?, ?)")
      .bind(action, uid || "", JSON.stringify(payload || {}), now()).run();
  } catch (_) {}
}

export async function isAdmin(DB, uid) {
  if (!uid) return false;
  if (uid === OWNER_ID) return true;
  const u = await DB.prepare("SELECT role FROM users WHERE uid=?").bind(uid).first();
  return !!u && (u.role === "owner" || u.role === "admin");
}
