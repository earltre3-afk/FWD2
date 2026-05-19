/**
 * blobGuard.ts
 * Utilities to prevent transient blob: URLs from being persisted to the database.
 *
 * Blob URLs are temporary object URLs created via URL.createObjectURL().
 * They are only valid for the lifetime of the current browser tab and must
 * NEVER be stored in Supabase or any other persistent store.
 */

/** Returns true if the URL is a transient blob object URL. */
export const isBlobUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.startsWith('blob:');
};

/** Returns true if the URL is a safe, persistent HTTPS URL. */
export const isPermUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.startsWith('https://') || url.startsWith('http://');
};

/**
 * Media field names that are persisted to fwd_gifs.
 * Any of these must never contain a blob: URL.
 */
export const MEDIA_FIELDS = [
  'gif_url',
  'media_url',
  'mp4_url',
  'webm_url',
  'still_url',
  'thumbnail_url',
  'preview_url',
  'source_video_url',
  'image',
] as const;

export type MediaField = typeof MEDIA_FIELDS[number];

/**
 * Checks a partial GIF payload for any blob: URLs in media fields.
 * Returns an array of field names that contain blob: URLs.
 */
export const findBlobFields = (
  payload: Partial<Record<MediaField, string | null | undefined>>
): MediaField[] => {
  return MEDIA_FIELDS.filter((field) => isBlobUrl(payload[field] ?? undefined));
};

/**
 * Throws a descriptive error if any media field in the payload contains a blob: URL.
 * Call this before any Supabase insert/update that writes media URLs.
 */
export const assertNoBlobUrls = (
  payload: Partial<Record<MediaField, string | null | undefined>>,
  context = 'save'
): void => {
  const blobFields = findBlobFields(payload);
  if (blobFields.length > 0) {
    const msg = `[blobGuard] Blocked ${context}: blob: URL detected in field(s): ${blobFields.join(', ')}. Finish uploading media before saving.`;
    console.error(msg);
    throw new Error('Finish uploading media before saving.');
  }
};
