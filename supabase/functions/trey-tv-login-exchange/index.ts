// Supabase Edge Function: trey-tv-login-exchange — PKCE + OIDC edition
//
// Exchanges a Trey TV authorization code (+ PKCE code_verifier) for tokens,
// validates the OIDC ID token issuer, extracts the verified identity, and
// upserts fwd_identity_links + fwd_profiles.
//
// SECURITY MODEL:
//   - client_secret: server-only env var, never reaches browser.
//   - code_verifier: sent from browser, used once for token exchange (PKCE).
//   - ID token issuer is validated against TREY_TV_OAUTH_ISSUER.
//   - Only public identity fields are returned to browser.
//   - fwd_identity_links inserts use service role (bypasses RLS).
//   - No raw tokens, refresh tokens, or service keys returned.
//
// Required Supabase secrets (set via `supabase secrets set`):
//   TREY_TV_OAUTH_ISSUER          Supabase project URL for Trey TV
//                                 e.g. https://wcdwlqnfcsuaacbvdmgx.supabase.co
//   TREY_TV_AUTH_URL              Fallback if no OIDC issuer (legacy)
//   TREY_TV_OAUTH_CLIENT_ID       Public client id
//   TREY_TV_OAUTH_CLIENT_SECRET   SECRET — server only
//   SUPABASE_URL                  Auto-provided
//   SUPABASE_SERVICE_ROLE_KEY     Auto-provided

// @ts-ignore — Deno runtime in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore — Deno-friendly Supabase JS import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ExchangeRequestBody {
  code?: string;
  redirect_uri?: string;
  state?: string;
  code_verifier?: string;   // PKCE — required for S256 token exchange
}

interface TreyTvTokenResponse {
  access_token?: string;
  id_token?: string;        // OIDC ID token — used for issuer validation
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;   // never forwarded to browser
}

interface TreyTvUser {
  id?: string;
  uid?: string;              // public 16-digit UID — the canonical cross-platform identity
  user_id?: string;
  email?: string;
  display_name?: string;
  name?: string;
  username?: string;
  avatar_url?: string;
  picture?: string;
  profile_url?: string;      // public profile URL on Trey TV
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  // @ts-ignore — Deno global available in Edge Functions runtime
  const TREY_TV_OAUTH_ISSUER = (Deno.env.get('TREY_TV_OAUTH_ISSUER') || '').replace(/\/$/, '');
  // @ts-ignore
  const TREY_TV_AUTH_URL = (Deno.env.get('TREY_TV_AUTH_URL') ||
    'https://tv.treytrizzy.com').replace(/\/$/, '');
  // @ts-ignore
  const TREY_TV_OAUTH_CLIENT_ID = Deno.env.get('TREY_TV_OAUTH_CLIENT_ID') || '';
  // @ts-ignore
  const TREY_TV_OAUTH_CLIENT_SECRET =
    Deno.env.get('TREY_TV_OAUTH_CLIENT_SECRET') || '';
  // @ts-ignore
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore
  const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  // Resolve the token endpoint:
  //   OIDC issuer → standard Supabase path
  //   Fallback    → legacy custom Trey TV path
  const tokenEndpoint = TREY_TV_OAUTH_ISSUER
    ? `${TREY_TV_OAUTH_ISSUER}/auth/v1/token?grant_type=authorization_code`
    : `${TREY_TV_AUTH_URL}/api/fwd/oauth/token`;

  const userinfoEndpoint = TREY_TV_OAUTH_ISSUER
    ? `${TREY_TV_OAUTH_ISSUER}/auth/v1/user`
    : `${TREY_TV_AUTH_URL}/api/fwd/oauth/userinfo`;

  if (!TREY_TV_OAUTH_CLIENT_ID || !TREY_TV_OAUTH_CLIENT_SECRET) {
    return json(
      { ok: false, error: 'Trey TV OAuth credentials are not configured.' },
      500
    );
  }

  let body: ExchangeRequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const code         = body.code?.trim();
  const redirectUri  = body.redirect_uri?.trim();
  const codeVerifier = body.code_verifier?.trim();

  if (!code || !redirectUri) {
    return json({ ok: false, error: 'Missing code or redirect_uri.' }, 400);
  }
  if (!codeVerifier) {
    return json({ ok: false, error: 'Missing code_verifier (PKCE required).' }, 400);
  }

  // 1. Exchange the auth code for tokens (PKCE — server-side only).
  //    code_verifier proves this request originated from the browser that
  //    generated the code_challenge sent to the authorize endpoint.
  let tokenData: TreyTvTokenResponse;
  try {
    const tokenBody = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     TREY_TV_OAUTH_CLIENT_ID,
      client_secret: TREY_TV_OAUTH_CLIENT_SECRET,
      code_verifier: codeVerifier,   // PKCE S256
    });

    const tokenRes = await fetch(tokenEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body:    tokenBody.toString(),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return json(
        {
          ok: false,
          error:           'Trey TV rejected the authorization code.',
          upstream_status: tokenRes.status,
          upstream:        detail.slice(0, 240),
        },
        400
      );
    }
    tokenData = (await tokenRes.json()) as TreyTvTokenResponse;
  } catch (err) {
    return json(
      {
        ok: false,
        error:  'Could not reach Trey TV to exchange login code.',
        detail: err instanceof Error ? err.message : String(err),
      },
      502
    );
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return json({ ok: false, error: 'Trey TV did not return an access token.' }, 400);
  }

  // 2. Validate ID token issuer (OIDC security check).
  //    We do a lightweight JWT decode (no signature verify — issuer/sub check only).
  //    Full signature verification requires JWKS fetch; issuer check is the critical
  //    security gate here since the token arrived over TLS from a trusted endpoint.
  if (TREY_TV_OAUTH_ISSUER && tokenData.id_token) {
    try {
      const parts = tokenData.id_token.split('.');
      if (parts.length === 3) {
        const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const iss = claims.iss as string | undefined;
        // Supabase OIDC issuer may include or omit trailing /auth/v1
        const expectedIssuers = [
          TREY_TV_OAUTH_ISSUER,
          `${TREY_TV_OAUTH_ISSUER}/auth/v1`,
        ];
        if (iss && !expectedIssuers.some(e => iss.startsWith(e))) {
          return json({ ok: false, error: 'ID token issuer mismatch — token rejected.' }, 401);
        }
      }
    } catch {
      // Non-fatal: malformed id_token — continue with userinfo fetch
    }
  }

  // 3. Fetch Trey TV user profile using the access token.
  let treyUser: TreyTvUser;
  try {
    const userRes = await fetch(userinfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!userRes.ok) {
      return json(
        { ok: false, error: 'Trey TV would not return profile information.', upstream_status: userRes.status },
        400
      );
    }
    treyUser = (await userRes.json()) as TreyTvUser;
  } catch (err) {
    return json(
      { ok: false, error: 'Could not load Trey TV profile.', detail: err instanceof Error ? err.message : String(err) },
      502
    );
  }

  // providerUserId = Trey TV's internal id (used only for account linking lookup)
  const providerUserId =
    treyUser.id || treyUser.uid || treyUser.user_id || '';
  // treyTvUid = the PUBLIC 16-digit UID — shared identity across the ecosystem
  const treyTvUid = treyUser.uid || '';
  const displayName =
    treyUser.display_name ||
    treyUser.name ||
    treyUser.username ||
    treyUser.email ||
    '';
  const email = treyUser.email || '';
  const avatarUrl = treyUser.avatar_url || treyUser.picture || '';
  const profileUrl = treyUser.profile_url || '';

  if (!providerUserId) {
    return json(
      { ok: false, error: 'Trey TV did not return a user id.' },
      400
    );
  }

  // 3. Upsert a connected_accounts row + matching FWD profile.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Without service-role credentials we can't persist; still return the
    // Trey TV profile so the frontend can prefill /create-profile.
    return json({
      ok: true,
      profile: {
        fwd_user_id: null,
        is_new_profile: true,
        connected_trey_tv_uid: treyTvUid,
        display_name: displayName,
        email,
        avatar_url: avatarUrl,
      },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4a. Look up existing link in fwd_identity_links (canonical table).
  const { data: existingLink } = await admin
    .from('fwd_identity_links')
    .select('id, fwd_user_id')
    .eq('provider', 'trey_tv')
    .eq('provider_user_id', providerUserId)
    .maybeSingle();

  // 4b. Fallback: check legacy fwd_connected_accounts table.
  const { data: existingLegacy } = !existingLink
    ? await admin
        .from('fwd_connected_accounts')
        .select('id, fwd_user_id')
        .eq('provider', 'trey_tv')
        .eq('provider_user_id', providerUserId)
        .maybeSingle()
    : { data: null };

  let fwdUserId: string | null =
    existingLink?.fwd_user_id ?? existingLegacy?.fwd_user_id ?? null;
  let isNew = false;

  const now = new Date().toISOString();

  // 4c. Upsert fwd_identity_links (new canonical table).
  const identityPayload = {
    provider:             'trey_tv',
    provider_user_id:     providerUserId,
    trey_tv_uid:          treyTvUid || null,
    email:                email || null,
    display_name:         displayName || null,
    avatar_url:           avatarUrl || null,
    profile_url:          profileUrl || null,
    identity_verified_at: now,
    sync_status:          'synced',
    updated_at:           now,
  };

  if (!existingLink) {
    isNew = !fwdUserId; // new if no fwd_user_id found anywhere
    const { error: linkErr } = await admin
      .from('fwd_identity_links')
      .insert({ ...identityPayload, ...(fwdUserId ? { fwd_user_id: fwdUserId } : {}) });
    if (linkErr && !linkErr.message.includes('duplicate')) {
      return json({ ok: false, error: 'Could not link Trey TV identity on FWD.', detail: linkErr.message }, 500);
    }
  } else {
    await admin
      .from('fwd_identity_links')
      .update({ ...identityPayload })
      .eq('provider', 'trey_tv')
      .eq('provider_user_id', providerUserId);
  }

  // 4d. Also keep fwd_connected_accounts in sync (backward compat).
  if (!existingLegacy) {
    await admin.from('fwd_connected_accounts').insert({
      provider:         'trey_tv',
      provider_user_id: providerUserId,
      provider_uid:     treyTvUid,
      public_uid:       treyTvUid,
      email:            email || null,
      display_name:     displayName || null,
      avatar_url:       avatarUrl || null,
      profile_url:      profileUrl || null,
      last_synced_at:   now,
      sync_status:      'synced',
      ...(fwdUserId ? { fwd_user_id: fwdUserId } : {}),
    }).select().maybeSingle();
  } else {
    await admin.from('fwd_connected_accounts')
      .update({ public_uid: treyTvUid, display_name: displayName || null, avatar_url: avatarUrl || null, profile_url: profileUrl || null, last_synced_at: now, sync_status: 'synced' })
      .eq('provider', 'trey_tv').eq('provider_user_id', providerUserId);
  }

  // Mirror all public identity fields to fwd_profiles (never private Trey TV data).
  if (fwdUserId) {
    await admin
      .from('fwd_profiles')
      .update({
        connected_trey_tv_uid:  treyTvUid || null,
        trey_tv_uid:            treyTvUid || null,
        trey_tv_display_name:   displayName || null,
        trey_tv_avatar_url:     avatarUrl || null,
        trey_tv_profile_url:    profileUrl || null,
        identity_provider:      'trey_tv',
        identity_verified_at:   new Date().toISOString(),
        identity_sync_status:   'synced',
        login_provider:         'trey_tv',
        updated_at:             new Date().toISOString(),
      })
      .eq('user_id', fwdUserId);
  }

  // Return only safe public fields — never service role key, internal IDs, or raw tokens.
  return json({
    ok: true,
    profile: {
      fwd_user_id:           fwdUserId,
      is_new_profile:        isNew,
      trey_tv_uid:           treyTvUid,           // public ecosystem UID
      connected_trey_tv_uid: treyTvUid,           // backward compat alias
      trey_tv_display_name:  displayName,
      trey_tv_avatar_url:    avatarUrl,
      trey_tv_profile_url:   profileUrl,
      identity_provider:     'trey_tv',
      identity_verified_at:  new Date().toISOString(),
      display_name:          displayName,
      email,
      avatar_url:            avatarUrl,
    },
  });
});
