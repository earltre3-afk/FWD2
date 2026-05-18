import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Bookmark, Share2, MoreHorizontal, Zap,
  MessageCircle, RefreshCw, Download, Loader2, Plus,
  Flag, Edit3, Trash2,
} from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import FwdLibraryPicker from '@/components/FwdLibraryPicker';
import { useAppContext, FwdPost, Gif } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { shareFwd, recordShare } from '@/lib/fwdShare';
import { stopActionEvent } from '@/lib/actionEvents';
import NotificationBell from '@/components/NotificationBell';
import FwdDownloadSheet from '@/components/fwd-actions/FwdDownloadSheet';
import FwdReportSheet from '@/components/fwd-actions/FwdReportSheet';

// ---- Post composer ----
const PostComposer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createPost } = useAppContext();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Gif | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const nav = useNavigate();

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
    <>
      <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <div className="w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/40 p-5">
          <h3 className="text-lg font-black text-white mb-1">Post a GIF</h3>
          <p className="text-xs text-zinc-500 mb-4">Save once. Use anywhere.</p>

          {!selected ? (
            <button
              onClick={() => user ? setPickerOpen(true) : nav('/login')}
              className="w-full py-10 rounded-2xl border-2 border-dashed border-fuchsia-500/40 hover:border-fuchsia-500/70 text-center transition mb-3"
            >
              <Zap size={24} className="mx-auto text-fuchsia-400 mb-2" />
              <p className="text-sm font-bold text-white">Use from Library</p>
              <p className="text-xs text-zinc-500 mt-0.5">Pick a FWD</p>
            </button>
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
                  editMetadata={selected.edit_metadata}
                  trimStart={selected.trim_start}
                  trimEnd={selected.trim_end}
                  cropX={selected.crop_x}
                  cropY={selected.crop_y}
                  cropWidth={selected.crop_width}
                  cropHeight={selected.crop_height}
                  cropAspectRatio={selected.crop_aspect_ratio}
                  outputAspectRatio={selected.output_aspect_ratio}
                  title={selected.title}
                  className="w-full h-full object-contain bg-black/60"
                  objectFit="contain"
                  lazy={false}
                />
              </div>
              <button
                onClick={() => setPickerOpen(true)}
                className="text-xs text-zinc-500 mb-3 flex items-center gap-1 hover:text-fuchsia-300 transition"
              >
                <RefreshCw size={12} /> Change GIF
              </button>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 200))}
                placeholder="Add a caption…"
                rows={2}
                className="w-full bg-black/40 border border-fuchsia-500/30 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none mb-3 focus:border-fuchsia-500"
              />
            </>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold text-sm">
              Cancel
            </button>
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

      <FwdLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setSelected}
        title="Use from Library"
      />
    </>
  );
};

const PostEditor: React.FC<{ post: FwdPost; onClose: () => void; openPickerOnMount?: boolean }> = ({ post, onClose, openPickerOnMount }) => {
  const { updatePost } = useAppContext();
  const [selected, setSelected] = useState<Gif | null>(post.gif ?? null);
  const [caption, setCaption] = useState(post.caption ?? '');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(Boolean(openPickerOnMount));

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    const ok = await updatePost(post.id, selected.id, caption);
    setSaving(false);
    if (ok) {
      toast({ title: 'Post updated' });
      onClose();
    } else {
      toast({ title: 'Could not update post', description: 'Try again in a moment.', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <div className="w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/40 p-5">
          <h3 className="text-lg font-black text-white mb-1">Edit post</h3>
          <p className="text-xs text-zinc-500 mb-4">Update the FWD or caption.</p>

          {selected && (
            <div className="aspect-square rounded-2xl overflow-hidden border border-fuchsia-500/30 max-h-56 mx-auto mb-3">
              <FwdMediaPlayer
                mp4Url={selected.mp4_url}
                webmUrl={selected.webm_url}
                gifUrl={selected.image}
                posterUrl={selected.still_url}
                sourceVideoUrl={selected.source_video_url}
                mediaType={selected.media_type}
                isAnimated={selected.is_animated}
                editMetadata={selected.edit_metadata}
                trimStart={selected.trim_start}
                trimEnd={selected.trim_end}
                cropX={selected.crop_x}
                cropY={selected.crop_y}
                cropWidth={selected.crop_width}
                cropHeight={selected.crop_height}
                cropAspectRatio={selected.crop_aspect_ratio}
                outputAspectRatio={selected.output_aspect_ratio}
                title={selected.title}
                className="w-full h-full object-contain bg-black/60"
                objectFit="contain"
                lazy={false}
              />
            </div>
          )}

          <button
            onClick={() => setPickerOpen(true)}
            className="text-xs text-zinc-500 mb-3 flex items-center gap-1 hover:text-fuchsia-300 transition"
          >
            <RefreshCw size={12} /> Change FWD
          </button>

          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value.slice(0, 200))}
            placeholder="Add a caption..."
            rows={2}
            className="w-full bg-black/40 border border-fuchsia-500/30 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none mb-3 focus:border-fuchsia-500"
          />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold text-sm">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !selected}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold text-sm neon-glow-pink disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Edit3 size={15} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <FwdLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setSelected}
        title="Choose FWD"
      />
    </>
  );
};

// ---- Post card ----
const PostCard: React.FC<{ post: FwdPost }> = ({ post }) => {
  const { toggleLike, savePost, deletePost } = useAppContext();
  const { user } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorStartsWithPicker, setEditorStartsWithPicker] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const displayName = post.profile?.display_name || post.profile?.username || 'FWD User';
  const avatar = post.profile?.avatar_url;
  const initial = (displayName).charAt(0).toUpperCase();

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    const result = await shareFwd(post.id, { caption: post.caption ?? undefined });
    setSharing(false);
    if (result === 'copied') toast({ title: 'FWD link copied.' });
    if (result === 'failed') toast({ title: 'Share failed', description: 'Couldn’t share or copy this FWD.', variant: 'destructive' });
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

  const handleDelete = async () => {
    const ok = await deletePost(post.id);
    toast(ok
      ? { title: 'Post deleted' }
      : { title: 'Could not delete post', description: 'Try again in a moment.', variant: 'destructive' }
    );
  };

  const handleDownload = () => {
    if (!post.gif?.allow_download) {
      toast({ title: 'Download not allowed', description: 'The creator has disabled downloads.' });
      return;
    }
    setDownloadOpen(true);
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
            onClick={(event) => { stopActionEvent(event); setMenuOpen(!menuOpen); }}
            className="w-8 h-8 rounded-full glass flex items-center justify-center"
          >
            <MoreHorizontal size={16} className="text-zinc-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-10 glass-strong rounded-xl border border-fuchsia-500/30 py-1 min-w-[150px]">
              <button onClick={(event) => { stopActionEvent(event); setEditorStartsWithPicker(false); setEditorOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2">
                <Edit3 size={14} /> Edit
              </button>
              <button onClick={(event) => { stopActionEvent(event); setEditorStartsWithPicker(true); setEditorOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2">
                <Plus size={14} /> Add GIF with FWD
              </button>
              {post.gif?.allow_download && (
                <button onClick={(event) => { stopActionEvent(event); handleDownload(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2">
                  <Download size={14} /> Download
                </button>
              )}
              <button onClick={(event) => { stopActionEvent(event); setReportOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2">
                <Flag size={14} /> Report
              </button>
              <button onClick={(event) => { stopActionEvent(event); handleDelete(); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-pink-400 hover:bg-white/5 flex items-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
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
            editMetadata={post.gif.edit_metadata}
            trimStart={post.gif.trim_start}
            trimEnd={post.gif.trim_end}
            cropX={post.gif.crop_x}
            cropY={post.gif.crop_y}
            cropWidth={post.gif.crop_width}
            cropHeight={post.gif.crop_height}
            cropAspectRatio={post.gif.crop_aspect_ratio}
            outputAspectRatio={post.gif.output_aspect_ratio}
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
          onClick={(event) => {
            stopActionEvent(event);
            if (user) toggleLike(post.id);
            else nav('/login');
          }}
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

        <button
          onClick={(event) => {
            stopActionEvent(event);
            if (post.gif_id) nav(`/gif/${post.gif_id}`);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition"
        >
          <MessageCircle size={18} className="text-zinc-400" />
          {post.comment_count > 0 && <span className="text-xs font-semibold text-zinc-400">{post.comment_count}</span>}
        </button>

        <button
          onClick={(event) => {
            stopActionEvent(event);
            if (user) savePost(post.id);
            else nav('/login');
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition"
        >
          <Bookmark size={18}
            className={post.saved_by_me ? 'fill-fuchsia-400 text-fuchsia-400' : 'text-zinc-400'}
          />
        </button>

        {post.gif?.allow_reuse && (
          <button
            onClick={(event) => { stopActionEvent(event); handleReuse(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition ml-auto"
          >
            <RefreshCw size={16} className="text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400">Reuse</span>
          </button>
        )}

        <button
          onClick={(event) => { stopActionEvent(event); handleShare(); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/5 transition ${post.gif?.allow_reuse ? '' : 'ml-auto'}`}
        >
          <Share2 size={16} className="text-zinc-400" />
        </button>
      </div>
      <FwdDownloadSheet open={downloadOpen} onOpenChange={setDownloadOpen} gif={post.gif ?? null} shareId={post.id} />
      <FwdReportSheet open={reportOpen} onOpenChange={setReportOpen} gifId={post.gif_id} postId={post.id} />
      {editorOpen && (
        <PostEditor
          post={post}
          openPickerOnMount={editorStartsWithPicker}
          onClose={() => setEditorOpen(false)}
        />
      )}
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
          <NotificationBell className="w-9 h-9" />
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
