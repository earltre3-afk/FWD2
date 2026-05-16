// Trey TV OAuth bridge helper — PKCE + OIDC edition.
//
// PKCE (Proof Key for Code Exchange, RFC 7636):
//   - code_verifier  : random 96-byte URL-safe string, stored in sessionStorage
//   - code_challenge : SHA-256 of verifier, base64url-encoded, sent to authorize
//   - code_verifier  : sent to Edge Function at callback time for token exchange
//
// The client_secret NEVER appears here. Token exchange (including code_verifier)
// happens server-side only in the Supabase Edge Function `trey-tv-login-exchange`.
//
// OIDC issuer:
//   VITE_TREY_TV_OAUTH_ISSUER  (e.g. https://wcdwlqnfcsuaacbvdmgx.supabase.co)
//   This is the Supabase project powering Trey TV auth. FWD uses it to build
//   the authorize URL: {issuer}/auth/v1/authorize
//   The Edge Function validates the issuer claim in the returned ID token.

const STATE_KEY    = 'fwd_trey_tv_oauth_state';
const VERIFIER_KEY = 'fwd_trey_tv_pkce_verifier';
const RETURN_KEY   = 'fwd_trey_tv_return_to';

// ── Environment ──────────────────────────────────────────────────────────────

/** Supabase project URL acting as OIDC issuer for Trey TV */
export const treyTvOidcIssuer =
  (import.meta.env.VITE_TREY_TV_OAUTH_ISSUER as string | undefined)?.replace(/\/$/, '') || '';

/** Legacy custom auth bridge base URL (fallback when no issuer configured) */
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

/**
 * Returns the OIDC authorize endpoint.
 * If VITE_TREY_TV_OAUTH_ISSUER is set  → uses Supabase OIDC standard path.
 * Otherwise                             → falls back to custom Trey TV path.
 */
function getAuthorizeEndpoint(): string {
  if (treyTvOidcIssuer) return `${treyTvOidcIssuer}/auth/v1/authorize`;
  return `${treyTvAuthUrl}/api/fwd/oauth/authorize`;
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function randomBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return buf;
}

function base64urlEncode(buf: ArrayBuffer | ArrayBufferView): string {
  const bytes = buf instanceof ArrayBuffer
    ? new Uint8Array(buf)
    : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateState(): string {
  return base64urlEncode(randomBytes(32));
}

/**
 * Generates a PKCE code_verifier (96 random URL-safe bytes → base64url).
 * RFC 7636 §4.1 — verifier must be 43–128 chars; 96 bytes → 128 chars.
 */
function generateCodeVerifier(): string {
  return base64urlEncode(randomBytes(96));
}

/**
 * Derives code_challenge = BASE64URL(SHA256(ASCII(verifier))).
 * RFC 7636 §4.2 — S256 method.
 */
async function deriveCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64urlEncode(digest);
}

// ── Safe returnTo ─────────────────────────────────────────────────────────────

/**
 * Validates a returnTo path — only allows same-origin relative paths.
 * Rejects anything with a protocol, host, or suspicious characters.
 */
export function isSafeReturnTo(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    // Must be a relative path starting with /
    if (!/^\/[^/\\]/.test(value) && value !== '/') return false;
    // Reject any attempt to embed a protocol or authority
    const suspicious = /[<>"'`\0]|javascript:|data:|vbscript:/i;
    if (suspicious.test(value)) return false;
    // Parse as URL relative to current origin to confirm same-origin
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initiates the Trey TV OAuth + PKCE login flow.
 * Generates state + code_verifier, stores them in sessionStorage,
 * then redirects the browser to the Trey TV authorize endpoint.
 */
export async function startTreyTvLogin(opts?: { returnTo?: string }): Promise<void> {
  const state        = generateState();
  const verifier     = generateCodeVerifier();
  const challenge    = await deriveCodeChallenge(verifier);

  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    const safe = opts?.returnTo && isSafeReturnTo(opts.returnTo) ? opts.returnTo : null;
    if (safe) sessionStorage.setItem(RETURN_KEY, safe);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // sessionStorage unavailable (private/incognito mode).
    // State validation will fail safely at callback — user sees a clear error.
  }

  const params = new URLSearchParams({
    client_id:             treyTvClientId,
    redirect_uri:          treyTvRedirectUri,
    response_type:         'code',
    scope:                 'openid email profile',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  window.location.assign(`${getAuthorizeEndpoint()}?${params.toString()}`);
}

/** Reads and removes the stored OAuth state (consume-once). */
export function consumeStoredState(): string | null {
  try {
    const s = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return s;
  } catch {
    return null;
  }
}

/** Reads and removes the stored PKCE code_verifier (consume-once). */
export function consumeCodeVerifier(): string | null {
  try {
    const v = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    return v;
  } catch {
    return null;
  }
}

/** Reads and removes the stored returnTo path (consume-once). */
export function consumeReturnTo(): string | null {
  try {
    const r = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    // Re-validate on consume so stale/tampered values are rejected
    return isSafeReturnTo(r) ? r : null;
  } catch {
    return null;
  }
}
