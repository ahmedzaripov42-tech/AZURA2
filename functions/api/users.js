import {
  json,
  readJson,
  route,
  upsertUser,
  OWNER_UID,
  normalizeUser,
  requireSession,
  requireStaff,
  requireOwner,
  normalizeRole,
  safeParse,
  isSoftDeletedUser,
  uid,
  cleanEmail,
  cleanUsername,
  cleanText,
  clampInt,
  conflict,
} from './_common.js';

async function ensureUniqueProfile(env, uidValue, username, email) {
  if (username) {
    const existingName = await env.DB.prepare(`SELECT uid FROM users WHERE lower(username)=lower(?) AND uid<>? LIMIT 1`)
      .bind(username, uidValue).first();
    if (existingName) return 'Bu foydalanuvchi nomi band';
  }
  if (email) {
    const existingEmail = await env.DB.prepare(`SELECT uid FROM users WHERE lower(email)=lower(?) AND uid<>? LIMIT 1`)
      .bind(email, uidValue).first();
    if (existingEmail) return 'Bu email allaqachon ishlatilgan';
  }
  return '';
}

async function audit(env, actorUid, action, targetType, targetId, meta = null) {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actorUid, action, targetType, targetId, meta, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(`audit_${t}_${Math.random().toString(36).slice(2, 8)}`, actorUid || '', action, targetType || '', targetId || '', JSON.stringify(meta || {}), t).run();
}

async function notify(env, uidValue, title, body, type = 'info', link = '') {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO notifications (id, uid, type, title, body, link, read, createdAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(`notif_${t}_${Math.random().toString(36).slice(2, 7)}`, uidValue, type, title, body, link, t, JSON.stringify({ source:'users-api' })).run();
}

async function coinHistory(env, uidValue, kind, amount, note, actorUid, extra = null) {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO coin_history (id, uid, kind, amount, note, actorUid, createdAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(`coin_${t}_${Math.random().toString(36).slice(2, 7)}`, uidValue, kind, Number(amount || 0), note || '', actorUid || '', t, JSON.stringify(extra || {})).run();
}

function validUsername(username) {
  return username.length >= 2 && username.length <= 24 && /^[a-zA-Z0-9_]+$/.test(username);
}

function validEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestGet({ request, env }) {
  return route(async (request) => {
    await requireStaff(env, request);
    const url = new URL(request.url);
    const q = cleanText(url.searchParams.get('q') || '', '', 120).toLowerCase();
    const role = ['owner', 'admin', 'user'].includes(String(url.searchParams.get('role') || '')) ? String(url.searchParams.get('role')) : '';
    const status = ['active', 'deleted', 'all'].includes(String(url.searchParams.get('status') || '')) ? String(url.searchParams.get('status')) : 'all';
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 400) || 400));

    const { results } = await env.DB.prepare(`SELECT * FROM users ORDER BY createdAt DESC LIMIT ?`).bind(limit).all();
    let users = (results || []).map(normalizeUser);

    if (role) users = users.filter(user => user.role === role);
    if (status === 'active') users = users.filter(user => !isSoftDeletedUser(user));
    if (status === 'deleted') users = users.filter(user => isSoftDeletedUser(user));
    if (q) {
      users = users.filter(user => {
        const hay = [user.uid, user.username, user.email].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    return json({ ok:true, users });
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    const body = await readJson(request);

    const username = cleanUsername(body.username || body.name || '');
    const email = cleanEmail(body.email || '');
    const requestedRole = normalizeRole(body.role);
    const newUid = String(body.uid || uid()).toUpperCase();

    if (!validUsername(username)) return json({ ok:false, error:'Username noto‘g‘ri' }, 400);
    if (!validEmail(email)) return json({ ok:false, error:'Email formati noto‘g‘ri' }, 400);
    if (requestedRole === 'owner') return json({ ok:false, error:'Owner yaratib bo‘lmaydi' }, 403);
    if (requestedRole === 'admin' && session.user.role !== 'owner') {
      return json({ ok:false, error:'Faqat owner admin yarata oladi' }, 403);
    }
    if (newUid === OWNER_UID) return json({ ok:false, error:'Owner akkaunti himoyalangan' }, 403);

    const uniqueError = await ensureUniqueProfile(env, newUid, username, email);
    if (uniqueError) conflict(uniqueError);

    const user = await upsertUser(env, {
      ...body,
      uid: newUid,
      username,
      email,
      role: requestedRole,
      coins: clampInt(body.coins || 0, 0, 2147483647, 0),
      vip: !!body.vip,
      extra: {
        ...(safeParse(body.extra, {}) || {}),
        createdBy: session.user.uid,
      },
    });

    await audit(env, session.user.uid, 'user.create', 'user', user.uid, { role:user.role, vip:user.vip, coins:user.coins });
    await notify(env, user.uid, 'Akkaunt yaratildi', 'Admin tomonidan akkauntingiz yaratildi yoki yangilandi.', 'account', '/profile');
    return json({ ok:true, user });
  }, request, env);
}

export async function onRequestPatch({ request, env }) {
  return route(async (request) => {
    const session = await requireSession(env, request);
    const actor = session.user;
    const body = await readJson(request);
    const uidValue = String(body.uid || '').toUpperCase();
    if (!uidValue) return json({ ok:false, error:'uid kerak' }, 400);

    const current = await env.DB.prepare(`SELECT * FROM users WHERE uid=?`).bind(uidValue).first();
    if (!current) return json({ ok:false, error:'User topilmadi' }, 404);

    const target = normalizeUser(current, { includePassword:true });
    let next = normalizeUser(current, { includePassword:true });
    const action = String(body.action || 'profile');
    const actorIsOwner = actor.role === 'owner';
    const actorIsStaff = actor.role === 'owner' || actor.role === 'admin';
    const actorIsSelf = actor.uid === uidValue;
    const targetRole = normalizeRole(target.role);
    const targetExtra = safeParse(current.extra, {});

    if (action === 'coins') {
      if (!actorIsStaff) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
      if (uidValue === OWNER_UID && !actorIsOwner) return json({ ok:false, error:'Owner himoyalangan' }, 403);
      const before = Number(target.coins || 0);
      const after = clampInt(body.coins ?? body.value ?? next.coins, 0, 2147483647, before);
      next.coins = after;
      const delta = after - before;
      if (delta !== 0) {
        await coinHistory(env, uidValue, delta > 0 ? 'credit' : 'debit', delta, body.note || 'Admin coin update', actor.uid, { before, after });
        await notify(env, uidValue, 'Coin balansi yangilandi', `${delta > 0 ? '+' : ''}${delta} coin. Joriy balans: ${after}.`, 'coins', '/coinshop');
      }
      await audit(env, actor.uid, 'user.coins', 'user', uidValue, { before, after, note:body.note || '' });
    } else if (action === 'vip') {
      if (!actorIsStaff) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
      if (uidValue === OWNER_UID && !actorIsOwner) return json({ ok:false, error:'Owner himoyalangan' }, 403);
      const vip = !!(body.vip ?? body.value);
      next.vip = vip;
      if (body.vipExpires) next.extra = { ...(next.extra || {}), vipExpires: Number(body.vipExpires) };
      await audit(env, actor.uid, 'user.vip', 'user', uidValue, { vip, vipExpires: body.vipExpires || null });
      await notify(env, uidValue, vip ? 'VIP yoqildi' : 'VIP o‘chirildi', vip ? 'Premium imtiyozlar hisobingizga qo‘shildi.' : 'VIP holati o‘chirildi.', 'vip', '/vip');
    } else if (action === 'role') {
      await requireOwner(env, request);
      if (uidValue === OWNER_UID) return json({ ok:false, error:'Owner roli o‘zgarmaydi' }, 403);
      next.role = normalizeRole(body.role || 'user');
      if (next.role === 'owner') return json({ ok:false, error:'Owner roli tayinlanmaydi' }, 403);
      await audit(env, actor.uid, 'user.role', 'user', uidValue, { role: next.role });
      await notify(env, uidValue, 'Rol yangilandi', `Sizning rolingiz: ${next.role}.`, 'account', '/profile');
    } else if (action === 'softDelete') {
      if (!actorIsStaff) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
      if (uidValue === OWNER_UID) return json({ ok:false, error:'Owner himoyalangan' }, 403);
      if (targetRole === 'admin' && !actorIsOwner) return json({ ok:false, error:'Faqat owner adminni bloklay oladi' }, 403);
      next.extra = {
        ...(next.extra || {}),
        deletedAt: Date.now(),
        deletedBy: actor.uid,
        deletedReason: cleanText(body.reason || 'Moderation', 'Moderation', 240),
      };
      await env.DB.prepare(`DELETE FROM sessions WHERE uid=?`).bind(uidValue).run();
      await env.DB.prepare(`DELETE FROM device_sessions WHERE uid=?`).bind(uidValue).run();
      await audit(env, actor.uid, 'user.soft_delete', 'user', uidValue, { reason: body.reason || '' });
    } else if (action === 'restore') {
      if (!actorIsStaff) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
      if (targetRole === 'admin' && !actorIsOwner) return json({ ok:false, error:'Faqat owner adminni tiklay oladi' }, 403);
      next.extra = {
        ...(next.extra || {}),
        deletedAt: 0,
        deletedBy: '',
        deletedReason: '',
        restoredAt: Date.now(),
        restoredBy: actor.uid,
      };
      await audit(env, actor.uid, 'user.restore', 'user', uidValue, { reason: body.reason || '' });
      await notify(env, uidValue, 'Akkaunt tiklandi', 'Hisobingiz qayta faollashtirildi.', 'account', '/profile');
    } else if (action === 'profile') {
      if (!actorIsSelf && !actorIsStaff) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
      if (isSoftDeletedUser(target) && !actorIsStaff) return json({ ok:false, error:'Akkaunt bloklangan' }, 403);

      const profile = body.profile || {};
      const username = cleanUsername(profile.username ?? next.username ?? '');
      const email = cleanEmail(profile.email ?? next.email ?? '');
      const password = String(profile.password || '').trim();

      if (!validUsername(username)) return json({ ok:false, error:'Username noto‘g‘ri' }, 400);
      if (!validEmail(email)) return json({ ok:false, error:'Email formati noto‘g‘ri' }, 400);
      if (password && password.length < 6) return json({ ok:false, error:'Parol kamida 6 belgi bo‘lsin' }, 400);
      if (password.length > 72) return json({ ok:false, error:'Parol juda uzun' }, 400);

      const uniqueError = await ensureUniqueProfile(env, uidValue, username, email);
      if (uniqueError) conflict(uniqueError);

      next = {
        ...next,
        username,
        email,
        avatar: String(profile.avatar ?? next.avatar ?? '').slice(0, 2048),
        password,
        extra: {
          ...targetExtra,
          ...(next.extra || {}),
          ...(profile.extra || {}),
          bio: cleanText(profile.extra?.bio ?? targetExtra.bio ?? '', '', 280),
          lastProfileUpdateAt: Date.now(),
        },
        uid: next.uid,
        role: uidValue === OWNER_UID ? 'owner' : next.role,
      };
      await audit(env, actor.uid, 'user.profile', 'user', uidValue, { self: actorIsSelf });
    } else {
      return json({ ok:false, error:'Noma’lum action' }, 400);
    }

    if (uidValue === OWNER_UID) {
      next.role = 'owner';
      next.vip = true;
      next.coins = Math.max(99999, Number(next.coins || 0));
      next.extra = { ...(next.extra || {}), deletedAt: 0, deletedBy:'', deletedReason:'' };
    }

    const user = await upsertUser(env, next);
    return json({ ok:true, user });
  }, request, env);
}

export async function onRequestDelete({ request, env }) {
  return route(async (request) => {
    const actor = (await requireStaff(env, request)).user;
    const uidValue = String(new URL(request.url).searchParams.get('uid') || '').toUpperCase();
    if (!uidValue) return json({ ok:false, error:'uid kerak' }, 400);
    if (uidValue === OWNER_UID) return json({ ok:false, error:'Owner o‘chirilmaydi' }, 403);

    const target = await env.DB.prepare(`SELECT * FROM users WHERE uid=?`).bind(uidValue).first();
    if (!target) return json({ ok:false, error:'User topilmadi' }, 404);
    const targetRole = normalizeRole(target.role);
    if (targetRole === 'admin' && actor.role !== 'owner') {
      return json({ ok:false, error:'Faqat owner adminni o‘chira oladi' }, 403);
    }

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM users WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM app_data WHERE key=?`).bind(`user_library_${uidValue}`),
      env.DB.prepare(`DELETE FROM sessions WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM device_sessions WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM library_items WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM notifications WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM ratings WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM manhwa_likes WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`DELETE FROM comment_likes WHERE uid=?`).bind(uidValue),
      env.DB.prepare(`UPDATE comments SET status='deleted', body='[deleted]', updatedAt=? WHERE uid=?`).bind(Date.now(), uidValue),
    ]);
    await audit(env, actor.uid, 'user.delete', 'user', uidValue, {});
    return json({ ok:true });
  }, request, env);
}

export async function onRequestOptions({ request, env }) {
  const { empty, corsHeaders } = await import('./_common.js');
  return empty(204, corsHeaders());
}
