import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Sparkles, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import { GIFS, CATEGORIES } from '@/data/gifs';
import { Gif } from '@/contexts/AppContext';
import { fwdConfig } from '@/lib/supabase';
import { captureFallbackReaction, trackReactionSearch } from '@/lib/rapidReactionScout';
import { useRapidReactionScout } from '@/hooks/useRapidReactionScout';
import { usePredictiveGifs } from '@/hooks/usePredictiveGifs';
import type { ReactionAsset } from '@/types/reactions';

interface PickerEvent {
  type: 'FWD_GIF_SELECTED' | 'FWD_PICKER_CLOSED' | 'FWD_PICKER_ERROR' | 'FWD_PICKER_READY';
  provider?: 'fwd';
  source?: string;
  usage?: { source?: string; context?: string; userUid?: string };
  gif?: {
    id: string; title: string; mediaUrl: string; previewUrl: string; thumbnailUrl: string;
    width: number; height: number; duration: number; format: string; altText: string; tags: string[];
  };
  message?: string;
}

export const postFwdEvent = (evt: PickerEvent) => {
  try {
    const targetOrigin = document.referrer ? new URL(document.referrer).origin : '*';
    window.parent?.postMessage(evt, targetOrigin);
    window.opener?.postMessage(evt, targetOrigin);
    window.dispatchEvent(new CustomEvent('fwd:event', { detail: evt }));
  } catch {
    window.parent?.postMessage(evt, '*');
    window.opener?.postMessage(evt, '*');
  }
};

export const gifToPayload = (g: Gif, usage?: PickerEvent['usage']): PickerEvent => ({
  type: 'FWD_GIF_SELECTED',
  provider: 'fwd',
  usage,
  gif: {
    id: g.id,
    title: g.title,
    mediaUrl: g.image,
    previewUrl: g.image,
    thumbnailUrl: g.image,
    width: 480,
    height: 480,
    duration: 2.8,
    format: 'gif',
    altText: `${g.title} reaction GIF`,
    tags: g.tags,
  },
});

const reactionToPayload = (asset: ReactionAsset, usage?: PickerEvent['usage']): PickerEvent => ({
  type: 'FWD_GIF_SELECTED',
  provider: 'fwd',
  usage,
  gif: {
    id: asset.id,
    title: asset.title,
    mediaUrl: asset.gifUrl,
    previewUrl: asset.previewUrl,
    thumbnailUrl: asset.previewUrl,
    width: asset.width || 480,
    height: asset.height || 480,
    duration: 2.8,
    format: 'gif',
    altText: `${asset.title} reaction GIF`,
    tags: asset.tags,
  },
});

const BlockedEmbed: React.FC<{ checking?: boolean }> = ({ checking }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-5 text-center">
    <div className="glass-strong rounded-3xl border border-fuchsia-500/25 p-7 max-w-sm neon-glow-purple">
      <FwdLogo size="md" />
      {checking ? (
        <>
          <Loader2 className="mx-auto mt-6 mb-3 text-fuchsia-300 animate-spin" size={28} />
          <h2 className="text-white font-black text-xl">Checking embed access…</h2>
          <p className="text-zinc-400 text-sm mt-2">FWD is confirming this domain can use the picker.</p>
        </>
      ) : (
        <>
          <h2 className="text-white font-black text-xl mt-6">This embed is not allowed on this domain.</h2>
          <p className="text-zinc-400 text-sm mt-2">Ask the FWD key owner to add this site to the allowed origins list.</p>
        </>
      )}
    </div>
  </div>
);

// Supported context values for embed picker
export type PickerContext = 
  | 'message' 
  | 'comment' 
  | 'group_chat' 
  | 'watch_party' 
  | 'creator_channel' 
  | 'feed_post' 
  | 'profile_reaction';

// Supported mode values
export type PickerMode = 'compact' | 'full';

// Supported theme values
export type PickerTheme = 'dark' | 'light';

const EmbedPicker: React.FC = () => {
  const [params] = useSearchParams();
  
  // Query params per spec
  const embedKey = params.get('key') || '';
  const source = params.get('source') || '';
  const context = (params.get('context') || 'message') as PickerContext;
  const userUid = params.get('user_uid') || '';
  const theme = (params.get('theme') || 'dark') as PickerTheme;
  const modeParam = (params.get('mode') || 'compact') as PickerMode;
  const messageText = params.get('message') || params.get('draft') || '';
  
  const [accessState, setAccessState] = useState<'checking' | 'allowed' | 'blocked'>('checking');
  const [compact, setCompact] = useState(modeParam === 'compact');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('Trending');
  const { results: scoutResults, scouting, attribution, sourcesUsed } = useRapidReactionScout(query, 10);
  const predictive = usePredictiveGifs(messageText, context, 10);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!embedKey || !fwdConfig.isSupabaseConfigured) {
        if (!cancelled) setAccessState('blocked');
        postFwdEvent({
          type: 'FWD_PICKER_ERROR',
          provider: 'fwd',
          source: source || undefined,
          message: 'This embed is not allowed on this domain.',
        });
        return;
      }

      try {
        const response = await fetch(`${fwdConfig.supabaseUrl}/functions/v1/verify-picker-key?key=${encodeURIComponent(embedKey)}`, {
          method: 'GET',
          headers: {
            apikey: fwdConfig.supabaseAnonKey,
            Authorization: `Bearer ${fwdConfig.supabaseAnonKey}`,
          },
        });

        if (cancelled) return;
        if (response.ok) {
          setAccessState('allowed');
          postFwdEvent({ type: 'FWD_PICKER_READY', provider: 'fwd', source: source || undefined });
        } else {
          setAccessState('blocked');
          postFwdEvent({
            type: 'FWD_PICKER_ERROR',
            provider: 'fwd',
            source: source || undefined,
            message: 'This embed is not allowed on this domain.',
          });
        }
      } catch {
        if (!cancelled) setAccessState('blocked');
        postFwdEvent({
          type: 'FWD_PICKER_ERROR',
          provider: 'fwd',
          source: source || undefined,
          message: 'This embed is not allowed on this domain.',
        });
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [embedKey, source]);

  const results = useMemo(() => {
    if (!query.trim() && messageText.trim().length >= 2) {
      return predictive.results;
    }
    if (!query.trim()) {
      let r = GIFS;
      if (cat !== 'Trending') r = r.filter(g => g.category === cat);
      return r.slice(0, 10).map(g => ({
        id: `fwd:${g.id}`,
        source: 'fwd' as const,
        sourceId: g.id,
        query: '',
        title: g.title,
        tags: [...g.tags, g.category, g.mood || ''].filter(Boolean),
        previewUrl: g.image,
        gifUrl: g.image,
      }));
    }
    if (cat === 'Trending') return scoutResults;
    const f = cat.toLowerCase();
    return scoutResults.filter(asset =>
      asset.source !== 'fwd' || asset.tags.some(tag => tag.toLowerCase().includes(f))
    );
  }, [cat, messageText, predictive.results, query, scoutResults]);

  const handleSelect = (asset: ReactionAsset) => {
    trackReactionSearch('search_result_clicked', {
      query: query.trim().toLowerCase(),
      source: asset.source,
      sourceId: asset.sourceId,
    });
    trackReactionSearch('reaction_selected', { source: asset.source, sourceId: asset.sourceId });
    captureFallbackReaction(asset);
    const evt = reactionToPayload(asset, { source: source || undefined, context, userUid: userUid || undefined });
    if (source) evt.source = source;
    postFwdEvent(evt);
  };

  const handleClose = () => {
    postFwdEvent({ type: 'FWD_PICKER_CLOSED', source: source || undefined });
  };

  const prettySource = source
    ? source.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  if (accessState === 'checking') return <BlockedEmbed checking />;
  if (accessState === 'blocked') return <BlockedEmbed />;

  return (
    <div className={`fixed inset-0 ${compact ? 'flex items-end' : ''} bg-black/40 backdrop-blur-md`}>
      <div className={`mx-auto bg-gradient-to-b from-zinc-950 to-black border border-fuchsia-500/30 ${compact ? 'rounded-t-3xl w-full max-w-md max-h-[70vh]' : 'rounded-3xl w-full max-w-lg my-6 max-h-[90vh]'} flex flex-col overflow-hidden neon-glow-purple`}>
        {compact && <div className="mx-auto mt-2 w-10 h-1 rounded-full bg-zinc-700" />}

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 min-w-0">
            <FwdLogo size={compact ? 'sm' : 'md'} />
            {prettySource ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400 ml-1 truncate">
                <span className="w-1 h-1 rounded-full bg-fuchsia-400" />
                <span className="truncate max-w-[120px]">for {prettySource}</span>
                <span className="text-zinc-600">· {context}</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCompact(!compact)} className="w-9 h-9 rounded-full glass flex items-center justify-center" title="Toggle compact">
              {compact ? <Maximize2 size={15} className="text-zinc-300" /> : <Minimize2 size={15} className="text-zinc-300" />}
            </button>
            <button onClick={handleClose} className="w-9 h-9 rounded-full glass flex items-center justify-center" title="Close picker">
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        <div className="px-4">
          <div className="glass-strong rounded-full px-4 py-2.5 border border-fuchsia-500/40 flex items-center gap-3">
            <SearchIcon size={16} className="text-zinc-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search GIFs, reactions, memes…"
              className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-sm" />
            <Sparkles size={14} className="text-cyan-400" />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3">
            {CATEGORIES.slice(0, 6).map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  c === cat ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent' : 'glass text-zinc-300 border-white/10'
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-400 mb-2">
            {query ? `Results (${results.length})` : messageText.trim().length >= 2 ? `Predicted: ${predictive.prediction.query}` : 'Trending'}
          </h3>
          {results.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-sm">Loading reactions...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {results.map(asset => (
                <button key={asset.id} onClick={() => handleSelect(asset)}
                  className="relative rounded-xl overflow-hidden border border-fuchsia-500/20 hover:border-fuchsia-500/70 hover:scale-[1.02] transition group">
                  <img src={asset.previewUrl} className="w-full aspect-square object-cover" loading="lazy" alt={`${asset.title} reaction`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white">
                    {asset.source === 'giphy' || asset.source === 'tenor' ? asset.source.toUpperCase() : 'GIF'}
                  </span>
                  <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white truncate max-w-[85%]">{asset.title}</span>
                </button>
              ))}
            </div>
          )}
          {(query && scouting) || (!query && messageText.trim().length >= 2 && predictive.loading) ? (
            <div className="mt-3 text-center text-[11px] text-cyan-300">
              {!query ? 'Predictive GIF is matching the message...' : 'Rapid Reaction Scout is finding more...'}
            </div>
          ) : null}
        </div>

        <div className="px-4 py-2 border-t border-white/5 text-center">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            {attribution.length > 0 && sourcesUsed.some(s => s === 'giphy' || s === 'tenor')
              ? attribution.map(item => item.label).join(' · ')
              : 'Powered by FWD'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EmbedPicker;
