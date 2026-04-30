import { json, readJSON, ensureSchema } from "./_common.js";

async function ensureChapterSchema(DB) {
  await ensureSchema(DB);
  await DB.prepare(`CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    manhwaId TEXT NOT NULL,
    title TEXT,
    chapterNo INTEGER,
    pages TEXT,
    accessType TEXT DEFAULT 'free',
    price INTEGER DEFAULT 0,
    vip INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    createdAt INTEGER,
    updatedAt INTEGER,
    extra TEXT
  )`).run();
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_chapters_manhwa ON chapters(manhwaId)`).run();
}

function norm(row) {
  if (!row) return null;
  let pages = [], extra = {};
  try { pages = row.pages ? JSON.parse(row.pages) : []; } catch (_) {}
  try { extra = row.extra ? JSON.parse(row.extra) : {}; } catch (_) {}
  return { ...extra, id: row.id, manhwaId: row.manhwaId, title: row.title || "", chapterNo: Number(row.chapterNo || 0), pages, accessType: row.accessType || "free", price: Number(row.price || 0), vip: !!row.vip, status: row.status || "published", createdAt: Number(row.createdAt || 0), updatedAt: Number(row.updatedAt || 0) };
}

function makeId(manhwaId, chapterNo) {
  return `${manhwaId || "m"}-${chapterNo || Date.now()}-${Math.random().toString(36).slice(2,7)}`;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return json({ ok: true });
  try {
    if (!env.DB) return json({ ok:false, error:"DB binding missing. Binding name must be DB." }, 500);
    await ensureChapterSchema(env.DB);
    const url = new URL(request.url);

    if (request.method === "GET") {
      const manhwaId = url.searchParams.get("manhwaId");
      if (manhwaId) {
        const rows = await env.DB.prepare("SELECT * FROM chapters WHERE manhwaId=? ORDER BY chapterNo ASC, createdAt ASC").bind(manhwaId).all();
        return json({ ok:true, chapters:(rows.results || []).map(norm) });
      }
      const rows = await env.DB.prepare("SELECT * FROM chapters ORDER BY updatedAt DESC LIMIT 3000").all();
      return json({ ok:true, chapters:(rows.results || []).map(norm) });
    }

    if (request.method === "POST") {
      const body = await readJSON(request);
      const list = Array.isArray(body.chapters) ? body.chapters : [body.chapter || body];
      const saved = [];
      for (const c of list) {
        if (!c || !c.manhwaId) continue;
        const t = Date.now();
        const id = String(c.id || makeId(c.manhwaId, c.chapterNo || c.number)).trim();
        await env.DB.prepare(`
          INSERT INTO chapters (id, manhwaId, title, chapterNo, pages, accessType, price, vip, status, createdAt, updatedAt, extra)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET manhwaId=excluded.manhwaId,title=excluded.title,chapterNo=excluded.chapterNo,pages=excluded.pages,accessType=excluded.accessType,price=excluded.price,vip=excluded.vip,status=excluded.status,updatedAt=excluded.updatedAt,extra=excluded.extra
        `).bind(id, String(c.manhwaId), String(c.title || c.name || ("Bob " + (c.chapterNo || c.number || ""))), Number(c.chapterNo || c.number || c.no || 0), JSON.stringify(c.pages || c.images || c.pageImages || []), String(c.accessType || c.access || "free"), Number(c.price || c.coin || c.coinPrice || 0), c.vip || c.vipOnly ? 1 : 0, String(c.status || "published"), Number(c.createdAt || t), t, JSON.stringify(c.extra || {})).run();
        saved.push(norm(await env.DB.prepare("SELECT * FROM chapters WHERE id=?").bind(id).first()));
      }
      return json({ ok:true, chapters:saved });
    }

    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ ok:false, error:"id required" }, 400);
      await env.DB.prepare("DELETE FROM chapters WHERE id=?").bind(id).run();
      return json({ ok:true });
    }

    return json({ ok:false, error:"Method not allowed" }, 405);
  } catch (err) {
    return json({ ok:false, error:"Chapters API error", message:String(err && err.message ? err.message : err) }, 500);
  }
}
