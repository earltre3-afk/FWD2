import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, BadgeCheck, Bookmark, Layers, Play, Edit3, ChevronRight, ChevronDown, LogOut, Check, X, Newspaper, Search as SearchIcon } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { useAppContext, Gif } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

const TABS = [
  { id: 'created', label: 'Created', icon: Play },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'posted', label: 'Posted', icon: Newspaper },
  { id: 'collections', label: 'Collections', icon: Layers },
];

const Profile: React.FC = () => {
  const nav = useNavigate();
  const [tab, setTab] = useState('created');
  const [editMode, setEditMode] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState('All');
  const [libraryQuery, setLibraryQuery] = useState('');
  const { favorites, collections, userGifs, feedPosts, savedLibrary, removeSavedGif, deleteUserGif } = useAppContext();
  const { user, profile, signOut, updateProfile, updatePassword } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const myPosts = feedPosts.filter(p => p.user_id === user?.id);

  // Edit drafts
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [websiteDraft, setWebsiteDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync drafts when profile loads or edit mode opens
  useEffect(() => {
    if (editMode) {
      setNameDraft(profile?.display_name || '');
      setBioDraft(profile?.bio || '');
      setUsernameDraft(profile?.username || '');
      setLocationDraft(profile?.location || '');
      setWebsiteDraft(profile?.website_url || '');
      setPasswordDraft('');
    }
  }, [editMode, profile]);

  const postedGifs: Gif[] = myPosts.map(p => p.gif).filter(Boolean) as Gif[];
  const savedGifs: Gif[] = savedLibrary
    .filter(g => {
      if (libraryFilter === 'Created') return g.user_id === user?.id;
      if (libraryFilter === 'Saved') return g.user_id !== user?.id;
      if (libraryFilter === 'Posted') return postedGifs.some(p => p.id === g.id);
      return true;
    })
    .filter(g => {
      const q = libraryQuery.trim().toLowerCase();
      if (!q) return true;
      return [g.title, g.caption || '', g.category, g.mood || '', ...(g.tags || [])]
        .join(' ').toLowerCase().includes(q);
    });

  const displayName = profile?.display_name || profile?.username || (user?.email ? user.email.split('@')[0] : 'FWD User');
  const username = profile?.username || (user?.email ? user.email.split('@')[0] : 'fwduser');
  const bio = profile?.bio || 'Creating vibes. One GIF at a time.';
  const initial = (displayName || 'F').charAt(0).toUpperCase();
  const isPublic = profile?.is_public ?? true;

  const saveAll = async () => {
    setSaving(true);
    const res = await updateProfile({
      display_name: nameDraft.trim() || undefined,
      bio: bioDraft.trim() || undefined,
      username: usernameDraft.trim() || undefined,
      location: locationDraft.trim() || null,
      website_url: websiteDraft.trim() || null,
    } as any);
    setSaving(false);
    if (res.error) {
      toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Profile saved' });
      setEditMode(false);
    }
  };

  const changePassword = async () => {
    if (passwordDraft.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const res = await updatePassword(passwordDraft);
    setSaving(false);
    if (res.error) toast({ title: 'Password change failed', description: res.error, variant: 'destructive' });
    else { setPasswordDraft(''); toast({ title: 'Password changed' }); }
  };

  const toggleVisibility = async () => {
    const next = !isPublic;
    await updateProfile({ is_public: next } as any);
    toast({ title: next ? 'Profile is public' : 'Profile is private' });
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Choose an image', variant: 'destructive' }); return; }
    setSaving(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('profile-media').upload(path, file, { contentType: file.type, upsert: true });
    if (error) {
      setSaving(false);
      toast({ title: 'Upload failed', description: 'Could not update your avatar.', variant: 'destructive' });
      return;
    }
    const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
    const res = await updateProfile({ avatar_url: data.publicUrl });
    setSaving(false);
    if (!res.error) toast({ title: 'Avatar updated' });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-strong rounded-3xl p-8 border border-fuchsia-500/30 text-center max-w-sm">
          <FwdLogo size="md" />
          <h2 className="text-xl font-black text-white mt-4 mb-2">Sign in to view your profile</h2>
          <p className="text-zinc-400 text-sm mb-5">Set up your profile to keep creating.</p>
          <button onClick={() => nav('/')} className="px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink">Go to landing</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="w-10" />
          <FwdLogo size="md" />
          <button onClick={signOut} title="Sign out" className="w-10 h-10 rounded-full glass border border-fuchsia-500/30 flex items-center justify-center">
            <LogOut size={16} className="text-fuchsia-400" />
          </button>
        </div>

        {/* Profile card */}
        <div className="glass-strong rounded-3xl p-4 border border-fuchsia-500/30 mt-4">

          {editMode ? (
            /* ── EDIT MODE ── */
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white tracking-wider">EDIT PROFILE</h3>
                <button
                  onClick={() => setEditMode(false)}
                  className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center"
                >
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                      : <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-2xl font-black text-white">{initial}</div>
                    }
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={saving}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-fuchsia-600 border-2 border-black flex items-center justify-center"
                  >
                    <Edit3 size={12} className="text-white" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Display name"
                    className="w-full bg-black/40 border border-fuchsia-500/30 rounded-xl px-3 py-2 text-white text-sm outline-none" />
                  <textarea value={bioDraft} onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                    placeholder="Bio (160 chars)" rows={2}
                    className="w-full bg-black/40 border border-fuchsia-500/30 rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" />
                </div>
              </div>

              {/* Username / Location / Website */}
              <div className="grid gap-2 sm:grid-cols-3 mb-3">
                <input value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)}
                  placeholder="username"
                  className="min-w-0 bg-black/40 border border-fuchsia-500/25 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
                <input value={locationDraft} onChange={(e) => setLocationDraft(e.target.value)}
                  placeholder="city"
                  className="min-w-0 bg-black/40 border border-fuchsia-500/25 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
                <input value={websiteDraft} onChange={(e) => setWebsiteDraft(e.target.value)}
                  placeholder="website"
                  className="min-w-0 bg-black/40 border border-fuchsia-500/25 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
              </div>

              {/* Save */}
              <button onClick={saveAll} disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 py-2.5 text-sm font-bold text-white disabled:opacity-60 mb-3">
                {saving ? 'Saving…' : 'Save profile'}
              </button>

              {/* Visibility toggle */}
              <button onClick={toggleVisibility} className="w-full flex items-center justify-between glass rounded-xl px-3 py-2.5 border border-white/10 hover:border-fuchsia-500/40 mb-3">
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Profile visibility</div>
                  <div className="text-sm font-semibold text-white">{isPublic ? 'Public — anyone can find you' : 'Private — only you'}</div>
                </div>
                <div className={`w-10 h-6 rounded-full p-0.5 transition ${isPublic ? 'bg-fuchsia-500' : 'bg-zinc-700'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition ${isPublic ? 'translate-x-4' : ''}`} />
                </div>
              </button>

              {/* Password change */}
              <div className="glass rounded-xl px-3 py-3 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Change password</div>
                <div className="flex gap-2">
                  <input type="password" minLength={6} value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)}
                    placeholder="New password (6+ chars)"
                    className="flex-1 min-w-0 bg-black/40 border border-fuchsia-500/25 rounded-xl px-3 py-2.5 text-white text-sm outline-none" />
                  <button onClick={changePassword} disabled={saving || !passwordDraft}
                    className="rounded-xl bg-fuchsia-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    Change
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── READ MODE ── */
            <>
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[3px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 neon-glow-purple flex-shrink-0">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                    : <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-3xl font-black text-white">{initial}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xl sm:text-2xl font-black text-white truncate">{displayName}</h2>
                    <BadgeCheck size={18} className="text-fuchsia-400 fill-fuchsia-400/20 flex-shrink-0" />
                  </div>
                  <p className="text-zinc-500 text-sm">@{username}</p>
                  {profile?.location && <p className="text-zinc-500 text-xs mt-0.5">{profile.location}</p>}
                  <p className="text-zinc-300 text-sm mt-1 line-clamp-2">{bio}</p>
                  {profile?.website_url && (
                    <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                      className="text-fuchsia-400 text-xs mt-0.5 hover:underline truncate block">
                      {profile.website_url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5">
                <div className="text-center">
                  <div className="text-xl font-black text-white">{userGifs.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-white">{favorites.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Saved</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-white">{collections.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Collections</div>
                </div>
              </div>

              {/* Edit profile button */}
              <button
                onClick={() => setEditMode(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 glass rounded-xl px-3 py-2.5 border border-fuchsia-500/30 text-sm font-semibold text-fuchsia-300 hover:border-fuchsia-500/60 hover:text-white transition"
              >
                <Edit3 size={14} /> Edit Profile
              </button>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`py-3 rounded-2xl text-sm font-bold border flex items-center justify-center gap-2 transition ${
                  active ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent neon-glow-purple' : 'glass text-zinc-300 border-white/10'
                }`}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'created' && (
          <>
            <div className="flex items-center justify-between mt-6 mb-3">
              <h3 className="text-sm font-black text-white tracking-wider">YOUR GIFS</h3>
              <button className="text-sm text-fuchsia-400 font-semibold flex items-center gap-1">Newest <ChevronDown size={14} /></button>
            </div>
            {userGifs.length === 0 ? (
              <div className="glass-strong rounded-3xl p-6 sm:p-8 text-center border border-fuchsia-500/20">
                <p className="text-zinc-400 mb-4 text-sm sm:text-base">You haven&apos;t created any GIFs yet.</p>
                <button onClick={() => nav('/create')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink text-sm">
                  Create your first GIF
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {userGifs.map(g => (
                  <GifCard
                    key={g.id}
                    gif={g}
                    showHeart={false}
                    onDelete={async () => {
                      const ok = await deleteUserGif(g.id);
                      if (!ok) toast({ title: 'Delete failed', description: 'Could not delete that GIF. Try again.', variant: 'destructive' });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'saved' && (
          <>
            <div className="flex items-center justify-between mt-6 mb-3">
              <h3 className="text-sm font-black text-white tracking-wider">MY LIBRARY</h3>
              <span className="text-xs text-fuchsia-300 font-semibold">{savedGifs.length} saved</span>
            </div>
            <div className="glass-strong rounded-2xl px-3 py-2.5 border border-fuchsia-500/25 flex items-center gap-2 mb-3">
              <SearchIcon size={16} className="text-zinc-400" />
              <input value={libraryQuery} onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Search captions, tags, mood..."
                className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-sm min-w-0" />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-3">
              {['All', 'Created', 'Saved', 'Posted'].map(f => (
                <button key={f} onClick={() => setLibraryFilter(f)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    libraryFilter === f ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent' : 'glass border-white/10 text-zinc-300'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            {savedGifs.length === 0 ? (
              <div className="glass-strong rounded-3xl p-6 sm:p-8 text-center border border-fuchsia-500/20">
                <p className="text-zinc-400 text-sm sm:text-base mb-4">No GIFs here yet. Save or create your first FWD.</p>
                <button onClick={() => nav('/create')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink text-sm">
                  Create one
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {savedGifs.map(g => (
                  <div key={g.id} className="relative">
                    <GifCard
                      gif={g}
                      onClick={() => {
                        if (g.id.startsWith('saved:')) {
                          nav('/create', {
                            state: {
                              image: g.image,
                              mediaType: /\.(mp4|webm)(?:[?#].*)?$/i.test(g.image) ? 'video/mp4' : 'image/gif',
                              title: g.title,
                              tags: g.tags,
                            },
                          });
                        } else {
                          nav(`/gif/${g.id}`);
                        }
                      }}
                    />
                    <button onClick={() => removeSavedGif(g.id)}
                      className="absolute bottom-2 right-2 z-10 rounded-lg bg-black/70 border border-white/10 px-2 py-1 text-[10px] font-bold text-zinc-200">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'posted' && (
          <>
            <h3 className="text-sm font-black text-white tracking-wider mt-6 mb-3">POSTED TO FEED</h3>
            {myPosts.length === 0 ? (
              <div className="glass-strong rounded-3xl p-6 sm:p-8 text-center border border-fuchsia-500/20">
                <p className="text-zinc-400 text-sm sm:text-base mb-4">You haven't posted to the feed yet.</p>
                <button onClick={() => nav('/feed')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink text-sm">
                  Go to Feed
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {myPosts.map(p => p.gif && <GifCard key={p.id} gif={p.gif} showHeart={false} />)}
              </div>
            )}
          </>
        )}

        {tab === 'collections' && (
          <>
            <div className="flex items-center justify-between mt-6 mb-3">
              <h3 className="text-sm font-black text-white tracking-wider">YOUR COLLECTIONS</h3>
              <button onClick={() => nav('/collections')} className="text-sm text-fuchsia-400 font-semibold">See All ›</button>
            </div>
            {collections.length === 0 ? (
              <div className="glass-strong rounded-3xl p-8 text-center border border-fuchsia-500/20">
                <p className="text-zinc-400">Your reaction vault is empty. Create a collection to organize your GIFs.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.slice(0, 6).map(c => (
                  <button key={c.id} onClick={() => nav('/collections')} className="w-full glass-strong rounded-2xl p-3 flex items-center gap-3 border border-fuchsia-500/20 hover:border-fuchsia-500/50">
                    <div className="grid grid-cols-2 gap-0.5 w-14 h-14 rounded-lg overflow-hidden bg-black/40">
                      {(c.gifIds.length ? c.gifIds : userGifs.slice(0, 4).map(g => g.id)).slice(0, 4).map(id => {
                        const g = userGifs.find(x => x.id === id) || savedLibrary.find(x => x.id === id);
                        return g ? (
                          <FwdMediaPlayer
                            key={id}
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
                        ) : <div key={id} className="bg-zinc-800" />;
                      })}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-xs text-zinc-500">{c.gifIds.length} {c.gifIds.length === 1 ? 'GIF' : 'GIFs'}</div>
                    </div>
                    <ChevronRight size={18} className="text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <button onClick={() => nav('/settings/picker-keys')} className="w-full mt-6 py-3 rounded-xl glass border border-cyan-500/30 text-sm text-cyan-200 hover:border-cyan-500/60 flex items-center justify-center gap-2">
          <Settings size={14} /> Picker API keys
        </button>
        <button onClick={() => nav('/discover')} className="w-full mt-2 py-3 rounded-xl glass border border-white/10 text-sm text-zinc-300 hover:border-fuchsia-500/40 flex items-center justify-center gap-2">
          Discover creators
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
