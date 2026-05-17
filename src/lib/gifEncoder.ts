export interface GifEncodeOptions {
  width?: number;
  height?: number;
  fps?: number;
  startSec?: number;
  endSec?: number;
  onProgress?: (pct: number) => void;
}

/**
 * Encodes a video File to an animated GIF Blob.
 * Lazy-loads gifenc so it's never in the initial bundle.
 */
export async function videoFileToGif(
  file: File,
  opts: GifEncodeOptions = {}
): Promise<Blob> {
  const {
    width = 320,
    height = 320,
    fps = 10,
    startSec = 0,
    onProgress,
  } = opts;

  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error('Could not load video'));
    setTimeout(() => rej(new Error('Video load timeout')), 15000);
  });

  const endSec = Math.min(opts.endSec ?? video.duration, video.duration, 10);
  const frameDurationMs = 1000 / fps;
  const gifDelay = Math.round(frameDurationMs / 10); // 1/100s units

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const totalFrames = Math.ceil(((endSec - startSec) * 1000) / frameDurationMs);
  let framesEncoded = 0;

  const encoder = GIFEncoder();

  for (let t = startSec * 1000; t < endSec * 1000; t += frameDurationMs) {
    video.currentTime = t / 1000;
    await new Promise<void>((res) => {
      video.onseeked = () => res();
      // Fallback if onseeked never fires
      setTimeout(res, 300);
    });

    ctx.drawImage(video, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    encoder.writeFrame(index, width, height, { palette, delay: gifDelay });

    framesEncoded++;
    onProgress?.(Math.round((framesEncoded / totalFrames) * 100));
  }

  encoder.finish();
  URL.revokeObjectURL(url);

  return new Blob([encoder.bytes()], { type: 'image/gif' });
}

/**
 * Converts an image File to a single-frame GIF Blob.
 */
export async function imageFileToGif(
  file: File,
  opts: Pick<GifEncodeOptions, 'width' | 'height'> = {}
): Promise<Blob> {
  const { width = 320, height = 320 } = opts;
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;

  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Could not load image'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  URL.revokeObjectURL(url);

  const encoder = GIFEncoder();
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);
  encoder.writeFrame(index, width, height, { palette, delay: 10 });
  encoder.finish();

  return new Blob([encoder.bytes()], { type: 'image/gif' });
}
