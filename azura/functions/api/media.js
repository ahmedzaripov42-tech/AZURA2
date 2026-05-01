import {
  json,
  route,
  streamR2,
  requireStaff,
  cleanSlug,
  cleanText,
  badRequest,
  payloadTooLarge,
  clampInt,
  unprocessable,
} from './_common.js';

const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/zip',
  'application/json',
]);

function sanitizeName(value, fallback = 'media') {
  const raw = String(value || fallback).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  return raw.slice(0, 120) || fallback;
}

function sanitizeFolder(value, fallback = 'uploads') {
  const safe = cleanSlug(value || fallback, fallback).replace(/^\/+|\/+$/g, '');
  return safe || fallback;
}

function isAllowedMime(mime) {
  const normalized = String(mime || '').toLowerCase();
  return !!normalized && (ALLOWED_MIME_EXACT.has(normalized) || ALLOWED_MIME_PREFIXES.some(prefix => normalized.startsWith(prefix)));
}

function dataUrlToBytes(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = String(match[1] || 'application/octet-stream').toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');
  const binary = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
  return { mime, binary };
}

async function parseUpload(request) {
  const contentType = request.headers.get('content-type') || '';

  if (/multipart\/form-data/i.test(contentType)) {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') badRequest('file kerak');
    const binary = new Uint8Array(await file.arrayBuffer());
    return {
      filename: sanitizeName(form.get('filename') || file.name || `media_${Date.now()}`),
      folder: sanitizeFolder(form.get('folder') || 'uploads'),
      mime: cleanText(form.get('mime') || file.type || 'application/octet-stream', 'application/octet-stream', 120).toLowerCase(),
      binary,
    };
  }

  const body = await request.json().catch(() => ({}));
  const dataUrl = String(body.dataUrl || '');
  if (!dataUrl.startsWith('data:')) badRequest('dataUrl yoki multipart file kerak');
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) badRequest('dataUrl formati noto‘g‘ri');
  return {
    filename: sanitizeName(body.filename || `media_${Date.now()}`),
    folder: sanitizeFolder(body.folder || 'uploads'),
    mime: cleanText(body.mime || parsed.mime || 'application/octet-stream', 'application/octet-stream', 120).toLowerCase(),
    binary: parsed.binary,
  };
}

async function audit(env, actorUid, action, targetId, meta = null) {
  const t = Date.now();
  await env.DB.prepare(`
    INSERT INTO audit_log (id, actorUid, action, targetType, targetId, meta, createdAt)
    VALUES (?, ?, ?, 'media', ?, ?, ?)
  `).bind(`audit_${t}_${Math.random().toString(36).slice(2, 7)}`, actorUid || '', action, targetId || '', JSON.stringify(meta || {}), t).run();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('list') === '1') {
    return route(async (request) => {
      await requireStaff(env, request);
      const folder = sanitizeFolder(url.searchParams.get('folder') || '', '');
      const status = ['active', 'deleted'].includes(String(url.searchParams.get('status') || '')) ? String(url.searchParams.get('status')) : 'active';
      const limit = clampInt(url.searchParams.get('limit') || 120, 1, 200, 120);
      const query = folder
        ? env.DB.prepare(`SELECT * FROM media_assets WHERE status=? AND folder=? ORDER BY createdAt DESC LIMIT ?`).bind(status, folder, limit)
        : env.DB.prepare(`SELECT * FROM media_assets WHERE status=? ORDER BY createdAt DESC LIMIT ?`).bind(status, limit);
      const { results } = await query.all();
      return json({ ok:true, assets: results || [] });
    }, request, env);
  }

  const key = cleanSlug(url.searchParams.get('key') || '', '');
  if (!key) return json({ ok:false, error:'key kerak' }, 400);
  return streamR2(env, request, key);
}

export async function onRequestHead({ request, env }) {
  const url = new URL(request.url);
  const key = cleanSlug(url.searchParams.get('key') || '', '');
  if (!key) return json({ ok:false, error:'key kerak' }, 400);
  return streamR2(env, request, key, { head:true });
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);

    const upload = await parseUpload(request);
    if (!isAllowedMime(upload.mime)) unprocessable('Bu media turi qo‘llab-quvvatlanmaydi', 'unsupported_media_type');
    if (upload.binary.byteLength < 1) badRequest('Bo‘sh fayl yuklab bo‘lmaydi');
    if (upload.binary.byteLength > MAX_UPLOAD_BYTES) payloadTooLarge('Fayl juda katta');

    const safeFolder = sanitizeFolder(upload.folder, 'uploads');
    const safeFilename = sanitizeName(upload.filename, `media_${Date.now()}`);
    const key = `${safeFolder}/${Date.now()}-${safeFilename}`;
    const createdAt = Date.now();

    await env.MEDIA.put(key, upload.binary, {
      httpMetadata: {
        contentType: upload.mime,
        cacheControl: 'public, max-age=31536000, immutable, stale-while-revalidate=86400',
      },
      customMetadata: {
        originalName: safeFilename,
        uploadedBy: session.user.uid,
      },
    });

    const id = `media_${createdAt}_${Math.random().toString(36).slice(2, 7)}`;
    const url = `/api/media?key=${encodeURIComponent(key)}`;
    await env.DB.prepare(`
      INSERT INTO media_assets (id, key, url, mime, size, folder, status, createdBy, createdAt, extra)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).bind(
      id,
      key,
      url,
      upload.mime,
      upload.binary.byteLength,
      safeFolder,
      session.user.uid,
      createdAt,
      JSON.stringify({ filename: safeFilename })
    ).run();

    await audit(env, session.user.uid, 'media.upload', id, {
      key,
      mime: upload.mime,
      size: upload.binary.byteLength,
      folder: safeFolder,
    });

    return json({
      ok:true,
      id,
      key,
      url,
      mime:upload.mime,
      size:upload.binary.byteLength,
      folder:safeFolder,
      filename:safeFilename,
    });
  }, request, env);
}

export async function onRequestDelete({ request, env }) {
  return route(async (request) => {
    const session = await requireStaff(env, request);
    const url = new URL(request.url);
    const key = cleanSlug(url.searchParams.get('key') || '', '');
    if (!key) return json({ ok:false, error:'key kerak' }, 400);
    if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);

    await env.MEDIA.delete(key);
    const current = await env.DB.prepare(`SELECT extra FROM media_assets WHERE key=? LIMIT 1`).bind(key).first();
    const extra = Object.assign({}, current && current.extra ? JSON.parse(current.extra) : {}, {
      deletedAt: Date.now(),
      deletedBy: session.user.uid,
    });

    await env.DB.prepare(`UPDATE media_assets SET status='deleted', extra=? WHERE key=?`)
      .bind(JSON.stringify(extra), key).run();
    await audit(env, session.user.uid, 'media.delete', key, { key });

    return json({ ok:true });
  }, request, env);
}
