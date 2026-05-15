import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Gif {
  id: string;
  title: string;
  image: string;
  tags: string[];
  category: string;
  mood?: string;
  user_id?: string;
}

export interface Collection {
  id: string;
  name: string;
  gifIds: string[];
  isPrivate?: boolean;
}

interface AppContextType {
  favorites: string[];
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  collections: Collection[];
  createCollection: (name: string, isPrivate?: boolean) => Promise<void>;
  addToCollection: (collectionId: string, gifId: string) => Promise<void>;
  userGifs: Gif[];
  createUserGif: (gif: Omit<Gif, 'id' | 'user_id'> & { isPublic?: boolean }) => Promise<Gif | null>;
  refresh: () => Promise<void>;
}

const defaultGuestCollections: Collection[] = [
  { id: 'c1', name: 'My Reactions', gifIds: ['g1', 'g4'] },
  { id: 'c2', name: 'Clapbacks', gifIds: ['g7'] },
  { id: 'c3', name: 'Funny', gifIds: ['g2', 'g9'] },
  { id: 'c4', name: 'Music Mood', gifIds: ['g5'] },
  { id: 'c5', name: 'Hype', gifIds: ['g4', 'g11'] },
  { id: 'c6', name: 'Private Collection', gifIds: [], isPrivate: true },
];

const AppContext = createContext<AppContextType>({} as any);
export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>(defaultGuestCollections);
  const [userGifs, setUserGifs] = useState<Gif[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(['side eye', 'vibes only', 'oh really?', 'that part', 'shook']);

  const loadAll = useCallback(async () => {
    if (!user) {
      // Guest: keep defaults / localStorage fallback for favorites
      try {
        const local = JSON.parse(localStorage.getItem('fwd_favs') || '[]');
        setFavorites(local);
      } catch {}
      setCollections(defaultGuestCollections);
      setUserGifs([]);
      return;
    }
    // Logged in: load from DB
    const [favRes, colRes, gifRes] = await Promise.all([
      supabase.from('favorites').select('gif_id').eq('user_id', user.id),
      supabase.from('collections').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('user_gifs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setFavorites(favRes.data?.map((r: any) => r.gif_id) || []);
    setCollections(
      (colRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, gifIds: c.gif_ids || [], isPrivate: c.is_private,
      }))
    );
    setUserGifs(
      (gifRes.data || []).map((g: any) => ({
        id: g.id, title: g.title, image: g.image_url, tags: g.tags || [],
        category: g.category || 'Reactions', mood: g.mood, user_id: g.user_id,
      }))
    );
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Persist guest favorites
  useEffect(() => {
    if (!user) localStorage.setItem('fwd_favs', JSON.stringify(favorites));
  }, [favorites, user]);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggleFavorite = useCallback(async (id: string) => {
    const has = favorites.includes(id);
    // Optimistic
    setFavorites(prev => has ? prev.filter(x => x !== id) : [...prev, id]);
    if (!user) return;
    if (has) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('gif_id', id);
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, gif_id: id });
    }
  }, [favorites, user]);

  const addRecentSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setRecentSearches(prev => [q, ...prev.filter(x => x !== q)].slice(0, 8));
  }, []);

  const clearRecentSearches = useCallback(() => setRecentSearches([]), []);

  const createCollection = useCallback(async (name: string, isPrivate = false) => {
    if (!user) {
      setCollections(prev => [...prev, { id: 'c' + Date.now(), name, gifIds: [], isPrivate }]);
      return;
    }
    const { data } = await supabase.from('collections').insert({
      user_id: user.id, name, is_private: isPrivate,
    }).select().single();
    if (data) setCollections(prev => [...prev, { id: data.id, name: data.name, gifIds: data.gif_ids || [], isPrivate: data.is_private }]);
  }, [user]);

  const addToCollection = useCallback(async (collectionId: string, gifId: string) => {
    const col = collections.find(c => c.id === collectionId);
    if (!col || col.gifIds.includes(gifId)) return;
    const newIds = [...col.gifIds, gifId];
    setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, gifIds: newIds } : c));
    if (user) {
      await supabase.from('collections').update({ gif_ids: newIds }).eq('id', collectionId);
    }
  }, [collections, user]);

  const createUserGif = useCallback(async (payload: Omit<Gif, 'id' | 'user_id'> & { isPublic?: boolean }) => {
    if (!user) return null;
    const { data, error } = await supabase.from('user_gifs').insert({
      user_id: user.id,
      title: payload.title,
      image_url: payload.image,
      tags: payload.tags,
      category: payload.category,
      mood: payload.mood,
      is_public: payload.isPublic ?? true,
    }).select().single();
    if (error || !data) return null;
    const newGif: Gif = {
      id: data.id, title: data.title, image: data.image_url, tags: data.tags || [],
      category: data.category || 'Reactions', mood: data.mood, user_id: data.user_id,
    };
    setUserGifs(prev => [newGif, ...prev]);
    return newGif;
  }, [user]);

  return (
    <AppContext.Provider value={{
      favorites, toggleFavorite, isFavorite,
      recentSearches, addRecentSearch, clearRecentSearches,
      collections, createCollection, addToCollection,
      userGifs, createUserGif, refresh: loadAll,
    }}>
      {children}
    </AppContext.Provider>
  );
};
