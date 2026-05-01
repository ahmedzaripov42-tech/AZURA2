import { json, route, OWNER_UID } from './_common.js';

export async function onRequestGet({ request, env }) {
  return route(async () => {
    const row = await env.DB.prepare('SELECT COUNT(*) c FROM users').first();
    const owner = await env.DB.prepare('SELECT uid FROM users WHERE uid=? LIMIT 1').bind(OWNER_UID).first();
    return json({
      ok:true,
      db:true,
      media: !!env.MEDIA,
      users:Number(row?.c || 0),
      ownerReady: !!owner,
      time:Date.now(),
    });
  }, request, env);
}
