const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function clean(value: unknown, max = 500) {
  const text = typeof value === 'string' ? value : '';
  return text.trim().replace(/\s+/g, ' ').slice(0, max) || null;
}

function cleanUrl(value: unknown) {
  const text = clean(value, 1500);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.round(next) : null;
}

function bearer(req: any) {
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function authenticate(req: any) {
  const token = bearer(req);
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(res, 500, { error: 'Save service unavailable' });

  try {
    const user = await authenticate(req);
    if (!user?.id) return json(res, 401, { error: 'Authentication required' });

    const body = await readBody(req);
    const provider = clean(body.provider, 40);
    const providerGifId = clean(body.providerGifId, 180);
    if (!provider || !providerGifId) return json(res, 400, { error: 'Missing provider or providerGifId' });
    if (!['giphy', 'tenor'].includes(provider)) return json(res, 400, { error: 'Unsupported provider' });

    const row = {
      user_id: user.id,
      provider,
      provider_gif_id: providerGifId,
      title: clean(body.title, 180),
      original_query: clean(body.originalQuery, 180),
      ai_scout_query: clean(body.aiScoutQuery, 180),
      preview_url: cleanUrl(body.previewUrl),
      media_url: cleanUrl(body.mediaUrl),
      mp4_url: cleanUrl(body.mp4Url),
      webm_url: cleanUrl(body.webmUrl),
      gif_url: cleanUrl(body.gifUrl),
      poster_url: cleanUrl(body.posterUrl),
      width: cleanNumber(body.width),
      height: cleanNumber(body.height),
      duration_ms: cleanNumber(body.durationMs),
      source_url: cleanUrl(body.sourceUrl) || cleanUrl(body.mediaUrl) || cleanUrl(body.gifUrl),
      attribution: clean(body.attribution, 180),
      rating: clean(body.rating, 80),
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {},
    };

    if (!row.source_url || !row.media_url) {
      return json(res, 400, { error: 'Missing GIF media URL' });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/saved_gifs?on_conflict=user_id,provider,provider_gif_id&select=*`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.warn('Saved GIF insert failed', { status: response.status, provider, userId: user.id });
      return json(res, 500, { error: 'Could not save this GIF. Try again.' });
    }

    return json(res, 200, { savedGif: Array.isArray(payload) ? payload[0] : payload });
  } catch (error: any) {
    console.warn('Saved GIF request failed', { reason: error?.message || String(error) });
    return json(res, 500, { error: 'Could not save this GIF. Try again.' });
  }
}
