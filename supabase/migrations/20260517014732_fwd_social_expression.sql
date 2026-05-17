-- FWD social expression pass.
-- This migration keeps the existing fwd_* production tables and adds the
-- compatibility/public surfaces currently used by the app.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles used by the current app. Mirrors the auth user id directly.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  location text,
  website_url text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (
    username IS NULL OR username ~ '^[a-z0-9_]{3,24}$'
  )
);

CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_public_idx ON public.profiles (is_public);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT
  USING (is_public IS DISTINCT FROM false OR id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fwd_normalize_username()
RETURNS trigger AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(regexp_replace(NEW.username, '[^a-zA-Z0-9_]+', '_', 'g'));
    NEW.username := trim(both '_' from NEW.username);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_profiles_username ON public.profiles;
CREATE TRIGGER normalize_profiles_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fwd_normalize_username();

-- Auto-provision manual email/password sign-ups.
CREATE OR REPLACE FUNCTION public.fwd_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  display text;
BEGIN
  display := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    split_part(COALESCE(NEW.email, 'fwd'), '@', 1),
    'FWD User'
  );

  base_username := lower(regexp_replace(split_part(COALESCE(NEW.email, NEW.id::text), '@', 1), '[^a-zA-Z0-9_]+', '_', 'g'));
  base_username := trim(both '_' from base_username);
  IF length(base_username) < 3 THEN
    base_username := 'fwd_' || substr(NEW.id::text, 1, 8);
  END IF;
  base_username := substr(base_username, 1, 24);
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username AND id <> NEW.id) LOOP
    final_username := substr(base_username, 1, 15) || '_' || substr(gen_random_uuid()::text, 1, 6);
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, is_public)
  VALUES (
    NEW.id,
    final_username,
    display,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.fwd_profiles (user_id, username, display_name, avatar_url, is_public)
  VALUES (
    NEW.id,
    final_username,
    display,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.fwd_user_memory (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fwd_on_auth_user_created_profile ON auth.users;
CREATE TRIGGER fwd_on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fwd_handle_new_user();

-- Keep the existing fwd tables compatible with the app's current columns.
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS gif_url text;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS still_url text;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS mood text;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'created';
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS allow_reuse boolean DEFAULT true;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS allow_download boolean DEFAULT true;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS reuse_count integer DEFAULT 0;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS save_count integer DEFAULT 0;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS width integer;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS height integer;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
ALTER TABLE public.fwd_gifs ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.fwd_gifs ALTER COLUMN media_url DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fwd_gifs_sync_media_columns()
RETURNS trigger AS $$
BEGIN
  NEW.gif_url := COALESCE(NEW.gif_url, NEW.media_url);
  NEW.media_url := COALESCE(NEW.media_url, NEW.gif_url);
  NEW.still_url := COALESCE(NEW.still_url, NEW.preview_url, NEW.thumbnail_url);
  NEW.thumbnail_url := COALESCE(NEW.thumbnail_url, NEW.still_url, NEW.preview_url);
  NEW.preview_url := COALESCE(NEW.preview_url, NEW.still_url, NEW.thumbnail_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fwd_gifs_sync_media_columns ON public.fwd_gifs;
CREATE TRIGGER fwd_gifs_sync_media_columns
  BEFORE INSERT OR UPDATE ON public.fwd_gifs
  FOR EACH ROW EXECUTE FUNCTION public.fwd_gifs_sync_media_columns();

ALTER TABLE public.fwd_collections ADD COLUMN IF NOT EXISTS gif_ids text[] DEFAULT '{}';
ALTER TABLE public.fwd_collections ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT true;

CREATE OR REPLACE VIEW public.user_gifs WITH (security_invoker = true) AS
SELECT
  id,
  owner_user_id AS user_id,
  title,
  COALESCE(gif_url, media_url) AS image_url,
  COALESCE(still_url, thumbnail_url, preview_url) AS still_url,
  tags,
  category,
  mood,
  caption,
  visibility,
  status,
  allow_reuse,
  allow_download,
  reuse_count,
  save_count,
  like_count,
  created_at,
  updated_at,
  (visibility = 'public' AND status = 'approved') AS is_public
FROM public.fwd_gifs;

CREATE OR REPLACE VIEW public.collections WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  name,
  description,
  gif_ids,
  is_private,
  visibility,
  created_at,
  updated_at
FROM public.fwd_collections;

-- Follow graph.
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follows are publicly readable" ON public.follows;
CREATE POLICY "Follows are publicly readable"
  ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users follow as self" ON public.follows;
CREATE POLICY "Users follow as self"
  ON public.follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "Users unfollow as self" ON public.follows;
CREATE POLICY "Users unfollow as self"
  ON public.follows FOR DELETE
  USING (follower_id = auth.uid());

-- Feed, likes, saves, comments, and share events.
CREATE TABLE IF NOT EXISTS public.fwd_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE SET NULL,
  caption text,
  visibility text DEFAULT 'public',
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  save_count integer DEFAULT 0,
  reuse_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fwd_feed_posts_user_profiles_fk') THEN
    ALTER TABLE public.fwd_feed_posts
      ADD CONSTRAINT fwd_feed_posts_user_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fwd_feed_posts_user_idx ON public.fwd_feed_posts (user_id);
CREATE INDEX IF NOT EXISTS fwd_feed_posts_gif_idx ON public.fwd_feed_posts (gif_id);
CREATE INDEX IF NOT EXISTS fwd_feed_posts_public_created_idx ON public.fwd_feed_posts (visibility, created_at DESC);
ALTER TABLE public.fwd_feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public feed posts readable" ON public.fwd_feed_posts;
CREATE POLICY "Public feed posts readable"
  ON public.fwd_feed_posts FOR SELECT
  USING (visibility = 'public' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own feed posts" ON public.fwd_feed_posts;
CREATE POLICY "Users create own feed posts"
  ON public.fwd_feed_posts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own feed posts" ON public.fwd_feed_posts;
CREATE POLICY "Users update own feed posts"
  ON public.fwd_feed_posts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own feed posts" ON public.fwd_feed_posts;
CREATE POLICY "Users delete own feed posts"
  ON public.fwd_feed_posts FOR DELETE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_fwd_feed_posts_updated_at ON public.fwd_feed_posts;
CREATE TRIGGER update_fwd_feed_posts_updated_at
  BEFORE UPDATE ON public.fwd_feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.fwd_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.fwd_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.fwd_post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.fwd_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.gif_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_id uuid NOT NULL REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, gif_id)
);

CREATE TABLE IF NOT EXISTS public.gif_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gif_id uuid NOT NULL REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.gif_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gif_comments_user_profiles_fk') THEN
    ALTER TABLE public.gif_comments
      ADD CONSTRAINT gif_comments_user_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fwd_gifs_owner_profiles_fk') THEN
    ALTER TABLE public.fwd_gifs
      ADD CONSTRAINT fwd_gifs_owner_profiles_fk
      FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gif_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  share_channel text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fwd_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.fwd_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fwd_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gif_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gif_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gif_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post likes readable" ON public.fwd_post_likes;
CREATE POLICY "Post likes readable" ON public.fwd_post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users create own post likes" ON public.fwd_post_likes;
CREATE POLICY "Users create own post likes" ON public.fwd_post_likes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own post likes" ON public.fwd_post_likes;
CREATE POLICY "Users delete own post likes" ON public.fwd_post_likes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Post saves readable by owner" ON public.fwd_post_saves;
CREATE POLICY "Post saves readable by owner" ON public.fwd_post_saves FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users create own post saves" ON public.fwd_post_saves;
CREATE POLICY "Users create own post saves" ON public.fwd_post_saves FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own post saves" ON public.fwd_post_saves;
CREATE POLICY "Users delete own post saves" ON public.fwd_post_saves FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "GIF likes readable" ON public.gif_likes;
CREATE POLICY "GIF likes readable" ON public.gif_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users create own gif likes" ON public.gif_likes;
CREATE POLICY "Users create own gif likes" ON public.gif_likes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own gif likes" ON public.gif_likes;
CREATE POLICY "Users delete own gif likes" ON public.gif_likes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "GIF comments readable" ON public.gif_comments;
CREATE POLICY "GIF comments readable" ON public.gif_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users create own gif comments" ON public.gif_comments;
CREATE POLICY "Users create own gif comments" ON public.gif_comments FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own gif comments" ON public.gif_comments;
CREATE POLICY "Users update own gif comments" ON public.gif_comments FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own gif comments" ON public.gif_comments;
CREATE POLICY "Users delete own gif comments" ON public.gif_comments FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Shares insertable" ON public.gif_shares;
CREATE POLICY "Shares insertable" ON public.gif_shares FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Post comments readable" ON public.fwd_post_comments;
CREATE POLICY "Post comments readable" ON public.fwd_post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users create own post comments" ON public.fwd_post_comments;
CREATE POLICY "Users create own post comments" ON public.fwd_post_comments FOR INSERT WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_gif_comments_updated_at ON public.gif_comments;
CREATE TRIGGER update_gif_comments_updated_at
  BEFORE UPDATE ON public.gif_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_fwd_post_comments_updated_at ON public.fwd_post_comments;
CREATE TRIGGER update_fwd_post_comments_updated_at
  BEFORE UPDATE ON public.fwd_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep counters persistent. Frontend also updates optimistically.
CREATE OR REPLACE FUNCTION public.fwd_sync_post_like_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.fwd_feed_posts
  SET like_count = GREATEST(0, like_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END)
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fwd_post_likes_count_insert ON public.fwd_post_likes;
CREATE TRIGGER fwd_post_likes_count_insert AFTER INSERT ON public.fwd_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fwd_sync_post_like_count();
DROP TRIGGER IF EXISTS fwd_post_likes_count_delete ON public.fwd_post_likes;
CREATE TRIGGER fwd_post_likes_count_delete AFTER DELETE ON public.fwd_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fwd_sync_post_like_count();

CREATE OR REPLACE FUNCTION public.fwd_sync_gif_like_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.fwd_gifs
  SET like_count = GREATEST(0, COALESCE(like_count, 0) + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END)
  WHERE id = COALESCE(NEW.gif_id, OLD.gif_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gif_likes_count_insert ON public.gif_likes;
CREATE TRIGGER gif_likes_count_insert AFTER INSERT ON public.gif_likes
  FOR EACH ROW EXECUTE FUNCTION public.fwd_sync_gif_like_count();
DROP TRIGGER IF EXISTS gif_likes_count_delete ON public.gif_likes;
CREATE TRIGGER gif_likes_count_delete AFTER DELETE ON public.gif_likes
  FOR EACH ROW EXECUTE FUNCTION public.fwd_sync_gif_like_count();

-- Reuse library table from the earlier pass; add grants for newer Data API defaults.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT SELECT ON public.user_gifs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fwd_gifs TO authenticated;
GRANT SELECT ON public.fwd_gifs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_gifs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fwd_feed_posts TO authenticated;
GRANT SELECT ON public.fwd_feed_posts TO anon;
GRANT SELECT, INSERT, DELETE ON public.fwd_post_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.fwd_post_saves TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.gif_likes TO authenticated;
GRANT SELECT ON public.gif_likes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gif_comments TO authenticated;
GRANT SELECT ON public.gif_comments TO anon;
GRANT INSERT ON public.gif_shares TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fwd_post_comments TO authenticated;
GRANT SELECT ON public.fwd_post_comments TO anon;
