import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'error';

function consumeReturnTo() {
  try {
    const value = sessionStorage.getItem('fwd_oauth_return_to');
    sessionStorage.removeItem('fwd_oauth_return_to');
    if (value?.startsWith('/') && !value.startsWith('//')) return value;
  } catch {}
  return '/profile';
}

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Finishing your sign-in...');

  useEffect(() => {
    let alive = true;

    async function finishSignIn() {
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      if (error) {
        if (!alive) return;
        setStatus('error');
        setMessage(errorDescription || 'The sign-in request was canceled or failed.');
        return;
      }

      try {
        const code = params.get('code');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('No sign-in code was returned.');
        }

        if (!alive) return;
        navigate(consumeReturnTo(), { replace: true });
      } catch (err) {
        if (!alive) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not finish sign-in. Please try again.');
      }
    }

    finishSignIn();
    return () => {
      alive = false;
    };
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_35%)]" />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl border border-fuchsia-500/40 neon-glow-purple p-8 text-center">
        <div className="flex justify-center mb-5">
          <FwdLogo size="lg" />
        </div>

        {status === 'loading' ? (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-fuchsia-500/25 to-cyan-400/25 border border-cyan-400/30">
              <Loader2 className="animate-spin text-cyan-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Signing you in...</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
            <Sparkles className="mx-auto mt-5 text-fuchsia-300" size={18} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-pink-500/15 border border-pink-400/40">
              <AlertTriangle className="text-pink-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Sign-in failed</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full mt-6 rounded-xl py-3 bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-bold"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
