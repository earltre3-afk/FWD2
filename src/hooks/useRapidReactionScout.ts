import { useCallback, useEffect, useRef, useState } from 'react';
import {
  rapidReactionSearch,
  searchLocalReactions,
  fallbackReactions,
  dedupeReactionAssets,
} from '@/lib/rapidReactionScout';
import type { ReactionAsset, ReactionSearchResponse } from '@/types/reactions';

const PAGE_SIZE = 20;

type Attribution = ReactionSearchResponse['attribution'];

export function useRapidReactionScout(query: string, pageSize = PAGE_SIZE) {
  const [results, setResults] = useState<ReactionAsset[]>(() =>
    fallbackReactions('', pageSize),
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<Attribution>([]);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>(['fallback']);

  const requestIdRef = useRef(0);
  // Keep a stable ref to the current query for use inside loadMore callback
  const queryRef = useRef(query);
  queryRef.current = query;

  // ── First page: reset + fetch whenever query changes ──────────────────────
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const trimmed = query.trim();

    if (!trimmed || trimmed.length < 2) {
      const fb = fallbackReactions('', pageSize);
      setResults(fb);
      setHasMore(false);
      setNextCursor(null);
      setLoading(false);
      setLoadingMore(false);
      setAttribution([]);
      setSourcesUsed(Array.from(new Set(fb.map((r) => r.source))));
      return () => controller.abort();
    }

    // Show local results immediately while the network request is in-flight
    const local = searchLocalReactions(trimmed, pageSize);
    setResults(local.length ? local : []);
    setHasMore(false);
    setNextCursor(null);
    setLoading(true);

    const timer = window.setTimeout(() => {
      rapidReactionSearch({ query: trimmed, limit: pageSize, signal: controller.signal })
        .then((res) => {
          if (requestIdRef.current !== requestId) return;
          setResults(res.results);
          setHasMore(res.hasMore);
          setNextCursor(res.nextCursor);
          setAttribution(res.attribution);
          setSourcesUsed(res.sourcesUsed);
          setLoading(false);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId || controller.signal.aborted) return;
          const fb = local.length ? local : fallbackReactions(trimmed, pageSize);
          setResults(fb);
          setHasMore(false);
          setNextCursor(null);
          setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, pageSize]);

  // ── Load next page ────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    const trimmed = queryRef.current.trim();
    if (!trimmed || trimmed.length < 2) return;

    setLoadingMore(true);
    try {
      const res = await rapidReactionSearch({
        query: trimmed,
        limit: pageSize,
        cursor: nextCursor,
      });
      setResults((prev: ReactionAsset[]) => dedupeReactionAssets([...prev, ...res.results]));
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
      if (res.attribution.length) {
        setAttribution((prev: Attribution) => [
          ...prev,
          ...res.attribution.filter((a) => !prev.some((p: Attribution[number]) => p.source === a.source)),
        ]);
      }
      setSourcesUsed((prev: string[]) => Array.from(new Set([...prev, ...res.sourcesUsed])));
    } catch {
      // loadMore failure is silent — keep existing results intact
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, nextCursor, loadingMore, pageSize]);

  // Legacy alias so existing callers using `scouting` keep compiling
  const scouting = loading;

  return { results, loading, scouting, loadingMore, hasMore, loadMore, attribution, sourcesUsed };
}
