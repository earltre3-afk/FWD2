/**
 * FwdAppDrawerButton
 * 
 * A plus-button drawer component that shows FWD as an app option.
 * When FWD is selected, it triggers the picker modal to open.
 * 
 * Usage:
 * ```tsx
 * <FwdAppDrawerButton
 *   onFwdClick={() => setPickerOpen(true)}
 *   isDrawerOpen={drawerOpen}
 *   onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
 * />
 * ```
 */

import React from 'react';

// FWD Logo Mark Component
const FwdMark: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M4 6h16M4 12h10m-10 6h16"
      stroke="url(#fwd-gradient)"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient id="fwd-gradient" x1="4" y1="6" x2="20" y2="18" gradientUnits="userSpaceOnUse">
        <stop stopColor="#D946EF" />
        <stop offset="0.5" stopColor="#EC4899" />
        <stop offset="1" stopColor="#22D3EE" />
      </linearGradient>
    </defs>
  </svg>
);

interface FwdAppDrawerButtonProps {
  /** Called when user clicks the FWD option */
  onFwdClick: () => void;
  /** Whether the drawer is currently open */
  isDrawerOpen: boolean;
  /** Called to toggle the drawer open/closed */
  onToggleDrawer: () => void;
  /** Additional apps to show in the drawer (optional) */
  additionalApps?: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }>;
  /** Custom class for the button */
  buttonClassName?: string;
  /** Custom class for the drawer */
  drawerClassName?: string;
}

const FwdAppDrawerButton: React.FC<FwdAppDrawerButtonProps> = ({
  onFwdClick,
  isDrawerOpen,
  onToggleDrawer,
  additionalApps = [],
  buttonClassName,
  drawerClassName,
}) => {
  return (
    <div style={{ position: 'relative' }}>
      {/* Plus Button */}
      <button
        onClick={onToggleDrawer}
        className={buttonClassName}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDrawerOpen ? '#D946EF' : 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          transform: isDrawerOpen ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        aria-label={isDrawerOpen ? 'Close app drawer' : 'Open app drawer'}
        aria-expanded={isDrawerOpen}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* App Drawer */}
      {isDrawerOpen && (
        <div
          className={drawerClassName}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '12px',
            padding: '12px',
            borderRadius: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(217, 70, 239, 0.3)',
            minWidth: '200px',
            boxShadow: '0 0 40px rgba(217, 70, 239, 0.2)',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '8px',
              paddingLeft: '4px',
            }}
          >
            Attach with
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {/* FWD App Option */}
            <button
              onClick={() => {
                onFwdClick();
                onToggleDrawer();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '8px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(217, 70, 239, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(217, 70, 239, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(217, 70, 239, 0.2)',
                }}
              >
                <FwdMark size={22} />
              </div>
              <span style={{ fontSize: '10px', color: 'white', fontWeight: 600 }}>FWD</span>
              <span
                style={{
                  fontSize: '9px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginTop: '-4px',
                }}
              >
                GIFs
              </span>
            </button>

            {/* Additional Apps */}
            {additionalApps.map((app) => (
              <button
                key={app.id}
                onClick={app.onClick}
                disabled={app.disabled}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: app.disabled ? 'not-allowed' : 'pointer',
                  opacity: app.disabled ? 0.5 : 1,
                  transition: 'background-color 0.2s',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {app.icon}
                </div>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                  {app.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FwdAppDrawerButton;
export { FwdMark };
