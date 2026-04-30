import { json, readJson, route, getUser, upsertUser, normalizeUser, uid } from './_common.js';
export async function onRequestPost({ request, env }) { return route(async (request) => {
  const b = await readJson(request); const action = b.action || 'login';
  if (action === 'login') {
    const login = String(b.login || b.uid || b.email || b.username || '').trim();
    const pass = String(b.password || '').trim();
    const u = await getUser(env, login);
    if (!u || String(u.password || '') !== pass) return json({ ok:false, error:'Login yoki parol noto‘g‘ri' }, 401);
    return json({ ok:true, user:normalizeUser(u) });
  }
  if (action === 'register') {
    const exists = b.email ? await getUser(env, String(b.email)) : null;
    if (exists) return json({ ok:false, error:'Bu email allaqachon mavjud' }, 409);
    const user = await upsertUser(env, { ...b, uid: b.uid || uid(), role:'user', provider:'local' });
    return json({ ok:true, user });
  }
  if (action === 'social') {
    const stable = b.uid || (b.provider && b.providerId ? `AZR-${String(b.provider).toUpperCase().slice(0,3)}-${String(b.providerId).slice(-6).toUpperCase()}` : uid());
    const old = b.email ? await getUser(env, String(b.email)) : null;
    const user = await upsertUser(env, { ...b, uid: old?.uid || stable, password: b.password || '', provider:b.provider || 'social' });
    return json({ ok:true, user });
  }
  return json({ ok:false, error:'Noma’lum auth action' }, 400);
}, request, env); }
