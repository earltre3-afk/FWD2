const CATEGORIES = ['Black Culture', 'Reactions', 'Clips', 'Memes', 'Music', 'TV & Movies', 'Sports', 'Gaming', 'New'];
const MOODS = ['Cool', 'Lit', 'LOL', 'Wow', 'Hype', 'Side Eye', 'Facts', 'Period'];
const MAX_TEXT = 240;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function cleanText(value, max = MAX_TEXT) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanTags(tags) {
  return Array.from(new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => cleanText(tag, 32).toLowerCase())
    .map((tag) => tag.replace(/^#/, ''))
    .filter((tag) => /^[a-z0-9][a-z0-9 '&_-]{1,31}$/.test(tag))))
    .slice(0, 10);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function sanitizeResult(value, fallback) {
  const category = CATEGORIES.includes(value?.category) ? value.category : fallback.category;
  const mood = MOODS.includes(value?.mood) ? value.mood : fallback.mood;
  const tags = cleanTags(value?.tags?.length ? value.tags : fallback.tags);
  const title = cleanText(value?.title || fallback.title || 'My FWD', 60);
  const caption = cleanText(value?.caption || fallback.caption || '', 160);
  const confidence = Math.max(0, Math.min(1, Number(value?.confidence || fallback.confidence || 0.45)));
  const reason = cleanText(value?.reason || fallback.reason || 'Categorized from GIF metadata.', 140);
  return { title, category, mood, tags, caption, confidence, reason };
}

function heuristicCategorize(input) {
  const haystack = [
    input.title,
    input.caption,
    input.category,
    input.mood,
    ...(input.tags || []),
    input.sourceUrl,
  ].join(' ').toLowerCase();

  const has = (...words) => words.some((word) => haystack.includes(word));
  let category = 'Reactions';
  if (has('meme', 'drake', 'kermit', 'doge', 'viral')) category = 'Memes';
  else if (has('music', 'dj', 'song', 'beat', 'dance', 'rap', 'hiphop')) category = 'Music';
  else if (has('movie', 'tv', 'netflix', 'marvel', 'office', 'star wars', 'show')) category = 'TV & Movies';
  else if (has('sports', 'nba', 'nfl', 'soccer', 'basketball', 'football', 'goal', 'dunk')) category = 'Sports';
  else if (has('game', 'gaming', 'fortnite', 'minecraft', 'pokemon', 'controller')) category = 'Gaming';
  else if (has('black culture', 'nene', 'issa', 'rhoa', 'oprah', 'jordan')) category = 'Black Culture';
  else if (has('city', 'nature', 'beach', 'space', 'rain', 'clip', 'scenic')) category = 'Clips';

  let mood = 'Cool';
  if (has('lol', 'laugh', 'funny', 'hilarious', 'dead')) mood = 'LOL';
  else if (has('wow', 'shock', 'shook', 'surprise', 'mind blown')) mood = 'Wow';
  else if (has('hype', 'win', 'celebrate', 'victory', 'excited', 'yes')) mood = 'Hype';
  else if (has('side eye', 'sus', 'annoyed', 'nope', 'awkward', 'cringe')) mood = 'Side Eye';
  else if (has('facts', 'true', 'agree', 'correct', 'smart')) mood = 'Facts';
  else if (has('period', 'queen', 'slay', 'savage', 'ate')) mood = 'Period';
  else if (has('lit', 'fire', 'hot')) mood = 'Lit';

  const tags = cleanTags([
    ...(input.tags || []),
    category.toLowerCase(),
    mood.toLowerCase(),
    ...haystack.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && word.length < 18).slice(0, 8),
  ]);

  return {
    title: cleanText(input.title || `${mood} FWD`, 60),
    category,
    mood,
    tags: tags.length ? tags : ['reaction', mood.toLowerCase(), category.toLowerCase()],
    caption: cleanText(input.caption || '', 160),
    confidence: 0.48,
    reason: 'Used local keyword matching because AI categorization is not configured.',
  };
}

async function openAiCategorize(input, fallback) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const sourceUrl = safeUrl(input.sourceUrl || input.thumbnailUrl);
  const content = [
    {
      type: 'input_text',
      text: [
        'Categorize this GIF/FWD for a social reaction app.',
        'Return concise, culturally aware metadata. Prefer the best category and reaction mood over generic labels.',
        `Allowed categories: ${CATEGORIES.join(', ')}`,
        `Allowed moods: ${MOODS.join(', ')}`,
        `Existing title: ${cleanText(input.title, 80) || '(none)'}`,
        `Caption: ${cleanText(input.caption, 160) || '(none)'}`,
        `Existing tags: ${cleanTags(input.tags).join(', ') || '(none)'}`,
      ].join('\n'),
    },
  ];
  if (sourceUrl) content.push({ type: 'input_image', image_url: sourceUrl });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CATEGORIZER_MODEL || 'gpt-4o-mini',
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'gif_categorization',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              category: { type: 'string', enum: CATEGORIES },
              mood: { type: 'string', enum: MOODS },
              tags: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 10 },
              caption: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reason: { type: 'string' },
            },
            required: ['title', 'category', 'mood', 'tags', 'caption', 'confidence', 'reason'],
          },
        },
      },
    }),
  });

  if (!response.ok) return fallback;
  const payload = await response.json();
  const text = payload.output_text || payload.output?.flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
  if (!text) return fallback;

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const input = {
      title: cleanText(body.title, 80),
      caption: cleanText(body.caption, 180),
      tags: cleanTags(body.tags),
      category: cleanText(body.category, 40),
      mood: cleanText(body.mood, 40),
      sourceUrl: safeUrl(body.sourceUrl),
      thumbnailUrl: safeUrl(body.thumbnailUrl),
    };

    const fallback = heuristicCategorize(input);
    const ai = await openAiCategorize(input, fallback);
    return json(res, 200, { ok: true, metadata: sanitizeResult(ai, fallback), aiUsed: Boolean(process.env.OPENAI_API_KEY) });
  } catch {
    return json(res, 200, {
      ok: true,
      metadata: sanitizeResult(heuristicCategorize({}), {}),
      aiUsed: false,
    });
  }
}
