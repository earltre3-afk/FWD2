export interface DownloadFwdMediaArgs {
  url: string;
  filename: string;
  mimeType?: string;
}

export async function downloadFwdMedia({ url, filename, mimeType }: DownloadFwdMediaArgs): Promise<'downloaded' | 'opened'> {
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error('download failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(mimeType ? new Blob([blob], { type: mimeType }) : blob);
    triggerAnchorDownload(objectUrl, filename);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return 'downloaded';
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'opened';
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

function triggerAnchorDownload(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
