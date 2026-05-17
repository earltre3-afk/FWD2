-- Comments are public and permanent — only the author can delete, nobody can edit.
-- Drop the UPDATE policy so comment bodies cannot be changed after posting.
DROP POLICY IF EXISTS "Users update own gif comments" ON public.gif_comments;
