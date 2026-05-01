import {
  json,
  readJson,
  route,
  upsertUser,
  normalizeUser,
  uid,
  OWNER_UID,
  OWNER_PASSWORD,
  ensureOwner,
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
  isPasswordHashed,
  isSoftDeletedUser,
  cleanEmail,
  cleanUsername,
  cleanText,
  conflict,
} from './_common.js';

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sessionPayload(session, user) {
  return {
    ok: true,
    user: normalizeUser(user),
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function onRequestGet({ request, env }) {
  return route(async (request) => {
    const session = await getSession(env, request);
    if (!session?.user) return json({ ok:false, error:'Sessiya topilmadi' }, 401);
    return json({
      ok: true,
      user: session.user,
      expiresAt: session.expiresAt,
    });
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    await ensureOwner(env);
    const body = await readJson(request);
    const action = String(body.action || 'login');

    if (action === 'logout') {
      const session = await getSession(env, request);
      if (session?.token) await deleteSession(env, session.token);
      return json({ ok:true });
    }

    if (action === 'login') {
      const login = cleanText(body.login || body.uid || body.email || body.username || '', '', 190);
      const password = String(body.password || '').trim();
      if (!login || !password) return json({ ok:false, error:'Login va parol kerak' }, 400);

      const user = await env.DB.prepare(`
        SELECT * FROM users
        WHERE upper(uid)=upper(?)
           OR lower(email)=lower(?)
           OR lower(username)=lower(?)
        LIMIT 1
      `).bind(login, login, login).first();

      const ownerLogin = /^(AZR-YJTF-QYGT|owner@azura\.local|AZURA_OWNER)$/i.test(login);
      const ownerFallbackOk = ownerLogin && password === OWNER_PASSWORD;
      if (user && isSoftDeletedUser(user) && String(user.uid || '').toUpperCase() !== OWNER_UID) {
        return json({ ok:false, error:'Akkaunt vaqtincha bloklangan' }, 403);
      }
      const storedPasswordOk = user ? await verifyPassword(password, user.password) : false;

      if (!storedPasswordOk && !ownerFallbackOk) {
        return json({ ok:false, error:'Login yoki parol noto‘g‘ri' }, 401);
      }

      const resolvedUid = user?.uid || (ownerFallbackOk ? OWNER_UID : '');
      if (!resolvedUid) return json({ ok:false, error:'Foydalanuvchi topilmadi' }, 404);

      const row = await env.DB.prepare('SELECT * FROM users WHERE uid=?').bind(resolvedUid).first();
      const extra = row?.extra ? JSON.parse(row.extra) : {};
      extra.lastLoginAt = Date.now();
      extra.lastLoginMethod = ownerFallbackOk ? 'owner' : 'password';

      const refreshedUser = await upsertUser(env, {
        ...normalizeUser(row, { includePassword:true }),
        password: row?.password && isPasswordHashed(row.password) ? '' : password,
        extra,
      });

      const session = await createSession(env, refreshedUser, undefined, request);
      return json(sessionPayload(session, refreshedUser));
    }

    if (action === 'register') {
      const username = cleanUsername(body.username || body.name || '');
      const email = cleanEmail(body.email || '');
      const password = String(body.password || '').trim();

      if (username.length < 2) return json({ ok:false, error:'Username kamida 2 belgi bo‘lsin' }, 400);
      if (username.length > 24) return json({ ok:false, error:'Username 24 belgidan oshmasin' }, 400);
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return json({ ok:false, error:'Username faqat lotin harfi, raqam va _ dan iborat bo‘lsin' }, 400);
      if (password.length < 6) return json({ ok:false, error:'Parol kamida 6 belgi bo‘lsin' }, 400);
      if (password.length > 72) return json({ ok:false, error:'Parol juda uzun' }, 400);
      if (email && !validEmail(email)) return json({ ok:false, error:'Email formati noto‘g‘ri' }, 400);

      if (email) {
        const existingByEmail = await env.DB.prepare(`SELECT uid FROM users WHERE lower(email)=lower(?) LIMIT 1`).bind(email).first();
        if (existingByEmail) conflict('Bu email allaqachon mavjud');
      }

      const existingByUsername = await env.DB.prepare(`SELECT uid FROM users WHERE lower(username)=lower(?) LIMIT 1`).bind(username).first();
      if (existingByUsername) conflict('Bu foydalanuvchi nomi band');

      const user = await upsertUser(env, {
        uid: body.uid || uid(),
        username,
        email,
        password,
        role: 'user',
        coins: 0,
        vip: false,
        provider: 'local',
        extra: {
          bio: '',
          telegram: '',
          theme: 'auto',
          registeredAt: Date.now(),
        },
      });
      const session = await createSession(env, user, undefined, request);
      return json(sessionPayload(session, user));
    }

    if (action === 'social') {
      const provider = cleanText(body.provider || 'social', 'social', 24);
      const providerId = cleanText(body.providerId || uid(), uid(), 64);
      const email = cleanEmail(body.email || '');
      let found = null;

      if (email) {
        found = await env.DB.prepare(`SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1`).bind(email).first();
      }
      if (!found) {
        found = await env.DB.prepare(`SELECT * FROM users WHERE provider=? AND json_extract(extra, '$.providerId')=? LIMIT 1`)
          .bind(provider, providerId).first();
      }
      if (found && isSoftDeletedUser(found) && String(found.uid || '').toUpperCase() !== OWNER_UID) {
        return json({ ok:false, error:'Akkaunt vaqtincha bloklangan' }, 403);
      }

      const stableUid = found?.uid || body.uid || `AZR-${provider.toUpperCase().slice(0,3)}-${providerId.slice(-6).toUpperCase()}`;
      const user = await upsertUser(env, {
        uid: stableUid,
        username: cleanUsername(body.username || found?.username || `${provider}_${providerId.slice(-5)}`),
        email,
        password: '',
        provider,
        coins: Number(found?.coins || 0),
        vip: !!found?.vip,
        role: found?.role || 'user',
        avatar: found?.avatar || '',
        extra: {
          ...(found?.extra ? JSON.parse(found.extra) : {}),
          providerId,
          lastLoginAt: Date.now(),
        },
      });
      const session = await createSession(env, user, undefined, request);
      return json(sessionPayload(session, user));
    }

    return json({ ok:false, error:'Noma’lum auth action' }, 400);
  }, request, env);
}

export async function onRequestOptions({ request, env }) {
  const { empty, corsHeaders } = await import('./_common.js');
  return empty(204, corsHeaders());
}
