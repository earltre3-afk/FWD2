import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Heart, Link as LinkIcon, Share2, Flag, Maximize2, Flame,
  MessageCircle, Send, Trash2, RefreshCw, Download, Smile,
  FolderPlus, Layers,
} from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import FwdLibraryPicker from '@/components/FwdLibraryPicker';
import { GIFS, findGif } from '@/data/gifs';
import { Gif, useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { resolveFwdMedia } from '@/lib/fwdMedia';
import { editMetadataFromDb } from '@/lib/mediaEdits';
import { copyFwdLink, getFwdShareUrl, shareFwdItem } from '@/lib/fwdShare';
import { stopActionEvent } from '@/lib/actionEvents';
import NotificationBell from '@/components/NotificationBell';
import FwdDownloadSheet from '@/components/fwd-actions/FwdDownloadSheet';
import FwdReportSheet from '@/components/fwd-actions/FwdReportSheet';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface CommentRow {
  id: string;
  body: string | null;
  created_at: string;
  user_id: string;
  reply_gif_url?: string | null;
  reply_gif_id?: string | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

interface ReactionRow {
  id: string;
  user_id: string;
  reaction_gif_url: string | null;
  reaction_gif_id: string | null;
  reaction_key?: string | null;
  reaction_label?: string | null;
  reaction_emoji?: string | null;
  profile?: { display_name: string | null; username: string | null } | null;
}

const REACTION_OPTIONS = [
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'love', emoji: '😍', label: 'Love' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'side_eye', emoji: '😒', label: 'Side Eye' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'dead', emoji: '💀', label: 'Dead' },
] as const;

const uuidLike = (value?: string) => Boolean(value && /^[0-9a-f-]{36}$/i.test(value));

const GifDetail: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { toggleFavorite, isFavorite } = useAppContext();
  const { user, profile } = useAuth();
  // Priority: route state > static data > null (will fetch from DB if UUID)
  const stateGif = (location.state as any)?.gif as Gif | undefined;
  const [gif, setGif] = useState<Gif | null>(() => stateGif || findGif(id || '') || null);
  const [loading, setLoading] = useState(Boolean(!stateGif && uuidLike(id)));
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [comment, setComment] = useState('');
  const [replyGif, setReplyGif] = useState<Gif | null>(null);
  const [replyPickerOpen, setReplyPickerOpen] = useState(false);
  const [reactPickerOpen, setReactPickerOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [packPickerOpen, setPackPickerOpen] = useState(false);
  const [packs, setPacks] = useState<{ id: string; name: string }[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packMenuOpen, setPackMenuOpen] = useState(false);
  const [remixes, setRemixes] = useState<Gif[]>([]);
  const fav = gif ? isFavorite(gif.id, gif.image) : false;

  // Load GIF from DB if UUID (route state provides immediate data, DB provides richer data)
  useEffect(() => {
    let cancel = false;
    (async () => {
      // If we already have a gif from route state and the id is not a UUID, skip DB fetch
      if (!id || !uuidLike(id)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase.from('fwd_gifs').select('*').eq('id', id).maybeSingle();
      if (cancel) return;
      if (data) {
        const media = resolveFwdMedia(data);
        setGif({
          id: data.id,
          title: data.title || 'Untitled FWD',
          image: media.animatedUrl || '',
          still_url: media.thumbnailUrl || undefined,
          tags: data.tags || [],
          category: data.category || 'Reactions',
          mood: data.mood || undefined,
          user_id: data.owner_user_id,
          caption: data.caption || undefined,
          like_count: data.like_count || 0,
          visibility: data.visibility,
          mp4_url: media.mp4Url || undefined,
          webm_url: media.webmUrl || undefined,
          source_video_url: media.sourceVideoUrl || undefined,
          media_type: data.media_type || undefined,
          is_animated: data.is_animated ?? media.isLikelyAnimated,
          allow_reuse: data.allow_reuse ?? true,
          allow_download: data.allow_download ?? true,
          trim_start: data.trim_start ?? null,
          trim_end: data.trim_end ?? null,
          original_duration: data.original_duration ?? null,
          edited_duration: data.edited_duration ?? null,
          crop_x: data.crop_x ?? null,
          crop_y: data.crop_y ?? null,
          crop_width: data.crop_width ?? null,
          crop_height: data.crop_height ?? null,
          crop_aspect_ratio: data.crop_aspect_ratio ?? null,
          output_aspect_ratio: data.output_aspect_ratio ?? null,
          edit_metadata: editMetadataFromDb(data),
        });
        setLikeCount(data.like_count || 0);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  // Load likes, comments, and reactions
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!id || !uuidLike(id)) return;
      const [{ data: likeRows }, { data: commentRows }, { data: reactionRows }] = await Promise.all([
        user
          ? supabase.from('gif_likes').select('id').eq('gif_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        // No profile join — gif_comments.user_id FKs to auth.users, not profiles.
        // Profiles are fetched separately below.
        supabase
          .from('gif_comments')
          .select('id, body, created_at, user_id, reply_gif_url, reply_gif_id')
          .eq('gif_id', id)
          .order('created_at', { ascending: true })
          .limit(50),
        // No profile join — gif_reactions.user_id FKs to auth.users, not profiles.
        supabase
          .from('gif_reactions')
          .select('id, user_id, reaction_gif_url, reaction_gif_id, reaction_key, reaction_label, reaction_emoji')
          .eq('gif_id', id)
          .limit(30),
      ]);
      if (cancel) return;
      setLiked(Boolean(likeRows));

      // Fetch profiles for comment authors in a single separate query
      const commentUserIds = [...new Set((commentRows || []).map((c: any) => c.user_id as string))];
      const profilesMap = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();
      if (commentUserIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', commentUserIds);
        (profileRows || []).forEach((p: any) => profilesMap.set(p.id, p));
      }

      setComments((commentRows || []).map((row: any) => ({
        ...row,
        profile: profilesMap.get(row.user_id) ?? null,
      })));
      setReactions((reactionRows || []).map((row: any) => ({
        ...row,
        profile: null,
      })));
      
      // Load public remixes
      if (uuidLike(id)) {
        const { data: remixData } = await supabase
          .from('fwd_gifs')
          .select('*')
          .eq('remixed_from_gif_id', id)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (remixData) {
          setRemixes(remixData.map(g => {
            const media = resolveFwdMedia(g);
            return {
              id: g.id,
              title: g.title || 'Untitled',
              image: media.animatedUrl || '',
              still_url: media.thumbnailUrl || undefined,
              tags: g.tags || [],
              category: g.category || 'Reactions',
              user_id: g.owner_user_id,
              allow_reuse: g.allow_reuse ?? true,
              visibility: g.visibility,
              mp4_url: media.mp4Url,
              webm_url: media.webmUrl,
              source_video_url: media.sourceVideoUrl,
              media_type: g.media_type,
              is_animated: g.is_animated ?? media.isLikelyAnimated,
            };
          }));
        }
      }
    })();
    return () => { cancel = true; };
  }, [id, user, gif]);

  const shareId = gif?.id && uuidLike(gif.id) ? gif.id : undefined;

  // Copy link
  const copy = async () => {
    if (!gif) return;
    const copied = shareId
      ? await copyFwdLink(shareId)
      : await navigator.clipboard.writeText(`${window.location.origin}/gif/${gif.id}`).then(() => true).catch(() => false);
    toast({ title: copied ? 'FWD link copied.' : "Couldn't share or copy this FWD.", variant: copied ? 'default' : 'destructive' });
  };

  // Share
  const share = async () => {
    if (!gif || shareBusy) return;
    setShareBusy(true);
    const result = shareId
      ? await shareFwdItem({
        id: shareId,
        title: gif.title || 'You got a FWD',
        caption: gif.caption || 'Open this FWD, remix it, or send one back.',
        absoluteUrl: getFwdShareUrl(shareId),
      })
      : 'failed';
    setShareBusy(false);
    if (result === 'copied') toast({ title: 'FWD link copied.' });
    if (result === 'failed') toast({ title: 'Share failed', description: "Couldn't share or copy this FWD.", variant: 'destructive' });
    if (result !== 'cancelled' && uuidLike(gif.id)) {
      supabase.from('gif_shares').insert({
        gif_id: gif.id,
        user_id: user?.id || null,
        share_channel: result,
      }).then(() => {});
    }
  };

  // Download
  const download = () => {
    if (!gif) return;
    if (gif.visibility === 'private' && gif.user_id !== user?.id) {
      toast({ title: 'Private content', description: 'This GIF is private.', variant: 'destructive' });
      return;
    }
    setDownloadOpen(true);
  };

  // Like / unlike
  const toggleLike = async () => {
    if (likeBusy) return;
    if (!gif || !uuidLike(gif.id)) {
      if (gif) await toggleFavorite(gif.id, gif);
      return;
    }
    if (!user) {
      toast({ title: 'Sign in to like', description: 'Create or sign into FWD to react.' });
      nav('/login');
      return;
    }
    setLikeBusy(true);
    setLiked(v => !v);
    setLikeCount(v => Math.max(0, v + (liked ? -1 : 1)));
    const { error } = liked
      ? await supabase.from('gif_likes').delete().eq('gif_id', gif.id).eq('user_id', user.id)
      : await supabase.from('gif_likes').upsert(
          { gif_id: gif.id, user_id: user.id },
          { onConflict: 'user_id,gif_id', ignoreDuplicates: true }
        );
    setLikeBusy(false);
    if (error) {
      setLiked(liked);
      setLikeCount(v => Math.max(0, v + (liked ? 1 : -1)));
      toast({ title: "Couldn't like this FWD. Try again.", variant: 'destructive' });
    }
  };

  // Post comment (text, GIF, or text+GIF)
  const postComment = async () => {
    if (commentBusy) return;
    if (!gif || !uuidLike(gif.id)) return;
    if (!user) {
      toast({ title: 'Sign in to comment', description: 'Create or sign into FWD to join the conversation.' });
      nav('/login');
      return;
    }
    const body = comment.trim() || null;
    if (!body && !replyGif) return;
    if (body && body.length > 500) {
      toast({ title: 'Comment too long', description: 'Keep comments under 500 characters.', variant: 'destructive' });
      return;
    }
    setCommentBusy(true);
    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
    const { data, error } = await supabase
      .from('gif_comments')
      .insert({
        gif_id: gif.id,
        user_id: user.id,
        body,
        reply_gif_id: replyGif && uuidLike(replyGif.id) ? replyGif.id : null,
        reply_gif_url: replyGif?.image || null,
      })
      .select('id, body, created_at, user_id, reply_gif_url, reply_gif_id')
      .single();
    setCommentBusy(false);
    if (error || !data) {
      toast({ title: "Comment couldn't post. Try again.", variant: 'destructive' });
      return;
    }
    setComment('');
    setReplyGif(null);
    setComments(prev => [...prev, {
      ...data,
      profile: {
        display_name: (profile as any)?.display_name ?? null,
        username: (profile as any)?.username ?? null,
        avatar_url: (profile as any)?.avatar_url ?? null,
      },
    } as CommentRow]);
  };

  // React with emoji
  const handleReact = async (reaction: typeof REACTION_OPTIONS[number]) => {
    if (!gif || !uuidLike(gif.id)) return;
    if (!user) {
      toast({ title: 'Sign in to react', description: 'Create or sign into FWD to react.' });
      nav('/login');
      return;
    }
    if (reactionBusy) return;
    setReactionBusy(true);
    const existing = reactions.find(r => r.user_id === user.id);
    const optimistic: ReactionRow = {
      id: existing?.id || `local-${reaction.key}`,
      user_id: user.id,
      reaction_gif_url: null,
      reaction_gif_id: null,
      reaction_key: reaction.key,
      reaction_label: reaction.label,
      reaction_emoji: reaction.emoji,
    };
    setReactions(prev => existing
      ? prev.map(r => r.id === existing.id ? optimistic : r)
      : [...prev, optimistic]
    );
    if (existing) {
      const { error } = await supabase.from('gif_reactions').update({
        reaction_key: reaction.key,
        reaction_label: reaction.label,
        reaction_emoji: reaction.emoji,
        reaction_gif_id: null,
        reaction_gif_url: null,
      }).eq('id', existing.id);
      if (error) {
        setReactions(prev => prev.map(r => r.id === existing.id ? existing : r));
        toast({ title: "Couldn't save reaction.", variant: 'destructive' });
      }
    } else {
      const { data, error } = await supabase
        .from('gif_reactions')
        .insert({
          gif_id: gif.id,
          user_id: user.id,
          reaction_key: reaction.key,
          reaction_label: reaction.label,
          reaction_emoji: reaction.emoji,
          reaction_gif_id: null,
          reaction_gif_url: null,
        })
        .select('id, user_id, reaction_gif_url, reaction_gif_id, reaction_key, reaction_label, reaction_emoji')
        .single();
      if (data) {
        setReactions(prev => prev.map(r => r.id === optimistic.id ? {
          ...data,
          profile: null,
        } as ReactionRow : r));
      }
      if (error) {
        setReactions(prev => prev.filter(r => r.id !== optimistic.id));
        toast({ title: "Couldn't save reaction.", variant: 'destructive' });
      }
    }
    setReactionBusy(false);
    setReactPickerOpen(false);
  };

  // Remix — open Remix Studio
  const remix = () => {
    if (!gif) return;
    if (gif.visibility === 'private' && user?.id !== gif.user_id) {
      toast({ title: 'Cannot remix private content', variant: 'destructive' });
      return;
    }
    nav(`/remix/${gif.id}`, { state: { gif } });
  };

  // Add to Pack
  const loadPacks = async () => {
    if (!user) return;
    setPacksLoading(true);
    const { data } = await supabase
      .from('fwd_library_packs')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setPacks(data || []);
    setPacksLoading(false);
  };

  const addToPack = async (packId: string) => {
    if (!gif || !uuidLike(gif.id) || !user) return;
    setPackMenuOpen(false);
    const { error } = await supabase
      .from('fwd_library_pack_items')
      .upsert({ pack_id: packId, gif_id: gif.id, position: 0 }, { onConflict: 'pack_id,gif_id' });
    if (error) {
      toast({ title: 'Could not add to pack', variant: 'destructive' });
    } else {
      const pack = packs.find(p => p.id === packId);
      toast({ title: `Added to "${pack?.name || 'pack'}"` });
    }
  };

  const related = gif
    ? GIFS.filter(g => g.id !== gif.id && (g.category === gif.category || g.mood === gif.mood)).slice(0, 6)
    : [];

  const ActionBtn = ({ icon: Icon, label, onClick, active, disabled }: { icon: any; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) => (
    <button
      type="button"
      onClick={(event) => {
        stopActionEvent(event);
        onClick();
      }}
      disabled={disabled}
      className="flex-1 flex flex-col items-center gap-1.5 py-3 hover:bg-white/5 transition disabled:opacity-60"
    >
      <Icon
        size={22}
        className={active ? 'fill-pink-500 text-pink-500' : 'text-fuchsia-300'}
        style={active ? { filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.8))' } : {}}
      />
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
          <NotificationBell />
        </div>

        {loading ? (
          <div className="glass-strong rounded-3xl border border-fuchsia-500/30 aspect-square animate-pulse" />
        ) : !gif ? (
          <div className="glass-strong rounded-3xl p-8 text-center border border-fuchsia-500/20">
            <h1 className="text-xl font-black text-white">Couldn't load this GIF</h1>
            <p className="text-zinc-400 text-sm mt-1 mb-4">This GIF may be private or no longer available.</p>
            <button onClick={() => nav(-1)} className="px-5 py-2.5 rounded-xl bg-fuchsia-600 text-white text-sm font-bold">Go Back</button>
          </div>
        ) : (
          <>
            {/* Media */}
            <div className="relative rounded-3xl overflow-hidden glass-strong border border-fuchsia-500/40 neon-glow-purple aspect-square">
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
                className="w-full h-full object-contain bg-black/60"
                objectFit="contain"
                lazy={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 text-[11px] font-bold tracking-wider text-white border border-white/10">GIF</span>
              <button type="button" className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/15">
                <Maximize2 size={16} className="text-white" />
              </button>
            </div>

            {/* Title + stats */}
            <div className="flex items-start justify-between mt-5">
              <div className="min-w-0">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight break-words">{gif.title}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Flame size={14} className="text-fuchsia-400" />
                  <span className="text-fuchsia-400 font-semibold">
                    {likeCount} likes · {comments.length} comments · {reactions.length} reactions
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleFavorite(gif.id, gif)}
                className="w-12 h-12 rounded-full glass flex items-center justify-center border border-pink-500/30 shrink-0"
              >
                <Heart size={22} className={fav ? 'fill-pink-500 text-pink-500' : 'text-pink-400'} />
              </button>
            </div>

            {gif.caption && <p className="mt-3 text-zinc-300 text-sm">{gif.caption}</p>}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {gif.tags.map(t => (
                <button
                  key={t}
                  onClick={() => nav('/search?q=' + encodeURIComponent(t))}
                  className="px-3 py-1.5 rounded-full glass border border-fuchsia-500/30 text-sm text-zinc-200"
                >
                  #{t}
                </button>
              ))}
            </div>

            {/* Action bar */}
            <div className="mt-5 glass-strong rounded-2xl border border-fuchsia-500/30 flex divide-x divide-white/5 overflow-hidden">
              <ActionBtn icon={Heart} label="Like" onClick={toggleLike} active={liked} disabled={likeBusy} />
              <ActionBtn icon={MessageCircle} label="Comment" onClick={() => setCommentsOpen(true)} />
              <ActionBtn icon={Smile} label="React" onClick={() => {
                if (!user) { nav('/login'); return; }
                setReactPickerOpen(true);
              }} disabled={reactionBusy} />
              <ActionBtn icon={LinkIcon} label="Copy" onClick={copy} />
              <ActionBtn icon={Share2} label="Share" onClick={share} disabled={shareBusy} />
            </div>

            {/* Secondary action row */}
            <div className="mt-2 glass rounded-2xl border border-white/10 flex divide-x divide-white/5 overflow-hidden">
              <button
                onClick={(event) => { stopActionEvent(event); remix(); }}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-white/5 transition"
              >
                <RefreshCw size={16} className="text-cyan-400" />
                <span className="text-[11px] text-zinc-400 font-semibold">Remix</span>
              </button>
              {gif.allow_download !== false && (
                <button
                  onClick={(event) => { stopActionEvent(event); download(); }}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-white/5 transition"
                >
                  <Download size={16} className="text-zinc-400" />
                  <span className="text-[11px] text-zinc-400 font-semibold">Download</span>
                </button>
              )}
              {uuidLike(gif.id) && (
                <div className="flex-1 relative">
                  <button
                    onClick={(event) => {
                      stopActionEvent(event);
                      if (!user) { nav('/login'); return; }
                      loadPacks();
                      setPackMenuOpen(v => !v);
                    }}
                    className="w-full flex flex-col items-center gap-1 py-2.5 hover:bg-white/5 transition"
                  >
                    <Layers size={16} className="text-fuchsia-400" />
                    <span className="text-[11px] text-zinc-400 font-semibold">Add to Pack</span>
                  </button>
                  {packMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 z-20 glass-strong rounded-xl border border-fuchsia-500/30 py-1 min-w-[160px]">
                      {packsLoading ? (
                        <p className="text-xs text-zinc-500 px-3 py-2">Loading…</p>
                      ) : packs.length === 0 ? (
                        <p className="text-xs text-zinc-500 px-3 py-2">No packs yet. Create one in your profile.</p>
                      ) : (
                        packs.map(p => (
                          <button
                            key={p.id}
                            onClick={() => addToPack(p.id)}
                            className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-white/5 flex items-center gap-2"
                          >
                            <FolderPlus size={13} className="text-fuchsia-400 shrink-0" />
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={(event) => { stopActionEvent(event); setReportOpen(true); }}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 hover:bg-white/5 transition"
              >
                <Flag size={16} className="text-zinc-500" />
                <span className="text-[11px] text-zinc-500 font-semibold">Report</span>
              </button>
            </div>

            {/* Reactions strip */}
            {reactions.length > 0 && (
              <div className="mt-5">
                <h2 className="text-xs font-black tracking-wider text-white mb-2">REACTIONS</h2>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {reactions.map(r => r.reaction_emoji ? (
                    <div key={r.id} className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-fuchsia-500/30 bg-black/50 flex flex-col items-center justify-center">
                      <span className="text-2xl leading-none">{r.reaction_emoji}</span>
                      <p className="mt-1 px-1 text-[7px] font-bold text-white truncate text-center w-full">
                        {r.reaction_label || ''}
                      </p>
                    </div>
                  ) : r.reaction_gif_url ? (
                    <div key={r.id} className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-fuchsia-500/30">
                      <FwdMediaPlayer
                        gifUrl={r.reaction_gif_url}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <p className="absolute bottom-0.5 left-0.5 right-0.5 text-[7px] font-bold text-white truncate text-center">
                        {r.profile?.display_name || r.profile?.username || ''}
                      </p>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}

            {/* Comments */}
            {uuidLike(gif.id) && (
              <section className="mt-6 glass-strong rounded-2xl border border-fuchsia-500/20 p-4">
                <h2 className="text-sm font-black tracking-wider text-white mb-3">COMMENTS</h2>
                {comments.length === 0 ? (
                  <p className="text-sm text-zinc-500 mb-3">No comments yet. Start the conversation.</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {comments.map(c => {
                      const name = c.profile?.display_name || c.profile?.username || 'FWD User';
                      const isOwn = user && c.user_id === user.id;
                      return (
                        <div key={c.id} className="flex gap-2 group">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-white shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white">{name}</p>
                            {c.body && (
                              <p className="text-sm text-zinc-300 break-words">{c.body}</p>
                            )}
                            {c.reply_gif_url && (
                              <div className="mt-1.5 w-24 h-24 rounded-xl overflow-hidden border border-fuchsia-500/30">
                                <FwdMediaPlayer
                                  gifUrl={c.reply_gif_url}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                          {isOwn && (
                            <button
                              onClick={async () => {
                                const { error } = await supabase.from('gif_comments').delete().eq('id', c.id);
                                if (!error) setComments(prev => prev.filter(x => x.id !== c.id));
                              }}
                              className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/20 transition"
                              title="Delete comment"
                            >
                              <Trash2 size={13} className="text-zinc-500 hover:text-red-400" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Attached GIF preview */}
                {replyGif && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-fuchsia-500/40 shrink-0">
                      <FwdMediaPlayer gifUrl={replyGif.image} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-zinc-400 flex-1 truncate">{replyGif.title}</p>
                    <button onClick={() => setReplyGif(null)} className="text-zinc-500 hover:text-white">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}

                {/* Comment input */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!user) { nav('/login'); return; }
                      setReplyPickerOpen(true);
                    }}
                    className="w-11 rounded-xl glass border border-fuchsia-500/25 flex items-center justify-center shrink-0"
                    title="Reply with FWD"
                  >
                    <MessageCircle size={16} className={replyGif ? 'text-fuchsia-400' : 'text-zinc-500'} />
                  </button>
                  <input
                    id="comment-box"
                    value={comment}
                    onChange={e => setComment(e.target.value.slice(0, 500))}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                    placeholder={user ? (replyGif ? 'Add caption or send GIF only…' : 'Add a comment…') : 'Sign in to comment'}
                    readOnly={!user}
                    onClick={() => { if (!user) { toast({ title: 'Sign in to comment' }); nav('/login'); } }}
                    className="flex-1 min-w-0 rounded-xl bg-black/40 border border-fuchsia-500/25 px-3 py-2.5 text-sm text-white outline-none placeholder-zinc-500"
                  />
                  <button
                    onClick={postComment}
                    className="w-11 rounded-xl bg-fuchsia-600 flex items-center justify-center shrink-0"
                  >
                    <Send size={16} className="text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5">Reply with FWD: tap the chat icon to attach a GIF.</p>
              </section>
            )}

            {/* Remixes of this GIF */}
            {remixes.length > 0 && (
              <>
                <h3 className="text-base font-black text-white tracking-wider mt-7 mb-3 animate-text-glow">REMIXES OF THIS GIF</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 stagger-children">
                  {remixes.map(g => <GifCard key={g.id} gif={g} showHeart={false} />)}
                </div>
              </>
            )}

            {/* More like this */}
            {related.length > 0 && (
              <>
                <h3 className="text-base font-black text-white tracking-wider mt-7 mb-3 animate-text-glow">MORE LIKE THIS</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 stagger-children">
                  {related.map(g => <GifCard key={g.id} gif={g} showHeart={false} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Pickers */}
      <FwdLibraryPicker
        open={replyPickerOpen}
        onClose={() => setReplyPickerOpen(false)}
        onSelect={g => setReplyGif(g)}
        title="Reply with FWD"
      />
      <Sheet open={reactPickerOpen} onOpenChange={setReactPickerOpen}>
        <SheetContent
          side="center"
          className="glass-strong border-fuchsia-500/30 rounded-2xl px-5 pt-5 pb-5 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white">React</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {REACTION_OPTIONS.map((reaction) => (
              <button
                key={reaction.key}
                type="button"
                onClick={() => handleReact(reaction)}
                disabled={reactionBusy}
                className="flex items-center gap-3 rounded-xl border border-fuchsia-500/25 bg-black/35 px-4 py-3 text-left text-sm font-bold text-white disabled:opacity-60"
              >
                <span className="text-2xl leading-none">{reaction.emoji}</span>
                {reaction.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent
          side="center"
          className="glass-strong border-fuchsia-500/30 rounded-2xl pt-5 pb-4 px-5 flex flex-col"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-white">Comments</SheetTitle>
          </SheetHeader>
          {/* Scrollable comment list — input is NOT inside here */}
          <div className="mt-4 space-y-3 flex-1 overflow-y-auto min-h-0 pb-1">
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500">No comments yet. Start the conversation.</p>
            ) : comments.map((c) => {
              const name = c.profile?.display_name || c.profile?.username || 'FWD User';
              return (
                <div key={c.id} className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-white shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white">{name}</p>
                    <p className="text-sm text-zinc-300 break-words">{c.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Input pinned outside the scroll area — always visible, never covered */}
          <div className="flex gap-2 pt-3 border-t border-white/5 shrink-0">
            <input
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
              placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
              readOnly={!user}
              autoComplete="off"
              className="flex-1 min-w-0 rounded-xl bg-black/40 border border-fuchsia-500/25 px-3 py-2.5 text-sm text-white outline-none placeholder-zinc-500 focus:border-fuchsia-400"
            />
            <button
              type="button"
              onClick={postComment}
              disabled={commentBusy || !comment.trim()}
              className="px-4 rounded-xl bg-fuchsia-600 text-sm font-bold text-white disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <FwdDownloadSheet open={downloadOpen} onOpenChange={setDownloadOpen} gif={gif} shareId={shareId} />
      <FwdReportSheet open={reportOpen} onOpenChange={setReportOpen} gifId={gif?.id} />

      <BottomNav />
    </div>
  );
};

export default GifDetail;
