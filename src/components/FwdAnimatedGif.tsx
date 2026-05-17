import React, { useEffect, useMemo, useRef, useState } from 'react';

export type FwdAnimatedGifProps = {
  gifUrl: string;
  stillUrl?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  lazy?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill';
  onError?: () => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
};

const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|ogv|ogg)(?:[?#].*)?$/i;
const GIF_EXT_RE = /\.gif(?:[?#].*)?$/i;
const SAFARI_RE = /^((?!chrome|android|crios|fxios|edgios).)*safari/i;

const isSafari = () =>
  typeof navigator !== 'undefined' && SAFARI_RE.test(navigator.userAgent);

const mediaTypeForUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4')) return 'video/mp4';
  if (lower.includes('.m4v')) return 'video/mp4';
  if (lower.includes('.mov')) return 'video/quicktime';
  if (lower.includes('.webm')) return 'video/webm';
  if (lower.includes('.ogv') || lower.includes('.ogg')) return 'video/ogg';
  return undefined;
};

const safariVideoUrlForGif = (url: string) => {
  if (!GIF_EXT_RE.test(url)) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const isProviderGif =
      host.includes('giphy.com') ||
      host.includes('tenor.com') ||
      host.includes('gifs.com');

    if (!isProviderGif) return '';
    parsed.pathname = parsed.pathname.replace(/\.gif$/i, '.mp4');
    return parsed.toString();
  } catch {
    return url.replace(/\.gif(\?.*)?$/i, '.mp4$1');
  }
};

export function FwdAnimatedGif({
  gifUrl,
  stillUrl,
  title = 'Animated GIF',
  className,
  style,
  width,
  height,
  lazy = true,
  objectFit = 'cover',
  onError,
  onLoad,
}: FwdAnimatedGifProps) {
  const [errored, setErrored] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = errored ? (stillUrl || '') : (gifUrl || stillUrl || '');
  const safariVideoSrc = useMemo(
    () => (src && isSafari() ? safariVideoUrlForGif(src) : ''),
    [src]
  );
  const videoSrc = safariVideoSrc || src;
  const renderAsVideo = useMemo(
    () => Boolean(src && !videoFailed && (VIDEO_EXT_RE.test(src) || safariVideoSrc)),
    [safariVideoSrc, src, videoFailed]
  );
  const safariGif = useMemo(
    () => Boolean(src && GIF_EXT_RE.test(src) && isSafari()),
    [src]
  );

  const handleError = () => {
    if (!errored && stillUrl) {
      setErrored(true);
    } else {
      onError?.();
    }
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
      onError?.();
      return;
    }
    onLoad?.(e);
  };

  const handleVideoError = () => {
    setVideoFailed(true);
    if (!stillUrl && !safariVideoSrc) onError?.();
  };

  useEffect(() => {
    setErrored(false);
    setVideoFailed(false);
  }, [gifUrl, stillUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !renderAsVideo) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const play = () => {
      void video.play().catch(() => {
        // Safari may defer playback until canplay/visibility changes.
      });
    };

    play();
    video.addEventListener('canplay', play);
    document.addEventListener('visibilitychange', play);

    return () => {
      video.removeEventListener('canplay', play);
      document.removeEventListener('visibilitychange', play);
    };
  }, [renderAsVideo, videoSrc]);

  if (!src) return null;

  if (renderAsVideo) {
    const type = mediaTypeForUrl(videoSrc);

    return (
      <video
        ref={videoRef}
        key={videoSrc}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        poster={stillUrl}
        draggable={false}
        className={className}
        style={objectFit !== 'cover' ? { objectFit, ...style } : style}
        onError={handleVideoError}
      >
        <source src={videoSrc} type={type} />
      </video>
    );
  }

  const safariGifStyle: React.CSSProperties = safariGif
    ? { WebkitBackfaceVisibility: 'hidden' }
    : {};

  return (
    <img
      key={safariGif ? src : undefined}
      src={src}
      alt={title}
      width={width}
      height={height}
      loading={lazy && !safariGif ? 'lazy' : 'eager'}
      decoding={safariGif ? 'auto' : 'async'}
      draggable={false}
      className={className}
      style={
        objectFit !== 'cover'
          ? { objectFit, ...safariGifStyle, ...style }
          : { ...safariGifStyle, ...style }
      }
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

export default FwdAnimatedGif;
