import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Newspaper, User, Camera, Upload, Scissors, Crop, Type, Smile, Gauge, Aperture, X } from 'lucide-react';
import { FwdMark } from './FwdLogo';

const TOOLS = [
  { id: 'trim',     icon: Scissors, label: 'Trim' },
  { id: 'crop',     icon: Crop,     label: 'Crop' },
  { id: 'text',     icon: Type,     label: 'Text' },
  { id: 'stickers', icon: Smile,    label: 'Stickers' },
  { id: 'speed',    icon: Gauge,    label: 'Speed' },
  { id: 'filters',  icon: Aperture, label: 'Filters' },
];

const CreationSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const nav = useNavigate();

  const go = (path: string) => { onClose(); nav(path); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md md:max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{ maxHeight: '88vh' }}>

        {/* ── Camera section ── */}
        <button
          onClick={() => go('/camera')}
          className="relative w-full bg-black overflow-hidden flex-shrink-0"
          style={{ height: '52vw', maxHeight: '320px', minHeight: '200px' }}
        >
          {/* gradient bg */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70" />

          {/* corner brackets */}
          <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-fuchsia-500 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-fuchsia-500 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-fuchsia-500 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-fuchsia-500 rounded-br-xl pointer-events-none" />

          {/* center record ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full border-4 border-fuchsia-500 flex items-center justify-center animate-pulse-glow">
              <Camera size={26} className="text-fuchsia-300" />
            </div>
            <span className="text-white font-bold text-sm tracking-wide">Tap to Record</span>
          </div>

          {/* label */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <span className="glass-strong px-3 py-1 rounded-full text-[11px] font-bold tracking-widest text-fuchsia-300 border border-fuchsia-500/40">
              CAMERA
            </span>
          </div>
        </button>

        {/* ── Edit / create section ── */}
        <div className="bg-zinc-950 overflow-y-auto" style={{ maxHeight: '40vh' }}>
          {/* Upload row */}
          <button
            onClick={() => go('/create')}
            className="w-full flex items-center gap-4 px-5 py-4 border-b border-white/5 hover:bg-white/5 transition"
          >
            <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
              <Upload size={20} className="text-fuchsia-400" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Upload & Edit GIF</p>
              <p className="text-zinc-500 text-xs">Add a file from your device or URL</p>
            </div>
          </button>

          {/* Tool grid */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-3">Edit Tools</p>
            <div className="grid grid-cols-3 gap-3">
              {TOOLS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => go(`/create?tool=${id}`)}
                  className="flex flex-col items-center gap-2 py-3 rounded-2xl glass border border-white/8 hover:border-fuchsia-500/40 transition"
                >
                  <Icon size={20} className="text-fuchsia-300" />
                  <span className="text-xs text-zinc-300 font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* bottom safe area */}
          <div className="h-6" />
        </div>

        {/* close pill */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 border border-white/15 flex items-center justify-center z-10"
        >
          <X size={14} className="text-white" />
        </button>
      </div>
    </div>
  );
};

const BottomNav: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isActive = (p: string) => loc.pathname === p || loc.pathname.startsWith(p + '/');

  const Item = ({ icon: Icon, label, path }: { icon: any; label: string; path: string }) => (
    <button onClick={() => nav(path)} className="flex flex-col items-center gap-1 flex-1 py-1 group">
      <Icon size={22} className={`sm:w-6 sm:h-6 transition-colors ${isActive(path) ? 'text-fuchsia-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}
        style={isActive(path) ? { filter: 'drop-shadow(0 0 8px rgba(217,70,239,0.8))' } : {}} />
      <span className={`text-[11px] sm:text-xs ${isActive(path) ? 'text-fuchsia-400 font-semibold' : 'text-zinc-400'}`}>{label}</span>
    </button>
  );

  return (
    <>
      {sheetOpen && <CreationSheet onClose={() => setSheetOpen(false)} />}

      <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-md md:max-w-lg lg:max-w-xl px-3 pb-3">
          <div className="glass-strong rounded-3xl px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-around relative">
            <Item icon={Home} label="Home" path="/home" />
            <Item icon={Search} label="Search" path="/search" />
            <button onClick={() => setSheetOpen(true)} className="flex-1 flex justify-center translate-x-1">
              <span className="relative -mt-8 sm:-mt-10 inline-flex">
                <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full glass-strong flex items-center justify-center animate-pulse-glow border border-fuchsia-500/60">
                  <FwdMark size={28} className="sm:w-8 sm:h-8" />
                </div>
              </span>
            </button>
            <Item icon={Newspaper} label="Feed" path="/feed" />
            <Item icon={User} label="Profile" path="/profile" />
          </div>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
