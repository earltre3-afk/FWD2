import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserMemory {
  recent_gif_ids: string[];
  saved_gif_ids: string[];
  created_gif_ids: string[];
  last_seen_by: Record<string, string>;
  preferences: Record<string, unknown>;
  recents_limit: number;
  updated_at: string;
}

interface UseUserMemoryReturn {
  memory: UserMemory | null;
  loading: boolean;
  recordUse: (gifId: string, platform?: string, context?: string) => Promise<void>;
  saveGif: (gifId: string, platform?: string) => Promise<void>;
  removeGif: (gifId: string, platform?: string) => Promise<void>;
  markCreated: (gifId: string, platform?: string) => Promise<void>;
  updatePreferences: (patch: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * User memory reserve — cross-platform GIF state.
 * Syncs the user's saved, created, and recent GIFs across
 * every platform that integrates FWD (fwd.treytv.com, Trey TV, embeds, picker).
 */
export function useUserMemory(): UseUserMemoryReturn {
  const { user } = useAuth();
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) { setMemory(null); return; }
    setLoading(true);
    const { data } = await supabase
      .from('fwd_user_memory')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setMemory(data as UserMemory);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const rpc = useCallback(
    async (
      gifId: string,
      eventType: 'used' | 'saved' | 'created' | 'removed',
      platform = 'fwd',
      context?: string
    ) => {
      if (!user) return;
      await supabase.rpc('fwd_record_gif_use', {
        p_user_id: user.id,
        p_gif_id: gifId,
        p_event_type: eventType,
        p_platform: platform,
        p_context: context ?? null,
      });
      await fetch();
    },
    [user, fetch]
  );

  const recordUse = useCallback(
    (gifId: string, platform = 'fwd', context?: string) =>
      rpc(gifId, 'used', platform, context),
    [rpc]
  );

  const saveGif = useCallback(
    (gifId: string, platform = 'fwd') => rpc(gifId, 'saved', platform),
    [rpc]
  );

  const removeGif = useCallback(
    (gifId: string, platform = 'fwd') => rpc(gifId, 'removed', platform),
    [rpc]
  );

  const markCreated = useCallback(
    (gifId: string, platform = 'fwd') => rpc(gifId, 'created', platform),
    [rpc]
  );

  const updatePreferences = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!user) return;
      const merged = { ...(memory?.preferences ?? {}), ...patch };
      await supabase
        .from('fwd_user_memory')
        .update({ preferences: merged })
        .eq('user_id', user.id);
      await fetch();
    },
    [user, memory, fetch]
  );

  return {
    memory,
    loading,
    recordUse,
    saveGif,
    removeGif,
    markCreated,
    updatePreferences,
    refresh: fetch,
  };
}
