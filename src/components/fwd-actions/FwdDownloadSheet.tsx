import React, { useMemo, useState } from 'react';
import { Download, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Gif } from '@/contexts/AppContext';
import { cleanFwdFilename, downloadFwdMedia } from '@/lib/downloadFwdMedia';
import { copyFwdLink } from '@/lib/fwdShare';
import { toast } from '@/components/ui/use-toast';

interface FwdDownloadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gif: Gif | null;
  shareId?: string;
}

const FwdDownloadSheet: React.FC<FwdDownloadSheetProps> = ({ open, onOpenChange, gif, shareId }) => {
  const [downloading, setDownloading] = useState<string | null>(null);
  const options = useMemo(() => {
    if (!gif) return [];
    const items: Array<{ key: string; label: string; url: string; filename: string; mimeType: string }> = [];
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
    const actionLabel = isNative ? 'Save / Share' : 'Download';

    if (gif.image && (gif.media_type === 'image/gif' || /\.gif($|\?)/i.test(gif.image))) {
      items.push({ key: 'gif', label: `${actionLabel} GIF`, url: gif.image, filename: cleanFwdFilename(gif.title, 'gif'), mimeType: 'image/gif' });
    }
    const mp4Url = gif.mp4_url || (/\.mp4($|\?)/i.test(gif.source_video_url || '') ? gif.source_video_url : undefined);
    if (mp4Url) {
      items.push({ key: 'mp4', label: `${actionLabel} MP4`, url: mp4Url, filename: cleanFwdFilename(gif.title, 'mp4'), mimeType: 'video/mp4' });
    }
    return items;
  }, [gif]);

  const runDownload = async (option: typeof options[number]) => {
    setDownloading(option.key);
    try {
      await downloadFwdMedia(option);
      toast({ title: 'Download started' });
    } catch {
      toast({ title: 'Download failed. Try another format.', variant: 'destructive' });
    } finally {
      setDownloading(null);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="center"
        className="glass-strong border-fuchsia-500/30 rounded-2xl px-5 pt-5 pb-5 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Download FWD</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => runDownload(option)}
              disabled={Boolean(downloading)}
              className="w-full flex items-center justify-between rounded-xl border border-fuchsia-500/25 bg-black/35 px-4 py-3 text-left text-sm font-bold text-white disabled:opacity-60"
            >
              <span className="flex items-center gap-2"><Download size={16} />{option.label}</span>
              {downloading === option.key && <Loader2 size={16} className="animate-spin" />}
            </button>
          ))}
          {options.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-400">
              This format is not available yet.
            </p>
          )}
          {shareId && (
            <button
              type="button"
              onClick={async () => {
                const copied = await copyFwdLink(shareId);
                toast({ title: copied ? 'FWD link copied.' : 'Couldn’t share or copy this FWD.', variant: copied ? 'default' : 'destructive' });
                if (copied) onOpenChange(false);
              }}
              className="w-full flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-zinc-200"
            >
              <LinkIcon size={16} /> Copy FWD Link
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FwdDownloadSheet;
