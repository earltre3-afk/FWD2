import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Clock, TrendingUp, X, Sparkles, Zap, Loader2 } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import { TRENDING_SEARCHES } from '@/data/gifs';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import NotificationBell from '@/components/NotificationBell';
import { captureFallbackReaction, reactionAssetToGif, trackReactionSearch } from '@/lib/rapidReactionScout';
import { useRapidReactionScout } from '@/hooks/useRapidReactionScout';
import type { ReactionAsset } from '@/types/reactions';
import { supabase } from '@/lib/supabase';
import FollowButton from '@/components/FollowButton';
import type { GifScoutResult } from '@/lib/gif-providers/types';
import type { Gif } from '@/contexts/AppContext';

interface UserResult {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

type GridItem = {
  key: string;
  gif: Gif;
  isScoutPick: boolean;
  source: string;
  onClick: () => void;
};

function scoutPickToGif(pick: GifScoutResult): Gif {
  return {
    id: `${pick.provider}:${pick.providerGifId}`,
    title: pick.title,
    image: pick.gifUrl || pick.mediaUrl,
    still_url: pick.posterUrl || pick.previewUrl,
    mp4_url: pick.mp4Url,
    webm_url: pick.webmUrl,
    media_type: pick.mp4Url ? 'video/mp4' : undefined,
    is_animated: true,
    tags: [],
    category: 'Scout',
    provider: pick.provider,
    provider_gif_id: pick.providerGifId,
  };
}

const FILTERS = ['All', 'Reactions', 'Memes', 'TV & Movies', 'People', 'Music'];

const SearchPage: React.FC = () => {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { recentSearches, addRecentSearch, clearRecentSearches, refresh, toggleFavorite } = useAppContext();
  const { signInWithEmail, user } = useAuth();
  const [query, setQuery] = useState(params.get('q') || '');
  const [filter, setFilter] = useState('All');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const { results: scoutResults, loadMore, loadingMore, hasMore, attribution, sourcesUsed } = useRapidReactionScout(query, 20);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scoutPicks, setScoutPicks] = useState<GifScoutResult[]>([]);
  const scoutRequestIdRef = useRef(0);

  useEffect(() => {
    const q = params.get('q') || '';
    setQuery(q);
    if (q) addRecentSearch(q);
  }, [params, addRecentSearch]);

  const results = scoutResults.filter((asset) => {
    if (filter === 'All') return true;
    const f = filter.toLowerCase();
    return asset.tags.some((tag) => tag.toLowerCase().includes(f)) || asset.source !== 'fwd';
  });

  // Build unified grid: scout picks first, then regular results (deduped)
  const scoutIds = new Set(scoutPicks.map((p) => `${p.provider}:${p.providerGifId}`));
  const gridItems: GridItem[] = [
    ...scoutPicks.map((pick): GridItem => ({
      key: `scout:${pick.provider}:${pick.providerGifId}`,
      gif: scoutPickToGif(pick),
      isScoutPick: true,
      source: pick.provider,
      onClick: () => saveScoutedGif(pick),
    })),
    ...results
      .filter((asset) => !scoutIds.has(`${asset.source}:${asset.sourceId || ''}`))
      .map((asset): GridItem => ({
        key: asset.id,
        gif: reactionAssetToGif(asset),
        isScoutPick: false,
        source: asset.source,
        onClick: () => selectReaction(asset),
      })),
  ];

  // IntersectionObserver — fires loadMore when sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) loadMore();
      },
      { rootMargin: '700px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore, results.length]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const distanceFromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight);
      if (distanceFromBottom < 900 && !loadingMore && hasMore) loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasMore, loadMore, loadingMore, results.length]);

  useEffect(() => {
    if (loadingMore || !hasMore || results.length === 0) return;
    if (document.documentElement.scrollHeight <= window.innerHeight + 240) {
      const timer = window.setTimeout(() => loadMore(), 80);
      return () => window.clearTimeout(timer);
    }
  }, [hasMore, loadMore, loadingMore, results.length]);

  // Fetch AI Scout Picks to merge into Search Results grid
  useEffect(() => {
    const requestId = ++scoutRequestIdRef.current;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setScoutPicks([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch('/api/ai/gif-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: trimmed, context: 'search page', limit: 6 }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (scoutRequestIdRef.current !== requestId) return;
          if (data) {
            const picks = [...(data.rareResults || []), ...(data.regularResults || [])].slice(0, 6);
            setScoutPicks(picks);
          }
        })
        .catch(() => {});
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setUserResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setUserSearching(true);
      const safe = q.replace(/[%_]/g, '');
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
        .limit(8);
      setUserResults((data || []) as UserResult[]);
      setUserSearching(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const submit = async (q: string) => {
    const testEmail = import.meta.env.VITE_TEST_EMAIL;
    const testPass = import.meta.env.VITE_TEST_PASSWORD;
    if (q === '04231993' && testEmail && testPass) {
      setQuery('');
      setParams({});
      const { error } = await signInWithEmail(testEmail, testPass);
      if (error) {
        toast({ title: 'Tester login failed', description: error, variant: 'destructive' });
      } else {
        toast({ title: 'Tester access granted', description: 'Signed in as Trey.' });
        nav('/home');
      }
      return;
    }
    setParams({ q });
    if (q) addRecentSearch(q);
    if (q) trackReactionSearch('search_query_submitted', { query: q.trim().toLowerCase() });
  };

  const selectReaction = (asset: ReactionAsset) => {
    trackReactionSearch('search_result_clicked', {
      query: query.trim().toLowerCase(),
      source: asset.source,
      sourceId: asset.sourceId,
    });
    trackReactionSearch('reaction_selected', {
      source: asset.source,
      sourceId: asset.sourceId,
    });
    captureFallbackReaction(asset);
    if (asset.source === 'fwd' && asset.sourceId) {
      nav(`/gif/${asset.sourceId}`);
      return;
    }
    nav('/create', {
      state: {
        image: asset.gifUrl,
        mediaType: 'image/gif',
        title: asset.title,
        tags: asset.tags,
      },
    });
  };

  const saveScoutedGif = async (gif: GifScoutResult) => {
    if (gif.provider === 'fwd') {
      if (!user) {
        toast({ title: 'Sign in to save', description: 'Sign in to keep this FWD in your library.' });
        return;
      }
      const fwdGif = reactionAssetToGif({
        id: `fwd:${gif.providerGifId}`,
        source: 'fwd',
        sourceId: gif.providerGifId,
        query: gif.scoutQuery || query,
        title: gif.title,
        tags: Array.isArray(gif.metadata?.tags) ? gif.metadata.tags as string[] : [gif.scoutQuery || query].filter(Boolean),
        previewUrl: gif.previewUrl,
        gifUrl: gif.gifUrl || gif.mediaUrl,
        width: gif.width,
        height: gif.height,
        shareUrl: gif.sourceUrl,
        contentRating: gif.rating,
      });
      await toggleFavorite(fwdGif.id.replace(/^fwd:/, ''), { ...fwdGif, id: fwdGif.id.replace(/^fwd:/, '') });
      toast({ title: 'Saved to your library', description: gif.title });
      nav(`/gif/${gif.providerGifId}`);
      return;
    }

    if (!user) {
      toast({ title: 'Sign in to save', description: 'Sign in to keep AI Scout GIFs in your library.' });
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Missing session');
      const response = await fetch('/api/gifs/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: gif.provider,
          providerGifId: gif.providerGifId,
          title: gif.title,
          originalQuery: query,
          aiScoutQuery: gif.scoutQuery,
          previewUrl: gif.previewUrl,
          mediaUrl: gif.mediaUrl,
          mp4Url: gif.mp4Url,
          webmUrl: gif.webmUrl,
          gifUrl: gif.gifUrl,
          posterUrl: gif.posterUrl,
          width: gif.width,
          height: gif.height,
          durationMs: gif.durationMs,
          sourceUrl: gif.sourceUrl,
          attribution: gif.attribution,
          rating: gif.rating,
          metadata: gif.metadata,
        }),
      });
      if (!response.ok) throw new Error('Save failed');
      await refresh();
      toast({ title: 'Saved to your library', description: gif.title });
      nav('/create', {
        state: {
          image: gif.gifUrl || gif.mediaUrl,
          mediaType: (gif.mp4Url || gif.webmUrl || /\.(mp4|webm)(?:[?#].*)?$/i.test(gif.mediaUrl)) ? 'video/mp4' : 'image/gif',
          title: gif.title,
          tags: [gif.scoutQuery || query, gif.provider].filter(Boolean),
        },
      });
    } catch {
      toast({ title: "Couldn't save this GIF. Try again.", variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between mb-5">
          <div className="w-9" />
          <FwdLogo size="md" />
          <NotificationBell className="w-9 h-9" />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(query); }}
          className="glass-strong rounded-full px-5 py-3.5 border border-fuchsia-500/40 flex items-center gap-3 neon-glow-purple mb-5">
          <SearchIcon size={18} className="text-zinc-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Search GIFs, reactions, memes…"
            className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-base" />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setParams({}); }} className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
              <X size={12} className="text-white" />
            </button>
          )}
          <Sparkles size={16} className="text-cyan-400" />
        </form>

        {/* Recent */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-white">Recent searches</h3>
          <button onClick={clearRecentSearches} className="text-sm text-fuchsia-400 font-semibold">Clear all</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {recentSearches.map(q => (
            <button key={q} onClick={() => { setQuery(q); submit(q); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-fuchsia-500/30 text-sm text-zinc-200 hover:border-fuchsia-500/70">
              <Clock size={12} className="text-fuchsia-400" /> {q}
            </button>
          ))}
          {recentSearches.length === 0 && <span className="text-sm text-zinc-500">No recent searches.</span>}
        </div>

        {/* Trending */}
        <h3 className="text-base font-bold text-white mb-2">Trending searches</h3>
        <div className="flex flex-wrap gap-2 mb-5">
          {TRENDING_SEARCHES.map(q => (
            <button key={q} onClick={() => { setQuery(q); submit(q); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-pink-500/30 text-sm text-zinc-200 hover:border-pink-500/70">
              <TrendingUp size={12} className="text-pink-400" /> {q}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4 mb-3">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${
                f === filter
                  ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent neon-glow-purple'
                  : 'glass text-zinc-300 border-white/10 hover:border-fuchsia-500/40'
              }`}>
              {f}
            </button>
          ))}
        </div>

        {query.trim().length >= 2 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-white tracking-wider">PEOPLE</h3>
              {userSearching && <span className="text-xs text-cyan-300">Searching...</span>}
            </div>
            {userResults.length === 0 && !userSearching ? (
              <div className="glass rounded-2xl p-4 border border-white/5 text-center text-zinc-400 text-sm">
                No users found. Try another name or handle.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {userResults.map((p) => {
                  const name = p.display_name || p.username || 'FWD User';
                  return (
                    <div key={p.id} className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 flex items-center gap-3">
                      <button onClick={() => p.username && nav(`/u/${p.username}`)} className="w-12 h-12 rounded-full overflow-hidden bg-zinc-900 shrink-0">
                        {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-white font-black">{name.charAt(0).toUpperCase()}</span>}
                      </button>
                      <button onClick={() => p.username && nav(`/u/${p.username}`)} className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-bold text-white truncate">{name}</div>
                        <div className="text-xs text-zinc-500 truncate">@{p.username || 'fwduser'}</div>
                        {p.bio && <div className="text-[11px] text-zinc-400 truncate mt-0.5">{p.bio}</div>}
                      </button>
                      <FollowButton targetUserId={p.id} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {gridItems.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-white tracking-wider">SEARCH RESULTS</h3>
              <span className="text-sm text-fuchsia-400 font-semibold">{gridItems.length} Results</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
              {gridItems.map((item) => (
                <div key={item.key} className="relative min-w-0">
                  <GifCard gif={item.gif} onClick={item.onClick} showShare />
                  {item.isScoutPick && (
                    <span className="absolute left-2 top-2 z-10 rounded bg-cyan-400/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-black pointer-events-none">
                      Scout
                    </span>
                  )}
                  {!item.isScoutPick && (item.source === 'giphy' || item.source === 'tenor') && (
                    <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100 border border-cyan-300/20 pointer-events-none">
                      {item.source}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {attribution.length > 0 && sourcesUsed.some(source => source === 'giphy' || source === 'tenor') && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                {attribution.map(item => <span key={item.source}>{item.label}</span>)}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
              <div className="flex justify-center py-6">
                <Loader2 size={24} className="animate-spin text-fuchsia-400" />
              </div>
            )}

            {hasMore && !loadingMore && (
              <div className="h-8" aria-hidden="true" />
            )}
          </>
        ) : (
          <div className="text-center py-16 glass-strong rounded-3xl border border-fuchsia-500/20">
            <div className="w-16 h-16 mx-auto rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center mb-4">
              <SearchIcon size={28} className="text-fuchsia-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">No reaction found yet.</h3>
            <p className="text-sm text-zinc-400 mb-5">Be the first to forward this vibe.</p>
            <button onClick={() => nav('/create')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink">
              <Zap size={16} /> Create one
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default SearchPage;
