import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Lock } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import FollowButton from '@/components/FollowButton';
import { supabase } from '@/lib/supabase';
import { Gif } from '@/contexts/AppContext';
import GifCard from '@/components/GifCard';
import { resolveFwdMedia } from '@/lib/fwdMedia';
import { editMetadataFromDb } from '@/lib/mediaEdits';

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public?: boolean | null;
}

const PublicProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const nav = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0, saved: 0 });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true); setNotFound(false);
      if (!username) { setNotFound(true); setLoading(false); return; }
      const { data: p } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, is_public')
        .eq('username', username)
        .maybeSingle();
      if (cancel) return;
      if (!p) { setNotFound(true); setLoading(false); return; }
      setProfile(p as ProfileRow);

      if ((p as any).is_public === false) {
        setGifs([]); setLoading(false); return;
      }
      const [{ data: g }, followersRes, followingRes, savedRes] = await Promise.all([
        supabase
        .from('fwd_feed_posts')
        .select('*, gif:gif_id ( id, gif_url, media_url, still_url, thumbnail_url, mp4_url, webm_url, source_video_url, media_type, is_animated, trim_start, trim_end, original_duration, edited_duration, crop_x, crop_y, crop_width, crop_height, crop_aspect_ratio, output_aspect_ratio, edit_metadata, tags, category, mood, owner_user_id, title )')
        .eq('user_id', (p as any).id)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', (p as any).id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', (p as any).id),
        supabase.from('saved_gifs').select('id', { count: 'exact', head: true }).eq('user_id', (p as any).id).eq('is_private', false),
      ]);
      if (cancel) return;
      setCounts({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        saved: savedRes.count || 0,
      });
      setGifs((g || [])
        .map((row: any) => row.gif)
        .filter(Boolean)
        .map((row: any) => {
        const media = resolveFwdMedia(row);
        return {
          id: row.id,
          title: row.title,
          image: media.animatedUrl || '',
          still_url: media.thumbnailUrl || undefined,
          mp4_url: media.mp4Url || undefined,
          webm_url: media.webmUrl || undefined,
          source_video_url: media.sourceVideoUrl || undefined,
          media_type: row.media_type || undefined,
          is_animated: row.is_animated ?? media.isLikelyAnimated,
          trim_start: row.trim_start ?? null,
          trim_end: row.trim_end ?? null,
          original_duration: row.original_duration ?? null,
          edited_duration: row.edited_duration ?? null,
          crop_x: row.crop_x ?? null,
          crop_y: row.crop_y ?? null,
          crop_width: row.crop_width ?? null,
          crop_height: row.crop_height ?? null,
          crop_aspect_ratio: row.crop_aspect_ratio ?? null,
          output_aspect_ratio: row.output_aspect_ratio ?? null,
          edit_metadata: editMetadataFromDb(row),
          tags: row.tags || [],
          category: row.category || 'Reactions',
          mood: row.mood,
          user_id: row.owner_user_id,
        };
      }));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [username]);

  const display = profile?.display_name || profile?.username || 'FWD User';
  const handle = profile?.username || 'fwduser';
  const bio = profile?.bio || 'Creating vibes. One GIF at a time.';
  const initial = (display || 'F').charAt(0).toUpperCase();
  const isPrivate = profile?.is_public === false;

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <div className="w-10" />
        </div>

        {loading ? (
          <div className="glass-strong rounded-3xl p-6 border border-white/5 mt-4 animate-pulse h-40" />
        ) : notFound ? (
          <div className="glass-strong rounded-3xl p-8 mt-4 text-center border border-fuchsia-500/20">
            <p className="text-white font-bold">User not found</p>
            <p className="text-zinc-400 text-sm mt-1">That FWD profile doesn't exist or is no longer public.</p>
            <button onClick={() => nav('/discover')} className="mt-4 px-4 py-2 rounded-xl bg-fuchsia-600 text-white text-sm font-bold">Back to Discover</button>
          </div>
        ) : profile && (
          <>
            <div className="glass-strong rounded-3xl p-4 border border-fuchsia-500/30 mt-4 animate-fade-up">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 neon-glow-purple">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-3xl font-black text-white">{initial}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-2xl font-black text-white truncate">{display}</h2>
                    <BadgeCheck size={18} className="text-fuchsia-400 fill-fuchsia-400/20 flex-shrink-0" />
                  </div>
                  <p className="text-zinc-500 text-sm truncate">@{handle}</p>
                  <p className="text-zinc-300 text-sm mt-1 line-clamp-3">{bio}</p>
                  <div className="flex gap-3 mt-2 text-[11px] text-zinc-400">
                    <span><b className="text-white">{counts.followers}</b> followers</span>
                    <span><b className="text-white">{counts.following}</b> following</span>
                    <span><b className="text-white">{counts.saved}</b> saved</span>
                  </div>
                  <div className="mt-3">
                    <FollowButton targetUserId={profile.id} size="md" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-black text-white tracking-wider mb-3">PUBLIC GIFS</h3>
              {isPrivate ? (
                <div className="glass-strong rounded-3xl p-8 text-center border border-fuchsia-500/20">
                  <Lock size={20} className="text-fuchsia-400 mx-auto mb-2" />
                  <p className="text-zinc-300 font-semibold">This profile is private</p>
                  <p className="text-zinc-500 text-sm mt-1">Only the owner can see what's inside the vault.</p>
                </div>
              ) : gifs.length === 0 ? (
                <div className="glass-strong rounded-3xl p-8 text-center border border-fuchsia-500/20">
                  <p className="text-zinc-400">No public FWDs yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 stagger-children">
                  {gifs.map(g => <GifCard key={g.id} gif={g} showHeart={false} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default PublicProfile;
