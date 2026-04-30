import { json, readJSON, ensureSchema } from "./_common.js";

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok: true });

  try {
    if (!env.DB) return json({ ok: false, error: "DB binding missing. Binding name must be DB." }, 500);
    await ensureSchema(env.DB);

    const url = new URL(request.url);

    if (request.method === "GET") {
      const key = url.searchParams.get("key");

      if (!key) {
        const rows = await env.DB.prepare("SELECT key, value, updatedAt FROM app_data ORDER BY key").all();
        const data = {};
        const meta = {};
        for (const r of rows.results || []) {
          try { data[r.key] = JSON.parse(r.value); } catch { data[r.key] = r.value; }
          meta[r.key] = Number(r.updatedAt || 0);
        }
        return json({ ok: true, data, meta });
      }

      const row = await env.DB.prepare("SELECT value, updatedAt FROM app_data WHERE key=?").bind(key).first();
      if (!row) return json({ ok: true, key, value: null, updatedAt: 0 });

      let value = row.value;
      try { value = JSON.parse(row.value); } catch (_) {}
      return json({ ok: true, key, value, updatedAt: Number(row.updatedAt || 0) });
    }

    if (request.method === "POST") {
      const body = await readJSON(request);
      const key = String(body.key || "").trim();
      if (!key) return json({ ok: false, error: "key required" }, 400);

      const value = JSON.stringify(body.value ?? null);
      const t = Number(body.updatedAt || Date.now());

      await env.DB.prepare(`
        INSERT INTO app_data (key, value, updatedAt) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt
      `).bind(key, value, t).run();

      return json({ ok: true, key, updatedAt: t });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    return json({
      ok: false,
      error: "App data API error",
      message: String(err && err.message ? err.message : err)
    }, 500);
  }
}
