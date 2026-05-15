import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onlyMark?: boolean;
}

const sizes = {
  sm: { mark: 28, text: 'text-2xl' },
  md: { mark: 40, text: 'text-4xl' },
  lg: { mark: 64, text: 'text-6xl' },
  xl: { mark: 96, text: 'text-7xl md:text-8xl' },
};

export const FwdMark: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size * 1.4, height: size }}>
    <svg
      viewBox="0 0 100 70"
      width={size * 1.4}
      height={size}
      className="drop-shadow-[0_0_18px_rgba(176,38,255,0.9)]"
      style={{ filter: 'drop-shadow(0 0 12px rgba(255,0,107,0.55))' }}
    >
      <defs>
        <linearGradient id="fwdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B026FF" />
          <stop offset="55%" stopColor="#FF006B" />
          <stop offset="100%" stopColor="#00BFFF" />
        </linearGradient>
        <linearGradient id="fwdGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF006B" />
          <stop offset="100%" stopColor="#00BFFF" />
        </linearGradient>
      </defs>
      <path d="M5 10 L40 35 L5 60 Z" fill="none" stroke="url(#fwdGrad)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M45 10 L80 35 L45 60 Z" fill="none" stroke="url(#fwdGrad2)" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  </div>
);

const FwdLogo: React.FC<Props> = ({ size = 'md', showText = true, className = '', onlyMark = false }) => {
  const s = sizes[size];
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <FwdMark size={s.mark} />
      {showText && !onlyMark && (
        <span className={`font-black italic tracking-tight text-white ${s.text}`} style={{
          textShadow: '0 0 18px rgba(176,38,255,0.5)'
        }}>
          FWD
        </span>
      )}
    </div>
  );
};

export default FwdLogo;
