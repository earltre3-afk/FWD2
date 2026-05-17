import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { dedupeReactionAssets, fallbackReactions, rapidReactionSearch, searchLocalReactions } from '@/lib/rapidReactionScout';
import type { GifScoutResult } from '@/lib/gif-providers/types';

type ScoutResponse = {
  query: string;
  scoutedQueries: string[];
  rareResults: GifScoutResult[];
  regularResults: GifScoutResult[];
};

type Props = {
  query: string;
  context?: string;
  limit?: number;
  onSelect: (result: GifScoutResult) => void;
};

function fwdResultFromAsset(asset: ReturnType<typeof searchLocalReactions>[number], originalQuery: string): GifScoutResult {
  return {
    id: asset.id,
    provider: 'fwd',
    providerGifId: asset.sourceId || asset.id.replace(/^fwd:/, ''),
    query: originalQuery,
    scoutQuery: asset.query || originalQuery,
    title: asset.title,
    previewUrl: asset.previewUrl,
    mediaUrl: asset.gifUrl || asset.previewUrl,
    gifUrl: asset.gifUrl || asset.previewUrl,
    posterUrl: asset.previewUrl,
    width: asset.width,
    height: asset.height,
    sourceUrl: asset.shareUrl,
    attribution: 'FWD Library',
    rating: asset.contentRating,
    resultCount: 0,
    isRare: asset.source !== 'fallback',
    metadata: {
      source: asset.source,
      tags: asset.tags,
    },
  };
}

export default function AiGifScout({ query, context = 'gif search', limit = 8, onSelect }: Props) {
  const [results, setResults] = useState<GifScoutResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return () => controller.abort();
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/ai/gif-scout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: trimmed, context, limit }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('AI GIF Scout unavailable');
        const data = (await response.json()) as ScoutResponse;
        if (requestIdRef.current !== requestId) return;
        const providerPicks = data.rareResults?.length ? data.rareResults : data.regularResults || [];
        if (providerPicks.length > 0) {
          setResults(providerPicks.slice(0, limit));
          return;
        }

        const scoutQueries = data.scoutedQueries?.length ? data.scoutedQueries : [trimmed];
        const local = dedupeReactionAssets(
          scoutQueries.flatMap((scoutQuery) => searchLocalReactions(scoutQuery, Math.ceil(limit / 2)))
        );
        if (local.length > 0) {
          setResults(local.slice(0, limit).map((asset) => fwdResultFromAsset(asset, trimmed)));
          return;
        }

        const fallback = await rapidReactionSearch({ query: trimmed, limit, signal: controller.signal });
        if (requestIdRef.current !== requestId) return;
        const fallbackAssets = fallback.results.length ? fallback.results : fallbackReactions(trimmed, limit);
        setResults(fallbackAssets.slice(0, limit).map((asset) => fwdResultFromAsset(asset, trimmed)));
      } catch {
        if (!controller.signal.aborted && requestIdRef.current === requestId) {
          const local = searchLocalReactions(trimmed, limit);
          const fallback = local.length ? local : fallbackReactions(trimmed, limit);
          setResults(fallback.slice(0, limit).map((asset) => fwdResultFromAsset(asset, trimmed)));
        }
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    }, 380);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [context, limit, trimmed]);

  if (trimmed.length < 2 || (!loading && results.length === 0)) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-200">
          <Sparkles size={13} />
          AI Scout Picks
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-cyan-300" />}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {results.map((gif) => (
          <button
            key={`${gif.provider}:${gif.providerGifId}`}
            type="button"
            onClick={() => onSelect(gif)}
            title={gif.title}
            className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-cyan-400/25 bg-black/50 transition hover:scale-[1.02] hover:border-cyan-300"
          >
            <FwdMediaPlayer
              mp4Url={gif.mp4Url}
              webmUrl={gif.webmUrl}
              gifUrl={gif.gifUrl || gif.mediaUrl}
              posterUrl={gif.posterUrl || gif.previewUrl}
              title={gif.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1.5 pt-5">
              <div className="truncate text-left text-[9px] font-bold text-white">{gif.title}</div>
            </div>
            {gif.isRare && (
              <span className="absolute left-1.5 top-1.5 rounded bg-cyan-400/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-black">
                {gif.provider === 'fwd' ? 'FWD' : 'Rare'}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
