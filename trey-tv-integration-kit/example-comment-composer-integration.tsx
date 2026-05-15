/**
 * Example: Comment Composer with FWD GIF Integration
 * 
 * This demonstrates how to integrate the FWD GIF picker into a comment composer
 * in Trey TV. Adapt this pattern for video comments, feed post comments, etc.
 */

import React, { useState } from 'react';
import FwdPickerModal from './FwdPickerModal';
import { FwdMark } from './FwdAppDrawerButton';
import type { FwdGifPayload } from './fwdTypes';

// Your FWD picker key - get this from the FWD dashboard at /picker-api-keys
const FWD_PICKER_KEY = 'pk_fwd_your_key_here';

interface CommentComposerProps {
  /** Current user's UID for tracking */
  userUid?: string;
  /** Called when comment is posted */
  onPost: (comment: { text: string; gif?: FwdGifPayload }) => void;
  /** Placeholder text */
  placeholder?: string;
}

const ExampleCommentComposer: React.FC<CommentComposerProps> = ({
  userUid,
  onPost,
  placeholder = 'Add a comment...',
}) => {
  // Local state
  const [text, setText] = useState('');
  const [attachedGif, setAttachedGif] = useState<FwdGifPayload | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  // Handle GIF selection from picker
  const handleGifSelected = (gif: FwdGifPayload) => {
    setAttachedGif(gif);
    setPickerOpen(false);
  };

  // Remove attached GIF
  const handleRemoveGif = () => {
    setAttachedGif(null);
  };

  // Post the comment
  const handlePost = () => {
    if (!text.trim() && !attachedGif) return;

    onPost({
      text: text.trim(),
      gif: attachedGif || undefined,
    });

    // Reset state
    setText('');
    setAttachedGif(null);
  };

  const isExpanded = focused || text.trim() || attachedGif;

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '12px',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Attached GIF Preview */}
      {attachedGif && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px',
            marginBottom: '10px',
            borderRadius: '10px',
            backgroundColor: 'rgba(217, 70, 239, 0.1)',
            border: '1px solid rgba(217, 70, 239, 0.2)',
          }}
        >
          <img
            src={attachedGif.thumbnailUrl || attachedGif.mediaUrl}
            alt={attachedGif.altText}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: '#D946EF', fontWeight: 600 }}>
              {attachedGif.title}
            </div>
          </div>
          <button
            onClick={handleRemoveGif}
            style={{
              width: '24px',
              height: '24px',
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Input Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={isExpanded ? 2 : 1}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'white',
            fontSize: '14px',
            resize: 'none',
            lineHeight: '1.4',
          }}
        />
      </div>

      {/* Actions Row */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* FWD GIF Button */}
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: attachedGif ? 'rgba(217, 70, 239, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: attachedGif ? '1px solid rgba(217, 70, 239, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FwdMark size={16} />
            <span style={{ fontSize: '12px', color: attachedGif ? '#D946EF' : 'rgba(255, 255, 255, 0.7)' }}>
              {attachedGif ? 'Change GIF' : 'Add GIF'}
            </span>
          </button>

          {/* Post Button */}
          <button
            onClick={handlePost}
            disabled={!text.trim() && !attachedGif}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              background:
                text.trim() || attachedGif
                  ? 'linear-gradient(135deg, #D946EF 0%, #EC4899 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              cursor: text.trim() || attachedGif ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 600,
              color: 'white',
              opacity: text.trim() || attachedGif ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            Post
          </button>
        </div>
      )}

      {/* FWD Picker Modal */}
      <FwdPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onGifSelected={handleGifSelected}
        pickerKey={FWD_PICKER_KEY}
        source="trey_tv"
        context="comment"
        userUid={userUid}
        mode="compact"
        theme="dark"
      />
    </div>
  );
};

export default ExampleCommentComposer;

/**
 * Usage in your Trey TV app:
 * 
 * ```tsx
 * import ExampleCommentComposer from './trey-tv-integration-kit/example-comment-composer-integration';
 * 
 * function VideoComments({ videoId }) {
 *   const { currentUser } = useAuth();
 *   
 *   const handlePostComment = async (comment) => {
 *     await postComment({
 *       videoId,
 *       text: comment.text,
 *       // Store the GIF payload in your comment
 *       gifPayload: comment.gif ? {
 *         id: comment.gif.id,
 *         title: comment.gif.title,
 *         mediaUrl: comment.gif.mediaUrl,
 *         thumbnailUrl: comment.gif.thumbnailUrl,
 *       } : null,
 *     });
 *   };
 *   
 *   return (
 *     <div>
 *       <CommentList videoId={videoId} />
 *       <ExampleCommentComposer
 *         userUid={currentUser?.uid}
 *         onPost={handlePostComment}
 *         placeholder="Add a comment..."
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
