import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Lock, Mail } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

interface Props {
  mode: 'request' | 'reset';
}

const PasswordReset: React.FC<Props> = ({ mode }) => {
  const nav = useNavigate();
  const { requestPasswordReset, updatePassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);

    if (mode === 'request') {
      const res = await requestPasswordReset(email.trim());
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessage('Check your email for a secure reset link.');
      return;
    }

    if (password.length < 6) {
      setBusy(false);
      setError('Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setBusy(false);
      setError('Passwords do not match.');
      return;
    }

    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast({ title: 'Password updated', description: 'You can keep forwarding the feeling.' });
    setMessage('Your password has been changed.');
    window.setTimeout(() => nav('/profile', { replace: true }), 700);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_35%)]" />
      <div className="relative w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/40 neon-glow-purple p-6">
        <button onClick={() => nav('/login')} className="w-10 h-10 rounded-full glass flex items-center justify-center mb-3">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex flex-col items-center text-center mb-5">
          <FwdLogo size="lg" />
          <h1 className="mt-4 text-2xl font-black text-white">
            {mode === 'request' ? 'Reset password' : 'Set new password'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {mode === 'request' ? 'We will send you a secure link.' : 'Choose a fresh password for FWD.'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'request' ? (
            <div className="glass border border-fuchsia-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <Mail size={16} className="text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 bg-transparent outline-none text-white text-sm"
              />
            </div>
          ) : (
            <>
              <div className="glass border border-fuchsia-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <Lock size={16} className="text-zinc-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="flex-1 bg-transparent outline-none text-white text-sm"
                />
              </div>
              <div className="glass border border-fuchsia-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <Lock size={16} className="text-zinc-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="flex-1 bg-transparent outline-none text-white text-sm"
                />
              </div>
            </>
          )}

          {error && <p className="text-pink-300 text-xs">{error}</p>}
          {message && (
            <p className="text-emerald-300 text-xs flex items-center gap-1">
              <Check size={13} /> {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-bold neon-glow-purple flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === 'request' ? 'Send reset link' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
