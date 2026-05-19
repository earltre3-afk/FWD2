import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, Loader2, Check, AlertTriangle, Image as ImageIcon, Film, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Status = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface Props {
  onUploaded: (publicUrl: string, file: File) => void;
  currentPreview?: string;
}

const ACCEPT = '.gif,.mp4,.webm,.png,.jpg,.jpeg,image/gif,image/png,image/jpeg,video/mp4,video/webm';
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

const UploadDropzone: React.FC<Props> = ({ onUploaded, currentPreview }) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; type: string; size: number } | null>(null);

  React.useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const reset = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setStatus('idle'); setProgress(0); setErrorMsg(''); setLocalPreview(null); setFileMeta(null);
  };

  const upload = useCallback(async (file: File) => {
    setErrorMsg('');
    if (!user) { setStatus('error'); setErrorMsg('Sign in to upload to your vault.'); return; }
    if (file.size > MAX_BYTES) { setStatus('error'); setErrorMsg('File is over 25MB. Try a shorter clip.'); return; }
    const allowed = ['image/gif', 'image/png', 'image/jpeg', 'video/mp4', 'video/webm'];
    if (!allowed.includes(file.type)) { setStatus('error'); setErrorMsg('Use .gif, .mp4, .webm, .png or .jpg'); return; }

    setFileMeta({ name: file.name, type: file.type, size: file.size });
    setLocalPreview(URL.createObjectURL(file));
    setStatus('uploading'); setProgress(8);

    // Simulated smooth progress while supabase uploads (the JS client doesn't expose granular progress)
    let tick = 8;
    const interval = setInterval(() => {
      tick = Math.min(88, tick + Math.random() * 10);
      setProgress(Math.round(tick));
    }, 220);

    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    try {
      // Upload to the PUBLIC fwd-gifs bucket. fwd-uploads is private and
      // getPublicUrl() against a private bucket returns a URL that 400s,
      // which previously left users staring at a broken preview.
      const { error: upErr } = await supabase.storage.from('fwd-gifs').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      clearInterval(interval);
      if (upErr) throw upErr;
      setProgress(94); setStatus('processing');
      // Small delay so the "Processing" state is visible — feels real
      await new Promise(r => setTimeout(r, 400));
      const { data } = supabase.storage.from('fwd-gifs').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('No public URL');
      setProgress(100); setStatus('success');
      onUploaded(data.publicUrl, file);
    } catch (e: any) {
      clearInterval(interval);
      setStatus('error');
      setErrorMsg(e?.message || 'Upload failed. Please try again.');
    }
  }, [user, onUploaded]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const isVideo = fileMeta?.type.startsWith('video/');

  return (
    <div className="mb-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
          dragOver
            ? 'border-fuchsia-400 bg-fuchsia-500/10 neon-glow-purple'
            : 'border-fuchsia-500/30 bg-black/30 hover:border-fuchsia-500/60'
        }`}
      >
        {/* Animated neon backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(217,70,239,0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(34,211,238,0.12), transparent 40%)',
          }}
        />
        <div className="relative p-5 sm:p-7 flex flex-col items-center text-center">
          {status === 'idle' && (
            <>
              <div className="w-14 h-14 rounded-2xl glass-strong border border-fuchsia-500/40 flex items-center justify-center mb-3 neon-glow-purple">
                <UploadCloud size={26} className="text-fuchsia-300" />
              </div>
              <p className="text-white font-black tracking-wide text-base sm:text-lg">Drop your GIF or clip here</p>
              <p className="text-zinc-400 text-xs mt-1">.gif · .mp4 · .webm · .png · .jpg — up to 25MB</p>

              <div className="grid grid-cols-2 gap-2 mt-4 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-bold neon-glow-pink"
                >
                  Upload a reaction
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl glass border border-cyan-500/40 text-cyan-300 text-sm font-bold"
                >
                  Browse files
                </button>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-3">
                Turn this into a FWD
              </p>
            </>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Loader2 size={18} className="text-fuchsia-400 animate-spin" />
                <span className="text-white font-bold">
                  {status === 'uploading' ? 'Uploading…' : 'Processing your FWD…'}
                </span>
              </div>
              {localPreview && (
                <div className="mx-auto mb-3 w-24 h-24 rounded-xl overflow-hidden border border-fuchsia-500/30">
                  {isVideo
                    ? <video src={localPreview} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                    : <img src={localPreview} className="w-full h-full object-cover" />}
                </div>
              )}
              <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 transition-all"
                  style={{ width: `${progress}%`, boxShadow: '0 0 14px rgba(217,70,239,0.7)' }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-zinc-400">
                <span className="truncate max-w-[60%]">{fileMeta?.name}</span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
                  <Check size={16} className="text-emerald-300" />
                </div>
                <span className="text-white font-bold">Saved to your vault</span>
              </div>
              {localPreview && (
                <div className="mx-auto mb-3 w-28 h-28 rounded-xl overflow-hidden border border-emerald-400/40 neon-glow-purple">
                  {isVideo
                    ? <video src={localPreview} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                    : <img src={localPreview} className="w-full h-full object-cover" />}
                </div>
              )}
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                {isVideo ? <Film size={12} /> : <ImageIcon size={12} />}
                <span className="truncate max-w-[60%]">{fileMeta?.name}</span>
                <button onClick={reset} className="ml-2 inline-flex items-center gap-1 text-fuchsia-300 hover:text-fuchsia-200">
                  <X size={12} /> Replace
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-rose-300" />
                </div>
                <span className="text-white font-bold">Upload failed</span>
              </div>
              <p className="text-rose-300 text-xs mb-3">{errorMsg || 'Something went wrong. Please try again.'}</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => inputRef.current?.click()} className="px-4 py-2 rounded-xl bg-fuchsia-600 text-white text-sm font-bold">Try again</button>
                <button onClick={reset} className="px-4 py-2 rounded-xl glass border border-white/10 text-sm text-zinc-300">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
      </div>

      {currentPreview && status === 'idle' && (
        <p className="text-[11px] text-zinc-500 mt-2 text-center">
          Currently using a sample preview. Upload to make it yours.
        </p>
      )}
    </div>
  );
};

export default UploadDropzone;
