import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Clock, TrendingUp, X, Sparkles, Bell, Zap } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import { GIFS, TRENDING_SEARCHES } from '@/data/gifs';
import { useAppContext } from '@/contexts/AppContext';

const FILTERS = ['All', 'Reactions', 'Memes', 'TV & Movies', 'People', 'Music'];

const SearchPage: React.FC = () => {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useAppContext();
  const [query, setQuery] = useState(params.get('q') || '');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const q = params.get('q') || '';
    setQuery(q);
    if (q) addRecentSearch(q);
  }, [params]);

  const results = useMemo(() => {
    let r = GIFS;
    if (filter !== 'All') r = r.filter(g => g.category === filter || g.tags.includes(filter.toLowerCase()));
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(g => g.title.toLowerCase().includes(q) || g.tags.some(t => t.includes(q)) || (g.mood || '').toLowerCase().includes(q));
    }
    return r;
  }, [query, filter]);

  const submit = (q: string) => {
    setParams({ q });
    if (q) addRecentSearch(q);
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-5">
          <div className="w-9" />
          <FwdLogo size="md" />
          <button className="w-9 h-9 rounded-full glass flex items-center justify-center relative">
            <Bell size={18} className="text-fuchsia-400" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500" />
          </button>
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

        {results.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-white tracking-wider">SEARCH RESULTS</h3>
              <span className="text-sm text-fuchsia-400 font-semibold">{results.length} Results</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {results.map(g => <GifCard key={g.id} gif={g} showShare />)}
            </div>
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
