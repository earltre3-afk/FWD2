import React from 'react';
import { Gif } from '@/contexts/AppContext';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';

interface Props {
  gif: Gif;
  onError?: () => void;
}

type RemixLayout = {
  placement?: string;
  overlayShape?: string;
  scale?: number;
};

const PLACEMENT_STYLES: Record<string, React.CSSProperties> = {
  'bottom-right': { bottom: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'top-left': { top: 8, left: 8 },
  'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
};

function OverlayMedia({ url, type }: { url: string; type?: string | null }) {
  const isVideo = type?.startsWith('video/') || /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url);
  const onError = (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    if (import.meta.env.DEV) {
      console.warn('[RemixMediaRenderer] overlay media failed to load', { url, type, target: (e.target as any)?.tagName });
    }
  };
  if (isVideo) {
    return (
      <video
        src={url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        onError={onError}
      />
    );
  }
  return <img src={url} alt="" className="w-full h-full object-cover" onError={onError} />;
}

const RemixMediaRenderer: React.FC<Props> = ({ gif, onError }) => {
  const mode = gif.remix_mode;
  const remixUrl = gif.remix_media_url;
  const layout = (gif.remix_layout as RemixLayout | null) || {};
  const placement = layout.placement || 'bottom-right';
  const overlayShape = layout.overlayShape || 'rounded';
  const scale = layout.scale ?? 0.35;

  if (import.meta.env.DEV && gif.is_remix) {
    // eslint-disable-next-line no-console
    console.log('[RemixMediaRenderer]', {
      id: gif.id,
      is_remix: gif.is_remix,
      remix_mode: mode,
      base_image_https: gif.image?.startsWith('https://') ?? false,
      base_image_blob: gif.image?.startsWith('blob:') ?? false,
      base_mp4_present: !!gif.mp4_url,
      remix_media_url_present: !!remixUrl,
      remix_media_url_https: remixUrl?.startsWith('https://') ?? false,
      remix_media_url_blob: remixUrl?.startsWith('blob:') ?? false,
      remix_media_type: gif.remix_media_type,
    });
  }

  const basePlayerProps = {
    mp4Url: gif.mp4_url,
    webmUrl: gif.webm_url,
    gifUrl: gif.image,
    posterUrl: gif.still_url,
    sourceVideoUrl: gif.source_video_url,
    mediaType: gif.media_type,
    isAnimated: gif.is_animated,
    editMetadata: gif.edit_metadata,
    trimStart: gif.trim_start,
    trimEnd: gif.trim_end,
    cropX: gif.crop_x,
    cropY: gif.crop_y,
    cropWidth: gif.crop_width,
    cropHeight: gif.crop_height,
    cropAspectRatio: gif.crop_aspect_ratio,
    outputAspectRatio: gif.output_aspect_ratio,
    title: gif.title,
    className: 'w-full h-full object-cover',
    onError,
  };

  // No remix mode, replace mode, text mode, or no remix_media_url: base player only
  if (!mode || mode === 'replace' || mode === 'text' || !remixUrl) {
    return <FwdMediaPlayer {...basePlayerProps} />;
  }

  // Split mode: original on left, remix on right
  if (mode === 'split') {
    return (
      <div className="w-full h-full flex">
        <div className="flex-1 h-full overflow-hidden">
          <FwdMediaPlayer {...basePlayerProps} />
        </div>
        <div className="w-px bg-white/20 shrink-0" />
        <div className="flex-1 h-full overflow-hidden">
          <OverlayMedia url={remixUrl} type={gif.remix_media_type} />
        </div>
      </div>
    );
  }

  // Reaction / AI Blend: base player + positioned overlay
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    width: `${Math.round(scale * 100)}%`,
    aspectRatio: overlayShape === 'circle' ? '1 / 1' : '1 / 1',
    borderRadius: overlayShape === 'circle' ? '9999px' : overlayShape === 'sharp' ? '0' : '12px',
    overflow: 'hidden',
    border: '2px solid rgba(255, 255, 255, 0.25)',
    zIndex: 10,
    ...(PLACEMENT_STYLES[placement] ?? PLACEMENT_STYLES['bottom-right']),
  };

  return (
    <div className="w-full h-full relative">
      <FwdMediaPlayer {...basePlayerProps} />
      <div style={overlayStyle}>
        <OverlayMedia url={remixUrl} type={gif.remix_media_type} />
      </div>
    </div>
  );
};

export default RemixMediaRenderer;
