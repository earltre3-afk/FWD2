import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Camera, Heart, Share2, Sparkles, Zap, Play, ArrowRight, Layers, LogOut, User as UserIcon } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { GIFS } from '@/data/gifs';
import FwdAnimatedGif from '@/components/FwdAnimatedGif';

const FeatureCard: React.FC<{ icon: any; title: string; desc: string; color: string }> = ({ icon: Icon, title, desc, color }) => (
  <div className="glass-strong rounded-2xl p-5 border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition-all hover:-translate-y-1 group">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition`}>
      <Icon size={22} className="text-white" />
    </div>
    <h3 className="text-white font-bold text-lg mb-1.5">{title}</h3>
    <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
  </div>
);

const AppLayout: React.FC = () => {
  const nav = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const previewGifs = GIFS.slice(0, 6);

  const openAuth = (m: 'signin' | 'signup') => { setAuthMode(m); setAuthOpen(true); };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute top-40 -right-32 w-96 h-96 rounded-full bg-pink-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-cyan-500/20 blur-[120px]" />

      <header className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 pt-6 flex items-center justify-between">
        <FwdLogo size="sm" />
        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-300">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#preview" className="hover:text-white">Preview</a>
          <button onClick={() => nav('/demo')} className="hover:text-white">Integrate</button>
          <button onClick={() => nav('/embed/picker')} className="hover:text-white">Picker</button>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button onClick={() => nav('/profile')} className="flex items-center gap-2 px-3 py-2 rounded-full glass-strong border border-fuchsia-500/40 text-sm font-semibold text-white">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center">
                    <UserIcon size={12} className="text-white" />
                  </div>
                )}
                <span className="hidden sm:inline">{profile?.display_name || 'You'}</span>
              </button>
              <button onClick={signOut} title="Sign out" className="w-10 h-10 rounded-full glass flex items-center justify-center hover:border-pink-500/50">
                <LogOut size={15} className="text-zinc-300" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth('signin')} className="px-4 py-2 rounded-full glass-strong border border-fuchsia-500/40 text-sm font-semibold text-white hover:border-fuchsia-500">
                Sign In
              </button>
              <button onClick={() => openAuth('signup')} className="hidden sm:inline-block px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-500 text-sm font-bold text-white neon-glow-pink">
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      <section className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-12 text-center">
        <div className="flex justify-center mb-6 animate-float">
          <FwdLogo size="xl" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-fuchsia-500/30 text-xs text-fuchsia-300 mb-6">
          <Sparkles size={12} /> The future of GIFs
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[0.95] mb-5">
          Express. <span className="gradient-text">Connect.</span><br />Forward.
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 px-4">
          Forward the feeling. Forward the reaction. Turn moments into movement with the most expressive GIF studio on the planet.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => nav('/home')}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-bold flex items-center justify-center gap-2 neon-glow-purple hover:scale-[1.03] transition">
            <Play size={18} /> Explore GIFs
          </button>
          <button onClick={() => user ? nav('/create') : openAuth('signup')}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl glass-strong border border-fuchsia-500/40 text-white font-bold flex items-center justify-center gap-2 hover:border-fuchsia-500 hover:bg-fuchsia-500/10">
            <Zap size={18} /> Create GIF
          </button>
        </div>

        <div id="preview" className="mt-16 grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 max-w-4xl mx-auto">
          {previewGifs.map((g, i) => (
            <div key={g.id} className={`relative rounded-2xl overflow-hidden border border-fuchsia-500/30 aspect-square ${i % 2 ? 'translate-y-4' : ''}`}>
              <FwdAnimatedGif gifUrl={g.image} stillUrl={g.still_url} title={g.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white">{g.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3">Built to forward the vibe.</h2>
          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto px-4">Create it. Clip it. Forward it. Everything you need to react, in one neon-charged toolkit.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5">
          <FeatureCard icon={Search} title="Search" desc="Find the perfect reaction across millions of moods, memes and music moments." color="bg-gradient-to-br from-fuchsia-600 to-purple-700" />
          <FeatureCard icon={Zap} title="Create" desc="Turn any video or photo into a looped GIF with the futuristic mini editor." color="bg-gradient-to-br from-pink-500 to-fuchsia-600" />
          <FeatureCard icon={Heart} title="Save" desc="Build your reaction vault. Organize favorites into themed collections." color="bg-gradient-to-br from-rose-500 to-pink-600" />
          <FeatureCard icon={Camera} title="Capture" desc="Record a quick 1–6s clip live from your camera and turn it into a GIF instantly." color="bg-gradient-to-br from-cyan-500 to-blue-600" />
          <FeatureCard icon={Share2} title="Share" desc="Forward the feeling anywhere. Drop FWD into any chat with the embedded picker." color="bg-gradient-to-br from-violet-600 to-indigo-700" />
        </div>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="glass-strong rounded-3xl p-8 md:p-12 border border-fuchsia-500/30 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-xs mb-4">
              <Layers size={12} /> For builders
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3">Drop FWD into any app.</h3>
            <p className="text-zinc-400 text-sm sm:text-base mb-6">Add a plus-button GIF drawer to your messaging product. The embedded picker is lightweight, themeable, and just works.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => nav('/embed/picker')} className="px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold flex items-center gap-2 neon-glow-pink">
                Open Picker <ArrowRight size={16} />
              </button>
              <button onClick={() => nav('/demo')} className="px-5 py-3 rounded-xl glass border border-fuchsia-500/40 text-white font-bold">
                Integration Demo
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/30">
              <FwdLogo size="sm" />
              <div className="grid grid-cols-2 gap-2 mt-3">
                {GIFS.slice(6, 10).map(g => (
                  <div key={g.id} className="aspect-square border border-fuchsia-500/20 rounded-xl overflow-hidden">
                    <FwdAnimatedGif gifUrl={g.image} stillUrl={g.still_url} title={g.title} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-zinc-500 text-center">Powered by FWD</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/5">
        <FwdLogo size="sm" />
        <p className="text-xs text-zinc-500">© {new Date().getFullYear()} FWD. Forward the feeling.</p>
        <div className="flex gap-5 text-xs text-zinc-400">
          <button onClick={() => nav('/home')} className="hover:text-white">App</button>
          <button onClick={() => user ? nav('/create') : openAuth('signup')} className="hover:text-white">Create</button>
          <button onClick={() => nav('/embed/picker')} className="hover:text-white">Picker</button>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
};

export default AppLayout;
