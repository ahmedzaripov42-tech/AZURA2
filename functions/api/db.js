import {
  json,
  readJson,
  route,
  safeParse,
  getSession,
  isPublicAppDataKey,
  getUserLibraryUidFromKey,
  cleanText,
  MAX_APP_DATA_BYTES,
  payloadTooLarge,
  badRequest,
} from './_common.js';

function canAccessKey(key, session, mode = 'read') {
  const normalized = String(key || '');
  if (!normalized) return false;
  if (isPublicAppDataKey(normalized)) {
    if (mode === 'read') return true;
    return !!session?.user && ['owner', 'admin'].includes(session.user.role);
  }

  const libraryUid = getUserLibraryUidFromKey(normalized);
  if (libraryUid) {
    if (!session?.user) return false;
    return session.user.uid === libraryUid || ['owner', 'admin'].includes(session.user.role);
  }

  return !!session?.user && ['owner', 'admin'].includes(session.user.role);
}

function safeKey(value) {
  return cleanText(value || '', '', 160).replace(/[^a-zA-Z0-9:_/-]/g, '');
}

export async function onRequestGet({ request, env }) {
  return route(async (request) => {
    const key = safeKey(new URL(request.url).searchParams.get('key'));
    const session = await getSession(env, request);

    if (key) {
      if (!canAccessKey(key, session, 'read')) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
      const r = await env.DB.prepare('SELECT * FROM app_data WHERE key=?').bind(key).first();
      return json({ ok:true, key, value:safeParse(r?.value, null), updatedAt:r?.updatedAt || 0 });
    }

    if (!session?.user || !['owner', 'admin'].includes(session.user.role)) {
      return json({ ok:false, error:'Ruxsat yo‘q' }, 403);
    }

    const { results } = await env.DB.prepare('SELECT * FROM app_data ORDER BY updatedAt DESC LIMIT 500').all();
    const data = {};
    (results || []).forEach(r => {
      data[r.key] = safeParse(r.value, null);
    });
    return json({ ok:true, data });
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const session = await getSession(env, request);
    const b = await readJson(request);
    const key = safeKey(b.key);
    if (!key) badRequest('key kerak');
    if (!canAccessKey(key, session, 'write')) return json({ ok:false, error:'Ruxsat yo‘q' }, 403);

    const serialized = JSON.stringify(b.value ?? null);
    if ((new TextEncoder().encode(serialized)).byteLength > MAX_APP_DATA_BYTES) {
      payloadTooLarge('app_data juda katta');
    }

    const t = Number(b.updatedAt || Date.now());
    await env.DB.prepare(`
      INSERT INTO app_data (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt
    `).bind(key, serialized, t).run();

    return json({ ok:true, key, updatedAt:t });
  }, request, env);
}

export async function onRequestOptions({ request, env }) {
  const { empty, corsHeaders } = await import('./_common.js');
  return empty(204, corsHeaders());
}
