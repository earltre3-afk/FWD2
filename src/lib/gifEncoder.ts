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
 *
 * MediaRecorder blobs have duration=Infinity and no seek index, so frame-seek
 * produces black frames. We detect that case and play the video in real time,
 * capturing raw pixel data as it plays, then encode all frames afterward.
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

  // MediaRecorder blobs report duration=Infinity — can't seek them
  const seekable = isFinite(video.duration) && video.duration > 0;
  const endSec = seekable
    ? Math.min(opts.endSec ?? video.duration, video.duration, 10)
    : Math.min(opts.endSec ?? 10, 10);

  const frameDurationMs = 1000 / fps;
  const gifDelay = Math.round(frameDurationMs / 10); // gifenc uses 1/100s units

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const encoder = GIFEncoder();

  if (seekable) {
    // Uploaded file with proper duration — seek to each frame position
    const totalFrames = Math.ceil(((endSec - startSec) * 1000) / frameDurationMs);
    let framesEncoded = 0;
    for (let t = startSec * 1000; t < endSec * 1000; t += frameDurationMs) {
      video.currentTime = t / 1000;
      await new Promise<void>((res) => {
        video.onseeked = () => res();
        setTimeout(res, 500);
      });
      ctx.drawImage(video, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      encoder.writeFrame(index, width, height, { palette, delay: gifDelay });
      framesEncoded++;
      onProgress?.(Math.round((framesEncoded / totalFrames) * 100));
    }
  } else {
    // MediaRecorder blob (duration=Infinity): play in real time and capture raw
    // pixel data each frame. Encoding happens after playback so the heavy
    // quantize() calls don't stall the video.
    //
    // Attach to DOM: off-screen video elements skip hardware decoding on some
    // Chrome builds, producing black drawImage() calls.
    video.style.cssText =
      'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:0;left:0';
    document.body.appendChild(video);

    try {
      if (startSec > 0) {
        video.currentTime = startSec;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
          setTimeout(res, 1000);
        });
      }

      const rawFrames: Uint8ClampedArray[] = [];
      const durationMs = (endSec - startSec) * 1000;

      await new Promise<void>((resolve) => {
        let captureStart = 0;
        let lastCapture = -Infinity;

        const loop = () => {
          // captureStart is set on the first RAF after `playing` fires,
          // so timing is relative to actual decoded playback, not clock skew.
          if (!captureStart) captureStart = performance.now();
          const elapsed = performance.now() - captureStart;

          if (elapsed >= durationMs || video.ended) {
            video.pause();
            resolve();
            return;
          }

          const now = performance.now();
          if (now - lastCapture >= frameDurationMs) {
            ctx.drawImage(video, 0, 0, width, height);
            rawFrames.push(
              new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data)
            );
            lastCapture = now;
          }

          requestAnimationFrame(loop);
        };

        // `playing` fires only after the browser has decoded the first real
        // frame — unlike play().then() which resolves before any frame is ready.
        video.onplaying = () => requestAnimationFrame(loop);
        video.play().catch(() => resolve());
      });

      // Encode all captured frames
      for (let i = 0; i < rawFrames.length; i++) {
        const data = rawFrames[i];
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        encoder.writeFrame(index, width, height, { palette, delay: gifDelay });
        onProgress?.(Math.round(((i + 1) / rawFrames.length) * 100));
      }

      if (rawFrames.length === 0) {
        throw new Error('No frames captured from recording. Try recording for at least 1 second.');
      }
    } finally {
      if (document.body.contains(video)) document.body.removeChild(video);
    }
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
