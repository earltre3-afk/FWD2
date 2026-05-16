import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface FwdProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<FwdProfile>) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType>({} as any);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<FwdProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (data) setProfile(data as FwdProfile);
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
    return { error: error?.message };
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, full_name: displayName } },
    });
    return { error: error?.message };
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message };
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
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (!error) await fetchProfile(user.id);
    return { error: error?.message };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signInWithEmail, signUpWithEmail, signInWithOAuth, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
