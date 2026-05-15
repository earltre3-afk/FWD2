import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Flame, Users, Compass, ArrowLeft, TrendingUp, Layers, Hash } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import FollowButton from '@/components/FollowButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public?: boolean | null;
}
interface UploadRow {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  category?: string | null;
  created_at: string;
  profile?: ProfileRow;
}

const safeName = (p?: ProfileRow | null) =>
  (p?.display_name && p.display_name.trim()) ||
  (p?.username && p.username.trim()) ||
  'FWD Creator';
const safeHandle = (p?: ProfileRow | null) =>
  (p?.username && p.username.trim()) || 'fwduser';

const Section: React.FC<{ icon: any; title: string; subtitle?: string; children: React.ReactNode }> = ({ icon: Icon, title, subtitle, children }) => (
  <section className="mb-7">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-xl glass border border-fuchsia-500/30 flex items-center justify-center">
        <Icon size={15} className="text-fuchsia-300" />
      </div>
      <div>
        <h2 className="text-sm font-black tracking-widest text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const CreatorCard: React.FC<{ p: ProfileRow; onOpen: () => void; rightSlot?: React.ReactNode }> = ({ p, onOpen, rightSlot }) => {
  const name = safeName(p);
  const handle = safeHandle(p);
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 hover:border-fuchsia-500/50 transition flex items-center gap-3">
      <button onClick={onOpen} className="relative shrink-0">
        <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 neon-glow-purple">
          {p.avatar_url ? (
            <img src={p.avatar_url} className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-lg font-black text-white">{initial}</div>
          )}
        </div>
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="text-white font-bold truncate">{name}</div>
        <div className="text-xs text-zinc-500 truncate">@{handle}</div>
        {p.bio ? <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{p.bio}</div> : null}
        {rightSlot ? <div className="mt-1">{rightSlot}</div> : null}
      </button>
      <FollowButton targetUserId={p.id} />
    </div>
  );
};

const Discover: React.FC = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [featured, setFeatured] = useState<ProfileRow[]>([]);
  const [trendingMakers, setTrendingMakers] = useState<Array<ProfileRow & { _count: number }>>([]);
  const [fresh, setFresh] = useState<UploadRow[]>([]);
  const [circle, setCircle] = useState<ProfileRow[]>([]);
  const [trendingCategories, setTrendingCategories] = useState<Array<{ name: string; count: number; cover?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);

      const profQ = supabase.from('profiles')
        .select('id, username, display_name, avatar_url, bio, is_public')
        .or('is_public.is.null,is_public.eq.true')
        .limit(48);

      const gifsQ = supabase.from('user_gifs')
        .select('id, title, image_url, user_id, category, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(60);

      const [{ data: profs }, { data: gifs }] = await Promise.all([profQ, gifsQ]);
      if (cancel) return;

      const profList = (profs || []).filter(p => !user || p.id !== user.id);
      setFeatured(profList);

      // Hydrate uploads with their profile
      const uploaderIds = Array.from(new Set((gifs || []).map(g => g.user_id))).filter(Boolean);
      const profMap = new Map<string, ProfileRow>();
      if (uploaderIds.length) {
        const { data: up } = await supabase.from('profiles')
          .select('id, username, display_name, avatar_url, bio, is_public')
          .in('id', uploaderIds);
        (up || []).forEach((u: any) => profMap.set(u.id, u));
      }

      const hydrated = (gifs || []).map(g => ({ ...g, profile: profMap.get(g.user_id) }));
      setFresh(hydrated.slice(0, 12));

      // Trending Reaction Makers — derived from real upload counts (no fake numbers)
      const counts = new Map<string, number>();
      (gifs || []).forEach(g => counts.set(g.user_id, (counts.get(g.user_id) || 0) + 1));
      const makers = Array.from(counts.entries())
        .filter(([uid]) => !user || uid !== user.id)
        .map(([uid, count]) => {
          const prof = profMap.get(uid);
          if (!prof) return null;
          return { ...prof, _count: count } as ProfileRow & { _count: number };
        })
        .filter(Boolean) as Array<ProfileRow & { _count: number }>;
      makers.sort((a, b) => b._count - a._count);
      setTrendingMakers(makers.slice(0, 6));

      // Trending Categories — real counts from public uploads
      const catMap = new Map<string, { count: number; cover?: string }>();
      (gifs || []).forEach(g => {
        const c = (g.category || 'Reactions').trim();
        if (!c) return;
        const cur = catMap.get(c) || { count: 0, cover: undefined as string | undefined };
        cur.count += 1;
        if (!cur.cover) cur.cover = g.image_url;
        catMap.set(c, cur);
      });
      const cats = Array.from(catMap.entries())
        .map(([name, v]) => ({ name, count: v.count, cover: v.cover }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setTrendingCategories(cats);

      // FWD Circle
      if (user) {
        const { data: follows } = await supabase.from('follows')
          .select('following_id').eq('follower_id', user.id);
        const ids = (follows || []).map((f: any) => f.following_id);
        if (ids.length) {
          const { data: circleProfiles } = await supabase.from('profiles')
            .select('id, username, display_name, avatar_url, bio, is_public')
            .in('id', ids);
          setCircle(circleProfiles || []);
        } else setCircle([]);
      } else setCircle([]);

      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const openProfile = (p: ProfileRow) => {
    if (p.username) nav(`/u/${p.username}`);
  };

  const featuredFiltered = useMemo(() => {
    const trendingIds = new Set(trendingMakers.map(m => m.id));
    return featured.filter(p => !trendingIds.has(p.id));
  }, [featured, trendingMakers]);

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <div className="w-10" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-widest">DISCOVER</h1>
          <p className="text-zinc-400 text-sm sm:text-base">Find the people making the loop loop.</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-strong rounded-2xl p-3 border border-white/5 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <>
            <Section icon={TrendingUp} title="TRENDING REACTION MAKERS" subtitle="Creators uploading the most public FWDs right now">
              {trendingMakers.length === 0 ? (
                <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                  No trending makers yet. Drop a reaction to claim the spot.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                  {trendingMakers.map(m => (
                    <CreatorCard
                      key={m.id}
                      p={m}
                      onOpen={() => openProfile(m)}
                      rightSlot={
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300">
                          <Flame size={10} /> {m._count} public FWD{m._count === 1 ? '' : 's'}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section icon={Sparkles} title="CREATORS TO FOLLOW" subtitle="Fresh public profiles on FWD">
              {featuredFiltered.length === 0 ? (
                <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                  No new public creators right now. Make your profile public to show up here.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                  {featuredFiltered.slice(0, 9).map(p => <CreatorCard key={p.id} p={p} onOpen={() => openProfile(p)} />)}
                </div>
              )}
            </Section>

            <Section icon={Hash} title="TRENDING CATEGORIES" subtitle="What the community is forwarding most">
              {trendingCategories.length === 0 ? (
                <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                  No category data yet. Categories will appear as people upload.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
                  {trendingCategories.map(c => (
                    <button
                      key={c.name}
                      onClick={() => nav(`/search?category=${encodeURIComponent(c.name)}`)}
                      className="relative h-20 rounded-2xl overflow-hidden border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition group text-left"
                    >
                      {c.cover && <img src={c.cover} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition" />}
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/40 to-transparent" />
                      <div className="relative h-full flex flex-col justify-end p-3">
                        <div className="text-white font-black text-sm truncate">{c.name}</div>
                        <div className="text-[10px] font-mono text-fuchsia-300">{c.count} FWD{c.count === 1 ? '' : 's'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={Flame} title="FRESH UPLOADS" subtitle="The newest FWDs from the community">
              {fresh.length === 0 ? (
                <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                  Nothing fresh yet. Be the first to forward something.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 lg:gap-3">
                  {fresh.map(g => (
                    <button
                      key={g.id}
                      onClick={() => g.profile?.username ? nav(`/u/${g.profile.username}`) : null}
                      className="relative aspect-square rounded-xl overflow-hidden border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition group"
                    >
                      <img src={g.image_url} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/0 to-transparent" />
                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        <div className="text-[10px] text-white font-bold truncate">{g.title || 'Untitled FWD'}</div>
                        {g.profile?.username ? (
                          <div className="text-[9px] text-fuchsia-300 truncate">@{g.profile.username}</div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={Layers} title="POPULAR COLLECTIONS" subtitle="Curated reaction vaults">
              <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                Public collections are <span className="text-amber-300 font-semibold">Not configured</span> yet.
                {' '}For now, collections stay private to their owner.
              </div>
            </Section>

            <Section icon={Users} title="YOUR FWD CIRCLE" subtitle="People you follow">
              {!user ? (
                <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                  Sign in to start building your circle.
                </div>
              ) : circle.length === 0 ? (
                <div className="glass rounded-2xl p-5 border border-white/5 text-center text-zinc-400 text-sm">
                  Your circle is empty. Follow a creator above to fill it up.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                  {circle.map(p => <CreatorCard key={p.id} p={p} onOpen={() => openProfile(p)} />)}
                </div>
              )}
            </Section>

            <button onClick={() => nav('/settings/picker-keys')} className="w-full mt-2 py-3 rounded-2xl glass border border-cyan-500/30 text-sm text-cyan-300 font-bold flex items-center justify-center gap-2">
              <Compass size={14} /> Embed FWD in your own app
            </button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Discover;
