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
const SEED_QUERIES = [
  { query: 'trending reaction',        category: 'Reactions',    count: 50 },
  { query: 'funny reaction',           category: 'Reactions',    count: 30 },
  { query: 'black culture reaction',   category: 'Black Culture',count: 50 },
  { query: 'black girl magic',         category: 'Black Culture',count: 30 },
  { query: 'viral moment',             category: 'Memes',        count: 30 },
  { query: 'meme funny',               category: 'Memes',        count: 30 },
  { query: 'hip hop dance',            category: 'Music',        count: 25 },
  { query: 'music vibe',               category: 'Music',        count: 20 },
  { query: 'nba basketball',           category: 'Sports',       count: 20 },
  { query: 'sports celebration',       category: 'Sports',       count: 20 },
  { query: 'tv show reaction',         category: 'TV & Movies',  count: 25 },
  { query: 'movie scene iconic',       category: 'TV & Movies',  count: 25 },
  { query: 'video game gaming',        category: 'Gaming',       count: 20 },
  { query: 'aesthetic chill vibes',    category: 'Clips',        count: 20 },
  { query: 'new trending 2024',        category: 'New',          count: 20 },
  { query: 'excited celebrate hype',   category: 'Reactions',    count: 20 },
  { query: 'side eye shade',           category: 'Reactions',    count: 20 },
  { query: 'dancing party',            category: 'Music',        count: 20 },
  { query: 'laughing hysterically',    category: 'Reactions',    count: 20 },
  { query: 'shocked surprised',        category: 'Reactions',    count: 20 },
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
  for (const { query, category, count } of SEED_QUERIES) {
    try {
      process.stdout.write(`  Fetching "${query}"...`);
      const items = await fetchGiphy(query, count);
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
