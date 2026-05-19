import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Sparkles, Upload, Camera, Zap, TrendingUp, Tv, Music, Gamepad2, Film, Smile, Trophy, Flame } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import { GIFS, CATEGORIES, MOODS, getGifsByCategory } from '@/data/gifs';
import NotificationBell from '@/components/NotificationBell';

const catIcon: Record<string, any> = {
  'Trending': TrendingUp, 'New': Sparkles, 'Reactions': Smile, 'Clips': Film,
  'Memes': Smile, 'Music': Music, 'TV & Movies': Tv, 'Sports': Trophy, 'Gaming': Gamepad2,
};

const Home: React.FC = () => {
  const nav = useNavigate();
  const [cat, setCat] = useState('Trending');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return getGifsByCategory(cat, 20);
  }, [cat]);

  return (
    <div className="min-h-screen pb-32 page-content">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="w-9" />
          <FwdLogo size="md" />
          <NotificationBell className="w-9 h-9" />
        </div>

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); if (query) nav('/search?q=' + encodeURIComponent(query)); }}
          className="glass-strong rounded-full px-5 py-3 border border-fuchsia-500/40 flex items-center gap-3 neon-glow-purple/30 mb-5 animate-fade-up hover-lift">
          <SearchIcon size={18} className="text-zinc-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search GIFs, reactions, memes…"
            className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-sm" />
          <Sparkles size={16} className="text-cyan-400" />
        </form>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4">
          {CATEGORIES.map(c => {
            const Icon = catIcon[c] || Flame;
            const active = c === cat;
            return (
              <button key={c} onClick={() => setCat(c)}
                className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition ${
                  active
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent neon-glow-purple'
                    : 'glass text-zinc-300 border-white/10 hover:border-fuchsia-500/40'
                }`}>
                <Icon size={14} /> {c}
              </button>
            );
          })}
        </div>

        {/* Trending grid */}
        <div className="flex items-center justify-between mt-5 mb-3">
          <h2 className="text-lg font-black text-white tracking-wider animate-text-glow">
            {cat === 'Trending' ? 'TRENDING NOW' : cat.toUpperCase()}
          </h2>
          <button onClick={() => nav('/search')} className="text-sm text-fuchsia-400 font-semibold">See All ›</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4 stagger-children">
          {filtered[0] && (
            <div className="row-span-2">
              <GifCard gif={filtered[0]} tall />
            </div>
          )}
          {filtered.slice(1, 6).map(g => <GifCard key={g.id} gif={g} />)}
          {/* Show more on larger screens */}
          {filtered.slice(6, 12).map(g => <GifCard key={g.id} gif={g} className="hidden sm:block" />)}
          {filtered.slice(12, 20).map(g => <GifCard key={g.id} gif={g} className="hidden lg:block" />)}
        </div>

        {/* Moods */}
        <h2 className="text-lg md:text-xl font-black text-white tracking-wider mt-7 mb-3 animate-text-glow">HOW ARE YOU FEELING?</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 stagger-children">
          {MOODS.map(m => (
            <button key={m.name} onClick={() => nav('/search?q=' + encodeURIComponent(m.name.toLowerCase()))}
              className="glass rounded-2xl p-3 flex flex-col items-center gap-1 border border-white/10 hover:border-fuchsia-500/50 transition hover-lift ripple-press">
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[11px] font-semibold text-zinc-300">{m.name}</span>
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-5 mt-6 stagger-children">
          <button onClick={() => nav('/create')} className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border border-fuchsia-500/30 hover:border-fuchsia-500 transition hover-lift ripple-press">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/40 flex items-center justify-center">
              <Upload size={22} className="text-fuchsia-400" />
            </div>
            <span className="text-sm font-bold text-white">UPLOAD</span>
            <span className="text-[10px] text-zinc-500">From your gallery</span>
          </button>
          <button onClick={() => nav('/camera')} className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border border-cyan-500/30 hover:border-cyan-500 transition hover-lift ripple-press">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center">
              <Camera size={22} className="text-cyan-400" />
            </div>
            <span className="text-sm font-bold text-white">CAMERA</span>
            <span className="text-[10px] text-zinc-500">Capture the moment</span>
          </button>
          <button onClick={() => nav('/create')} className="glass-strong rounded-2xl p-4 flex flex-col items-center gap-2 border border-pink-500/30 hover:border-pink-500 transition hover-lift ripple-press">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/20 to-fuchsia-600/20 border border-pink-500/40 flex items-center justify-center">
              <Zap size={22} className="text-pink-400" />
            </div>
            <span className="text-sm font-bold text-white">CREATE</span>
            <span className="text-[10px] text-zinc-500">Make it FWD</span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
