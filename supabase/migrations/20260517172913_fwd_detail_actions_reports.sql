-- FWD detail action fixes: emoji reactions and durable reports.

ALTER TABLE public.gif_reactions
  ADD COLUMN IF NOT EXISTS reaction_key text,
  ADD COLUMN IF NOT EXISTS reaction_label text,
  ADD COLUMN IF NOT EXISTS reaction_emoji text;

CREATE INDEX IF NOT EXISTS gif_reactions_reaction_key_idx
  ON public.gif_reactions (gif_id, reaction_key);

CREATE TABLE IF NOT EXISTS public.fwd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  gif_id uuid REFERENCES public.fwd_gifs(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.fwd_feed_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'copyright', 'other')),
  details text,
  created_at timestamptz DEFAULT now(),
  CHECK (gif_id IS NOT NULL OR post_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS fwd_reports_gif_idx ON public.fwd_reports (gif_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fwd_reports_post_idx ON public.fwd_reports (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fwd_reports_reporter_idx ON public.fwd_reports (reporter_user_id, created_at DESC);

ALTER TABLE public.fwd_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users create reports" ON public.fwd_reports;
CREATE POLICY "Users create reports"
  ON public.fwd_reports FOR INSERT
  WITH CHECK (reporter_user_id IS NULL OR reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own reports" ON public.fwd_reports;
CREATE POLICY "Users read own reports"
  ON public.fwd_reports FOR SELECT
  USING (reporter_user_id = auth.uid());

GRANT INSERT ON public.fwd_reports TO anon;
GRANT SELECT, INSERT ON public.fwd_reports TO authenticated;
