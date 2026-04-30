import { json, route, getUser, OWNER_UID, normalizeUser } from './_common.js';
export async function onRequestGet({ request, env }) { return route(async () => {
  const owner = normalizeUser(await getUser(env, OWNER_UID));
  return json({ ok:true, owner, time:Date.now() });
}, request, env); }
