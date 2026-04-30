export const OWNER_UID = 'AZR-YJTF-QYGT';
export const OWNER_PASSWORD = 'azura2025owner';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}
export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
export function now() { return Date.now(); }
export function uid() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AZR-${part()}-${part()}`;
}
export function safeParse(v, fallback = null) {
  if (v == null || v === '') return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}
export async function ensureSchema(env) {
  if (!env.DB) throw new Error('D1 binding DB topilmadi');
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, username TEXT, email TEXT, password TEXT, role TEXT DEFAULT 'user', coins INTEGER DEFAULT 0, vip INTEGER DEFAULT 0, provider TEXT, avatar TEXT, createdAt INTEGER, updatedAt INTEGER, extra TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS app_data (key TEXT PRIMARY KEY, value TEXT, updatedAt INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, manhwaId TEXT NOT NULL, title TEXT, chapterNo REAL, pages TEXT, accessType TEXT DEFAULT 'free', price INTEGER DEFAULT 0, vip INTEGER DEFAULT 0, status TEXT DEFAULT 'published', createdAt INTEGER, updatedAt INTEGER, extra TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS views (id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, updatedAt INTEGER)`)
  ]);
  await db.prepare(`INSERT OR IGNORE INTO users (uid,username,email,password,role,coins,vip,provider,createdAt,updatedAt,extra) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(OWNER_UID, 'AZURA OWNER', 'owner@azura.local', OWNER_PASSWORD, 'owner', 99999, 1, 'local', now(), now(), '{}').run();
}
export async function getUser(env, id) {
  await ensureSchema(env);
  return await env.DB.prepare(`SELECT * FROM users WHERE uid=? OR email=? OR username=? LIMIT 1`).bind(id, id, id).first();
}
export function normalizeUser(row) {
  if (!row) return null;
  return { ...row, vip: !!row.vip, coins: Number(row.coins || 0), extra: safeParse(row.extra, {}) };
}
export async function upsertUser(env, u = {}) {
  await ensureSchema(env);
  const t = now();
  const user = {
    uid: String(u.uid || uid()).toUpperCase(),
    username: String(u.username || u.name || 'AZURA User'),
    email: String(u.email || ''),
    password: String(u.password || ''),
    role: String(u.role || 'user'),
    coins: Number(u.coins || 0),
    vip: u.vip ? 1 : 0,
    provider: String(u.provider || 'local'),
    avatar: String(u.avatar || ''),
    createdAt: Number(u.createdAt || t),
    updatedAt: t,
    extra: JSON.stringify(u.extra || {})
  };
  if (user.uid === OWNER_UID) { user.role = 'owner'; user.coins = Math.max(user.coins, 99999); user.vip = 1; }
  await env.DB.prepare(`INSERT INTO users (uid,username,email,password,role,coins,vip,provider,avatar,createdAt,updatedAt,extra) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET username=excluded.username,email=excluded.email,password=COALESCE(NULLIF(excluded.password,''),users.password),role=excluded.role,coins=excluded.coins,vip=excluded.vip,provider=excluded.provider,avatar=excluded.avatar,updatedAt=excluded.updatedAt,extra=excluded.extra`)
    .bind(user.uid,user.username,user.email,user.password,user.role,user.coins,user.vip,user.provider,user.avatar,user.createdAt,user.updatedAt,user.extra).run();
  return normalizeUser(await env.DB.prepare(`SELECT * FROM users WHERE uid=?`).bind(user.uid).first());
}
export async function streamR2(env, key) {
  if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);
  const obj = await env.MEDIA.get(key);
  if (!obj) return json({ ok:false, error:'Media topilmadi' }, 404);
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('accept-ranges', 'bytes');
  return new Response(obj.body, { headers: h });
}
export async function route(handler, request, env) {
  try { await ensureSchema(env); return await handler(request, env); }
  catch (e) { return json({ ok:false, error:e.message || String(e) }, 500); }
}
