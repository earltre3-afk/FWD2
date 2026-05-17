// Vercel Serverless Function — redirects bots/clients to the actual GIF image
// so OG:image tags resolve to a real image URL.
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const postId = url.pathname.split('/').pop() || '';

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const appUrl = (process.env.VITE_FWD_APP_URL || 'https://fwd.treytv.com').replace(/\/$/, '');

  if (!postId || !supabaseUrl || !supabaseKey) {
    return Response.redirect(`${appUrl}/og-fallback.png`, 302);
  }

  try {
    const postRes = await fetch(
      `${supabaseUrl}/rest/v1/fwd_feed_posts?id=eq.${encodeURIComponent(postId)}&select=gif_id,visibility&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (postRes.ok) {
      const posts: Array<{ gif_id?: string | null; visibility?: string | null }> = await postRes.json();
      const post = posts[0];

      if (post?.gif_id && post.visibility === 'public') {
        const gifRes = await fetch(
          `${supabaseUrl}/rest/v1/fwd_gifs?id=eq.${encodeURIComponent(post.gif_id)}&select=still_url,gif_url,visibility&limit=1`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Accept: 'application/json',
            },
          }
        );

        if (gifRes.ok) {
          const gifs: Array<{ still_url?: string | null; gif_url?: string | null; visibility?: string | null }> = await gifRes.json();
          const gif = gifs[0];
          const imageUrl = gif?.visibility !== 'private' ? gif?.still_url || gif?.gif_url : null;
          if (imageUrl) {
            return Response.redirect(imageUrl, 302);
          }
        }
      }
    }
  } catch {
    // fall through to fallback
  }

  return Response.redirect(`${appUrl}/og-fallback.png`, 302);
}
