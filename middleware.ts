export const config = { matcher: ['/f/:path*'] };

const BOT_UA_RE =
  /Discordbot|Twitterbot|facebookexternalhit|WhatsApp|Slackbot|LinkedInBot|Pinterest|Applebot|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|iframely|Embedly|SitePreview|vkShare|W3C_Validator|Screaming Frog|AhrefsBot|SemrushBot|rogerbot|dotbot|msnbot|crawler|spider/i;

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function buildOgHtml(opts: {
  title: string;
  description: string;
  imageUrl: string;
  shareUrl: string;
  siteName: string;
}): string {
  const { title, description, imageUrl, shareUrl, siteName } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${siteName}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="600" />
<meta property="og:image:height" content="400" />
<meta property="og:url" content="${shareUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${imageUrl}" />
<link rel="canonical" href="${shareUrl}" />
<meta http-equiv="refresh" content="0;url=${shareUrl}" />
<script>window.location.replace(${JSON.stringify(shareUrl)});</script>
</head>
<body>
<p>Redirecting… <a href="${shareUrl}">Open this FWD</a></p>
</body>
  </html>`;
}

interface FeedPostPreviewRow {
  id: string;
  caption?: string | null;
  visibility?: string | null;
  gif_id?: string | null;
}

interface GifPreviewRow {
  id: string;
  caption?: string | null;
  title?: string | null;
  gif_url?: string | null;
  still_url?: string | null;
  visibility?: string | null;
}

async function fetchSupabaseRows<T>(url: string, key: string): Promise<T[]> {
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return [];
  return res.json() as Promise<T[]>;
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_UA_RE.test(ua)) return undefined;

  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const postId = segments[1]; // /f/<postId>

  if (!postId) return undefined;

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const appUrl = (process.env.VITE_FWD_APP_URL || 'https://fwd.treytv.com').replace(/\/$/, '');

  if (!supabaseUrl || !supabaseKey) return undefined;

  const shareUrl = `${appUrl}/f/${postId}`;
  const fallbackImage = `${appUrl}/og-fallback.png`;

  try {
    const posts = await fetchSupabaseRows<FeedPostPreviewRow>(
      `${supabaseUrl}/rest/v1/fwd_feed_posts` +
        `?id=eq.${encodeURIComponent(postId)}&select=id,caption,visibility,gif_id&limit=1`,
      supabaseKey
    );

    const feedPost = posts[0];

    if (!feedPost || feedPost.visibility !== 'public' || !feedPost.gif_id) {
      const html = buildOgHtml({
        title: 'This FWD is private',
        description: 'This FWD may be private or no longer available.',
        imageUrl: fallbackImage,
        shareUrl,
        siteName: 'FWD',
      });
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const gifs = await fetchSupabaseRows<GifPreviewRow>(
      `${supabaseUrl}/rest/v1/fwd_gifs` +
        `?id=eq.${encodeURIComponent(feedPost.gif_id)}&select=id,caption,title,gif_url,still_url,visibility&limit=1`,
      supabaseKey
    );

    const gif = gifs[0];

    if (!gif || gif.visibility === 'private') {
      const html = buildOgHtml({
        title: 'This FWD is private',
        description: 'This FWD may be private or no longer available.',
        imageUrl: fallbackImage,
        shareUrl,
        siteName: 'FWD',
      });
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const rawCaption = feedPost.caption || gif.caption || gif.title || 'Check out this FWD';
    const description = escHtml(rawCaption.slice(0, 150));
    const title = escHtml(rawCaption.slice(0, 70));
    const imageUrl = gif.still_url || gif.gif_url || fallbackImage;

    const html = buildOgHtml({
      title,
      description,
      imageUrl,
      shareUrl,
      siteName: 'FWD',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return undefined;
  }
}
