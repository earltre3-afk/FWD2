-- FWD Library Vault: packs, GIF reactions, GIF-attached comments, and profile vault columns.

-- 1. Library Packs
CREATE TABLE IF NOT EXISTS public.fwd_library_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fwd_library_packs_user_idx ON public.fwd_library_packs (user_id);
ALTER TABLE public.fwd_library_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own packs" ON public.fwd_library_packs;
CREATE POLICY "Users manage own packs"
  ON public.fwd_library_packs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Library Pack Items
CREATE TABLE IF NOT EXISTS public.fwd_library_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.fwd_library_packs(id) ON DELETE CASCADE,
  gif_id uuid NOT NULL REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (pack_id, gif_id)
);

CREATE INDEX IF NOT EXISTS fwd_library_pack_items_pack_idx ON public.fwd_library_pack_items (pack_id);
ALTER TABLE public.fwd_library_pack_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pack items managed by pack owner" ON public.fwd_library_pack_items;
CREATE POLICY "Pack items managed by pack owner"
  ON public.fwd_library_pack_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.fwd_library_packs p
    WHERE p.id = pack_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fwd_library_packs p
    WHERE p.id = pack_id AND p.user_id = auth.uid()
  ));

-- 3. GIF reactions (separate from emoji likes)
CREATE TABLE IF NOT EXISTS public.gif_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gif_id uuid NOT NULL REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE SET NULL,
  reaction_gif_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (gif_id, user_id)
);

CREATE INDEX IF NOT EXISTS gif_reactions_gif_idx ON public.gif_reactions (gif_id);
ALTER TABLE public.gif_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GIF reactions readable" ON public.gif_reactions;
CREATE POLICY "GIF reactions readable" ON public.gif_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own gif reactions" ON public.gif_reactions;
CREATE POLICY "Users manage own gif reactions"
  ON public.gif_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Extend gif_comments to allow GIF attachments (Reply with FWD).
-- body can be null when a reply GIF is attached instead.
ALTER TABLE public.gif_comments ADD COLUMN IF NOT EXISTS reply_gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE SET NULL;
ALTER TABLE public.gif_comments ADD COLUMN IF NOT EXISTS reply_gif_url text;

-- Make body nullable, then replace the check constraint so either body or a GIF is required.
ALTER TABLE public.gif_comments ALTER COLUMN body DROP NOT NULL;

DO $$
DECLARE _constraint_name text;
BEGIN
  SELECT c.conname INTO _constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'gif_comments'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%char_length%';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.gif_comments DROP CONSTRAINT ' || quote_ident(_constraint_name);
  END IF;
END $$;

ALTER TABLE public.gif_comments DROP CONSTRAINT IF EXISTS gif_comments_content_check;
ALTER TABLE public.gif_comments ADD CONSTRAINT gif_comments_content_check
  CHECK (
    (body IS NOT NULL AND char_length(trim(body)) BETWEEN 1 AND 500)
    OR (reply_gif_url IS NOT NULL)
  );

-- 5. Profile vault columns: pinned GIF, mood GIF
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pinned_gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mood_gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE SET NULL;

-- 6. Profile showcase (ordered list of up to 6 featured GIFs)
CREATE TABLE IF NOT EXISTS public.fwd_profile_showcase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_id uuid NOT NULL REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, gif_id)
);

CREATE INDEX IF NOT EXISTS fwd_profile_showcase_user_idx ON public.fwd_profile_showcase (user_id);
ALTER TABLE public.fwd_profile_showcase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Showcase readable" ON public.fwd_profile_showcase;
CREATE POLICY "Showcase readable" ON public.fwd_profile_showcase FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own showcase" ON public.fwd_profile_showcase;
CREATE POLICY "Users manage own showcase"
  ON public.fwd_profile_showcase FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS fwd_library_packs_updated_at ON public.fwd_library_packs;
CREATE TRIGGER fwd_library_packs_updated_at
  BEFORE UPDATE ON public.fwd_library_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS gif_reactions_updated_at ON public.gif_reactions;
CREATE TRIGGER gif_reactions_updated_at
  BEFORE UPDATE ON public.gif_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fwd_library_packs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fwd_library_pack_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gif_reactions TO authenticated;
GRANT SELECT ON public.gif_reactions TO anon;
GRANT SELECT ON public.fwd_profile_showcase TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fwd_profile_showcase TO authenticated;
