import React, { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const REPORT_REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'copyright', label: 'Copyright concern' },
  { key: 'other', label: 'Other' },
] as const;

interface FwdReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gifId?: string | null;
  postId?: string | null;
}

const FwdReportSheet: React.FC<FwdReportSheetProps> = ({ open, onOpenChange, gifId, postId }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('spam');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const { error } = await supabase.from('fwd_reports').insert({
      reporter_user_id: user?.id ?? null,
      gif_id: gifId ?? null,
      post_id: postId ?? null,
      reason,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Report couldn’t send. Try again.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Report sent', description: 'Thanks. We will review this content.' });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="center"
        className="glass-strong border-fuchsia-500/30 rounded-2xl px-5 pt-5 pb-5 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Report FWD</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {REPORT_REASONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setReason(item.key)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-bold ${
                reason === item.key
                  ? 'border-fuchsia-400 bg-fuchsia-500/15 text-white'
                  : 'border-white/10 bg-black/25 text-zinc-300'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
            Submit report
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FwdReportSheet;
