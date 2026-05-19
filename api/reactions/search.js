const DEFAULT_LIMIT = Number(process.env.RAPID_REACTION_DEFAULT_LIMIT || 10);
const MAX_LIMIT = 20;
const CACHE_TTL_MS = 1000 * 60 * 15;
const ABUSIVE_QUERY = /(?:<script|javascript:|data:|vbscript:|\0)/i;
const memoryCache = new Map();

const fallbackPack = [
  ['fwd:r10', 'Crying Laugh', 'laugh lol funny dead hilarious', 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif'],
  ['fwd:r4', 'Eye Roll', 'side eye sus annoyed done', 'https://media.giphy.com/media/Fjr6v88OPk7U4/giphy.gif'],
  ['fwd:r5', 'Mic Drop', 'period facts ate done win', 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/giphy.gif'],
  ['fwd:r18', 'Crying Sad', 'crying sad hurt tears', 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif'],
  ['fwd:r20', 'Heart Eyes', 'love bae cute heart adorable', 'https://media.giphy.com/media/26vUxJ9rqfwuIEkTu/giphy.gif'],
  ['fwd:m7', 'Confused Math', 'wait what confused huh thinking', 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif'],
  ['fwd:r19', 'Angry Rage', 'mad angry pissed rage furious', 'https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/giphy.gif'],
  ['fwd:r9', 'Shocked Face', 'what shocked surprised omg', 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif'],
  ['fwd:r3', 'Slow Clap', 'clap applause respect bravo facts', 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif'],
  ['fwd:r22', 'Popcorn Time', 'tea drama watching side eye', 'https://media.giphy.com/media/pUeXcg80cO8I8/giphy.gif'],
  ['fwd:g6', 'Among Us Sus', 'sus suspicious side eye hmm', 'https://media.giphy.com/media/RtdRhc7TxBxB0YAsK6/giphy.gif'],
  ['fwd:m20', 'Drake Yes', 'yes approve facts period', 'https://media.giphy.com/media/RrVzUOXldFe8M/giphy.gif'],
];

function normalizeQuery(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 80);
}

function toFallbackAsset(item, query) {
  const [, title, tags, url] = item;
  return {
    id: item[0],
    source: 'fallback',
    sourceId: item[0].replace(/^fwd:/, ''),
    query,
    title,
    tags: tags.split(' '),
    previewUrl: url,
    gifUrl: url,
  };
}

function searchFallbackPack(query, limit) {
  const normalized = normalizeQuery(query);
  const scored = fallbackPack
    .map((item) => {
      const haystack = `${item[1]} ${item[2]}`.toLowerCase();
      let score = normalized ? 0 : 1;
      if (haystack.includes(normalized)) score += 50;
      normalized.split(' ').forEach((part) => {
        if (part && haystack.includes(part)) score += 10;
      });
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => toFallbackAsset(item, normalized));

  const filled = dedupe([
    ...scored,
    ...fallbackPack.map((item) => toFallbackAsset(item, normalized)),
  ]);
  return filled.slice(0, limit);
}

function dedupe(assets) {
  const seen = new Set();
  const out = [];
  for (const asset of assets) {
    const keys = [
      `${asset.source}:${asset.sourceId || asset.id}`,
      String(asset.title || '').toLowerCase(),
      asset.gifUrl,
      asset.previewUrl,
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    out.push(asset);
  }
  return out;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function giphyAsset(item, query) {
  const fixed = item.images?.fixed_width;
  const small = item.images?.fixed_width_small;
  const preview = small || item.images?.preview_gif || fixed;
  const original = item.images?.original || fixed || preview;
  if (!preview?.url || !original?.url) return null;
  const mp4Url = original?.mp4 || fixed?.mp4 || small?.mp4 || undefined;
  return {
    id: `giphy:${item.id}`,
    source: 'giphy',
    sourceId: item.id,
    query,
    title: item.title || 'GIPHY reaction',
    tags: query.split(' ').filter(Boolean),
    previewUrl: preview.url,
    gifUrl: original.url,
    mp4Url,
    width: Number(original.width || preview.width) || undefined,
    height: Number(original.height || preview.height) || undefined,
    shareUrl: item.url,
    attributionLabel: 'Powered by GIPHY',
    attributionUrl: 'https://giphy.com/',
    contentRating: item.rating,
    createdAt: item.import_datetime,
  };
}

function tenorAsset(item, query) {
  const media = item.media_formats || {};
  const preview = media.tinygif || media.nanogif || media.gif;
  const full = media.gif || preview;
  const mp4 = media.mp4 || media.tinymp4 || media.nanomp4;
  if (!preview?.url || !full?.url) return null;
  const dims = full.dims || preview?.dims || [];
  return {
    id: `tenor:${item.id}`,
    source: 'tenor',
    sourceId: item.id,
    query,
    title: item.content_description || item.title || 'Tenor reaction',
    tags: [query, ...(item.tags || [])].filter(Boolean),
    previewUrl: preview.url,
    gifUrl: full.url,
    mp4Url: mp4?.url || undefined,
    width: Array.isArray(dims) ? dims[0] : undefined,
    height: Array.isArray(dims) ? dims[1] : undefined,
    shareUrl: item.itemurl,
    attributionLabel: 'Powered by Tenor',
    attributionUrl: 'https://tenor.com/',
    contentRating: item.content_description,
    createdAt: item.created ? new Date(item.created * 1000).toISOString() : undefined,
  };
}

async function fetchGiphy(query, limit, offset) {
  if (!process.env.GIPHY_API_KEY) return [];
  const params = new URLSearchParams({
    api_key: process.env.GIPHY_API_KEY,
    q: query,
    limit: String(limit),
    offset: String(offset || 0),
    rating: 'pg-13',
    lang: 'en',
    bundle: 'messaging_non_clips',
  });
  const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
  if (!response.ok) throw new Error(`giphy_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data.map((item) => giphyAsset(item, query)).filter(Boolean) : [];
}

async function fetchTenor(query, limit, cursor) {
  if (!process.env.TENOR_API_KEY) return [];
  const params = new URLSearchParams({
    key: process.env.TENOR_API_KEY,
    q: query,
    limit: String(limit),
    media_filter: 'gif,tinygif',
    contentfilter: 'medium',
    locale: 'en_US',
  });
  if (cursor) params.set('pos', cursor);
  const response = await fetch(`https://tenor.googleapis.com/v2/search?${params}`);
  if (!response.ok) throw new Error(`tenor_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results.map((item) => tenorAsset(item, query)).filter(Boolean) : [];
}

async function writeCache(results) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !results.length) return;
  const rows = results
    .filter((item) => item.source === 'giphy' || item.source === 'tenor')
    .map((item) => ({
      query: item.query,
      normalized_query: normalizeQuery(item.query),
      source: item.source,
      source_id: item.sourceId,
      title: item.title,
      tags: item.tags || [],
      preview_url: item.previewUrl,
      gif_url: item.gifUrl,
      width: item.width || null,
      height: item.height || null,
      share_url: item.shareUrl || null,
      attribution_label: item.attributionLabel || null,
      attribution_url: item.attributionUrl || null,
      content_rating: item.contentRating || null,
      last_used_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/reaction_search_cache?on_conflict=source,source_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const query = normalizeQuery(req.query.q);
  const limit = Math.min(Math.max(Number(req.query.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const provider = normalizeQuery(req.query.provider);
  const cursor = req.query.cursor || req.query.offset || '';
  const enabled = process.env.RAPID_REACTION_SCOUT_ENABLED !== 'false';

  if (!query || query.length < 2 || ABUSIVE_QUERY.test(query)) {
    const results = searchFallbackPack(query, limit);
    return json(res, 200, {
      query,
      limit,
      results,
      sourcesUsed: ['fallback'],
      hasMore: false,
      nextCursor: null,
      fallbackUsed: true,
      attribution: [],
    });
  }

  const cacheKey = `${query}:${limit}:${cursor}:${provider || 'all'}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return json(res, 200, cached.body);
  }

  const local = searchFallbackPack(query, limit).map((item) => ({ ...item, source: 'fwd' }));
  let external = [];
  const sourcesUsed = new Set(local.length ? ['fwd'] : []);
  const attribution = [];

  if (enabled && local.length < limit) {
    const remaining = limit - local.length;
    const tasks = [];
    if (!provider || provider === 'giphy') tasks.push(fetchGiphy(query, remaining, Number(cursor) || 0).then((items) => ({ source: 'giphy', items })).catch(() => ({ source: 'giphy', items: [] })));
    if (!provider || provider === 'tenor') tasks.push(fetchTenor(query, remaining, cursor).then((items) => ({ source: 'tenor', items })).catch(() => ({ source: 'tenor', items: [] })));
    const settled = await Promise.all(tasks);
    external = settled.flatMap((result) => {
      if (result.items.length) {
        sourcesUsed.add(result.source);
        if (result.source === 'giphy') attribution.push({ source: 'giphy', label: 'Powered by GIPHY' });
        if (result.source === 'tenor') attribution.push({ source: 'tenor', label: 'Powered by Tenor' });
      }
      return result.items;
    });
  }

  const merged = dedupe([...local, ...external]).slice(0, limit);
  const fallbackUsed = merged.length === 0 || external.length === 0;
  const results = merged.length ? merged : searchFallbackPack(query, limit);
  if (!merged.length) sourcesUsed.add('fallback');

  const body = {
    query,
    limit,
    results,
    sourcesUsed: Array.from(sourcesUsed),
    hasMore: external.length >= Math.max(1, limit - local.length),
    nextCursor: String((Number(cursor) || 0) + limit),
    fallbackUsed,
    attribution,
  };

  memoryCache.set(cacheKey, { createdAt: Date.now(), body });
  writeCache(external);
  return json(res, 200, body);
};
