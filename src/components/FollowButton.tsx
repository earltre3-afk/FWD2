import React, { useEffect, useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

interface Props {
  targetUserId: string;
  size?: 'sm' | 'md';
  className?: string;
}

const FollowButton: React.FC<Props> = ({ targetUserId, size = 'sm', className = '' }) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!user || user.id === targetUserId) { setReady(true); return; }
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      if (!cancel) { setFollowing(!!data); setReady(true); }
    })();
    return () => { cancel = true; };
  }, [user, targetUserId]);

  if (user?.id === targetUserId) return null;

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!user) {
      toast({ title: 'Sign in to follow', description: 'Create or sign into FWD to build your circle.' });
      nav('/login');
      return;
    }
    if (loading || !ready) return;
    setLoading(true);
    if (following) {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', targetUserId);
      if (!error) { setFollowing(false); toast({ title: 'Unfollowed' }); }
      else toast({ title: 'Follow update failed', description: 'Try again in a moment.', variant: 'destructive' });
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id, following_id: targetUserId,
      });
      if (!error) { setFollowing(true); toast({ title: 'Added to your FWD Circle' }); }
      else toast({ title: 'Follow failed', description: 'Try again in a moment.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const padX = size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs';

  return (
    <button
      onClick={toggle}
      disabled={loading || !ready}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border transition ${padX} ${
        following
          ? 'glass border-cyan-400/40 text-cyan-300 hover:border-rose-400/60 hover:text-rose-300'
          : 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white border-transparent neon-glow-pink hover:scale-[1.03]'
      } ${className}`}
    >
      {loading ? <Loader2 size={size === 'md' ? 14 : 12} className="animate-spin" /> :
        following ? <UserCheck size={size === 'md' ? 14 : 12} /> : <UserPlus size={size === 'md' ? 14 : 12} />}
      {loading ? '…' : following ? 'Following' : 'Follow'}
    </button>
  );
};

export default FollowButton;
