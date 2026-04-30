import { json, ensureSchema, OWNER_ID } from "./_common.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!env.DB) return json({ ok: false, error: "D1 binding DB topilmadi. Pages Settings → Bindings → D1 → variable name DB bo‘lishi kerak." }, 500);

  await ensureSchema(env.DB);

  return json({
    ok: true,
    message: "AZURA D1 schema ready",
    ownerUid: OWNER_ID,
    next: "Endi /api/users va /api/auth ishlaydi."
  });
}
