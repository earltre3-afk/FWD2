// Supabase Edge Function: trey-tv-login-exchange
//
// Exchanges a Trey TV OAuth authorization code for a Trey TV access token,
// fetches the Trey TV user profile, and upserts a linked FWD profile.
//
// SECURITY:
//   - TREY_TV_OAUTH_CLIENT_SECRET is read from the function env, never
//     exposed to the browser.
//   - Browser only sends { code, redirect_uri, state }. State validation
//     happens client-side against sessionStorage before invoking this fn.
//
// TODO (backend completion):
//   This function does not yet mint a Supabase Auth session for the user.
//   It returns connected profile data so the frontend can either:
//     - send the user to /create-profile prefilled with Trey TV data, or
//     - sign them in via a future flow (e.g. magic link, custom JWT) once
//       wired up between Trey TV and FWD Supabase Auth.
//
// Required environment variables (set with `supabase secrets set`):
//   TREY_TV_AUTH_URL              e.g. https://tv.treytrizzy.com
//   TREY_TV_OAUTH_CLIENT_ID       public client id, matches frontend
//   TREY_TV_OAUTH_CLIENT_SECRET   SECRET — server only
//   SUPABASE_URL                  auto-provided by Supabase
//   SUPABASE_SERVICE_ROLE_KEY     auto-provided by Supabase

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
}

interface TreyTvTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
}

interface TreyTvUser {
  id?: string;
  uid?: string;
  user_id?: string;
  email?: string;
  display_name?: string;
  name?: string;
  username?: string;
  avatar_url?: string;
  picture?: string;
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

  const code = body.code?.trim();
  const redirectUri = body.redirect_uri?.trim();

  if (!code || !redirectUri) {
    return json(
      { ok: false, error: 'Missing code or redirect_uri.' },
      400
    );
  }

  // 1. Exchange the auth code for an access token (server-side only).
  let tokenData: TreyTvTokenResponse;
  try {
    const tokenRes = await fetch(`${TREY_TV_AUTH_URL}/api/fwd/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: TREY_TV_OAUTH_CLIENT_ID,
        client_secret: TREY_TV_OAUTH_CLIENT_SECRET,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return json(
        {
          ok: false,
          error: 'Trey TV rejected the authorization code.',
          // Keep the upstream detail short & sanitized.
          upstream_status: tokenRes.status,
          upstream: detail.slice(0, 240),
        },
        400
      );
    }
    tokenData = (await tokenRes.json()) as TreyTvTokenResponse;
  } catch (err) {
    return json(
      {
        ok: false,
        error: 'Could not reach Trey TV to exchange login code.',
        detail: err instanceof Error ? err.message : String(err),
      },
      502
    );
  }

  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return json(
      { ok: false, error: 'Trey TV did not return an access token.' },
      400
    );
  }

  // 2. Fetch Trey TV user info using the access token.
  let treyUser: TreyTvUser;
  try {
    const userRes = await fetch(`${TREY_TV_AUTH_URL}/api/fwd/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!userRes.ok) {
      return json(
        {
          ok: false,
          error: 'Trey TV would not return profile information.',
          upstream_status: userRes.status,
        },
        400
      );
    }
    treyUser = (await userRes.json()) as TreyTvUser;
  } catch (err) {
    return json(
      {
        ok: false,
        error: 'Could not load Trey TV profile.',
        detail: err instanceof Error ? err.message : String(err),
      },
      502
    );
  }

  const providerUserId =
    treyUser.id || treyUser.uid || treyUser.user_id || '';
  const treyTvUid = treyUser.uid || treyUser.id || treyUser.user_id || '';
  const displayName =
    treyUser.display_name ||
    treyUser.name ||
    treyUser.username ||
    treyUser.email ||
    '';
  const email = treyUser.email || '';
  const avatarUrl = treyUser.avatar_url || treyUser.picture || '';

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

  // Look for an existing linked account.
  const { data: existing } = await admin
    .from('fwd_connected_accounts')
    .select('id, fwd_user_id')
    .eq('provider', 'trey_tv')
    .eq('provider_user_id', providerUserId)
    .maybeSingle();

  let fwdUserId: string | null = existing?.fwd_user_id ?? null;
  let isNew = false;

  if (!existing) {
    isNew = true;
    const { error: insertErr } = await admin
      .from('fwd_connected_accounts')
      .insert({
        provider: 'trey_tv',
        provider_user_id: providerUserId,
        provider_uid: treyTvUid,
        email: email || null,
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
      });
    if (insertErr) {
      return json(
        {
          ok: false,
          error: 'Could not link Trey TV account on FWD.',
          detail: insertErr.message,
        },
        500
      );
    }
  }

  // Best-effort profile mirror (only if a fwd profile already exists for
  // this user — full Supabase Auth session minting is still TODO).
  if (fwdUserId) {
    await admin
      .from('fwd_profiles')
      .update({
        connected_trey_tv_uid: treyTvUid || null,
        login_provider: 'trey_tv',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', fwdUserId);
  }

  return json({
    ok: true,
    profile: {
      fwd_user_id: fwdUserId,
      is_new_profile: isNew,
      connected_trey_tv_uid: treyTvUid,
      display_name: displayName,
      email,
      avatar_url: avatarUrl,
    },
  });
});
