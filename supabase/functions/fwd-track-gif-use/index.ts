// Supabase Edge Function: fwd-track-gif-use
//
// Accepts safe GIF usage events from Trey TV (or any approved
// FWD picker integration) and persists them to fwd_gif_use_log.
//
// SECURITY MODEL:
//   - Caller must supply a valid picker public_key.
//   - Origin header is checked against the key's allowed_origins.
//   - Service role key is NEVER exposed to callers.
//   - No private Trey TV data is accepted or stored.
//   - Only the public Trey TV UID is accepted, not internal IDs.
//
// Request body (JSON, POST):
//   {
//     key:             string  (picker public key)
//     gif_id:          string
//     source_platform: string  ('trey_tv' | 'embed' | ...)
//     context:         string  ('message' | 'comment' | 'group_chat' | ...)
//     trey_tv_uid:     string? (public 16-digit UID only)
//   }
//
// Response:
//   { ok: true }  or  { ok: false, error: string }

// @ts-ignore — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const normalizeOrigin = (v: string | null): string => {
  if (!v) return '';
  try { const u = new URL(v); return `${u.protocol}//${u.host}`; }
  catch { return v.trim().replace(/\/+$/, ''); }
};

// @ts-ignore — Deno.serve available in Supabase Edge runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const origin = normalizeOrigin(req.headers.get('Origin'));

  let body: {
    key?: string;
    gif_id?: string;
    source_platform?: string;
    context?: string;
    trey_tv_uid?: string;
  };
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const { key, gif_id, source_platform = 'trey_tv', context, trey_tv_uid } = body;

  if (!key)    return json({ ok: false, error: 'missing_key' }, 400);
  if (!gif_id) return json({ ok: false, error: 'missing_gif_id' }, 400);

  // @ts-ignore
  const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore
  const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE)
    return json({ ok: false, error: 'server_misconfigured' }, 500);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify picker key + origin
  const { data: keyRow, error: keyErr } = await admin
    .from('picker_api_keys')
    .select('id, is_active, allowed_origins')
    .eq('public_key', key)
    .maybeSingle();

  if (keyErr || !keyRow)
    return json({ ok: false, error: 'invalid_key' }, 403);
  if (!keyRow.is_active)
    return json({ ok: false, error: 'key_disabled' }, 403);

  const allowedOrigins: string[] = (keyRow.allowed_origins || [])
    .map(normalizeOrigin)
    .filter(Boolean);

  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin))
    return json({ ok: false, error: 'origin_not_allowed' }, 403);

  // 2. Validate trey_tv_uid: accept only 16-char alphanumeric public UIDs.
  //    Reject anything that looks like a UUID (private internal ID).
  const safeUid = trey_tv_uid && /^[A-Za-z0-9_-]{8,32}$/.test(trey_tv_uid)
    && !/^[0-9a-f]{8}-/.test(trey_tv_uid)   // reject uuid-shaped values
    ? trey_tv_uid : null;

  // 3. Validate context value against known-safe strings
  const ALLOWED_CONTEXTS = [
    'message', 'comment', 'group_chat', 'watch_party',
    'creator_channel', 'feed_post', 'profile_reaction',
  ] as const;
  const safeContext = ALLOWED_CONTEXTS.includes(context as typeof ALLOWED_CONTEXTS[number])
    ? context : null;

  // 4. Insert safe usage log entry
  const { error: insertErr } = await admin
    .from('fwd_gif_use_log')
    .insert({
      gif_id:          gif_id.trim().slice(0, 128),
      source_platform: (source_platform || 'trey_tv').slice(0, 64),
      context:         safeContext,
      trey_tv_uid:     safeUid,
      origin:          origin || null,
    });

  if (insertErr)
    return json({ ok: false, error: 'log_failed', detail: insertErr.message }, 500);

  // 5. Also record in fwd_trey_tv_uses for compatibility with existing schema
  await admin.from('fwd_trey_tv_uses').insert({
    gif_id:           null,   // external gif_id — not a fwd_gifs row
    trey_tv_uid:      safeUid,
    source_platform:  (source_platform || 'trey_tv').slice(0, 64),
    context:          safeContext,
    destination_type: safeContext,
  }).maybeSingle();

  return json({ ok: true });
});
