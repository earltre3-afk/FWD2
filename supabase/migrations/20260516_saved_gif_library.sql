CREATE TABLE IF NOT EXISTS public.saved_gifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_id uuid NULL,
  source_url text NOT NULL,
  thumbnail_url text NULL,
  title text NULL,
  caption text NULL,
  tags text[] DEFAULT '{}',
  mood text NULL,
  source_type text DEFAULT 'saved',
  is_private boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS saved_gifs_user_gif_id_idx
  ON public.saved_gifs (user_id, gif_id)
  WHERE gif_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saved_gifs_user_source_url_idx
  ON public.saved_gifs (user_id, source_url);

CREATE INDEX IF NOT EXISTS saved_gifs_user_id_idx ON public.saved_gifs (user_id);
CREATE INDEX IF NOT EXISTS saved_gifs_source_type_idx ON public.saved_gifs (source_type);
CREATE INDEX IF NOT EXISTS saved_gifs_created_at_idx ON public.saved_gifs (created_at);
CREATE INDEX IF NOT EXISTS saved_gifs_tags_idx ON public.saved_gifs USING gin(tags);

ALTER TABLE public.saved_gifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can read own saved gifs"
  ON public.saved_gifs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can create own saved gifs"
  ON public.saved_gifs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can update own saved gifs"
  ON public.saved_gifs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved gifs" ON public.saved_gifs;
CREATE POLICY "Users can delete own saved gifs"
  ON public.saved_gifs FOR DELETE
  USING (auth.uid() = user_id);
