import { json, readJson, route, upsertUser, normalizeUser, uid } from './_common.js';

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const body = await readJson(request);
    const action = String(body.action || 'login');

    if (action === 'login') {
      const login = String(body.login || body.uid || body.email || body.username || '').trim();
      const password = String(body.password || '').trim();
      if (!login || !password) return json({ ok:false, error:'Login va parol kerak' }, 400);

      const user = await env.DB.prepare(`
        SELECT * FROM users
        WHERE upper(uid)=upper(?)
           OR lower(email)=lower(?)
           OR lower(username)=lower(?)
        LIMIT 1
      `).bind(login, login, login).first();

      if (!user || String(user.password || '') !== password) {
        return json({ ok:false, error:'Login yoki parol noto‘g‘ri' }, 401);
      }

      const extra = user.extra ? JSON.parse(user.extra) : {};
      extra.lastLoginAt = Date.now();
      await upsertUser(env, { ...normalizeUser(user), extra });

      return json({
        ok:true,
        user:normalizeUser(await env.DB.prepare('SELECT * FROM users WHERE uid=?').bind(user.uid).first())
      });
    }

    if (action === 'register') {
      const username = String(body.username || body.name || '').trim();
      const email = String(body.email || '').trim();
      const password = String(body.password || '').trim();

      if (username.length < 2) return json({ ok:false, error:'Username kamida 2 belgi bo‘lsin' }, 400);
      if (username.length > 24) return json({ ok:false, error:'Username 24 belgidan oshmasin' }, 400);
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return json({ ok:false, error:'Username faqat lotin harfi, raqam va _ dan iborat bo‘lsin' }, 400);
      if (password.length < 6) return json({ ok:false, error:'Parol kamida 6 belgi bo‘lsin' }, 400);
      if (password.length > 72) return json({ ok:false, error:'Parol juda uzun' }, 400);
      if (email && !validEmail(email)) return json({ ok:false, error:'Email formati noto‘g‘ri' }, 400);

      if (email) {
        const existingByEmail = await env.DB.prepare(`SELECT uid FROM users WHERE lower(email)=lower(?) LIMIT 1`).bind(email).first();
        if (existingByEmail) return json({ ok:false, error:'Bu email allaqachon mavjud' }, 409);
      }

      const existingByUsername = await env.DB.prepare(`SELECT uid FROM users WHERE lower(username)=lower(?) LIMIT 1`).bind(username).first();
      if (existingByUsername) return json({ ok:false, error:'Bu foydalanuvchi nomi band' }, 409);

      const user = await upsertUser(env, {
        uid: body.uid || uid(),
        username,
        email,
        password,
        role: 'user',
        coins: Number(body.coins || 0),
        vip: false,
        provider: 'local',
        extra: {
          bio: '',
          telegram: '',
          theme: 'auto',
          registeredAt: Date.now(),
        },
      });
      return json({ ok:true, user });
    }

    if (action === 'social') {
      const provider = String(body.provider || 'social');
      const providerId = String(body.providerId || uid());
      const email = String(body.email || '').trim();
      let found = null;

      if (email) {
        found = await env.DB.prepare(`SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1`).bind(email).first();
      }
      if (!found) {
        found = await env.DB.prepare(`SELECT * FROM users WHERE provider=? AND json_extract(extra, '$.providerId')=? LIMIT 1`)
          .bind(provider, providerId).first();
      }

      const stableUid = found?.uid || body.uid || `AZR-${provider.toUpperCase().slice(0,3)}-${providerId.slice(-6).toUpperCase()}`;
      const user = await upsertUser(env, {
        uid: stableUid,
        username: body.username || `${provider}_${providerId.slice(-5)}`,
        email,
        password: body.password || '',
        provider,
        coins: Number(found?.coins || body.coins || 0),
        vip: !!found?.vip,
        role: found?.role || 'user',
        extra: {
          ...(found?.extra ? JSON.parse(found.extra) : {}),
          providerId,
          lastLoginAt: Date.now(),
        },
      });
      return json({ ok:true, user });
    }

    return json({ ok:false, error:'Noma’lum auth action' }, 400);
  }, request, env);
}
