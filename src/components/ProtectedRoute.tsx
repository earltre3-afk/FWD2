import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import FwdLogo from './FwdLogo';
import AuthModal from './AuthModal';

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FwdLogo size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full glass-strong rounded-3xl border border-fuchsia-500/40 neon-glow-purple p-8 text-center">
          <button onClick={() => nav(-1)} className="absolute top-6 left-6 w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex justify-center mb-4">
            <FwdLogo size="md" />
          </div>
          <div className="w-14 h-14 mx-auto rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 flex items-center justify-center mb-4">
            <Lock size={22} className="text-fuchsia-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Sign in to forward</h2>
          <p className="text-zinc-400 text-sm mb-6">Save GIFs, build collections and create your own — all keyed to your account.</p>
          <button onClick={() => setShowAuth(true)}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-bold neon-glow-purple">
            Sign In / Create Account
          </button>
          <button onClick={() => nav('/home')} className="mt-3 text-sm text-zinc-400 hover:text-white">Continue browsing</button>
        </div>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
