import type { GifProviderSearchResponse, GifScoutResult } from './types.js';

const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';

function numberOrUndefined(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : undefined;
}

function toResult(item: any, query: string, resultCount: number): GifScoutResult | null {
  const fixed = item.images?.fixed_width;
  const small = item.images?.fixed_width_small;
  const preview = item.images?.preview_gif || small || fixed;
  const original = item.images?.original || fixed || preview;
  const mp4 = original?.mp4 || fixed?.mp4 || small?.mp4;
  const gif = original?.url || fixed?.url || preview?.url;
  const previewUrl = preview?.url || small?.url || gif || mp4;
  const mediaUrl = mp4 || gif || previewUrl;
  if (!item.id || !previewUrl || !mediaUrl) return null;

  return {
    id: `giphy:${item.id}`,
    provider: 'giphy',
    providerGifId: String(item.id),
    query,
    scoutQuery: query,
    title: item.title || 'GIPHY reaction',
    previewUrl,
    mediaUrl,
    mp4Url: mp4,
    gifUrl: gif,
    posterUrl: previewUrl,
    width: numberOrUndefined(original?.width || fixed?.width || preview?.width),
    height: numberOrUndefined(original?.height || fixed?.height || preview?.height),
    sourceUrl: item.url,
    attribution: 'Powered by GIPHY',
    rating: item.rating,
    resultCount,
    isRare: resultCount < 10,
    metadata: {
      provider: 'giphy',
      importDatetime: item.import_datetime,
      username: item.username,
      slug: item.slug,
    },
  };
}

export async function searchGifs(query: string, limit: number, signal?: AbortSignal): Promise<GifProviderSearchResponse> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return { provider: 'giphy', query, resultCount: 0, results: [] };

  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    limit: String(Math.max(1, Math.min(limit, 25))),
    rating: 'pg-13',
    lang: 'en',
    bundle: 'messaging_non_clips',
  });

  const response = await fetch(`${GIPHY_SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`giphy_${response.status}`);
  const payload = await response.json();
  const raw = Array.isArray(payload.data) ? payload.data : [];
  const resultCount = raw.length;
  return {
    provider: 'giphy',
    query,
    resultCount,
    results: raw.map((item: any) => toResult(item, query, resultCount)).filter(Boolean),
  };
}

export default { provider: 'giphy' as const, searchGifs };
