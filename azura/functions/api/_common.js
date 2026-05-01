export const OWNER_UID = 'AZR-YJTF-QYGT';
export const OWNER_PASSWORD = 'azura2025owner';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_APP_DATA_BYTES = 1024 * 1024;
export const MAX_TEXT_BYTES = 8192;

const PUBLIC_APP_DATA_KEYS = new Set([
  'azura_banners_v4',
  'azura_adult_content',
]);

const encoder = new TextEncoder();

export function now() { return Date.now(); }

function randomHex(bytes = 16) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function requestId() {
  return `azr_${now().toString(36)}_${randomHex(6)}`;
}

export function uid() {
  return `AZR-${randomHex(2).toUpperCase()}-${randomHex(2).toUpperCase()}`;
}

export function httpError(status, message, code = '') {
  const error = new Error(String(message || 'Xatolik yuz berdi'));
  error.statusCode = Number(status || 500);
  if (code) error.code = code;
  return error;
}

export function badRequest(message, code = 'bad_request') { throw httpError(400, message, code); }
export function unauthorized(message = 'Autentifikatsiya talab qilinadi', code = 'unauthorized') { throw httpError(401, message, code); }
export function forbidden(message = 'Ruxsat yo‘q', code = 'forbidden') { throw httpError(403, message, code); }
export function notFound(message = 'Topilmadi', code = 'not_found') { throw httpError(404, message, code); }
export function conflict(message = 'Konflikt', code = 'conflict') { throw httpError(409, message, code); }
export function payloadTooLarge(message = 'Payload juda katta', code = 'payload_too_large') { throw httpError(413, message, code); }
export function unprocessable(message = 'Ma’lumot yaroqsiz', code = 'unprocessable') { throw httpError(422, message, code); }

export function assert(condition, message, status = 400, code = '') {
  if (!condition) throw httpError(status, message, code || 'assert_failed');
}

export function clampInt(value, min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function clampNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function toBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function cleanText(value, fallback = '', max = 255) {
  const text = String(value ?? fallback).replace(/\s+/g, ' ').trim();
  return text.slice(0, Math.max(0, max));
}

export function cleanMultilineText(value, fallback = '', max = MAX_TEXT_BYTES) {
  const text = String(value ?? fallback)
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
  return text.slice(0, Math.max(0, max));
}

export function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 190);
}

export function cleanUsername(value) {
  return String(value || '').trim().replace(/\s+/g, '').slice(0, 24);
}

export function cleanSlug(value, fallback = '') {
  return String(value || fallback).trim().replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 160);
}

export function safeParse(v, fallback = null) {
  if (v == null || v === '') return fallback;
  try { return JSON.parse(v); }
  catch { return fallback; }
}

export function corsHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-session-token,x-requested-with',
    'access-control-expose-headers': 'etag,content-range,content-length,last-modified,x-azura-request-id',
    'access-control-max-age': '86400',
    'vary': 'Origin',
    ...extra,
  };
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    }),
  });
}

export function empty(status = 204, headers = {}) {
  return new Response(null, {
    status,
    headers: corsHeaders(headers),
  });
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

export function normalizeRole(value, fallback = 'user') {
  const role = String(value || fallback).toLowerCase();
  return role === 'owner' || role === 'admin' ? role : 'user';
}

export function normalizeUser(row, options = {}) {
  if (!row) return null;
  const includePassword = !!options.includePassword;
  const normalized = {
    ...row,
    uid: String(row.uid || '').toUpperCase(),
    username: cleanText(row.username || '', '', 24),
    email: cleanEmail(row.email || ''),
    role: String(row.uid || '').toUpperCase() === OWNER_UID ? 'owner' : normalizeRole(row.role),
    coins: clampInt(row.coins || 0, 0, 2147483647, 0),
    vip: !!Number(row.vip || 0),
    avatar: String(row.avatar || '').slice(0, 2048),
    extra: safeParse(row.extra, {}),
  };
  if (!includePassword) delete normalized.password;
  return normalized;
}

export function isSoftDeletedUser(row) {
  const extra = row?.extra && typeof row.extra === 'object' ? row.extra : safeParse(row?.extra, {});
  return !!(extra && Number(extra.deletedAt || 0) > 0);
}

export async function sha256(value) {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')));
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  if (!password) return '';
  if (String(password).startsWith('sha256$')) return String(password);
  return `sha256$${await sha256(password)}`;
}

export async function verifyPassword(password, stored) {
  const source = String(stored || '');
  if (!source) return false;
  if (source.startsWith('sha256$')) {
    return source === await hashPassword(password);
  }
  return source === String(password || '');
}

export function isPasswordHashed(value) {
  return String(value || '').startsWith('sha256$');
}

export function getBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return String(request.headers.get('x-session-token') || '').trim();
}

export async function createSession(env, user, ttlMs = SESSION_TTL_MS, request = null) {
  const token = `azs_${randomHex(24)}`;
  const t = now();
  const expiresAt = t + ttlMs;
  const userAgent = cleanMultilineText(request?.headers?.get?.('user-agent') || '', '', 300);
  const deviceLabel = cleanText(
    request?.headers?.get?.('sec-ch-ua-platform')
    || request?.headers?.get?.('x-device-name')
    || '',
    '',
    80
  );

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO sessions (token, uid, role, createdAt, updatedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(token, user.uid, user.role || normalizeRole(user.role), t, t, expiresAt),
    env.DB.prepare(`
      INSERT INTO device_sessions (token, uid, label, userAgent, createdAt, updatedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        uid=excluded.uid,
        label=excluded.label,
        userAgent=excluded.userAgent,
        updatedAt=excluded.updatedAt,
        expiresAt=excluded.expiresAt
    `).bind(token, user.uid, deviceLabel, userAgent, t, t, expiresAt),
  ]);

  return { token, expiresAt };
}

export async function deleteSession(env, token) {
  if (!token) return;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(token),
    env.DB.prepare(`DELETE FROM device_sessions WHERE token=?`).bind(token),
  ]);
}

export async function getSession(env, request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT s.token, s.expiresAt, s.updatedAt, ds.label AS deviceLabel, ds.userAgent AS deviceUserAgent, u.*
    FROM sessions s
    JOIN users u ON u.uid = s.uid
    LEFT JOIN device_sessions ds ON ds.token = s.token
    WHERE s.token = ? AND s.expiresAt > ?
    LIMIT 1
  `).bind(token, now()).first();

  if (!row) return null;

  const user = normalizeUser(row);
  if (isSoftDeletedUser(user)) {
    await deleteSession(env, token);
    return null;
  }

  const t = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE sessions SET updatedAt=? WHERE token=?`).bind(t, token),
    env.DB.prepare(`UPDATE device_sessions SET updatedAt=?, expiresAt=? WHERE token=?`).bind(t, Number(row.expiresAt || 0), token),
    env.DB.prepare(`UPDATE users SET updatedAt=? WHERE uid=?`).bind(t, user.uid),
  ]);

  return {
    token,
    expiresAt: Number(row.expiresAt || 0),
    user,
    device: {
      label: String(row.deviceLabel || ''),
      userAgent: String(row.deviceUserAgent || ''),
      current: true,
    },
  };
}

export async function requireSession(env, request) {
  const session = await getSession(env, request);
  if (!session?.user) unauthorized('Autentifikatsiya talab qilinadi');
  return session;
}

export async function requireStaff(env, request) {
  const session = await requireSession(env, request);
  if (!['owner', 'admin'].includes(session.user.role)) {
    forbidden('Ruxsat yo‘q');
  }
  return session;
}

export async function requireOwner(env, request) {
  const session = await requireSession(env, request);
  if (session.user.role !== 'owner') {
    forbidden('Faqat owner bajarishi mumkin');
  }
  return session;
}

export function isPublicAppDataKey(key) {
  return PUBLIC_APP_DATA_KEYS.has(String(key || ''));
}

export function getUserLibraryUidFromKey(key) {
  const match = /^user_library_([A-Z0-9-]+)$/i.exec(String(key || ''));
  return match ? String(match[1]).toUpperCase() : '';
}

export async function ensureOwner(env) {
  await ensureSchema(env);
  const existing = await env.DB.prepare(`SELECT * FROM users WHERE uid=? LIMIT 1`).bind(OWNER_UID).first();
  const hashedOwnerPassword = await hashPassword(OWNER_PASSWORD);
  const ownerOk = existing
    && await verifyPassword(OWNER_PASSWORD, existing.password)
    && String(existing.role || '') === 'owner'
    && Number(existing.coins || 0) >= 99999
    && Number(existing.vip || 0) === 1
    && String(existing.username || '') === 'AZURA_OWNER'
    && String(existing.email || '') === 'owner@azura.local';

  if (ownerOk && String(existing.password || '') === hashedOwnerPassword) return;

  const createdAt = Number(existing?.createdAt || now());
  const updatedAt = now();
  await env.DB.prepare(`
    INSERT INTO users (uid, username, email, password, role, coins, vip, provider, avatar, createdAt, updatedAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      username=excluded.username,
      email=excluded.email,
      password=excluded.password,
      role='owner',
      coins=CASE WHEN users.coins > excluded.coins THEN users.coins ELSE excluded.coins END,
      vip=1,
      provider='local',
      updatedAt=excluded.updatedAt,
      extra=excluded.extra
  `).bind(
    OWNER_UID,
    'AZURA_OWNER',
    'owner@azura.local',
    hashedOwnerPassword,
    'owner',
    99999,
    1,
    'local',
    '',
    createdAt,
    updatedAt,
    JSON.stringify({
      label: 'Primary owner account',
      lastResetAt: updatedAt,
    })
  ).run();
}

export async function ensureSchema(env) {
  if (!env.DB) throw new Error('D1 binding DB topilmadi');
  const db = env.DB;
  const t = now();

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
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      createdAt INTEGER,
      updatedAt INTEGER,
      expiresAt INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS device_sessions (
      token TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      label TEXT,
      userAgent TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      expiresAt INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS library_items (
      uid TEXT NOT NULL,
      manhwaId TEXT NOT NULL,
      state TEXT DEFAULT 'saved',
      favorite INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      lastChapterId TEXT,
      lastReadAt INTEGER DEFAULT 0,
      completedAt INTEGER DEFAULT 0,
      updatedAt INTEGER,
      extra TEXT,
      PRIMARY KEY(uid, manhwaId)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      type TEXT,
      title TEXT,
      body TEXT,
      link TEXT,
      read INTEGER DEFAULT 0,
      createdAt INTEGER,
      extra TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ratings (
      manhwaId TEXT NOT NULL,
      uid TEXT NOT NULL,
      rating REAL DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER,
      PRIMARY KEY(manhwaId, uid)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS manhwa_likes (
      manhwaId TEXT NOT NULL,
      uid TEXT NOT NULL,
      createdAt INTEGER,
      PRIMARY KEY(manhwaId, uid)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      manhwaId TEXT NOT NULL,
      uid TEXT NOT NULL,
      body TEXT,
      likes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      createdAt INTEGER,
      updatedAt INTEGER,
      extra TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS comment_likes (
      commentId TEXT NOT NULL,
      uid TEXT NOT NULL,
      createdAt INTEGER,
      PRIMARY KEY(commentId, uid)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporterUid TEXT,
      targetType TEXT,
      targetId TEXT,
      reason TEXT,
      details TEXT,
      status TEXT DEFAULT 'open',
      resolverUid TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      extra TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actorUid TEXT,
      action TEXT,
      targetType TEXT,
      targetId TEXT,
      meta TEXT,
      createdAt INTEGER
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS coin_history (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      kind TEXT,
      amount INTEGER DEFAULT 0,
      note TEXT,
      actorUid TEXT,
      createdAt INTEGER,
      extra TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      key TEXT,
      url TEXT,
      mime TEXT,
      size INTEGER DEFAULT 0,
      folder TEXT,
      status TEXT DEFAULT 'active',
      createdBy TEXT,
      createdAt INTEGER,
      extra TEXT
    )`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_role_updated ON users(role, updatedAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_created ON users(createdAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_app_data_updated ON app_data(updatedAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_chapters_manhwa_no ON chapters(manhwaId, chapterNo DESC, createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_chapters_status_manhwa ON chapters(status, manhwaId, updatedAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_views_updated ON views(updatedAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_views_count ON views(count DESC, updatedAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_device_sessions_uid ON device_sessions(uid, updatedAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_library_items_uid ON library_items(uid, updatedAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_library_items_uid_state ON library_items(uid, state, updatedAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_library_items_uid_favorite ON library_items(uid, favorite, updatedAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_uid ON notifications(uid, read, createdAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_ratings_manhwa ON ratings(manhwaId, updatedAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_likes_manhwa ON manhwa_likes(manhwaId, createdAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_manhwa ON comments(manhwaId, status, createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_comments_uid_status ON comments(uid, status, updatedAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(targetType, targetId, status, createdAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(targetType, targetId, createdAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_coin_history_uid ON coin_history(uid, createdAt DESC)`),

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(createdAt DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_media_assets_status_folder ON media_assets(status, folder, createdAt DESC)`),
  ]);

  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE expiresAt <= ?`).bind(t),
    db.prepare(`DELETE FROM device_sessions WHERE expiresAt <= ?`).bind(t),
  ]);
}

export async function getUser(env, lookup) {
  await ensureOwner(env);
  const key = cleanText(lookup || '', '', 190);
  assert(key, 'lookup kerak', 400, 'missing_lookup');
  return env.DB.prepare(`
    SELECT * FROM users
    WHERE upper(uid)=upper(?)
       OR lower(email)=lower(?)
       OR lower(username)=lower(?)
    LIMIT 1
  `).bind(key, key, key).first();
}

export async function upsertUser(env, input = {}) {
  await ensureOwner(env);
  const t = now();
  const providedPassword = String(input.password || '');

  const user = {
    uid: String(input.uid || uid()).toUpperCase(),
    username: cleanText(input.username || input.name || 'AZURA User', 'AZURA User', 24),
    email: cleanEmail(input.email || ''),
    password: providedPassword ? await hashPassword(providedPassword) : '',
    role: normalizeRole(input.role),
    coins: clampInt(input.coins || 0, 0, 2147483647, 0),
    vip: toBool(input.vip) ? 1 : 0,
    provider: cleanText(input.provider || 'local', 'local', 32),
    avatar: String(input.avatar || '').slice(0, 2048),
    createdAt: clampInt(input.createdAt || t, 0, 9999999999999, t),
    updatedAt: t,
    extra: JSON.stringify(input.extra || {}),
  };

  assert(user.uid, 'uid kerak', 400, 'missing_uid');
  assert(user.username.length >= 2, 'Username kamida 2 belgi bo‘lsin', 400, 'invalid_username');
  if (user.email) {
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email), 'Email formati noto‘g‘ri', 400, 'invalid_email');
  }

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

export async function streamR2(env, request, key, options = {}) {
  if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);
  const safeKey = cleanSlug(key, '');
  if (!safeKey) return json({ ok:false, error:'key kerak' }, 400);

  const method = String(request.method || 'GET').toUpperCase();
  const isHead = method === 'HEAD' || !!options.head;
  const rangeHeader = request.headers.get('range');
  const object = isHead
    ? await env.MEDIA.head(safeKey)
    : await env.MEDIA.get(safeKey, rangeHeader ? { range: request.headers } : {});

  if (!object) return json({ ok:false, error:'Media topilmadi' }, 404);

  const headers = new Headers(corsHeaders());
  if (typeof object.writeHttpMetadata === 'function') object.writeHttpMetadata(headers);
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable, stale-while-revalidate=86400');
  headers.set('accept-ranges', 'bytes');
  if (Number.isFinite(Number(object.size))) headers.set('content-length', String(Number(object.size)));

  if (object.uploaded) {
    try { headers.set('last-modified', new Date(object.uploaded).toUTCString()); } catch {}
  }

  const hasRange = !!(rangeHeader && object.range && Number.isFinite(Number(object.range.offset)));
  if (hasRange) {
    const start = Number(object.range.offset || 0);
    const length = Number(object.range.length || 0);
    const end = length > 0 ? start + length - 1 : Math.max(start, Number(object.size || 1) - 1);
    headers.set('content-range', `bytes ${start}-${end}/${Number(object.size || end + 1)}`);
    headers.set('content-length', String(Math.max(0, end - start + 1)));
  }

  return new Response(isHead ? null : object.body, {
    status: hasRange ? 206 : 200,
    headers,
  });
}

export async function route(handler, request, env) {
  const reqId = requestId();
  try {
    await ensureOwner(env);
    if (request.method === 'OPTIONS') return empty(204, { 'x-azura-request-id': reqId });
    const response = await handler(request, env);
    const headers = new Headers(response.headers);
    headers.set('x-azura-request-id', reqId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const status = Number(error?.statusCode || 0)
      || (/Autentifikatsiya/i.test(error?.message || '') ? 401 : 500);
    const code = String(error?.code || (status >= 500 ? 'server_error' : 'request_error'));
    const message = status >= 500
      ? 'Server xatosi'
      : String(error?.message || 'So‘rov bajarilmadi');
    return json({ ok:false, error:message, code, requestId:reqId }, status, { 'x-azura-request-id': reqId });
  }
}
