import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Loader2, Github } from 'lucide-react';
import { FwdMark } from './FwdLogo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { startTreyTvLogin, isTreyTvLoginConfigured } from '@/lib/treyTvAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
);

const friendlyError = (raw: string | undefined, mode: 'signin' | 'signup'): string => {
  if (!raw) return 'Something went wrong. Please try again.';
  const m = raw.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('invalid email or password')) {
    return "We couldn't sign you in. Check your info and try again.";
  }
  if (m.includes('already registered') || m.includes('user already exists') || m.includes('duplicate')) {
    return 'That email is already on FWD. Try signing in instead.';
  }
  if (m.includes('username') && m.includes('taken')) {
    return 'That username is already taken.';
  }
  if (m.includes('email') && m.includes('confirm')) {
    return 'Check your inbox to confirm your email before signing in.';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Too many attempts. Take a breath and try again in a moment.';
  }
  if (m.includes('password')) {
    return mode === 'signup'
      ? 'Pick a stronger password (at least 6 characters).'
      : 'That password didn’t match. Try again.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Network hiccup. Check your connection and try again.';
  }
  return raw;
};

const AuthModal: React.FC<Props> = ({ open, onClose, initialMode = 'signin' }) => {
  const { signInWithEmail, signUpWithEmail, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    const res = mode === 'signin'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password, displayName || email.split('@')[0]);
    setBusy(false);
    if (res.error) { setErr(friendlyError(res.error, mode)); return; }
    toast({ title: mode === 'signin' ? 'Welcome back' : 'Welcome to FWD', description: 'Forward the feeling.' });
    onClose();
  };

  const oauth = async (provider: 'google' | 'github') => {
    setBusy(true);
    const res = await signInWithOAuth(provider);
    setBusy(false);
    if (res.error) setErr(friendlyError(res.error, mode));
  };

  const treyTvLogin = () => {
    if (!isTreyTvLoginConfigured()) {
      setErr('Trey TV login is not configured for this environment yet.');
      return;
    }
    setBusy(true);
    try {
      startTreyTvLogin({ returnTo: '/profile' });
    } catch {
      setBusy(false);
      setErr('Could not start Trey TV login. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/40 neon-glow-purple p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full glass flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>

        <div className="flex flex-col items-center mb-5">
          <FwdMark size={48} />
          <h2 className="text-2xl font-black text-white mt-3">
            {mode === 'signin' ? 'Welcome back' : 'Join FWD'}
          </h2>
          <p className="text-sm text-zinc-400">
            {mode === 'signin' ? 'Forward the feeling.' : 'Create. React. Share.'}
          </p>
        </div>

        {/* OAuth */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => oauth('google')} disabled={busy}
            className="glass-strong border border-white/15 rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-semibold text-white hover:border-fuchsia-500/50">
            <GoogleIcon /> Google
          </button>
          <button onClick={() => oauth('github')} disabled={busy}
            className="glass-strong border border-white/15 rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-semibold text-white hover:border-fuchsia-500/50">
            <Github size={16} /> GitHub
          </button>
        </div>

        {/* Continue with Trey TV */}
        <button
          onClick={treyTvLogin}
          disabled={busy}
          className="w-full mb-4 glass-strong border border-cyan-400/40 rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 text-sm font-semibold text-white hover:border-cyan-300/70 hover:shadow-[0_0_28px_rgba(34,211,238,0.35)] transition-all disabled:opacity-60"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-pink-500 text-[10px] font-black text-black">
            TV
          </span>
          <span>Continue with Trey TV</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">or with email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div className="glass border border-fuchsia-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <UserIcon size={16} className="text-zinc-400" />
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name"
                className="flex-1 bg-transparent outline-none text-white text-sm" />
            </div>
          )}
          <div className="glass border border-fuchsia-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
            <Mail size={16} className="text-zinc-400" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
              className="flex-1 bg-transparent outline-none text-white text-sm" />
          </div>
          <div className="glass border border-fuchsia-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
            <Lock size={16} className="text-zinc-400" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ chars)"
              className="flex-1 bg-transparent outline-none text-white text-sm" />
          </div>

          {err && <div className="text-pink-400 text-xs px-1">{err}</div>}

          <button type="submit" disabled={busy}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-bold neon-glow-purple flex items-center justify-center gap-2 disabled:opacity-60">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400 mt-5">
          {mode === 'signin' ? "Don't have an account?" : 'Already on FWD?'}{' '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null); }}
            className="text-fuchsia-400 font-semibold hover:text-fuchsia-300">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
