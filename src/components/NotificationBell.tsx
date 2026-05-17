import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { stopActionEvent } from '@/lib/actionEvents';

interface NotificationBellProps {
  size?: number;
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ size = 18, className = 'w-10 h-10' }) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={(event) => {
          stopActionEvent(event);
          setOpen(true);
        }}
        className={`${className} rounded-full glass flex items-center justify-center relative`}
        aria-label="Notifications"
      >
        <Bell size={size} className="text-fuchsia-400" />
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-pink-500" />
      </button>
      <SheetContent
        side="bottom"
        className="glass-strong border-fuchsia-500/30 rounded-t-3xl px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Notifications</SheetTitle>
          <SheetDescription>No notifications yet.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationBell;
