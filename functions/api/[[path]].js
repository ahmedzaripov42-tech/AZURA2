import { json, empty, corsHeaders } from './_common.js';

export async function onRequestOptions() {
  return empty(204, corsHeaders());
}

export async function onRequest({ request }) {
  return json({ ok:false, error:'API endpoint yoki HTTP method noto‘g‘ri', code:'not_found_or_method', method:request.method }, 404);
}
