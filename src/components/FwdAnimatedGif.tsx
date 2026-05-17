import React from 'react';
import { FwdMediaPlayer } from './FwdMediaPlayer';

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
}: FwdAnimatedGifProps) {
  const isMp4 = MP4_EXT_RE.test(gifUrl);
  const isWebm = WEBM_EXT_RE.test(gifUrl);

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
    />
  );
}

export default FwdAnimatedGif;
