import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  consumeReturnTo,
  consumeStoredState,
  startTreyTvLogin,
  treyTvRedirectUri,
} from '@/lib/treyTvAuth';

type Status = 'loading' | 'success' | 'error';

interface ExchangeResult {
  ok: boolean;
  error?: string;
  profile?: {
    fwd_user_id?: string | null;
    is_new_profile?: boolean;
    display_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    connected_trey_tv_uid?: string | null;
  };
}

const TreyTvCallback: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('Connecting to Trey TV…');
  const [returnPath, setReturnPath] = useState<string>('/profile');

  useEffect(() => {
    const code = params.get('code');
    const returnedState = params.get('state');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');
    const expectedState = consumeStoredState();
    const storedReturnTo = consumeReturnTo();
    if (storedReturnTo) setReturnPath(storedReturnTo);

    if (errorParam) {
      setStatus('error');
      setMessage(errorDescription || 'Trey TV login was canceled or failed.');
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Trey TV login was canceled or failed.');
      return;
    }

    if (!expectedState || !returnedState || expectedState !== returnedState) {
      setStatus('error');
      setMessage("We couldn't verify this login. Please try again.");
      return;
    }

    const run = async () => {
      try {
        if (!isSupabaseConfigured) {
          setStatus('error');
          setMessage(
            'FWD is missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using Trey TV login.'
          );
          return;
        }

        const { data, error } = await supabase.functions.invoke<ExchangeResult>(
          'trey-tv-login-exchange',
          {
            body: {
              code,
              redirect_uri: treyTvRedirectUri,
              state: returnedState,
            },
          }
        );

        if (error) {
          setStatus('error');
          setMessage(error.message || 'Trey TV login failed. Please try again.');
          return;
        }

        if (!data || !data.ok) {
          setStatus('error');
          setMessage(data?.error || 'Trey TV login failed. Please try again.');
          return;
        }

        setStatus('success');
        setMessage('Trey TV connected. Taking you in…');

        const isNew = data.profile?.is_new_profile;
        const next = isNew ? '/create-profile' : storedReturnTo || '/profile';

        // Pass Trey TV profile prefill data to create-profile via state
        setTimeout(() => {
          if (isNew) {
            navigate(next, {
              replace: true,
              state: {
                prefill: {
                  display_name: data.profile?.display_name || '',
                  email: data.profile?.email || '',
                  avatar_url: data.profile?.avatar_url || '',
                  connected_trey_tv_uid: data.profile?.connected_trey_tv_uid || '',
                  login_provider: 'trey_tv',
                },
              },
            });
          } else {
            navigate(next, { replace: true });
          }
        }, 600);
      } catch (err) {
        setStatus('error');
        setMessage(
          err instanceof Error
            ? err.message
            : 'Something went wrong connecting to Trey TV.'
        );
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    try {
      startTreyTvLogin({ returnTo: returnPath });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.22),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md glass-strong rounded-3xl border border-cyan-400/40 p-8 text-center">
        <div className="flex justify-center mb-5">
          <FwdLogo size="lg" />
        </div>

        {status === 'loading' && (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/30 border border-cyan-400/30">
              <Loader2 className="animate-spin text-cyan-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Connecting to Trey TV…</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/15 border border-emerald-400/40">
              <CheckCircle2 className="text-emerald-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">You're in.</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-rose-500/15 border border-rose-400/40">
              <AlertTriangle className="text-rose-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Login didn't complete</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={retry}
                className="w-full glass-strong border border-cyan-400/40 rounded-xl py-3 text-sm font-semibold text-white hover:border-cyan-300/70 transition-all"
              >
                Try Trey TV login again
              </button>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full glass border border-white/15 rounded-xl py-3 text-sm font-medium text-zinc-200 hover:border-white/30 transition-all"
              >
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TreyTvCallback;
