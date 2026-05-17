import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Link as LinkIcon, Share2, Flag, Maximize2, Flame, Bell, MessageCircle, Send } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import FwdAnimatedGif from '@/components/FwdAnimatedGif';
import { GIFS, findGif } from '@/data/gifs';
import { Gif, useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const uuidLike = (value?: string) => Boolean(value && /^[0-9a-f-]{36}$/i.test(value));

const GifDetail: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { toggleFavorite, isFavorite } = useAppContext();
  const { user } = useAuth();
  const [gif, setGif] = useState<Gif | null>(() => findGif(id || '') || null);
  const [loading, setLoading] = useState(Boolean(uuidLike(id)));
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [comment, setComment] = useState('');
  const fav = gif ? isFavorite(gif.id, gif.image) : false;

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!id || !uuidLike(id)) return;
      setLoading(true);
      const { data } = await supabase
        .from('fwd_gifs')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancel) return;
      if (data) {
        setGif({
          id: data.id,
          title: data.title || 'Untitled FWD',
          image: data.gif_url || data.media_url,
          still_url: data.still_url || data.thumbnail_url || data.preview_url,
          tags: data.tags || [],
          category: data.category || 'Reactions',
          mood: data.mood || undefined,
          user_id: data.owner_user_id,
          caption: data.caption || undefined,
          like_count: data.like_count || 0,
          visibility: data.visibility,
        });
        setLikeCount(data.like_count || 0);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!id || !uuidLike(id)) return;
      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        user
          ? supabase.from('gif_likes').select('id').eq('gif_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('gif_comments')
          .select('id, body, created_at, profile:user_id(display_name, username, avatar_url)')
          .eq('gif_id', id)
          .order('created_at', { ascending: true })
          .limit(50),
      ]);
      if (cancel) return;
      setLiked(Boolean(likeRows));
      setComments((commentRows || []).map((row: any) => ({
        ...row,
        profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
      })));
    })();
    return () => { cancel = true; };
  }, [id, user]);

  const copy = async () => {
    if (!gif) return;
    await navigator.clipboard.writeText(`${window.location.origin}/gif/${gif.id}`);
    toast({ title: 'Link copied', description: 'Forward the feeling.' });
  };

  const share = async () => {
    if (!gif) return;
    const url = `${window.location.origin}/gif/${gif.id}`;
    try {
      if (navigator.share) await navigator.share({ title: gif.title, url });
      else await copy();
      if (uuidLike(gif.id)) await supabase.from('gif_shares').insert({ gif_id: gif.id, user_id: user?.id || null, share_channel: navigator.share ? 'native' : 'copy' });
    } catch {
      toast({ title: 'Share failed', description: 'Could not open the share sheet.', variant: 'destructive' });
    }
  };

  const toggleLike = async () => {
    if (!gif || !uuidLike(gif.id)) {
      if (gif) await toggleFavorite(gif.id, gif);
      return;
    }
    if (!user) {
      toast({ title: 'Sign in to like', description: 'Create or sign into FWD to react.' });
      nav('/login');
      return;
    }
    setLiked((v) => !v);
    setLikeCount((v) => Math.max(0, v + (liked ? -1 : 1)));
    const { error } = liked
      ? await supabase.from('gif_likes').delete().eq('gif_id', gif.id).eq('user_id', user.id)
      : await supabase.from('gif_likes').insert({ gif_id: gif.id, user_id: user.id });
    if (error) {
      setLiked(liked);
      setLikeCount((v) => Math.max(0, v + (liked ? 1 : -1)));
      toast({ title: 'Like failed', description: 'Try again in a moment.', variant: 'destructive' });
    }
  };

  const postComment = async () => {
    if (!gif || !uuidLike(gif.id)) return;
    if (!user) {
      toast({ title: 'Sign in to comment', description: 'Create or sign into FWD to join the conversation.' });
      nav('/login');
      return;
    }
    const body = comment.trim();
    if (!body) return;
    if (body.length > 500) {
      toast({ title: 'Comment too long', description: 'Keep comments under 500 characters.', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase
      .from('gif_comments')
      .insert({ gif_id: gif.id, user_id: user.id, body })
      .select('id, body, created_at, profile:user_id(display_name, username, avatar_url)')
      .single();
    if (error || !data) {
      toast({ title: 'Comment failed', description: 'Try again in a moment.', variant: 'destructive' });
      return;
    }
    setComment('');
    setComments((prev) => [...prev, { ...data, profile: Array.isArray((data as any).profile) ? (data as any).profile[0] : (data as any).profile } as CommentRow]);
  };

  const related = gif ? GIFS.filter(g => g.id !== gif.id && (g.category === gif.category || g.mood === gif.mood)).slice(0, 6) : [];

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

        {loading ? (
          <div className="glass-strong rounded-3xl border border-fuchsia-500/30 aspect-square animate-pulse" />
        ) : !gif ? (
          <div className="glass-strong rounded-3xl p-8 text-center border border-fuchsia-500/20">
            <h1 className="text-xl font-black text-white">FWD not found</h1>
            <p className="text-zinc-400 text-sm mt-1">This GIF is private or no longer available.</p>
          </div>
        ) : (
          <>
            <div className="relative rounded-3xl overflow-hidden glass-strong border border-fuchsia-500/40 neon-glow-purple aspect-square">
              <FwdAnimatedGif gifUrl={gif.image} stillUrl={gif.still_url} title={gif.title} className="w-full h-full object-contain bg-black/60" lazy={false} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 text-[11px] font-bold tracking-wider text-white border border-white/10">GIF</span>
              <button className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/15">
                <Maximize2 size={16} className="text-white" />
              </button>
            </div>

            <div className="flex items-start justify-between mt-5">
              <div className="min-w-0">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight break-words">{gif.title}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Flame size={14} className="text-fuchsia-400" />
                  <span className="text-fuchsia-400 font-semibold">{likeCount} likes · {comments.length} comments</span>
                </div>
              </div>
              <button onClick={() => toggleFavorite(gif.id, gif)} className="w-12 h-12 rounded-full glass flex items-center justify-center border border-pink-500/30 shrink-0">
                <Heart size={22} className={fav ? 'fill-pink-500 text-pink-500' : 'text-pink-400'} />
              </button>
            </div>

            {gif.caption && <p className="mt-3 text-zinc-300 text-sm">{gif.caption}</p>}

            <div className="flex flex-wrap gap-2 mt-4">
              {gif.tags.map(t => (
                <button key={t} onClick={() => nav('/search?q=' + encodeURIComponent(t))}
                  className="px-3 py-1.5 rounded-full glass border border-fuchsia-500/30 text-sm text-zinc-200">
                  #{t}
                </button>
              ))}
            </div>

            <div className="mt-5 glass-strong rounded-2xl border border-fuchsia-500/30 flex divide-x divide-white/5 overflow-hidden">
              <ActionBtn icon={Heart} label="Like" onClick={toggleLike} active={liked} />
              <ActionBtn icon={MessageCircle} label="Comment" onClick={() => document.getElementById('comment-box')?.focus()} />
              <ActionBtn icon={LinkIcon} label="Copy Link" onClick={copy} />
              <ActionBtn icon={Share2} label="Share" onClick={share} />
              <ActionBtn icon={Flag} label="Report" onClick={() => toast({ title: 'Reported', description: 'Thanks. We will review this content.' })} />
            </div>

            <section className="mt-6 glass-strong rounded-2xl border border-fuchsia-500/20 p-4">
              <h2 className="text-sm font-black tracking-wider text-white mb-3">COMMENTS</h2>
              {comments.length === 0 ? (
                <p className="text-sm text-zinc-500 mb-3">No comments yet. Start the conversation.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map((c) => {
                    const name = c.profile?.display_name || c.profile?.username || 'FWD User';
                    return (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-white shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">{name}</p>
                          <p className="text-sm text-zinc-300 break-words">{c.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  id="comment-box"
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  placeholder="Add a comment..."
                  className="flex-1 min-w-0 rounded-xl bg-black/40 border border-fuchsia-500/25 px-3 py-2.5 text-sm text-white outline-none"
                />
                <button onClick={postComment} className="w-11 rounded-xl bg-fuchsia-600 flex items-center justify-center">
                  <Send size={16} className="text-white" />
                </button>
              </div>
            </section>

            {related.length > 0 && (
              <>
                <h3 className="text-base font-black text-white tracking-wider mt-7 mb-3">MORE LIKE THIS</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {related.map(g => <GifCard key={g.id} gif={g} showHeart={false} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default GifDetail;
