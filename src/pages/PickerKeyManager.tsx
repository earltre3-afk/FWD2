import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy, CheckCheck, Key, Globe, ArrowLeft, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface PickerKey {
  id: string;
  app_name: string;
  public_key: string;
  allowed_origins: string[];
  is_active: boolean;
  created_at: string;
}

const PickerKeyManager: React.FC = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [keys, setKeys] = useState<PickerKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [appName, setAppName] = useState('');
  const [originsRaw, setOriginsRaw] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('picker_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setKeys((data as PickerKey[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const generateKey = () =>
    'fwd_pk_' + Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!appName.trim()) { setError('App name is required.'); return; }
    const origins = originsRaw
      .split(/[\n,]+/)
      .map(o => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    if (!origins.length) { setError('At least one allowed origin is required.'); return; }

    setCreating(true);
    const { error: insertErr } = await supabase
      .from('picker_api_keys')
      .insert({
        user_id: user!.id,
        app_name: appName.trim(),
        public_key: generateKey(),
        allowed_origins: origins,
        is_active: true,
      });
    setCreating(false);
    if (insertErr) { setError(insertErr.message); return; }
    setAppName('');
    setOriginsRaw('');
    setShowForm(false);
    load();
  };

  const handleToggle = async (key: PickerKey) => {
    await supabase
      .from('picker_api_keys')
      .update({ is_active: !key.is_active })
      .eq('id', key.id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this picker key? Any embed using it will stop working.')) return;
    await supabase.from('picker_api_keys').delete().eq('id', id);
    load();
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-3xl p-8 text-center max-w-sm border border-fuchsia-500/20">
          <Key size={32} className="text-fuchsia-400 mx-auto mb-3" />
          <h2 className="text-white font-black text-xl mb-2">Sign in required</h2>
          <p className="text-zinc-400 text-sm mb-5">You need to be logged in to manage picker keys.</p>
          <button onClick={() => nav('/login')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-zinc-300" />
          </button>
          <FwdLogo size="md" />
          <div className="w-10" />
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-black text-white">Picker API Keys</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Control which apps and domains can embed the FWD GIF picker.
            Each key is scoped to specific allowed origins.
          </p>
        </div>

        {/* How it works */}
        <div className="glass-strong rounded-2xl border border-cyan-500/20 p-4 mb-6 text-sm text-zinc-300 space-y-1">
          <p className="font-bold text-cyan-300 text-xs uppercase tracking-wider mb-2">How embedding works</p>
          <p>1. Create a key and add your app's domain as an allowed origin.</p>
          <p>2. Use the public key in your embed URL:</p>
          <code className="block bg-black/40 rounded-lg px-3 py-2 text-xs text-cyan-300 mt-1 font-mono break-all">
            https://fwd.treytv.com/embed/picker?key=YOUR_KEY&source=trey_tv&context=message
          </code>
          <p className="mt-2">3. Listen for <span className="text-fuchsia-300 font-mono">FWD_GIF_SELECTED</span> postMessage events.</p>
        </div>

        {/* Create key form */}
        {showForm ? (
          <form onSubmit={handleCreate} className="glass-strong rounded-2xl border border-fuchsia-500/30 p-5 mb-6">
            <h3 className="font-black text-white mb-4">New Picker Key</h3>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1 block">App name</label>
              <input
                value={appName}
                onChange={e => setAppName(e.target.value)}
                placeholder="e.g. Trey TV, My App"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm outline-none focus:border-fuchsia-500/60"
              />
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1 block">Allowed origins <span className="text-zinc-600">(one per line or comma-separated)</span></label>
              <textarea
                value={originsRaw}
                onChange={e => setOriginsRaw(e.target.value)}
                rows={3}
                placeholder={"https://tv.treytrizzy.com\nhttps://treytv.com"}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 text-sm outline-none focus:border-fuchsia-500/60 font-mono resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Key
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }}
                className="px-5 py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full mb-6 py-4 rounded-2xl border-2 border-dashed border-fuchsia-500/30 hover:border-fuchsia-500/60 text-fuchsia-400 hover:text-fuchsia-300 font-bold flex items-center justify-center gap-2 transition">
            <Plus size={18} /> Create New Picker Key
          </button>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-fuchsia-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-16 glass-strong rounded-3xl border border-white/5">
            <Key size={32} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No picker keys yet. Create one to start embedding FWD.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {keys.map(k => (
              <div key={k.id} className={`glass-strong rounded-2xl border p-5 ${k.is_active ? 'border-fuchsia-500/20' : 'border-zinc-800 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-base truncate">{k.app_name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${k.is_active ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                        {k.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">Created {new Date(k.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleToggle(k)} className="text-xs px-3 py-1.5 rounded-lg glass border border-white/10 text-zinc-300 hover:text-white transition">
                      {k.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(k.id)} className="w-8 h-8 rounded-lg glass border border-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Public key */}
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Public Key</p>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                    <code className="flex-1 text-xs font-mono text-cyan-300 truncate">
                      {revealedId === k.id ? k.public_key : k.public_key.replace(/^(fwd_pk_).{8}/, '$1••••••••')}
                    </code>
                    <button onClick={() => setRevealedId(revealedId === k.id ? null : k.id)} className="flex-shrink-0 text-zinc-400 hover:text-white transition">
                      {revealedId === k.id ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => copy(k.public_key, k.id + '_key')} className="flex-shrink-0 text-zinc-400 hover:text-cyan-400 transition">
                      {copiedId === k.id + '_key' ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Allowed origins */}
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Globe size={10} /> Allowed Origins
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(k.allowed_origins || []).map(o => (
                      <span key={o} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Embed snippet */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Embed URL</p>
                  <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                    <code className="flex-1 text-[10px] font-mono text-zinc-400 truncate">
                      {`https://fwd.treytv.com/embed/picker?key=${k.public_key}&source=YOUR_APP&context=message`}
                    </code>
                    <button
                      onClick={() => copy(`https://fwd.treytv.com/embed/picker?key=${k.public_key}&source=YOUR_APP&context=message`, k.id + '_url')}
                      className="flex-shrink-0 text-zinc-400 hover:text-fuchsia-400 transition">
                      {copiedId === k.id + '_url' ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default PickerKeyManager;
