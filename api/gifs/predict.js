const MAX_MESSAGE = 500;
const FALLBACK_INTENTS = [
  ['laugh', ['lol', 'funny', 'dead', 'laugh', 'hilarious', 'crying laughing']],
  ['side eye', ['sus', 'hmm', 'really', 'sure', 'shade', 'awkward']],
  ['hype', ['yes', 'win', 'congrats', 'proud', 'lets go', 'celebrate']],
  ['facts', ['true', 'exactly', 'agree', 'period', 'that part', 'correct']],
  ['wow', ['wow', 'omg', 'what', 'shocked', 'wild', 'no way']],
  ['love', ['love', 'cute', 'miss you', 'heart', 'adorable']],
  ['sad', ['sorry', 'sad', 'cry', 'hurt', 'tears']],
  ['angry', ['mad', 'angry', 'rage', 'pissed', 'furious']],
  ['confused', ['confused', 'wait', 'huh', 'lost', 'what do you mean']],
];

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

function clean(value, max = MAX_MESSAGE) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function tokenize(message) {
  return clean(message).toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
}

function heuristicPredict(message) {
  const normalized = clean(message).toLowerCase();
  if (!normalized) {
    return {
      query: 'trending reaction',
      tone: 'open',
      mood: 'Cool',
      tags: ['trending', 'reaction', 'fwd'],
      confidence: 0.25,
      reason: 'No message text yet.',
    };
  }

  let best = { intent: 'reaction', score: 0 };
  for (const [intent, aliases] of FALLBACK_INTENTS) {
    const score = aliases.reduce((sum, alias) => sum + (normalized.includes(alias) ? alias.length : 0), 0);
    if (score > best.score) best = { intent, score };
  }

  const words = tokenize(normalized);
  const strongWords = words.filter((word) => word.length > 3).slice(-3);
  const query = best.score > 0 ? best.intent : strongWords.join(' ') || 'reaction';
  const moodMap = {
    laugh: 'LOL',
    'side eye': 'Side Eye',
    hype: 'Hype',
    facts: 'Facts',
    wow: 'Wow',
    love: 'Lit',
    sad: 'Period',
    angry: 'Side Eye',
    confused: 'Wow',
    reaction: 'Cool',
  };

  return {
    query,
    tone: best.intent,
    mood: moodMap[best.intent] || 'Cool',
    tags: Array.from(new Set([query, best.intent, ...strongWords])).slice(0, 6),
    confidence: best.score > 0 ? 0.62 : 0.38,
    reason: 'Predicted from message keywords.',
  };
}

function sanitizePrediction(value, fallback) {
  const query = clean(value?.query || fallback.query, 80).toLowerCase() || fallback.query;
  const tags = Array.isArray(value?.tags) ? value.tags : fallback.tags;
  return {
    query,
    tone: clean(value?.tone || fallback.tone, 40).toLowerCase(),
    mood: clean(value?.mood || fallback.mood, 40),
    tags: tags.map((tag) => clean(tag, 32).toLowerCase()).filter(Boolean).slice(0, 8),
    confidence: Math.max(0, Math.min(1, Number(value?.confidence || fallback.confidence))),
    reason: clean(value?.reason || fallback.reason, 140),
  };
}

async function openAiPredict(message, context, fallback) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PREDICTIVE_GIF_MODEL || process.env.OPENAI_CATEGORIZER_MODEL || 'gpt-4o-mini',
      input: [{
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            'Predict the best GIF search intent for a user while they type a message.',
            'Return what GIFs should be recommended, not a reply to the message.',
            'Use short social/reaction language such as "side eye", "laugh", "hype", "facts", "wow", "love", "awkward", "celebrate".',
            `Context: ${clean(context, 40) || 'message'}`,
            `Message draft: ${clean(message)}`,
          ].join('\n'),
        }],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'predictive_gif_intent',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              query: { type: 'string' },
              tone: { type: 'string' },
              mood: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reason: { type: 'string' },
            },
            required: ['query', 'tone', 'mood', 'tags', 'confidence', 'reason'],
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
    const message = clean(body.message);
    const context = clean(body.context, 40);
    const fallback = heuristicPredict(message);
    const prediction = await openAiPredict(message, context, fallback);
    return json(res, 200, {
      ok: true,
      prediction: sanitizePrediction(prediction, fallback),
      aiUsed: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch {
    const fallback = heuristicPredict('');
    return json(res, 200, { ok: true, prediction: fallback, aiUsed: false });
  }
}
