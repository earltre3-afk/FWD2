import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import TreyTvLogo from '@/components/TreyTvLogo';
import { startTreyTvLogin, isTreyTvLoginConfigured, isSafeReturnTo } from '@/lib/treyTvAuth';

/**
 * /auth/trey-tv/start
 *
 * Safe entry point for the Trey TV OAuth + PKCE flow.
 * Accepts an optional `returnTo` query param and validates it before use.
 * Redirects to the Trey TV authorize endpoint immediately on mount.
 *
 * Keeping this as a dedicated route means:
 *   - Deep links can start the flow: /auth/trey-tv/start?returnTo=/favorites
 *   - The login button in AuthModal can navigate here instead of calling
 *     startTreyTvLogin() directly (both patterns work).
 *   - The error state is handled gracefully with a retry option.
 */
const TreyTvStart: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isTreyTvLoginConfigured()) {
      setErr('Trey TV login is not configured for this environment.');
      return;
    }

    const raw = params.get('returnTo') || params.get('return_to') || '';
    const returnTo = isSafeReturnTo(raw) ? raw : undefined;

    startTreyTvLogin({ returnTo })
      .catch(() => {
        setErr('Could not start Trey TV login. Please try again.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.22),transparent_35%)]" />
        <div className="relative z-10 w-full max-w-md glass-strong rounded-3xl border border-rose-400/40 p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <FwdLogo size="lg" />
            <span className="text-zinc-500 text-2xl font-light">×</span>
            <TreyTvLogo size={38} />
          </div>
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-rose-500/15 border border-rose-400/40">
            <AlertTriangle className="text-rose-300" size={26} />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Can't start Trey TV login</h2>
          <p className="text-sm text-zinc-400 mb-6">{err}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setErr(null); window.location.reload(); }}
              className="w-full glass-strong border border-cyan-400/40 rounded-xl py-3 text-sm font-semibold text-white hover:border-cyan-300/70 transition-all"
            >
              Try again
            </button>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full glass border border-white/15 rounded-xl py-3 text-sm font-medium text-zinc-200 hover:border-white/30 transition-all"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.22),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md glass-strong rounded-3xl border border-cyan-400/40 p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-5">
          <FwdLogo size="lg" />
          <span className="text-zinc-500 text-2xl font-light">×</span>
          <TreyTvLogo size={38} className="drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
        </div>
        <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/30 border border-cyan-400/30">
          <Loader2 className="animate-spin text-cyan-300" size={26} />
        </div>
        <h2 className="text-xl font-black text-white">Redirecting to Trey TV…</h2>
        <p className="text-sm text-zinc-400 mt-2">
          You'll be taken to Trey TV to approve the connection.
        </p>
        <p className="text-[11px] text-zinc-600 mt-4">
          FWD will stay separate — only your identity is shared.
        </p>
      </div>
    </div>
  );
};

export default TreyTvStart;
