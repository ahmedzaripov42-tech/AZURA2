import { json, readJSON, ensureSchema, normalizeUser, upsertUser, makeUID, OWNER_ID, OWNER_PASSWORD, audit } from "./_common.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);
  await ensureSchema(env.DB);

  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const body = await readJSON(request);
  const action = body.action || "login";

  if (action === "login") {
    const raw = String(body.login || body.username || body.uid || "").trim();
    const pass = String(body.password || "").trim();
    if (!raw || !pass) return json({ ok: false, error: "Login va parol kerak" }, 400);

    if (raw.toUpperCase() === OWNER_ID && pass === OWNER_PASSWORD) {
      const row = await env.DB.prepare("SELECT * FROM users WHERE uid=?").bind(OWNER_ID).first();
      const user = normalizeUser(row);
      await env.DB.prepare("UPDATE users SET lastLoginAt=?, updatedAt=? WHERE uid=?").bind(Date.now(), Date.now(), OWNER_ID).run();
      return json({ ok: true, user });
    }

    const rawLower = raw.toLowerCase();
    const row = await env.DB.prepare(`
      SELECT * FROM users
      WHERE lower(username)=? OR lower(email)=? OR upper(uid)=?
      LIMIT 1
    `).bind(rawLower, rawLower, raw.toUpperCase()).first();

    if (!row) return json({ ok: false, error: "Foydalanuvchi topilmadi" }, 404);
    if (String(row.password || "") !== pass) return json({ ok: false, error: "Parol noto‘g‘ri" }, 401);

    await env.DB.prepare("UPDATE users SET lastLoginAt=?, updatedAt=? WHERE uid=?").bind(Date.now(), Date.now(), row.uid).run();
    const user = normalizeUser(await env.DB.prepare("SELECT * FROM users WHERE uid=?").bind(row.uid).first());
    await audit(env.DB, "login", user.uid, {});
    return json({ ok: true, user });
  }

  if (action === "register") {
    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim();
    const password = String(body.password || "").trim();
    if (!username || username.length < 2) return json({ ok: false, error: "Username kerak" }, 400);
    if (!password || password.length < 6) return json({ ok: false, error: "Parol kamida 6 ta belgi" }, 400);

    const exists = await env.DB.prepare("SELECT uid FROM users WHERE lower(username)=? OR lower(email)=? LIMIT 1")
      .bind(username.toLowerCase(), email.toLowerCase()).first();
    if (exists) return json({ ok: false, error: "Username yoki email band" }, 409);

    const user = await upsertUser(env.DB, {
      uid: makeUID(),
      username,
      email,
      password,
      provider: "local",
      coins: 50,
      vip: false,
      role: "user",
      createdAt: Date.now()
    });
    await audit(env.DB, "register", user.uid, {});
    return json({ ok: true, user });
  }

  if (action === "social") {
    const provider = String(body.provider || "google").toLowerCase();
    const socialId = String(body.socialId || body.sub || body.id || "").trim();
    const email = String(body.email || "").trim();
    const username = String(body.username || body.name || (email ? email.split("@")[0] : provider + "_user")).trim();
    const avatar = String(body.avatar || body.picture || "").trim();

    let row = null;
    if (email) {
      row = await env.DB.prepare("SELECT * FROM users WHERE lower(email)=? LIMIT 1").bind(email.toLowerCase()).first();
    }

    const uid = row?.uid || makeUID();
    const user = await upsertUser(env.DB, {
      ...(row ? normalizeUser(row) : {}),
      uid,
      username,
      email,
      password: row?.password || "",
      provider,
      avatar,
      coins: row?.coins || 0,
      vip: !!row?.vip,
      role: row?.role || "user",
      extra: { socialId, provider }
    });
    await audit(env.DB, "social_login", user.uid, { provider });
    return json({ ok: true, user });
  }

  return json({ ok: false, error: "Unknown action" }, 400);
}
