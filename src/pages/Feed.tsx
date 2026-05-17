import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Bookmark, Share2, MoreHorizontal, Zap, Bell,
  MessageCircle, RefreshCw, Download, Loader2, Plus,
} from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { useAppContext, FwdPost, Gif } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { shareFwd, recordShare } from '@/lib/fwdShare';

// ---- Post composer (pick a GIF from user library) ----
const PostComposer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userGifs, savedLibrary, createPost } = useAppContext();
  const [selected, setSelected] = useState<Gif | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const nav = useNavigate();
  const libraryGifs = [...userGifs, ...savedLibrary].filter(
    (gif, index, all) => gif.image && all.findIndex(item => item.id === gif.id) === index
  );

  const post = async () => {
    if (!selected) return;
    setPosting(true);
    const result = await createPost(selected.id, caption);
    setPosting(false);
    if (result) {
      toast({ title: 'Posted!', description: 'Your GIF is on the feed.' });
      onClose();
    } else {
      toast({ title: 'Post failed', description: 'Try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/40 p-5">
        <h3 className="text-lg font-black text-white mb-3">Post a GIF</h3>

        {!selected ? (
          <>
            <p className="text-zinc-400 text-sm mb-3">Pick a GIF from your library</p>
            {libraryGifs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500 text-sm mb-3">No GIFs yet.</p>
                <button
                  onClick={() => { onClose(); nav('/create'); }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold text-sm"
                >
                  <Zap size={14} /> Create your first GIF
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto mb-3">
                {libraryGifs.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g)}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-fuchsia-500 transition"
                  >
                    <FwdMediaPlayer
                      mp4Url={g.mp4_url}
                      webmUrl={g.webm_url}
                      gifUrl={g.image}
                      posterUrl={g.still_url}
                      sourceVideoUrl={g.source_video_url}
                      mediaType={g.media_type}
                      isAnimated={g.is_animated}
                      title={g.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="aspect-square rounded-2xl overflow-hidden border border-fuchsia-500/30 max-h-56 mx-auto mb-3">
              <FwdMediaPlayer
                mp4Url={selected.mp4_url}
                webmUrl={selected.webm_url}
                gifUrl={selected.image}
                posterUrl={selected.still_url}
                sourceVideoUrl={selected.source_video_url}
                mediaType={selected.media_type}
                isAnimated={selected.is_animated}
                title={selected.title}
                className="w-full h-full object-contain bg-black/60"
                objectFit="contain"
                lazy={false}
              />
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-zinc-500 mb-3 flex items-center gap-1">
              <RefreshCw size={12} /> Change GIF
            </button>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption…"
              rows={2}
              className="w-full bg-black/40 border border-fuchsia-500/30 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none mb-3 focus:border-fuchsia-500"
            />
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold text-sm">Cancel</button>
          {selected && (
            <button
              onClick={post}
              disabled={posting}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold text-sm neon-glow-pink disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {posting ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
              {posting ? 'Posting…' : 'Post'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Post card ----
const PostCard: React.FC<{ post: FwdPost }> = ({ post }) => {
  const { toggleLike, savePost, deletePost } = useAppContext();
  const { user } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = post.profile?.display_name || post.profile?.username || 'FWD User';
  const avatar = post.profile?.avatar_url;
  const initial = (displayName).charAt(0).toUpperCase();
  const isOwner = user?.id === post.user_id;

  const handleShare = async () => {
    const result = await shareFwd(post.id, { caption: post.caption ?? undefined });
    if (result === 'copied') toast({ title: 'Link copied to clipboard' });
    if (result === 'error') toast({ title: 'Could not share', variant: 'destructive' });
    if (result !== 'cancelled') recordShare(post.id, { sharedBy: user?.id, channel: result });
  };

  const handleReuse = async () => {
    if (!post.gif_id || !post.gif) return;
    if (!post.gif.allow_reuse) {
      toast({ title: 'Reuse not allowed', description: 'The creator has disabled reuse for this GIF.' });
      return;
    }
    if (!user) {
      toast({ title: 'Sign in to reuse GIFs' });
      return;
    }
    // Save to library and open composer
    await supabase.from('user_gif_library').upsert({ user_id: user.id, gif_id: post.gif_id, saved_from_user_id: post.user_id });
    await supabase.from('fwd_feed_posts').update({ reuse_count: (post.reuse_count || 0) + 1 }).eq('id', post.id);
    toast({ title: 'GIF added to your library', description: 'Now you can post it from your library.' });
  };

  const handleDownload = () => {
    if (!post.gif?.allow_download) {
      toast({ title: 'Download not allowed', description: 'The creator has disabled downloads.' });
      return;
    }
    if (!post.gif?.image) return;
    const a = document.createElement('a');
    a.href = post.gif.image;
    a.download = `${post.gif.title || 'fwd-gif'}.gif`;
    a.target = '_blank';
    a.click();
  };

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <article className="glass-strong rounded-3xl border border-fuchsia-500/20 overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 to-cyan-400">
            {avatar ? (
              <img src={avatar} className="w-full h-full rounded-full object-cover" alt={displayName} />
            ) : (
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-sm font-black text-white">
                {initial}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{displayName}</p>
            <p className="text-zinc-500 text-xs">{relativeTime(post.created_at)}</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full glass flex items-center justify-center"
          >
            <MoreHorizontal size={16} className="text-zinc-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-10 glass-strong rounded-xl border border-fuchsia-500/30 py-1 min-w-[140px]">
              <button onClick={() => { handleShare(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2">
                <Share2 size={14} /> Share
              </button>
              {post.gif?.allow_download && (
                <button onClick={() => { handleDownload(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2">
                  <Download size={14} /> Download
                </button>
              )}
              {isOwner && (
                <button onClick={() => { deletePost(post.id); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-pink-400 hover:bg-white/5">
                  Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GIF — the star */}
      {post.gif?.image ? (
        <div className="relative bg-black/60 w-full" style={{ maxHeight: '480px', minHeight: '240px' }}>
          <FwdMediaPlayer
            gifUrl={post.gif.image}
            posterUrl={post.gif.still_url}
            mp4Url={post.gif.mp4_url}
            webmUrl={post.gif.webm_url}
            sourceVideoUrl={post.gif.source_video_url}
            mediaType={post.gif.media_type}
            isAnimated={post.gif.is_animated}
            title={post.gif.title}
            className="w-full object-contain"
            style={{ maxHeight: '480px', display: 'block' } as React.CSSProperties}
            objectFit="contain"
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-bold tracking-wider text-white border border-white/10">GIF</span>
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center bg-black/40 text-zinc-600 text-sm">GIF unavailable</div>
      )}

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pt-3 pb-1 text-white text-sm leading-relaxed">{post.caption}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3 border-t border-white/5 mt-2">
        <button
          onClick={() => user ? toggleLike(post.id) : nav('/login')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition"
        >
          <Heart size={18}
            className={post.liked_by_me ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'}
            style={post.liked_by_me ? { filter: 'drop-shadow(0 0 6px rgba(236,72,153,0.8))' } : {}}
          />
          <span className={`text-xs font-semibold ${post.liked_by_me ? 'text-pink-400' : 'text-zinc-400'}`}>
            {post.like_count > 0 ? post.like_count : ''}
          </span>
        </button>

        <button onClick={() => post.gif_id && nav(`/gif/${post.gif_id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition">
          <MessageCircle size={18} className="text-zinc-400" />
          {post.comment_count > 0 && <span className="text-xs font-semibold text-zinc-400">{post.comment_count}</span>}
        </button>

        <button
          onClick={() => user ? savePost(post.id) : nav('/login')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition"
        >
          <Bookmark size={18}
            className={post.saved_by_me ? 'fill-fuchsia-400 text-fuchsia-400' : 'text-zinc-400'}
          />
        </button>

        {post.gif?.allow_reuse && (
          <button
            onClick={handleReuse}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition ml-auto"
          >
            <RefreshCw size={16} className="text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400">Reuse</span>
          </button>
        )}

        <button
          onClick={handleShare}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition ${post.gif?.allow_reuse ? '' : 'ml-auto'}`}
        >
          <Share2 size={16} className="text-zinc-400" />
        </button>
      </div>
    </article>
  );
};

// ---- Feed page ----
const Feed: React.FC = () => {
  const { feedPosts, feedLoading, feedHasMore, loadMoreFeed } = useAppContext();
  const { user } = useAuth();
  const nav = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load initial feed
  useEffect(() => {
    if (feedPosts.length === 0 && !feedLoading) {
      loadMoreFeed();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && feedHasMore && !feedLoading) loadMoreFeed(); },
      { threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [feedHasMore, feedLoading, loadMoreFeed]);

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-lg mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="w-9" />
          <FwdLogo size="md" />
          <button className="w-9 h-9 rounded-full glass flex items-center justify-center relative">
            <Bell size={18} className="text-fuchsia-400" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500" />
          </button>
        </div>

        {/* Post button */}
        <button
          onClick={() => user ? setComposerOpen(true) : nav('/login')}
          className="w-full mb-5 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-black tracking-wide neon-glow-purple flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Post a GIF
        </button>

        {/* Feed */}
        {feedPosts.length === 0 && !feedLoading && (
          <div className="glass-strong rounded-3xl border border-fuchsia-500/20 p-10 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center mb-4">
              <Zap size={28} className="text-fuchsia-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">The feed is empty</h3>
            <p className="text-sm text-zinc-400 mb-5">Be the first to forward a vibe.</p>
            <button
              onClick={() => nav('/create')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink"
            >
              <Zap size={16} /> Create a GIF
            </button>
          </div>
        )}

        {feedPosts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-4" />

        {feedLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={28} className="animate-spin text-fuchsia-400" />
          </div>
        )}

        {!feedHasMore && feedPosts.length > 0 && (
          <p className="text-center text-zinc-600 text-sm py-6">You've seen everything — forward the feeling.</p>
        )}
      </div>

      {composerOpen && <PostComposer onClose={() => setComposerOpen(false)} />}
      <BottomNav />
    </div>
  );
};

export default Feed;
