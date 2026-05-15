import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Link as LinkIcon, Share2, Flag, Maximize2, Pause, Play, Flame, Bell } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import { GIFS, findGif } from '@/data/gifs';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';

const GifDetail: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const gif = findGif(id || '') || GIFS[0];
  const { toggleFavorite, isFavorite } = useAppContext();
  const fav = isFavorite(gif.id);
  const [playing, setPlaying] = useState(true);

  const related = GIFS.filter(g => g.id !== gif.id && (g.category === gif.category || g.mood === gif.mood)).slice(0, 6);

  const copy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/gif/${gif.id}`);
    toast({ title: 'Link copied', description: 'Forward the feeling.' });
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: gif.title, url: `${window.location.origin}/gif/${gif.id}` });
      } else {
        copy();
      }
    } catch {}
  };

  const ActionBtn = ({ icon: Icon, label, onClick, active }: any) => (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1.5 py-3 hover:bg-white/5 transition">
      <Icon size={22} className={active ? 'fill-pink-500 text-pink-500' : 'text-fuchsia-300'}
        style={active ? { filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.8))' } : {}} />
      <span className="text-xs text-zinc-300 font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center relative">
            <Bell size={18} className="text-fuchsia-400" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-pink-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="relative rounded-3xl overflow-hidden glass-strong border border-fuchsia-500/40 neon-glow-purple aspect-square">
          <img src={gif.image} alt={gif.title} className={`w-full h-full object-cover ${playing ? 'animate-pulse-glow' : ''}`} style={{ animation: playing ? 'pulse 3s infinite' : 'none' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 text-[11px] font-bold tracking-wider text-white border border-white/10">GIF</span>
          <button onClick={() => setPlaying(!playing)} className="absolute bottom-3 left-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/15">
            {playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
          </button>
          <button className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/15">
            <Maximize2 size={16} className="text-white" />
          </button>
        </div>

        {/* Title */}
        <div className="flex items-start justify-between mt-5">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">{gif.title}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <Flame size={14} className="text-fuchsia-400" />
              <span className="text-fuchsia-400 font-semibold">Trending in {gif.category}</span>
            </div>
          </div>
          <button onClick={() => toggleFavorite(gif.id)} className="w-12 h-12 rounded-full glass flex items-center justify-center border border-pink-500/30">
            <Heart size={22} className={fav ? 'fill-pink-500 text-pink-500' : 'text-pink-400'}
              style={fav ? { filter: 'drop-shadow(0 0 10px rgba(236,72,153,0.9))' } : {}} />
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {gif.tags.map(t => (
            <button key={t} onClick={() => nav('/search?q=' + encodeURIComponent(t))}
              className="px-3 py-1.5 rounded-full glass border border-fuchsia-500/30 text-sm text-zinc-200">
              #{t}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 glass-strong rounded-2xl border border-fuchsia-500/30 flex divide-x divide-white/5 overflow-hidden">
          <ActionBtn icon={Heart} label="Favorite" onClick={() => toggleFavorite(gif.id)} active={fav} />
          <ActionBtn icon={LinkIcon} label="Copy Link" onClick={copy} />
          <ActionBtn icon={Share2} label="Share" onClick={share} />
          <ActionBtn icon={Flag} label="Report" onClick={() => toast({ title: 'Reported', description: 'Thanks — we will review this content.' })} />
        </div>

        {/* Related */}
        <h3 className="text-base font-black text-white tracking-wider mt-7 mb-3">MORE LIKE THIS</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {related.map(g => <GifCard key={g.id} gif={g} showHeart={false} />)}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default GifDetail;
