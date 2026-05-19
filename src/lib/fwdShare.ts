import { supabase } from '@/lib/supabase';

export const FWD_APP_URL =
  (import.meta.env.VITE_FWD_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://fwd.treytv.com';

export function getFwdShareUrl(postId: string): string {
  return `${FWD_APP_URL}/f/${postId}`;
}

export type ShareResult = 'native-opened' | 'copied' | 'cancelled' | 'failed';

interface ShareFwdItemArgs {
  id: string;
  title?: string | null;
  caption?: string | null;
  absoluteUrl?: string;
}

const isShareCancellation = (error: unknown): boolean => {
  const err = error as { name?: string; message?: string };
  const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase();
  return text.includes('abort') || text.includes('cancel');
};

export async function copyFwdLink(id: string, absoluteUrl?: string): Promise<boolean> {
  const url = absoluteUrl || getFwdShareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

export async function shareFwdItem({
  id,
  title,
  caption,
  absoluteUrl,
}: ShareFwdItemArgs): Promise<ShareResult> {
  const url = absoluteUrl || getFwdShareUrl(id);
  const payload = {
    title: title || 'You got a FWD',
    text: caption || 'Open this FWD, remix it, or send one back.',
    url,
  };

  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
        dialogTitle: 'Share FWD',
      });
      return 'native-opened';
    } catch (error) {
      if (isShareCancellation(error)) return 'cancelled';
    }
  } else if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(payload);
      return 'native-opened';
    } catch (error) {
      if (isShareCancellation(error)) return 'cancelled';
    }
  }

  return (await copyFwdLink(id, url)) ? 'copied' : 'failed';
}

export async function shareFwd(
  postId: string,
  opts?: { caption?: string }
): Promise<ShareResult> {
  return shareFwdItem({
    id: postId,
    caption: opts?.caption
      ? `${opts.caption.slice(0, 120)} - Open it, remix it, or send one back.`
      : undefined,
  });
}

export function recordShare(
  fwdId: string,
  opts?: { sharedBy?: string; channel?: ShareResult }
): void {
  supabase
    .from('fwd_shares')
    .insert({
      fwd_id: fwdId,
      shared_by: opts?.sharedBy ?? null,
      share_channel: opts?.channel ?? null,
      user_agent: navigator.userAgent.slice(0, 250),
    })
    .then(() => {/* intentionally ignored */});
}

export function trackShareOpen(
  fwdId: string,
  opts?: { shareToken?: string; openedBy?: string }
): void {
  const record = async () => {
    let shareId: string | null = null;

    if (opts?.shareToken) {
      const { data } = await supabase
        .from('fwd_shares')
        .select('id')
        .eq('share_token', opts.shareToken)
        .maybeSingle();
      shareId = data?.id ?? null;
    }

    await supabase.from('fwd_share_opens').insert({
      fwd_id: fwdId,
      share_id: shareId,
      opened_by: opts?.openedBy ?? null,
      referrer: (document.referrer || '').slice(0, 250) || null,
      user_agent: navigator.userAgent.slice(0, 250),
    });
  };

  record().catch(() => {/* never block */});
}
