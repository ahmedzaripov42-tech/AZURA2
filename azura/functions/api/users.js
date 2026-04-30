import { json, readJson, route, upsertUser, OWNER_UID, normalizeUser } from './_common.js';

export async function onRequestGet({ request, env }) {
  return route(async () => {
    const { results } = await env.DB.prepare(`SELECT * FROM users ORDER BY createdAt DESC`).all();
    return json({ ok:true, users:(results || []).map(normalizeUser) });
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const body = await readJson(request);
    const user = await upsertUser(env, body);
    return json({ ok:true, user });
  }, request, env);
}

async function ensureUniqueProfile(env, uid, username, email) {
  if (username) {
    const existingName = await env.DB.prepare(`SELECT uid FROM users WHERE lower(username)=lower(?) AND uid<>? LIMIT 1`)
      .bind(username, uid).first();
    if (existingName) return 'Bu foydalanuvchi nomi band';
  }
  if (email) {
    const existingEmail = await env.DB.prepare(`SELECT uid FROM users WHERE lower(email)=lower(?) AND uid<>? LIMIT 1`)
      .bind(email, uid).first();
    if (existingEmail) return 'Bu email allaqachon ishlatilgan';
  }
  return '';
}

export async function onRequestPatch({ request, env }) {
  return route(async (request) => {
    const body = await readJson(request);
    const uid = String(body.uid || '').toUpperCase();
    if (!uid) return json({ ok:false, error:'uid kerak' }, 400);

    const current = await env.DB.prepare(`SELECT * FROM users WHERE uid=?`).bind(uid).first();
    if (!current) return json({ ok:false, error:'User topilmadi' }, 404);

    let next = normalizeUser(current);
    const action = String(body.action || 'profile');

    if (action === 'coins') {
      next.coins = Math.max(0, Number(body.coins ?? body.value ?? next.coins));
    } else if (action === 'vip') {
      next.vip = !!(body.vip ?? body.value);
    } else if (action === 'role') {
      if (uid === OWNER_UID) next.role = 'owner';
      else next.role = String(body.role) === 'admin' ? 'admin' : 'user';
    } else if (action === 'profile') {
      const profile = body.profile || {};
      const username = String(profile.username ?? next.username ?? '').trim();
      const email = String(profile.email ?? next.email ?? '').trim();

      if (username.length < 2) return json({ ok:false, error:'Username kamida 2 belgi bo‘lsin' }, 400);
      if (username.length > 24) return json({ ok:false, error:'Username 24 belgidan oshmasin' }, 400);
      if (!/^[a-zA-Z0-9_]+$/.test(username)) return json({ ok:false, error:'Username faqat lotin harfi, raqam va _ dan iborat bo‘lsin' }, 400);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok:false, error:'Email formati noto‘g‘ri' }, 400);

      const uniqueError = await ensureUniqueProfile(env, uid, username, email);
      if (uniqueError) return json({ ok:false, error:uniqueError }, 409);

      next = {
        ...next,
        username,
        email,
        avatar: String(profile.avatar ?? next.avatar ?? ''),
        password: String(profile.password || ''),
        extra: {
          ...(next.extra || {}),
          ...(profile.extra || {}),
        },
        uid: next.uid,
        role: uid === OWNER_UID ? 'owner' : (profile.role || next.role),
      };
    } else {
      return json({ ok:false, error:'Noma’lum action' }, 400);
    }

    if (uid === OWNER_UID) {
      next.role = 'owner';
      next.vip = true;
      next.coins = Math.max(99999, Number(next.coins || 0));
    }

    const user = await upsertUser(env, next);
    return json({ ok:true, user });
  }, request, env);
}

export async function onRequestDelete({ request, env }) {
  return route(async (request) => {
    const uid = String(new URL(request.url).searchParams.get('uid') || '').toUpperCase();
    if (!uid) return json({ ok:false, error:'uid kerak' }, 400);
    if (uid === OWNER_UID) return json({ ok:false, error:'Owner o‘chirilmaydi' }, 403);

    await env.DB.prepare(`DELETE FROM users WHERE uid=?`).bind(uid).run();
    await env.DB.prepare(`DELETE FROM app_data WHERE key=?`).bind(`user_library_${uid}`).run();

    return json({ ok:true });
  }, request, env);
}
