import { json, ensureSchema, OWNER_ID } from "./_common.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok: true });
  try {
    if (!env.DB) return json({ ok: false, error: "DB binding missing. Binding name must be DB." }, 500);
    await ensureSchema(env.DB);
    return json({ ok: true, message: "AZURA D1 schema ready", ownerUid: OWNER_ID });
  } catch (err) {
    return json({ ok: false, error: "Init API error", message: String(err && err.message ? err.message : err) }, 500);
  }
}
