import { createClient } from '@supabase/supabase-js';

const requiredEnv = (name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY') => {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local for local development and to Vercel env vars for production.`
    );
  }
  return value;
};

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabaseUrl = requiredEnv('VITE_SUPABASE_URL');
export const supabaseAnonKey = requiredEnv('VITE_SUPABASE_ANON_KEY');

if (!isSupabaseConfigured) {
  console.warn(
    'FWD Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel before using auth, uploads, profiles, or picker-key enforcement.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
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
