import React from 'react';
import { FwdMediaPlayer } from './FwdMediaPlayer';
import type { MediaEditMetadata } from '@/lib/mediaEdits';

export type FwdAnimatedGifProps = {
  gifUrl: string;
  stillUrl?: string;
  sourceVideoUrl?: string;
  mediaType?: string;
  isAnimated?: boolean | null;
  mp4Url?: string;
  webmUrl?: string;
  cacheKey?: string | number | null;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Unused — kept for call-site compat; sizing via className/style is preferred */
  width?: number;
  height?: number;
  lazy?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill';
  onError?: () => void;
  onLoad?: () => void;
  editMetadata?: MediaEditMetadata | null;
  trimStart?: number | null;
  trimEnd?: number | null;
  cropX?: number | null;
  cropY?: number | null;
  cropWidth?: number | null;
  cropHeight?: number | null;
  cropAspectRatio?: string | null;
  outputAspectRatio?: string | null;
};

const MP4_EXT_RE = /\.(mp4|m4v|mov)(?:[?#].*)?$/i;
const WEBM_EXT_RE = /\.(webm|ogv|ogg)(?:[?#].*)?$/i;

export function FwdAnimatedGif({
  gifUrl,
  stillUrl,
  sourceVideoUrl,
  mediaType,
  isAnimated,
  mp4Url,
  webmUrl,
  cacheKey,
  title,
  className,
  style,
  lazy,
  objectFit,
  onError,
  onLoad,
  editMetadata,
  trimStart,
  trimEnd,
  cropX,
  cropY,
  cropWidth,
  cropHeight,
  cropAspectRatio,
  outputAspectRatio,
}: FwdAnimatedGifProps) {
  // Route the URL to the correct prop. Extension regex catches https URLs with
  // .mp4/.webm; mediaType catches blob: URLs (no extension) and CDN URLs that
  // do not advertise an extension. Use startsWith for the MIME check —
  // MediaRecorder hands back values like `video/webm;codecs=vp8`, so an
  // exact-equality compare to 'video/webm' was rejecting recorded blobs and
  // they fell through to FwdMediaPlayer, where resolveFwdMedia drops the blob
  // URL → empty render → black preview after Stop Recording.
  const isMp4ByExt = MP4_EXT_RE.test(gifUrl);
  const isWebmByExt = WEBM_EXT_RE.test(gifUrl);
  const mt = (mediaType || '').toLowerCase();
  const isVideoByMime = mt.startsWith('video/');
  const isMp4ByMime = mt.startsWith('video/mp4') || mt.startsWith('video/quicktime') || mt.startsWith('video/x-m4v');
  const isWebmByMime = mt.startsWith('video/webm') || mt.startsWith('video/ogg');
  const isMp4 = isMp4ByExt || isMp4ByMime;
  const isWebm = isWebmByExt || isWebmByMime;

  // Blob URLs always need to be rendered through a <video> source when the
  // media is video — FwdMediaPlayer's resolveFwdMedia drops blob URLs.
  // For blob video previews, render a native <video> directly. We trust
  // isVideoByMime here so non-vp8/vp9 codec variants still hit this branch.
  const isBlob = typeof gifUrl === 'string' && gifUrl.startsWith('blob:');
  if (isBlob && (isVideoByMime || isMp4 || isWebm)) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[FwdAnimatedGif] blob video preview', { mediaType: mt, isMp4, isWebm });
    }
    return (
      <video
        src={gifUrl}
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        preload="auto"
        className={className}
        style={style}
        onLoadedData={() => onLoad?.()}
        onError={() => onError?.()}
      />
    );
  }
  // Blob URLs that are images (uploaded image preview before transcode)
  if (isBlob) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[FwdAnimatedGif] blob image preview', { mediaType: mt });
    }
    return (
      <img
        src={gifUrl}
        alt={title}
        draggable={false}
        className={className}
        style={style}
        onLoad={() => onLoad?.()}
        onError={() => onError?.()}
      />
    );
  }

  return (
    <FwdMediaPlayer
      mp4Url={mp4Url || (isMp4 ? gifUrl : null)}
      webmUrl={webmUrl || (isWebm ? gifUrl : null)}
      gifUrl={isMp4 || isWebm ? null : gifUrl}
      posterUrl={stillUrl}
      sourceVideoUrl={sourceVideoUrl}
      mediaType={mediaType}
      isAnimated={isAnimated}
      cacheKey={cacheKey}
      title={title}
      className={className}
      style={style}
      objectFit={objectFit}
      lazy={lazy}
      onError={onError}
      onLoad={onLoad}
      editMetadata={editMetadata}
      trimStart={trimStart}
      trimEnd={trimEnd}
      cropX={cropX}
      cropY={cropY}
      cropWidth={cropWidth}
      cropHeight={cropHeight}
      cropAspectRatio={cropAspectRatio}
      outputAspectRatio={outputAspectRatio}
    />
  );
}

export default FwdAnimatedGif;
