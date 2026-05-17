import giphy from '../../src/lib/gif-providers/giphy.js';
import tenor from '../../src/lib/gif-providers/tenor.js';
import type { GifProviderName, GifScoutResult, SafeProviderError } from '../../src/lib/gif-providers/types.js';

const AI_MODEL = process.env.VERCEL_AI_MODEL || process.env.AI_GATEWAY_MODEL || 'openai/gpt-5.4';
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const CACHE_TTL_MS = 1000 * 60 * 5;
const PROVIDER_TIMEOUT_MS = 1800;
const MAX_QUERY = 160;
const MAX_LIMIT = 24;
const memoryCache = new Map<string, { createdAt: number; body: ScoutResponse }>();

type ScoutResponse = {
  query: string;
  scoutQueries: string[];
  scoutedQueries: string[];
  rareResults: GifScoutResult[];
  regularResults: GifScoutResult[];
  providerErrors: SafeProviderError[];
};

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

function clean(value: unknown, max = MAX_QUERY) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalize(value: unknown) {
  return clean(value).toLowerCase();
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => normalize(value))
    .filter((value) => value.length >= 2 && !/(?:<script|javascript:|data:|vbscript:|\0)/i.test(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function fallbackQueries(query: string, context = '') {
  const base = normalize([query, context].filter(Boolean).join(' '));
  const words = base.split(/[^a-z0-9']+/).filter((word) => word.length > 2);
  const tail = words.slice(-4).join(' ');
  const phrases = [
    base,
    `${tail || base} reaction`,
    `${tail || base} meme reaction`,
    `${tail || base} side eye`,
    `${tail || base} confused reaction`,
    `${tail || base} suspicious stare`,
    `${tail || base} not believing you`,
    `${tail || base} awkward reaction`,
  ];
  return dedupeStrings(phrases).slice(0, 8);
}

function gatewayToken(req: any) {
  return process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    req.headers['x-vercel-oidc-token'] ||
    req.headers['X-Vercel-Oidc-Token'];
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function aiScoutQueries(req: any, query: string, context: string) {
  const fallback = fallbackQueries(query, context);
  const token = gatewayToken(req);
  if (!token || process.env.AI_GIF_SCOUT_ENABLED === 'false') return { queries: fallback, aiError: false };

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: [
            'You generate official GIF-provider search phrases for a social GIF picker.',
            'Return only JSON, no markdown.',
            'Generate 5 to 12 short, specific, culturally natural search phrases.',
            'Prefer reaction language, niche emotional beats, and phrases likely to find rare but safe GIFs.',
            'Avoid adult, hateful, gore, or explicit content.',
            'Schema: {"queries": string[]}',
          ].join(' '),
        },
        {
          role: 'user',
          content: [`User query: ${query}`, `Context: ${context || 'gif search'}`].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`ai_${response.status}`);
  const payload = await response.json();
  const parsed = parseJson(payload.choices?.[0]?.message?.content || '');
  const queries = dedupeStrings(Array.isArray(parsed?.queries) ? parsed.queries : []);
  return { queries: (queries.length ? queries : fallback).slice(0, 12), aiError: false };
}

async function withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function providerScore(provider: GifProviderName) {
  return provider === 'giphy' ? 8 : 7;
}

function rankResults(results: GifScoutResult[], originalQuery: string) {
  const originalWords = new Set(normalize(originalQuery).split(/[^a-z0-9']+/).filter(Boolean));
  return [...results].sort((a, b) => {
    const rare = Number(b.isRare) - Number(a.isRare);
    if (rare) return rare;
    const quality = providerScore(b.provider) - providerScore(a.provider);
    if (quality) return quality;
    const media = Number(Boolean(b.mp4Url || b.webmUrl)) - Number(Boolean(a.mp4Url || a.webmUrl));
    if (media) return media;
    const preview = Number(Boolean(b.previewUrl)) - Number(Boolean(a.previewUrl));
    if (preview) return preview;
    const aRel = normalize(`${a.title} ${a.query}`).split(/[^a-z0-9']+/).filter((w) => originalWords.has(w)).length;
    const bRel = normalize(`${b.title} ${b.query}`).split(/[^a-z0-9']+/).filter((w) => originalWords.has(w)).length;
    return bRel - aRel;
  });
}

function dedupeResults(results: GifScoutResult[]) {
  const seen = new Set<string>();
  const out: GifScoutResult[] = [];
  for (const item of results) {
    const keys = [
      `${item.provider}:${item.providerGifId}`,
      item.mediaUrl,
      item.gifUrl,
      item.mp4Url,
    ].filter(Boolean);
    if (keys.some((key) => seen.has(String(key)))) continue;
    keys.forEach((key) => seen.add(String(key)));
    out.push(item);
  }
  return out;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const query = clean(body.query);
    const context = clean(body.context, 120);
    const limit = Math.min(Math.max(Number(body.limit || 12) || 12, 1), MAX_LIMIT);

    if (query.length < 2) {
      return json(res, 200, { query, scoutQueries: [], scoutedQueries: [], rareResults: [], regularResults: [], providerErrors: [] });
    }

    const cacheKey = `${normalize(query)}:${normalize(context)}:${limit}`;
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return json(res, 200, cached.body);

    const providerErrors: SafeProviderError[] = [];
    let scoutQueries = fallbackQueries(query, context);
    try {
      const ai = await aiScoutQueries(req, query, context);
      scoutQueries = ai.queries;
    } catch (error: any) {
      console.warn('AI GIF Scout unavailable', { reason: error?.message || String(error), model: AI_MODEL });
      providerErrors.push({ provider: 'ai', code: 'unavailable' });
    }

    const adapters = [giphy, tenor].filter((adapter) =>
      adapter.provider === 'giphy' ? Boolean(process.env.GIPHY_API_KEY) : Boolean(process.env.TENOR_API_KEY)
    );

    const tasks = scoutQueries.flatMap((scoutQuery) =>
      adapters.map((adapter) =>
        withTimeout((signal) => adapter.searchGifs(scoutQuery, 11, signal), PROVIDER_TIMEOUT_MS)
          .then((response) => ({ ok: true as const, response }))
          .catch((error: any) => {
            console.warn('GIF provider scout failed', { provider: adapter.provider, query: scoutQuery, reason: error?.message || String(error) });
            return { ok: false as const, provider: adapter.provider, query: scoutQuery };
          })
      )
    );

    const settled = await Promise.allSettled(tasks);
    const allResults: GifScoutResult[] = [];
    for (const item of settled) {
      if (item.status !== 'fulfilled') continue;
      const value = item.value;
      if (value.ok === false) {
        providerErrors.push({ provider: value.provider, code: 'unavailable', query: value.query });
        continue;
      }
      allResults.push(...value.response.results.map((result) => ({
        ...result,
        query,
        scoutQuery: value.response.query,
        isRare: value.response.resultCount < 10,
        resultCount: value.response.resultCount,
      })));
    }

    const ranked = rankResults(dedupeResults(allResults), query);
    const bodyOut: ScoutResponse = {
      query,
      scoutQueries,
      scoutedQueries: scoutQueries,
      rareResults: ranked.filter((result) => result.isRare).slice(0, limit),
      regularResults: ranked.filter((result) => !result.isRare).slice(0, limit),
      providerErrors: dedupeStrings(providerErrors.map((e) => `${e.provider}:${e.code}:${e.query || ''}`)).map((key) => {
        const [provider, code, q] = key.split(':');
        return { provider: provider as SafeProviderError['provider'], code, query: q || undefined };
      }),
    };

    memoryCache.set(cacheKey, { createdAt: Date.now(), body: bodyOut });
    return json(res, 200, bodyOut);
  } catch (error: any) {
    console.warn('AI GIF Scout request failed', { reason: error?.message || String(error) });
    return json(res, 200, { query: '', scoutQueries: [], scoutedQueries: [], rareResults: [], regularResults: [], providerErrors: [{ provider: 'ai', code: 'request_failed' }] });
  }
}
