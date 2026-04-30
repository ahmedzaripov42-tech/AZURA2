import { json, readJson, route, upsertUser, OWNER_UID, normalizeUser } from './_common.js';
export async function onRequestGet({ request, env }) { return route(async () => {
  const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
  return json({ ok:true, users:(results || []).map(normalizeUser) });
}, request, env); }
export async function onRequestPost({ request, env }) { return route(async (request) => json({ ok:true, user: await upsertUser(env, await readJson(request)) }), request, env); }
export async function onRequestPatch({ request, env }) { return route(async (request) => {
  const b = await readJson(request); const uid = String(b.uid || '').toUpperCase(); if (!uid) return json({ ok:false,error:'uid kerak' },400);
  const u = await env.DB.prepare('SELECT * FROM users WHERE uid=?').bind(uid).first(); if (!u) return json({ ok:false,error:'User topilmadi' },404);
  let next = normalizeUser(u); const a = b.action || 'profile';
  if (a === 'coins') next.coins = Number(b.coins ?? b.value ?? next.coins);
  if (a === 'vip') next.vip = !!(b.vip ?? b.value);
  if (a === 'role') { if (uid === OWNER_UID) next.role='owner'; else next.role = b.role === 'admin' ? 'admin' : 'user'; }
  if (a === 'profile') next = { ...next, ...b.profile, uid:next.uid, role: uid===OWNER_UID?'owner':(b.profile?.role || next.role) };
  const user = await upsertUser(env, next); return json({ ok:true, user });
}, request, env); }
export async function onRequestDelete({ request, env }) { return route(async (request) => {
  const uid = new URL(request.url).searchParams.get('uid'); if (!uid) return json({ ok:false,error:'uid kerak' },400);
  if (uid.toUpperCase() === OWNER_UID) return json({ ok:false,error:'Owner o‘chirilmaydi' },403);
  await env.DB.prepare('DELETE FROM users WHERE uid=?').bind(uid.toUpperCase()).run(); return json({ ok:true });
}, request, env); }
