-- Add source_id to fwd_gifs for deduplication of externally-fetched GIFs.
-- Format: "giphy:{gif_id}" or "tenor:{gif_id}"
ALTER TABLE public.fwd_gifs
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS fwd_gifs_source_id_unique_idx
  ON public.fwd_gifs (source_id)
  WHERE source_id IS NOT NULL;
