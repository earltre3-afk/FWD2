import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Share2, Loader2, ArrowRight, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import FwdLogo from '@/components/FwdLogo';
import FwdAnimatedGif from '@/components/FwdAnimatedGif';
import { shareFwd, recordShare, trackShareOpen } from '@/lib/fwdShare';
import { toast } from '@/components/ui/use-toast';

interface SharePost {
  id: string;
  title: string | null;
  caption: string | null;
  gif_url: string | null;
  still_url: string | null;
  is_public: boolean | null;
  user_id: string | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

interface FeedShareRow {
  id: string;
  caption: string | null;
  visibility: string | null;
  user_id: string | null;
  gif?: {
    id: string;
    title: string | null;
    caption: string | null;
    gif_url: string | null;
    still_url: string | null;
    visibility: string | null;
  } | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const FwdShare: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<SharePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    const load = async () => {
      const { data, error } = await supabase
        .from('fwd_feed_posts')
        .select(`
          id,
          caption,
          visibility,
          user_id,
          gif:gif_id ( id, title, caption, gif_url, still_url, visibility ),
          profile:fwd_feed_posts_user_profiles_fk ( display_name, username, avatar_url )
        `)
        .eq('id', id)
        .maybeSingle();

      const row = data as FeedShareRow | null;
      const gif = Array.isArray(row?.gif) ? row?.gif[0] : row?.gif;
      const profile = Array.isArray(row?.profile) ? row?.profile[0] : row?.profile;

      if (error || !row || row.visibility !== 'public' || !gif || gif.visibility === 'private') {
        setNotFound(true);
      } else {
        setPost({
          id: row.id,
          title: gif.title,
          caption: row.caption || gif.caption,
          gif_url: gif.gif_url,
          still_url: gif.still_url,
          is_public: row.visibility === 'public',
          user_id: row.user_id,
          profile: profile ?? null,
        });
      }
      setLoading(false);
    };

    load();
  }, [id]);

  // Fire analytics on mount (after post resolves)
  useEffect(() => {
    if (!id || loading || notFound) return;
    const shareToken = searchParams.get('t') ?? undefined;
    trackShareOpen(id, { shareToken, openedBy: user?.id });
  }, [id, loading, notFound]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async () => {
    if (!id || !post) return;
    setSharing(true);
    const result = await shareFwd(id, { caption: post.caption || post.title || undefined });
    setSharing(false);
    if (result === 'copied') toast({ title: 'Link copied to clipboard' });
    if (result === 'native') toast({ title: 'Shared!' });
    if (result === 'error') toast({ title: 'Could not share', variant: 'destructive' });
    if (result !== 'cancelled') recordShare(id, { sharedBy: user?.id, channel: result });
  };

  const displayName = post?.profile?.display_name || post?.profile?.username || 'Someone on FWD';
  const caption = post?.caption || post?.title || '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-fuchsia-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <FwdLogo size="lg" className="mb-6" />
        <div className="glass-strong rounded-3xl border border-fuchsia-500/20 p-10 max-w-sm w-full">
          <Lock size={32} className="text-zinc-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">FWD not found</h2>
          <p className="text-zinc-400 text-sm mb-6">This FWD may be private or no longer available.</p>
          <button
            onClick={() => nav('/feed')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink"
          >
            Explore the Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-8 pb-24">
      <FwdLogo size="md" className="mb-6" />

      <div className="w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/20 overflow-hidden">
        {/* Creator */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 to-cyan-400 shrink-0">
            {post?.profile?.avatar_url ? (
              <img src={post.profile.avatar_url} className="w-full h-full rounded-full object-cover" alt={displayName} />
            ) : (
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-sm font-black text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{displayName}</p>
            <p className="text-zinc-500 text-xs">forwarded you a GIF</p>
          </div>
        </div>

        {/* GIF */}
        {post?.gif_url ? (
          <div className="relative bg-black/60 w-full">
            <FwdAnimatedGif
              gifUrl={post.gif_url}
              stillUrl={post.still_url ?? undefined}
              title={post.title ?? 'FWD'}
              className="w-full object-contain"
              style={{ maxHeight: '480px', display: 'block' } as React.CSSProperties}
              lazy={false}
            />
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-bold tracking-wider text-white border border-white/10">GIF</span>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center bg-black/40 text-zinc-600 text-sm">No preview available</div>
        )}

        {/* Caption */}
        {caption ? (
          <p className="px-4 pt-3 pb-1 text-white text-sm leading-relaxed">{caption}</p>
        ) : null}

        {/* Share button */}
        <div className="px-4 pb-4 pt-3 flex gap-3">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl glass border border-fuchsia-500/30 text-fuchsia-300 font-semibold text-sm hover:border-fuchsia-400 transition disabled:opacity-60"
          >
            {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
            Forward this FWD
          </button>
        </div>
      </div>

      {/* Join / Sign in CTA */}
      {!user && (
        <div className="w-full max-w-md mt-5 glass-strong rounded-3xl border border-fuchsia-500/20 p-6 text-center">
          <p className="text-white font-bold text-base mb-1">Make your own GIF</p>
          <p className="text-zinc-400 text-sm mb-4">Join FWD to create, remix, and forward GIFs.</p>
          <div className="flex gap-3">
            <button
              onClick={() => nav('/signup')}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold text-sm neon-glow-pink flex items-center justify-center gap-1.5"
            >
              Join FWD <ArrowRight size={14} />
            </button>
            <button
              onClick={() => nav('/login')}
              className="flex-1 py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold text-sm"
            >
              Sign in
            </button>
          </div>
        </div>
      )}

      {user && (
        <div className="w-full max-w-md mt-5">
          <button
            onClick={() => nav('/feed')}
            className="w-full py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold text-sm flex items-center justify-center gap-2"
          >
            Back to Feed <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default FwdShare;
