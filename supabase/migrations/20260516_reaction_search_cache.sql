CREATE TABLE IF NOT EXISTS public.reaction_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  normalized_query text NOT NULL,
  source text NOT NULL,
  source_id text,
  title text,
  tags text[] DEFAULT '{}',
  preview_url text NOT NULL,
  gif_url text NOT NULL,
  width int,
  height int,
  share_url text,
  attribution_label text,
  attribution_url text,
  content_rating text,
  usage_count int DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reaction_search_cache_source_source_id_idx
  ON public.reaction_search_cache (source, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reaction_search_cache_normalized_query_idx
  ON public.reaction_search_cache (normalized_query);

CREATE INDEX IF NOT EXISTS reaction_search_cache_source_idx
  ON public.reaction_search_cache (source);

CREATE INDEX IF NOT EXISTS reaction_search_cache_usage_count_idx
  ON public.reaction_search_cache (usage_count);

CREATE INDEX IF NOT EXISTS reaction_search_cache_last_used_at_idx
  ON public.reaction_search_cache (last_used_at);

ALTER TABLE public.reaction_search_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reaction cache is publicly readable" ON public.reaction_search_cache;
CREATE POLICY "Reaction cache is publicly readable"
  ON public.reaction_search_cache FOR SELECT
  USING (true);
