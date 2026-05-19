import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, Save, Send, UploadCloud, X, AlertTriangle, Image as ImageIcon, Film, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext, Gif } from '@/contexts/AppContext';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { toast } from '@/components/ui/use-toast';
import { resolveFwdMedia } from '@/lib/fwdMedia';

const MOODS = ['Funny', 'Savage', 'Flirty', 'Dramatic', 'Petty', 'Shocked', 'Celebration', 'Vibes'];
const STYLES = ['Clean', 'Meme', 'Neon', 'Cinematic', 'Reaction Cam'];

const ACCEPT = '.gif,.mp4,.webm,.png,.jpg,.jpeg,image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'];

/** Determine if a MIME type is a video */
const isVideoMime = (t?: string | null) => !!t && t.startsWith('video/');
/** Determine if a MIME type is a still image (not gif) */
const isStillImageMime = (t?: string | null) => !!t && /^image\/(png|jpe?g|webp|avif)$/i.test(t);

/** Check if a string looks like a Supabase UUID */
const isUuid = (v?: string) => Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface ReplacementMedia {
  /** Local blob URL for immediate preview */
  localUrl: string;
  /** Remote public URL after upload completes */
  remoteUrl: string | null;
  /** Original file object */
  file: File;
  /** MIME type */
  mimeType: string;
}

const RemixStudio: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { createUserGif, createPost } = useAppContext();
  
  const [originalGif, setOriginalGif] = useState<Gif | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState('Funny');
  const [style, setStyle] = useState('Clean');
  
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [saving, setSaving] = useState(false);

  // ── Replacement media state ──
  const [replacement, setReplacement] = useState<ReplacementMedia | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up blob URLs on unmount or replacement change
  useEffect(() => {
    return () => {
      if (replacement?.localUrl) URL.revokeObjectURL(replacement.localUrl);
    };
  }, [replacement?.localUrl]);

  // ── Load original GIF: route state first, then Supabase lookup ──
  useEffect(() => {
    let cancel = false;
    const loadOriginal = async () => {
      // 1. Check if GIF was passed via route state (from GifDetail, Feed, Search, etc.)
      const stateGif = (location.state as any)?.gif as Gif | undefined;

      if (import.meta.env.DEV) {
        console.log('[RemixStudio] Loading', {
          routeId: id,
          isUuid: isUuid(id),
          hasRouteState: !!stateGif,
          routeStateImage: stateGif?.image ? 'yes' : 'no',
        });
      }

      // A. Route state has a full GIF object — use it immediately
      if (stateGif && (stateGif.image || stateGif.mp4_url)) {
        if (import.meta.env.DEV) console.log('[RemixStudio] Using route state GIF:', stateGif.title);
        setOriginalGif(stateGif);
        setLoading(false);
        return;
      }

      // B. Route param is a UUID — fetch from fwd_gifs
      if (id && isUuid(id)) {
        if (import.meta.env.DEV) console.log('[RemixStudio] Fetching from Supabase by UUID:', id);
        const { data, error } = await supabase
          .from('fwd_gifs')
          .select('*, fwd_profiles!owner_user_id(display_name, username)')
          .eq('id', id)
          .maybeSingle();
        if (cancel) return;

        if (import.meta.env.DEV) console.log('[RemixStudio] Supabase result:', { found: !!data, error: error?.message });

        if (data) {
          const media = resolveFwdMedia(data);
          const resolvedGif: Gif = {
            id: data.id,
            title: data.title || 'Untitled',
            image: media.animatedUrl || '',
            still_url: media.thumbnailUrl || undefined,
            tags: data.tags || [],
            category: data.category || 'Reactions',
            user_id: data.owner_user_id,
            caption: data.caption,
            visibility: data.visibility,
            mp4_url: media.mp4Url,
            webm_url: media.webmUrl,
            source_video_url: media.sourceVideoUrl,
            media_type: data.media_type,
            is_animated: data.is_animated ?? media.isLikelyAnimated,
            provider: data.provider,
            provider_gif_id: data.provider_gif_id,
          };
          (resolvedGif as any).original_profile = data.fwd_profiles;
          setOriginalGif(resolvedGif);
        }
      }
      // C. Non-UUID and no route state — can't resolve
      if (import.meta.env.DEV && !isUuid(id) && !stateGif) {
        console.warn('[RemixStudio] Non-UUID id with no route state — cannot load GIF');
      }

      if (!cancel) setLoading(false);
    };
    loadOriginal();
    return () => { cancel = true; };
  }, [id, location.state]);

  // ── Upload replacement media ──
  const handleFileSelect = useCallback(async (file: File) => {
    if (!user) { toast({ title: 'Sign in to upload', variant: 'destructive' }); return; }
    if (file.size > MAX_BYTES) { setUploadStatus('error'); setUploadError('File is over 25MB.'); return; }
    if (!ALLOWED_TYPES.includes(file.type)) { setUploadStatus('error'); setUploadError('Use .gif, .mp4, .webm, .png, .jpg or .webp'); return; }

    // Revoke previous blob URL
    if (replacement?.localUrl) URL.revokeObjectURL(replacement.localUrl);

    const localUrl = URL.createObjectURL(file);
    setReplacement({ localUrl, remoteUrl: null, file, mimeType: file.type });
    setUploadStatus('uploading');
    setUploadProgress(8);
    setUploadError('');

    // Simulated progress
    let tick = 8;
    const interval = setInterval(() => {
      tick = Math.min(88, tick + Math.random() * 10);
      setUploadProgress(Math.round(tick));
    }, 220);

    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    try {
      const { error: upErr } = await supabase.storage.from('fwd-uploads').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      clearInterval(interval);
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('fwd-uploads').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('No public URL');

      setUploadProgress(100);
      setUploadStatus('success');
      setReplacement(prev => prev ? { ...prev, remoteUrl: data.publicUrl } : null);

      if (import.meta.env.DEV) {
        console.log('[RemixStudio] Upload complete', {
          fileName: file.name,
          mimeType: file.type,
          localUrl: localUrl ? 'yes' : 'no',
          remoteUrl: data.publicUrl,
          source: 'replacement',
        });
      }
    } catch (e: any) {
      clearInterval(interval);
      setUploadStatus('error');
      setUploadError(e?.message || 'Upload failed.');
    }
  }, [user, replacement?.localUrl]);

  const clearReplacement = () => {
    if (replacement?.localUrl) URL.revokeObjectURL(replacement.localUrl);
    setReplacement(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError('');
  };

  // ── Resolve preview media ──
  const previewMedia = (() => {
    if (replacement) {
      const src = replacement.localUrl; // Always use local blob for preview (faster, works offline)
      const mime = replacement.mimeType;
      const isVideo = isVideoMime(mime);
      const isStill = isStillImageMime(mime);
      const isGif = mime === 'image/gif';

      if (import.meta.env.DEV) {
        console.log('[RemixStudio] Preview resolution', {
          selectedFile: replacement.file.name,
          localUrl: 'yes',
          remoteUrl: replacement.remoteUrl ? 'yes' : 'no',
          finalSrc: src,
          mimeType: mime,
          usingOriginal: false,
        });
      }

      return {
        mode: isVideo ? 'video' as const : 'image' as const,
        src,
        mimeType: mime,
        isAnimated: isVideo || isGif,
        isStill,
        mp4Url: isVideo && /mp4|m4v|mov/i.test(mime) ? src : null,
        webmUrl: isVideo && /webm/i.test(mime) ? src : null,
        gifUrl: !isVideo ? src : null,
        posterUrl: originalGif?.still_url || null,
        source: 'replacement' as const,
      };
    }
    // Fallback to original GIF
    if (originalGif) {
      if (import.meta.env.DEV) {
        console.log('[RemixStudio] Preview resolution', {
          selectedFile: 'none',
          localUrl: 'no',
          remoteUrl: 'no',
          finalSrc: originalGif.image,
          mimeType: originalGif.media_type || 'unknown',
          usingOriginal: true,
        });
      }
      return {
        mode: 'original' as const,
        src: originalGif.image,
        mimeType: originalGif.media_type || null,
        isAnimated: originalGif.is_animated,
        isStill: false,
        mp4Url: originalGif.mp4_url || null,
        webmUrl: originalGif.webm_url || null,
        gifUrl: originalGif.image || null,
        posterUrl: originalGif.still_url || null,
        source: 'original' as const,
      };
    }
    return null;
  })();

  const generateIdeas = async () => {
    if (!originalGif) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/remix-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: mood.toLowerCase(),
          context: originalGif.title + ' ' + (originalGif.caption || ''),
        })
      });
      const data = await res.json();
      if (data.ideas) setAiIdeas(data.ideas);
    } catch (err) {
      console.error(err);
      toast({ title: 'Could not fetch ideas', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  // ── Save / Post ──
  const uploadPending = replacement && !replacement.remoteUrl;

  const handleSave = async (postToFeed = false) => {
    if (!user) {
      toast({ title: 'Sign in to save', description: 'Create an account to save your remix.' });
      nav('/login');
      return;
    }
    if (!originalGif) return;

    // Block save if upload is still in progress
    if (uploadPending) {
      toast({ title: 'Finish uploading', description: 'Wait for your media to finish uploading before saving.', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      // Use replacement media URL if available, else fall back to original
      const mediaUrl = replacement?.remoteUrl || originalGif.image;
      const mediaType = replacement ? replacement.mimeType : (originalGif.media_type || 'image/gif');
      const isAnimated = replacement ? (isVideoMime(replacement.mimeType) || replacement.mimeType === 'image/gif') : (originalGif.is_animated ?? true);
      const stillUrl = replacement ? null : (originalGif.still_url || null);

      const remixed = await createUserGif({
        title: `Remix: ${originalGif.title}`,
        image: mediaUrl,
        still_url: stillUrl,
        tags: originalGif.tags,
        category: originalGif.category,
        mood: mood,
        caption: caption,
        isPublic: postToFeed,
        allow_reuse: true,
        allow_download: true,
        source_type: 'remix',
        source_video_url: isVideoMime(mediaType) ? mediaUrl : (originalGif.source_video_url || undefined),
        media_type: mediaType,
        is_animated: isAnimated,
        remixed_from_gif_id: isUuid(originalGif.id) ? originalGif.id : undefined,
        remixed_from_user_id: isUuid(originalGif.user_id) ? originalGif.user_id : undefined,
        remix_caption: caption,
        remix_style: style,
        remix_mood: mood,
        is_remix: true,
      });

      if (!remixed) throw new Error('Failed to create remix GIF record');

      if (postToFeed) {
        const post = await createPost(remixed.id, caption);
        if (!post) throw new Error('Failed to post to feed');
        toast({ title: 'Remix posted to feed!' });
        nav('/feed');
      } else {
        toast({ title: 'Remix saved privately!' });
        nav(`/profile`);
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error saving remix', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading...</div>;
  if (!originalGif) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-zinc-400 text-sm">Couldn't load this GIF for remix. Go back and try again.</p>
      <button onClick={() => nav(-1)} className="px-5 py-2.5 rounded-xl bg-fuchsia-600 text-white text-sm font-bold">Go Back</button>
    </div>
  );

  const originalCreatorName = (originalGif as any).original_profile?.display_name || (originalGif as any).original_profile?.username || 'Unknown';

  // ── Render preview element ──
  const renderPreview = () => {
    if (!previewMedia) return <div className="text-zinc-500 text-xs">No media</div>;

    // Replacement is a video
    if (previewMedia.source === 'replacement' && previewMedia.mode === 'video') {
      return (
        <video
          key={previewMedia.src}
          src={previewMedia.src}
          muted
          autoPlay
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      );
    }

    // Replacement is an image (PNG/JPEG/WebP/GIF)
    if (previewMedia.source === 'replacement' && previewMedia.mode === 'image') {
      return (
        <img
          key={previewMedia.src}
          src={previewMedia.src}
          alt="Remix preview"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => {
            toast({ title: "Couldn't preview replacement media. Using original GIF for now.", variant: 'destructive' });
            clearReplacement();
          }}
        />
      );
    }

    // Original GIF — use FwdMediaPlayer
    return (
      <FwdMediaPlayer
        mp4Url={previewMedia.mp4Url}
        webmUrl={previewMedia.webmUrl}
        gifUrl={previewMedia.gifUrl}
        posterUrl={previewMedia.posterUrl}
        isAnimated={previewMedia.isAnimated}
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  };

  const replIsVideo = replacement && isVideoMime(replacement.mimeType);

  return (
    <div className="min-h-screen pb-safe bg-black page-content flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => nav(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black tracking-wider text-white">REMIX STUDIO</h1>
          <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">Remix of @{originalCreatorName}</p>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-4 flex flex-col gap-5">
        
        {/* Preview Area */}
        <div className="relative rounded-3xl overflow-hidden border-2 border-fuchsia-500/40 glass-strong shadow-2xl shadow-fuchsia-900/20 w-full max-w-[300px] mx-auto aspect-[4/5] flex items-center justify-center bg-black">
          {renderPreview()}
          {/* Caption Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4 pointer-events-none">
             {caption && (
               <div className={`text-center mb-4 ${
                 style === 'Meme' ? 'font-black uppercase text-2xl text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000]' :
                 style === 'Neon' ? 'font-bold text-xl text-fuchsia-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]' :
                 'font-bold text-lg text-white drop-shadow-md'
               }`}>
                 {caption}
               </div>
             )}
          </div>
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-white/80 uppercase tracking-widest border border-white/20">
            {replacement ? 'Your media' : 'Remix preview'}
          </div>
        </div>

        {/* ── Replace Media Section ── */}
        <div className="rounded-2xl border border-fuchsia-500/30 glass p-3">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Replace Media</label>

          {uploadStatus === 'idle' && !replacement && (
            <div className="flex flex-col items-center gap-2 py-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-bold neon-glow-pink"
              >
                <UploadCloud size={16} /> Add / Replace Media
              </button>
              <p className="text-[10px] text-zinc-500">.gif · .mp4 · .webm · .png · .jpg · .webp — up to 25MB</p>
            </div>
          )}

          {uploadStatus === 'uploading' && (
            <div className="py-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Loader2 size={16} className="text-fuchsia-400 animate-spin" />
                <span className="text-white text-sm font-bold">Uploading…</span>
              </div>
              {replacement?.localUrl && (
                <div className="mx-auto mb-2 w-20 h-20 rounded-xl overflow-hidden border border-fuchsia-500/30">
                  {replIsVideo
                    ? <video src={replacement.localUrl} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                    : <img src={replacement.localUrl} className="w-full h-full object-cover" alt="uploading" />}
                </div>
              )}
              <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-[10px] text-zinc-400 text-center mt-1">{replacement?.file.name} — {uploadProgress}%</p>
            </div>
          )}

          {uploadStatus === 'success' && replacement && (
            <div className="py-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
                  <Check size={14} className="text-emerald-300" />
                </div>
                <span className="text-white text-sm font-bold">Replacement ready</span>
              </div>
              <div className="mx-auto mb-2 w-20 h-20 rounded-xl overflow-hidden border border-emerald-400/40">
                {replIsVideo
                  ? <video src={replacement.localUrl} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                  : <img src={replacement.localUrl} className="w-full h-full object-cover" alt="replacement" />}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                {replIsVideo ? <Film size={12} /> : <ImageIcon size={12} />}
                <span className="truncate max-w-[50%]">{replacement.file.name}</span>
                <button onClick={clearReplacement} className="ml-1 inline-flex items-center gap-1 text-fuchsia-300 hover:text-fuchsia-200">
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="py-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <span className="text-white text-sm font-bold">Upload failed</span>
              </div>
              <p className="text-rose-300 text-xs mb-2">{uploadError}</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-xl bg-fuchsia-600 text-white text-xs font-bold">Try again</button>
                <button onClick={clearReplacement} className="px-3 py-1.5 rounded-xl glass border border-white/10 text-xs text-zinc-300">Cancel</button>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} className="hidden" />
        </div>

        {/* Input area */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Caption Overlay</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add your spin..."
              className="w-full bg-zinc-900/50 border border-fuchsia-500/30 rounded-2xl p-4 text-white placeholder-zinc-500 focus:border-fuchsia-500 outline-none resize-none h-24 transition-colors"
            />
          </div>

          {/* AI Helper */}
          <div className="glass rounded-2xl border border-cyan-500/30 p-3">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-1.5 text-cyan-400">
                 <Sparkles size={14} />
                 <span className="text-[11px] font-bold uppercase tracking-widest">AI Ideas</span>
               </div>
               <button 
                onClick={generateIdeas} 
                disabled={aiLoading}
                className="text-[10px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-3 py-1.5 rounded-full font-bold transition flex items-center gap-1"
               >
                 <RefreshCw size={10} className={aiLoading ? 'animate-spin' : ''} />
                 Generate
               </button>
             </div>
             {aiIdeas.length > 0 ? (
               <div className="flex flex-col gap-2">
                 {aiIdeas.map((idea, i) => (
                   <button 
                    key={i} 
                    onClick={() => setCaption(idea)}
                    className="text-left text-sm text-zinc-300 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 transition"
                   >
                     {idea}
                   </button>
                 ))}
               </div>
             ) : (
               <p className="text-xs text-zinc-500 text-center py-2">Tap generate for creative ideas based on your mood.</p>
             )}
          </div>

          {/* Mood Selector */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Remix Mood</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {MOODS.map(m => (
                <button
                  key={m}
                  onClick={() => { setMood(m); setAiIdeas([]); }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    mood === m 
                      ? 'bg-fuchsia-500 border-fuchsia-400 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]' 
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:border-fuchsia-500/30'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Style Selector */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Text Style</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    style === s 
                      ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.5)]' 
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:border-cyan-500/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="relative p-4 bg-black/80 backdrop-blur-lg border-t border-white/10 flex gap-3">
        {uploadPending && (
          <p className="absolute -top-7 left-0 right-0 text-center text-[10px] text-amber-400 font-bold">Finish uploading media before saving your remix.</p>
        )}
        <button
          onClick={() => handleSave(false)}
          disabled={saving || !!uploadPending}
          className="flex-1 py-3.5 rounded-2xl glass border border-white/20 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition btn-press disabled:opacity-50"
        >
          <Save size={16} /> Save Private
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !user || !!uploadPending}
          className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-black neon-glow-pink flex items-center justify-center gap-2 btn-press disabled:opacity-50 animate-gradient-flow"
        >
          <Send size={16} /> Post to Feed
        </button>
      </div>
    </div>
  );
};

export default RemixStudio;
