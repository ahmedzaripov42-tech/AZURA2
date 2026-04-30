import { json, readJSON, ensureSchema, normalizeUser, upsertUser, audit, OWNER_ID } from "./_common.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return json({ ok: true });
  try {
    if (!env.DB) return json({ ok: false, error: "DB binding missing. Binding name must be DB." }, 500);
    await ensureSchema(env.DB);

    const url = new URL(request.url);

    if (request.method === "GET") {
      const rows = await env.DB.prepare("SELECT * FROM users ORDER BY createdAt DESC").all();
      return json({ ok: true, users: (rows.results || []).map(normalizeUser) });
    }

    if (request.method === "POST") {
      const body = await readJSON(request);
      const user = await upsertUser(env.DB, body.user || body);
      await audit(env.DB, "user_upsert", user.uid, { provider: user.provider });
      return json({ ok: true, user });
    }

    if (request.method === "PATCH") {
      const body = await readJSON(request);
      const uid = body.uid;
      const action = body.action;
      if (!uid) return json({ ok: false, error: "uid required" }, 400);

      const row = await env.DB.prepare("SELECT * FROM users WHERE uid=?").bind(uid).first();
      if (!row) return json({ ok: false, error: "User topilmadi" }, 404);
      let u = normalizeUser(row);

      if (action === "coins") {
        const coins = Math.max(0, Number(body.coins || 0));
        await env.DB.prepare("UPDATE users SET coins=?, updatedAt=? WHERE uid=?").bind(coins, Date.now(), uid).run();
      } else if (action === "vip") {
        const vip = body.vip === undefined ? !u.vip : !!body.vip;
        await env.DB.prepare("UPDATE users SET vip=?, updatedAt=? WHERE uid=?").bind(vip ? 1 : 0, Date.now(), uid).run();
      } else if (action === "role") {
        if (uid === OWNER_ID) return json({ ok: false, error: "Owner rolini o‘zgartirib bo‘lmaydi" }, 400);
        const role = ["admin", "user"].includes(body.role) ? body.role : "user";
        await env.DB.prepare("UPDATE users SET role=?, updatedAt=? WHERE uid=?").bind(role, Date.now(), uid).run();
      } else if (action === "profile") {
        const username = String(body.username || u.username || "").trim();
        const email = String(body.email || u.email || "").trim();
        const avatar = String(body.avatar || u.avatar || "").trim();
        await env.DB.prepare("UPDATE users SET username=?, email=?, avatar=?, updatedAt=? WHERE uid=?").bind(username, email, avatar, Date.now(), uid).run();
      } else {
        return json({ ok: false, error: "Unknown action" }, 400);
      }

      const updated = normalizeUser(await env.DB.prepare("SELECT * FROM users WHERE uid=?").bind(uid).first());
      await audit(env.DB, "user_" + action, uid, body);
      return json({ ok: true, user: updated });
    }

    if (request.method === "DELETE") {
      const uid = url.searchParams.get("uid");
      if (!uid) return json({ ok: false, error: "uid required" }, 400);
      if (uid === OWNER_ID) return json({ ok: false, error: "Owner o‘chirilmaydi" }, 400);
      await env.DB.prepare("DELETE FROM users WHERE uid=?").bind(uid).run();
      await audit(env.DB, "user_delete", uid, {});
      return json({ ok: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ ok: false, error: "Users API error", message: String(err && err.message ? err.message : err) }, 500);
  }
}
