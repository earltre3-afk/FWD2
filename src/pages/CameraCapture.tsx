import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RefreshCcw, Check, RotateCw, Camera as CameraIcon, Upload, Loader2, AlertTriangle } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

type Phase = 'requesting' | 'denied' | 'unsupported' | 'ready' | 'recording' | 'preview' | 'uploading';

const MAX_SECONDS = 5;
const BUCKET = 'fwd-uploads';

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  // VP8 first — VP9 produces black frames on several Chrome versions
  const candidates = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const CameraCapture: React.FC = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewBlobRef = useRef<Blob | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('requesting');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const attachLivePreview = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    const markReady = () => setPreviewReady(true);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markReady();
    void video.play().then(markReady).catch(() => {
      // Mobile browsers may resolve playback after metadata/canplay fires.
    });
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const clearStopTimeout = () => {
    if (stopTimeoutRef.current) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  };

  const revokePreview = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  };

  const startCamera = async (nextFacing: 'user' | 'environment') => {
    setPhase('requesting');
    setPreviewReady(false);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPhase('unsupported');
      return;
    }

    try {
      stopTracks();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('ready');
      window.requestAnimationFrame(attachLivePreview);
    } catch {
      setPhase('denied');
    }
  };

  useEffect(() => {
    startCamera(facing);
    return () => {
      clearStopTimeout();
      stopTracks();
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
    // Run once on mount; switching camera is handled by flipCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'ready' || phase === 'recording') {
      attachLivePreview();
    }
  }, [attachLivePreview, phase]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const interval = window.setInterval(() => {
      setSeconds((value) => Math.min(MAX_SECONDS, value + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  const flipCamera = async () => {
    if (phase === 'recording' || phase === 'uploading') return;
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    revokePreview();
    setPreviewUrl(null);
    previewBlobRef.current = null;
    await startCamera(next);
  };

  const startRecording = () => {
    if (!streamRef.current || phase !== 'ready') return;
    const mimeType = getSupportedMimeType();

    try {
      chunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        toast({ title: 'Recording failed', description: 'Try again or upload a clip instead.' });
        setPhase('ready');
      };

      recorder.onstop = () => {
        clearStopTimeout();
        const type = mimeType || chunksRef.current[0]?.type || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size === 0) {
          toast({ title: 'Recording captured nothing', description: 'Record for at least 1 second and try again.' });
          setPhase('ready');
          return;
        }
        previewBlobRef.current = blob;
        revokePreview();
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('preview');
      };

      setSeconds(0);
      recorder.start(100); // collect chunks every 100ms — prevents empty blob on stop
      setPhase('recording');
      stopTimeoutRef.current = window.setTimeout(() => stopRecording(), MAX_SECONDS * 1000);
    } catch {
      toast({ title: 'Camera recording is unavailable', description: 'Use Upload instead to create a GIF.' });
      setPhase('unsupported');
    }
  };

  const stopRecording = () => {
    clearStopTimeout();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const retake = async () => {
    clearStopTimeout();
    revokePreview();
    previewBlobRef.current = null;
    setPreviewUrl(null);
    setSeconds(0);
    await startCamera(facing);
  };

  const useClip = () => {
    const blob = previewBlobRef.current;
    if (!blob) return;
    if (!user) {
      toast({ title: 'Sign in required', description: 'Sign in to create GIFs from your clips.' });
      return;
    }
    // Pass the blob URL directly to /create — no premature Supabase upload.
    // CreateGif will fetch the blob, encode it to GIF, and upload only the final GIF.
    const url = URL.createObjectURL(blob);
    stopTracks();
    nav('/create', { state: { image: url, mediaType: blob.type || 'video/webm' } });
  };

  const cancel = () => {
    clearStopTimeout();
    stopTracks();
    revokePreview();
    nav(-1);
  };

  const handleUploadFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    nav('/create', { state: { image: objectUrl, mediaType: file.type } });
  };

  const deniedOrUnsupported = phase === 'denied' || phase === 'unsupported';

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pt-6">
        <button onClick={cancel} className="w-11 h-11 rounded-full glass-strong border border-white/15 flex items-center justify-center">
          <X size={20} />
        </button>
        <FwdLogo size="sm" />
        <button onClick={flipCamera} disabled={phase === 'recording' || phase === 'uploading'} className="flex flex-col items-center gap-1 disabled:opacity-40">
          <div className="w-11 h-11 rounded-full glass-strong border border-fuchsia-500/40 flex items-center justify-center">
            <RotateCw size={18} className="text-fuchsia-300" />
          </div>
          <span className="text-[10px] text-zinc-300 font-semibold">Flip</span>
        </button>
      </div>

      <div className="absolute inset-0">
        {phase === 'preview' && previewUrl ? (
          <video key={previewUrl} src={previewUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onCanPlay={() => {
              setPreviewReady(true);
              attachLivePreview();
            }}
            onPlaying={() => setPreviewReady(true)}
            className={`w-full h-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        )}
        {(phase === 'requesting' || phase === 'ready' || phase === 'recording') && !previewReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-semibold text-zinc-200">
            Starting camera...
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-4 w-10 h-10 border-l-2 border-t-2 border-fuchsia-500 rounded-tl-2xl" />
          <div className="absolute top-20 right-4 w-10 h-10 border-r-2 border-t-2 border-fuchsia-500 rounded-tr-2xl" />
          <div className="absolute bottom-44 left-4 w-10 h-10 border-l-2 border-b-2 border-fuchsia-500 rounded-bl-2xl" />
          <div className="absolute bottom-44 right-4 w-10 h-10 border-r-2 border-b-2 border-fuchsia-500 rounded-br-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
        </div>
      </div>

      {!deniedOrUnsupported && phase !== 'preview' && phase !== 'uploading' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20">
          <div className="glass-strong rounded-full px-4 py-1.5 border border-white/15 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${phase === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'}`} />
            <span className="text-white font-mono text-sm">00:0{seconds}</span>
            <span className="text-zinc-500 text-xs">/ 00:0{MAX_SECONDS}</span>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div className="absolute top-40 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          <button onClick={() => facing !== 'user' && flipCamera()} className={`px-3 py-1 rounded-full text-xs font-semibold border ${facing === 'user' ? 'bg-fuchsia-500/30 border-fuchsia-500 text-white' : 'glass border-white/15 text-zinc-300'}`}>Front</button>
          <button onClick={() => facing !== 'environment' && flipCamera()} className={`px-3 py-1 rounded-full text-xs font-semibold border ${facing === 'environment' ? 'bg-fuchsia-500/30 border-fuchsia-500 text-white' : 'glass border-white/15 text-zinc-300'}`}>Back</button>
        </div>
      )}

      {!deniedOrUnsupported && phase !== 'uploading' && (
        <div className="absolute bottom-44 left-0 right-0 z-20 text-center px-5">
          <h2 className="text-2xl font-black">
            {phase === 'recording' ? 'Capturing the vibe' : phase === 'preview' ? 'Use this clip?' : 'Record a reaction'}
          </h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            {phase === 'recording' ? 'Keep it short — up to 5 seconds.' : phase === 'preview' ? 'Turn this moment into a GIF.' : 'Capture the vibe.'}
          </p>
        </div>
      )}

      {phase === 'uploading' && (
        <div className="absolute inset-0 z-30 bg-black/70 flex flex-col items-center justify-center p-8 text-center">
          <Loader2 size={34} className="text-fuchsia-300 animate-spin mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Uploading your clip…</h3>
          <p className="text-zinc-400 max-w-sm">FWD is saving this reaction to your vault.</p>
        </div>
      )}

      {deniedOrUnsupported && (
        <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center p-8 text-center">
          <FwdLogo size="md" />
          <div className="w-16 h-16 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center my-6">
            {phase === 'unsupported' ? <AlertTriangle size={28} className="text-fuchsia-400" /> : <CameraIcon size={28} className="text-fuchsia-400" />}
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {phase === 'unsupported' ? 'Camera recording is unavailable.' : 'Camera access is off.'}
          </h3>
          <p className="text-zinc-400 mb-6 max-w-sm">
            {phase === 'unsupported' ? 'This browser cannot record camera clips here. Upload a clip instead.' : 'Enable it to record a quick GIF. You can also upload from your gallery instead.'}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {phase !== 'unsupported' && (
              <button onClick={() => startCamera(facing)}
                className="py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 font-bold neon-glow-purple">
                Try Again
              </button>
            )}
            <button onClick={() => fileRef.current?.click()}
              className="py-3 rounded-xl glass-strong border border-fuchsia-500/40 font-bold flex items-center justify-center gap-2">
              <Upload size={16} /> Upload instead
            </button>
            <button onClick={cancel} className="py-2 text-zinc-400 text-sm">Cancel</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleUploadFallback} className="hidden" />
        </div>
      )}

      {!deniedOrUnsupported && phase !== 'uploading' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-10">
          <div className="flex items-end justify-between max-w-md mx-auto">
            <button onClick={retake} className={`flex flex-col items-center gap-1.5 ${phase !== 'preview' && 'opacity-40 pointer-events-none'}`}>
              <div className="w-14 h-14 rounded-2xl glass-strong border border-white/15 flex items-center justify-center">
                <RefreshCcw size={22} className="text-white" />
              </div>
              <span className="text-xs text-zinc-300 font-semibold">Retake</span>
            </button>

            {phase === 'preview' ? (
              <button onClick={useClip} disabled={uploading} className="w-20 h-20 rounded-full bg-gradient-to-br from-fuchsia-600 to-pink-500 neon-glow-pink flex items-center justify-center animate-pulse-glow disabled:opacity-60">
                <Check size={32} className="text-white" strokeWidth={3} />
              </button>
            ) : phase === 'recording' ? (
              <button onClick={stopRecording} className="w-20 h-20 rounded-full border-4 border-fuchsia-500 flex items-center justify-center animate-pulse-glow">
                <div className="w-8 h-8 bg-red-500 rounded-md neon-glow-pink" />
              </button>
            ) : (
              <button onClick={startRecording} disabled={phase !== 'ready'} className="w-20 h-20 rounded-full border-4 border-fuchsia-500 flex items-center justify-center animate-pulse-glow disabled:opacity-50">
                <div className="w-14 h-14 bg-pink-500 rounded-full neon-glow-pink" />
              </button>
            )}

            <button onClick={useClip} className={`flex flex-col items-center gap-1.5 ${phase !== 'preview' && 'opacity-40 pointer-events-none'}`}>
              <div className="w-14 h-14 rounded-2xl glass-strong border border-fuchsia-500/40 flex items-center justify-center">
                <Check size={22} className="text-fuchsia-300" />
              </div>
              <span className="text-xs text-zinc-300 font-semibold">Use Clip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
