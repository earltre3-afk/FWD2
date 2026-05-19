import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { stopActionEvent } from '@/lib/actionEvents';

interface NotificationBellProps {
  size?: number;
  className?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ size = 18, className = 'w-10 h-10' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
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

      {open && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-strong rounded-2xl border border-fuchsia-500/30 w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5 shrink-0">
              <h2 className="text-lg font-black text-white">Notifications</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full glass border border-white/10 flex items-center justify-center"
              >
                <X size={14} className="text-zinc-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <p className="text-sm text-zinc-500 text-center">No notifications yet.</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default NotificationBell;
