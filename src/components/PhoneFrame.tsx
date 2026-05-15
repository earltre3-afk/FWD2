import React from 'react';

interface Props {
  children: React.ReactNode;
  showStatusBar?: boolean;
  className?: string;
}

// On mobile: full screen. On desktop: phone-like centered container with side panels visible.
const PhoneFrame: React.FC<Props> = ({ children, showStatusBar = true, className = '' }) => {
  return (
    <div className={`relative w-full min-h-screen mx-auto max-w-md md:max-w-lg ${className}`}>
      {showStatusBar && (
        <div className="hidden sm:flex items-center justify-between px-6 pt-4 pb-1 text-xs text-white/80 font-medium">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <span className="opacity-80">●●●●</span>
            <span className="opacity-80">▮▮</span>
          </span>
        </div>
      )}
      {children}
    </div>
  );
};

export default PhoneFrame;
