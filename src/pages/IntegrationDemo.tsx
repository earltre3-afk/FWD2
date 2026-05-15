import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Send, Smile, Image as ImageIcon, ArrowLeft, Mic } from 'lucide-react';
import FwdLogo, { FwdMark } from '@/components/FwdLogo';
import EmbedPicker, { gifToPayload } from './EmbedPicker';
import { Gif } from '@/contexts/AppContext';

interface Msg { id: string; text: string; gif?: Gif; from: 'me' | 'them'; time: string; }

const IntegrationDemo: React.FC = () => {
  const nav = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'm1', text: 'Meet you at the rooftop later?', from: 'them', time: '9:41 AM' },
    { id: 'm2', text: "Yesss! Can't wait 💜", from: 'me', time: '9:41 AM' },
  ]);
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<Gif | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'FWD_GIF_SELECTED') {
        const g = e.data.gif;
        setAttached({ id: g.id, title: g.title, image: g.mediaUrl, tags: g.tags || [], category: 'Reactions' });
        setPickerOpen(false);
      } else if (e.data.type === 'FWD_PICKER_CLOSED') {
        setPickerOpen(false);
      }
    };
    const customHandler = (e: any) => {
      const evt = e.detail;
      if (evt?.type === 'FWD_GIF_SELECTED') {
        const g = evt.gif;
        setAttached({ id: g.id, title: g.title, image: g.mediaUrl, tags: g.tags || [], category: 'Reactions' });
        setPickerOpen(false);
      } else if (evt?.type === 'FWD_PICKER_CLOSED') {
        setPickerOpen(false);
      }
    };
    window.addEventListener('message', handler);
    window.addEventListener('fwd:event', customHandler as any);
    return () => {
      window.removeEventListener('message', handler);
      window.removeEventListener('fwd:event', customHandler as any);
    };
  }, []);

  const send = () => {
    if (!draft.trim() && !attached) return;
    const newMsg: Msg = {
      id: 'm' + Date.now(), text: draft.trim(), gif: attached || undefined, from: 'me',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };
    setMessages([...messages, newMsg]);
    setDraft('');
    setAttached(null);
  };

  return (
    <div className="min-h-screen relative">
      <div className="max-w-md mx-auto pt-4 pb-32 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => nav('/')} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="sm" />
          <div className="w-10" />
        </div>

        <div className="glass-strong rounded-3xl p-3 border border-fuchsia-500/20 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-br from-fuchsia-500 to-cyan-400">
              <div className="w-full h-full rounded-full bg-zinc-800 overflow-hidden">
                <img src="https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822635006_427079cb.png" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold text-white">Maya</div>
              <div className="text-xs text-fuchsia-400">● Online</div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500 mb-3">Today 9:41 AM</p>

        {/* Messages */}
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.from === 'me'
                  ? 'bg-gradient-to-br from-fuchsia-600 to-pink-500 text-white'
                  : 'glass-strong border border-white/10 text-white'
              }`}>
                {m.gif && (
                  <img src={m.gif.image} className="rounded-xl mb-1 w-full max-w-[220px]" />
                )}
                {m.text && <p>{m.text}</p>}
                <div className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-pink-100/80' : 'text-zinc-500'}`}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom message bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/95 to-transparent pt-4 pb-4">
        <div className="max-w-md mx-auto px-3">
          {/* Attached GIF preview */}
          {attached && (
            <div className="glass-strong rounded-2xl p-2 mb-2 border border-fuchsia-500/40 flex items-center gap-2">
              <img src={attached.image} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1">
                <div className="text-xs text-fuchsia-300 font-semibold flex items-center gap-1.5">
                  <FwdMark size={14} /> {attached.title}
                </div>
                <div className="text-[10px] text-zinc-500">Powered by FWD</div>
              </div>
              <button onClick={() => setAttached(null)} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => setDrawerOpen(!drawerOpen)} className={`w-11 h-11 rounded-full flex items-center justify-center transition ${drawerOpen ? 'bg-fuchsia-600 rotate-45' : 'glass-strong border border-white/15'}`}>
              <Plus size={20} className="text-white" />
            </button>
            <div className="flex-1 glass-strong rounded-full px-4 py-2.5 border border-white/10 flex items-center gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Message…" className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-sm" />
            </div>
            {draft || attached ? (
              <button onClick={send} className="w-11 h-11 rounded-full bg-gradient-to-br from-fuchsia-600 to-pink-500 flex items-center justify-center neon-glow-pink">
                <Send size={18} className="text-white" />
              </button>
            ) : (
              <button className="w-11 h-11 rounded-full glass-strong border border-white/15 flex items-center justify-center">
                <Mic size={18} className="text-fuchsia-300" />
              </button>
            )}
          </div>

          {/* App drawer */}
          {drawerOpen && (
            <div className="mt-3 glass-strong rounded-2xl p-3 border border-fuchsia-500/30">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 px-1">Attach with</div>
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => { setPickerOpen(true); setDrawerOpen(false); }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-fuchsia-500/10 transition">
                  <div className="w-12 h-12 rounded-2xl glass-strong border border-fuchsia-500/40 flex items-center justify-center neon-glow-purple/30">
                    <FwdMark size={22} />
                  </div>
                  <span className="text-[10px] text-white font-semibold">FWD</span>
                </button>
                <button className="flex flex-col items-center gap-1.5 p-2 rounded-xl opacity-50">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <ImageIcon size={20} className="text-zinc-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold">Photo</span>
                </button>
                <button className="flex flex-col items-center gap-1.5 p-2 rounded-xl opacity-50">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <Smile size={20} className="text-zinc-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold">Sticker</span>
                </button>
                <button className="flex flex-col items-center gap-1.5 p-2 rounded-xl opacity-50">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <Plus size={20} className="text-zinc-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold">More</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded picker overlay (uses same component as /embed/picker) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50">
          <EmbedPicker />
        </div>
      )}
    </div>
  );
};

export default IntegrationDemo;
