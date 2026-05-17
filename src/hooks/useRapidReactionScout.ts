import { useEffect, useRef, useState } from 'react';
import { rapidReactionSearch, searchLocalReactions, fallbackReactions } from '@/lib/rapidReactionScout';
import type { ReactionSearchResponse } from '@/types/reactions';

const LIMIT = 10;

const emptyResponse = (query = ''): ReactionSearchResponse => ({
  query,
  limit: LIMIT,
  results: [],
  sourcesUsed: [],
  hasMore: false,
  nextCursor: null,
  fallbackUsed: false,
  attribution: [],
});

export function useRapidReactionScout(query: string, limit = LIMIT) {
  const [state, setState] = useState<ReactionSearchResponse>(() => ({
    ...emptyResponse(),
    results: fallbackReactions('', limit),
    fallbackUsed: true,
    sourcesUsed: ['fallback'],
  }));
  const [scouting, setScouting] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const trimmed = query.trim();
    const local = searchLocalReactions(trimmed, limit);

    if (!trimmed || trimmed.length < 2) {
      const results = local.length ? local : fallbackReactions('', limit);
      setScouting(false);
      setState({
        query: trimmed,
        limit,
        results,
        sourcesUsed: Array.from(new Set(results.map((item) => item.source))),
        hasMore: true,
        nextCursor: String(limit),
        fallbackUsed: results.some((item) => item.source === 'fallback'),
        attribution: [],
      });
      return () => controller.abort();
    }

    setState((previous) => ({
      ...previous,
      query: trimmed,
      limit,
      results: local.length ? local : fallbackReactions(trimmed, limit),
      sourcesUsed: local.length ? ['fwd'] : ['fallback'],
      fallbackUsed: local.length === 0,
    }));
    setScouting(local.length < limit);

    const timer = window.setTimeout(() => {
      rapidReactionSearch({ query: trimmed, limit, signal: controller.signal })
        .then((result) => {
          if (requestIdRef.current !== requestId) return;
          setState(result);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId || controller.signal.aborted) return;
          const fallback = local.length ? local : fallbackReactions(trimmed, limit);
          setState({
            ...emptyResponse(trimmed),
            results: fallback,
            sourcesUsed: Array.from(new Set(fallback.map((item) => item.source))),
            fallbackUsed: true,
          });
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setScouting(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, limit]);

  return { ...state, scouting };
}
