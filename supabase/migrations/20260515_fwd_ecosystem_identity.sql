-- =====================================================
-- FWD Ecosystem Identity Layer
-- Expands profile & connected-account tables so FWD
-- can store a verified Trey TV public identity without
-- touching Trey TV's private database.
--
-- SEPARATION RULE:
--   FWD never stores Trey TV private internal IDs as
--   the public user identity. Only the public 16-digit
--   UID, display name, avatar, and profile URL are stored.
-- =====================================================

-- -------------------------------------------------------
-- 1. Expand fwd_profiles with full Trey TV identity fields
-- -------------------------------------------------------

-- Public Trey TV UID (the 16-digit public identifier)
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS trey_tv_uid            text UNIQUE;

-- Human-readable Trey TV display name (mirrored for display only)
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS trey_tv_display_name   text;

-- Public Trey TV avatar URL
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS trey_tv_avatar_url     text;

-- Public Trey TV profile URL (e.g. https://tv.treytrizzy.com/@username)
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS trey_tv_profile_url    text;

-- Which identity provider was used to create/link this profile
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS identity_provider       text DEFAULT 'fwd';
-- values: 'fwd' | 'trey_tv' | 'google' | 'github'

-- When the Trey TV identity was last verified by FWD backend
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS identity_verified_at   timestamptz;

-- Sync status between FWD profile and Trey TV identity
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS identity_sync_status   text DEFAULT 'none';
-- values: 'none' | 'pending' | 'synced' | 'error'

-- Rename connected_trey_tv_uid to trey_tv_uid if both exist (no-op if already clean)
-- We keep connected_trey_tv_uid for backward compat and add a copy trigger below.
-- (trey_tv_uid is the canonical column going forward)

CREATE INDEX IF NOT EXISTS fwd_profiles_trey_tv_uid_idx
    ON public.fwd_profiles (trey_tv_uid);

-- -------------------------------------------------------
-- 2. Expand fwd_connected_accounts with sync metadata
-- -------------------------------------------------------

-- The public Trey TV UID returned in the OAuth userinfo response
ALTER TABLE public.fwd_connected_accounts
    ADD COLUMN IF NOT EXISTS public_uid             text;

-- The public profile URL on Trey TV
ALTER TABLE public.fwd_connected_accounts
    ADD COLUMN IF NOT EXISTS profile_url            text;

-- When FWD last synced this identity from Trey TV
ALTER TABLE public.fwd_connected_accounts
    ADD COLUMN IF NOT EXISTS last_synced_at         timestamptz;

-- Sync status
ALTER TABLE public.fwd_connected_accounts
    ADD COLUMN IF NOT EXISTS sync_status            text DEFAULT 'synced';

-- -------------------------------------------------------
-- 3. fwd_picker_key_audit
--    Append-only log of picker-key usage events.
--    Lets FWD track where the picker is being embedded
--    without storing private Trey TV data.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fwd_picker_key_audit (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id          uuid        REFERENCES public.picker_api_keys(id) ON DELETE SET NULL,
    public_key      text        NOT NULL,
    origin          text        NOT NULL,   -- requesting origin (domain only)
    allowed         boolean     NOT NULL,   -- was the request allowed?
    source_platform text,                   -- 'trey_tv' | 'embed' | etc.
    context         text,                   -- 'message' | 'comment' | etc.
    trey_tv_uid     text,                   -- public UID only — never internal ID
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fwd_picker_key_audit_key_id_idx
    ON public.fwd_picker_key_audit (key_id);
CREATE INDEX IF NOT EXISTS fwd_picker_key_audit_origin_idx
    ON public.fwd_picker_key_audit (origin);
CREATE INDEX IF NOT EXISTS fwd_picker_key_audit_created_at_idx
    ON public.fwd_picker_key_audit (created_at DESC);

ALTER TABLE public.fwd_picker_key_audit ENABLE ROW LEVEL SECURITY;

-- Key owners can read audit logs for their own key
DROP POLICY IF EXISTS "Picker audit: owner select" ON public.fwd_picker_key_audit;
CREATE POLICY "Picker audit: owner select"
    ON public.fwd_picker_key_audit FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.picker_api_keys k
            WHERE k.id = fwd_picker_key_audit.key_id
              AND k.user_id = auth.uid()
        )
    );

-- Inserts only via service role (Edge Functions)
-- No authenticated insert policy needed.

-- -------------------------------------------------------
-- 4. fwd_gif_use_log
--    Safe GIF usage events ingested from Trey TV or any
--    external platform via the fwd-track-gif-use Edge Fn.
--    Never stores private Trey TV data.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fwd_gif_use_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    gif_id          text        NOT NULL,
    source_platform text        NOT NULL DEFAULT 'trey_tv',
    context         text,       -- 'message' | 'comment' | 'group_chat' | 'watch_party' | 'creator_channel' | 'feed_post'
    trey_tv_uid     text,       -- public Trey TV UID only (never internal id)
    fwd_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    origin          text,       -- origin domain of the embed that sent the event
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fwd_gif_use_log_gif_id_idx       ON public.fwd_gif_use_log (gif_id);
CREATE INDEX IF NOT EXISTS fwd_gif_use_log_platform_idx     ON public.fwd_gif_use_log (source_platform);
CREATE INDEX IF NOT EXISTS fwd_gif_use_log_uid_idx          ON public.fwd_gif_use_log (trey_tv_uid);
CREATE INDEX IF NOT EXISTS fwd_gif_use_log_created_at_idx   ON public.fwd_gif_use_log (created_at DESC);

ALTER TABLE public.fwd_gif_use_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage log entries
DROP POLICY IF EXISTS "Gif use log: select own" ON public.fwd_gif_use_log;
CREATE POLICY "Gif use log: select own"
    ON public.fwd_gif_use_log FOR SELECT
    USING (fwd_user_id = auth.uid());

-- Inserts only via service role (Edge Functions with verified picker key)

-- =====================================================
-- Migration Complete: fwd_ecosystem_identity
-- =====================================================
