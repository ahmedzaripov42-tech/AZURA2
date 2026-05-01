import {
  json,
  readJson,
  route,
  requireSession,
  requireStaff,
  safeParse,
  uid,
} from './_common.js';

function boolNum(v) { return v ? 1 : 0; }
function toInt(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; }

async function logAudit(env, actorUid, action, targetType, targetId, meta = null) {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actorUid, action, targetType, targetId, meta, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(`audit_${t}_${Math.random().toString(36).slice(2, 7)}`, actorUid || '', action, targetType || '', targetId || '', JSON.stringify(meta || {}), t).run();
}

async function addNotification(env, uidValue, title, body, type = 'info', link = '', extra = null) {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO notifications (id, uid, type, title, body, link, read, createdAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(`notif_${t}_${Math.random().toString(36).slice(2, 7)}`, uidValue, type, title, body, link, t, JSON.stringify(extra || {})).run();
}

async function getLibrary(env, uidValue) {
  const { results } = await env.DB.prepare(`SELECT * FROM library_items WHERE uid=? ORDER BY updatedAt DESC`).bind(uidValue).all();
  return (results || []).map(r => ({
    ...r,
    favorite: !!Number(r.favorite || 0),
    progress: toInt(r.progress || 0),
    lastReadAt: toInt(r.lastReadAt || 0),
    completedAt: toInt(r.completedAt || 0),
    extra: safeParse(r.extra, {}),
  }));
}

async function getNotifications(env, uidValue) {
  const { results } = await env.DB.prepare(`SELECT * FROM notifications WHERE uid=? ORDER BY createdAt DESC LIMIT 200`).bind(uidValue).all();
  return (results || []).map(r => ({ ...r, read: !!Number(r.read || 0), extra: safeParse(r.extra, {}) }));
}

async function getSessions(env, uidValue, currentToken = '') {
  const { results } = await env.DB.prepare(`SELECT token, label, userAgent, createdAt, updatedAt, expiresAt FROM device_sessions WHERE uid=? ORDER BY updatedAt DESC`).bind(uidValue).all();
  return (results || []).map(r => ({
    ...r,
    current: r.token === currentToken,
    tokenTail: String(r.token || '').slice(-8),
  }));
}

async function getCoinHistory(env, uidValue) {
  const { results } = await env.DB.prepare(`SELECT * FROM coin_history WHERE uid=? ORDER BY createdAt DESC LIMIT 120`).bind(uidValue).all();
  return results || [];
}

async function getDiscovery(env) {
  const [{ results: views = [] }, { results: ratings = [] }, { results: likes = [] }, { results: comments = [] }] = await Promise.all([
    env.DB.prepare(`SELECT id, count, updatedAt FROM views ORDER BY count DESC LIMIT 40`).all(),
    env.DB.prepare(`SELECT manhwaId, AVG(rating) AS avgRating, COUNT(*) AS ratingCount FROM ratings GROUP BY manhwaId ORDER BY ratingCount DESC, avgRating DESC LIMIT 40`).all(),
    env.DB.prepare(`SELECT manhwaId, COUNT(*) AS likeCount FROM manhwa_likes GROUP BY manhwaId ORDER BY likeCount DESC LIMIT 40`).all(),
    env.DB.prepare(`SELECT manhwaId, COUNT(*) AS commentCount FROM comments WHERE status='published' GROUP BY manhwaId ORDER BY commentCount DESC LIMIT 40`).all(),
  ]);
  return { views, ratings, likes, comments };
}

async function getManhwaBundle(env, manhwaId, currentUid = '') {
  const [[ratingRow], [likeRow], [myRate], [myLike], { results: commentRows = [] }] = await Promise.all([
    env.DB.prepare(`SELECT AVG(rating) AS avgRating, COUNT(*) AS ratingCount FROM ratings WHERE manhwaId=?`).bind(manhwaId).all().then(r => r.results || []),
    env.DB.prepare(`SELECT COUNT(*) AS likeCount FROM manhwa_likes WHERE manhwaId=?`).bind(manhwaId).all().then(r => r.results || []),
    currentUid ? env.DB.prepare(`SELECT rating FROM ratings WHERE manhwaId=? AND uid=? LIMIT 1`).bind(manhwaId, currentUid).all().then(r => r.results || []) : Promise.resolve([]),
    currentUid ? env.DB.prepare(`SELECT 1 AS liked FROM manhwa_likes WHERE manhwaId=? AND uid=? LIMIT 1`).bind(manhwaId, currentUid).all().then(r => r.results || []) : Promise.resolve([]),
    env.DB.prepare(`
      SELECT c.*, u.username, u.avatar
      FROM comments c
      LEFT JOIN users u ON u.uid = c.uid
      WHERE c.manhwaId=? AND c.status='published'
      ORDER BY c.createdAt DESC
      LIMIT 80
    `).bind(manhwaId).all(),
  ]);
  return {
    summary: {
      avgRating: Number(ratingRow?.avgRating || 0),
      ratingCount: toInt(ratingRow?.ratingCount || 0),
      likeCount: toInt(likeRow?.likeCount || 0),
      commentCount: commentRows.length,
      myRating: Number(myRate?.rating || 0),
      liked: !!myLike?.liked,
    },
    comments: commentRows.map(r => ({
      ...r,
      likes: toInt(r.likes || 0),
      extra: safeParse(r.extra, {}),
    })),
  };
}

async function getAdminBundle(env) {
  const [{ results: reports = [] }, { results: audit = [] }, { results: media = [] }, { results: comments = [] }, { results: userStats = [] }, { results: topContent = [] }] = await Promise.all([
    env.DB.prepare(`SELECT * FROM reports ORDER BY createdAt DESC LIMIT 120`).all(),
    env.DB.prepare(`SELECT * FROM audit_log ORDER BY createdAt DESC LIMIT 160`).all(),
    env.DB.prepare(`SELECT * FROM media_assets ORDER BY createdAt DESC LIMIT 120`).all(),
    env.DB.prepare(`SELECT c.*, u.username FROM comments c LEFT JOIN users u ON u.uid=c.uid ORDER BY createdAt DESC LIMIT 120`).all(),
    env.DB.prepare(`SELECT role, COUNT(*) AS count FROM users GROUP BY role`).all(),
    env.DB.prepare(`SELECT id, count, updatedAt FROM views ORDER BY count DESC LIMIT 20`).all(),
  ]);
  return { reports, audit, media, comments, userStats, topContent };
}

export async function onRequestGet({ request, env }) {
  return route(async (request) => {
    const url = new URL(request.url);
    const scope = String(url.searchParams.get('scope') || 'bootstrap');
    const session = await requireSession(env, request);

    if (scope === 'bootstrap') {
      const [library, notifications, deviceSessions, coinHistory, discovery] = await Promise.all([
        getLibrary(env, session.user.uid),
        getNotifications(env, session.user.uid),
        getSessions(env, session.user.uid, session.token),
        getCoinHistory(env, session.user.uid),
        getDiscovery(env),
      ]);
      return json({
        ok:true,
        profile: {
          lastActiveAt: Math.max(...deviceSessions.map(s => toInt(s.updatedAt || 0)), 0),
          deviceSessions,
          coinHistory,
        },
        library,
        notifications,
        discovery,
      });
    }

    if (scope === 'manhwa') {
      const manhwaId = String(url.searchParams.get('manhwaId') || '');
      if (!manhwaId) return json({ ok:false, error:'manhwaId kerak' }, 400);
      return json({ ok:true, ...(await getManhwaBundle(env, manhwaId, session.user.uid)) });
    }

    if (scope === 'admin') {
      await requireStaff(env, request);
      return json({ ok:true, ...(await getAdminBundle(env)) });
    }

    return json({ ok:false, error:'Noma’lum scope' }, 400);
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const session = await requireSession(env, request);
    const body = await readJson(request);
    const action = String(body.action || '');
    const me = session.user;
    const t = Date.now();

    if (action === 'library.upsert') {
      const manhwaId = String(body.manhwaId || '').trim();
      if (!manhwaId) return json({ ok:false, error:'manhwaId kerak' }, 400);
      const state = ['saved', 'reading', 'completed'].includes(String(body.state || '')) ? String(body.state) : 'saved';
      const favorite = !!body.favorite;
      const progress = Math.max(0, Math.min(100, toInt(body.progress || 0)));
      const lastChapterId = String(body.lastChapterId || '');
      const completedAt = state === 'completed' || progress >= 100 ? t : 0;
      await env.DB.prepare(`
        INSERT INTO library_items (uid, manhwaId, state, favorite, progress, lastChapterId, lastReadAt, completedAt, updatedAt, extra)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid, manhwaId) DO UPDATE SET
          state=excluded.state,
          favorite=excluded.favorite,
          progress=CASE WHEN excluded.progress > library_items.progress THEN excluded.progress ELSE library_items.progress END,
          lastChapterId=COALESCE(NULLIF(excluded.lastChapterId, ''), library_items.lastChapterId),
          lastReadAt=excluded.lastReadAt,
          completedAt=CASE WHEN excluded.completedAt > 0 THEN excluded.completedAt ELSE library_items.completedAt END,
          updatedAt=excluded.updatedAt,
          extra=excluded.extra
      `).bind(me.uid, manhwaId, state, boolNum(favorite), progress, lastChapterId, t, completedAt, t, JSON.stringify(body.extra || {})).run();
      await logAudit(env, me.uid, 'library.upsert', 'manhwa', manhwaId, { state, favorite, progress, lastChapterId });
      const row = await env.DB.prepare(`SELECT * FROM library_items WHERE uid=? AND manhwaId=?`).bind(me.uid, manhwaId).first();
      return json({ ok:true, item: { ...row, favorite: !!Number(row.favorite || 0), extra: safeParse(row.extra, {}) } });
    }

    if (action === 'library.remove') {
      const manhwaId = String(body.manhwaId || '').trim();
      if (!manhwaId) return json({ ok:false, error:'manhwaId kerak' }, 400);
      await env.DB.prepare(`DELETE FROM library_items WHERE uid=? AND manhwaId=?`).bind(me.uid, manhwaId).run();
      await logAudit(env, me.uid, 'library.remove', 'manhwa', manhwaId, {});
      return json({ ok:true });
    }

    if (action === 'notification.read') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (body.all) {
        await env.DB.prepare(`UPDATE notifications SET read=1 WHERE uid=?`).bind(me.uid).run();
      } else if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        await env.DB.prepare(`UPDATE notifications SET read=1 WHERE uid=? AND id IN (${placeholders})`).bind(me.uid, ...ids).run();
      }
      return json({ ok:true });
    }

    if (action === 'session.revoke') {
      const token = String(body.token || '');
      if (!token || token === session.token) return json({ ok:false, error:'Joriy sessiyani bekor qilib bo‘lmaydi' }, 400);
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM sessions WHERE token=? AND uid=?`).bind(token, me.uid),
        env.DB.prepare(`DELETE FROM device_sessions WHERE token=? AND uid=?`).bind(token, me.uid),
      ]);
      await logAudit(env, me.uid, 'session.revoke', 'session', token.slice(-8), {});
      return json({ ok:true });
    }

    if (action === 'rating.set') {
      const manhwaId = String(body.manhwaId || '').trim();
      const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
      if (!manhwaId || !rating) return json({ ok:false, error:'rating kerak' }, 400);
      await env.DB.prepare(`
        INSERT INTO ratings (manhwaId, uid, rating, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(manhwaId, uid) DO UPDATE SET rating=excluded.rating, updatedAt=excluded.updatedAt
      `).bind(manhwaId, me.uid, rating, t, t).run();
      await logAudit(env, me.uid, 'rating.set', 'manhwa', manhwaId, { rating });
      return json({ ok:true, ...(await getManhwaBundle(env, manhwaId, me.uid)) });
    }

    if (action === 'like.toggle') {
      const manhwaId = String(body.manhwaId || '').trim();
      if (!manhwaId) return json({ ok:false, error:'manhwaId kerak' }, 400);
      const existing = await env.DB.prepare(`SELECT 1 AS liked FROM manhwa_likes WHERE manhwaId=? AND uid=? LIMIT 1`).bind(manhwaId, me.uid).first();
      if (existing) {
        await env.DB.prepare(`DELETE FROM manhwa_likes WHERE manhwaId=? AND uid=?`).bind(manhwaId, me.uid).run();
      } else {
        await env.DB.prepare(`INSERT INTO manhwa_likes (manhwaId, uid, createdAt) VALUES (?, ?, ?)`)
          .bind(manhwaId, me.uid, t).run();
      }
      return json({ ok:true, ...(await getManhwaBundle(env, manhwaId, me.uid)) });
    }

    if (action === 'comment.create') {
      const manhwaId = String(body.manhwaId || '').trim();
      const commentBody = String(body.body || '').trim();
      if (!manhwaId || commentBody.length < 2) return json({ ok:false, error:'Komment kerak' }, 400);
      const id = `c_${t}_${Math.random().toString(36).slice(2, 7)}`;
      await env.DB.prepare(`
        INSERT INTO comments (id, manhwaId, uid, body, likes, status, createdAt, updatedAt, extra)
        VALUES (?, ?, ?, ?, 0, 'published', ?, ?, ?)
      `).bind(id, manhwaId, me.uid, commentBody.slice(0, 2000), t, t, JSON.stringify({ parentId: String(body.parentId || '') })).run();
      await logAudit(env, me.uid, 'comment.create', 'comment', id, { manhwaId });
      return json({ ok:true, ...(await getManhwaBundle(env, manhwaId, me.uid)) });
    }

    if (action === 'comment.like') {
      const commentId = String(body.commentId || '').trim();
      if (!commentId) return json({ ok:false, error:'commentId kerak' }, 400);
      const comment = await env.DB.prepare(`SELECT * FROM comments WHERE id=? LIMIT 1`).bind(commentId).first();
      if (!comment) return json({ ok:false, error:'Komment topilmadi' }, 404);
      const exists = await env.DB.prepare(`SELECT 1 AS ok FROM comment_likes WHERE commentId=? AND uid=? LIMIT 1`).bind(commentId, me.uid).first();
      if (exists) {
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM comment_likes WHERE commentId=? AND uid=?`).bind(commentId, me.uid),
          env.DB.prepare(`UPDATE comments SET likes=CASE WHEN likes>0 THEN likes-1 ELSE 0 END, updatedAt=? WHERE id=?`).bind(t, commentId),
        ]);
      } else {
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO comment_likes (commentId, uid, createdAt) VALUES (?, ?, ?)`)
            .bind(commentId, me.uid, t),
          env.DB.prepare(`UPDATE comments SET likes=likes+1, updatedAt=? WHERE id=?`).bind(t, commentId),
        ]);
      }
      return json({ ok:true, ...(await getManhwaBundle(env, comment.manhwaId, me.uid)) });
    }

    if (action === 'report.create') {
      const targetType = String(body.targetType || '').trim();
      const targetId = String(body.targetId || '').trim();
      const reason = String(body.reason || '').trim();
      const details = String(body.details || '').trim();
      if (!targetType || !targetId || reason.length < 3) return json({ ok:false, error:'Hisobot ma’lumoti yetarli emas' }, 400);
      const id = `rep_${t}_${Math.random().toString(36).slice(2, 7)}`;
      await env.DB.prepare(`
        INSERT INTO reports (id, reporterUid, targetType, targetId, reason, details, status, resolverUid, createdAt, updatedAt, extra)
        VALUES (?, ?, ?, ?, ?, ?, 'open', '', ?, ?, ?)
      `).bind(id, me.uid, targetType, targetId, reason.slice(0, 120), details.slice(0, 2000), t, t, JSON.stringify({})).run();
      await addNotification(env, me.uid, 'Hisobot yuborildi', 'Moderatsiya jamoasi hisobotni ko‘rib chiqadi.', 'report', '/notifications');
      await logAudit(env, me.uid, 'report.create', targetType, targetId, { reason });
      return json({ ok:true, reportId:id });
    }

    return json({ ok:false, error:'Noma’lum action' }, 400);
  }, request, env);
}

export async function onRequestPatch({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    const body = await readJson(request);
    const action = String(body.action || '');
    const t = Date.now();

    if (action === 'report.resolve') {
      const id = String(body.id || '');
      const status = ['open', 'reviewed', 'resolved', 'dismissed'].includes(String(body.status || '')) ? String(body.status) : 'reviewed';
      if (!id) return json({ ok:false, error:'id kerak' }, 400);
      await env.DB.prepare(`UPDATE reports SET status=?, resolverUid=?, updatedAt=?, extra=? WHERE id=?`)
        .bind(status, session.user.uid, t, JSON.stringify({ note: String(body.note || '') }), id).run();
      await logAudit(env, session.user.uid, 'report.resolve', 'report', id, { status, note: body.note || '' });
      return json({ ok:true });
    }

    if (action === 'comment.moderate') {
      const id = String(body.id || '');
      const status = ['published', 'hidden', 'deleted'].includes(String(body.status || '')) ? String(body.status) : 'hidden';
      if (!id) return json({ ok:false, error:'id kerak' }, 400);
      const comment = await env.DB.prepare(`SELECT * FROM comments WHERE id=? LIMIT 1`).bind(id).first();
      if (!comment) return json({ ok:false, error:'Komment topilmadi' }, 404);
      await env.DB.prepare(`UPDATE comments SET status=?, updatedAt=? WHERE id=?`).bind(status, t, id).run();
      await logAudit(env, session.user.uid, 'comment.moderate', 'comment', id, { status });
      if (comment.uid) {
        await addNotification(env, comment.uid, 'Komment moderatsiya qilindi', `Komment holati: ${status}.`, 'moderation', '/notifications');
      }
      return json({ ok:true });
    }

    return json({ ok:false, error:'Noma’lum action' }, 400);
  }, request, env);
}

export async function onRequestOptions({ request, env }) {
  const { empty, corsHeaders } = await import('./_common.js');
  return empty(204, corsHeaders());
}
