import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Scissors, Crop, Type, Smile, Gauge, Aperture, Camera, Play,
  X, ChevronDown, Globe, Lock, ChevronsRight, Loader2, Check, Upload,
  Share2, Bookmark, RefreshCw, Sparkles, RotateCw,
} from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import UploadDropzone from '@/components/UploadDropzone';
import { CATEGORIES, MOODS } from '@/data/gifs';
import { useAppContext, Gif } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import FwdAnimatedGif from '@/components/FwdAnimatedGif';
import { categorizeGif, GifCategorization } from '@/lib/aiCategorizer';
import NotificationBell from '@/components/NotificationBell';
import {
  DEFAULT_MEDIA_EDIT_STATE,
  MAX_GIF_DURATION_SECONDS,
  buildEditMetadata,
  centeredCropForRatio,
  clampTrim,
  formatDuration,
  ratioToNumber,
  type MediaEditState,
} from '@/lib/mediaEdits';

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

type CreationState =
  | 'idle' | 'camera_ready' | 'recording' | 'processing' | 'preview' | 'file_selected' | 'editing'
  | 'generating' | 'uploading' | 'saved' | 'posted' | 'error';

const MAX_RECORD_SECONDS = MAX_GIF_DURATION_SECONDS;

const extensionForMime = (type: string) => {
  const clean = type.toLowerCase();
  if (clean.includes('mp4')) return 'mp4';
  if (clean.includes('quicktime') || clean.includes('mov')) return 'mov';
  if (clean.includes('webm')) return 'webm';
  if (clean.includes('gif')) return 'gif';
  return 'bin';
};

const getRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  // VP8 first — VP9 produces black frames on several Chrome versions
  return ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const CreateGif: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const { createUserGif, createPost } = useAppContext();
  const { user } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const state = (loc.state as any) || {};
  const queryMediaUrl = searchParams.get('mediaUrl') || '';
  const queryMediaType = searchParams.get('type') || '';
  const initialImage = queryMediaUrl || state.image || '';
  const initialMediaType = state.mediaType || (queryMediaType === 'camera' ? 'video/webm' : '');

  const [tool, setTool] = useState('trim');
  const [title, setTitle] = useState(state.title || '');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>(
    Array.isArray(state.tags) && state.tags.length ? state.tags.slice(0, 8) : []
  );
  const [tagInput, setTagInput] = useState('');
  const [category, setCategory] = useState('Reactions');
  const [mood, setMood] = useState('Cool');
  const [isPublic, setIsPublic] = useState(true);
  const [allowReuse, setAllowReuse] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState('None');
  const [textOverlay, setTextOverlay] = useState('');
  const [stickerOverlay, setStickerOverlay] = useState<string | null>(null);
  const [editState, setEditState] = useState<MediaEditState>(() => ({
    ...DEFAULT_MEDIA_EDIT_STATE,
    trimStart: Number(state.trim_start ?? state.edit_metadata?.trimStart ?? 0),
    trimEnd: Number(state.trim_end ?? state.edit_metadata?.trimEnd ?? DEFAULT_MEDIA_EDIT_STATE.trimEnd),
    duration: Number(state.original_duration ?? state.edit_metadata?.duration ?? 0),
    cropX: Number(state.crop_x ?? state.edit_metadata?.cropX ?? DEFAULT_MEDIA_EDIT_STATE.cropX),
    cropY: Number(state.crop_y ?? state.edit_metadata?.cropY ?? DEFAULT_MEDIA_EDIT_STATE.cropY),
    cropWidth: Number(state.crop_width ?? state.edit_metadata?.cropWidth ?? DEFAULT_MEDIA_EDIT_STATE.cropWidth),
    cropHeight: Number(state.crop_height ?? state.edit_metadata?.cropHeight ?? DEFAULT_MEDIA_EDIT_STATE.cropHeight),
    cropAspectRatio: state.crop_aspect_ratio ?? state.edit_metadata?.cropAspectRatio ?? null,
    outputAspectRatio: state.output_aspect_ratio ?? state.edit_metadata?.outputAspectRatio ?? null,
    speed: Number(state.speed ?? state.edit_metadata?.speed ?? 1),
  }));
  const [mediaSize, setMediaSize] = useState({ width: 1, height: 1 });
  const [previewUrl, setPreviewUrl] = useState(initialImage);
  const [previewNonce, setPreviewNonce] = useState(() => Date.now());
  const [mediaType, setMediaType] = useState(initialMediaType);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFromVault, setUploadedFromVault] = useState(Boolean(queryMediaUrl));
  const [creationState, setCreationState] = useState<CreationState>(
    queryMediaUrl || state.image ? 'file_selected' : 'idle'
  );
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [savedGif, setSavedGif] = useState<Gif | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState('');
  const [aiApplied, setAiApplied] = useState(false);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const selectedDuration = Math.max(0, editState.trimEnd - editState.trimStart);
  const previewAspectRatio = ratioToNumber(editState.outputAspectRatio);
  const isVideo = mediaType?.startsWith('video/') || uploadedFile?.type?.startsWith('video/');

  const attachCameraStream = useCallback(() => {
    const video = cameraVideoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    const markReady = () => setCameraPreviewReady(true);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markReady();
    void video.play().then(markReady).catch(() => {
      // Some mobile browsers wait for the metadata event before play resolves.
    });
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraPreviewReady(false);
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }, []);

  // Auto-start camera when page loads with no incoming media
  useEffect(() => {
    if (!initialImage) startCamera('user');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    stopCamera();
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl, stopCamera]);

  useEffect(() => {
    if (creationState === 'camera_ready' || creationState === 'recording') {
      attachCameraStream();
    }
  }, [attachCameraStream, creationState]);

  useEffect(() => {
    if (creationState !== 'recording') return;
    const interval = window.setInterval(() => {
      setRecordSeconds((value) => Math.min(MAX_RECORD_SECONDS, value + 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [creationState]);

  useEffect(() => {
    if (!previewUrl || !isVideo) return;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = previewUrl;
    const applyMetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(video.duration, MAX_RECORD_SECONDS)
        : MAX_RECORD_SECONDS;
      setMediaSize({
        width: video.videoWidth || 1,
        height: video.videoHeight || 1,
      });
      setEditState((current) => {
        const baseEnd = current.trimEnd > 0 ? current.trimEnd : Math.min(duration, MAX_RECORD_SECONDS);
        const nextTrim = clampTrim(current.trimStart, baseEnd, duration);
        return {
          ...current,
          duration,
          trimStart: nextTrim.trimStart,
          trimEnd: nextTrim.trimEnd,
        };
      });
    };
    video.addEventListener('loadedmetadata', applyMetadata);
    video.addEventListener('loadeddata', applyMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', applyMetadata);
      video.removeEventListener('loadeddata', applyMetadata);
      video.removeAttribute('src');
      video.load();
    };
  }, [previewUrl, isVideo]);

  const updateTrimStart = (value: number) => {
    setTool('trim');
    setEditState((current) => {
      const next = clampTrim(value, current.trimEnd, current.duration || MAX_RECORD_SECONDS);
      return { ...current, trimStart: next.trimStart, trimEnd: next.trimEnd };
    });
  };

  const updateTrimEnd = (value: number) => {
    setTool('trim');
    setEditState((current) => {
      const next = clampTrim(current.trimStart, value, current.duration || MAX_RECORD_SECONDS);
      return { ...current, trimStart: next.trimStart, trimEnd: next.trimEnd };
    });
  };

  const applyCropRatio = (ratio: string | null) => {
    setTool('crop');
    const crop = centeredCropForRatio(ratio, mediaSize.width, mediaSize.height);
    setEditState((current) => ({ ...current, ...crop }));
  };

  const startCamera = async (nextFacing: 'user' | 'environment' = facing) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setCreationState('error');
      setErrorMsg('This browser cannot record video here. Upload a clip instead.');
      return;
    }
    try {
      stopCamera();
      setCameraPreviewReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      streamRef.current = stream;
      setFacing(nextFacing);
      setCreationState('camera_ready');
      window.requestAnimationFrame(attachCameraStream);
      setErrorMsg('');
    } catch {
      setCreationState('error');
      setErrorMsg('Camera access is off. Enable it or upload a clip from your device.');
    }
  };

  const flipCamera = () => {
    if (creationState === 'recording') return;
    startCamera(facing === 'user' ? 'environment' : 'user');
  };

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const startRecording = () => {
    if (!streamRef.current || creationState !== 'camera_ready') return;
    try {
      chunksRef.current = [];
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopCamera();
        setCreationState('error');
        setErrorMsg('Recording failed. Try again or upload a clip.');
      };
      recorder.onstop = () => {
        // Stop camera tracks first so the stream is released
        stopCamera();

        const type = mimeType || chunksRef.current[0]?.type || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });

        if (blob.size === 0) {
          setCreationState('error');
          setErrorMsg('Recording captured no data. Tap Try Again and record for at least 1 second.');
          return;
        }

        const file = new File([blob], `recorded-fwd-${Date.now()}.webm`, { type });
        const url = URL.createObjectURL(blob);
        setUploadedFile(file);
        setMediaType(type);
        setUploadedFromVault(true);
        setEditState((current) => ({
          ...current,
          trimStart: 0,
          trimEnd: MAX_RECORD_SECONDS,
          duration: MAX_RECORD_SECONDS,
        }));
        if (!title.trim()) setTitle('My FWD');
        setPreviewUrl(url);
        setPreviewNonce(Date.now());
        setCreationState('preview');
      };
      setRecordSeconds(0);
      recorder.start(100); // collect a chunk every 100ms — prevents empty blobs on stop
      setCreationState('recording');
      stopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORD_SECONDS * 1000);
    } catch {
      setCreationState('error');
      setErrorMsg('Recording failed. Try again or upload a clip.');
    }
  };

  const resetToBlankRecorder = () => {
    stopCamera();
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setUploadedFile(null);
    setMediaType('');
    setTitle('');
    setCaption('');
    setTags([]);
    setMood('Cool');
    setCategory('Reactions');
    setRecordSeconds(0);
    setEditState(DEFAULT_MEDIA_EDIT_STATE);
    setMediaSize({ width: 1, height: 1 });
    setAiApplied(false);
    setAiHint('');
    setCreationState('idle');
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagInput('');
  };

  const applyAiMetadata = useCallback((metadata: GifCategorization, forceTitle = false) => {
    if (metadata.title && (forceTitle || !title.trim() || title === 'My FWD')) setTitle(metadata.title);
    if (metadata.category) setCategory(metadata.category);
    if (metadata.mood) setMood(metadata.mood);
    setTags(prev => Array.from(new Set([...(metadata.tags || []), ...prev])).slice(0, 10));
    if (metadata.caption && !caption.trim()) setCaption(metadata.caption);
    setAiApplied(true);
    setAiHint(`${metadata.category} · ${metadata.mood} · ${Math.round(metadata.confidence * 100)}% match`);
  }, [caption, title]);

  const suggestMetadata = useCallback(async (sourceOverride?: string, forceTitle = false) => {
    setAiBusy(true);
    setAiHint('');
    try {
      const metadata = await categorizeGif({
        title,
        caption,
        tags,
        category,
        mood,
        sourceUrl: sourceOverride || (previewUrl?.startsWith('http') ? previewUrl : ''),
      });
      applyAiMetadata(metadata, forceTitle);
      return metadata;
    } catch {
      return null;
    } finally {
      setAiBusy(false);
    }
  }, [applyAiMetadata, caption, category, mood, previewUrl, tags, title]);

  const handleUploaded = useCallback((publicUrl: string, file: File) => {
    setPreviewUrl(publicUrl);
    setPreviewNonce(Date.now());
    setMediaType(file.type);
    setUploadedFile(file);
    setUploadedFromVault(true);
    setCreationState('file_selected');
    setEditState((current) => ({
      ...current,
      trimStart: 0,
      trimEnd: file.type.startsWith('video/') ? MAX_RECORD_SECONDS : 0,
      duration: 0,
    }));
    setAiApplied(false);
    setAiHint('');
    if (!title.trim()) {
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 60);
      if (base) setTitle(base);
    }
    if (publicUrl.startsWith('http')) {
      window.setTimeout(() => {
        suggestMetadata(publicUrl).then((metadata) => {
          if (metadata) toast({ title: 'AI categorized this FWD', description: `${metadata.category} · ${metadata.mood}` });
        });
      }, 0);
    }
  }, [suggestMetadata, title]);

  const handleDirectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    handleUploaded(url, file);
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

  const create = async () => {
    if (!previewUrl) {
      toast({ title: 'Record a FWD first', description: 'Record up to 10 seconds or upload a clip.' });
      return;
    }
    if (!user) {
      toast({ title: 'Sign in required', description: 'Sign in to save GIFs to your library.', variant: 'destructive' });
      return;
    }

    setCreationState('generating');
    setProgress(0);
    setErrorMsg('');

    let gifBlob: Blob | null = null;
    let gifUrl = previewUrl;
    let sourceVideoUrl: string | undefined;
    let isAnimated = true;
    const stamp = Date.now();
    const finalEditMetadata = buildEditMetadata(editState);

    try {
      // If we came from the camera page via router state, uploadedFile is null
      // but previewUrl is a local blob URL — fetch it to get the File object.
      let effectiveFile = uploadedFile;
      if (!effectiveFile && isVideo && previewUrl?.startsWith('blob:')) {
        setProgress(2);
        const resp = await fetch(previewUrl);
        if (!resp.ok) throw new Error('Could not load your recording. Try again.');
        const blob = await resp.blob();
        const type = mediaType || blob.type || 'video/webm';
        const ext = extensionForMime(type);
        effectiveFile = new File([blob], `clip-${Date.now()}.${ext}`, { type });
      }

      // Decide encoding path
      if (effectiveFile) {
        if (effectiveFile.type === 'image/gif') {
          // Already a GIF — upload directly
          gifBlob = effectiveFile;
        } else if (effectiveFile.type.startsWith('video/')) {
          // Video → encode to GIF
          setProgress(5);
          const { videoFileToGif, assertGifBlob } = await import('@/lib/gifEncoder');
          gifBlob = await videoFileToGif(effectiveFile, {
            width: 360,
            height: 360,
            fps: 10,
            startSec: finalEditMetadata.trimStart,
            endSec: Math.min(finalEditMetadata.trimEnd || MAX_RECORD_SECONDS, (finalEditMetadata.trimStart || 0) + MAX_RECORD_SECONDS),
            cropX: finalEditMetadata.cropX,
            cropY: finalEditMetadata.cropY,
            cropWidth: finalEditMetadata.cropWidth,
            cropHeight: finalEditMetadata.cropHeight,
            onProgress: (pct) => setProgress(5 + Math.round(pct * 0.7)),
          });
          await assertGifBlob(gifBlob, { requireAnimation: true });
          const generatedPreview = URL.createObjectURL(gifBlob);
          setPreviewUrl(generatedPreview);
          setPreviewNonce(stamp);
          setMediaType('image/gif');
        } else if (effectiveFile.type.startsWith('image/')) {
          // Static image → single-frame GIF
          const { imageFileToGif } = await import('@/lib/gifEncoder');
          gifBlob = await imageFileToGif(effectiveFile, { width: 320, height: 320 });
          isAnimated = false;
        }
      }

      // Upload to Supabase storage
      if (gifBlob) {
        setCreationState('uploading');
        setProgress(78);
        if (effectiveFile?.type.startsWith('video/')) {
          const sourceExt = extensionForMime(effectiveFile.type);
          const sourcePath = `${user.id}/source-${stamp}.${sourceExt}`;
          const { data: sourceData } = await supabase.storage
            .from('fwd-gifs')
            .upload(sourcePath, effectiveFile, {
              contentType: effectiveFile.type || 'video/mp4',
              cacheControl: '3600',
              upsert: false,
            });
          if (sourceData?.path) {
            const { data: sourceUrlData } = supabase.storage.from('fwd-gifs').getPublicUrl(sourceData.path);
            sourceVideoUrl = sourceUrlData.publicUrl;
          }
        }
        const path = `${user.id}/${stamp}.gif`;
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('fwd-gifs')
          .upload(path, gifBlob, { contentType: 'image/gif', cacheControl: '60', upsert: false });

        if (storageErr) throw new Error('Upload failed. Try again.');

        const { data: publicUrlData } = supabase.storage.from('fwd-gifs').getPublicUrl(storageData.path);
        gifUrl = publicUrlData.publicUrl;
        setPreviewUrl(gifUrl);
        setPreviewNonce(stamp);
        setProgress(90);
      }

      if (gifUrl.startsWith('blob:')) {
        throw new Error('Upload succeeded but preview URL failed. Try again.');
      }

      const aiMetadata = !aiApplied && gifUrl.startsWith('http')
        ? await suggestMetadata(gifUrl)
        : null;
      const finalTitle = (aiMetadata?.title || title).trim() || 'My FWD';
      const finalCaption = (aiMetadata?.caption || caption).trim();
      const finalTags = Array.from(new Set([...(aiMetadata?.tags || []), ...tags])).slice(0, 10);
      const finalCategory = aiMetadata?.category || category;
      const finalMood = aiMetadata?.mood || mood;

      // Save to fwd_gifs
      const created = await createUserGif({
        title: finalTitle,
        image: gifUrl,
        caption: finalCaption || undefined,
        tags: finalTags,
        category: finalCategory,
        mood: finalMood,
        isPublic,
        allow_reuse: allowReuse,
        allow_download: allowDownload,
        source_type: gifBlob ? (uploadedFile?.type === 'image/gif' ? 'uploaded' : 'created') : 'external',
        file_size_bytes: gifBlob?.size,
        source_video_url: sourceVideoUrl,
        media_type: 'image/gif',
        is_animated: isAnimated,
        trim_start: finalEditMetadata.trimStart,
        trim_end: finalEditMetadata.trimEnd,
        original_duration: finalEditMetadata.originalDuration,
        edited_duration: finalEditMetadata.editedDuration,
        crop_x: finalEditMetadata.cropX,
        crop_y: finalEditMetadata.cropY,
        crop_width: finalEditMetadata.cropWidth,
        crop_height: finalEditMetadata.cropHeight,
        crop_aspect_ratio: finalEditMetadata.cropAspectRatio,
        output_aspect_ratio: finalEditMetadata.outputAspectRatio,
        edit_metadata: finalEditMetadata,
      });

      setProgress(100);

      if (created) {
        setSavedGif(created);
        setCreationState('saved');
        toast({ title: 'GIF created', description: `"${finalTitle}" saved to your library.` });
      } else {
        throw new Error('Could not save GIF to your library.');
      }
    } catch (err: any) {
      setCreationState('error');
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
      toast({ title: 'Creation failed', description: err?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const postToFeed = async () => {
    if (!savedGif) return;
    setCreationState('uploading');
    const post = await createPost(savedGif.id, caption);
    if (post) {
      setCreationState('posted');
      toast({ title: 'Posted to feed', description: 'Your GIF is live on the FWD feed.' });
      setTimeout(() => nav('/feed'), 800);
    } else {
      toast({ title: 'Post failed', description: 'Could not post to feed. Try again.', variant: 'destructive' });
      setCreationState('saved');
    }
  };

  // --- Saved / Posted state UI ---
  if (creationState === 'saved' || creationState === 'posted') {
    return (
      <div className="min-h-screen pb-10 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md glass-strong rounded-3xl border border-fuchsia-500/40 neon-glow-purple p-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-fuchsia-500/10 border border-fuchsia-500/40 flex items-center justify-center mb-4">
            <Check size={28} className="text-fuchsia-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">GIF Created!</h2>
          <p className="text-zinc-400 text-sm mb-5">"{savedGif?.title || title || 'Your FWD'}" is ready to forward.</p>

          {savedGif && (
            <div className="rounded-2xl overflow-hidden border border-fuchsia-500/30 aspect-square max-w-[220px] mx-auto mb-6">
              <FwdAnimatedGif
                gifUrl={savedGif.image}
                stillUrl={savedGif.still_url}
                sourceVideoUrl={savedGif.source_video_url}
                mediaType={savedGif.media_type}
                isAnimated={savedGif.is_animated}
                mp4Url={savedGif.mp4_url}
                webmUrl={savedGif.webm_url}
                editMetadata={savedGif.edit_metadata}
                trimStart={savedGif.trim_start}
                trimEnd={savedGif.trim_end}
                cropX={savedGif.crop_x}
                cropY={savedGif.crop_y}
                cropWidth={savedGif.crop_width}
                cropHeight={savedGif.crop_height}
                cropAspectRatio={savedGif.crop_aspect_ratio}
                outputAspectRatio={savedGif.output_aspect_ratio}
                title={savedGif.title}
                className="w-full h-full object-contain bg-black/60"
                lazy={false}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={postToFeed}
              disabled={creationState === 'posted'}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-bold neon-glow-pink disabled:opacity-60"
            >
              <Share2 size={16} /> Post to Feed
            </button>
            <button
              onClick={() => nav('/profile')}
              className="flex items-center justify-center gap-2 py-3 rounded-xl glass border border-fuchsia-500/30 text-white font-semibold"
            >
              <Bookmark size={16} /> My Library
            </button>
          </div>
          <button
            onClick={() => {
              setCreationState('idle');
      resetToBlankRecorder();
      setSavedGif(null);
            }}
            className="w-full py-3 rounded-xl glass border border-white/10 text-zinc-300 font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw size={15} /> Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <NotificationBell />
        </div>

        <div className="text-center mb-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-widest">Record a FWD</h1>
          <p className="text-zinc-400 text-sm sm:text-base">Record up to 10 seconds and turn your moment into a FWD.</p>
        </div>

        {!previewUrl && (
          <div className="relative rounded-3xl overflow-hidden mb-5 bg-black aspect-[9/16] sm:aspect-video">
            {/* Live video — only mounted when camera is active so ref is valid on attach */}
            {(creationState === 'camera_ready' || creationState === 'recording') && (
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                onCanPlay={() => { setCameraPreviewReady(true); attachCameraStream(); }}
                onPlaying={() => setCameraPreviewReady(true)}
                className={`absolute inset-0 w-full h-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            )}

            {/* gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

            {/* corner brackets */}
            <div className="absolute top-4 left-4 w-10 h-10 border-l-2 border-t-2 border-fuchsia-500 rounded-tl-2xl pointer-events-none" />
            <div className="absolute top-4 right-4 w-10 h-10 border-r-2 border-t-2 border-fuchsia-500 rounded-tr-2xl pointer-events-none" />
            <div className="absolute bottom-28 left-4 w-10 h-10 border-l-2 border-b-2 border-fuchsia-500 rounded-bl-2xl pointer-events-none" />
            <div className="absolute bottom-28 right-4 w-10 h-10 border-r-2 border-b-2 border-fuchsia-500 rounded-br-2xl pointer-events-none" />

            {/* Loading spinner */}
            {!cameraPreviewReady && (creationState === 'camera_ready' || creationState === 'recording') && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                <Loader2 size={32} className="animate-spin text-fuchsia-400" />
              </div>
            )}

            {/* Idle / error placeholder */}
            {(creationState === 'idle' || creationState === 'error') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center mb-4">
                  <Camera size={28} className="text-fuchsia-300" />
                </div>
                {creationState === 'error'
                  ? <p className="text-zinc-400 text-sm mb-4">{errorMsg}</p>
                  : <p className="text-zinc-400 text-sm mb-4">Starting camera…</p>
                }
                <button onClick={() => startCamera(facing)} className="px-5 py-2.5 rounded-xl bg-fuchsia-600 text-white font-bold text-sm">
                  {creationState === 'error' ? 'Try Again' : 'Enable Camera'}
                </button>
              </div>
            )}

            {/* Front / Back toggle */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              <button onClick={() => facing !== 'user' && flipCamera()}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${facing === 'user' ? 'bg-fuchsia-500/30 border-fuchsia-500 text-white' : 'glass border-white/15 text-zinc-300'}`}>
                Front
              </button>
              <button onClick={() => facing !== 'environment' && flipCamera()}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${facing === 'environment' ? 'bg-fuchsia-500/30 border-fuchsia-500 text-white' : 'glass border-white/15 text-zinc-300'}`}>
                Back
              </button>
            </div>

            {/* Flip — top right */}
            <button onClick={flipCamera} disabled={creationState === 'recording'}
              className="absolute top-14 right-4 z-20 flex flex-col items-center gap-1 disabled:opacity-40">
              <div className="w-11 h-11 rounded-full glass-strong border border-fuchsia-500/40 flex items-center justify-center">
                <RotateCw size={18} className="text-fuchsia-300" />
              </div>
              <span className="text-[10px] text-zinc-300 font-semibold">Flip</span>
            </button>

            {/* Upload — top left */}
            <button onClick={() => fileInputRef.current?.click()}
              className="absolute top-14 left-4 z-20 flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full glass-strong border border-white/15 flex items-center justify-center">
                <Upload size={18} className="text-zinc-300" />
              </div>
              <span className="text-[10px] text-zinc-300 font-semibold">Upload</span>
            </button>

            {/* Timer */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
              <div className="glass-strong rounded-full px-4 py-1.5 border border-white/15 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${creationState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'}`} />
                <span className="text-white font-mono text-sm">00:{String(recordSeconds).padStart(2, '0')}</span>
                <span className="text-zinc-500 text-xs">/ 00:{String(MAX_RECORD_SECONDS).padStart(2, '0')}</span>
              </div>
            </div>

            {/* Label */}
            <div className="absolute inset-x-0 bottom-28 text-center z-20 pointer-events-none">
              <h2 className="text-2xl font-black text-white drop-shadow-lg">
                {creationState === 'recording' ? 'Capturing the vibe' : 'Record a reaction'}
              </h2>
              <p className="text-zinc-300 text-sm mt-0.5 drop-shadow">
                {creationState === 'recording' ? 'Up to 10 seconds.' : 'Capture the vibe.'}
              </p>
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-0 inset-x-0 z-20 p-5">
              <div className="flex items-end justify-between max-w-xs mx-auto">
                <div className="w-14 h-14" />
                {creationState === 'recording' ? (
                  <button onClick={stopRecording}
                    className="w-20 h-20 rounded-full border-4 border-fuchsia-500 flex items-center justify-center animate-pulse-glow">
                    <div className="w-8 h-8 bg-red-500 rounded-md neon-glow-pink" />
                  </button>
                ) : (
                  <button onClick={startRecording} disabled={creationState !== 'camera_ready'}
                    className="w-20 h-20 rounded-full border-4 border-fuchsia-500 flex items-center justify-center animate-pulse-glow disabled:opacity-40">
                    <div className="w-14 h-14 bg-pink-500 rounded-full neon-glow-pink" />
                  </button>
                )}
                <div className="w-14 h-14" />
              </div>
            </div>
          </div>
        )}

        {/* Upload zone */}
        {previewUrl && <UploadDropzone onUploaded={handleUploaded} currentPreview={!uploadedFromVault ? previewUrl : undefined} />}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/gif,image/*,video/*"
          className="hidden"
          onChange={handleDirectFile}
        />

        {/* Preview */}
        {previewUrl && (
        <div
          className={`relative rounded-2xl overflow-hidden border border-fuchsia-500/40 neon-glow-purple max-w-lg mx-auto mb-3 bg-black/80 ${previewAspectRatio ? '' : 'aspect-square sm:aspect-video lg:aspect-square'}`}
          style={{ aspectRatio: previewAspectRatio ? String(previewAspectRatio) : undefined }}
        >
          <FwdAnimatedGif
            gifUrl={previewUrl}
            mediaType={mediaType}
            cacheKey={previewNonce}
            title={title}
            className={`w-full h-full object-contain bg-black/80 ${filterStyle}`}
            editMetadata={buildEditMetadata(editState)}
            lazy={false}
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] font-bold text-white border border-white/10">
            {isVideo ? 'VIDEO → GIF' : 'GIF'}
          </span>
          {textOverlay && (
            <div className="absolute inset-x-0 top-1/3 text-center text-2xl font-black text-white px-4"
              style={{ textShadow: '0 0 12px rgba(255,0,107,0.9), 0 0 24px rgba(176,38,255,0.8)' }}>
              {textOverlay}
            </div>
          )}
          {stickerOverlay && (
            <div className="absolute bottom-6 right-6 text-5xl drop-shadow-[0_0_10px_rgba(255,0,107,0.8)]">{stickerOverlay}</div>
          )}
          <button className="absolute bottom-2 left-2 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center border border-white/15">
            <Play size={14} className="text-white ml-0.5" />
          </button>
          {isVideo && (
            <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/60 text-[11px] font-mono text-white border border-white/15">
              {formatDuration(selectedDuration)}
            </span>
          )}
        </div>
        )}

        {/* Timeline (video only) */}
        {previewUrl && isVideo && (
          <div className={`glass-strong rounded-2xl p-3 border mb-4 ${tool === 'trim' ? 'border-fuchsia-500/40' : 'border-fuchsia-500/20'}`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-xs uppercase tracking-wider text-zinc-400">Trim (max 10s)</p>
              <span className="text-[11px] font-mono text-cyan-300">{formatDuration(selectedDuration)}</span>
            </div>
            <div className="relative h-14 rounded-xl overflow-hidden bg-black/40 mb-2">
              <div className="absolute inset-0 flex">
                {Array.from({ length: 8 }).map((_, i) => (
                  <video key={i} src={previewUrl} muted playsInline className="h-full object-cover opacity-60" style={{ width: '12.5%' }} />
                ))}
              </div>
              <div className="absolute top-0 bottom-0 border-2 border-fuchsia-500 rounded-lg"
                style={{
                  left: `${(editState.trimStart / Math.max(editState.duration || MAX_RECORD_SECONDS, 0.5)) * 100}%`,
                  right: `${100 - (editState.trimEnd / Math.max(editState.duration || MAX_RECORD_SECONDS, 0.5)) * 100}%`,
                  boxShadow: '0 0 20px rgba(176,38,255,0.8)',
                }}>
                <div className="absolute -left-1 top-0 bottom-0 w-2 bg-fuchsia-500 rounded-l" />
                <div className="absolute -right-1 top-0 bottom-0 w-2 bg-cyan-400 rounded-r" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 mb-0.5 block">Start: {formatDuration(editState.trimStart)}</label>
                <input type="range" min={0} max={Math.max(0.5, Math.min(editState.duration || MAX_RECORD_SECONDS, MAX_RECORD_SECONDS) - 0.5)} step={0.1} value={editState.trimStart}
                  onChange={(e) => updateTrimStart(Number(e.target.value))}
                  onPointerDown={() => setTool('trim')}
                  className="w-full accent-fuchsia-500 min-h-11" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 mb-0.5 block">End: {formatDuration(editState.trimEnd)}</label>
                <input type="range" min={0.5} max={Math.min(editState.duration || MAX_RECORD_SECONDS, MAX_RECORD_SECONDS)} step={0.1} value={editState.trimEnd}
                  onChange={(e) => updateTrimEnd(Number(e.target.value))}
                  onPointerDown={() => setTool('trim')}
                  className="w-full accent-cyan-400 min-h-11" />
              </div>
            </div>
            {selectedDuration > MAX_RECORD_SECONDS && (
              <p className="mt-2 text-[11px] text-pink-300">Selected range is capped to 10 seconds.</p>
            )}
          </div>
        )}

        {/* Tools */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-4">
          {TOOLS.map(t => {
            const Icon = t.icon;
            const active = t.id === tool;
            return (
              <button key={t.id} type="button" onClick={() => setTool(t.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition ${
                  active ? 'bg-fuchsia-500/15 border-fuchsia-500 neon-glow-purple text-fuchsia-300' : 'glass border-white/10 text-zinc-300 hover:border-fuchsia-500/40'
                }`}>
                <Icon size={20} />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>

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
                <button key={s} type="button" onClick={() => setStickerOverlay(s === stickerOverlay ? null : s)}
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
                <button key={s} type="button" onClick={() => {
                  setSpeed(s);
                  setEditState((current) => ({ ...current, speed: s }));
                }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${speed === s ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300' : 'glass border-white/10 text-zinc-300'}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
        {tool === 'filters' && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 mb-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Filters</p>
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
              {['Original', '1:1', '4:5', '9:16', '16:9'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => applyCropRatio(r === 'Original' ? null : r)}
                  className={`px-4 py-2 min-h-11 rounded-full text-sm font-semibold border ${
                    (r === 'Original' ? !editState.outputAspectRatio : editState.outputAspectRatio === r)
                      ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300'
                      : 'glass border-white/10 text-zinc-300 hover:border-fuchsia-500/40'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              {editState.outputAspectRatio
                ? `Output is framed ${editState.outputAspectRatio} without stretching.`
                : 'Original frame preserved.'}
            </p>
          </div>
        )}

        {/* Title */}
        <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20 mb-3">
          <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">Title</div>
          <div className="flex items-center justify-between">
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))}
              className="flex-1 bg-transparent outline-none text-white text-lg font-bold" placeholder="Name your GIF…" />
            <span className="text-xs text-zinc-500 font-mono">{title.length}/60</span>
          </div>
        </div>

        {/* Caption */}
        <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20 mb-3">
          <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">Caption <span className="text-zinc-600 normal-case">(optional)</span></div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder="Add a caption for when you post this…"
            rows={2}
            className="w-full bg-transparent outline-none text-white text-sm resize-none"
          />
          <div className="text-right text-xs text-zinc-600 font-mono">{caption.length}/200</div>
        </div>

        {/* Tags */}
        <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20 mb-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-400">Tags</div>
              {aiHint && <div className="text-[11px] text-cyan-300 mt-0.5">{aiHint}</div>}
            </div>
            <button
              onClick={() => suggestMetadata(undefined, true).then((metadata) => {
                if (metadata) toast({ title: 'AI categorized this FWD', description: `${metadata.category} · ${metadata.mood}` });
                else toast({ title: 'AI categorize failed', description: 'Try again after upload or save normally.', variant: 'destructive' });
              })}
              disabled={aiBusy || !previewUrl}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/35 px-3 py-2 text-xs font-bold text-cyan-200 glass disabled:opacity-50"
            >
              {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              AI Sort
            </button>
          </div>
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

        {/* Category + mood + visibility */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Category</div>
            <div className="relative">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent outline-none text-white text-sm font-semibold appearance-none pr-6">
                {CATEGORIES.map(c => <option key={c} className="bg-zinc-900">{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-0 top-1.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Mood</div>
            <div className="relative">
              <select value={mood} onChange={(e) => setMood(e.target.value)} className="w-full bg-transparent outline-none text-white text-sm font-semibold appearance-none pr-6">
                {MOODS.map(m => <option key={m.name} className="bg-zinc-900">{m.name}</option>)}
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

        {/* Allow reuse + download */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button onClick={() => setAllowReuse(!allowReuse)} className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">Allow Reuse</div>
              <div className="text-white text-sm font-semibold">{allowReuse ? 'On' : 'Off'}</div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 transition ${allowReuse ? 'bg-fuchsia-500' : 'bg-zinc-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition ${allowReuse ? 'translate-x-4' : ''}`} />
            </div>
          </button>
          <button onClick={() => setAllowDownload(!allowDownload)} className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">Allow Download</div>
              <div className="text-white text-sm font-semibold">{allowDownload ? 'On' : 'Off'}</div>
            </div>
            <div className={`w-10 h-6 rounded-full p-0.5 transition ${allowDownload ? 'bg-fuchsia-500' : 'bg-zinc-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition ${allowDownload ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        </div>

        {/* Error */}
        {creationState === 'error' && (
          <div className="glass-strong rounded-2xl p-3 border border-pink-500/40 mb-4 text-pink-400 text-sm">
            {errorMsg || 'Something went wrong. Please try again.'}
          </div>
        )}

        {/* Progress */}
        {(creationState === 'generating' || creationState === 'uploading') && (
          <div className="glass-strong rounded-2xl p-4 border border-fuchsia-500/20 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-300 font-semibold">
                {creationState === 'generating' ? 'Encoding GIF…' : 'Uploading…'}
              </span>
              <span className="text-sm text-fuchsia-400 font-mono">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {previewUrl && <button
          onClick={create}
          disabled={creationState === 'generating' || creationState === 'uploading'}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white text-lg font-black tracking-widest neon-glow-purple flex items-center justify-center gap-2 hover:scale-[1.02] transition disabled:opacity-70 disabled:scale-100"
        >
          {(creationState === 'generating' || creationState === 'uploading')
            ? <><Loader2 size={20} className="animate-spin" /> {creationState === 'generating' ? 'ENCODING…' : 'UPLOADING…'}</>
            : <>Save to My Library <ChevronsRight size={22} /></>
          }
        </button>}
      </div>
    </div>
  );
};

export default CreateGif;
