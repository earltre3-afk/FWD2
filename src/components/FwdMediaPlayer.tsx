import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { resolveFwdMedia } from '@/lib/fwdMedia';

type PlayState = 'loading' | 'playing' | 'blocked' | 'error' | 'unsupported';

export type FwdMediaPlayerProps = {
  /** MP4 source — preferred; Safari plays H.264 MP4 without WebM codec */
  mp4Url?: string | null;
  /** WebM fallback for browsers that prefer it */
  webmUrl?: string | null;
  /** Generic URL: auto-detected as mp4/webm/gif by extension */
  gifUrl?: string | null;
  /** Still frame / poster shown while loading or on error */
  posterUrl?: string | null;
  /** Original recorded video, used as a compatibility fallback for created FWDs */
  sourceVideoUrl?: string | null;
  /** Saved MIME type when known, e.g. image/gif or video/mp4 */
  mediaType?: string | null;
  isAnimated?: boolean | null;
  /** Changes force a remount/load when Safari keeps a stale first frame */
  cacheKey?: string | number | null;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  objectFit?: 'cover' | 'contain' | 'fill';
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  lazy?: boolean;
  onError?: () => void;
  onLoad?: () => void;
};

const MP4_EXT_RE = /\.(mp4|m4v|mov)(?:[?#].*)?$/i;
const WEBM_EXT_RE = /\.(webm|ogv|ogg)(?:[?#].*)?$/i;
const GIF_EXT_RE = /\.gif(?:[?#].*)?$/i;

const SAFARI_UA_RE = /^((?!chrome|android|crios|fxios|edgios).)*safari/i;
const isSafari = () => typeof navigator !== 'undefined' && SAFARI_UA_RE.test(navigator.userAgent);

function safariGifToMp4(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('giphy.com') && !host.includes('tenor.com') && !host.includes('gifs.com')) return '';
    parsed.pathname = parsed.pathname.replace(/\.gif$/i, '.mp4');
    parsed.search = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function withCacheBust(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function FwdMediaPlayer({
  mp4Url,
  webmUrl,
  gifUrl,
  posterUrl,
  sourceVideoUrl,
  mediaType,
  isAnimated,
  cacheKey,
  title = 'FWD',
  className,
  style,
  objectFit = 'cover',
  autoPlay = true,
  loop = true,
  muted = true,
  controls = false,
  lazy = true,
  onError,
  onLoad,
}: FwdMediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playState, setPlayState] = useState<PlayState>('loading');
  const [imgErrored, setImgErrored] = useState(false);

  const safari = isSafari();
  const resolved = resolveFwdMedia({
    gif_url: gifUrl,
    mp4_url: mp4Url,
    webm_url: webmUrl,
    poster_url: posterUrl,
    source_video_url: sourceVideoUrl,
    media_type: mediaType,
    is_animated: isAnimated,
    updated_at: cacheKey ? String(cacheKey) : undefined,
  });

  // Resolve best video sources
  const resolvedMp4 = resolved.mp4Url || null;
  const resolvedWebm = resolved.webmUrl || null;
  const resolvedGif = resolved.gifUrl || null;
  const resolvedPoster = posterUrl || resolved.thumbnailUrl || null;
  const fallbackVideo = resolved.shouldUseVideo && !resolvedMp4 && !resolvedWebm ? resolved.animatedUrl : null;
  // Safari-only: swap .gif → .mp4 for known GIF CDNs (giphy, tenor, gifs.com)
  const safariSwap = resolvedGif && GIF_EXT_RE.test(resolvedGif) && safari ? safariGifToMp4(resolvedGif) : '';

  const isVideoMode = !!(resolvedMp4 || resolvedWebm || safariSwap || fallbackVideo);
  const isGifImgMode = !isVideoMode && !!resolvedGif;

  // Key causes video remount when sources change; stable within a single render cycle
  const videoKey = [resolvedMp4 || safariSwap || fallbackVideo, resolvedWebm, cacheKey].filter(Boolean).join('|');

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setPlayState('playing');
    } catch (err: any) {
      const name: string = err?.name ?? '';
      if (name === 'NotAllowedError') {
        setPlayState('blocked');
      } else if (name === 'NotSupportedError') {
        setPlayState('unsupported');
      } else if (name !== 'AbortError') {
        // AbortError = interrupted by a new src load — not a real failure
        setPlayState('error');
      }
    }
  }, []);

  // Safari-safe imperative setup + readiness listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoMode) return;

    // These imperative assignments are required because React's JSX props
    // sometimes lose the muted/playsInline attributes across hydration in Safari
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    if (!autoPlay) return;

    const onReady = () => void tryPlay();
    video.addEventListener('canplay', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('loadedmetadata', onReady);

    // If already buffered enough (e.g., cached), fire immediately
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) void tryPlay();

    return () => {
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('loadedmetadata', onReady);
    };
  }, [isVideoMode, autoPlay, videoKey, tryPlay]);

  // Recovery: retry when tab becomes visible or page is restored from bfcache
  useEffect(() => {
    if (!isVideoMode || !autoPlay) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && playState === 'blocked') void tryPlay();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [isVideoMode, autoPlay, playState, tryPlay]);

  // IntersectionObserver: play when scrolled into view, pause when scrolled out
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideoMode || !autoPlay || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void tryPlay();
        else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [isVideoMode, autoPlay, tryPlay]);

  // Reset play state when source URLs change
  useEffect(() => {
    setPlayState('loading');
    setImgErrored(false);
  }, [mp4Url, webmUrl, gifUrl, sourceVideoUrl, mediaType, isAnimated]);

  if (!resolved.animatedUrl && !resolvedMp4 && !resolvedWebm && !resolvedGif) return null;

  const hasOverlay = playState === 'blocked' || playState === 'error' || playState === 'unsupported';
  const objFit = objectFit !== 'cover' ? objectFit : undefined;

  // ── Video mode ──────────────────────────────────────────────────────────────
  if (isVideoMode) {
    // display:contents makes the wrapper invisible to layout when no overlay is needed,
    // so the <video> element receives className/style directly (backward-compatible sizing).
    // When an overlay is active the wrapper becomes position:relative to anchor it.
    return (
      <div
        className={hasOverlay ? `relative ${className ?? ''}` : ''}
        style={hasOverlay ? style : ({ display: 'contents' } as React.CSSProperties)}
      >
        <video
          ref={videoRef}
          key={videoKey}
          // Safari-critical declarative attrs (also set imperatively in useEffect above)
          muted
          autoPlay={autoPlay}
          loop={loop}
          playsInline
          preload={lazy ? 'metadata' : 'auto'}
          poster={resolvedPoster ?? undefined}
          controls={controls}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          draggable={false}
          className={hasOverlay ? 'w-full block' : className}
          style={hasOverlay ? { objectFit: objFit } : { objectFit: objFit, ...style }}
          onError={() => {
            setPlayState('error');
            onError?.();
          }}
          onLoadedData={() => onLoad?.()}
        >
          {/* MP4 first — broadest Safari / iOS compatibility */}
          {resolvedMp4 && <source src={resolvedMp4} type="video/mp4" />}
          {safariSwap && !resolvedMp4 && <source src={safariSwap} type="video/mp4" />}
          {resolvedWebm && <source src={resolvedWebm} type="video/webm" />}
          {fallbackVideo && !resolvedMp4 && !resolvedWebm && !safariSwap && (
            <source src={fallbackVideo} type={MP4_EXT_RE.test(fallbackVideo) ? 'video/mp4' : WEBM_EXT_RE.test(fallbackVideo) ? 'video/webm' : mediaType || 'video/mp4'} />
          )}
        </video>

        {playState === 'blocked' && (
          <button
            type="button"
            onClick={() => void tryPlay()}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40"
            aria-label="Tap to play"
          >
            <div className="w-14 h-14 rounded-full bg-black/60 border border-white/30 flex items-center justify-center mb-2">
              <Play size={24} className="text-white ml-1" />
            </div>
            <span className="text-xs text-white/80 font-medium">Tap to play</span>
          </button>
        )}

        {(playState === 'error' || playState === 'unsupported') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-center px-4">
            {resolvedPoster
              ? <img src={resolvedPoster} alt={title} className="w-full h-full object-contain" />
              : <p className="text-zinc-400 text-xs">This FWD can't play in this browser yet.</p>
            }
          </div>
        )}
      </div>
    );
  }

  // ── GIF / image mode ────────────────────────────────────────────────────────
  if (isGifImgMode) {
    const imgSrc = imgErrored
      ? (resolvedPoster || '')
      : (safari ? withCacheBust(resolvedGif!, 'fwd_sf', String(cacheKey || resolved.cacheKey || '1')) : resolvedGif!);
    // Safari backdrop-filter compositing bug fix
    const safariStyle: React.CSSProperties = safari ? { WebkitBackfaceVisibility: 'hidden' } : {};

    return (
      <img
        src={imgSrc}
        alt={title}
        draggable={false}
        loading={lazy && !safari ? 'lazy' : 'eager'}
        decoding={safari ? 'auto' : 'async'}
        className={className}
        style={objFit ? { objectFit: objFit, ...safariStyle, ...style } : { ...safariStyle, ...style }}
        onLoad={(e) => {
          const img = e.currentTarget;
          // 1×1 pixel placeholder detection — treat as broken
          if (img.naturalWidth <= 1 || img.naturalHeight <= 1) { onError?.(); return; }
          onLoad?.();
        }}
        onError={() => {
          if (!imgErrored && resolvedPoster) setImgErrored(true);
          else onError?.();
        }}
      />
    );
  }

  return null;
}

export default FwdMediaPlayer;
