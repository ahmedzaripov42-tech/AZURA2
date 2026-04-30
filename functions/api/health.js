import { json, ensureSchema } from "./_common.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);
  await ensureSchema(env.DB);
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  return json({ ok: true, db: true, users: count?.n || 0, time: Date.now() });
}
