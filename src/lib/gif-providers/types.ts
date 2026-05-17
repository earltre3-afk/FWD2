export type GifProviderName = 'giphy' | 'tenor' | 'fwd';

export type GifScoutResult = {
  id: string;
  provider: GifProviderName;
  providerGifId: string;
  query: string;
  scoutQuery?: string;
  title: string;
  previewUrl: string;
  mediaUrl: string;
  mp4Url?: string;
  webmUrl?: string;
  gifUrl?: string;
  posterUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  sourceUrl?: string;
  attribution?: string;
  rating?: string;
  resultCount: number;
  isRare: boolean;
  metadata?: Record<string, unknown>;
};

export type GifProviderSearchResponse = {
  provider: GifProviderName;
  query: string;
  resultCount: number;
  results: GifScoutResult[];
};

export type SafeProviderError = {
  provider: GifProviderName | 'ai';
  code: string;
  query?: string;
};

export type GifProviderAdapter = {
  provider: GifProviderName;
  searchGifs(query: string, limit: number, signal?: AbortSignal): Promise<GifProviderSearchResponse>;
};
