// Trey TV OAuth bridge helper.
// Builds the authorize URL and manages the short-lived state token.
// No secrets live here. Token exchange happens server-side in the
// Supabase Edge Function `trey-tv-login-exchange`.

const STATE_KEY = 'fwd_trey_tv_oauth_state';
const RETURN_KEY = 'fwd_trey_tv_return_to';

export const treyTvAuthUrl =
  (import.meta.env.VITE_TREY_TV_AUTH_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://tv.treytrizzy.com';

export const treyTvClientId =
  (import.meta.env.VITE_TREY_TV_OAUTH_CLIENT_ID as string | undefined) || '';

export const treyTvRedirectUri =
  (import.meta.env.VITE_FWD_TREY_TV_REDIRECT_URI as string | undefined) ||
  (typeof window !== 'undefined'
    ? `${window.location.origin}/auth/trey-tv/callback`
    : 'https://fwd.treytv.com/auth/trey-tv/callback');

export const isTreyTvLoginConfigured = (): boolean => Boolean(treyTvClientId);

function generateState(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function startTreyTvLogin(opts?: { returnTo?: string }) {
  const state = generateState();
  try {
    sessionStorage.setItem(STATE_KEY, state);
    if (opts?.returnTo) sessionStorage.setItem(RETURN_KEY, opts.returnTo);
  } catch {
    // sessionStorage may be unavailable (private mode); flow still continues
    // but state validation will fail safely.
  }

  const params = new URLSearchParams({
    client_id: treyTvClientId,
    redirect_uri: treyTvRedirectUri,
    response_type: 'code',
    scope: 'profile email',
    state,
  });

  window.location.assign(`${treyTvAuthUrl}/api/fwd/oauth/authorize?${params.toString()}`);
}

export function consumeStoredState(): string | null {
  try {
    const s = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return s;
  } catch {
    return null;
  }
}

export function consumeReturnTo(): string | null {
  try {
    const r = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return r;
  } catch {
    return null;
  }
}
