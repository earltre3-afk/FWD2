const MAX_MESSAGE = 500;
const AI_MODEL = process.env.VERCEL_AI_MODEL || process.env.AI_GATEWAY_MODEL || 'openai/gpt-5.4';
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
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
  const cleanTags = tags.map((tag) => clean(tag, 32).toLowerCase()).filter(Boolean).slice(0, 8);
  const fallbackTags = (fallback.tags || []).map((tag) => clean(tag, 32).toLowerCase()).filter(Boolean).slice(0, 8);
  return {
    query,
    tone: clean(value?.tone || fallback.tone, 40).toLowerCase(),
    mood: clean(value?.mood || fallback.mood, 40),
    tags: cleanTags.length ? cleanTags : fallbackTags,
    confidence: Math.max(0, Math.min(1, Number(value?.confidence || fallback.confidence))),
    reason: clean(value?.reason || fallback.reason, 140),
  };
}

function gatewayToken(req) {
  return process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    req.headers['x-vercel-oidc-token'] ||
    req.headers['X-Vercel-Oidc-Token'];
}

function logAiUnavailable(reason, extra = {}) {
  console.warn('Vercel AI predict unavailable', {
    reason,
    hasGatewayKey: Boolean(process.env.AI_GATEWAY_API_KEY),
    hasLegacyKey: Boolean(process.env.VERCEL_AI_API_KEY),
    hasOidc: Boolean(process.env.VERCEL_OIDC_TOKEN),
    model: AI_MODEL,
    ...extra,
  });
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function vercelAiPredict(req, message, context, fallback) {
  const token = gatewayToken(req);
  if (!token) {
    logAiUnavailable('missing_token');
    return { prediction: fallback, aiUsed: false };
  }

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'You predict GIF search intent while a user types.',
            'Return what GIFs should be recommended, not a reply to the message.',
            'Use short social/reaction language such as side eye, laugh, hype, facts, wow, love, awkward, celebrate.',
            'Return only JSON. No markdown.',
            'Schema: {"query":string,"tone":string,"mood":string,"tags":string[3..8],"confidence":number 0..1,"reason":string}',
          ].join(' '),
        },
        {
          role: 'user',
          content: [`Context: ${clean(context, 40) || 'message'}`, `Message draft: ${clean(message)}`].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    logAiUnavailable('gateway_response_not_ok', { status: response.status, bodyStart: errorText.slice(0, 180) });
    return { prediction: fallback, aiUsed: false };
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = parseJsonObject(content);
  if (!parsed) logAiUnavailable('parse_failed', { bodyStart: JSON.stringify(payload).slice(0, 180) });
  return { prediction: parsed || fallback, aiUsed: Boolean(parsed) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const message = clean(body.message);
    const context = clean(body.context, 40);
    const fallback = heuristicPredict(message);
    try {
      const ai = await vercelAiPredict(req, message, context, fallback);
      return json(res, 200, {
        ok: true,
        prediction: sanitizePrediction(ai.prediction, fallback),
        aiUsed: ai.aiUsed,
        model: AI_MODEL,
      });
    } catch (error) {
      logAiUnavailable('exception', { message: error?.message || String(error) });
      return json(res, 200, {
        ok: true,
        prediction: sanitizePrediction(fallback, fallback),
        aiUsed: false,
        model: AI_MODEL,
      });
    }
  } catch {
    const fallback = heuristicPredict('');
    return json(res, 200, { ok: true, prediction: fallback, aiUsed: false });
  }
}
