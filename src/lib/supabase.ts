import { createClient } from '@supabase/supabase-js';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-anon-key';

if (!isSupabaseConfigured) {
  console.warn(
    'FWD Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel before using auth, uploads, profiles, or picker-key enforcement.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const fwdConfig = {
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured,
  appUrl: import.meta.env.VITE_FWD_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  allowedParentOrigins: (import.meta.env.VITE_FWD_ALLOWED_PARENT_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
