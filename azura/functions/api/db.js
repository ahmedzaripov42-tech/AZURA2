import { json, readJson, route, safeParse } from './_common.js';
export async function onRequestGet({ request, env }) { return route(async (request) => {
  const key = new URL(request.url).searchParams.get('key');
  if (key) { const r = await env.DB.prepare('SELECT * FROM app_data WHERE key=?').bind(key).first(); return json({ ok:true, key, value:safeParse(r?.value, null), updatedAt:r?.updatedAt || 0 }); }
  const { results } = await env.DB.prepare('SELECT * FROM app_data').all();
  const data = {}; (results || []).forEach(r => data[r.key] = safeParse(r.value, null)); return json({ ok:true, data });
}, request, env); }
export async function onRequestPost({ request, env }) { return route(async (request) => {
  const b = await readJson(request); if (!b.key) return json({ ok:false,error:'key kerak' },400);
  const t = Number(b.updatedAt || Date.now());
  await env.DB.prepare('INSERT INTO app_data (key,value,updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt').bind(String(b.key), JSON.stringify(b.value ?? null), t).run();
  return json({ ok:true, key:b.key, updatedAt:t });
}, request, env); }
