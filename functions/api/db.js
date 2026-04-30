import { json, readJSON, ensureSchema } from "./_common.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);
  await ensureSchema(env.DB);

  const url = new URL(request.url);

  if (request.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) {
      const rows = await env.DB.prepare("SELECT key, value, updatedAt FROM app_data ORDER BY key").all();
      const data = {};
      for (const r of rows.results || []) {
        try { data[r.key] = JSON.parse(r.value); } catch { data[r.key] = r.value; }
      }
      return json({ ok: true, data });
    }
    const row = await env.DB.prepare("SELECT value, updatedAt FROM app_data WHERE key=?").bind(key).first();
    if (!row) return json({ ok: true, key, value: null });
    let value = row.value;
    try { value = JSON.parse(row.value); } catch (_) {}
    return json({ ok: true, key, value, updatedAt: row.updatedAt });
  }

  if (request.method === "POST") {
    const body = await readJSON(request);
    const key = String(body.key || "").trim();
    if (!key) return json({ ok: false, error: "key required" }, 400);
    const value = JSON.stringify(body.value ?? null);
    const t = Date.now();
    await env.DB.prepare(`
      INSERT INTO app_data (key, value, updatedAt) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt
    `).bind(key, value, t).run();
    return json({ ok: true, key, updatedAt: t });
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
}
