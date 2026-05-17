import type { Gif } from '@/contexts/AppContext';
import { GIFS } from '@/data/gifs';
import type { ReactionAsset, ReactionSearchResponse } from '@/types/reactions';

const DEFAULT_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

const EMOTION_MAP: Record<string, string[]> = {
  anger: ['mad', 'angry', 'pissed', 'rage', 'furious'],
  sad: ['cry', 'crying', 'sad', 'hurt', 'tears'],
  laugh: ['lol', 'funny', 'dead', 'laugh', 'hilarious'],
  suspicious: ['side eye', 'sus', 'hmm', 'skeptical', 'thinking'],
  love: ['love', 'bae', 'cute', 'heart', 'adorable'],
  approval: ['period', 'facts', 'ate', 'yes', 'approve', 'that part'],
  confused: ['wait', 'what', 'confused', 'huh', 'lost'],
};

const FALLBACK_TAGS: Record<string, string[]> = {
  anger: ['angry', 'rage', 'mad'],
  sad: ['crying', 'sad', 'tears'],
  laugh: ['laugh', 'lol', 'funny', 'dead'],
  suspicious: ['side eye', 'sus', 'hmm', 'thinking'],
  love: ['love', 'cute', 'heart'],
  approval: ['period', 'facts', 'yes', 'hype'],
  confused: ['what', 'confused', 'huh'],
};

const memoryCache = new Map<string, ReactionSearchResponse>();

export function normalizeReactionQuery(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 80);
}

function emotionForQuery(query: string) {
  const normalized = normalizeReactionQuery(query);
  return Object.entries(EMOTION_MAP).find(([, aliases]) =>
    aliases.some((alias) => normalized === alias || normalized.includes(alias))
  )?.[0];
}

function scoreGif(gif: Gif, query: string) {
  const normalized = normalizeReactionQuery(query);
  if (!normalized) return 1;
  const haystack = [
    gif.title,
    gif.category,
    gif.mood || '',
    ...gif.tags,
  ].join(' ').toLowerCase();
  let score = 0;
  if (gif.title.toLowerCase() === normalized) score += 80;
  if (gif.title.toLowerCase().includes(normalized)) score += 45;
  if ((gif.mood || '').toLowerCase().includes(normalized)) score += 30;
  if (gif.tags.some((tag) => tag.toLowerCase() === normalized)) score += 35;
  if (gif.tags.some((tag) => tag.toLowerCase().includes(normalized))) score += 25;
  if (haystack.includes(normalized)) score += 15;

  const emotion = emotionForQuery(normalized);
  if (emotion) {
    const tags = FALLBACK_TAGS[emotion] || [];
    if (tags.some((tag) => haystack.includes(tag))) score += 18;
  }
  return score;
}

export function gifToReactionAsset(gif: Gif, query = ''): ReactionAsset {
  return {
    id: `fwd:${gif.id}`,
    source: 'fwd',
    sourceId: gif.id,
    query,
    title: gif.title,
    tags: [...gif.tags, gif.category, gif.mood || ''].filter(Boolean),
    previewUrl: gif.image,
    gifUrl: gif.image,
  };
}

export function reactionAssetToGif(asset: ReactionAsset): Gif {
  return {
    id: asset.id,
    title: asset.title,
    image: asset.gifUrl || asset.previewUrl,
    still_url: asset.previewUrl && asset.previewUrl !== asset.gifUrl ? asset.previewUrl : undefined,
    tags: asset.tags || [],
    category: asset.source === 'fwd' ? 'Reactions' : 'Scout',
    mood: asset.source === 'fwd' ? undefined : 'Rapid Scout',
  };
}

export function dedupeReactionAssets(assets: ReactionAsset[]) {
  const seen = new Set<string>();
  const out: ReactionAsset[] = [];
  for (const asset of assets) {
    const keys = [
      `${asset.source}:${asset.sourceId || asset.id}`,
      asset.title.toLowerCase(),
      asset.gifUrl,
      asset.previewUrl,
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    out.push(asset);
  }
  return out;
}

export function searchLocalReactions(query: string, limit = DEFAULT_LIMIT, offset = 0) {
  const normalized = normalizeReactionQuery(query);
  const ranked = GIFS
    .map((gif) => ({ gif, score: scoreGif(gif, normalized) }))
    .filter(({ score }) => normalized ? score > 0 : true)
    .sort((a, b) => b.score - a.score)
    .map(({ gif }) => gifToReactionAsset(gif, normalized));

  return dedupeReactionAssets(ranked).slice(offset, offset + limit);
}

export function fallbackReactions(query: string, limit = DEFAULT_LIMIT) {
  const emotion = emotionForQuery(query);
  const tags = emotion ? FALLBACK_TAGS[emotion] : ['trending', 'reaction', 'hype', 'lol'];
  const matches = GIFS
    .filter((gif) => tags.some((tag) =>
      gif.title.toLowerCase().includes(tag) ||
      gif.tags.some((gifTag) => gifTag.toLowerCase().includes(tag)) ||
      (gif.mood || '').toLowerCase().includes(tag)
    ))
    .slice(0, limit)
    .map((gif) => ({ ...gifToReactionAsset(gif, normalizeReactionQuery(query)), source: 'fallback' as const }));

  return dedupeReactionAssets([
    ...matches,
    ...GIFS.map((gif) => ({
      ...gifToReactionAsset(gif, normalizeReactionQuery(query)),
      source: 'fallback' as const,
    })),
  ]).slice(0, limit);
}

export function trackReactionSearch(event: string, payload: Record<string, unknown>) {
  try {
    window.dispatchEvent(new CustomEvent('fwd:analytics', { detail: { event, payload } }));
    if (import.meta.env.DEV) console.info('[FWD analytics]', event, payload);
  } catch {}
}

// Capture any scouted external GIF the user selects (giphy, tenor, or fallback).
// This silently stores it into the FWD library so future searches find it locally.
export function captureFallbackReaction(asset: ReactionAsset) {
  // Only capture externally-scouted results — skip native FWD library GIFs
  if (asset.source === 'fwd') return;
  try {
    fetch('/api/reactions/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        asset: {
          id: asset.id,
          source: asset.source,
          sourceId: asset.sourceId,
          query: asset.query,
          title: asset.title,
          tags: asset.tags,
          previewUrl: asset.previewUrl,
          gifUrl: asset.gifUrl,
          width: asset.width,
          height: asset.height,
          shareUrl: asset.shareUrl,
          contentRating: asset.contentRating,
          attributionLabel: asset.attributionLabel,
          attributionUrl: asset.attributionUrl,
        },
      }),
    }).catch(() => {});
  } catch {}
}

export async function rapidReactionSearch({
  query,
  limit = DEFAULT_LIMIT,
  cursor,
  signal,
}: {
  query: string;
  limit?: number;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<ReactionSearchResponse> {
  const normalized = normalizeReactionQuery(query);
  // Only include local results on the first page (cursor absent / "0")
  const isFirstPage = !cursor || cursor === '0';
  const local = isFirstPage ? searchLocalReactions(normalized, limit) : [];

  if (!normalized || normalized.length < MIN_QUERY_LENGTH) {
    const results = local.length ? local : fallbackReactions(normalized, limit);
    return {
      query: normalized,
      limit,
      results,
      sourcesUsed: Array.from(new Set(results.map((item) => item.source))),
      hasMore: GIFS.length > limit,
      nextCursor: String(limit),
      fallbackUsed: results.some((item) => item.source === 'fallback'),
      attribution: [],
    };
  }

  if (isFirstPage && local.length >= limit) {
    return {
      query: normalized,
      limit,
      results: local,
      sourcesUsed: ['fwd'],
      hasMore: true,
      nextCursor: String(limit),
      fallbackUsed: false,
      attribution: [],
    };
  }

  const cacheKey = `${normalized}:${limit}:${cursor ?? ''}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    const base = isFirstPage ? dedupeReactionAssets([...local, ...cached.results]).slice(0, limit) : cached.results;
    return {
      ...cached,
      results: base,
      sourcesUsed: Array.from(new Set([...(local.length ? ['fwd' as const] : []), ...cached.sourcesUsed])),
    };
  }

  const started = performance.now();
  const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  try {
    const response = await fetch(
      `/api/reactions/search?q=${encodeURIComponent(normalized)}&limit=${limit}${cursorParam}`,
      { signal, headers: { Accept: 'application/json' } },
    );
    if (!response.ok) throw new Error('Rapid Reaction Scout unavailable');
    const data = (await response.json()) as ReactionSearchResponse;
    const merged = isFirstPage ? dedupeReactionAssets([...local, ...data.results]) : data.results;
    const fallback = merged.length ? [] : fallbackReactions(normalized, limit);
    const result: ReactionSearchResponse = {
      ...data,
      query: normalized,
      limit,
      results: (merged.length ? merged : fallback).slice(0, limit),
      sourcesUsed: Array.from(new Set([...(local.length ? ['fwd' as const] : []), ...data.sourcesUsed])),
      fallbackUsed: data.fallbackUsed || fallback.length > 0,
    };
    memoryCache.set(cacheKey, result);
    trackReactionSearch('search_latency_ms', { query: normalized, latencyMs: Math.round(performance.now() - started) });
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    trackReactionSearch('reaction_search_failed', { query: normalized });
    const fallback = isFirstPage
      ? dedupeReactionAssets([...local, ...fallbackReactions(normalized, limit)]).slice(0, limit)
      : fallbackReactions(normalized, limit);
    return {
      query: normalized,
      limit,
      results: fallback,
      sourcesUsed: Array.from(new Set(fallback.map((item) => item.source))),
      hasMore: false,
      nextCursor: null,
      fallbackUsed: true,
      attribution: [],
    };
  }
}
