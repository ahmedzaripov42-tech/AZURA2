import { json, readJson, route, streamR2 } from './_common.js';

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return json({ ok:false, error:'key kerak' }, 400);
  return streamR2(env, request, key);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);

    const body = await readJson(request);
    const dataUrl = String(body.dataUrl || '');
    if (!dataUrl.startsWith('data:')) return json({ ok:false, error:'dataUrl kerak' }, 400);
    if (dataUrl.length > 12_000_000) {
      return json({ ok:false, error:'Fayl juda katta. Katta video uchun keyin direct signed upload qo‘shiladi.' }, 413);
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return json({ ok:false, error:'dataUrl formati noto‘g‘ri' }, 400);

    const mime = String(body.mime || match[1] || 'application/octet-stream');
    const binary = Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0));
    const filename = String(body.filename || `media_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '-');
    const folder = String(body.folder || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
    const key = `${folder}/${Date.now()}-${filename}`;

    await env.MEDIA.put(key, binary, {
      httpMetadata: {
        contentType: mime,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        originalName: filename,
      },
    });

    return json({
      ok:true,
      key,
      url:`/api/media?key=${encodeURIComponent(key)}`,
      mime,
      size:binary.byteLength,
    });
  }, request, env);
}

export async function onRequestDelete({ request, env }) {
  return route(async (request) => {
    const key = new URL(request.url).searchParams.get('key');
    if (!key) return json({ ok:false, error:'key kerak' }, 400);
    await env.MEDIA.delete(key);
    return json({ ok:true });
  }, request, env);
}
