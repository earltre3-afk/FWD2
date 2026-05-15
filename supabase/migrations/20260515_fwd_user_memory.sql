-- =====================================================
-- FWD User Memory Reserve
-- Per-user persistent GIF memory that follows them
-- across every platform that integrates FWD
-- (fwd.treytv.com, tv.treytrizzy.com, treytv.com, etc.)
-- =====================================================

-- -------------------------------------------------------
-- 1. fwd_user_memory
--    One row per user — auto-provisioned on sign-up.
--    Stores the user's cross-platform GIF state.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fwd_user_memory (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Recents: last N GIF ids used on ANY platform (ordered, latest first)
    recent_gif_ids  text[]          DEFAULT '{}',

    -- Saved: pinned GIF ids the user explicitly saved
    saved_gif_ids   text[]          DEFAULT '{}',

    -- Created: ids of GIFs the user uploaded/created
    created_gif_ids text[]          DEFAULT '{}',

    -- Cross-platform sync metadata
    -- Records which platforms have accessed this user's memory
    -- e.g. '{"fwd": "2026-05-15T07:00:00Z", "trey_tv": "2026-05-15T07:01:00Z"}'
    last_seen_by    jsonb           DEFAULT '{}'::jsonb,

    -- User preferences (theme overrides, gif display prefs, etc.)
    preferences     jsonb           DEFAULT '{}'::jsonb,

    -- Soft quota: how many recents to keep (default 50)
    recents_limit   int             DEFAULT 50,

    created_at      timestamptz     DEFAULT now(),
    updated_at      timestamptz     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fwd_user_memory_user_id_idx
    ON public.fwd_user_memory (user_id);

-- -------------------------------------------------------
-- 2. fwd_memory_events
--    Append-only event log: every time a user uses a GIF
--    on any platform, record it here.
--    Used to power recents and analytics.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fwd_memory_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gif_id          text        NOT NULL,      -- external or internal gif id
    event_type      text        NOT NULL,      -- 'used' | 'saved' | 'created' | 'removed'
    source_platform text        NOT NULL,      -- 'fwd' | 'trey_tv' | 'embed' | 'picker'
    source_context  text,                      -- optional: message thread id, post id, etc.
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fwd_memory_events_user_id_idx
    ON public.fwd_memory_events (user_id);
CREATE INDEX IF NOT EXISTS fwd_memory_events_gif_id_idx
    ON public.fwd_memory_events (gif_id);
CREATE INDEX IF NOT EXISTS fwd_memory_events_platform_idx
    ON public.fwd_memory_events (source_platform);
CREATE INDEX IF NOT EXISTS fwd_memory_events_created_at_idx
    ON public.fwd_memory_events (created_at DESC);

-- -------------------------------------------------------
-- 3. Auto-provision memory reserve on user sign-up
--    Fires whenever a new row is inserted into auth.users.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fwd_provision_user_memory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.fwd_user_memory (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fwd_on_auth_user_created
    ON auth.users;
CREATE TRIGGER fwd_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.fwd_provision_user_memory();

-- -------------------------------------------------------
-- 4. Function: record a GIF use and update recents
--    Called by Edge Functions or RPC from the frontend.
--    Parameters:
--      p_user_id        uuid
--      p_gif_id         text
--      p_event_type     text   ('used' | 'saved' | 'created' | 'removed')
--      p_platform       text   ('fwd' | 'trey_tv' | 'embed' | 'picker')
--      p_context        text   (optional)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fwd_record_gif_use(
    p_user_id    uuid,
    p_gif_id     text,
    p_event_type text DEFAULT 'used',
    p_platform   text DEFAULT 'fwd',
    p_context    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_memory      public.fwd_user_memory%ROWTYPE;
    v_recents     text[];
    v_saved       text[];
    v_created     text[];
    v_limit       int;
BEGIN
    -- Ensure memory row exists
    INSERT INTO public.fwd_user_memory (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_memory
    FROM public.fwd_user_memory
    WHERE user_id = p_user_id;

    v_recents := COALESCE(v_memory.recent_gif_ids, '{}');
    v_saved   := COALESCE(v_memory.saved_gif_ids,  '{}');
    v_created := COALESCE(v_memory.created_gif_ids,'{}');
    v_limit   := COALESCE(v_memory.recents_limit,  50);

    -- Log the event
    INSERT INTO public.fwd_memory_events (user_id, gif_id, event_type, source_platform, source_context)
    VALUES (p_user_id, p_gif_id, p_event_type, p_platform, p_context);

    -- Update recents (most-recent first, deduplicated, capped at limit)
    IF p_event_type = 'used' THEN
        v_recents := array_prepend(p_gif_id, array_remove(v_recents, p_gif_id));
        IF array_length(v_recents, 1) > v_limit THEN
            v_recents := v_recents[1:v_limit];
        END IF;
    END IF;

    -- Update saved list
    IF p_event_type = 'saved' THEN
        v_saved := array_prepend(p_gif_id, array_remove(v_saved, p_gif_id));
    ELSIF p_event_type = 'removed' THEN
        v_saved   := array_remove(v_saved,   p_gif_id);
        v_recents := array_remove(v_recents, p_gif_id);
    END IF;

    -- Update created list
    IF p_event_type = 'created' THEN
        v_created := array_prepend(p_gif_id, array_remove(v_created, p_gif_id));
    END IF;

    -- Persist updates + mark last seen by platform
    UPDATE public.fwd_user_memory
    SET
        recent_gif_ids = v_recents,
        saved_gif_ids  = v_saved,
        created_gif_ids= v_created,
        last_seen_by   = last_seen_by || jsonb_build_object(p_platform, now()::text),
        updated_at     = now()
    WHERE user_id = p_user_id;
END;
$$;

-- -------------------------------------------------------
-- 5. updated_at trigger on fwd_user_memory
-- -------------------------------------------------------
DROP TRIGGER IF EXISTS update_fwd_user_memory_updated_at
    ON public.fwd_user_memory;
CREATE TRIGGER update_fwd_user_memory_updated_at
    BEFORE UPDATE ON public.fwd_user_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------
-- 6. Row Level Security
-- -------------------------------------------------------
ALTER TABLE public.fwd_user_memory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fwd_memory_events ENABLE ROW LEVEL SECURITY;

-- Users read/write their own memory
DROP POLICY IF EXISTS "Memory: select own" ON public.fwd_user_memory;
CREATE POLICY "Memory: select own"
    ON public.fwd_user_memory FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Memory: update own" ON public.fwd_user_memory;
CREATE POLICY "Memory: update own"
    ON public.fwd_user_memory FOR UPDATE
    USING (user_id = auth.uid());

-- Insert handled by trigger + service role only
-- (no authenticated insert policy — provisioned automatically)

-- Users read their own events
DROP POLICY IF EXISTS "Memory events: select own" ON public.fwd_memory_events;
CREATE POLICY "Memory events: select own"
    ON public.fwd_memory_events FOR SELECT
    USING (user_id = auth.uid());

-- Service role inserts events via fwd_record_gif_use (SECURITY DEFINER)
-- No additional insert policy needed for anon/authenticated roles.

-- =====================================================
-- Migration Complete: fwd_user_memory
-- =====================================================
