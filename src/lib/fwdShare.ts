import { supabase } from '@/lib/supabase';

export const FWD_APP_URL =
  (import.meta.env.VITE_FWD_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://fwd.treytv.com';

export function getFwdShareUrl(postId: string): string {
  return `${FWD_APP_URL}/f/${postId}`;
}

export type ShareResult = 'native' | 'copied' | 'cancelled' | 'error';

/**
 * Share a FWD via native Web Share API or clipboard fallback.
 * Never throws — always returns a result code.
 */
export async function shareFwd(
  postId: string,
  opts?: { caption?: string }
): Promise<ShareResult> {
  const url = getFwdShareUrl(postId);
  const title = 'You got a FWD';
  const text = opts?.caption
    ? `${opts.caption.slice(0, 120)} — Open it, remix it, or send one back.`
    : 'Open this FWD, remix it, or send one back.';

  // Native Web Share API (mobile browsers)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'native';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Fall through to clipboard
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    // execCommand fallback for older/restricted browsers
    try {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return 'copied';
    } catch {
      return 'error';
    }
  }
}

/**
 * Record a share event in analytics.
 * Fires and forgets — never blocks the user.
 */
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

/**
 * Record a share link open (called on /f/:id page mount).
 * Fires and forgets — never blocks rendering.
 */
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
