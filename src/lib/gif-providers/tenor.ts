import type { GifProviderSearchResponse, GifScoutResult } from './types.js';

const TENOR_SEARCH_URL = 'https://tenor.googleapis.com/v2/search';

function dims(media: any) {
  return Array.isArray(media?.dims) ? { width: media.dims[0], height: media.dims[1] } : {};
}

function durationMs(media: any) {
  const seconds = Number(media?.duration);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined;
}

function toResult(item: any, query: string, resultCount: number): GifScoutResult | null {
  const formats = item.media_formats || {};
  const preview = formats.tinygif || formats.nanogif || formats.gif;
  const mp4 = formats.mp4 || formats.tinymp4 || formats.nanomp4;
  const webm = formats.webm || formats.tinywebm || formats.nanowebm;
  const gif = formats.gif || preview;
  const previewUrl = preview?.url || gif?.url || mp4?.url || webm?.url;
  const mediaUrl = mp4?.url || gif?.url || webm?.url || previewUrl;
  if (!item.id || !previewUrl || !mediaUrl) return null;
  const size = dims(mp4 || gif || preview);

  return {
    id: `tenor:${item.id}`,
    provider: 'tenor',
    providerGifId: String(item.id),
    query,
    scoutQuery: query,
    title: item.content_description || item.title || 'Tenor reaction',
    previewUrl,
    mediaUrl,
    mp4Url: mp4?.url,
    webmUrl: webm?.url,
    gifUrl: gif?.url,
    posterUrl: previewUrl,
    width: size.width,
    height: size.height,
    durationMs: durationMs(mp4 || gif || preview),
    sourceUrl: item.itemurl,
    attribution: 'Powered by Tenor',
    rating: 'safe-search-medium',
    resultCount,
    isRare: resultCount < 10,
    metadata: {
      provider: 'tenor',
      tags: item.tags || [],
      created: item.created,
      flags: item.flags || [],
    },
  };
}

export async function searchGifs(query: string, limit: number, signal?: AbortSignal): Promise<GifProviderSearchResponse> {
  const apiKey = process.env.TENOR_API_KEY;
  if (!apiKey) return { provider: 'tenor', query, resultCount: 0, results: [] };

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    limit: String(Math.max(1, Math.min(limit, 25))),
    media_filter: 'gif,tinygif,mp4,tinymp4,webm,tinywebm',
    contentfilter: 'medium',
    locale: 'en_US',
  });

  const response = await fetch(`${TENOR_SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`tenor_${response.status}`);
  const payload = await response.json();
  const raw = Array.isArray(payload.results) ? payload.results : [];
  const resultCount = raw.length;
  return {
    provider: 'tenor',
    query,
    resultCount,
    results: raw.map((item: any) => toResult(item, query, resultCount)).filter(Boolean),
  };
}

export default { provider: 'tenor' as const, searchGifs };
