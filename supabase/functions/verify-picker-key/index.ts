import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type PickerKeyRow = {
  id: string;
  public_key: string;
  allowed_origins: string[] | null;
  is_active: boolean;
};

const json = (body: Record<string, unknown>, status: number, origin: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Vary': 'Origin',
  },
});

const normalizeOrigin = (value: string | null) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
};

Deno.serve(async (req) => {
  const origin = normalizeOrigin(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return json({ ok: true }, 204, origin || null);
  }

  if (req.method !== 'GET') {
    return json({ allowed: false, error: 'method_not_allowed' }, 405, origin || null);
  }

  const key = new URL(req.url).searchParams.get('key')?.trim();
  if (!key) {
    return json({ allowed: false, error: 'missing_key' }, 400, origin || null);
  }

  if (!origin) {
    return json({ allowed: false }, 403, null);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ allowed: false }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('picker_api_keys')
    .select('id, public_key, allowed_origins, is_active')
    .eq('public_key', key)
    .maybeSingle<PickerKeyRow>();

  // Key not found or database error
  if (error || !data) {
    return json({ allowed: false, error: 'invalid_key' }, 403, origin);
  }

  // Key is inactive/disabled
  if (data.is_active === false) {
    return json({ allowed: false, error: 'key_disabled' }, 403, origin);
  }

  // Check origin against allowed origins
  const allowedOrigins = (data.allowed_origins || []).map(normalizeOrigin).filter(Boolean);
  if (!allowedOrigins.includes(origin)) {
    return json({ allowed: false, error: 'origin_not_allowed' }, 403, origin);
  }

  // All checks passed
  return json({ allowed: true }, 200, origin);
});
