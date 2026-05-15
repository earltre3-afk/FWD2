import React from 'react';

interface Props {
  /** px height of the logo image; width auto-scales. */
  size?: number;
  /** Extra className for the wrapping <img>. */
  className?: string;
  /** Optional accessible label override. */
  alt?: string;
}

/**
 * Trey TV brand logo. Served as a static asset from /public/trey-tv-logo.png.
 * Falls back to a small "TV" gradient badge if the asset fails to load
 * (e.g. during local dev before the file is dropped in).
 */
const TreyTvLogo: React.FC<Props> = ({ size = 22, className = '', alt = 'Trey TV' }) => {
  const [errored, setErrored] = React.useState(false);

  if (errored) {
    return (
      <span
        aria-label={alt}
        className={`inline-flex items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-pink-500 text-[10px] font-black text-black ${className}`}
        style={{ width: size, height: size }}
      >
        TV
      </span>
    );
  }

  return (
    <img
      src="/trey-tv-logo.png"
      alt={alt}
      height={size}
      style={{ height: size, width: 'auto' }}
      className={`inline-block select-none ${className}`}
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
};

export default TreyTvLogo;
