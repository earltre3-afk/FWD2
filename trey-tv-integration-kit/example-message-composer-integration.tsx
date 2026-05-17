/**
 * Example: Message Composer with FWD GIF Integration
 * 
 * This demonstrates how to integrate the FWD GIF picker into a message composer
 * in Trey TV. Copy and adapt this pattern for your message/chat UI.
 */

import React, { useState } from 'react';
import FwdAppDrawerButton from './FwdAppDrawerButton';
import FwdPickerModal from './FwdPickerModal';
import type { FwdGifPayload } from './fwdTypes';

// Your FWD picker key - get this from the FWD dashboard at /picker-api-keys
const FWD_PICKER_KEY = 'pk_fwd_your_key_here';

interface MessageComposerProps {
  /** Current user's UID for tracking */
  userUid?: string;
  /** Called when message is sent */
  onSend: (message: { text: string; gif?: FwdGifPayload }) => void;
}

const ExampleMessageComposer: React.FC<MessageComposerProps> = ({ userUid, onSend }) => {
  // Local state
  const [text, setText] = useState('');
  const [attachedGif, setAttachedGif] = useState<FwdGifPayload | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Handle GIF selection from picker
  const handleGifSelected = (gif: FwdGifPayload) => {
    setAttachedGif(gif);
    setPickerOpen(false);
  };

  // Remove attached GIF
  const handleRemoveGif = () => {
    setAttachedGif(null);
  };

  // Send the message
  const handleSend = () => {
    if (!text.trim() && !attachedGif) return;

    onSend({
      text: text.trim(),
      gif: attachedGif || undefined,
    });

    // Reset state
    setText('');
    setAttachedGif(null);
  };

  return (
    <div
      style={{
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '12px 16px',
      }}
    >
      {/* Attached GIF Preview */}
      {attachedGif && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 12px',
            marginBottom: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(217, 70, 239, 0.1)',
            border: '1px solid rgba(217, 70, 239, 0.3)',
          }}
        >
          <img
            src={attachedGif.thumbnailUrl || attachedGif.mediaUrl}
            alt={attachedGif.altText}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              objectFit: 'cover',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '12px',
                color: '#D946EF',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>FWD</span>
              <span style={{ color: 'white' }}>{attachedGif.title}</span>
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Powered by FWD
            </div>
          </div>
          <button
            onClick={handleRemoveGif}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Remove GIF"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Input Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Plus Button / App Drawer */}
        <FwdAppDrawerButton
          isDrawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen(!drawerOpen)}
          onFwdClick={() => setPickerOpen(true)}
          additionalApps={[
            // Add other app options here if needed
            {
              id: 'photo',
              label: 'Photo',
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="16" height="12" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <circle cx="7" cy="9" r="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <path d="M18 14l-4-4-8 8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                </svg>
              ),
              onClick: () => console.log('Photo clicked'),
              disabled: true,
            },
          ]}
        />

        {/* Text Input */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            padding: '10px 16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Send Button */}
        {(text.trim() || attachedGif) && (
          <button
            onClick={handleSend}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #D946EF 0%, #EC4899 100%)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(217, 70, 239, 0.4)',
            }}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M16 2L9 9M16 2l-5 14-2-5-5-2 12-5z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* FWD Picker Modal */}
      <FwdPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onGifSelected={handleGifSelected}
        pickerKey={FWD_PICKER_KEY}
        source="trey_tv"
        context="message"
        userUid={userUid}
        messageText={text}
        mode="compact"
        theme="dark"
      />
    </div>
  );
};

export default ExampleMessageComposer;

/**
 * Usage in your Trey TV app:
 * 
 * ```tsx
 * import ExampleMessageComposer from './trey-tv-integration-kit/example-message-composer-integration';
 * 
 * function ChatScreen() {
 *   const { currentUser } = useAuth();
 *   
 *   const handleSendMessage = async (message) => {
 *     await sendMessage({
 *       text: message.text,
 *       // Store the GIF payload in your message
 *       gifPayload: message.gif ? {
 *         id: message.gif.id,
 *         title: message.gif.title,
 *         mediaUrl: message.gif.mediaUrl,
 *         previewUrl: message.gif.previewUrl,
 *         thumbnailUrl: message.gif.thumbnailUrl,
 *       } : null,
 *     });
 *   };
 *   
 *   return (
 *     <div>
 *       <MessageList />
 *       <ExampleMessageComposer
 *         userUid={currentUser?.uid}
 *         onSend={handleSendMessage}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
