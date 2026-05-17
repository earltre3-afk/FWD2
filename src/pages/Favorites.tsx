import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Heart, Filter, ChevronRight, Sparkles, Grid3x3, Smile, Music } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import { GIFS } from '@/data/gifs';
import { useAppContext } from '@/contexts/AppContext';
import NotificationBell from '@/components/NotificationBell';

const FILTERS = [
  { id: 'All', icon: Grid3x3 },
  { id: 'Reactions', icon: Smile },
  { id: 'Memes', icon: Smile },
  { id: 'Vibes', icon: Music },
];

const Favorites: React.FC = () => {
  const nav = useNavigate();
  const { favorites } = useAppContext();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');

  const favGifs = useMemo(() => {
    let list = favorites.length ? GIFS.filter(g => favorites.includes(g.id)) : GIFS.slice(0, 9);
    if (filter !== 'All') list = list.filter(g => g.category === filter || g.mood === filter || g.tags.includes(filter.toLowerCase()));
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(g => g.title.toLowerCase().includes(s) || g.tags.some(t => t.includes(s)));
    }
    return list;
  }, [favorites, q, filter]);

  const empty = favorites.length === 0 && favGifs.length === 0;

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10" />
          <FwdLogo size="md" />
          <NotificationBell />
        </div>

        <h1 className="text-4xl font-black text-white mt-2">Your reaction vault</h1>
        <p className="text-zinc-400 text-sm mb-5">All your favorite GIFs in one place.</p>

        <div className="glass-strong rounded-full px-5 py-3 border border-fuchsia-500/40 flex items-center gap-3 mb-4">
          <SearchIcon size={18} className="text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your favorites…"
            className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-sm" />
          <Sparkles size={16} className="text-cyan-400" />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
          {FILTERS.map(f => {
            const Icon = f.icon;
            const active = f.id === filter;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition ${
                  active ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent neon-glow-purple' : 'glass text-zinc-300 border-white/10'
                }`}>
                <Icon size={14} /> {f.id} {f.id === 'All' && `(${favGifs.length})`}
              </button>
            );
          })}
          <button className="flex-shrink-0 w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center">
            <Filter size={14} className="text-zinc-300" />
          </button>
        </div>

        {empty ? (
          <div className="text-center py-16 glass-strong rounded-3xl border border-fuchsia-500/20">
            <div className="w-16 h-16 mx-auto rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mb-4">
              <Heart size={28} className="text-pink-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Your reaction vault is empty.</h3>
            <p className="text-sm text-zinc-400 mb-5">Tap the heart on any GIF to save it.</p>
            <button onClick={() => nav('/home')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink">
              Explore GIFs <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {favGifs.map(g => <GifCard key={g.id} gif={g} />)}
            </div>
            <button onClick={() => nav('/home')} className="w-full mt-5 glass-strong rounded-2xl py-4 px-5 border border-fuchsia-500/30 flex items-center justify-between hover:border-fuchsia-500 transition">
              <span className="flex items-center gap-2 font-bold text-white">
                <Heart size={18} className="text-pink-500 fill-pink-500" /> View all favorites
              </span>
              <ChevronRight size={18} className="text-fuchsia-400" />
            </button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Favorites;
