/**
 * FwdPickerModal
 * 
 * A modal/bottom-sheet wrapper that loads the FWD GIF picker in an iframe.
 * Handles postMessage communication with the picker.
 * 
 * Usage:
 * ```tsx
 * <FwdPickerModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onGifSelected={(gif) => handleGifAttached(gif)}
 *   pickerKey="pk_fwd_abc123..."
 *   source="trey_tv"
 *   context="message"
 *   userUid={currentUser?.uid}
 * />
 * ```
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { buildFwdPickerUrl, DEFAULT_FWD_MODE, DEFAULT_FWD_THEME } from './fwdConfig';
import type {
  FwdGifPayload,
  FwdPickerContext,
  FwdPickerMode,
  FwdPickerTheme,
  isFwdGifSelectedEvent,
  isFwdPickerClosedEvent,
  isFwdPickerErrorEvent,
} from './fwdTypes';

// Re-export type guards for convenience
export { isFwdGifSelectedEvent, isFwdPickerClosedEvent, isFwdPickerErrorEvent } from './fwdTypes';

interface FwdPickerModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when a GIF is selected */
  onGifSelected: (gif: FwdGifPayload) => void;
  /** Called when an error occurs (optional) */
  onError?: (message: string) => void;
  /** Your public FWD picker key */
  pickerKey: string;
  /** Source identifier for your app */
  source: string;
  /** Context where picker is used */
  context: FwdPickerContext;
  /** Optional user UID for tracking */
  userUid?: string;
  /** Current composer text for predictive GIF recommendations */
  messageText?: string;
  /** Theme: 'dark' or 'light' */
  theme?: FwdPickerTheme;
  /** Mode: 'compact' or 'full' */
  mode?: FwdPickerMode;
  /** Custom class for the modal overlay */
  overlayClassName?: string;
  /** Custom class for the modal container */
  containerClassName?: string;
}

const FwdPickerModal: React.FC<FwdPickerModalProps> = ({
  isOpen,
  onClose,
  onGifSelected,
  onError,
  pickerKey,
  source,
  context,
  userUid,
  messageText,
  theme = DEFAULT_FWD_THEME,
  mode = DEFAULT_FWD_MODE,
  overlayClassName,
  containerClassName,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build the picker URL
  const pickerUrl = buildFwdPickerUrl({
    key: pickerKey,
    source,
    context,
    userUid,
    messageText,
    theme,
    mode,
  });

  // Handle postMessage events from the picker iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Security: Only accept messages from FWD origin
      if (!event.origin.includes('fwd.treytv.com') && !event.origin.includes('localhost')) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'FWD_GIF_SELECTED':
          if (data.gif) {
            onGifSelected(data.gif as FwdGifPayload);
            onClose();
          }
          break;

        case 'FWD_PICKER_CLOSED':
          onClose();
          break;

        case 'FWD_PICKER_ERROR':
          if (onError && data.message) {
            onError(data.message);
          }
          onClose();
          break;

        case 'FWD_PICKER_READY':
          // Picker is loaded and ready
          break;
      }
    },
    [onGifSelected, onClose, onError]
  );

  // Set up message listener
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, handleMessage]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isCompact = mode === 'compact';

  return (
    <div
      className={overlayClassName || 'fwd-picker-overlay'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isCompact ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isCompact ? 0 : '16px',
      }}
    >
      <div
        className={containerClassName || 'fwd-picker-container'}
        style={{
          width: '100%',
          maxWidth: isCompact ? '100%' : '480px',
          height: isCompact ? '70vh' : '80vh',
          maxHeight: isCompact ? '70vh' : '600px',
          borderRadius: isCompact ? '24px 24px 0 0' : '24px',
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 0 60px rgba(217, 70, 239, 0.3)',
        }}
      >
        <iframe
          ref={iframeRef}
          src={pickerUrl}
          title="FWD GIF Picker"
          allow="clipboard-write"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </div>
    </div>
  );
};

export default FwdPickerModal;
