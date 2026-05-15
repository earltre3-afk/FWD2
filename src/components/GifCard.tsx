import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Play, Share2 } from 'lucide-react';
import { Gif, useAppContext } from '@/contexts/AppContext';

interface Props {
  gif: Gif;
  onClick?: (g: Gif) => void;
  showHeart?: boolean;
  showShare?: boolean;
  tall?: boolean;
}

const GifCard: React.FC<Props> = ({ gif, onClick, showHeart = true, showShare = false, tall = false }) => {
  const nav = useNavigate();
  const { toggleFavorite, isFavorite } = useAppContext();
  const fav = isFavorite(gif.id);

  const handleClick = () => {
    if (onClick) onClick(gif);
    else nav(`/gif/${gif.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`relative group cursor-pointer rounded-2xl overflow-hidden glass-strong border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] ${tall ? 'aspect-[3/4]' : 'aspect-square'}`}
    >
      <img src={gif.image} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30" />
      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-bold tracking-wider text-white border border-white/10">
        GIF
      </span>
      {showHeart && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(gif.id); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10 hover:scale-110 transition"
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
