import type React from 'react';

export type MediaEditState = {
  trimStart: number;
  trimEnd: number;
  duration: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  cropAspectRatio: string | null;
  outputAspectRatio: string | null;
  speed: number;
  filters: Record<string, unknown>;
};

export type MediaEditMetadata = Partial<MediaEditState> & {
  originalDuration?: number | null;
  editedDuration?: number | null;
};

export const MAX_GIF_DURATION_SECONDS = 10;
const MIN_TRIM_SECONDS = 0.5;

export const DEFAULT_MEDIA_EDIT_STATE: MediaEditState = {
  trimStart: 0,
  trimEnd: 3,
  duration: 0,
  cropX: 0,
  cropY: 0,
  cropWidth: 1,
  cropHeight: 1,
  cropAspectRatio: null,
  outputAspectRatio: null,
  speed: 1,
  filters: {},
};

export function ratioToNumber(ratio?: string | null) {
  if (!ratio || ratio === 'Original') return null;
  const [w, h] = ratio.split(':').map(Number);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : null;
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, seconds);
  const whole = Math.floor(safe);
  const tenths = Math.round((safe - whole) * 10);
  return tenths ? `${whole}.${tenths}s` : `${whole}s`;
}

export function clampTrim(
  start: number,
  end: number,
  duration: number,
  maxDurationSeconds = MAX_GIF_DURATION_SECONDS,
) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : maxDurationSeconds;
  let trimStart = Math.max(0, Math.min(start, safeDuration - MIN_TRIM_SECONDS));
  let trimEnd = Math.max(trimStart + MIN_TRIM_SECONDS, Math.min(end, safeDuration));
  if (trimEnd - trimStart > maxDurationSeconds) trimEnd = trimStart + maxDurationSeconds;
  if (trimEnd > safeDuration) {
    trimEnd = safeDuration;
    trimStart = Math.max(0, trimEnd - maxDurationSeconds);
  }
  return {
    trimStart: Number(trimStart.toFixed(2)),
    trimEnd: Number(trimEnd.toFixed(2)),
  };
}

export function centeredCropForRatio(
  ratio: string | null,
  mediaWidth = 1,
  mediaHeight = 1,
) {
  const normalizedWidth = 1;
  const normalizedHeight = 1;
  const target = ratioToNumber(ratio);
  if (!target) {
    return {
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
      cropAspectRatio: null,
      outputAspectRatio: null,
    };
  }

  const sourceRatio = mediaWidth / mediaHeight;
  let cropWidth = normalizedWidth;
  let cropHeight = normalizedHeight;
  if (sourceRatio > target) {
    cropWidth = target / sourceRatio;
  } else {
    cropHeight = sourceRatio / target;
  }

  return {
    cropX: Number(((1 - cropWidth) / 2).toFixed(4)),
    cropY: Number(((1 - cropHeight) / 2).toFixed(4)),
    cropWidth: Number(cropWidth.toFixed(4)),
    cropHeight: Number(cropHeight.toFixed(4)),
    cropAspectRatio: ratio,
    outputAspectRatio: ratio,
  };
}

export function hasCrop(edit?: MediaEditMetadata | null) {
  if (!edit) return false;
  const cropWidth = Number(edit.cropWidth ?? 1);
  const cropHeight = Number(edit.cropHeight ?? 1);
  return Boolean(edit.outputAspectRatio || edit.cropAspectRatio || cropWidth < 0.999 || cropHeight < 0.999);
}

export function getCropAspectRatio(edit?: MediaEditMetadata | null) {
  return edit?.outputAspectRatio || edit?.cropAspectRatio || null;
}

export function buildEditMetadata(edit: MediaEditState): MediaEditMetadata {
  const trimmed = clampTrim(edit.trimStart, edit.trimEnd, edit.duration);
  return {
    trimStart: trimmed.trimStart,
    trimEnd: trimmed.trimEnd,
    duration: edit.duration,
    originalDuration: edit.duration || null,
    editedDuration: Number((trimmed.trimEnd - trimmed.trimStart).toFixed(2)),
    cropX: edit.cropX,
    cropY: edit.cropY,
    cropWidth: edit.cropWidth,
    cropHeight: edit.cropHeight,
    cropAspectRatio: edit.cropAspectRatio,
    outputAspectRatio: edit.outputAspectRatio,
    speed: edit.speed,
    filters: edit.filters,
  };
}

export function editMetadataFromDb(row: Record<string, unknown>): MediaEditMetadata {
  const raw = row.edit_metadata && typeof row.edit_metadata === 'object'
    ? row.edit_metadata as Record<string, unknown>
    : {};
  return {
    trimStart: Number(row.trim_start ?? raw.trimStart ?? 0),
    trimEnd: Number(row.trim_end ?? raw.trimEnd ?? 0),
    duration: Number(row.original_duration ?? raw.duration ?? 0),
    originalDuration: Number(row.original_duration ?? raw.originalDuration ?? 0) || null,
    editedDuration: Number(row.edited_duration ?? raw.editedDuration ?? 0) || null,
    cropX: Number(row.crop_x ?? raw.cropX ?? 0),
    cropY: Number(row.crop_y ?? raw.cropY ?? 0),
    cropWidth: Number(row.crop_width ?? raw.cropWidth ?? 1),
    cropHeight: Number(row.crop_height ?? raw.cropHeight ?? 1),
    cropAspectRatio: typeof row.crop_aspect_ratio === 'string' ? row.crop_aspect_ratio : (raw.cropAspectRatio as string | null) || null,
    outputAspectRatio: typeof row.output_aspect_ratio === 'string' ? row.output_aspect_ratio : (raw.outputAspectRatio as string | null) || null,
    speed: Number(raw.speed ?? 1),
    filters: raw.filters && typeof raw.filters === 'object' ? raw.filters as Record<string, unknown> : {},
  };
}

export function cropStyle(edit?: MediaEditMetadata | null): React.CSSProperties {
  const cropX = Math.max(0, Math.min(1, Number(edit?.cropX ?? 0)));
  const cropY = Math.max(0, Math.min(1, Number(edit?.cropY ?? 0)));
  const cropWidth = Math.max(0.05, Math.min(1, Number(edit?.cropWidth ?? 1)));
  const cropHeight = Math.max(0.05, Math.min(1, Number(edit?.cropHeight ?? 1)));
  return {
    width: `${100 / cropWidth}%`,
    height: `${100 / cropHeight}%`,
    left: `${-(cropX / cropWidth) * 100}%`,
    top: `${-(cropY / cropHeight) * 100}%`,
  };
}
