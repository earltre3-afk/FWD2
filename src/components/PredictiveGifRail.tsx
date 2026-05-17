import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import FwdAnimatedGif from '@/components/FwdAnimatedGif';
import { usePredictiveGifs } from '@/hooks/usePredictiveGifs';
import type { ReactionAsset } from '@/types/reactions';

interface Props {
  message: string;
  context?: string;
  limit?: number;
  onSelect: (asset: ReactionAsset) => void;
  compact?: boolean;
}

const PredictiveGifRail: React.FC<Props> = ({ message, context = 'message', limit = 6, onSelect, compact = false }) => {
  const { prediction, results, loading, settled } = usePredictiveGifs(message, context, limit);
  const active = message.trim().length >= 2;

  if (!active) return null;

  return (
    <section className="glass-strong rounded-2xl border border-cyan-500/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-200">
            <Sparkles size={12} />
            Predictive GIFs
          </div>
          <p className="mt-0.5 truncate text-[11px] text-zinc-400">
            {settled ? `Best fit: ${prediction.query}` : 'Reading the vibe...'}
          </p>
        </div>
        {loading && <Loader2 size={15} className="shrink-0 animate-spin text-cyan-300" />}
      </div>

      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'}`}>
        {results.slice(0, limit).map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => onSelect(asset)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-fuchsia-500/20 bg-black/50 transition hover:scale-[1.02] hover:border-cyan-400/70"
            title={asset.title}
          >
            <FwdAnimatedGif
              gifUrl={asset.gifUrl || asset.previewUrl}
              stillUrl={asset.previewUrl && asset.previewUrl !== asset.gifUrl ? asset.previewUrl : undefined}
              title={asset.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1.5 pt-5">
              <div className="truncate text-left text-[9px] font-bold text-white">{asset.title}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default PredictiveGifRail;
