export type FwdMediaType = 'gif' | 'video' | 'image' | 'unknown';

export type FwdMediaLike = {
  gif_url?: string | null;
  image_url?: string | null;
  image?: string | null;
  media_url?: string | null;
  source_url?: string | null;
  preview_url?: string | null;
  thumbnail_url?: string | null;
  still_url?: string | null;
  poster_url?: string | null;
  source_video_url?: string | null;
  mp4_url?: string | null;
  webm_url?: string | null;
  media_type?: string | null;
  is_animated?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ResolvedFwdMedia = {
  animatedUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: FwdMediaType;
  shouldUseVideo: boolean;
  gifUrl: string | null;
  mp4Url: string | null;
  webmUrl: string | null;
  sourceVideoUrl: string | null;
  isLikelyAnimated: boolean;
  cacheKey: string;
};

const GIF_RE = /\.gif(?:[?#].*)?$/i;
const MP4_RE = /\.(mp4|m4v|mov)(?:[?#].*)?$/i;
const WEBM_RE = /\.(webm|ogv|ogg)(?:[?#].*)?$/i;
const STILL_RE = /\.(png|jpe?g|webp|avif)(?:[?#].*)?$/i;

const cleanUrl = (value?: string | null) => {
  const next = typeof value === 'string' ? value.trim() : '';
  return next || null;
};

const firstUrl = (...values: Array<string | null | undefined>) =>
  values.map(cleanUrl).find(Boolean) || null;

export const isGifUrl = (value?: string | null) => Boolean(value && GIF_RE.test(value));
export const isMp4Url = (value?: string | null) => Boolean(value && MP4_RE.test(value));
export const isWebmUrl = (value?: string | null) => Boolean(value && WEBM_RE.test(value));
export const isVideoUrl = (value?: string | null) => isMp4Url(value) || isWebmUrl(value);
export const isStillImageUrl = (value?: string | null) => Boolean(value && STILL_RE.test(value));

const isGifMime = (value?: string | null) => value?.toLowerCase() === 'image/gif';
const isVideoMime = (value?: string | null) => value?.toLowerCase().startsWith('video/');

export function resolveFwdMedia(item: FwdMediaLike): ResolvedFwdMedia {
  const mediaTypeHint = item.media_type?.toLowerCase() || '';
  const poster = firstUrl(item.still_url, item.poster_url, item.thumbnail_url, item.preview_url);
  const explicitGif = firstUrl(item.gif_url, item.image_url, item.image);
  const mediaUrl = firstUrl(item.media_url, item.source_url);
  const sourceVideo = firstUrl(item.source_video_url);

  const mp4Url = firstUrl(
    item.mp4_url,
    isMp4Url(explicitGif) ? explicitGif : null,
    isMp4Url(mediaUrl) ? mediaUrl : null,
    isMp4Url(sourceVideo) ? sourceVideo : null,
  );
  const webmUrl = firstUrl(
    item.webm_url,
    isWebmUrl(explicitGif) ? explicitGif : null,
    isWebmUrl(mediaUrl) ? mediaUrl : null,
    isWebmUrl(sourceVideo) ? sourceVideo : null,
  );

  const gifCandidate = firstUrl(
    isGifUrl(explicitGif) || isGifMime(mediaTypeHint) ? explicitGif : null,
    isGifUrl(mediaUrl) ? mediaUrl : null,
  );

  const videoCandidate = firstUrl(
    mp4Url,
    webmUrl,
    isVideoMime(mediaTypeHint) && explicitGif ? explicitGif : null,
    isVideoUrl(mediaUrl) ? mediaUrl : null,
    sourceVideo,
  );

  const explicitLooksStill = Boolean(explicitGif && isStillImageUrl(explicitGif));
  const gifMarkedStill = item.is_animated === false && Boolean(sourceVideo);

  if ((explicitLooksStill || gifMarkedStill || (!gifCandidate && videoCandidate)) && videoCandidate) {
    return {
      animatedUrl: videoCandidate,
      thumbnailUrl: poster || (explicitLooksStill ? explicitGif : null),
      mediaType: 'video',
      shouldUseVideo: true,
      gifUrl: null,
      mp4Url: mp4Url || (isMp4Url(videoCandidate) ? videoCandidate : null),
      webmUrl: webmUrl || (isWebmUrl(videoCandidate) ? videoCandidate : null),
      sourceVideoUrl: sourceVideo,
      isLikelyAnimated: true,
      cacheKey: item.updated_at || item.created_at || videoCandidate,
    };
  }

  if (gifCandidate) {
    const explicitMp4 = firstUrl(
      item.mp4_url,
      isMp4Url(explicitGif) ? explicitGif : null,
      isMp4Url(mediaUrl) ? mediaUrl : null,
    );
    const explicitWebm = firstUrl(
      item.webm_url,
      isWebmUrl(explicitGif) ? explicitGif : null,
      isWebmUrl(mediaUrl) ? mediaUrl : null,
    );
    return {
      animatedUrl: gifCandidate,
      thumbnailUrl: poster,
      mediaType: 'gif',
      shouldUseVideo: false,
      gifUrl: gifCandidate,
      mp4Url: explicitMp4,
      webmUrl: explicitWebm,
      sourceVideoUrl: sourceVideo,
      isLikelyAnimated: item.is_animated ?? true,
      cacheKey: item.updated_at || item.created_at || gifCandidate,
    };
  }

  if (videoCandidate) {
    return {
      animatedUrl: videoCandidate,
      thumbnailUrl: poster,
      mediaType: 'video',
      shouldUseVideo: true,
      gifUrl: null,
      mp4Url: mp4Url || (isMp4Url(videoCandidate) ? videoCandidate : null),
      webmUrl: webmUrl || (isWebmUrl(videoCandidate) ? videoCandidate : null),
      sourceVideoUrl: sourceVideo,
      isLikelyAnimated: true,
      cacheKey: item.updated_at || item.created_at || videoCandidate,
    };
  }

  const still = firstUrl(explicitGif, mediaUrl, poster);
  return {
    animatedUrl: still,
    thumbnailUrl: poster || still,
    mediaType: still ? 'image' : 'unknown',
    shouldUseVideo: false,
    gifUrl: null,
    mp4Url: null,
    webmUrl: null,
    sourceVideoUrl: sourceVideo,
    isLikelyAnimated: false,
    cacheKey: item.updated_at || item.created_at || still || '',
  };
}
