import { CATEGORIES, MOODS } from '@/data/gifs';

export interface GifCategorizationInput {
  title?: string;
  caption?: string;
  tags?: string[];
  category?: string;
  mood?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
}

export interface GifCategorization {
  title: string;
  category: string;
  mood: string;
  tags: string[];
  caption: string;
  confidence: number;
  reason: string;
}

const fallback: GifCategorization = {
  title: 'My FWD',
  category: 'Reactions',
  mood: 'Cool',
  tags: ['reaction', 'fwd', 'moment', 'share'],
  caption: '',
  confidence: 0,
  reason: 'AI categorization is unavailable.',
};

export async function categorizeGif(input: GifCategorizationInput): Promise<GifCategorization> {
  const response = await fetch('/api/gifs/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error('Could not categorize this GIF.');
  const payload = await response.json();
  const metadata = payload?.metadata || {};

  return {
    title: String(metadata.title || input.title || fallback.title).slice(0, 60),
    category: CATEGORIES.includes(metadata.category) ? metadata.category : fallback.category,
    mood: MOODS.some((item) => item.name === metadata.mood) ? metadata.mood : fallback.mood,
    tags: Array.isArray(metadata.tags) && metadata.tags.length
      ? metadata.tags.map((tag: string) => String(tag).toLowerCase().replace(/^#/, '').trim()).filter(Boolean).slice(0, 10)
      : fallback.tags,
    caption: String(metadata.caption || input.caption || '').slice(0, 160),
    confidence: Math.max(0, Math.min(1, Number(metadata.confidence || 0))),
    reason: String(metadata.reason || fallback.reason).slice(0, 140),
  };
}
