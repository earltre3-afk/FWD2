// Supabase Edge Function: fwd-trey-tv-integration
//
// Server-to-server GIF library API consumed by Trey TV's backend.
// Never called directly from the browser — Trey TV server functions proxy
// all requests and validate the user session before forwarding.
//
// SECURITY MODEL:
//   - X-Integration-Key: validated against FWD_TREY_TV_INTEGRATION_KEY secret.
//   - X-Trey-Tv-Uid: the public 16-digit UID used to resolve the FWD user.
//   - All DB access uses service role (bypasses RLS — key auth is the gate).
//   - No user tokens, passwords, or internal IDs are accepted from the caller.
//   - CORS is locked to https://fwd.treytv.com — not wildcard.
//
// Routes (method + path suffix after /fwd-trey-tv-integration):
//   GET  /library    — paginated GIF library for a tab (saved/recent/created/unsaved)
//   POST /capture    — add a GIF to the library (library_status = 'recent')
//   POST /save       — promote a GIF to 'saved'
//   POST /mark-used  — update last_used_at (called after GIF is sent)
//   POST /remove     — delete a saved_gif row
//
// Required Supabase secrets (set via `supabase secrets set`):
//   FWD_TREY_TV_INTEGRATION_KEY   Shared secret — also in Trey TV as FWD_INTEGRATION_KEY
//   SUPABASE_URL                  Auto-provided
//   SUPABASE_SERVICE_ROLE_KEY     Auto-provided

// @ts-expect-error — Deno runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error — Deno-friendly Supabase JS import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ALLOWED_ORIGIN = 'https://fwd.treytv.com';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-integration-key, x-trey-tv-uid',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

interface SavedGifRow {
  id: string;
  gif_id: string | null;
  source_url: string | null;
  title: string | null;
  caption: string | null;
  tags: string[] | null;
  mood: string | null;
  source_type: string | null;
  provider: string | null;
  provider_gif_id: string | null;
  preview_url: string | null;
  media_url: string | null;
  mp4_url: string | null;
  webm_url: string | null;
  gif_url: string | null;
  poster_url: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  library_status: string;
  last_used_at: string | null;
  created_at: string;
}

serve(async (req: Request) => {
  // @ts-expect-error — Deno global
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  // @ts-expect-error — Deno global
  const INTEGRATION_KEY = Deno.env.get('FWD_TREY_TV_INTEGRATION_KEY') || '';
  // @ts-expect-error — Deno global
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  // @ts-expect-error — Deno global
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!INTEGRATION_KEY) {
    return json({ ok: false, error: 'Integration key not configured.' }, 500, origin);
  }

  const reqKey = req.headers.get('x-integration-key') || '';
  if (!reqKey || reqKey !== INTEGRATION_KEY) {
    return json({ ok: false, error: 'Unauthorized.' }, 401, origin);
  }

  const treyTvUid = (req.headers.get('x-trey-tv-uid') || '').trim();
  if (!treyTvUid) {
    return json({ ok: false, error: 'Missing X-Trey-Tv-Uid header.' }, 400, origin);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve FWD user from the identity bridge
  const { data: link, error: linkErr } = await admin
    .from('fwd_identity_links')
    .select('fwd_user_id')
    .eq('provider', 'trey_tv')
    .eq('trey_tv_uid', treyTvUid)
    .maybeSingle();

  if (linkErr) {
    return json({ ok: false, error: 'Identity lookup failed.', detail: linkErr.message }, 500, origin);
  }
  if (!link?.fwd_user_id) {
    return json({ ok: false, error: 'No FWD account linked to this Trey TV UID.' }, 404, origin);
  }

  const fwdUserId: string = link.fwd_user_id;

  // Parse route from URL path
  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\//, '').split('/');
  // pathname: /fwd-trey-tv-integration/library  => segments: ['fwd-trey-tv-integration', 'library']
  const route = segments[segments.length - 1] ?? '';

  // ───────────────────────────────────────────────────────────────────────────
  // GET /library
  // ───────────────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && route === 'library') {
    const tab = (url.searchParams.get('tab') || 'saved') as string;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '48', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const validTabs = ['saved', 'recent', 'created', 'unsaved', 'favorite'];
    if (!validTabs.includes(tab)) {
      return json({ ok: false, error: `Invalid tab. Use one of: ${validTabs.join(', ')}` }, 400, origin);
    }

    const { data, error, count } = await admin
      .from('saved_gifs')
      .select('*', { count: 'exact' })
      .eq('user_id', fwdUserId)
      .eq('library_status', tab)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return json({ ok: false, error: 'Failed to load GIF library.', detail: error.message }, 500, origin);
    }

    return json({ ok: true, gifs: data as SavedGifRow[], total: count ?? 0, offset, limit }, 200, origin);
  }

  // All routes below require JSON body
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400, origin);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /capture — record a GIF being used (insert as 'recent', idempotent)
  // ───────────────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'capture') {
    const gif_url = body.gif_url as string | undefined;
    const gif_id  = body.gif_id  as string | undefined;
    if (!gif_url) {
      return json({ ok: false, error: 'gif_url is required.' }, 400, origin);
    }

    const now = new Date().toISOString();
    const payload = {
      user_id:        fwdUserId,
      gif_id:         gif_id || null,
      source_url:     gif_url,
      gif_url:        gif_url,
      preview_url:    (body.preview_url as string | undefined) || null,
      poster_url:     (body.poster_url  as string | undefined) || null,
      mp4_url:        (body.mp4_url     as string | undefined) || null,
      media_url:      gif_url,
      title:          (body.title       as string | undefined) || null,
      provider:       (body.provider    as string | undefined) || 'trey_tv',
      provider_gif_id:(body.provider_gif_id as string | undefined) || gif_id || null,
      width:          (body.width  as number | undefined) || null,
      height:         (body.height as number | undefined) || null,
      library_status: 'recent',
      last_used_at:   now,
      source_type:    'trey_tv_message',
    };

    // If GIF already exists for this user (by gif_url), just update last_used_at + status
    const { data: existing } = await admin
      .from('saved_gifs')
      .select('id, library_status')
      .eq('user_id', fwdUserId)
      .eq('source_url', gif_url)
      .maybeSingle();

    if (existing) {
      // Preserve 'saved'/'favorite'/'created' — only promote to 'recent' if currently 'unsaved'
      const keepStatus = ['saved', 'favorite', 'created'].includes(existing.library_status);
      await admin
        .from('saved_gifs')
        .update({
          last_used_at: now,
          ...(keepStatus ? {} : { library_status: 'recent' }),
        })
        .eq('id', existing.id);

      return json({ ok: true, action: 'updated', id: existing.id }, 200, origin);
    }

    const { data: inserted, error: insertErr } = await admin
      .from('saved_gifs')
      .insert(payload)
      .select('id')
      .single();

    if (insertErr) {
      return json({ ok: false, error: 'Failed to capture GIF.', detail: insertErr.message }, 500, origin);
    }

    return json({ ok: true, action: 'inserted', id: inserted.id }, 201, origin);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /save — promote a GIF to 'saved' status
  // ───────────────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'save') {
    const id = body.id as string | undefined;
    if (!id) {
      return json({ ok: false, error: 'id is required.' }, 400, origin);
    }

    const { error: saveErr } = await admin
      .from('saved_gifs')
      .update({ library_status: 'saved' })
      .eq('id', id)
      .eq('user_id', fwdUserId);

    if (saveErr) {
      return json({ ok: false, error: 'Failed to save GIF.', detail: saveErr.message }, 500, origin);
    }

    return json({ ok: true }, 200, origin);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /mark-used — update last_used_at timestamp (after GIF is sent)
  // ───────────────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'mark-used') {
    const id      = body.id       as string | undefined;
    const gif_url = body.gif_url  as string | undefined;
    if (!id && !gif_url) {
      return json({ ok: false, error: 'id or gif_url is required.' }, 400, origin);
    }

    const now = new Date().toISOString();
    const filter = id
      ? admin.from('saved_gifs').update({ last_used_at: now }).eq('id', id).eq('user_id', fwdUserId)
      : admin.from('saved_gifs').update({ last_used_at: now }).eq('source_url', gif_url!).eq('user_id', fwdUserId);

    const { error: markErr } = await filter;
    if (markErr) {
      return json({ ok: false, error: 'Failed to mark GIF as used.', detail: markErr.message }, 500, origin);
    }

    return json({ ok: true }, 200, origin);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /remove — delete a saved_gif row
  // ───────────────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && route === 'remove') {
    const id = body.id as string | undefined;
    if (!id) {
      return json({ ok: false, error: 'id is required.' }, 400, origin);
    }

    const { error: delErr } = await admin
      .from('saved_gifs')
      .delete()
      .eq('id', id)
      .eq('user_id', fwdUserId);

    if (delErr) {
      return json({ ok: false, error: 'Failed to remove GIF.', detail: delErr.message }, 500, origin);
    }

    return json({ ok: true }, 200, origin);
  }

  return json({ ok: false, error: `Unknown route: ${route}` }, 404, origin);
});
