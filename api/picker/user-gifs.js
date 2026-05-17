// GET /api/picker/user-gifs?key=<embed_key>&trey_tv_uid=<uid>
//
// Returns the FWD user's created GIFs and favorited GIFs for the Mine tab in
// the embed picker. Requires a valid, active picker API key. If the TreyTV
// user hasn't linked their FWD account, returns an empty list (not an error).

const MAX_GIFS = 50;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function isSafeId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}

async function supabaseGet(supabaseUrl, serviceKey, path) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { key, trey_tv_uid: treyTvUid } = req.query;

  if (!isSafeId(key) || !isSafeId(treyTvUid)) {
    return json(res, 400, { error: 'Missing required params' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return json(res, 200, { gifs: [] });
  }

  try {
    // 1. Validate picker API key
    const keyRows = await supabaseGet(
      supabaseUrl,
      serviceKey,
      `picker_api_keys?public_key=eq.${encodeURIComponent(key)}&is_active=eq.true&select=id&limit=1`,
    );
    if (!keyRows || keyRows.length === 0) {
      return json(res, 403, { error: 'Invalid embed key' });
    }

    // 2. Resolve FWD user from TreyTV UID (may be unlinked — return empty not error)
    const links = await supabaseGet(
      supabaseUrl,
      serviceKey,
      `fwd_identity_links?trey_tv_uid=eq.${encodeURIComponent(treyTvUid)}&provider=eq.trey_tv&select=fwd_user_id&limit=1`,
    );
    if (!links || links.length === 0) {
      return json(res, 200, { gifs: [], linked: false });
    }

    const fwdUserId = links[0].fwd_user_id;

    // 3. Fetch created GIFs + favorite GIFs in parallel
    const [createdRows, favRows] = await Promise.all([
      supabaseGet(
        supabaseUrl,
        serviceKey,
        `fwd_gifs?user_id=eq.${encodeURIComponent(fwdUserId)}&select=id,title,gif_url,still_url,tags,category,mood&order=created_at.desc&limit=${MAX_GIFS}`,
      ),
      supabaseGet(
        supabaseUrl,
        serviceKey,
        `fwd_favorites?user_id=eq.${encodeURIComponent(fwdUserId)}&select=gif_id&order=created_at.desc&limit=${MAX_GIFS}`,
      ),
    ]);

    const created = Array.isArray(createdRows) ? createdRows : [];

    // Fetch favorited GIF details if there are any favorites
    let favorited = [];
    if (Array.isArray(favRows) && favRows.length > 0) {
      const favIds = favRows.map(r => r.gif_id).filter(Boolean);
      if (favIds.length > 0) {
        const inClause = favIds.map(id => encodeURIComponent(id)).join(',');
        const favGifs = await supabaseGet(
          supabaseUrl,
          serviceKey,
          `fwd_gifs?id=in.(${inClause})&select=id,title,gif_url,still_url,tags,category,mood&limit=${MAX_GIFS}`,
        );
        favorited = Array.isArray(favGifs) ? favGifs : [];
      }
    }

    // 4. Merge, dedupe by id, format as ReactionAsset
    const seen = new Set();
    const gifs = [...created, ...favorited]
      .filter(g => {
        if (!g?.id || !g?.gif_url) return false;
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      })
      .map(g => ({
        id: `fwd:user:${g.id}`,
        source: 'fwd_user',
        sourceId: g.id,
        query: '',
        title: g.title || 'My GIF',
        tags: Array.isArray(g.tags) ? g.tags : [],
        previewUrl: g.still_url || g.gif_url,
        gifUrl: g.gif_url,
      }));

    return json(res, 200, { gifs, linked: true });
  } catch {
    return json(res, 200, { gifs: [] });
  }
}
