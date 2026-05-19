export interface DownloadFwdMediaArgs {
  url: string;
  filename: string;
  mimeType?: string;
}

export async function downloadFwdMedia({ url, filename, mimeType }: DownloadFwdMediaArgs): Promise<'downloaded' | 'opened'> {
  // Pre-create the anchor while still in the synchronous user-gesture window.
  // iOS Safari only respects programmatic clicks that originate from a user gesture;
  // awaiting a network request moves us out of that window, but an anchor element
  // created here retains the gesture context when clicked after the await.
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);

  try {
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error('fetch failed');
    const blob = await response.blob();

    if (isNative) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        
        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = reader.result as string;
            // remove data URL prefix
            resolve(b64.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          url: savedFile.uri,
          title: filename,
          dialogTitle: 'Save or Share File'
        });
        
        return 'downloaded';
      } catch (err) {
        console.error('Native download failed:', err);
        // Fallback to regular web approach if native fails
      }
    }

    const objectUrl = URL.createObjectURL(mimeType ? new Blob([blob], { type: mimeType }) : blob);
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return 'downloaded';
  } catch {
    // CORS or network failure — open the raw URL in a new tab.
    // target="_blank" prevents navigating the current page away.
    anchor.href = url;
    anchor.target = '_blank';
    anchor.click();
    return 'opened';
  } finally {
    document.body.removeChild(anchor);
  }
}

export function cleanFwdFilename(title: string | null | undefined, extension: string): string {
  const slug = (title || 'fwd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'fwd';
  return `fwd-${slug}.${extension.replace(/^\./, '')}`;
}
