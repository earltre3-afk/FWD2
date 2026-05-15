import React, { useMemo, useState } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, Scissors, Crop, Type, Smile, Gauge, Aperture, Camera, Play, X, ChevronDown, Globe, Lock, ChevronsRight, Loader2 } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import UploadDropzone from '@/components/UploadDropzone';
import { CATEGORIES, GIFS } from '@/data/gifs';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';


const TOOLS = [
  { id: 'trim', icon: Scissors, label: 'Trim' },
  { id: 'crop', icon: Crop, label: 'Crop' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'stickers', icon: Smile, label: 'Stickers' },
  { id: 'speed', icon: Gauge, label: 'Speed' },
  { id: 'filters', icon: Aperture, label: 'Filters' },
];

const FILTERS = ['None', 'Neon', 'Cyber', 'Glow', 'Retro', 'Vapor'];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const STICKERS = ['💯', '🔥', '✨', '👀', '😎', '💀', '🚀', '💜'];

const CreateGif: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const { createUserGif } = useAppContext();
  const searchParams = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const state = (loc.state as any) || {};
  const queryMediaUrl = searchParams.get('mediaUrl') || '';
  const queryMediaType = searchParams.get('type') || '';
  const initialImage = queryMediaUrl || state.image || GIFS[0].image;
  const initialMediaType = state.mediaType || (queryMediaType === 'camera' ? 'video/webm' : '');

  const [tool, setTool] = useState('trim');
  const [title, setTitle] = useState('Vibes Only');
  const [tags, setTags] = useState<string[]>(['vibes', 'neon', 'night', 'city', 'cool']);
  const [tagInput, setTagInput] = useState('');
  const [category, setCategory] = useState('Reactions');
  const [isPublic, setIsPublic] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState('None');
  const [textOverlay, setTextOverlay] = useState('');
  const [stickerOverlay, setStickerOverlay] = useState<string | null>(null);
  const [trim, setTrim] = useState({ start: 1, end: 4 });
  const [image, setImage] = useState(initialImage);
  const [mediaType, setMediaType] = useState(initialMediaType);
  const [uploadedFromVault, setUploadedFromVault] = useState(Boolean(queryMediaUrl));
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleUploaded = (publicUrl: string, file: File) => {
    setImage(publicUrl);
    setMediaType(file.type);
    setUploadedFromVault(true);
    // Pre-fill a friendlier title from filename if user hasn't customized
    if (title === 'Vibes Only') {
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 60);
      if (base) setTitle(base);
    }
  };

  const create = async () => {
    if (!title.trim()) { toast({ title: 'Title required', description: 'Give your GIF a name first.' }); return; }
    setSaving(true);
    const created = await createUserGif({
      title: title.trim(),
      image,
      tags,
      category,
      mood: undefined,
      isPublic,
    });
    setSaving(false);
    if (created) {
      toast({ title: 'GIF created', description: `"${title}" is ready to forward.` });
      setTimeout(() => nav('/profile'), 400);
    } else {
      toast({ title: 'Could not save', description: 'Make sure you are signed in and try again.' });
    }
  };


  const filterStyle = (() => {
    switch (filter) {
      case 'Neon': return 'saturate-150 contrast-125';
      case 'Cyber': return 'hue-rotate-30 saturate-150';
      case 'Glow': return 'brightness-110 saturate-125';
      case 'Retro': return 'sepia contrast-110';
      case 'Vapor': return 'hue-rotate-180 saturate-150';
      default: return '';
    }
  })();

  return (
    <div className="min-h-screen pb-10">
      <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center relative">
            <Bell size={18} className="text-fuchsia-400" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-pink-500" />
          </button>
        </div>

        <div className="text-center mb-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-widest">CREATE GIF</h1>
          <p className="text-zinc-400 text-sm sm:text-base">Turn your moment into a loop.</p>
        </div>

        {/* Upload zone */}
        <UploadDropzone onUploaded={handleUploaded} currentPreview={!uploadedFromVault ? image : undefined} />

        {/* Camera shortcut */}
        <button onClick={() => nav('/camera')} className="w-full mb-4 glass-strong rounded-xl py-2.5 px-3 border border-cyan-500/30 flex items-center justify-center gap-2 text-sm font-semibold text-white">
          <Camera size={16} className="text-cyan-400" /> Record with camera instead
        </button>


        {/* Preview */}
        <div className="relative rounded-2xl overflow-hidden border border-fuchsia-500/40 neon-glow-purple aspect-square sm:aspect-video lg:aspect-square max-w-lg mx-auto mb-3">
          {mediaType?.startsWith('video/') || image.includes('.webm') || image.includes('.mp4') ? (
            <video src={image} muted autoPlay loop playsInline className={`w-full h-full object-cover ${filterStyle}`} style={{ animationDuration: `${3 / speed}s` }} />
          ) : (
            <img src={image} alt="preview" className={`w-full h-full object-cover ${filterStyle}`} style={{ animationDuration: `${3 / speed}s` }} />
          )}
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-bold text-white border border-white/10">1:1</span>
          {textOverlay && (
            <div className="absolute inset-x-0 top-1/3 text-center text-2xl font-black text-white px-4" style={{ textShadow: '0 0 12px rgba(255,0,107,0.9), 0 0 24px rgba(176,38,255,0.8)' }}>
              {textOverlay}
            </div>
          )}
          {stickerOverlay && (
            <div className="absolute bottom-6 right-6 text-5xl drop-shadow-[0_0_10px_rgba(255,0,107,0.8)]">{stickerOverlay}</div>
          )}
          <button className="absolute bottom-2 left-2 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/15">
            <Play size={14} className="text-white ml-0.5" />
          </button>
          <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/60 text-[11px] font-mono text-white border border-white/15">
            00:0{Math.min(trim.end - trim.start, 5)} / 00:05
          </span>
        </div>

        {/* Timeline */}
        <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
          <div className="relative h-14 rounded-xl overflow-hidden bg-black/40">
            <div className="absolute inset-0 flex">
              {Array.from({ length: 8 }).map((_, i) => (
                mediaType?.startsWith('video/') || image.includes('.webm') || image.includes('.mp4') ? (
                  <video key={i} src={image} muted playsInline className="h-full w-1/8 object-cover opacity-60" style={{ width: '12.5%' }} />
                ) : (
                  <img key={i} src={image} className="h-full w-1/8 object-cover opacity-60" style={{ width: '12.5%' }} />
                )
              ))}
            </div>
            <div className="absolute top-0 bottom-0 border-2 border-fuchsia-500 rounded-lg"
              style={{ left: `${trim.start * 20}%`, right: `${100 - trim.end * 20}%`, boxShadow: '0 0 20px rgba(176,38,255,0.8)' }}>
              <div className="absolute -left-1 top-0 bottom-0 w-2 bg-fuchsia-500 rounded-l" />
              <div className="absolute -right-1 top-0 bottom-0 w-2 bg-cyan-400 rounded-r" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500 font-mono">
            <span>00:00</span><span>00:0{trim.end - trim.start}</span><span>00:05</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="range" min={0} max={4} value={trim.start} onChange={(e) => setTrim({ ...trim, start: +e.target.value })} className="accent-fuchsia-500" />
            <input type="range" min={1} max={5} value={trim.end} onChange={(e) => setTrim({ ...trim, end: +e.target.value })} className="accent-cyan-400" />
          </div>
        </div>

        {/* Tools */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-4">
          {TOOLS.map(t => {
            const Icon = t.icon;
            const active = t.id === tool;
            return (
              <button key={t.id} onClick={() => setTool(t.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition ${
                  active ? 'bg-fuchsia-500/15 border-fuchsia-500 neon-glow-purple text-fuchsia-300' : 'glass border-white/10 text-zinc-300 hover:border-fuchsia-500/40'
                }`}>
                <Icon size={20} />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tool panels */}
        {tool === 'text' && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Text Overlay</p>
            <input value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} placeholder="Type your reaction…"
              className="w-full bg-black/40 rounded-xl px-4 py-3 text-white outline-none border border-white/10 focus:border-fuchsia-500" />
          </div>
        )}
        {tool === 'stickers' && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Stickers</p>
            <div className="flex flex-wrap gap-2">
              {STICKERS.map(s => (
                <button key={s} onClick={() => setStickerOverlay(s === stickerOverlay ? null : s)}
                  className={`w-12 h-12 rounded-xl text-2xl border ${stickerOverlay === s ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 glass'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {tool === 'speed' && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Playback Speed</p>
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${speed === s ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300' : 'glass border-white/10 text-zinc-300'}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
        {tool === 'filters' && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Filters / Effects</p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${filter === f ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300' : 'glass border-white/10 text-zinc-300'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
        {tool === 'crop' && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Aspect Ratio</p>
            <div className="flex flex-wrap gap-2">
              {['1:1', '4:5', '9:16', '16:9'].map(r => (
                <button key={r} className="px-4 py-2 rounded-full text-sm font-semibold border glass border-white/10 text-zinc-300 hover:border-fuchsia-500/40">{r}</button>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20 mb-3">
          <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">Title</div>
          <div className="flex items-center justify-between">
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))}
              className="flex-1 bg-transparent outline-none text-white text-lg font-bold" />
            <span className="text-xs text-zinc-500 font-mono">{title.length}/60</span>
          </div>
        </div>

        {/* Tags */}
        <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20 mb-3">
          <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Tags</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-fuchsia-500/30 text-sm text-zinc-200">
                {t}
                <button onClick={() => setTags(tags.filter(x => x !== t))}><X size={12} className="text-zinc-400" /></button>
              </span>
            ))}
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="add tag…"
              className="bg-transparent outline-none text-white text-sm min-w-[80px]" />
          </div>
        </div>

        {/* Category + visibility */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Category</div>
            <div className="relative">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent outline-none text-white text-sm font-semibold appearance-none pr-6">
                {CATEGORIES.map(c => <option key={c} className="bg-zinc-900">{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-0 top-1.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          <button onClick={() => setIsPublic(!isPublic)} className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">Visibility</div>
              <div className="text-white text-sm font-semibold flex items-center gap-1.5">
                {isPublic ? <><Globe size={14} className="text-cyan-400" /> Public</> : <><Lock size={14} className="text-pink-400" /> Private</>}
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 transition ${isPublic ? 'bg-fuchsia-500' : 'bg-zinc-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition ${isPublic ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        </div>

        <button onClick={create} disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white text-lg font-black tracking-widest neon-glow-purple flex items-center justify-center gap-2 hover:scale-[1.02] transition disabled:opacity-70">
          {saving ? <><Loader2 size={20} className="animate-spin" /> SAVING…</> : <>CREATE GIF <ChevronsRight size={22} /></>}
        </button>

      </div>
    </div>
  );
};

export default CreateGif;
