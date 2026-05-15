import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, BadgeCheck, Bookmark, Layers, Play, Edit3, ChevronDown, ChevronRight, LogOut, Check, X } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import GifCard from '@/components/GifCard';
import { GIFS } from '@/data/gifs';
import { useAppContext, Gif } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const TABS = [
  { id: 'created', label: 'Created', icon: Play },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'collections', label: 'Collections', icon: Layers },
];
const Profile: React.FC = () => {
  const nav = useNavigate();
  const [tab, setTab] = useState('created');
  const { favorites, collections, userGifs } = useAppContext();
  const { user, profile, signOut, updateProfile } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');

  const savedGifs: Gif[] = GIFS.filter(g => favorites.includes(g.id));

  const displayName = profile?.display_name || profile?.username || (user?.email ? user.email.split('@')[0] : 'FWD User');
  const username = profile?.username || (user?.email ? user.email.split('@')[0] : 'fwduser');
  const bio = profile?.bio || 'Creating vibes. One GIF at a time.';
  const initial = (displayName || 'F').charAt(0).toUpperCase();

  const startEditName = () => { setNameDraft(profile?.display_name || displayName); setEditingName(true); };
  const startEditBio = () => { setBioDraft(profile?.bio || ''); setEditingBio(true); };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) { setEditingName(false); return; }
    const res = await updateProfile({ display_name: next });
    if (!res.error) toast({ title: 'Profile updated', description: 'Your name is now ' + next });
    setEditingName(false);
  };
  const saveBio = async () => {
    const res = await updateProfile({ bio: bioDraft.trim() });
    if (!res.error) toast({ title: 'Bio updated' });
    setEditingBio(false);
  };
  const toggleVisibility = async () => {
    const next = !(profile?.is_public ?? true);
    await updateProfile({ is_public: next } as any);
    toast({ title: next ? 'Profile is public' : 'Profile is private' });
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
        <div className="flex items-center justify-between mb-2">
          <div className="w-10" />
          <FwdLogo size="md" />
          <button onClick={signOut} title="Sign out" className="w-10 h-10 rounded-full glass border border-fuchsia-500/30 flex items-center justify-center">
            <LogOut size={16} className="text-fuchsia-400" />
          </button>
        </div>

        {/* Profile card */}
        <div className="glass-strong rounded-3xl p-4 border border-fuchsia-500/30 mt-4">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full p-[3px] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 neon-glow-purple">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-3xl font-black text-white">
                    {initial}
                  </div>
                )}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-fuchsia-600 border-2 border-black flex items-center justify-center" onClick={startEditName}>
                <Edit3 size={12} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                    className="flex-1 min-w-0 bg-black/40 border border-fuchsia-500/40 rounded-lg px-2 py-1 text-white text-lg outline-none" />
                  <button onClick={saveName} className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center"><Check size={14} /></button>
                  <button onClick={() => setEditingName(false)} className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate">{displayName}</h2>
                  <BadgeCheck size={18} className="text-fuchsia-400 fill-fuchsia-400/20 flex-shrink-0" />
                </div>
              )}
              <p className="text-zinc-500 text-sm truncate">@{username}</p>
              {editingBio ? (
                <div className="mt-2 flex items-start gap-2">
                  <textarea autoFocus value={bioDraft} onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                    className="flex-1 bg-black/40 border border-fuchsia-500/40 rounded-lg px-2 py-1 text-white text-sm outline-none resize-none" rows={2} placeholder="Tell people about your vibe…" />
                  <div className="flex flex-col gap-1">
                    <button onClick={saveBio} className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center"><Check size={14} /></button>
                    <button onClick={() => setEditingBio(false)} className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <button onClick={startEditBio} className="text-left w-full">
                  <p className="text-zinc-300 text-sm mt-1 line-clamp-2 hover:text-white">{bio}</p>
                </button>
              )}
            </div>
          </div>

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

          <button onClick={toggleVisibility} className="mt-4 w-full flex items-center justify-between glass rounded-xl px-3 py-2.5 border border-white/10 hover:border-fuchsia-500/40">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Profile visibility</div>
              <div className="text-sm font-semibold text-white">{(profile?.is_public ?? true) ? 'Public — anyone can find you' : 'Private — only you'}</div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 transition ${(profile?.is_public ?? true) ? 'bg-fuchsia-500' : 'bg-zinc-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition ${(profile?.is_public ?? true) ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mt-5">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink text-sm sm:text-base">
                  Create your first GIF
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {userGifs.map(g => <GifCard key={g.id} gif={g} showHeart={false} />)}
              </div>
            )}
          </>
        )}

        {tab === 'saved' && (
          <>
            <h3 className="text-sm font-black text-white tracking-wider mt-6 mb-3">SAVED GIFS</h3>
            {savedGifs.length === 0 ? (
              <div className="glass-strong rounded-3xl p-6 sm:p-8 text-center border border-fuchsia-500/20">
                <p className="text-zinc-400 text-sm sm:text-base">Tap the heart on any GIF to save it to your vault.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {savedGifs.map(g => <GifCard key={g.id} gif={g} />)}
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
                      {(c.gifIds.length ? c.gifIds : ['g1','g2','g3','g4']).slice(0, 4).map(id => {
                        const g = GIFS.find(x => x.id === id) || userGifs.find(x => x.id === id);
                        return g ? <img key={id} src={g.image} className="w-full h-full object-cover" /> : <div key={id} className="bg-zinc-800" />;
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
