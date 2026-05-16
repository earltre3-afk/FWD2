import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import FwdLogo from '@/components/FwdLogo';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'error';
type ProfileCheck = { exists: boolean; created: boolean; upserted: boolean };

const RESERVED_USERNAMES = new Set(['admin', 'api', 'auth', 'embed', 'home', 'login', 'profile', 'signup']);
const CALLBACK_LOG_PREFIX = '[FWD OAuth Callback]';

function consumeReturnTo() {
  try {
    const value = sessionStorage.getItem('fwd_oauth_return_to');
    sessionStorage.removeItem('fwd_oauth_return_to');
    if (value?.startsWith('/') && !value.startsWith('//')) return value;
  } catch {}
  return '/profile';
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function safeUsername(seed: string, fallbackId: string) {
  const base = seed
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const username = base && !RESERVED_USERNAMES.has(base) ? base : `fwd_${fallbackId.slice(0, 8)}`;
  return username || `fwd_${crypto.randomUUID().slice(0, 8)}`;
}

function getTreyTvIdentity(user: User) {
  const identity = user.identities?.find((item) => item.provider === 'custom:trey-tv' || item.provider === 'trey-tv');
  const identityData = identity?.identity_data ?? {};
  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};

  return {
    email: firstString(user.email, metadata.email, identityData.email),
    displayName: firstString(
      metadata.display_name,
      metadata.full_name,
      metadata.name,
      identityData.display_name,
      identityData.full_name,
      identityData.name,
      identityData.user_name,
      user.email?.split('@')[0]
    ),
    avatarUrl: firstString(
      metadata.avatar_url,
      metadata.picture,
      identityData.avatar_url,
      identityData.picture
    ),
    provider: firstString(identity?.provider, appMetadata.provider, 'custom:trey-tv'),
    providerUserId: firstString(identity?.id, identityData.sub, identityData.provider_id),
  };
}

function logCallbackState(event: string, fields: Record<string, boolean | string>) {
  console.info(CALLBACK_LOG_PREFIX, event, fields);
}

function readHashSessionParams() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  return {
    hasHashParams: Boolean(hash),
    hasHashAccessToken: Boolean(accessToken),
    hasHashRefreshToken: Boolean(refreshToken),
    accessToken,
    refreshToken,
  };
}

function isDuplicateError(error: { message?: string; code?: string }) {
  return error.code === '23505' || (error.message || '').toLowerCase().includes('duplicate');
}

async function getConfirmedSession() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return null;
}

async function ensureProfilesRecord(user: User): Promise<ProfileCheck> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return { exists: true, created: false, upserted: true };

  const identity = getTreyTvIdentity(user);
  const displayName = identity.displayName || (identity.email ? identity.email.split('@')[0] : '') || 'FWD User';
  const username = safeUsername(identity.email || identity.providerUserId || displayName || user.id, user.id);
  const baseProfile = {
    id: user.id,
    username,
    display_name: displayName,
    avatar_url: identity.avatarUrl || null,
    bio: null,
    is_public: true,
  };

  const { error: insertError } = await supabase.from('profiles').insert(baseProfile);
  if (!insertError) return { exists: false, created: true, upserted: true };

  if (insertError.message.toLowerCase().includes('is_public')) {
    const { is_public: _isPublic, ...compatibleProfile } = baseProfile;
    const { error: compatibleError } = await supabase.from('profiles').insert(compatibleProfile);
    if (!compatibleError) return { exists: false, created: true, upserted: true };
    if (!isDuplicateError(compatibleError)) throw compatibleError;
  } else if (!isDuplicateError(insertError)) {
    throw insertError;
  }

  const { data: existingAfterDuplicate, error: duplicateLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!duplicateLookupError && existingAfterDuplicate) return { exists: true, created: false, upserted: true };

  const retryProfile = {
    ...baseProfile,
    username: safeUsername(`${username}_${user.id.slice(0, 6)}`, user.id),
  };
  const { error: retryError } = await supabase.from('profiles').insert(retryProfile);
  if (retryError) {
    if (isDuplicateError(retryError)) return { exists: true, created: false, upserted: true };
    throw retryError;
  }
  return { exists: false, created: true, upserted: true };
}

async function ensureFwdProfileMirror(user: User) {
  const identity = getTreyTvIdentity(user);
  const displayName = identity.displayName || (identity.email ? identity.email.split('@')[0] : '') || 'FWD User';
  const username = safeUsername(identity.email || identity.providerUserId || displayName || user.id, user.id);

  await supabase
    .from('fwd_profiles')
    .upsert(
      {
        user_id: user.id,
        display_name: displayName,
        username,
        avatar_url: identity.avatarUrl || null,
        connected_trey_tv_uid: identity.providerUserId || null,
        identity_provider: identity.provider,
        login_provider: identity.provider,
        identity_verified_at: new Date().toISOString(),
        identity_sync_status: 'synced',
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
}

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Finishing your sign-in...');
  const processedRef = useRef(false);

  useEffect(() => {
    let alive = true;

    async function finishSignIn() {
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const code = params.get('code');
      const flowLog = {
        hasCode: Boolean(code),
        hasOAuthError: Boolean(error),
        exchangeSuccess: false,
        hasSession: false,
        hasUser: false,
        hasEmail: false,
        hasHashParams: Boolean(window.location.hash),
        hasHashAccessToken: false,
        hasHashRefreshToken: false,
        profileLookupSuccess: false,
        profileUpsertSuccess: false,
        finalRedirect: '',
      };

      if (processedRef.current) {
        logCallbackState('skip_already_processed', flowLog);
        return;
      }
      processedRef.current = true;

      if (error) {
        logCallbackState('fatal_oauth_error', flowLog);
        if (!alive) return;
        setStatus('error');
        setMessage(errorDescription || 'The sign-in request was canceled or failed.');
        return;
      }

      try {
        logCallbackState('start', flowLog);

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            const sessionAfterExchangeError = await getConfirmedSession();
            flowLog.hasSession = Boolean(sessionAfterExchangeError);
            if (!sessionAfterExchangeError) {
              logCallbackState('fatal_exchange_failed', flowLog);
              throw exchangeError;
            }
            flowLog.exchangeSuccess = true;
            console.warn(CALLBACK_LOG_PREFIX, 'exchange_error_with_existing_session', {
              message: exchangeError.message,
              hasSession: flowLog.hasSession,
            });
          } else {
            flowLog.exchangeSuccess = true;
          }
        } else {
          const hashSession = readHashSessionParams();
          flowLog.hasHashParams = hashSession.hasHashParams;
          flowLog.hasHashAccessToken = hashSession.hasHashAccessToken;
          flowLog.hasHashRefreshToken = hashSession.hasHashRefreshToken;

          if (hashSession.accessToken && hashSession.refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: hashSession.accessToken,
              refresh_token: hashSession.refreshToken,
            });
            if (setSessionError) throw setSessionError;
            flowLog.exchangeSuccess = true;
            window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
          } else {
            const existingSession = await getConfirmedSession();
            flowLog.hasSession = Boolean(existingSession);
            if (!existingSession) {
              logCallbackState('fatal_missing_code', flowLog);
              throw new Error('No sign-in code was returned.');
            }
            flowLog.exchangeSuccess = true;
          }
        }

        const session = await getConfirmedSession();
        flowLog.hasSession = Boolean(session);
        if (!session) {
          logCallbackState('fatal_missing_session', flowLog);
          throw new Error('No FWD session was created after sign-in.');
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError && !userData.user) {
          logCallbackState('fatal_get_user_failed', flowLog);
          throw userError;
        }

        const authUser = userData.user || session.user;
        flowLog.hasUser = Boolean(authUser);
        flowLog.hasEmail = Boolean(authUser?.email);
        if (!authUser) {
          logCallbackState('fatal_missing_user', flowLog);
          throw new Error('No authenticated FWD user was returned.');
        }

        let profileResult: ProfileCheck = { exists: false, created: false, upserted: false };
        let profileError: unknown = null;
        try {
          profileResult = await ensureProfilesRecord(authUser);
          flowLog.profileLookupSuccess = profileResult.exists || profileResult.created;
          flowLog.profileUpsertSuccess = profileResult.upserted;
        } catch (err) {
          profileError = err;
          console.warn(CALLBACK_LOG_PREFIX, 'profile_upsert_failed', {
            message: err instanceof Error ? err.message : 'Unknown profile error',
            hasSession: flowLog.hasSession,
            hasUser: flowLog.hasUser,
            hasEmail: flowLog.hasEmail,
          });
        }

        ensureFwdProfileMirror(authUser).catch((err) => {
          console.warn(CALLBACK_LOG_PREFIX, 'profile_mirror_failed', {
            message: err instanceof Error ? err.message : 'Unknown profile mirror error',
          });
        });

        if (!alive) return;
        const returnTo = consumeReturnTo();
        const finalRedirect = profileError || profileResult.created ? '/create-profile' : returnTo;
        flowLog.finalRedirect = finalRedirect;
        logCallbackState('success_redirect', flowLog);
        navigate(finalRedirect, { replace: true });
      } catch (err) {
        if (!alive) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not finish sign-in. Please try again.');
      }
    }

    finishSignIn();
    return () => {
      alive = false;
    };
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_35%)]" />
      <div className="relative w-full max-w-sm glass-strong rounded-3xl border border-fuchsia-500/40 neon-glow-purple p-8 text-center">
        <div className="flex justify-center mb-5">
          <FwdLogo size="lg" />
        </div>

        {status === 'loading' ? (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-fuchsia-500/25 to-cyan-400/25 border border-cyan-400/30">
              <Loader2 className="animate-spin text-cyan-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Signing you in...</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
            <Sparkles className="mx-auto mt-5 text-fuchsia-300" size={18} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-pink-500/15 border border-pink-400/40">
              <AlertTriangle className="text-pink-300" size={26} />
            </div>
            <h2 className="text-xl font-black text-white">Sign-in failed</h2>
            <p className="text-sm text-zinc-400 mt-2">{message}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full mt-6 rounded-xl py-3 bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 text-white font-bold"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
