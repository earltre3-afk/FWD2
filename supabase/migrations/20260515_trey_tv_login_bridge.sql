-- =====================================================
-- Trey TV login bridge: connected accounts + profile fields
-- Safe to run on fresh or existing databases (uses IF NOT EXISTS).
-- =====================================================

-- 1. fwd_connected_accounts: links FWD users to external identity providers
--    (currently used for Trey TV via "Continue with Trey TV" login).
CREATE TABLE IF NOT EXISTS public.fwd_connected_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fwd_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    provider_uid text,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT fwd_connected_accounts_provider_unique
        UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS fwd_connected_accounts_fwd_user_id_idx
    ON public.fwd_connected_accounts (fwd_user_id);

CREATE INDEX IF NOT EXISTS fwd_connected_accounts_provider_idx
    ON public.fwd_connected_accounts (provider);

-- Keep updated_at fresh on updates.
CREATE OR REPLACE FUNCTION public.fwd_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fwd_connected_accounts_set_updated_at
    ON public.fwd_connected_accounts;
CREATE TRIGGER fwd_connected_accounts_set_updated_at
    BEFORE UPDATE ON public.fwd_connected_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.fwd_set_updated_at();

-- 2. fwd_profiles: ensure Trey TV-related columns exist.
ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS connected_trey_tv_uid text;

ALTER TABLE public.fwd_profiles
    ADD COLUMN IF NOT EXISTS login_provider text;

-- 3. Row Level Security on fwd_connected_accounts.
ALTER TABLE public.fwd_connected_accounts ENABLE ROW LEVEL SECURITY;

-- Owners can read their own connected accounts.
DROP POLICY IF EXISTS "Connected accounts: select own"
    ON public.fwd_connected_accounts;
CREATE POLICY "Connected accounts: select own"
    ON public.fwd_connected_accounts
    FOR SELECT
    USING (fwd_user_id = auth.uid());

-- Owners can delete (unlink) their own connected accounts.
DROP POLICY IF EXISTS "Connected accounts: delete own"
    ON public.fwd_connected_accounts;
CREATE POLICY "Connected accounts: delete own"
    ON public.fwd_connected_accounts
    FOR DELETE
    USING (fwd_user_id = auth.uid());

-- Inserts/updates are performed by the trey-tv-login-exchange edge function
-- using the service role key, which bypasses RLS. We intentionally do NOT
-- expose insert/update policies to the anon/authenticated roles.
