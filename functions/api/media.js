import { json, readJSON } from "./_common.js";

function safeName(name = "file") {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140) || "file";
}

function extFromMime(mime = "") {
  mime = String(mime).toLowerCase();
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

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extra,
  };
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return json({ ok: true }, 200, corsHeaders());
  }

  try {
    if (!env.MEDIA) {
      return json({ ok: false, error: "R2 binding missing. Binding name must be MEDIA." }, 500, corsHeaders());
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (request.method === "GET" || request.method === "HEAD") {
      if (!key) return json({ ok: false, error: "key required" }, 400, corsHeaders());

      const obj = await env.MEDIA.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: corsHeaders() });

      const headers = new Headers(corsHeaders());
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("accept-ranges", "bytes");
      if (!headers.get("content-type")) headers.set("content-type", "application/octet-stream");

      if (request.method === "HEAD") return new Response(null, { headers });
      return new Response(obj.body, { headers });
    }

    if (request.method === "POST") {
      const body = await readJSON(request);

      let dataUrl = body.dataUrl || body.data || "";
      let filename = safeName(body.filename || "media");
      let mime = body.mime || body.contentType || "";
      let folder = safeName(body.folder || "azura-media");

      if (!dataUrl) return json({ ok: false, error: "dataUrl required" }, 400, corsHeaders());

      let base64 = String(dataUrl);
      const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
      if (m) {
        mime = mime || m[1];
        base64 = m[2];
      }

      if (!mime) mime = "application/octet-stream";
      if (!/\.[a-z0-9]+$/i.test(filename)) filename += extFromMime(mime);

      const bytes = bytesFromBase64(base64);

      // Keep this safe for Pages Functions payload/memory limits.
      // For very large videos later use direct signed upload workflow.
      if (bytes.length > 20 * 1024 * 1024) {
        return json({
          ok: false,
          error: "file_too_large_for_json_upload",
          message: "20MB dan katta video uchun keyingi bosqichda direct R2 signed upload kerak."
        }, 413, corsHeaders());
      }

      const typeFolder = mime.startsWith("video/") ? "videos" : mime.startsWith("image/") ? "images" : "files";
      const key = `${folder}/${typeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${filename}`;

      await env.MEDIA.put(key, bytes, {
        httpMetadata: {
          contentType: mime,
          cacheControl: "public, max-age=31536000, immutable"
        },
        customMetadata: {
          originalName: filename,
          uploadedAt: String(Date.now())
        }
      });

      return json({
        ok: true,
        key,
        url: `/api/media?key=${encodeURIComponent(key)}`,
        mime,
        size: bytes.length
      }, 200, corsHeaders());
    }

    if (request.method === "DELETE") {
      if (!key) return json({ ok: false, error: "key required" }, 400, corsHeaders());
      await env.MEDIA.delete(key);
      return json({ ok: true, deleted: key }, 200, corsHeaders());
    }

    return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders());
  } catch (err) {
    return json({
      ok: false,
      error: "Media API error",
      message: String(err && err.message ? err.message : err)
    }, 500, corsHeaders());
  }
}
