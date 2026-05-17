export type ReactionAsset = {
  id: string;
  source: 'fwd' | 'giphy' | 'tenor' | 'fallback';
  sourceId?: string;
  query: string;
  title: string;
  tags: string[];
  previewUrl: string;
  gifUrl: string;
  width?: number;
  height?: number;
  shareUrl?: string;
  attributionLabel?: string;
  attributionUrl?: string;
  contentRating?: string;
  createdAt?: string;
};

export type ReactionAttribution = {
  source: 'giphy' | 'tenor';
  label: string;
};

export type ReactionSearchResponse = {
  query: string;
  limit: number;
  results: ReactionAsset[];
  sourcesUsed: ReactionAsset['source'][];
  hasMore: boolean;
  nextCursor: string | null;
  fallbackUsed: boolean;
  attribution: ReactionAttribution[];
};
