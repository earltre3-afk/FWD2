import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Play, Share2, Trash2, AlertTriangle } from 'lucide-react';
import { Gif, useAppContext } from '@/contexts/AppContext';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { toast } from '@/components/ui/use-toast';
import { stopActionEvent } from '@/lib/actionEvents';
import { shareFwdItem, getFwdShareUrl } from '@/lib/fwdShare';
import { isBlobUrl } from '@/lib/blobGuard';

interface Props {
  gif: Gif;
  onClick?: (g: Gif) => void;
  showHeart?: boolean; // kept for backward compat, no longer used
  showShare?: boolean;
  tall?: boolean;
  className?: string;
  onDelete?: () => void;
}

const GifCard: React.FC<Props> = ({
  gif,
  onClick,
  showShare = false,
  tall = false,
  className = '',
  onDelete,
}) => {
  const nav = useNavigate();
  const { toggleFavorite, isFavorite } = useAppContext();
  const saved = isFavorite(gif.id, gif.image);
  const [dead, setDead] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleClick = () => {
    if (onClick) onClick(gif);
    else nav(`/gif/${gif.id}`, { state: { gif } });
  };

  const shareGif = async () => {
    const isUuid = /^[0-9a-f-]{36}$/i.test(gif.id);
    const absoluteUrl = isUuid
      ? getFwdShareUrl(gif.id)
      : `${window.location.origin}/gif/${gif.id}`;
    const result = await shareFwdItem({
      id: gif.id,
      title: gif.title,
      caption: gif.caption,
      absoluteUrl,
    });
    if (result === 'copied') toast({ title: 'FWD link copied.' });
    if (result === 'failed') toast({ title: 'Share failed', description: 'Couldn\'t share or copy this FWD.', variant: 'destructive' });
  };

  if (dead) return (
    <div className={`relative rounded-xl sm:rounded-2xl overflow-hidden glass border border-white/5 ${tall ? 'aspect-[3/4]' : 'aspect-square'} flex items-center justify-center ${className}`}>
      <span className="text-[10px] font-mono text-zinc-700 select-none">GIF</span>
    </div>
  );

  // Blob URL means this GIF was saved with a temporary URL that is now invalid
  if (isBlobUrl(gif.image) && !gif.mp4_url && !gif.webm_url && !gif.source_video_url) return (
    <div className={`relative rounded-xl sm:rounded-2xl overflow-hidden glass border border-amber-500/20 ${tall ? 'aspect-[3/4]' : 'aspect-square'} flex flex-col items-center justify-center gap-1.5 p-3 text-center ${className}`}>
      <AlertTriangle size={18} className="text-amber-400" />
      <span className="text-[10px] text-amber-300 font-semibold leading-tight">This media needs to be re-uploaded.</span>
    </div>
  );

  return (
    <div
      onClick={handleClick}
      className={`relative group cursor-pointer rounded-xl sm:rounded-2xl overflow-hidden glass-strong border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition-all hover-lift ${tall ? 'aspect-[3/4]' : 'aspect-square'} ${className}`}
    >
      <FwdMediaPlayer
        mp4Url={gif.mp4_url}
        webmUrl={gif.webm_url}
        gifUrl={gif.image}
        posterUrl={gif.still_url}
        sourceVideoUrl={gif.source_video_url}
        mediaType={gif.media_type}
        isAnimated={gif.is_animated}
        editMetadata={gif.edit_metadata}
        trimStart={gif.trim_start}
        trimEnd={gif.trim_end}
        cropX={gif.crop_x}
        cropY={gif.crop_y}
        cropWidth={gif.crop_width}
        cropHeight={gif.crop_height}
        cropAspectRatio={gif.crop_aspect_ratio}
        outputAspectRatio={gif.output_aspect_ratio}
        title={gif.title}
        className="w-full h-full object-cover"
        onError={() => setDead(true)}
      />

      {/* Simulated Remix Caption Overlay for Phase 1 */}
      {gif.is_remix && gif.remix_caption && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30 pointer-events-none flex flex-col justify-end p-3 pb-12">
          <div className={`text-center mb-1 ${
            gif.remix_style === 'Meme' ? 'font-black uppercase text-xl text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000]' :
            gif.remix_style === 'Neon' ? 'font-bold text-lg text-fuchsia-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]' :
            'font-bold text-base text-white drop-shadow-md'
          }`}>
            {gif.remix_caption}
          </div>
        </div>
      )}
      {!gif.is_remix && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30 pointer-events-none" />}

      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none items-start">
        <div className="flex gap-1">
          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-bold tracking-wider text-white border border-white/10 text-center w-fit">
            GIF
          </span>
          {gif.is_remix && (
            <span className="px-2 py-0.5 rounded-md bg-fuchsia-600/80 backdrop-blur text-[9px] font-bold tracking-wider text-white border border-fuchsia-400/30 text-center w-fit shadow-[0_0_8px_rgba(217,70,239,0.6)]">
              REMIX
            </span>
          )}
        </div>
        {gif.is_remix && gif.original_profile && (
          <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[8px] font-bold text-zinc-300 border border-white/10 truncate max-w-[120px]">
            Remix of @{gif.original_profile.username || gif.original_profile.display_name}
          </span>
        )}
      </div>

      {/* Save to Library — always visible, like the GIF badge */}
      {!onDelete && (
        <button
          onClick={async (e) => {
            stopActionEvent(e);
            const res = await toggleFavorite(gif.id, gif);
            if (res && res.needsAuth) {
              toast({ title: 'Sign in to save', description: 'Create or sign into FWD to keep this in My Library.' });
              nav('/login');
            } else if (res && res.error) {
              toast({ title: 'Library update failed', description: res.error, variant: 'destructive' });
            } else {
              toast({ title: saved ? 'Removed from My Library' : 'Saved to My Library' });
            }
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10 hover:scale-110 transition"
          title={saved ? 'Remove from My Library' : 'Save to My Library'}
        >
          <Bookmark
            size={15}
            className={saved ? 'fill-fuchsia-400 text-fuchsia-400' : 'text-white'}
            style={saved ? { filter: 'drop-shadow(0 0 6px rgba(176,38,255,0.9))' } : {}}
          />
        </button>
      )}

      {/* Delete (owner only) — occupies the same top-right corner */}
      {onDelete && !confirmDelete && (
        <button
          onClick={(e) => { stopActionEvent(e); setConfirmDelete(true); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transition"
          title="Delete GIF"
        >
          <Trash2 size={14} className="text-zinc-300" />
        </button>
      )}

      {/* Delete confirmation */}
      {onDelete && confirmDelete && (
        <div
          onClick={(e) => stopActionEvent(e)}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 p-3"
        >
          <p className="text-white text-xs font-bold text-center">Delete this GIF?</p>
          <p className="text-zinc-400 text-[10px] text-center">This can't be undone.</p>
          <div className="flex gap-2 mt-1">
            <button
              onClick={(e) => { stopActionEvent(e); setConfirmDelete(false); onDelete(); }}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
            >
              Delete
            </button>
            <button
              onClick={(e) => { stopActionEvent(e); setConfirmDelete(false); }}
              className="px-3 py-1.5 rounded-lg glass border border-white/15 text-white text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => { stopActionEvent(e); handleClick(); }}
        className="absolute bottom-2 left-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10"
        aria-label="Open FWD"
      >
        <Play size={14} className="text-white ml-0.5" />
      </button>
      {showShare && (
        <button
          type="button"
          onClick={(e) => { stopActionEvent(e); shareGif(); }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/10"
          aria-label="Share FWD"
        >
          <Share2 size={14} className="text-white" />
        </button>
      )}
    </div>
  );
};

export default GifCard;
