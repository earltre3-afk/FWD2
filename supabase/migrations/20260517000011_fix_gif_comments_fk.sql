-- gif_comments.user_id had two FK constraints: one to auth.users AND one to profiles.
-- Any user without a profiles row (e.g. OAuth users whose profile trigger failed)
-- could not post comments. The profiles FK is redundant — RLS already enforces
-- user_id = auth.uid(). Drop it; the auth.users FK is sufficient.
ALTER TABLE public.gif_comments
  DROP CONSTRAINT IF EXISTS gif_comments_user_profiles_fk;
