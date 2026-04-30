import { json, ensureSchema } from "./_common.js";
export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok:true });
  try {
    if (!env.DB) return json({ ok:false, error:"DB binding missing. Binding name must be DB." }, 500);
    await ensureSchema(env.DB);
    const url = new URL(request.url), id = url.searchParams.get("id");
    if (request.method === "GET") {
      if (id) { const row = await env.DB.prepare("SELECT views FROM views WHERE id=?").bind(id).first(); return json({ ok:true, id, views:Number(row?.views || 0) }); }
      const rows = await env.DB.prepare("SELECT id, views FROM views").all();
      const data = {}; for (const r of rows.results || []) data[r.id] = Number(r.views || 0);
      return json({ ok:true, views:data });
    }
    if (request.method === "POST") {
      if (!id) return json({ ok:false, error:"id required" }, 400);
      const current = await env.DB.prepare("SELECT views FROM views WHERE id=?").bind(id).first();
      const views = Number(current?.views || 0) + 1;
      await env.DB.prepare(`INSERT INTO views (id, views, updatedAt) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET views=excluded.views, updatedAt=excluded.updatedAt`).bind(id, views, Date.now()).run();
      return json({ ok:true, id, views });
    }
    return json({ ok:false, error:"Method not allowed" }, 405);
  } catch (err) { return json({ ok:false, error:"Views API error", message:String(err && err.message ? err.message : err) }, 500); }
}
