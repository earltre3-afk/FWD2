import React, { useState } from 'react';

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
}: FwdAnimatedGifProps) {
  const [errored, setErrored] = useState(false);
  const src = errored ? (stillUrl || '') : (gifUrl || stillUrl || '');

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
    }
  };

  if (!src) return null;

  return (
    <img
      src={src}
      alt={title}
      width={width}
      height={height}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      draggable={false}
      className={className}
      style={objectFit !== 'cover' ? { objectFit, ...style } : style}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

export default FwdAnimatedGif;
