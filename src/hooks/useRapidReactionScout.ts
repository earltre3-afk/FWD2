import { useCallback, useEffect, useRef, useState } from 'react';
import {
  rapidReactionSearch,
  searchLocalReactions,
  fallbackReactions,
  endlessReactions,
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
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(String(pageSize));
  const [attribution, setAttribution] = useState<Attribution>([]);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>(['fallback']);

  const requestIdRef = useRef(0);
  const loadedCountRef = useRef(pageSize);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const trimmed = query.trim();

    if (!trimmed || trimmed.length < 2) {
      const fb = fallbackReactions('', pageSize);
      setResults(fb);
      loadedCountRef.current = fb.length;
      setHasMore(true);
      setNextCursor(String(fb.length));
      setLoading(false);
      setLoadingMore(false);
      setAttribution([]);
      setSourcesUsed(Array.from(new Set(fb.map((r) => r.source))));
      return () => controller.abort();
    }

    const local = searchLocalReactions(trimmed, pageSize);
    setResults(local.length ? local : []);
    loadedCountRef.current = local.length;
    setHasMore(true);
    setNextCursor(null);
    setLoading(true);

    const timer = window.setTimeout(() => {
      rapidReactionSearch({ query: trimmed, limit: pageSize, signal: controller.signal })
        .then((res) => {
          if (requestIdRef.current !== requestId) return;
          setResults(res.results);
          loadedCountRef.current = res.results.length;
          setHasMore(true);
          setNextCursor(res.nextCursor || String(res.results.length));
          setAttribution(res.attribution);
          setSourcesUsed(res.sourcesUsed);
          setLoading(false);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId || controller.signal.aborted) return;
          const fb = local.length ? local : fallbackReactions(trimmed, pageSize);
          setResults(fb);
          loadedCountRef.current = fb.length;
          setHasMore(true);
          setNextCursor(String(fb.length));
          setLoading(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const trimmed = queryRef.current.trim();
    const queryForPage = trimmed.length >= 2 ? trimmed : '';

    setLoadingMore(true);
    try {
      const res = await rapidReactionSearch({
        query: queryForPage,
        limit: pageSize,
        cursor: nextCursor || String(loadedCountRef.current),
      });

      setResults((prev) => {
        const merged = dedupeReactionAssets([...prev, ...res.results]);
        if (merged.length > prev.length) {
          loadedCountRef.current = merged.length;
          return merged;
        }

        const eternal = endlessReactions(queryForPage, pageSize, loadedCountRef.current);
        loadedCountRef.current += eternal.length;
        return [...prev, ...eternal];
      });

      setHasMore(true);
      setNextCursor(res.nextCursor || String(loadedCountRef.current + pageSize));
      if (res.attribution.length) {
        setAttribution((prev) => [
          ...prev,
          ...res.attribution.filter((a) => !prev.some((p) => p.source === a.source)),
        ]);
      }
      setSourcesUsed((prev) => Array.from(new Set([...prev, ...res.sourcesUsed])));
    } catch {
      const eternal = endlessReactions(queryForPage, pageSize, loadedCountRef.current);
      loadedCountRef.current += eternal.length;
      setResults((prev) => [...prev, ...eternal]);
      setHasMore(true);
      setNextCursor(String(loadedCountRef.current));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, pageSize]);

  const scouting = loading;

  return { results, loading, scouting, loadingMore, hasMore, loadMore, attribution, sourcesUsed };
}
