import { json, route, cleanText, clampInt, badRequest } from './_common.js';

function cleanViewId(value) {
  return cleanText(value || '', '', 160).replace(/[^a-zA-Z0-9:_/-]/g, '');
}

export async function onRequestGet({ request, env }) {
  return route(async (request) => {
    const id = cleanViewId(new URL(request.url).searchParams.get('id'));
    if (id) {
      const r = await env.DB.prepare('SELECT * FROM views WHERE id=?').bind(id).first();
      return json({ ok:true, id, count:Number(r?.count || 0), updatedAt: Number(r?.updatedAt || 0) });
    }
    const limit = clampInt(new URL(request.url).searchParams.get('limit') || 300, 1, 1000, 300);
    const { results } = await env.DB.prepare('SELECT * FROM views ORDER BY updatedAt DESC LIMIT ?').bind(limit).all();
    const views = {};
    (results || []).forEach(r => { views[r.id] = Number(r.count || 0); });
    return json({ ok:true, views });
  }, request, env);
}

export async function onRequestPost({ request, env }) {
  return route(async (request) => {
    const id = cleanViewId(new URL(request.url).searchParams.get('id'));
    if (!id) badRequest('id kerak');
    await env.DB.prepare(`
      INSERT INTO views (id, count, updatedAt)
      VALUES (?, 1, ?)
      ON CONFLICT(id) DO UPDATE SET count=count+1, updatedAt=excluded.updatedAt
    `).bind(id, Date.now()).run();
    const r = await env.DB.prepare('SELECT count, updatedAt FROM views WHERE id=?').bind(id).first();
    return json({ ok:true, id, count:Number(r?.count || 0), updatedAt:Number(r?.updatedAt || 0) });
  }, request, env);
}

export async function onRequestOptions({ request, env }) {
  const { empty, corsHeaders } = await import('./_common.js');
  return empty(204, corsHeaders());
}
