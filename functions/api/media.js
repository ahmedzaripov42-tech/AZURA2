import { json, readJSON, ensureSchema } from "./_common.js";

function safeName(name = "file") {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "file";
}

function extFromMime(mime = "") {
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("pdf")) return ".pdf";
  return "";
}

function bytesFromBase64(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok: true });

  try {
    if (!env.MEDIA) {
      return json({ ok: false, error: "R2 binding missing. Binding name must be MEDIA." }, 500);
    }

    const url = new URL(request.url);

    if (request.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return json({ ok: false, error: "key required" }, 400);

      const obj = await env.MEDIA.get(key);
      if (!obj) return new Response("Not found", { status: 404 });

      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("access-control-allow-origin", "*");
      if (!headers.get("content-type")) headers.set("content-type", "application/octet-stream");
      return new Response(obj.body, { headers });
    }

    if (request.method === "POST") {
      const body = await readJSON(request);
      let dataUrl = body.dataUrl || body.data || "";
      let filename = safeName(body.filename || "media");
      let mime = body.mime || body.contentType || "";

      if (!dataUrl) return json({ ok: false, error: "dataUrl required" }, 400);

      let base64 = dataUrl;
      const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
      if (m) {
        mime = mime || m[1];
        base64 = m[2];
      }

      const bytes = bytesFromBase64(base64);
      if (!mime) mime = "application/octet-stream";
      if (!/\.[a-z0-9]+$/i.test(filename)) filename += extFromMime(mime);

      const prefix = body.folder || "azura";
      const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${filename}`;

      await env.MEDIA.put(key, bytes, {
        httpMetadata: {
          contentType: mime,
          cacheControl: "public, max-age=31536000, immutable"
        }
      });

      const publicUrl = `/api/media?key=${encodeURIComponent(key)}`;
      return json({ ok: true, key, url: publicUrl, mime, size: bytes.length });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    return json({
      ok: false,
      error: "Media API error",
      message: String(err && err.message ? err.message : err)
    }, 500);
  }
}
