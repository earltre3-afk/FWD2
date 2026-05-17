import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMemory } from '@/hooks/useUserMemory';

export interface Gif {
  id: string;
  title: string;
  image: string;       // gif_url in DB
  still_url?: string;
  tags: string[];
  category: string;
  mood?: string;
  user_id?: string;
  caption?: string;
  allow_reuse?: boolean;
  allow_download?: boolean;
  reuse_count?: number;
  save_count?: number;
  like_count?: number;
  visibility?: string;
}

export interface Collection {
  id: string;
  name: string;
  gifIds: string[];
  isPrivate?: boolean;
}

export interface FwdPost {
  id: string;
  user_id: string;
  gif_id: string | null;
  gif?: Gif | null;
  caption: string | null;
  visibility: string;
  like_count: number;
  comment_count: number;
  save_count: number;
  reuse_count: number;
  created_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
  liked_by_me?: boolean;
  saved_by_me?: boolean;
}

interface AppContextType {
  favorites: string[];
  toggleFavorite: (id: string, gif?: Gif) => Promise<void>;
  isFavorite: (id: string) => boolean;
  savedLibrary: Gif[];
  removeSavedGif: (id: string) => Promise<void>;
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  collections: Collection[];
  createCollection: (name: string, isPrivate?: boolean) => Promise<void>;
  addToCollection: (collectionId: string, gifId: string) => Promise<void>;
  userGifs: Gif[];
  createUserGif: (gif: CreateGifPayload) => Promise<Gif | null>;
  refresh: () => Promise<void>;
  recordGifUse: (gifId: string, platform?: string, context?: string) => Promise<void>;
  // Feed
  feedPosts: FwdPost[];
  feedLoading: boolean;
  feedHasMore: boolean;
  loadMoreFeed: () => Promise<void>;
  createPost: (gifId: string, caption: string) => Promise<FwdPost | null>;
  deletePost: (postId: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  savePost: (postId: string) => Promise<void>;
}

export interface CreateGifPayload {
  title: string;
  image: string;
  still_url?: string;
  tags: string[];
  category: string;
  mood?: string;
  caption?: string;
  isPublic?: boolean;
  allow_reuse?: boolean;
  allow_download?: boolean;
  source_type?: string;
  width?: number;
  height?: number;
  file_size_bytes?: number;
  duration_ms?: number;
}

const defaultGuestCollections: Collection[] = [
  { id: 'c1', name: 'My Reactions', gifIds: [] },
  { id: 'c2', name: 'Clapbacks', gifIds: [] },
  { id: 'c3', name: 'Funny', gifIds: [] },
];

const FEED_PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AppContext = createContext<AppContextType>({} as any);
export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { recordUse, saveGif, removeGif, markCreated } = useUserMemory();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedLibrary, setSavedLibrary] = useState<Gif[]>([]);
  const [collections, setCollections] = useState<Collection[]>(defaultGuestCollections);
  const [userGifs, setUserGifs] = useState<Gif[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(['side eye', 'vibes only', 'oh really?', 'that part', 'shook']);

  // Feed state
  const [feedPosts, setFeedPosts] = useState<FwdPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [feedOffset, setFeedOffset] = useState(0);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

  const dbGifToGif = (g: any): Gif => ({
    id: g.id,
    title: g.title || 'Untitled',
    image: g.gif_url || g.image_url || g.media_url || g.preview_url || '',
    still_url: g.still_url || g.thumbnail_url || g.preview_url,
    tags: g.tags || [],
    category: g.category || 'Reactions',
    mood: g.mood,
    user_id: g.owner_user_id || g.user_id,
    caption: g.caption,
    allow_reuse: g.allow_reuse ?? true,
    allow_download: g.allow_download ?? true,
    reuse_count: g.reuse_count ?? 0,
    save_count: g.save_count ?? 0,
    like_count: g.like_count ?? 0,
    visibility: g.visibility || 'public',
  });

  const loadAll = useCallback(async () => {
    if (!user) {
      try {
        const local = JSON.parse(localStorage.getItem('fwd_favs') || '[]');
        setFavorites(local);
      } catch {}
      setCollections(defaultGuestCollections);
      setUserGifs([]);
      setSavedLibrary([]);
      return;
    }

    const [favRes, colRes, gifRes] = await Promise.all([
      supabase.from('favorites').select('gif_id').eq('user_id', user.id),
      supabase.from('collections').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('fwd_gifs').select('*').eq('owner_user_id', user.id).order('created_at', { ascending: false }),
    ]);

    const favIds: string[] = (favRes.data || []).map((r: any) => r.gif_id).filter(Boolean);
    setFavorites(favIds);

    const userGifList = (gifRes.data || []).map(dbGifToGif);
    setUserGifs(userGifList);

    setCollections(
      (colRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, gifIds: c.gif_ids || [], isPrivate: c.is_private,
      }))
    );

    // Load Gif objects for UUID favorites that aren't already in userGifs
    const userGifIdSet = new Set(userGifList.map(g => g.id));
    const uuidFavIds = favIds.filter(id => UUID_RE.test(id) && !userGifIdSet.has(id));
    let favGifObjects: Gif[] = [];
    if (uuidFavIds.length > 0) {
      const { data: favGifData } = await supabase.from('fwd_gifs').select('*').in('id', uuidFavIds);
      favGifObjects = (favGifData || []).map(dbGifToGif);
    }

    // savedLibrary = user's created GIFs + other GIFs they favorited
    setSavedLibrary([...userGifList, ...favGifObjects]);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!user) localStorage.setItem('fwd_favs', JSON.stringify(favorites));
  }, [favorites, user]);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const toggleFavorite = useCallback(async (id: string, gif?: Gif) => {
    const has = favorites.includes(id);
    setFavorites(prev => has ? prev.filter(x => x !== id) : [...prev, id]);
    if (gif) {
      setSavedLibrary(prev => has
        ? prev.filter(x => x.id !== id)
        : [gif, ...prev.filter(x => x.id !== id)]
      );
    }
    if (!user) return;
    if (has) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('gif_id', id);
      removeGif(id, 'fwd');
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, gif_id: id });
      saveGif(id, 'fwd');
    }
  }, [favorites, user, saveGif, removeGif]);

  const removeSavedGif = useCallback(async (id: string) => {
    setFavorites(prev => prev.filter(x => x !== id));
    setSavedLibrary(prev => prev.filter(g => g.id !== id));
    if (user) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('gif_id', id);
      removeGif(id, 'fwd');
    }
  }, [user, removeGif]);

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

  const createUserGif = useCallback(async (payload: CreateGifPayload): Promise<Gif | null> => {
    if (!user) return null;
    const fullPayload = {
      owner_user_id: user.id,
      title: payload.title,
      caption: payload.caption ?? null,
      gif_url: payload.image,
      media_url: payload.image,
      still_url: payload.still_url ?? null,
      preview_url: payload.still_url ?? payload.image,
      thumbnail_url: payload.still_url ?? payload.image,
      tags: payload.tags,
      category: payload.category,
      mood: payload.mood ?? null,
      visibility: payload.isPublic === false ? 'private' : 'public',
      allow_reuse: payload.allow_reuse ?? true,
      allow_download: payload.allow_download ?? true,
      source_type: payload.source_type ?? 'created',
      width: payload.width ?? null,
      height: payload.height ?? null,
      file_size_bytes: payload.file_size_bytes ?? null,
      duration_ms: payload.duration_ms ?? null,
    };

    let { data, error } = await supabase.from('fwd_gifs').insert(fullPayload).select().single();

    if (error) {
      const legacyPayload = {
        owner_user_id: user.id,
        title: payload.title,
        media_url: payload.image,
        preview_url: payload.still_url ?? payload.image,
        thumbnail_url: payload.still_url ?? payload.image,
        tags: payload.tags,
        category: payload.category,
        visibility: payload.isPublic === false ? 'private' : 'public',
        status: 'approved',
      };
      const legacyResult = await supabase.from('fwd_gifs').insert(legacyPayload).select().single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error || !data) return null;

    const newGif = dbGifToGif(data);
    setUserGifs(prev => [newGif, ...prev]);
    setSavedLibrary(prev => [newGif, ...prev.filter(g => g.id !== newGif.id)]);
    setFavorites(prev => prev.includes(data.id) ? prev : [...prev, data.id]);
    // Auto-favorite newly created GIF
    await supabase.from('favorites').upsert(
      { user_id: user.id, gif_id: data.id },
      { onConflict: 'user_id,gif_id' }
    );
    markCreated(data.id, 'fwd');
    return newGif;
  }, [user, markCreated]);

  const recordGifUse = useCallback(
    (gifId: string, platform = 'fwd', context?: string) => recordUse(gifId, platform, context),
    [recordUse]
  );

  // ---- Feed ----

  const fetchFeedPage = useCallback(async (offset: number, userId: string | undefined) => {
    const { data, error } = await supabase
      .from('fwd_feed_posts')
      .select(`
        *,
        gif:gif_id ( id, gif_url, still_url, title, allow_reuse, allow_download, owner_user_id ),
        profile:user_id ( display_name, username, avatar_url )
      `)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + FEED_PAGE_SIZE - 1);

    if (error || !data) return [];

    let likedSet = new Set<string>();
    let savedSet = new Set<string>();

    if (userId && data.length > 0) {
      const postIds = data.map((p: any) => p.id);
      const [likedRes, savedRes] = await Promise.all([
        supabase.from('fwd_post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
        supabase.from('fwd_post_saves').select('post_id').eq('user_id', userId).in('post_id', postIds),
      ]);
      likedSet = new Set((likedRes.data || []).map((r: any) => r.post_id));
      savedSet = new Set((savedRes.data || []).map((r: any) => r.post_id));
    }

    setLikedPostIds(prev => new Set([...prev, ...likedSet]));
    setSavedPostIds(prev => new Set([...prev, ...savedSet]));

    return data.map((p: any): FwdPost => ({
      id: p.id,
      user_id: p.user_id,
      gif_id: p.gif_id,
      gif: p.gif ? dbGifToGif({ ...p.gif, gif_url: p.gif.gif_url }) : null,
      caption: p.caption,
      visibility: p.visibility,
      like_count: p.like_count,
      comment_count: p.comment_count,
      save_count: p.save_count,
      reuse_count: p.reuse_count,
      created_at: p.created_at,
      profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
      liked_by_me: likedSet.has(p.id),
      saved_by_me: savedSet.has(p.id),
    }));
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (feedLoading || !feedHasMore) return;
    setFeedLoading(true);
    const posts = await fetchFeedPage(feedOffset, user?.id);
    if (posts.length < FEED_PAGE_SIZE) setFeedHasMore(false);
    setFeedPosts(prev => feedOffset === 0 ? posts : [...prev, ...posts]);
    setFeedOffset(prev => prev + posts.length);
    setFeedLoading(false);
  }, [feedLoading, feedHasMore, feedOffset, user, fetchFeedPage]);

  useEffect(() => {
    setFeedPosts([]);
    setFeedOffset(0);
    setFeedHasMore(true);
  }, [user]);

  const createPost = useCallback(async (gifId: string, caption: string): Promise<FwdPost | null> => {
    if (!user) return null;
    const { data, error } = await supabase.from('fwd_feed_posts').insert({
      user_id: user.id,
      gif_id: gifId,
      caption: caption.trim() || null,
      visibility: 'public',
    }).select(`
      *,
      gif:gif_id ( id, gif_url, still_url, title, allow_reuse, allow_download, owner_user_id ),
      profile:user_id ( display_name, username, avatar_url )
    `).single();

    if (error || !data) return null;

    const post: FwdPost = {
      id: data.id,
      user_id: data.user_id,
      gif_id: data.gif_id,
      gif: data.gif ? dbGifToGif({ ...data.gif, gif_url: data.gif.gif_url }) : null,
      caption: data.caption,
      visibility: data.visibility,
      like_count: 0,
      comment_count: 0,
      save_count: 0,
      reuse_count: 0,
      created_at: data.created_at,
      profile: Array.isArray(data.profile) ? data.profile[0] : data.profile,
      liked_by_me: false,
      saved_by_me: false,
    };

    setFeedPosts(prev => [post, ...prev]);
    return post;
  }, [user]);

  const deletePost = useCallback(async (postId: string) => {
    await supabase.from('fwd_feed_posts').delete().eq('id', postId);
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const toggleLike = useCallback(async (postId: string) => {
    if (!user) return;
    const liked = likedPostIds.has(postId);
    setLikedPostIds(prev => {
      const next = new Set(prev);
      if (liked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setFeedPosts(prev => prev.map(p => p.id === postId
      ? { ...p, like_count: p.like_count + (liked ? -1 : 1), liked_by_me: !liked }
      : p
    ));
    if (liked) {
      await supabase.from('fwd_post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('fwd_post_likes').insert({ post_id: postId, user_id: user.id });
    }
  }, [user, likedPostIds]);

  const savePost = useCallback(async (postId: string) => {
    if (!user) return;
    const saved = savedPostIds.has(postId);
    setSavedPostIds(prev => {
      const next = new Set(prev);
      if (saved) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setFeedPosts(prev => prev.map(p => p.id === postId
      ? { ...p, save_count: p.save_count + (saved ? -1 : 1), saved_by_me: !saved }
      : p
    ));
    if (saved) {
      await supabase.from('fwd_post_saves').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('fwd_post_saves').insert({ post_id: postId, user_id: user.id });
    }
  }, [user, savedPostIds]);

  return (
    <AppContext.Provider value={{
      favorites, toggleFavorite, isFavorite, savedLibrary, removeSavedGif,
      recentSearches, addRecentSearch, clearRecentSearches,
      collections, createCollection, addToCollection,
      userGifs, createUserGif, refresh: loadAll,
      recordGifUse,
      feedPosts, feedLoading, feedHasMore,
      loadMoreFeed, createPost, deletePost,
      toggleLike, savePost,
    }}>
      {children}
    </AppContext.Provider>
  );
};
