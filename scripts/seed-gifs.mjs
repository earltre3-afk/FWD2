/**
 * FWD GIF Seeder — pulls trending + category GIFs from Giphy and seeds them into fwd_gifs.
 *
 * Setup:
 *   1. Get a free Giphy API key at https://developers.giphy.com (instant, free tier = 1000 req/day)
 *   2. Add GIPHY_API_KEY=your_key to .env.seed (already has Supabase creds from `vercel env pull`)
 *   3. Run:  node --env-file=.env.seed scripts/seed-gifs.mjs
 */

import { createClient } from '@supabase/supabase-js';

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GIPHY_API_KEY) {
  console.error('\n❌  GIPHY_API_KEY is not set.');
  console.error('   1. Get a free key at https://developers.giphy.com');
  console.error('   2. Add  GIPHY_API_KEY=your_key  to .env.seed');
  console.error('   3. Re-run: node --env-file=.env.seed scripts/seed-gifs.mjs\n');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run: npx vercel env pull .env.seed');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Categories and search terms → maps to fwd_gifs.category
// Each entry can have an optional `offset` to get different results on re-runs
const SEED_QUERIES = [
  // ── Reactions ──────────────────────────────────────────────────
  { query: 'trending reaction',        category: 'Reactions',    count: 50, offset: 50 },
  { query: 'funny reaction',           category: 'Reactions',    count: 30, offset: 30 },
  { query: 'excited celebrate hype',   category: 'Reactions',    count: 25, offset: 25 },
  { query: 'side eye shade',           category: 'Reactions',    count: 25, offset: 25 },
  { query: 'laughing hysterically',    category: 'Reactions',    count: 25, offset: 25 },
  { query: 'shocked surprised',        category: 'Reactions',    count: 25, offset: 25 },
  { query: 'clapping applause',        category: 'Reactions',    count: 20 },
  { query: 'eye roll sassy',           category: 'Reactions',    count: 20 },
  { query: 'thumbs up approval',       category: 'Reactions',    count: 20 },
  { query: 'facepalm cringe',          category: 'Reactions',    count: 20 },
  { query: 'mind blown wow',           category: 'Reactions',    count: 20 },
  { query: 'nope bye leaving',         category: 'Reactions',    count: 20 },
  { query: 'crying tears sad',         category: 'Reactions',    count: 20 },
  { query: 'angry mad furious',        category: 'Reactions',    count: 20 },
  { query: 'happy dance joy',          category: 'Reactions',    count: 20 },
  { query: 'confused huh what',        category: 'Reactions',    count: 20 },
  { query: 'awkward uncomfortable',    category: 'Reactions',    count: 20 },
  { query: 'seriously really omg',     category: 'Reactions',    count: 20 },
  { query: 'love heart emoji',         category: 'Reactions',    count: 20 },
  { query: 'tea spilling drama',       category: 'Reactions',    count: 20 },

  // ── Black Culture ──────────────────────────────────────────────
  { query: 'black culture reaction',   category: 'Black Culture',count: 50, offset: 20 },
  { query: 'black girl magic',         category: 'Black Culture',count: 30, offset: 30 },
  { query: 'black joy celebration',    category: 'Black Culture',count: 25 },
  { query: 'slay queen werk',          category: 'Black Culture',count: 25 },
  { query: 'periodt facts no cap',     category: 'Black Culture',count: 25 },
  { query: 'real housewives reaction', category: 'Black Culture',count: 25 },
  { query: 'shade throwing iconic',    category: 'Black Culture',count: 20 },
  { query: 'black excellence proud',   category: 'Black Culture',count: 20 },
  { query: 'fresh prince bel air',     category: 'Black Culture',count: 20 },
  { query: 'martin lawrence funny',    category: 'Black Culture',count: 20 },
  { query: 'living single girlfriends',category: 'Black Culture',count: 20 },
  { query: 'insecure issa rae',        category: 'Black Culture',count: 20 },
  { query: 'atlanta tv show',          category: 'Black Culture',count: 20 },
  { query: 'power book tv',            category: 'Black Culture',count: 15 },
  { query: 'pose fx ballroom',         category: 'Black Culture',count: 15 },

  // ── Memes ──────────────────────────────────────────────────────
  { query: 'viral moment',             category: 'Memes',        count: 30, offset: 30 },
  { query: 'meme funny',               category: 'Memes',        count: 30, offset: 30 },
  { query: 'internet meme classic',    category: 'Memes',        count: 25 },
  { query: 'relatable mood same',      category: 'Memes',        count: 25 },
  { query: 'drake hotline bling',      category: 'Memes',        count: 20 },
  { query: 'distracted boyfriend',     category: 'Memes',        count: 15 },
  { query: 'this is fine dog',         category: 'Memes',        count: 15 },
  { query: 'success kid fist',         category: 'Memes',        count: 15 },
  { query: 'ugandan knuckles',         category: 'Memes',        count: 15 },
  { query: 'surprised pikachu face',   category: 'Memes',        count: 20 },
  { query: 'woman yelling cat',        category: 'Memes',        count: 20 },
  { query: 'bernie sanders mittens',   category: 'Memes',        count: 15 },
  { query: 'pointing spiderman',       category: 'Memes',        count: 20 },
  { query: 'two buttons decision',     category: 'Memes',        count: 15 },
  { query: 'nobody absolutely nobody', category: 'Memes',        count: 20 },

  // ── Music ──────────────────────────────────────────────────────
  { query: 'hip hop dance',            category: 'Music',        count: 25, offset: 25 },
  { query: 'music vibe',               category: 'Music',        count: 20, offset: 20 },
  { query: 'dancing party',            category: 'Music',        count: 20, offset: 20 },
  { query: 'concert crowd hype',       category: 'Music',        count: 20 },
  { query: 'rap freestyle bars',       category: 'Music',        count: 20 },
  { query: 'beyonce performance',      category: 'Music',        count: 20 },
  { query: 'drake music video',        category: 'Music',        count: 20 },
  { query: 'rihanna music',            category: 'Music',        count: 20 },
  { query: 'cardi b wap',              category: 'Music',        count: 15 },
  { query: 'lizzo juice',              category: 'Music',        count: 15 },
  { query: 'doja cat say so',          category: 'Music',        count: 15 },
  { query: 'bad bunny reggaeton',      category: 'Music',        count: 15 },
  { query: 'travis scott concert',     category: 'Music',        count: 15 },
  { query: 'dj spinning turntable',    category: 'Music',        count: 15 },
  { query: 'headphones music listen',  category: 'Music',        count: 15 },

  // ── Sports ─────────────────────────────────────────────────────
  { query: 'nba basketball',           category: 'Sports',       count: 20, offset: 20 },
  { query: 'sports celebration',       category: 'Sports',       count: 20, offset: 20 },
  { query: 'lebron james dunk',        category: 'Sports',       count: 20 },
  { query: 'stephen curry three',      category: 'Sports',       count: 20 },
  { query: 'nfl touchdown catch',      category: 'Sports',       count: 20 },
  { query: 'soccer goal celebration',  category: 'Sports',       count: 20 },
  { query: 'messi ronaldo goal',       category: 'Sports',       count: 20 },
  { query: 'boxing knockout punch',    category: 'Sports',       count: 15 },
  { query: 'tennis ace serve',         category: 'Sports',       count: 15 },
  { query: 'olympic gold medal',       category: 'Sports',       count: 15 },
  { query: 'simone biles gymnastics',  category: 'Sports',       count: 15 },
  { query: 'usain bolt running',       category: 'Sports',       count: 15 },
  { query: 'espn highlights',          category: 'Sports',       count: 15 },

  // ── TV & Movies ────────────────────────────────────────────────
  { query: 'tv show reaction',         category: 'TV & Movies',  count: 25, offset: 25 },
  { query: 'movie scene iconic',       category: 'TV & Movies',  count: 25, offset: 25 },
  { query: 'the office funny',         category: 'TV & Movies',  count: 20 },
  { query: 'parks recreation',         category: 'TV & Movies',  count: 20 },
  { query: 'brooklyn nine nine',       category: 'TV & Movies',  count: 20 },
  { query: 'friends tv classic',       category: 'TV & Movies',  count: 20 },
  { query: 'game of thrones',          category: 'TV & Movies',  count: 20 },
  { query: 'marvel avengers',          category: 'TV & Movies',  count: 20 },
  { query: 'star wars',                category: 'TV & Movies',  count: 20 },
  { query: 'harry potter magic',       category: 'TV & Movies',  count: 15 },
  { query: 'breaking bad walter',      category: 'TV & Movies',  count: 15 },
  { query: 'stranger things eleven',   category: 'TV & Movies',  count: 15 },
  { query: 'succession hbo',           category: 'TV & Movies',  count: 15 },
  { query: 'euphoria zendaya',         category: 'TV & Movies',  count: 15 },
  { query: 'squid game netflix',       category: 'TV & Movies',  count: 15 },
  { query: 'schitts creek funny',      category: 'TV & Movies',  count: 15 },
  { query: 'ted lasso believe',        category: 'TV & Movies',  count: 15 },

  // ── Gaming ─────────────────────────────────────────────────────
  { query: 'video game gaming',        category: 'Gaming',       count: 20, offset: 20 },
  { query: 'fortnite victory',         category: 'Gaming',       count: 20 },
  { query: 'minecraft build',          category: 'Gaming',       count: 15 },
  { query: 'gta grand theft auto',     category: 'Gaming',       count: 15 },
  { query: 'among us impostor',        category: 'Gaming',       count: 15 },
  { query: 'call of duty warzone',     category: 'Gaming',       count: 15 },
  { query: 'league of legends',        category: 'Gaming',       count: 15 },
  { query: 'pokemon pikachu',          category: 'Gaming',       count: 15 },
  { query: 'zelda link nintendo',      category: 'Gaming',       count: 15 },
  { query: 'gaming rage controller',   category: 'Gaming',       count: 15 },
  { query: 'esports pro player',       category: 'Gaming',       count: 15 },
  { query: 'twitch streamer',          category: 'Gaming',       count: 15 },

  // ── Clips / Aesthetic ──────────────────────────────────────────
  { query: 'aesthetic chill vibes',    category: 'Clips',        count: 20, offset: 20 },
  { query: 'city lights night drive',  category: 'Clips',        count: 20 },
  { query: 'sunset beach ocean',       category: 'Clips',        count: 20 },
  { query: 'rain window cozy',         category: 'Clips',        count: 15 },
  { query: 'neon lights tokyo',        category: 'Clips',        count: 15 },
  { query: 'lofi chill study',         category: 'Clips',        count: 15 },
  { query: 'space stars galaxy',       category: 'Clips',        count: 15 },
  { query: 'coffee morning cafe',      category: 'Clips',        count: 15 },
  { query: 'nature forest peaceful',   category: 'Clips',        count: 15 },
  { query: 'vaporwave retro 80s',      category: 'Clips',        count: 15 },

  // ── New / Trending ─────────────────────────────────────────────
  { query: 'new trending 2024',        category: 'New',          count: 25, offset: 25 },
  { query: 'viral tiktok trend',       category: 'New',          count: 25 },
  { query: 'gen z slang',              category: 'New',          count: 20 },
  { query: 'trending meme 2024',       category: 'New',          count: 20 },
  { query: 'social media moment',      category: 'New',          count: 20 },
  { query: 'its giving energy',        category: 'New',          count: 20 },
  { query: 'no cap lowkey',            category: 'New',          count: 20 },
  { query: 'bussin fr fr',             category: 'New',          count: 20 },
  { query: 'main character energy',    category: 'New',          count: 20 },
  { query: 'vibe check passed',        category: 'New',          count: 15 },
];

async function fetchGiphy(query, limit, offset = 0) {
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    q: query,
    limit: String(Math.min(limit, 50)),
    offset: String(offset),
    rating: 'pg-13',
    lang: 'en',
    bundle: 'messaging_non_clips',
  });
  const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
  if (!res.ok) throw new Error(`Giphy error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchTrending(limit = 50) {
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: String(limit),
    rating: 'pg-13',
    bundle: 'messaging_non_clips',
  });
  const res = await fetch(`https://api.giphy.com/v1/gifs/trending?${params}`);
  if (!res.ok) throw new Error(`Giphy trending error ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

function toRow(item, category, query) {
  const original = item.images?.original;
  const preview = item.images?.fixed_width_small || item.images?.preview_gif || item.images?.fixed_width;
  const still = item.images?.fixed_width_still || item.images?.original_still;
  if (!original?.url) return null;

  const tags = [
    ...(item.title || '').toLowerCase().split(/\s+/).filter(Boolean),
    ...query.toLowerCase().split(/\s+/).filter(Boolean),
    category.toLowerCase(),
  ];

  return {
    source_type: 'curated',
    owner_user_id: null,
    title: item.title || 'GIF',
    gif_url: original.url,          // primary animated URL
    media_url: original.url,         // fwd_gifs.media_url (NOT NULL)
    preview_url: preview?.url || null,
    still_url: still?.url || null,
    thumbnail_url: still?.url || preview?.url || null,
    width: Number(original.width) || null,
    height: Number(original.height) || null,
    tags: [...new Set(tags)],
    category,
    visibility: 'public',
    status: 'approved',
    source_id: `giphy:${item.id}`,
  };
}

async function seed() {
  console.log('\n🚀  FWD GIF Seeder starting...\n');

  // 1. Trending GIFs → Reactions category
  console.log('Fetching trending GIFs...');
  let allRows = [];
  const trending = await fetchTrending(50);
  trending.forEach(item => {
    const row = toRow(item, 'Reactions', 'trending reaction');
    if (row) allRows.push(row);
  });
  console.log(`  ✓ ${trending.length} trending GIFs`);

  // 2. Category queries
  for (const { query, category, count, offset } of SEED_QUERIES) {
    try {
      process.stdout.write(`  Fetching "${query}"...`);
      const items = await fetchGiphy(query, count, offset || 0);
      let added = 0;
      items.forEach(item => {
        const row = toRow(item, category, query);
        if (row) { allRows.push(row); added++; }
      });
      console.log(` ✓ ${added} GIFs`);
      await new Promise(r => setTimeout(r, 250)); // rate limiting courtesy delay
    } catch (err) {
      console.log(` ✗ Error: ${err.message}`);
    }
  }

  // 3. Dedupe by source_id
  const seen = new Set();
  const unique = allRows.filter(row => {
    if (!row.source_id || seen.has(row.source_id)) return false;
    seen.add(row.source_id);
    return true;
  });

  console.log(`\n📦  ${allRows.length} GIFs fetched, ${unique.length} unique after dedup`);

  // 4. Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from('fwd_gifs')
      .upsert(batch, { onConflict: 'source_id', count: 'exact' });
    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      inserted += count ?? batch.length;
    }
    process.stdout.write(`\r  Inserting... ${Math.min(i + BATCH, unique.length)}/${unique.length}`);
  }

  // 5. Verify final count
  const { count: total } = await supabase
    .from('fwd_gifs')
    .select('*', { count: 'exact', head: true })
    .is('owner_user_id', null);

  console.log(`\n\n✅  Done! ~${inserted} new GIFs added.`);
  console.log(`   Total system GIFs in fwd_gifs: ${total}`);
  console.log('\nNext: Add GIPHY_API_KEY to Vercel so live search also works:');
  console.log('  npx vercel env add GIPHY_API_KEY production\n');
}

seed().catch(err => { console.error('Fatal:', err); process.exit(1); });
