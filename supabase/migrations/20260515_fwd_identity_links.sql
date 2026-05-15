-- =====================================================
-- fwd_identity_links
-- Maps FWD user accounts to external identity providers.
-- Currently supports: trey_tv (via Supabase OIDC/OAuth).
--
-- DESIGN:
--   - One FWD user can have multiple linked identities.
--   - provider + provider_user_id must be globally unique
--     (one external account can only link to one FWD account).
--   - Only public identity data is stored here.
--     Never: service role keys, raw tokens, private IDs used
--     as public identity, or admin roles.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fwd_identity_links (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    fwd_user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider            text        NOT NULL DEFAULT 'trey_tv',
    provider_user_id    text        NOT NULL,   -- provider's internal user id (lookup key only)
    trey_tv_uid         text,                   -- public 16-digit UID (the shared ecosystem identity)
    email               text,                   -- only stored if user authorized sharing
    display_name        text,
    avatar_url          text,
    profile_url         text,
    identity_verified_at timestamptz,           -- when FWD backend last verified this identity
    sync_status         text        DEFAULT 'synced',
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),

    -- One external account maps to exactly one FWD account
    CONSTRAINT fwd_identity_links_provider_uid_unique
        UNIQUE (provider, provider_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS fwd_identity_links_fwd_user_id_idx
    ON public.fwd_identity_links (fwd_user_id);

CREATE INDEX IF NOT EXISTS fwd_identity_links_provider_idx
    ON public.fwd_identity_links (provider);

CREATE INDEX IF NOT EXISTS fwd_identity_links_trey_tv_uid_idx
    ON public.fwd_identity_links (trey_tv_uid)
    WHERE trey_tv_uid IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS update_fwd_identity_links_updated_at
    ON public.fwd_identity_links;
CREATE TRIGGER update_fwd_identity_links_updated_at
    BEFORE UPDATE ON public.fwd_identity_links
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.fwd_identity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Identity links: select own" ON public.fwd_identity_links;
CREATE POLICY "Identity links: select own"
    ON public.fwd_identity_links FOR SELECT
    USING (fwd_user_id = auth.uid());

DROP POLICY IF EXISTS "Identity links: delete own" ON public.fwd_identity_links;
CREATE POLICY "Identity links: delete own"
    ON public.fwd_identity_links FOR DELETE
    USING (fwd_user_id = auth.uid());

-- Inserts/updates handled by service role (Edge Function) only.
-- No authenticated insert/update policy — prevents frontend from
-- inserting unverified identity claims.

-- =====================================================
-- Migration Complete: fwd_identity_links
-- =====================================================
