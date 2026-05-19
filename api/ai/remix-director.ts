const AI_MODEL = process.env.VERCEL_AI_MODEL || process.env.AI_GATEWAY_MODEL || 'openai/gpt-4o-mini';
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
  return (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    req.headers['x-vercel-oidc-token'] ||
    req.headers['X-Vercel-Oidc-Token']
  );
}

type RecipeMode = 'reaction' | 'split' | 'replace' | 'text';
type Placement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
type OverlayShape = 'rounded' | 'circle' | 'polaroid' | 'text-message' | 'sticker';
type CaptionPlacement = 'top' | 'bottom' | 'center';

interface RemixRecipe {
  mode: RecipeMode;
  caption: string;
  mood: string;
  style: string;
  placement: Placement;
  captionPlacement: CaptionPlacement;
  overlayShape: OverlayShape;
  scale: number;
  tags: string[];
  reason: string;
}

const FALLBACK_RECIPES: Record<string, RemixRecipe[]> = {
  funny: [
    {
      mode: 'reaction', caption: 'Me trying to act normal', mood: 'Funny', style: 'Clean',
      placement: 'bottom-right', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.35, tags: ['funny', 'reaction', 'relatable'],
      reason: 'Your photo works perfectly as a reaction bubble beside the original.',
    },
    {
      mode: 'reaction', caption: 'That was not on my bingo card', mood: 'Funny', style: 'Meme',
      placement: 'bottom-left', captionPlacement: 'top', overlayShape: 'sticker',
      scale: 0.38, tags: ['funny', 'surprised', 'meme'],
      reason: 'Sticker style sells the comedic contrast between you and the original.',
    },
    {
      mode: 'split', caption: 'When the plan actually works', mood: 'Funny', style: 'Clean',
      placement: 'center', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.5, tags: ['funny', 'plans', 'win'],
      reason: 'Side-by-side shows the before/after energy perfectly.',
    },
  ],
  petty: [
    {
      mode: 'reaction', caption: 'Now why would you say that out loud?', mood: 'Petty', style: 'Neon',
      placement: 'bottom-right', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.33, tags: ['petty', 'reaction', 'shade'],
      reason: 'Neon style with a reaction inset gives proper petty energy.',
    },
    {
      mode: 'reaction', caption: 'Me pretending I didn\'t notice', mood: 'Petty', style: 'Clean',
      placement: 'bottom-left', captionPlacement: 'bottom', overlayShape: 'circle',
      scale: 0.3, tags: ['petty', 'unbothered', 'shade'],
      reason: 'Circle overlay keeps it subtle — just like the petty energy.',
    },
    {
      mode: 'text', caption: 'The silence was the response', mood: 'Petty', style: 'Meme',
      placement: 'bottom-right', captionPlacement: 'center', overlayShape: 'rounded',
      scale: 0.35, tags: ['petty', 'silence', 'done'],
      reason: 'Sometimes just the caption does all the work.',
    },
  ],
  shocked: [
    {
      mode: 'split', caption: 'Wait… say that again', mood: 'Shocked', style: 'Cinematic',
      placement: 'center', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.5, tags: ['shocked', 'surprised', 'what'],
      reason: 'Split layout shows the collision of two energies for full shock value.',
    },
    {
      mode: 'reaction', caption: 'Me processing what just happened', mood: 'Shocked', style: 'Clean',
      placement: 'bottom-right', captionPlacement: 'bottom', overlayShape: 'sticker',
      scale: 0.36, tags: ['shocked', 'processing', 'omg'],
      reason: 'Your reaction face as a sticker overlay sells the disbelief.',
    },
    {
      mode: 'reaction', caption: 'The math stopped mathing', mood: 'Shocked', style: 'Neon',
      placement: 'top-right', captionPlacement: 'top', overlayShape: 'text-message',
      scale: 0.35, tags: ['shocked', 'confused', 'math'],
      reason: 'Text-message shape makes it feel like you\'re reacting in real time.',
    },
  ],
  flirty: [
    {
      mode: 'reaction', caption: 'Don\'t look at me like that', mood: 'Flirty', style: 'Neon',
      placement: 'bottom-right', captionPlacement: 'bottom', overlayShape: 'circle',
      scale: 0.32, tags: ['flirty', 'cute', 'vibe'],
      reason: 'Circle overlay keeps it playful and personal.',
    },
    {
      mode: 'reaction', caption: 'You knew what you were doing', mood: 'Flirty', style: 'Cinematic',
      placement: 'bottom-left', captionPlacement: 'bottom', overlayShape: 'polaroid',
      scale: 0.36, tags: ['flirty', 'caught', 'smooth'],
      reason: 'Polaroid shape gives it that candid, caught-in-the-moment feel.',
    },
    {
      mode: 'text', caption: 'That smile said enough', mood: 'Flirty', style: 'Neon',
      placement: 'center', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.35, tags: ['flirty', 'smile', 'got it'],
      reason: 'Neon text over the original GIF hits different for a flirty caption.',
    },
  ],
  dramatic: [
    {
      mode: 'replace', caption: 'I simply cannot today', mood: 'Dramatic', style: 'Cinematic',
      placement: 'center', captionPlacement: 'center', overlayShape: 'rounded',
      scale: 0.5, tags: ['dramatic', 'done', 'cinematic'],
      reason: 'Your media as the main visual with a cinematic caption is peak drama.',
    },
    {
      mode: 'reaction', caption: 'This is the end of the world', mood: 'Dramatic', style: 'Meme',
      placement: 'top-left', captionPlacement: 'top', overlayShape: 'sticker',
      scale: 0.4, tags: ['dramatic', 'end', 'meme'],
      reason: 'Top-left sticker lets the caption breathe at the bottom for full drama.',
    },
  ],
  celebration: [
    {
      mode: 'split', caption: 'That\'s how you clear it', mood: 'Celebration', style: 'Neon',
      placement: 'center', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.5, tags: ['celebration', 'win', 'clear'],
      reason: 'Side by side shows you celebrating together with the original vibe.',
    },
    {
      mode: 'reaction', caption: 'Main character moment', mood: 'Celebration', style: 'Cinematic',
      placement: 'bottom-right', captionPlacement: 'bottom', overlayShape: 'sticker',
      scale: 0.38, tags: ['celebration', 'main character', 'moment'],
      reason: 'Sticker overlay with cinematic caption makes you the star.',
    },
    {
      mode: 'text', caption: 'We needed this win', mood: 'Celebration', style: 'Clean',
      placement: 'center', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.35, tags: ['celebration', 'win', 'we did it'],
      reason: 'Sometimes the original GIF plus a clean caption says it all.',
    },
  ],
  savage: [
    {
      mode: 'reaction', caption: 'Say less, I\'m unbothered', mood: 'Savage', style: 'Neon',
      placement: 'bottom-right', captionPlacement: 'bottom', overlayShape: 'sticker',
      scale: 0.34, tags: ['savage', 'unbothered', 'neon'],
      reason: 'Your face as a sticker with a savage neon caption hits.',
    },
    {
      mode: 'text', caption: 'Anyway…', mood: 'Savage', style: 'Meme',
      placement: 'center', captionPlacement: 'center', overlayShape: 'rounded',
      scale: 0.35, tags: ['savage', 'anyway', 'dismissive'],
      reason: 'One word. Centered. Savage.',
    },
  ],
  vibes: [
    {
      mode: 'replace', caption: 'The vibe is real', mood: 'Vibes', style: 'Clean',
      placement: 'center', captionPlacement: 'bottom', overlayShape: 'rounded',
      scale: 0.5, tags: ['vibes', 'real', 'mood'],
      reason: 'Your media as the full visual with a clean caption matches the vibe.',
    },
  ],
};

function pickFallback(mood: string, hasUpload: boolean): RemixRecipe {
  const key = mood.toLowerCase().replace(/\s+/g, '');
  const pool = FALLBACK_RECIPES[key] || FALLBACK_RECIPES['funny'];
  // If no upload, prefer text or reaction modes without overlay dependency
  const filtered = hasUpload ? pool : pool.filter(r => r.mode === 'text' || r.mode === 'reaction');
  const recipes = filtered.length ? filtered : pool;
  return recipes[Math.floor(Math.random() * recipes.length)];
}

const SYSTEM_PROMPT = `You are a creative remix director for FWD, a GIF reaction app. Your job is to generate one remix recipe that tells the app how to blend an original GIF with a user's uploaded media.

Return ONLY a valid JSON object with these exact fields:
{
  "mode": "reaction" | "split" | "replace" | "text",
  "caption": string (max 12 words, punchy and culturally relevant),
  "mood": string (Funny | Petty | Savage | Shocked | Flirty | Dramatic | Celebration | Vibes),
  "style": string (Clean | Meme | Neon | Cinematic),
  "placement": "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center",
  "captionPlacement": "top" | "bottom" | "center",
  "overlayShape": "rounded" | "circle" | "polaroid" | "text-message" | "sticker",
  "scale": number between 0.25 and 0.5,
  "tags": array of 2-4 lowercase strings,
  "reason": string (one sentence explaining why this remix works)
}

Mode guidance:
- reaction: original GIF stays; uploaded media appears as inset overlay
- split: both media side by side
- replace: uploaded media becomes the main visual
- text: original GIF only with caption

Use "text" mode when there is no uploaded media. Do not invent media that doesn't exist. Return ONLY the JSON object, no markdown, no explanation outside the JSON.`;

function buildUserPrompt(originalTitle: string, uploadedMimeType: string, mood: string, style: string) {
  const hasUpload = Boolean(uploadedMimeType);
  const mediaDesc = hasUpload
    ? uploadedMimeType.startsWith('video/') ? 'a video clip' : uploadedMimeType.startsWith('image/gif') ? 'an animated GIF' : 'a photo'
    : 'no uploaded media';

  return `Original GIF: "${originalTitle}"
Uploaded media: ${mediaDesc}
User mood: ${mood}
User style: ${style}
Create the best remix recipe for these inputs.`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body: any = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid request body' });
  }

  const {
    mood = 'Funny',
    style = 'Clean',
    originalGifTitle = '',
    uploadedMimeType = '',
  } = body;

  const hasUpload = Boolean(uploadedMimeType);

  const token = gatewayToken(req);
  if (!token) {
    const recipe = pickFallback(mood, hasUpload);
    return json(res, 200, { recipe, source: 'fallback' });
  }

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.72,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(originalGifTitle, uploadedMimeType, mood, style) },
        ],
      }),
    });

    if (!response.ok) {
      console.warn('[remix-director] AI gateway error', response.status);
      return json(res, 200, { recipe: pickFallback(mood, hasUpload), source: 'fallback' });
    }

    const payload = await response.json();
    const content: string = payload.choices?.[0]?.message?.content || '';

    let recipe: RemixRecipe | null = null;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : JSON.parse(content);
      // Validate required fields
      if (parsed && typeof parsed.mode === 'string' && typeof parsed.caption === 'string') {
        recipe = {
          mode: ['reaction', 'split', 'replace', 'text'].includes(parsed.mode) ? parsed.mode : 'reaction',
          caption: String(parsed.caption || '').slice(0, 80),
          mood: String(parsed.mood || mood),
          style: String(parsed.style || style),
          placement: ['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'].includes(parsed.placement)
            ? parsed.placement : 'bottom-right',
          captionPlacement: ['top', 'bottom', 'center'].includes(parsed.captionPlacement)
            ? parsed.captionPlacement : 'bottom',
          overlayShape: ['rounded', 'circle', 'polaroid', 'text-message', 'sticker'].includes(parsed.overlayShape)
            ? parsed.overlayShape : 'rounded',
          scale: typeof parsed.scale === 'number' ? Math.min(0.5, Math.max(0.2, parsed.scale)) : 0.35,
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
          reason: String(parsed.reason || ''),
        };
        // If no upload and mode requires one, downgrade to text
        if (!hasUpload && (recipe.mode === 'replace' || recipe.mode === 'split')) {
          recipe.mode = 'reaction';
        }
      }
    } catch {
      console.warn('[remix-director] Failed to parse AI response');
    }

    return json(res, 200, {
      recipe: recipe ?? pickFallback(mood, hasUpload),
      source: recipe ? 'ai' : 'fallback',
    });
  } catch (err: any) {
    console.error('[remix-director] Error:', err?.message);
    return json(res, 200, { recipe: pickFallback(mood, hasUpload), source: 'fallback' });
  }
}
