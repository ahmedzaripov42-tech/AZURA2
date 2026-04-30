export const OWNER_UID = 'AZR-YJTF-QYGT';
export const OWNER_PASSWORD = 'azura2025owner';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export async function readJson(request) {
  try { return await request.json(); }
  catch { return {}; }
}

export function now() { return Date.now(); }
export function uid() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AZR-${part()}-${part()}`;
}

export function safeParse(v, fallback = null) {
  if (v == null || v === '') return fallback;
  try { return JSON.parse(v); }
  catch { return fallback; }
}

export function normalizeUser(row) {
  if (!row) return null;
  return {
    ...row,
    coins: Number(row.coins || 0),
    vip: !!row.vip,
    extra: safeParse(row.extra, {}),
  };
}

export async function ensureSchema(env) {
  if (!env.DB) throw new Error('D1 binding DB topilmadi');
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      username TEXT,
      email TEXT,
      password TEXT,
      role TEXT DEFAULT 'user',
      coins INTEGER DEFAULT 0,
      vip INTEGER DEFAULT 0,
      provider TEXT,
      avatar TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      extra TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS app_data (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      manhwaId TEXT NOT NULL,
      title TEXT,
      chapterNo REAL,
      pages TEXT,
      accessType TEXT DEFAULT 'free',
      price INTEGER DEFAULT 0,
      vip INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      createdAt INTEGER,
      updatedAt INTEGER,
      extra TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      updatedAt INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_created ON users(createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_app_data_updated ON app_data(updatedAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_chapters_manhwa_no ON chapters(manhwaId, chapterNo DESC, createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_views_updated ON views(updatedAt DESC)`),
  ]);

  await db.prepare(`INSERT OR IGNORE INTO users
    (uid, username, email, password, role, coins, vip, provider, avatar, createdAt, updatedAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      OWNER_UID,
      'AZURA OWNER',
      'owner@azura.local',
      OWNER_PASSWORD,
      'owner',
      99999,
      1,
      'local',
      '',
      now(),
      now(),
      '{}'
    ).run();
}

export async function getUser(env, lookup) {
  await ensureSchema(env);
  return env.DB.prepare(`SELECT * FROM users WHERE uid=? OR email=? OR username=? LIMIT 1`)
    .bind(lookup, lookup, lookup).first();
}

export async function upsertUser(env, input = {}) {
  await ensureSchema(env);
  const t = now();
  const user = {
    uid: String(input.uid || uid()).toUpperCase(),
    username: String(input.username || input.name || 'AZURA User'),
    email: String(input.email || ''),
    password: String(input.password || ''),
    role: String(input.role || 'user'),
    coins: Number(input.coins || 0),
    vip: input.vip ? 1 : 0,
    provider: String(input.provider || 'local'),
    avatar: String(input.avatar || ''),
    createdAt: Number(input.createdAt || t),
    updatedAt: t,
    extra: JSON.stringify(input.extra || {}),
  };

  if (user.uid === OWNER_UID) {
    user.role = 'owner';
    user.coins = Math.max(user.coins, 99999);
    user.vip = 1;
  }

  await env.DB.prepare(`
    INSERT INTO users (uid, username, email, password, role, coins, vip, provider, avatar, createdAt, updatedAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      username=excluded.username,
      email=excluded.email,
      password=COALESCE(NULLIF(excluded.password,''), users.password),
      role=excluded.role,
      coins=excluded.coins,
      vip=excluded.vip,
      provider=excluded.provider,
      avatar=excluded.avatar,
      updatedAt=excluded.updatedAt,
      extra=excluded.extra
  `).bind(
    user.uid,
    user.username,
    user.email,
    user.password,
    user.role,
    user.coins,
    user.vip,
    user.provider,
    user.avatar,
    user.createdAt,
    user.updatedAt,
    user.extra
  ).run();

  return normalizeUser(await env.DB.prepare(`SELECT * FROM users WHERE uid=?`).bind(user.uid).first());
}

export async function streamR2(env, request, key) {
  if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);
  const rangeHeader = request.headers.get('range');
  const options = rangeHeader ? { range: request.headers } : {};
  const object = await env.MEDIA.get(key, options);
  if (!object) return json({ ok:false, error:'Media topilmadi' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('accept-ranges', 'bytes');

  const isPartial = !!(rangeHeader && object.range);
  if (isPartial) {
    headers.set('content-range', `bytes ${object.range.offset}-${object.range.end ?? (object.size - 1)}/${object.size}`);
  }

  return new Response(object.body, {
    status: isPartial ? 206 : 200,
    headers,
  });
}

export async function route(handler, request, env) {
  try {
    await ensureSchema(env);
    return await handler(request, env);
  } catch (error) {
    return json({ ok:false, error:error?.message || String(error) }, 500);
  }
}
