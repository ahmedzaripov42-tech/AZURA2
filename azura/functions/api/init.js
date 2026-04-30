import { json, route, getUser, OWNER_UID, normalizeUser, ensureOwner } from './_common.js';
export async function onRequestGet({ request, env }) { return route(async () => {
  await ensureOwner(env);
  const owner = normalizeUser(await getUser(env, OWNER_UID));
  return json({ ok:true, owner, time:Date.now() });
}, request, env); }
