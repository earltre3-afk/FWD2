import React from 'react';
import { CheckCircle2, Link2, ExternalLink } from 'lucide-react';
import TreyTvLogo from '@/components/TreyTvLogo';

interface ConnectedTreyTvBadgeProps {
  trey_tv_uid?: string | null;
  trey_tv_display_name?: string | null;
  trey_tv_profile_url?: string | null;
  identity_sync_status?: string | null;
  identity_verified_at?: string | null;
  /** 'card' renders the full bordered card; 'inline' renders a small pill */
  variant?: 'card' | 'inline';
}

const ConnectedTreyTvBadge: React.FC<ConnectedTreyTvBadgeProps> = ({
  trey_tv_uid,
  trey_tv_display_name,
  trey_tv_profile_url,
  identity_sync_status,
  variant = 'card',
}) => {
  const synced = identity_sync_status === 'synced';

  if (!trey_tv_uid) return null;

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300">
        <TreyTvLogo size={14} className="flex-shrink-0" />
        Connected to Trey TV
        {synced && <CheckCircle2 size={11} className="text-green-400" />}
      </span>
    );
  }

  return (
    <div className="glass-strong rounded-2xl border border-amber-500/25 p-4 flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <TreyTvLogo size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold text-white">Connected to Trey TV</span>
          {synced && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5">
              <CheckCircle2 size={9} /> Verified
            </span>
          )}
        </div>
        {trey_tv_display_name && (
          <p className="text-xs text-zinc-300 font-medium truncate">{trey_tv_display_name}</p>
        )}
        <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">UID: {trey_tv_uid}</p>
        <div className="flex items-center gap-3 mt-2">
          {trey_tv_profile_url && (
            <a
              href={trey_tv_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition"
            >
              View Trey TV profile <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
      <Link2 size={16} className="flex-shrink-0 text-amber-500/50 mt-0.5" />
    </div>
  );
};

export default ConnectedTreyTvBadge;
