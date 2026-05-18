import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMemory } from '@/hooks/useUserMemory';
import { resolveFwdMedia } from '@/lib/fwdMedia';
import { editMetadataFromDb, MediaEditMetadata } from '@/lib/mediaEdits';

export interface Gif {
  id: string;
  title: string;
  image: string;       // gif_url in DB
  still_url?: string;
  webm_url?: string;
  source_video_url?: string;
  media_type?: string;
  is_animated?: boolean;
  mp4_url?: string;    // H.264 MP4 rendition — pass as mp4Url to FwdMediaPlayer for Safari
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
  provider?: string;
  provider_gif_id?: string;
  trim_start?: number | null;
  trim_end?: number | null;
  original_duration?: number | null;
  edited_duration?: number | null;
  crop_x?: number | null;
  crop_y?: number | null;
  crop_width?: number | null;
  crop_height?: number | null;
  crop_aspect_ratio?: string | null;
  output_aspect_ratio?: string | null;
  edit_metadata?: MediaEditMetadata | null;
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
  deleteUserGif: (gifId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  recordGifUse: (gifId: string, platform?: string, context?: string) => Promise<void>;
  // Feed
  feedPosts: FwdPost[];
  feedLoading: boolean;
  feedHasMore: boolean;
  loadMoreFeed: () => Promise<void>;
  createPost: (gifId: string, caption: string) => Promise<FwdPost | null>;
  updatePost: (postId: string, gifId: string, caption: string) => Promise<boolean>;
  deletePost: (postId: string) => Promise<boolean>;
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
  source_video_url?: string;
  media_type?: string;
  is_animated?: boolean;
  trim_start?: number | null;
  trim_end?: number | null;
  original_duration?: number | null;
  edited_duration?: number | null;
  crop_x?: number | null;
  crop_y?: number | null;
  crop_width?: number | null;
  crop_height?: number | null;
  crop_aspect_ratio?: string | null;
  output_aspect_ratio?: string | null;
  edit_metadata?: MediaEditMetadata | null;
}

const defaultGuestCollections: Collection[] = [
  { id: 'c1', name: 'My Reactions', gifIds: [] },
  { id: 'c2', name: 'Clapbacks', gifIds: [] },
  { id: 'c3', name: 'Funny', gifIds: [] },
];

const FEED_PAGE_SIZE = 20;
const normalizeUsername = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
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

  const dbGifToGif = (g: any): Gif => {
    const media = resolveFwdMedia(g);
    return {
      id: g.id,
      title: g.title || 'Untitled',
      image: media.animatedUrl || '',
      still_url: media.thumbnailUrl || undefined,
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
      mp4_url: media.mp4Url || undefined,
      webm_url: media.webmUrl || undefined,
      source_video_url: media.sourceVideoUrl || undefined,
      media_type: g.media_type || (media.mediaType === 'gif' ? 'image/gif' : media.mediaType === 'video' ? 'video/mp4' : undefined),
      is_animated: g.is_animated ?? media.isLikelyAnimated,
      provider: g.provider,
      provider_gif_id: g.provider_gif_id,
      trim_start: g.trim_start ?? null,
      trim_end: g.trim_end ?? null,
      original_duration: g.original_duration ?? null,
      edited_duration: g.edited_duration ?? null,
      crop_x: g.crop_x ?? null,
      crop_y: g.crop_y ?? null,
      crop_width: g.crop_width ?? null,
      crop_height: g.crop_height ?? null,
      crop_aspect_ratio: g.crop_aspect_ratio ?? null,
      output_aspect_ratio: g.output_aspect_ratio ?? null,
      edit_metadata: editMetadataFromDb(g),
    };
  };

  const savedProviderGifToGif = (g: any): Gif => {
    const media = resolveFwdMedia(g);
    return {
      id: `saved:${g.provider}:${g.provider_gif_id}`,
      title: g.title || 'Saved GIF',
      image: media.animatedUrl || '',
      still_url: media.thumbnailUrl || undefined,
      mp4_url: media.mp4Url || undefined,
      webm_url: media.webmUrl || undefined,
      source_video_url: media.sourceVideoUrl || undefined,
      media_type: g.media_type || (media.mediaType === 'gif' ? 'image/gif' : media.mediaType === 'video' ? 'video/mp4' : undefined),
      is_animated: g.is_animated ?? media.isLikelyAnimated,
      tags: [g.original_query, g.ai_scout_query, g.provider].filter(Boolean),
      category: 'Scout',
      mood: 'AI Scout',
      user_id: g.user_id,
      visibility: g.is_private === false ? 'public' : 'private',
      provider: g.provider,
      provider_gif_id: g.provider_gif_id,
      edit_metadata: editMetadataFromDb(g),
    };
  };

  const ensureProfile = useCallback(async () => {
    if (!user) return false;
    const metadata = user.user_metadata || {};
    const emailName = user.email?.split('@')[0] || '';
    const displayName = metadata.display_name || metadata.full_name || emailName || 'FWD User';
    const username = normalizeUsername(metadata.username || displayName || emailName) || `fwd_${user.id.slice(0, 8)}`;

    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        username,
        display_name: displayName,
        avatar_url: metadata.avatar_url || metadata.picture || null,
        is_public: true,
      },
      { onConflict: 'id' }
    );

    return !error;
  }, [user]);

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

    const [favRes, colRes, gifRes, savedProviderRes] = await Promise.all([
      supabase.from('fwd_favorites').select('gif_id').eq('user_id', user.id),
      supabase.from('fwd_collections').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('fwd_gifs').select('*').eq('owner_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('saved_gifs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    const favIds: string[] = (favRes.data || []).map((r: any) => r.gif_id).filter(Boolean);
    setFavorites(favIds);

    const userGifList = (gifRes.data || []).map(dbGifToGif);
    setUserGifs(userGifList);

    setCollections(
      (colRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, gifIds: c.gif_ids || [], isPrivate: c.visibility === 'private',
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

    const savedProviderGifs = (savedProviderRes.data || []).map(savedProviderGifToGif).filter((g) => Boolean(g.image));

    // savedLibrary = user's created GIFs + other GIFs they favorited + provider GIFs selected from AI Scout
    setSavedLibrary([...savedProviderGifs, ...userGifList, ...favGifObjects]);
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
      await supabase.from('fwd_favorites').delete().eq('user_id', user.id).eq('gif_id', id);
      removeGif(id, 'fwd');
    } else {
      await supabase.from('fwd_favorites').insert({ user_id: user.id, gif_id: id });
      saveGif(id, 'fwd');
    }
  }, [favorites, user, saveGif, removeGif]);

  const removeSavedGif = useCallback(async (id: string) => {
    setFavorites(prev => prev.filter(x => x !== id));
    setSavedLibrary(prev => prev.filter(g => g.id !== id));
    if (user) {
      if (id.startsWith('saved:')) {
        const [, provider, providerGifId] = id.split(':');
        if (provider && providerGifId) {
          await supabase
            .from('saved_gifs')
            .delete()
            .eq('user_id', user.id)
            .eq('provider', provider)
            .eq('provider_gif_id', providerGifId);
        }
      } else {
        await supabase.from('fwd_favorites').delete().eq('user_id', user.id).eq('gif_id', id);
        removeGif(id, 'fwd');
      }
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
    const { data } = await supabase.from('fwd_collections').insert({
      user_id: user.id, name, visibility: isPrivate ? 'private' : 'public',
    }).select().single();
    if (data) setCollections(prev => [...prev, { id: data.id, name: data.name, gifIds: [], isPrivate: data.visibility === 'private' }]);
  }, [user]);

  const addToCollection = useCallback(async (collectionId: string, gifId: string) => {
    const col = collections.find(c => c.id === collectionId);
    if (!col || col.gifIds.includes(gifId)) return;
    const newIds = [...col.gifIds, gifId];
    setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, gifIds: newIds } : c));
    if (user) {
      await supabase.from('fwd_collection_items').upsert({ collection_id: collectionId, gif_id: gifId });
    }
  }, [collections, user]);

  const createUserGif = useCallback(async (payload: CreateGifPayload): Promise<Gif | null> => {
    if (!user) return null;
    const insertPayload = {
      owner_user_id: user.id,
      title: payload.title,
      caption: payload.caption ?? null,
      gif_url: payload.image,
      media_url: payload.image,
      still_url: payload.still_url ?? null,
      thumbnail_url: payload.still_url ?? null,
      preview_url: payload.still_url ?? null,
      source_video_url: payload.source_video_url ?? null,
      media_type: payload.media_type ?? 'image/gif',
      is_animated: payload.is_animated ?? true,
      tags: payload.tags,
      category: payload.category,
      visibility: payload.isPublic === false ? 'private' : 'public',
      allow_reuse: payload.allow_reuse ?? true,
      allow_download: payload.allow_download ?? true,
      source_type: payload.source_type ?? 'created',
      width: payload.width ?? null,
      height: payload.height ?? null,
      file_size_bytes: payload.file_size_bytes ?? null,
      duration_ms: payload.duration_ms ?? null,
      trim_start: payload.trim_start ?? null,
      trim_end: payload.trim_end ?? null,
      original_duration: payload.original_duration ?? null,
      edited_duration: payload.edited_duration ?? null,
      crop_x: payload.crop_x ?? null,
      crop_y: payload.crop_y ?? null,
      crop_width: payload.crop_width ?? null,
      crop_height: payload.crop_height ?? null,
      crop_aspect_ratio: payload.crop_aspect_ratio ?? null,
      output_aspect_ratio: payload.output_aspect_ratio ?? null,
      edit_metadata: payload.edit_metadata ?? null,
    };

    const { data, error } = await supabase.from('fwd_gifs').insert(insertPayload).select().single();

    if (error || !data) return null;

    const newGif = dbGifToGif(data);
    setUserGifs(prev => [newGif, ...prev]);
    setSavedLibrary(prev => [newGif, ...prev.filter(g => g.id !== newGif.id)]);
    setFavorites(prev => prev.includes(data.id) ? prev : [...prev, data.id]);
    // Auto-favorite newly created GIF
    await supabase.from('fwd_favorites').upsert(
      { user_id: user.id, gif_id: data.id },
      { onConflict: 'user_id,gif_id' }
    );
    markCreated(data.id, 'fwd');
    return newGif;
  }, [user, markCreated]);

  const deleteUserGif = useCallback(async (gifId: string): Promise<boolean> => {
    if (!user) return false;
    const gif = userGifs.find(g => g.id === gifId);

    // Optimistic removal from all local state
    setUserGifs(prev => prev.filter(g => g.id !== gifId));
    setSavedLibrary(prev => prev.filter(g => g.id !== gifId));
    setFavorites(prev => prev.filter(id => id !== gifId));
    setFeedPosts(prev => prev.filter(p => p.gif_id !== gifId));
    setCollections(prev => prev.map(c => ({ ...c, gifIds: c.gifIds.filter(id => id !== gifId) })));

    // Delete the master record (ownership-guarded)
    const { error } = await supabase
      .from('fwd_gifs')
      .delete()
      .eq('id', gifId)
      .eq('owner_user_id', user.id);

    if (error) {
      // Roll back on failure
      if (gif) {
        setUserGifs(prev => [gif, ...prev]);
        setSavedLibrary(prev => [gif, ...prev]);
      }
      return false;
    }

    // Cascade-delete across all related tables (best-effort, fire-and-forget)
    Promise.all([
      // Remove from every user's favorites
      supabase.from('fwd_favorites').delete().eq('gif_id', gifId),
      // Remove all feed posts that reference this GIF
      supabase.from('fwd_feed_posts').delete().eq('gif_id', gifId),
      // Remove from all collections
      supabase.from('fwd_collection_items').delete().eq('gif_id', gifId),
      // Remove from external scout cache so it won't resurface in search
      supabase.from('reaction_search_cache').delete().eq('source_id', gifId),
    ]).catch(() => { /* non-fatal — main row is already gone */ });

    // Best-effort storage cleanup
    if (gif?.image) {
      try {
        const url = new URL(gif.image);
        const prefix = '/storage/v1/object/public/fwd-gifs/';
        if (url.pathname.startsWith(prefix)) {
          await supabase.storage.from('fwd-gifs').remove([url.pathname.slice(prefix.length)]);
        }
      } catch { /* non-fatal */ }
    }

    return true;
  }, [user, userGifs]);

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
        gif:gif_id ( id, gif_url, media_url, still_url, thumbnail_url, preview_url, source_video_url, media_type, is_animated, title, allow_reuse, allow_download, owner_user_id, trim_start, trim_end, original_duration, edited_duration, crop_x, crop_y, crop_width, crop_height, crop_aspect_ratio, output_aspect_ratio, edit_metadata ),
        profile:fwd_feed_posts_user_profiles_fk ( display_name, username, avatar_url )
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
      gif: p.gif ? dbGifToGif(p.gif) : null,
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
    const profileReady = await ensureProfile();
    if (!profileReady) return null;

    const { data, error } = await supabase.from('fwd_feed_posts').insert({
      user_id: user.id,
      gif_id: gifId,
      caption: caption.trim() || null,
      visibility: 'public',
    }).select(`
      *,
      gif:gif_id ( id, gif_url, media_url, still_url, thumbnail_url, preview_url, source_video_url, media_type, is_animated, title, allow_reuse, allow_download, owner_user_id, trim_start, trim_end, original_duration, edited_duration, crop_x, crop_y, crop_width, crop_height, crop_aspect_ratio, output_aspect_ratio, edit_metadata ),
      profile:fwd_feed_posts_user_profiles_fk ( display_name, username, avatar_url )
    `).single();

    if (error || !data) return null;

    const post: FwdPost = {
      id: data.id,
      user_id: data.user_id,
      gif_id: data.gif_id,
      gif: data.gif ? dbGifToGif(data.gif) : null,
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
  }, [ensureProfile, user]);

  const updatePost = useCallback(async (postId: string, gifId: string, caption: string) => {
    if (!user) return false;

    const { data, error } = await supabase.from('fwd_feed_posts').update({
      gif_id: gifId,
      caption: caption.trim() || null,
    }).eq('id', postId).select(`
      *,
      gif:gif_id ( id, gif_url, media_url, still_url, thumbnail_url, preview_url, source_video_url, media_type, is_animated, title, allow_reuse, allow_download, owner_user_id, trim_start, trim_end, original_duration, edited_duration, crop_x, crop_y, crop_width, crop_height, crop_aspect_ratio, output_aspect_ratio, edit_metadata ),
      profile:fwd_feed_posts_user_profiles_fk ( display_name, username, avatar_url )
    `).maybeSingle();

    if (error || !data) return false;

    setFeedPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      gif_id: data.gif_id,
      gif: data.gif ? dbGifToGif(data.gif) : null,
      caption: data.caption,
      visibility: data.visibility,
      profile: Array.isArray(data.profile) ? data.profile[0] : data.profile,
    } : p));
    return true;
  }, [user]);

  const deletePost = useCallback(async (postId: string) => {
    if (!user) return false;
    const { error } = await supabase.from('fwd_feed_posts').delete().eq('id', postId);
    if (error) return false;
    setFeedPosts(prev => prev.filter(p => p.id !== postId));
    return true;
  }, [user]);

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
    const { error } = liked
      ? await supabase.from('fwd_post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from('fwd_post_likes').upsert({ post_id: postId, user_id: user.id }, { onConflict: 'post_id,user_id' });

    if (error) {
      setLikedPostIds(prev => {
        const next = new Set(prev);
        if (liked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setFeedPosts(prev => prev.map(p => p.id === postId
        ? { ...p, like_count: Math.max(0, p.like_count + (liked ? 1 : -1)), liked_by_me: liked }
        : p
      ));
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
      userGifs, createUserGif, deleteUserGif, refresh: loadAll,
      recordGifUse,
      feedPosts, feedLoading, feedHasMore,
      loadMoreFeed, createPost, updatePost, deletePost,
      toggleLike, savePost,
    }}>
      {children}
    </AppContext.Provider>
  );
};
