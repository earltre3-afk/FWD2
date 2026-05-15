import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Sparkles, User } from 'lucide-react';
import { FwdMark } from './FwdLogo';

const BottomNav: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const isActive = (p: string) => loc.pathname === p || loc.pathname.startsWith(p + '/');

  const Item = ({ icon: Icon, label, path }: any) => (
    <button onClick={() => nav(path)} className="flex flex-col items-center gap-1 flex-1 py-1 group">
      <Icon size={22} className={`transition-colors ${isActive(path) ? 'text-fuchsia-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}
        style={isActive(path) ? { filter: 'drop-shadow(0 0 8px rgba(217,70,239,0.8))' } : {}} />
      <span className={`text-[11px] ${isActive(path) ? 'text-fuchsia-400 font-semibold' : 'text-zinc-400'}`}>{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-3 pb-3">
        <div className="glass-strong rounded-3xl px-2 py-2 flex items-center justify-around relative">
          <Item icon={Home} label="Home" path="/home" />
          <Item icon={Search} label="Search" path="/search" />
          <button onClick={() => nav('/create')} className="relative -mt-8 mx-1">
            <div className="w-16 h-16 rounded-full glass-strong flex items-center justify-center animate-pulse-glow border border-fuchsia-500/60">
              <FwdMark size={28} />
            </div>
          </button>
          <Item icon={Sparkles} label="Discover" path="/discover" />
          <Item icon={User} label="Profile" path="/profile" />
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
