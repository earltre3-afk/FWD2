import { useEffect, useMemo, useRef, useState } from 'react';
import { fallbackReactions, rapidReactionSearch, searchLocalReactions } from '@/lib/rapidReactionScout';
import type { ReactionAsset } from '@/types/reactions';

export interface GifPrediction {
  query: string;
  tone: string;
  mood: string;
  tags: string[];
  confidence: number;
  reason: string;
}

const emptyPrediction: GifPrediction = {
  query: 'trending reaction',
  tone: 'open',
  mood: 'Cool',
  tags: ['trending', 'reaction'],
  confidence: 0,
  reason: '',
};

async function predictGifIntent(message: string, context: string, signal?: AbortSignal): Promise<GifPrediction> {
  const response = await fetch('/api/gifs/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ message, context }),
    signal,
  });
  if (!response.ok) throw new Error('Prediction unavailable');
  const payload = await response.json();
  return payload.prediction || emptyPrediction;
}

export function usePredictiveGifs(message: string, context = 'message', limit = 6) {
  const [prediction, setPrediction] = useState<GifPrediction>(emptyPrediction);
  const [results, setResults] = useState<ReactionAsset[]>(() => fallbackReactions('', limit));
  const [loading, setLoading] = useState(false);
  const [settled, setSettled] = useState(true);
  const requestIdRef = useRef(0);

  const draft = useMemo(() => message.trim().slice(0, 500), [message]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    if (draft.length < 2) {
      setPrediction(emptyPrediction);
      setResults(fallbackReactions('', limit));
      setLoading(false);
      setSettled(true);
      return () => controller.abort();
    }

    setLoading(true);
    setSettled(false);

    const timer = window.setTimeout(async () => {
      try {
        const nextPrediction = await predictGifIntent(draft, context, controller.signal);
        if (requestIdRef.current !== requestId) return;
        setPrediction(nextPrediction);

        const local = searchLocalReactions(nextPrediction.query, limit);
        setResults(local.length ? local : fallbackReactions(nextPrediction.query, limit));

        const search = await rapidReactionSearch({
          query: [nextPrediction.query, ...nextPrediction.tags.slice(0, 2)].join(' '),
          limit,
          signal: controller.signal,
        });
        if (requestIdRef.current !== requestId) return;
        setResults(search.results);
      } catch {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        const local = searchLocalReactions(draft, limit);
        setPrediction({
          ...emptyPrediction,
          query: draft,
          tone: 'message',
          reason: 'Used the typed message directly.',
        });
        setResults(local.length ? local : fallbackReactions(draft, limit));
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
          setSettled(true);
        }
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [context, draft, limit]);

  return { prediction, results, loading, settled };
}
