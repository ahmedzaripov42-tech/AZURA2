import { json, readJson, route, streamR2 } from './_common.js';
export async function onRequestGet({ request, env }) { const key = new URL(request.url).searchParams.get('key'); if (!key) return json({ ok:false, error:'key kerak' }, 400); return streamR2(env, key); }
export async function onRequestPost({ request, env }) { return route(async (request) => {
  if (!env.MEDIA) return json({ ok:false, error:'R2 binding MEDIA topilmadi' }, 500);
  const b = await readJson(request); const dataUrl = String(b.dataUrl || '');
  if (!dataUrl.startsWith('data:')) return json({ ok:false, error:'dataUrl kerak' },400);
  if (dataUrl.length > 12_000_000) return json({ ok:false, error:'Fayl juda katta. Katta video uchun keyin direct signed upload qo‘shiladi.' },413);
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/); if(!m) return json({ok:false,error:'dataUrl formati noto‘g‘ri'},400);
  const mime = b.mime || m[1]; const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  const clean = String(b.filename || `media_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g,'-');
  const folder = String(b.folder || 'uploads').replace(/[^a-zA-Z0-9/_-]/g,''); const key = `${folder}/${Date.now()}-${clean}`;
  await env.MEDIA.put(key, bin, { httpMetadata:{ contentType:mime }, customMetadata:{ originalName:clean } });
  return json({ ok:true, key, url:`/api/media?key=${encodeURIComponent(key)}`, mime, size:bin.byteLength });
}, request, env); }
export async function onRequestDelete({ request, env }) { return route(async (request) => { const key = new URL(request.url).searchParams.get('key'); if(!key) return json({ok:false,error:'key kerak'},400); await env.MEDIA.delete(key); return json({ok:true}); }, request, env); }
