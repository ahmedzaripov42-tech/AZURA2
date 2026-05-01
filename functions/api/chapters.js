import {
  json,
  readJson,
  route,
  safeParse,
  requireStaff,
  getSession,
  cleanText,
  cleanSlug,
  clampInt,
  clampNumber,
  badRequest,
  notFound,
  unprocessable,
} from './_common.js';

const VALID_ACCESS = new Set(['free', 'vip', 'coin', 'paid']);
const VALID_STATUS = new Set(['draft', 'published', 'archived']);

const norm = r => r && ({
  ...r,
  chapterNo: Number(r.chapterNo || 0),
  price: Number(r.price || 0),
  vip: !!Number(r.vip || 0),
  pages: safeParse(r.pages, []),
  extra: safeParse(r.extra, {}),
});

function normalizePages(input) {
  const pages = Array.isArray(input) ? input : safeParse(input, []);
  return (Array.isArray(pages) ? pages : [])
    .map(page => {
      if (typeof page === 'string') return page.slice(0, 4096);
      if (!page || typeof page !== 'object') return null;
      return {
        ...page,
        src: String(page.src || page.url || '').slice(0, 4096),
        thumb: String(page.thumb || '').slice(0, 4096),
        mime: cleanText(page.mime || '', '', 120),
      };
    })
    .filter(Boolean)
    .slice(0, 400);
}

async function audit(env, actorUid, action, chapterId, meta = null) {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actorUid, action, targetType, targetId, meta, createdAt)
    VALUES (?, ?, ?, 'chapter', ?, ?, ?)
  `).bind(`audit_${t}_${Math.random().toString(36).slice(2, 7)}`, actorUid || '', action, chapterId || '', JSON.stringify(meta || {}), t).run();
}

async function save(env, ch, actorUid = '') {
  const t = Date.now();
  const id = String(ch.id || `ch_${ch.manhwaId}_${ch.chapterNo || t}_${Math.random().toString(36).slice(2,7)}`);
  const manhwaId = cleanSlug(ch.manhwaId || '', '');
  const chapterNo = clampNumber(ch.chapterNo ?? ch.number ?? 0, 0, 999999, 0);
  const title = cleanText(ch.title || `Bob ${chapterNo || ''}`, `Bob ${chapterNo || ''}`, 180);
  const accessType = String(ch.accessType || ch.access || 'free').toLowerCase();
  const status = String(ch.status || 'published').toLowerCase();
  const pages = normalizePages(ch.pages);

  if (!manhwaId) badRequest('manhwaId kerak');
  if (!chapterNo) badRequest('chapterNo kerak');
  if (!VALID_ACCESS.has(accessType)) unprocessable('accessType noto‘g‘ri');
  if (!VALID_STATUS.has(status)) unprocessable('status noto‘g‘ri');
  if (!pages.length && !safeParse(ch.extra, {})?.pdfId && !ch.pdfId) badRequest('Chapter sahifalari yoki pdfId kerak');

  const chapter = {
    id: id.slice(0, 190),
    manhwaId,
    title,
    chapterNo,
    pages,
    accessType,
    price: clampInt(ch.price ?? ch.coinPrice ?? 0, 0, 9999999, 0),
    vip: ch.vip || ch.vipOnly || ch.access === 'vip' ? 1 : 0,
    status,
    createdAt: clampInt(ch.createdAt || t, 0, 9999999999999, t),
    updatedAt: t,
    extra: {
      ...(safeParse(ch.extra, {}) || {}),
      ...(ch.format ? { format: cleanText(ch.format, '', 32) } : {}),
      ...(ch.contentType ? { contentType: cleanText(ch.contentType, '', 120) } : {}),
      ...(ch.pdfId ? { pdfId: cleanText(ch.pdfId, '', 190) } : {}),
      ...(ch.pageIds ? { pageIds: Array.isArray(ch.pageIds) ? ch.pageIds.slice(0, 400).map(v => String(v).slice(0, 190)) : [] } : {}),
      ...(ch.pageCount != null ? { pageCount: clampInt(ch.pageCount, 0, 4000, pages.length) } : {}),
      ...(ch.trailerVideo ? { trailerVideo: String(ch.trailerVideo).slice(0, 4096) } : {}),
    },
  };

  await env.DB.prepare(`
    INSERT INTO chapters (id, manhwaId, title, chapterNo, pages, accessType, price, vip, status, createdAt, updatedAt, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      manhwaId=excluded.manhwaId,
      title=excluded.title,
      chapterNo=excluded.chapterNo,
      pages=excluded.pages,
      accessType=excluded.accessType,
      price=excluded.price,
      vip=excluded.vip,
      status=excluded.status,
      updatedAt=excluded.updatedAt,
      extra=excluded.extra
  `).bind(
    chapter.id,
    chapter.manhwaId,
    chapter.title,
    chapter.chapterNo,
    JSON.stringify(chapter.pages || []),
    chapter.accessType,
    chapter.price,
    chapter.vip,
    chapter.status,
    chapter.createdAt,
    chapter.updatedAt,
    JSON.stringify(chapter.extra || {})
  ).run();

  await audit(env, actorUid, 'chapter.save', chapter.id, {
    manhwaId: chapter.manhwaId,
    chapterNo: chapter.chapterNo,
    status: chapter.status,
  });

  return norm(await env.DB.prepare('SELECT * FROM chapters WHERE id=?').bind(chapter.id).first());
}

export async function onRequestGet({ request, env }) {
  return route(async (request) => {
    const url = new URL(request.url);
    const manhwaId = cleanSlug(url.searchParams.get('manhwaId') || '', '');
    const limit = clampInt(url.searchParams.get('limit') || (manhwaId ? 300 : 120), 1, 500, manhwaId ? 300 : 120);
    const session = await getSession(env, request).catch(() => null);
    const canSeeHidden = !!session?.user && ['owner', 'admin'].includes(session.user.role);
    const status = canSeeHidden
      ? (VALID_STATUS.has(String(url.searchParams.get('status') || '').toLowerCase()) ? String(url.searchParams.get('status')).toLowerCase() : '')
      : 'published';

    let query;
    if (manhwaId && status) {
      query = env.DB.prepare(`SELECT * FROM chapters WHERE manhwaId=? AND status=? ORDER BY chapterNo DESC, createdAt DESC LIMIT ?`).bind(manhwaId, status, limit);
    } else if (manhwaId) {
      query = env.DB.prepare(`SELECT * FROM chapters WHERE manhwaId=? ORDER BY chapterNo DESC, createdAt DESC LIMIT ?`).bind(manhwaId, limit);
    } else if (status) {
      query = env.DB.prepare(`SELECT * FROM chapters WHERE status=? ORDER BY createdAt DESC LIMIT ?`).bind(status, limit);
    } else {
      query = env.DB.prepare(`SELECT * FROM chapters ORDER BY createdAt DESC LIMIT ?`).bind(limit);
    }

    const { results } = await query.all();
    return json({ ok:true, chapters:(results || []).map(norm) });
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    const b = await readJson(request);
    const arr = Array.isArray(b) ? b : (Array.isArray(b.chapters) ? b.chapters : [b]);
    if (!arr.length) return json({ ok:false, error:'chapter payload kerak' }, 400);
    const out = [];
    for (const ch of arr.slice(0, 50)) {
      if (ch && ch.manhwaId) out.push(await save(env, ch, session.user.uid));
    }
    return json({ ok:true, chapters:out });
  }, request, env);
}

export async function onRequestPatch({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    const body = await readJson(request);
    if (!body.id) return json({ ok:false, error:'id kerak' }, 400);
    const current = await env.DB.prepare('SELECT * FROM chapters WHERE id=?').bind(String(body.id)).first();
    if (!current) notFound('Bob topilmadi');

    const currentExtra = safeParse(current.extra, {});
    const next = {
      ...norm(current),
      ...body,
      manhwaId: body.manhwaId || current.manhwaId,
      chapterNo: Number(body.chapterNo ?? body.number ?? current.chapterNo),
      accessType: String(body.accessType || body.access || current.accessType),
      price: Number(body.price ?? body.coinPrice ?? current.price),
      vip: body.vip != null ? !!body.vip : !!Number(current.vip || 0),
      pages: body.pages != null ? body.pages : norm(current).pages,
      status: body.status || current.status,
      extra: {
        ...currentExtra,
        ...(safeParse(body.extra, {}) || {}),
      },
    };
    const chapter = await save(env, next, session.user.uid);
    return json({ ok:true, chapter });
  }, request, env);
}

export async function onRequestDelete({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    const id = cleanText(new URL(request.url).searchParams.get('id') || '', '', 190);
    if (!id) return json({ ok:false, error:'id kerak' }, 400);

    const chapter = await env.DB.prepare(`SELECT id, manhwaId, chapterNo FROM chapters WHERE id=? LIMIT 1`).bind(id).first();
    if (!chapter) return json({ ok:false, error:'Bob topilmadi' }, 404);

    await env.DB.prepare('DELETE FROM chapters WHERE id=?').bind(id).run();
    await audit(env, session.user.uid, 'chapter.delete', id, {
      manhwaId: chapter.manhwaId,
      chapterNo: Number(chapter.chapterNo || 0),
    });
    return json({ ok:true });
  }, request, env);
}

export async function onRequestOptions({ request, env }) {
  const { empty, corsHeaders } = await import('./_common.js');
  return empty(204, corsHeaders());
}
