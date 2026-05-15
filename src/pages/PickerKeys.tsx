import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, Copy, RefreshCw, Trash2, Plus, Check, ShieldCheck, ExternalLink } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

interface PickerKey {
  id: string;
  app_name: string;
  public_key: string;
  allowed_origins: string[] | null;
  picker_mode: string | null;
  created_at: string;
}

const MODES = ['compact', 'full', 'sheet'];

const generatePublicKey = () => {
  // Public, non-secret embed key. Cryptographically randomish for uniqueness only.
  const rand = (typeof crypto !== 'undefined' && 'getRandomValues' in crypto)
    ? Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `pk_fwd_${rand.slice(0, 24)}`;
};

const buildEmbedUrl = (publicKey: string, appName: string, mode: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const source = encodeURIComponent((appName || 'external_app').toLowerCase().replace(/\s+/g, '_'));
  return `${origin}/embed/picker?source=${source}&context=message&theme=dark&mode=${mode}&key=${publicKey}`;
};

const PickerKeys: React.FC = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [keys, setKeys] = useState<PickerKey[]>([]);
  const [loading, setLoading] = useState(true);

  const [appName, setAppName] = useState('');
  const [origins, setOrigins] = useState('');
  const [mode, setMode] = useState('compact');
  const [creating, setCreating] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from('picker_api_keys')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setKeys((data as PickerKey[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    if (!appName.trim()) { toast({ title: 'Name your app first', description: 'Pick something like “Linear Chat” or “Acme Comments”.' }); return; }
    setCreating(true);
    const parsedOrigins = origins.split(',').map(s => s.trim()).filter(Boolean);
    const publicKey = generatePublicKey();
    const { data, error } = await supabase.from('picker_api_keys').insert({
      user_id: user.id,
      app_name: appName.trim(),
      public_key: publicKey,
      allowed_origins: parsedOrigins,
      picker_mode: mode,
    }).select().single();
    setCreating(false);
    if (error || !data) { toast({ title: 'Could not create key', description: error?.message || 'Please try again.' }); return; }
    setKeys(prev => [data as PickerKey, ...prev]);
    setAppName(''); setOrigins(''); setMode('compact');
    toast({ title: 'Embed key generated', description: 'Drop it into your app to start picking GIFs.' });
  };

  const handleRegenerate = async (k: PickerKey) => {
    const next = generatePublicKey();
    const { error, data } = await supabase.from('picker_api_keys')
      .update({ public_key: next }).eq('id', k.id).select().single();
    if (error || !data) { toast({ title: 'Could not regenerate' }); return; }
    setKeys(prev => prev.map(x => x.id === k.id ? (data as PickerKey) : x));
    toast({ title: 'Key regenerated', description: 'Old key is no longer valid.' });
  };

  const handleDelete = async (k: PickerKey) => {
    const { error } = await supabase.from('picker_api_keys').delete().eq('id', k.id);
    if (error) { toast({ title: 'Could not delete key' }); return; }
    setKeys(prev => prev.filter(x => x.id !== k.id));
    toast({ title: 'Key deleted' });
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      toast({ title: 'Copy failed', description: 'Long-press to copy manually.' });
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <div className="w-10" />
        </div>

        <div className="text-center mb-5">
          <h1 className="text-3xl font-black text-white tracking-widest">PICKER API KEYS</h1>
          <p className="text-zinc-400 text-sm mt-1">Embed FWD as a GIF picker inside your own chat, comments, or app.</p>
        </div>

        {/* Server-side validation status */}
        <div className="glass-strong rounded-2xl p-3 border border-emerald-500/20 mb-5 flex items-start gap-2">
          <ShieldCheck size={16} className="text-emerald-300 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-300">
            <span className="text-emerald-300 font-bold">Domain protection active.</span>{' '}
            Public embed keys are checked against their allowed origins before the picker renders.
          </div>
        </div>

        {/* New key form */}
        <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/25 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={14} className="text-fuchsia-300" />
            <h2 className="text-sm font-black text-white tracking-wider">CREATE EMBED KEY</h2>
          </div>
          <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">App name</label>
          <input
            value={appName}
            onChange={(e) => setAppName(e.target.value.slice(0, 60))}
            placeholder="e.g. Acme Chat"
            className="w-full bg-black/40 border border-white/10 focus:border-fuchsia-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none mb-3"
          />
          <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Allowed origins (comma separated)</label>
          <input
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            placeholder="https://app.example.com, https://staging.example.com"
            className="w-full bg-black/40 border border-white/10 focus:border-fuchsia-500 rounded-xl px-3 py-2.5 text-white text-sm outline-none mb-3"
          />
          <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Picker mode</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {MODES.map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  mode === m ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300' : 'glass border-white/10 text-zinc-300'
                }`}>
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !user}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-black tracking-widest neon-glow-purple disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Key size={14} /> {creating ? 'GENERATING…' : 'GENERATE EMBED KEY'}
          </button>
          {!user && <p className="text-[11px] text-zinc-500 text-center mt-2">Sign in to manage keys.</p>}
        </div>

        {/* Keys list */}
        <h2 className="text-sm font-black text-white tracking-wider mb-2">YOUR KEYS</h2>
        {loading ? (
          <div className="glass rounded-2xl p-5 border border-white/5 animate-pulse h-24" />
        ) : keys.length === 0 ? (
          <div className="glass-strong rounded-2xl p-6 text-center border border-fuchsia-500/20">
            <p className="text-zinc-300 font-semibold">No keys yet</p>
            <p className="text-zinc-500 text-xs mt-1">Create one above to start embedding the FWD picker.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map(k => {
              const embedUrl = buildEmbedUrl(k.public_key, k.app_name, k.picker_mode || 'compact');
              return (
                <div key={k.id} className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-white font-black truncate">{k.app_name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Mode: {k.picker_mode || 'compact'} · Created {new Date(k.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 shrink-0">PUBLIC</span>
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mt-2 mb-1">Public embed key</div>
                  <div className="flex items-center gap-2 bg-black/50 rounded-xl border border-white/5 p-2">
                    <code className="flex-1 text-[11px] font-mono text-cyan-200 truncate">{k.public_key}</code>
                    <button onClick={() => copy(k.public_key, k.id + '-key')}
                      className="px-2 py-1 rounded-md glass border border-white/10 text-xs text-zinc-200 flex items-center gap-1">
                      {copiedId === k.id + '-key' ? <><Check size={12} className="text-emerald-300" /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mt-3 mb-1">Embed URL</div>
                  <div className="flex items-center gap-2 bg-black/50 rounded-xl border border-white/5 p-2">
                    <code className="flex-1 text-[11px] font-mono text-fuchsia-200 truncate">{embedUrl}</code>
                    <button onClick={() => copy(embedUrl, k.id + '-url')}
                      className="px-2 py-1 rounded-md glass border border-white/10 text-xs text-zinc-200 flex items-center gap-1">
                      {copiedId === k.id + '-url' ? <><Check size={12} className="text-emerald-300" /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                    <a href={embedUrl} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-1 rounded-md glass border border-cyan-500/40 text-xs text-cyan-300 flex items-center gap-1">
                      <ExternalLink size={12} /> Open
                    </a>
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 mt-3 mb-1">Allowed origins</div>
                  {k.allowed_origins && k.allowed_origins.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {k.allowed_origins.map(o => (
                        <span key={o} className="px-2 py-0.5 rounded-full glass border border-white/10 text-[11px] text-zinc-300">{o}</span>
                      ))}
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">Enforced</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500">No origins set — this key will be rejected until at least one allowed origin is added.</p>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <button onClick={() => handleRegenerate(k)}
                      className="flex-1 py-2 rounded-xl glass border border-fuchsia-500/30 text-fuchsia-200 text-xs font-bold flex items-center justify-center gap-1.5">
                      <RefreshCw size={12} /> Regenerate
                    </button>
                    <button onClick={() => handleDelete(k)}
                      className="flex-1 py-2 rounded-xl glass border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-[11px] text-zinc-500 text-center">
          Keep embed keys public. Allowed origins control where the picker can render.
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default PickerKeys;
