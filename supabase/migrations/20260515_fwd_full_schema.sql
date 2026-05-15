-- FWD Full Database Schema Migration
-- Apply this migration to set up all FWD tables, indexes, RLS policies, and storage
-- Safe to run on fresh or existing databases (uses IF NOT EXISTS)

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- fwd_profiles: User profiles linked to Supabase Auth
CREATE TABLE IF NOT EXISTS public.fwd_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    username text UNIQUE NOT NULL,
    avatar_url text,
    bio text,
    reaction_style text,
    connected_trey_tv_uid text,
    is_public boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS fwd_profiles_user_id_idx ON public.fwd_profiles(user_id);
CREATE INDEX IF NOT EXISTS fwd_profiles_username_idx ON public.fwd_profiles(username);
CREATE INDEX IF NOT EXISTS fwd_profiles_trey_tv_uid_idx ON public.fwd_profiles(connected_trey_tv_uid);

-- =====================================================
-- 2. GIFS TABLE
-- =====================================================

-- fwd_gifs: Stores uploaded GIF metadata
CREATE TABLE IF NOT EXISTS public.fwd_gifs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    title text,
    media_url text NOT NULL,
    preview_url text,
    thumbnail_url text,
    tags text[] DEFAULT '{}',
    category text,
    visibility text DEFAULT 'public',
    status text DEFAULT 'approved',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for GIFs
CREATE INDEX IF NOT EXISTS fwd_gifs_owner_user_id_idx ON public.fwd_gifs(owner_user_id);
CREATE INDEX IF NOT EXISTS fwd_gifs_category_idx ON public.fwd_gifs(category);
CREATE INDEX IF NOT EXISTS fwd_gifs_visibility_idx ON public.fwd_gifs(visibility);
CREATE INDEX IF NOT EXISTS fwd_gifs_status_idx ON public.fwd_gifs(status);
CREATE INDEX IF NOT EXISTS fwd_gifs_tags_gin_idx ON public.fwd_gifs USING gin(tags);

-- =====================================================
-- 3. FAVORITES TABLE
-- =====================================================

-- fwd_favorites: User's favorited GIFs
CREATE TABLE IF NOT EXISTS public.fwd_favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gif_id uuid NOT NULL REFERENCES fwd_gifs(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, gif_id)
);

-- Indexes for favorites
CREATE INDEX IF NOT EXISTS fwd_favorites_user_id_idx ON public.fwd_favorites(user_id);
CREATE INDEX IF NOT EXISTS fwd_favorites_gif_id_idx ON public.fwd_favorites(gif_id);

-- =====================================================
-- 4. COLLECTIONS TABLES
-- =====================================================

-- fwd_collections: User-created GIF collections
CREATE TABLE IF NOT EXISTS public.fwd_collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    visibility text DEFAULT 'private',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for collections
CREATE INDEX IF NOT EXISTS fwd_collections_user_id_idx ON public.fwd_collections(user_id);
CREATE INDEX IF NOT EXISTS fwd_collections_visibility_idx ON public.fwd_collections(visibility);

-- fwd_collection_items: GIFs within collections
CREATE TABLE IF NOT EXISTS public.fwd_collection_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id uuid NOT NULL REFERENCES fwd_collections(id) ON DELETE CASCADE,
    gif_id uuid NOT NULL REFERENCES fwd_gifs(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(collection_id, gif_id)
);

-- Indexes for collection items
CREATE INDEX IF NOT EXISTS fwd_collection_items_collection_id_idx ON public.fwd_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS fwd_collection_items_gif_id_idx ON public.fwd_collection_items(gif_id);

-- =====================================================
-- 5. PICKER API KEYS TABLE
-- =====================================================

-- picker_api_keys: API keys for external embed access
CREATE TABLE IF NOT EXISTS public.picker_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    app_name text NOT NULL,
    public_key text UNIQUE NOT NULL,
    allowed_origins text[] DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for picker API keys
CREATE INDEX IF NOT EXISTS picker_api_keys_public_key_idx ON public.picker_api_keys(public_key);
CREATE INDEX IF NOT EXISTS picker_api_keys_user_id_idx ON public.picker_api_keys(user_id);

-- =====================================================
-- 6. TREY TV USES TABLE
-- =====================================================

-- fwd_trey_tv_uses: Tracks GIF usage in Trey TV platform
CREATE TABLE IF NOT EXISTS public.fwd_trey_tv_uses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gif_id uuid REFERENCES fwd_gifs(id) ON DELETE SET NULL,
    fwd_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    trey_tv_uid text,
    source_platform text DEFAULT 'trey_tv',
    context text,
    destination_type text,
    destination_id text,
    created_at timestamptz DEFAULT now()
);

-- Indexes for Trey TV uses
CREATE INDEX IF NOT EXISTS fwd_trey_tv_uses_gif_id_idx ON public.fwd_trey_tv_uses(gif_id);
CREATE INDEX IF NOT EXISTS fwd_trey_tv_uses_fwd_user_id_idx ON public.fwd_trey_tv_uses(fwd_user_id);
CREATE INDEX IF NOT EXISTS fwd_trey_tv_uses_trey_tv_uid_idx ON public.fwd_trey_tv_uses(trey_tv_uid);

-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.fwd_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_gifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picker_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_trey_tv_uses ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

-- fwd_profiles policies
-- Users can read/update their own profile
-- Public profiles can be read by anyone
CREATE POLICY IF NOT EXISTS "Users can read own profile"
    ON public.fwd_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
    ON public.fwd_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile"
    ON public.fwd_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Public profiles are readable"
    ON public.fwd_profiles FOR SELECT
    USING (is_public = true);

-- fwd_gifs policies
-- Users can create/manage their own GIFs
-- Public approved GIFs can be read by anyone
CREATE POLICY IF NOT EXISTS "Users can read own GIFs"
    ON public.fwd_gifs FOR SELECT
    USING (auth.uid() = owner_user_id);

CREATE POLICY IF NOT EXISTS "Users can create GIFs"
    ON public.fwd_gifs FOR INSERT
    WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY IF NOT EXISTS "Users can update own GIFs"
    ON public.fwd_gifs FOR UPDATE
    USING (auth.uid() = owner_user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own GIFs"
    ON public.fwd_gifs FOR DELETE
    USING (auth.uid() = owner_user_id);

CREATE POLICY IF NOT EXISTS "Public approved GIFs are readable"
    ON public.fwd_gifs FOR SELECT
    USING (visibility = 'public' AND status = 'approved');

-- fwd_favorites policies
-- Users can favorite/unfavorite only for themselves
CREATE POLICY IF NOT EXISTS "Users can read own favorites"
    ON public.fwd_favorites FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can add favorites"
    ON public.fwd_favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can remove own favorites"
    ON public.fwd_favorites FOR DELETE
    USING (auth.uid() = user_id);

-- fwd_collections policies
-- Users can manage only their own collections
CREATE POLICY IF NOT EXISTS "Users can read own collections"
    ON public.fwd_collections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create collections"
    ON public.fwd_collections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own collections"
    ON public.fwd_collections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own collections"
    ON public.fwd_collections FOR DELETE
    USING (auth.uid() = user_id);

-- fwd_collection_items policies
-- Users can manage items in their own collections
CREATE POLICY IF NOT EXISTS "Users can read own collection items"
    ON public.fwd_collection_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.fwd_collections c
            WHERE c.id = fwd_collection_items.collection_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can add to own collections"
    ON public.fwd_collection_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fwd_collections c
            WHERE c.id = fwd_collection_items.collection_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "Users can remove from own collections"
    ON public.fwd_collection_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.fwd_collections c
            WHERE c.id = fwd_collection_items.collection_id
            AND c.user_id = auth.uid()
        )
    );

-- picker_api_keys policies
-- Only key owners can read their keys
-- Edge Function can read all keys (via service role)
CREATE POLICY IF NOT EXISTS "Users can read own API keys"
    ON public.picker_api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create own API keys"
    ON public.picker_api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own API keys"
    ON public.picker_api_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own API keys"
    ON public.picker_api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- fwd_trey_tv_uses policies
-- Safe insert without exposing private user data
-- Only service role or owner can read
CREATE POLICY IF NOT EXISTS "Users can read own Trey TV uses"
    ON public.fwd_trey_tv_uses FOR SELECT
    USING (auth.uid() = fwd_user_id);

CREATE POLICY IF NOT EXISTS "Service can insert Trey TV uses"
    ON public.fwd_trey_tv_uses FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- 9. STORAGE SETUP
-- =====================================================

-- Create the storage bucket (if not exists)
-- Note: Run this in Supabase Dashboard > Storage or via supabase CLI
-- Bucket name: fwd-uploads
-- Public: true
-- Allowed MIME types: image/gif, image/png, image/jpeg, image/webp, video/webm, video/mp4, video/quicktime

-- Storage policies for fwd-uploads bucket
-- Users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload to own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'fwd-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY IF NOT EXISTS "Users can read own uploads"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'fwd-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY IF NOT EXISTS "Users can delete own uploads"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'fwd-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Public read access for public bucket
CREATE POLICY IF NOT EXISTS "Public can read uploads"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'fwd-uploads');

-- =====================================================
-- 10. UPDATED_AT TRIGGER
-- =====================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_fwd_profiles_updated_at ON public.fwd_profiles;
CREATE TRIGGER update_fwd_profiles_updated_at
    BEFORE UPDATE ON public.fwd_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fwd_gifs_updated_at ON public.fwd_gifs;
CREATE TRIGGER update_fwd_gifs_updated_at
    BEFORE UPDATE ON public.fwd_gifs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fwd_collections_updated_at ON public.fwd_collections;
CREATE TRIGGER update_fwd_collections_updated_at
    BEFORE UPDATE ON public.fwd_collections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_picker_api_keys_updated_at ON public.picker_api_keys;
CREATE TRIGGER update_picker_api_keys_updated_at
    BEFORE UPDATE ON public.picker_api_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Migration Complete
-- =====================================================
