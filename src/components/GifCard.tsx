import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Share2 } from 'lucide-react';
import { Gif, useAppContext } from '@/contexts/AppContext';
import FwdAnimatedGif from '@/components/FwdAnimatedGif';
import { toast } from '@/components/ui/use-toast';

interface Props {
  gif: Gif;
  onClick?: (g: Gif) => void;
  showHeart?: boolean;
  showShare?: boolean;
  tall?: boolean;
  className?: string;
}

const GifCard: React.FC<Props> = ({ gif, onClick, showHeart = true, showShare = false, tall = false, className = '' }) => {
  const nav = useNavigate();
  const { toggleFavorite, isFavorite } = useAppContext();
  const fav = isFavorite(gif.id, gif.image);
  const [dead, setDead] = useState(false);

  const handleClick = () => {
    if (onClick) onClick(gif);
    else nav(`/gif/${gif.id}`);
  };

  // Hide cards where the image failed or Giphy returned their "not available" placeholder
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) setDead(true);
  };

  if (dead) return null;

  return (
    <div
      onClick={handleClick}
      className={`relative group cursor-pointer rounded-xl sm:rounded-2xl overflow-hidden glass-strong border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] ${tall ? 'aspect-[3/4]' : 'aspect-square'} ${className}`}
    >
      <FwdAnimatedGif
        gifUrl={gif.image}
        stillUrl={gif.still_url}
        title={gif.title}
        className="w-full h-full object-cover"
        onError={() => setDead(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30" />
      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-bold tracking-wider text-white border border-white/10">
        GIF
      </span>
      {showHeart && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const res = await toggleFavorite(gif.id, gif);
            if (res && res.needsAuth) {
              toast({ title: 'Sign in to save', description: 'Create or sign into FWD to keep this in My Library.' });
              nav('/login');
            } else if (res && res.error) {
              toast({ title: 'Library update failed', description: res.error, variant: 'destructive' });
            } else {
              toast({ title: fav ? 'Removed from My Library' : 'Saved to My Library' });
            }
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10 hover:scale-110 transition"
          title={fav ? 'Remove from My Library' : 'Save to My Library'}
        >
          <Heart size={16} className={fav ? 'fill-pink-500 text-pink-500' : 'text-white'}
            style={fav ? { filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.9))' } : {}} />
        </button>
      )}
      <button className="absolute bottom-2 left-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10">
        <Play size={14} className="text-white ml-0.5" />
      </button>
      {showShare && (
        <button
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10"
        >
          <Share2 size={14} className="text-white" />
        </button>
      )}
    </div>
  );
};

export default GifCard;
