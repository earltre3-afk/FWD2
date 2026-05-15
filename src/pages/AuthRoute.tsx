import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthModal from '@/components/AuthModal';
import FwdLogo from '@/components/FwdLogo';
import { useAuth } from '@/contexts/AuthContext';

interface AuthRouteProps {
  mode: 'signin' | 'signup';
}

const AuthRoute: React.FC<AuthRouteProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!loading && user) navigate('/profile', { replace: true });
  }, [loading, user, navigate]);

  const close = () => {
    setOpen(false);
    navigate('/home', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.25),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_35%)]" />
      <div className="relative z-10 text-center">
        <FwdLogo size="xl" />
        <p className="mt-4 text-zinc-400 text-sm">{mode === 'signin' ? 'Welcome back to FWD.' : 'Create your FWD account.'}</p>
      </div>
      <AuthModal open={open} onClose={close} initialMode={mode} />
    </div>
  );
};

export default AuthRoute;
