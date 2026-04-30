import { json, route, normalizeUser } from './_common.js';
export async function onRequestGet({ request, env }) { return route(async () => {
  const row = await env.DB.prepare('SELECT COUNT(*) c FROM users').first();
  return json({ ok:true, db:true, users:Number(row?.c || 0), time:Date.now() });
}, request, env); }
