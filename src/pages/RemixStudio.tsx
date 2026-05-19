import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, RefreshCw, Save, Send,
  UploadCloud, X, AlertTriangle, Image as ImageIcon,
  Film, Check, Loader2, Wand2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext, Gif } from '@/contexts/AppContext';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { toast } from '@/components/ui/use-toast';
import { resolveFwdMedia } from '@/lib/fwdMedia';
import { isBlobUrl } from '@/lib/blobGuard';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MOODS = ['Funny', 'Savage', 'Petty', 'Flirty', 'Dramatic', 'Shocked', 'Celebration', 'Vibes'];
const STYLES = ['Clean', 'Meme', 'Neon', 'Cinematic', 'Reaction Cam'];
const ACCEPT = '.gif,.mp4,.webm,.png,.jpg,.jpeg,image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type RemixMode = 'reaction' | 'split' | 'replace' | 'text' | 'ai-blend';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface AiRecipe {
  mode: 'reaction' | 'split' | 'replace' | 'text';
  caption: string;
  mood: string;
  style: string;
  placement: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  captionPlacement: 'top' | 'bottom' | 'center';
  overlayShape: 'rounded' | 'circle' | 'polaroid' | 'text-message' | 'sticker';
  scale: number;
  tags: string[];
  reason: string;
}

interface ReplacementMedia {
  localUrl: string;
  remoteUrl: string | null;
  file: File;
  mimeType: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const isVideoMime = (t?: string | null) => !!t && t.startsWith('video/');
const isUuid = (v?: string) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

const MODE_LABELS: Record<RemixMode, string> = {
  reaction: 'Reaction',
  split: 'Split',
  replace: 'Replace',
  text: 'Text',
  'ai-blend': 'AI Blend ✦',
};

const MODE_DESCRIPTIONS: Record<RemixMode, string> = {
  reaction: 'Your upload appears as an overlay on the original',
  split: 'Original and your upload appear side by side',
  replace: 'Your upload becomes the main visual',
  text: 'Original GIF with a caption overlay only',
  'ai-blend': 'AI picks the best way to remix these together',
};

const PLACEMENT_CLASS: Record<AiRecipe['placement'], string> = {
  'bottom-right': 'bottom-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'top-right': 'top-14 right-3',
  'top-left': 'top-14 left-3',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

function overlayShapeClasses(shape: AiRecipe['overlayShape']) {
  switch (shape) {
    case 'circle': return 'rounded-full overflow-hidden shadow-2xl ring-2 ring-white/50';
    case 'polaroid': return 'rounded-sm bg-white p-1 pb-5 shadow-2xl overflow-hidden';
    case 'text-message': return 'rounded-2xl rounded-br-sm overflow-hidden ring-2 ring-cyan-400/90 shadow-xl';
    case 'sticker': return 'rounded-xl overflow-hidden ring-4 ring-white/90 shadow-2xl';
    default: return 'rounded-xl overflow-hidden shadow-xl ring-1 ring-white/20';
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const RemixStudio: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { createUserGif, createPost } = useAppContext();

  // Original GIF
  const [originalGif, setOriginalGif] = useState<Gif | null>(null);
  const [loading, setLoading] = useState(true);

  // Caption / mood / style (synced from recipe on Apply)
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState('Funny');
  const [style, setStyle] = useState('Clean');

  // Remix mode picker
  const [remixMode, setRemixMode] = useState<RemixMode>('reaction');

  // AI Blend state
  const [pendingRecipe, setPendingRecipe] = useState<AiRecipe | null>(null);
  const [appliedRecipe, setAppliedRecipe] = useState<AiRecipe | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [showRecipeReason, setShowRecipeReason] = useState(false);

  // Upload state
  const [replacement, setReplacement] = useState<ReplacementMedia | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Caption Ideas (existing feature)
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  // ── Blob URL cleanup ──
  useEffect(() => {
    return () => {
      if (replacement?.localUrl) URL.revokeObjectURL(replacement.localUrl);
    };
  }, [replacement?.localUrl]);

  // ── Load original GIF: route state first, then UUID lookup ──
  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const stateGif = (location.state as any)?.gif as Gif | undefined;

      if (import.meta.env.DEV) {
        console.log('[RemixStudio] Loading', {
          routeId: id, isUuid: isUuid(id),
          hasRouteState: !!stateGif,
        });
      }

      // A. Route state has usable media — check all possible media fields
      const stateHasMedia = stateGif && (
        stateGif.image || stateGif.mp4_url || stateGif.webm_url ||
        stateGif.source_video_url || stateGif.still_url
      );
      if (import.meta.env.DEV) {
        console.log('[RemixStudio] State check', {
          hasState: !!stateGif,
          stateHasMedia,
          image: stateGif?.image,
          mp4_url: stateGif?.mp4_url,
          webm_url: stateGif?.webm_url,
          source_video_url: stateGif?.source_video_url,
          still_url: stateGif?.still_url,
        });
      }
      if (stateHasMedia) {
        setOriginalGif(stateGif);
        setLoading(false);
        return;
      }

      // B. UUID — fetch from DB
      if (id && isUuid(id)) {
        const { data } = await supabase
          .from('fwd_gifs')
          .select('*, fwd_profiles!owner_user_id(display_name, username)')
          .eq('id', id)
          .maybeSingle();
        if (cancel) return;
        if (data) {
          const media = resolveFwdMedia(data);
          const g: Gif = {
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
          (g as any).original_profile = data.fwd_profiles;
          setOriginalGif(g);
        }
      }

      if (!cancel) setLoading(false);
    };
    load();
    return () => { cancel = true; };
  }, [id, location.state]);

  // ── Upload replacement media ──
  const handleFileSelect = useCallback(async (file: File) => {
    if (!user) {
      toast({ title: 'Sign in to upload', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadStatus('error');
      setUploadError('File is over 25MB.');
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadStatus('error');
      setUploadError('Use .gif, .mp4, .webm, .png, .jpg or .webp');
      return;
    }

    if (replacement?.localUrl) URL.revokeObjectURL(replacement.localUrl);
    const localUrl = URL.createObjectURL(file);
    setReplacement({ localUrl, remoteUrl: null, file, mimeType: file.type });
    setUploadStatus('uploading');
    setUploadProgress(8);
    setUploadError('');

    let tick = 8;
    const interval = setInterval(() => {
      tick = Math.min(88, tick + Math.random() * 10);
      setUploadProgress(Math.round(tick));
    }, 220);

    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/remix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    try {
      // Upload to the PUBLIC fwd-gifs bucket so the URL is fetchable from any client.
      // fwd-uploads is a private bucket and getPublicUrl() returns a URL that 400s,
      // which previously caused the right panel of Split / overlay of Reaction remixes
      // to show a broken image icon and persist as a broken URL in remix_media_url.
      const { error: upErr } = await supabase.storage.from('fwd-gifs').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      clearInterval(interval);
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('fwd-gifs').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('No public URL');

      // Verify the public URL is actually fetchable before considering the upload "done".
      // If the bucket is private or the policy blocks public read, this catches it now
      // instead of saving a broken URL into remix_media_url.
      try {
        const probe = await fetch(data.publicUrl, { method: 'HEAD', cache: 'no-store' });
        if (!probe.ok) throw new Error(`Public URL not readable (${probe.status})`);
      } catch (probeErr: any) {
        throw new Error(`Uploaded file is not publicly readable: ${probeErr?.message || probeErr}`);
      }

      setUploadProgress(100);
      setUploadStatus('success');
      setReplacement(prev => prev ? { ...prev, remoteUrl: data.publicUrl } : null);

      if (import.meta.env.DEV) {
        console.log('[RemixStudio] Upload complete', {
          bucket: 'fwd-gifs', localUrl: 'yes', remoteUrlIsHttps: data.publicUrl.startsWith('https://'), mimeType: file.type,
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

  // ── Generate AI recipe ──
  const generateRecipe = async () => {
    setRecipeLoading(true);
    setPendingRecipe(null);
    try {
      const res = await fetch('/api/ai/remix-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood,
          style,
          originalGifTitle: originalGif?.title || '',
          uploadedMimeType: replacement?.mimeType || '',
        }),
      });
      const data = await res.json();
      if (data?.recipe) {
        setPendingRecipe(data.recipe as AiRecipe);
        setShowRecipeReason(true);
      } else {
        toast({ title: 'No recipe returned', description: 'Try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'AI unavailable', description: 'Using local fallback ideas.', variant: 'destructive' });
    } finally {
      setRecipeLoading(false);
    }
  };

  // ── Apply AI recipe to preview ──
  const applyRecipe = (recipe: AiRecipe) => {
    setAppliedRecipe(recipe);
    setCaption(recipe.caption);
    setMood(recipe.mood);
    setStyle(recipe.style);
    setPendingRecipe(null);
    setShowRecipeReason(false);
    // Switch remixMode to the resolved mode so the preview renders correctly
    setRemixMode(recipe.mode as RemixMode);
  };

  // ── AI Caption Ideas (existing) ──
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
        }),
      });
      const data = await res.json();
      if (data.ideas) setAiIdeas(data.ideas);
    } catch {
      toast({ title: 'Could not fetch ideas', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Preview resolution
  // ─────────────────────────────────────────────

  // The effective render mode (ai-blend resolves to reaction until applied)
  const effectiveMode: Exclude<RemixMode, 'ai-blend'> =
    remixMode === 'ai-blend' ? 'reaction' : remixMode;

  // Overlay config: from applied recipe or defaults
  const overlayPlacement: AiRecipe['placement'] = appliedRecipe?.placement ?? 'bottom-right';
  const overlayShape: AiRecipe['overlayShape'] = appliedRecipe?.overlayShape ?? 'rounded';
  const overlayScale: number = appliedRecipe?.scale ?? 0.35;
  const captionPlacement: AiRecipe['captionPlacement'] = appliedRecipe?.captionPlacement ?? 'bottom';

  const replIsVideo = replacement && isVideoMime(replacement.mimeType);

  // Render the replacement media element (used in reaction overlay and split panel)
  const renderReplacementMedia = (className = 'w-full h-full object-cover') => {
    if (!replacement?.localUrl) return null;
    if (replIsVideo) {
      return (
        <video
          key={replacement.localUrl}
          src={replacement.localUrl}
          muted autoPlay loop playsInline
          className={className}
        />
      );
    }
    return (
      <img
        key={replacement.localUrl}
        src={replacement.localUrl}
        alt="replacement"
        className={className}
        onError={() => {
          toast({ title: "Couldn't preview replacement media. Using original GIF.", variant: 'destructive' });
          clearReplacement();
        }}
      />
    );
  };

  const renderPreview = () => {
    // ── Split: original | replacement side by side ──
    if (effectiveMode === 'split') {
      return (
        <div className="absolute inset-0 flex">
          <div className="flex-1 overflow-hidden border-r border-white/10">
            <FwdMediaPlayer
              mp4Url={originalGif?.mp4_url} webmUrl={originalGif?.webm_url}
              gifUrl={originalGif?.image} posterUrl={originalGif?.still_url}
              isAnimated={originalGif?.is_animated}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 overflow-hidden bg-zinc-900 flex items-center justify-center">
            {replacement
              ? renderReplacementMedia()
              : <span className="text-zinc-600 text-[10px] text-center px-2">Upload media to fill this panel</span>}
          </div>
        </div>
      );
    }

    // ── Replace: replacement becomes full background ──
    if (effectiveMode === 'replace') {
      if (replacement?.localUrl) {
        return replIsVideo ? (
          <video
            key={replacement.localUrl}
            src={replacement.localUrl}
            muted autoPlay loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            key={replacement.localUrl}
            src={replacement.localUrl}
            alt="replacement"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => { clearReplacement(); }}
          />
        );
      }
      // No upload yet — show original with placeholder notice
      return (
        <>
          <FwdMediaPlayer
            mp4Url={originalGif?.mp4_url} webmUrl={originalGif?.webm_url}
            gifUrl={originalGif?.image} posterUrl={originalGif?.still_url}
            isAnimated={originalGif?.is_animated}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-zinc-400 text-xs text-center px-4">Upload media to replace this GIF</span>
          </div>
        </>
      );
    }

    // ── Text: original GIF only (no overlay) ──
    if (effectiveMode === 'text') {
      return (
        <FwdMediaPlayer
          mp4Url={originalGif?.mp4_url} webmUrl={originalGif?.webm_url}
          gifUrl={originalGif?.image} posterUrl={originalGif?.still_url}
          isAnimated={originalGif?.is_animated}
          className="absolute inset-0 w-full h-full object-cover"
        />
      );
    }

    // ── Reaction (default): original GIF + replacement as overlay ──
    return (
      <>
        <FwdMediaPlayer
          mp4Url={originalGif?.mp4_url} webmUrl={originalGif?.webm_url}
          gifUrl={originalGif?.image} posterUrl={originalGif?.still_url}
          isAnimated={originalGif?.is_animated}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {replacement?.localUrl && (
          <div
            className={`absolute z-10 ${PLACEMENT_CLASS[overlayPlacement]} ${overlayShapeClasses(overlayShape)}`}
            style={{
              width: `${Math.round(overlayScale * 100)}%`,
              aspectRatio: overlayShape === 'circle' ? '1/1' : undefined,
            }}
          >
            {renderReplacementMedia()}
          </div>
        )}
      </>
    );
  };

  // Caption gradient direction (based on captionPlacement)
  const captionGradient = captionPlacement === 'top'
    ? 'bg-gradient-to-b from-black/80 via-transparent to-transparent flex-col justify-start pt-4'
    : 'bg-gradient-to-t from-black/80 via-transparent to-transparent flex-col justify-end pb-4';

  // ─────────────────────────────────────────────
  // Save / Post
  // ─────────────────────────────────────────────

  const uploadPending = replacement && !replacement.remoteUrl;

  const handleSave = async (postToFeed = false) => {
    if (!user) {
      toast({ title: 'Sign in to save', description: 'Create an account to save your remix.' });
      nav('/login');
      return;
    }
    if (!originalGif) return;
    if (uploadPending) {
      toast({ title: 'Finish uploading', description: 'Wait for your media to finish uploading.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // ── Resolve original GIF's permanent URL ──────────────────────────────
      // If originalGif.image is a blob (from route state of a freshly-created GIF),
      // we must NOT save it. For reaction/split/text modes that need the original
      // as the main visual, fetch the real URL from the DB using the GIF's UUID.
      let originalMediaUrl = originalGif.image || '';
      let originalMp4 = originalGif.mp4_url || null;
      let originalWebm = originalGif.webm_url || null;

      if (isBlobUrl(originalMediaUrl)) {
        // Try to recover from DB if we have a UUID
        if (isUuid(originalGif.id)) {
          const { data: dbRow } = await supabase
            .from('fwd_gifs')
            .select('gif_url, media_url, mp4_url, webm_url, source_video_url, media_type, still_url')
            .eq('id', originalGif.id)
            .maybeSingle();
          if (dbRow) {
            const recovered = resolveFwdMedia(dbRow);
            originalMediaUrl = recovered.animatedUrl || '';
            originalMp4 = recovered.mp4Url;
            originalWebm = recovered.webmUrl;
          }
        }
        // If still blob after recovery attempt, block save for non-replace modes
        if (isBlobUrl(originalMediaUrl) && effectiveMode !== 'replace') {
          toast({ title: 'Original media unavailable', description: 'The source GIF cannot be saved as a remix. Try opening it from your library.', variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      // ── Mode-aware main media URL selection ───────────────────────────────
      // Replace: replacement is the main visual
      // Reaction / Split / Text / AI-Blend: original is the main visual
      let mediaUrl: string;
      let mediaType: string;
      let isAnimated: boolean;
      let stillUrl: string | null;

      if (effectiveMode === 'replace') {
        // Replace mode REQUIRES a replacement
        if (!replacement?.remoteUrl) {
          toast({ title: 'Upload required', description: 'Upload a file to replace the original before saving.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        mediaUrl = replacement.remoteUrl;
        mediaType = replacement.mimeType;
        isAnimated = isVideoMime(replacement.mimeType) || replacement.mimeType === 'image/gif';
        stillUrl = null;
      } else {
        // Reaction / Split / Text / AI-Blend: original GIF is the main visual
        // Use mp4 or webm if available (better for video-based originals)
        mediaUrl = originalMp4 || originalWebm || originalMediaUrl;
        mediaType = originalGif.media_type || 'image/gif';
        isAnimated = originalGif.is_animated ?? true;
        stillUrl = originalGif.still_url || null;
      }

      // ── Dev-only diagnostic logging ───────────────────────────────────────
      if (import.meta.env.DEV) {
        console.log('[RemixStudio] handleSave', {
          remixMode,
          effectiveMode,
          postToFeed,
          hasReplacement: !!replacement,
          replacementLocalUrlIsBlob: isBlobUrl(replacement?.localUrl),
          replacementRemoteUrlExists: !!replacement?.remoteUrl,
          replacementRemoteUrlIsBlob: isBlobUrl(replacement?.remoteUrl),
          resolvedMediaUrl: mediaUrl,
          resolvedMediaUrlIsBlob: isBlobUrl(mediaUrl),
          resolvedMediaType: mediaType,
          originalGifImageIsBlob: isBlobUrl(originalGif.image),
          uploadPending,
        });
      }

      // ── Hard no-blob guard on every field before createUserGif ───────────
      const allMediaFields: Record<string, string | null | undefined> = {
        image: mediaUrl,
        source_video_url: isVideoMime(mediaType) ? mediaUrl : (originalGif.source_video_url || undefined),
        remix_media_url: replacement?.remoteUrl,
        still_url: stillUrl,
      };
      for (const [field, value] of Object.entries(allMediaFields)) {
        if (isBlobUrl(value)) {
          toast({ title: 'Finish uploading media before saving your remix.', description: `Field ${field} still has a local preview URL.`, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      // ── Require at least one permanent media URL ──────────────────────────
      if (!mediaUrl || !mediaUrl.startsWith('http')) {
        toast({ title: 'No valid media', description: 'This remix needs a valid uploaded media file before saving.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      // ── Mode-specific requirement: split/reaction/ai-blend NEED remix_media_url ──
      // If the user picked Split/Reaction/AI-Blend without uploading a replacement,
      // the resulting card would be the original GIF only and show as broken.
      const modeNeedsReplacement = ['split', 'reaction', 'ai-blend'].includes(effectiveMode);
      if (modeNeedsReplacement && (!replacement?.remoteUrl || !replacement.remoteUrl.startsWith('https://'))) {
        toast({
          title: 'Finish uploading media before saving your remix.',
          description: `${effectiveMode} mode needs an uploaded image or video before posting.`,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      // ── Effective mode to store ───────────────────────────────────────────
      const savedMode = remixMode === 'ai-blend' && appliedRecipe ? appliedRecipe.mode : remixMode;

      // ── Layout to store ───────────────────────────────────────────────────
      const layout = appliedRecipe
        ? {
          placement: appliedRecipe.placement,
          overlayShape: appliedRecipe.overlayShape,
          scale: appliedRecipe.scale,
          captionPlacement: appliedRecipe.captionPlacement,
        }
        : effectiveMode === 'reaction' && replacement
          ? { placement: 'bottom-right', overlayShape: 'rounded', scale: 0.35, captionPlacement: 'bottom' }
          : null;

      // ── Create fwd_gifs row ───────────────────────────────────────────────
      const remixed = await createUserGif({
        title: `Remix: ${originalGif.title}`,
        image: mediaUrl,
        still_url: stillUrl,
        tags: [...(originalGif.tags || []), ...(appliedRecipe?.tags || [])].filter(Boolean),
        category: originalGif.category,
        mood,
        caption,
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
        remix_mode: savedMode,
        remix_media_url: replacement?.remoteUrl || null,
        remix_media_type: replacement?.mimeType || null,
        remix_layout: layout as Record<string, unknown> | null,
        remix_ai_recipe: appliedRecipe as unknown as Record<string, unknown> | null,
        remix_tags: appliedRecipe?.tags || null,
      });

      if (!remixed) throw new Error('Failed to create remix GIF record');
      if (!remixed.image && !remixed.mp4_url && !remixed.webm_url) throw new Error('Remix saved but has no valid media URL — blocking post');

      if (import.meta.env.DEV) {
        console.log('[RemixStudio] remixed row created', {
          id: remixed.id,
          image: remixed.image,
          mp4_url: remixed.mp4_url,
          webm_url: remixed.webm_url,
          remix_media_url: remixed.remix_media_url,
        });
      }

      // ── Only create feed post after remix row is confirmed valid ─────────
      if (postToFeed) {
        const post = await createPost(remixed.id, caption);
        if (!post) throw new Error('Failed to post to feed');
        toast({ title: 'Remix posted to feed!' });
        nav('/feed');
      } else {
        toast({ title: 'Remix saved privately!' });
        nav('/profile');
      }
    } catch (err: any) {
      toast({ title: 'Error saving remix', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  // ─────────────────────────────────────────────
  // Guard renders
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }
  if (!originalGif) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-zinc-400 text-sm">Couldn't load this GIF for remix. Go back and try again.</p>
        <button onClick={() => nav(-1)} className="px-5 py-2.5 rounded-xl bg-fuchsia-600 text-white text-sm font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const originalCreatorName =
    (originalGif as any).original_profile?.display_name ||
    (originalGif as any).original_profile?.username ||
    'Unknown';

  // ─────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-safe bg-black page-content flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => nav(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black tracking-wider text-white">REMIX STUDIO</h1>
          <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">
            Remix of @{originalCreatorName}
          </p>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-4 flex flex-col gap-4">

        {/* ── Preview Area ── */}
        <div className="relative rounded-3xl overflow-hidden border-2 border-fuchsia-500/40 glass-strong shadow-2xl shadow-fuchsia-900/20 w-full max-w-[300px] mx-auto aspect-[4/5] flex items-center justify-center bg-black">
          {renderPreview()}

          {/* Caption overlay */}
          {caption && (
            <div className={`absolute inset-0 pointer-events-none flex ${captionGradient} px-4`}>
              <div className={`text-center ${
                style === 'Meme'
                  ? 'font-black uppercase text-2xl text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000]'
                  : style === 'Neon'
                  ? 'font-bold text-xl text-fuchsia-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]'
                  : 'font-bold text-lg text-white drop-shadow-md'
              }`}>
                {caption}
              </div>
            </div>
          )}

          {/* Preview mode badge */}
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-white/80 uppercase tracking-widest border border-white/20 z-20">
            {remixMode === 'ai-blend' && appliedRecipe
              ? `AI · ${appliedRecipe.mode}`
              : replacement
              ? MODE_LABELS[remixMode]
              : 'Remix preview'}
          </div>
        </div>

        {/* ── Mode Picker ── */}
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
            Remix Mode
          </label>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {(Object.keys(MODE_LABELS) as RemixMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setRemixMode(m);
                  if (m !== 'ai-blend') setAppliedRecipe(null);
                }}
                className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  remixMode === m
                    ? m === 'ai-blend'
                      ? 'bg-gradient-to-r from-cyan-500 to-fuchsia-500 border-transparent text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:border-fuchsia-500/40'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 ml-1 mt-1.5">{MODE_DESCRIPTIONS[remixMode]}</p>
        </div>

        {/* ── Upload / Replace Media (all modes except text) ── */}
        {remixMode !== 'text' && (
          <div className="rounded-2xl border border-fuchsia-500/30 glass p-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
              {remixMode === 'ai-blend' ? 'Your Media (for AI to blend)' : 'Replace Media'}
            </label>

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
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 text-center mt-1">
                  {replacement?.file.name} — {uploadProgress}%
                </p>
              </div>
            )}

            {uploadStatus === 'success' && replacement && (
              <div className="py-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
                    <Check size={14} className="text-emerald-300" />
                  </div>
                  <span className="text-white text-sm font-bold">Saved to your vault</span>
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
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 rounded-xl bg-fuchsia-600 text-white text-xs font-bold">
                    Try again
                  </button>
                  <button onClick={clearReplacement} className="px-3 py-1.5 rounded-xl glass border border-white/10 text-xs text-zinc-300">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
              className="hidden"
            />
          </div>
        )}

        {/* ── AI Blend Panel ── */}
        {remixMode === 'ai-blend' && (
          <div className="rounded-2xl border border-cyan-500/30 glass p-3">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={14} className="text-cyan-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">AI Blend</span>
            </div>

            {!pendingRecipe && !recipeLoading && !appliedRecipe && (
              <div className="text-center py-2">
                <p className="text-xs text-zinc-400 mb-3">
                  {replacement
                    ? 'AI will suggest how to blend your upload with the original GIF.'
                    : 'Upload media above for the best blend, or generate a text-only idea.'}
                </p>
                <button
                  onClick={generateRecipe}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-sm font-bold"
                >
                  <Wand2 size={15} /> Generate Remix Idea
                </button>
              </div>
            )}

            {recipeLoading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 size={16} className="text-cyan-400 animate-spin" />
                <span className="text-white text-sm">Finding the best remix angle…</span>
              </div>
            )}

            {/* Pending recipe card */}
            {pendingRecipe && !recipeLoading && (
              <div className="space-y-3">
                <div className="bg-black/40 rounded-xl p-3 border border-cyan-500/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Layout</span>
                    <span className="text-xs font-bold text-white capitalize">
                      {pendingRecipe.mode} · {pendingRecipe.placement.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Caption</span>
                    <span className="text-xs font-bold text-cyan-300 text-right max-w-[60%]">
                      "{pendingRecipe.caption}"
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Mood / Style</span>
                    <span className="text-xs text-zinc-300">
                      {pendingRecipe.mood} · {pendingRecipe.style}
                    </span>
                  </div>
                  {pendingRecipe.reason && (
                    <div>
                      <button
                        onClick={() => setShowRecipeReason(v => !v)}
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition"
                      >
                        {showRecipeReason ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        Why this?
                      </button>
                      {showRecipeReason && (
                        <p className="text-[10px] text-zinc-400 mt-1 italic">{pendingRecipe.reason}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => applyRecipe(pendingRecipe)}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white text-xs font-bold"
                  >
                    Apply Idea
                  </button>
                  <button
                    onClick={generateRecipe}
                    className="flex-1 py-2 rounded-xl glass border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={11} /> Try Again
                  </button>
                  <button
                    onClick={() => { setPendingRecipe(null); }}
                    className="px-3 py-2 rounded-xl glass border border-white/10 text-zinc-400 text-xs"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* Applied recipe summary */}
            {appliedRecipe && !pendingRecipe && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
                    <Check size={12} className="text-emerald-300" />
                  </div>
                  <span className="text-white text-xs font-bold">AI idea applied</span>
                  <span className="text-zinc-500 text-[10px] capitalize ml-auto">
                    {appliedRecipe.mode} mode · {appliedRecipe.overlayShape}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={generateRecipe}
                    className="flex-1 py-1.5 rounded-xl glass border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={11} /> New Idea
                  </button>
                  <button
                    onClick={() => { setAppliedRecipe(null); setRemixMode('ai-blend'); }}
                    className="px-3 py-1.5 rounded-xl glass border border-white/10 text-zinc-400 text-xs"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Caption input ── */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">
              Caption Overlay
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add your spin..."
              className="w-full bg-zinc-900/50 border border-fuchsia-500/30 rounded-2xl p-4 text-white placeholder-zinc-500 focus:border-fuchsia-500 outline-none resize-none h-24 transition-colors"
            />
          </div>

          {/* AI Caption Ideas */}
          <div className="glass rounded-2xl border border-cyan-500/30 p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Sparkles size={14} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Caption Ideas</span>
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
              <p className="text-xs text-zinc-500 text-center py-2">Tap Generate for caption ideas.</p>
            )}
          </div>

          {/* Mood */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
              Remix Mood
            </label>
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

          {/* Style */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">
              Caption Style
            </label>
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

      {/* ── Action Bar ── */}
      <div className="relative p-4 bg-black/80 backdrop-blur-lg border-t border-white/10 flex gap-3">
        {uploadPending && (
          <p className="absolute -top-7 left-0 right-0 text-center text-[10px] text-amber-400 font-bold">
            Finish uploading media before saving your remix.
          </p>
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
