import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface FwdProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio: string | null;
  location?: string | null;
  website_url?: string | null;
  is_public?: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: FwdProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: 'google' | 'github' | 'custom:trey-tv') => Promise<{ error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<FwdProfile>) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType>({} as any);
export const useAuth = () => useContext(AuthContext);

const friendlyAuthError = (raw?: string) => {
  if (!raw) return undefined;
  const m = raw.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return "We couldn't sign you in. Check your email and password.";
  if (m.includes('already registered') || m.includes('user already exists')) return 'That email is already on FWD. Try signing in instead.';
  if (m.includes('password')) return 'That password did not work. Try a stronger password or reset it.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts. Try again in a moment.';
  if (m.includes('network') || m.includes('fetch')) return 'Network hiccup. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
};

export const normalizeUsername = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<FwdProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) setProfile({
      ...data,
      website_url: data.link_url ?? null,
      is_public: data.profile_visibility !== 'private',
    } as FwdProfile);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchProfile(sess.user.id);
      else setProfile(null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [fetchProfile]);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: friendlyAuthError(error?.message) };
  };

  const getRedirectUrl = (path: string) => {
    // In a real native Android Capacitor environment, we prefer to use the custom scheme
    // or the registered app link so it bounces right back into the app.
    const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
    if (isNative) {
      return `com.treytv.fwd://${path.replace(/^\//, '')}`;
    }
    return `${window.location.origin}${path}`;
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const username = normalizeUsername(displayName || email.split('@')[0]) || `fwd_${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: getRedirectUrl('/auth/callback'),
        data: { display_name: displayName, full_name: displayName, username },
      },
    });
    return { error: friendlyAuthError(error?.message) };
  };

  const signInWithOAuth = async (provider: 'google' | 'github' | 'custom:trey-tv') => {
    const isTreyTv = provider === 'custom:trey-tv';
    if (isTreyTv) {
      try {
        sessionStorage.setItem('fwd_oauth_return_to', '/profile');
      } catch {}
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'],
      options: {
        redirectTo: getRedirectUrl('/auth/callback'),
        ...(isTreyTv ? { scopes: 'openid email profile' } : {}),
      },
    });
    return { error: friendlyAuthError(error?.message) };
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRedirectUrl('/reset-password'),
    });
    return { error: friendlyAuthError(error?.message) };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: friendlyAuthError(error?.message) };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (patch: Partial<FwdProfile>) => {
    if (!user) return { error: 'Not signed in' };
    const dbPatch: Record<string, any> = { ...patch };
    if (typeof dbPatch.username === 'string') {
      dbPatch.username = normalizeUsername(dbPatch.username);
      if (dbPatch.username.length < 3) return { error: 'Username must be at least 3 characters.' };
    }
    // Map virtual fields to actual DB columns
    if ('is_public' in dbPatch) {
      dbPatch.profile_visibility = dbPatch.is_public ? 'public' : 'private';
      delete dbPatch.is_public;
    }
    if ('website_url' in dbPatch) {
      dbPatch.link_url = dbPatch.website_url;
      delete dbPatch.website_url;
    }
    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', user.id);
    if (!error) await fetchProfile(user.id);
    if (error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate')) return { error: 'That username is already taken.' };
    return { error: error ? 'Profile save failed. Please try again.' : undefined };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signInWithEmail, signUpWithEmail, signInWithOAuth, requestPasswordReset, updatePassword, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
