const MAX_TEXT = 200;

function normalizeText(value, max = MAX_TEXT) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeQuery(value) {
  return normalizeText(value, 80).toLowerCase();
}

function isSafeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function getExistingUsage(supabaseUrl, serviceKey, source, sourceId) {
  const params = new URLSearchParams({
    select: 'id,usage_count',
    source: `eq.${source}`,
    source_id: `eq.${sourceId}`,
    limit: '1',
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/reaction_search_cache?${params}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return 0;
  const rows = await response.json();
  return Number(rows?.[0]?.usage_count || 0);
}

async function storeFallback(asset) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { stored: false, reason: 'storage_not_configured' };

  const source = 'fallback';
  const sourceId = normalizeText(asset.sourceId || asset.id || asset.gifUrl, 180);
  const usageCount = await getExistingUsage(supabaseUrl, serviceKey, source, sourceId);
  const now = new Date().toISOString();
  const row = {
    query: normalizeText(asset.query || ''),
    normalized_query: normalizeQuery(asset.query || asset.title || ''),
    source,
    source_id: sourceId,
    title: normalizeText(asset.title || 'FWD reaction'),
    tags: Array.isArray(asset.tags) ? asset.tags.map((tag) => normalizeText(tag, 40)).filter(Boolean).slice(0, 12) : [],
    preview_url: asset.previewUrl,
    gif_url: asset.gifUrl,
    width: Number(asset.width) || null,
    height: Number(asset.height) || null,
    share_url: isSafeUrl(asset.shareUrl) ? asset.shareUrl : null,
    attribution_label: null,
    attribution_url: null,
    content_rating: normalizeText(asset.contentRating || 'safe', 40),
    usage_count: usageCount + 1,
    last_used_at: now,
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/reaction_search_cache?on_conflict=source,source_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) return { stored: false, reason: 'storage_failed' };
  return { stored: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const asset = body?.asset || {};

    if (asset.source !== 'fallback') {
      return json(res, 200, { ok: true, captured: false });
    }

    if (!isSafeUrl(asset.previewUrl) || !isSafeUrl(asset.gifUrl)) {
      return json(res, 400, { ok: false, error: 'Invalid reaction asset' });
    }

    const result = await storeFallback(asset);
    return json(res, 200, { ok: true, captured: result.stored });
  } catch {
    return json(res, 200, { ok: true, captured: false });
  }
}
