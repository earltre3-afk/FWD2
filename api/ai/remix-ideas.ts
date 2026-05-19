const AI_MODEL = process.env.VERCEL_AI_MODEL || process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o';
const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function gatewayToken(req: any) {
  return process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    req.headers['x-vercel-oidc-token'] ||
    req.headers['X-Vercel-Oidc-Token'];
}

const FALLBACK_IDEAS: Record<string, string[]> = {
  'funny': ['When the caffeine finally kicks in', 'Me ignoring my responsibilities', 'My brain at 3 AM'],
  'petty': ['Now why would you say that out loud?', 'Me pretending I didn’t see the red flag', 'That’s crazy... anyway'],
  'flirty': ['Are you always this cute?', 'You caught my attention', 'Don’t look at me like that'],
  'shocked': ['Did they really just say that?', 'Me reading the group chat', 'I am completely speechless'],
  'dramatic': ['I simply cannot today', 'This is the end of the world', 'Leaving the chat forever'],
  'celebration': ['We did it!', 'Mood all weekend', 'Time to pop the bottles'],
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readBody(req);
    const { mood = 'funny', context = '' } = body;
    
    const token = gatewayToken(req);
    if (!token) {
      // Fallback
      const fallbackList = FALLBACK_IDEAS[mood] || FALLBACK_IDEAS['funny'];
      return json(res, 200, { ideas: fallbackList });
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You generate short, punchy caption ideas for GIF remixes. Return a JSON object with an array of strings under the key "ideas". Max 3 ideas, max 10 words each. Do not use quotes inside the strings. Format: {"ideas": ["idea 1", "idea 2", "idea 3"]}',
          },
          {
            role: 'user',
            content: `Generate ${mood} captions for a GIF. Context: ${context || 'general reaction'}`,
          },
        ],
      }),
    });

    if (!response.ok) {
       console.warn('AI gateway error', await response.text());
       const fallbackList = FALLBACK_IDEAS[mood] || FALLBACK_IDEAS['funny'];
       return json(res, 200, { ideas: fallbackList });
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || '';
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { ideas: FALLBACK_IDEAS[mood] };
    }

    return json(res, 200, { ideas: parsed.ideas || FALLBACK_IDEAS[mood] || FALLBACK_IDEAS['funny'] });

  } catch (err: any) {
    console.error('Remix AI error', err);
    return json(res, 200, { ideas: FALLBACK_IDEAS['funny'] });
  }
}
