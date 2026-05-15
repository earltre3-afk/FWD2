# FWD Integration Kit for Trey TV

This kit provides everything Trey TV needs to integrate the FWD GIF picker into messages, comments, chats, watch parties, and creator channels.

## Quick Start

### 1. Get Your Picker Key

1. Go to [FWD Picker Keys](https://fwd.treytv.com/picker-api-keys)
2. Sign in with your FWD account
3. Create a new embed key:
   - **App Name**: `Trey TV`
   - **Allowed Origins**: Add all your domains
     - `https://tv.treytrizzy.com`
     - `https://treytv.com`
     - `https://www.treytv.com`
     - `http://localhost:3000` (for development)
     - `http://localhost:5173` (for development)
4. Copy your public key (starts with `pk_fwd_...`)

### 2. Install the Kit

Copy these files to your Trey TV project:

```
trey-tv-integration-kit/
├── fwdTypes.ts           # TypeScript types
├── fwdConfig.ts          # Configuration helpers
├── FwdPickerModal.tsx    # Modal component
├── FwdAppDrawerButton.tsx # Plus button drawer
└── README.md
```

### 3. Basic Integration

```tsx
import { useState } from 'react';
import FwdPickerModal from './trey-tv-integration-kit/FwdPickerModal';
import type { FwdGifPayload } from './trey-tv-integration-kit/fwdTypes';

function MessageComposer() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachedGif, setAttachedGif] = useState<FwdGifPayload | null>(null);

  return (
    <div>
      {/* Your message input... */}
      
      <button onClick={() => setPickerOpen(true)}>
        Add GIF
      </button>

      {attachedGif && (
        <div>
          <img src={attachedGif.mediaUrl} alt={attachedGif.altText} />
          <button onClick={() => setAttachedGif(null)}>Remove</button>
        </div>
      )}

      <FwdPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onGifSelected={(gif) => {
          setAttachedGif(gif);
          setPickerOpen(false);
        }}
        pickerKey="pk_fwd_your_key_here"
        source="trey_tv"
        context="message"
        userUid={currentUser?.uid}
        mode="compact"
        theme="dark"
      />
    </div>
  );
}
```

## Components

### FwdPickerModal

The main picker modal. Handles iframe loading and postMessage communication.

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Whether modal is visible |
| `onClose` | `() => void` | Yes | Called when modal should close |
| `onGifSelected` | `(gif: FwdGifPayload) => void` | Yes | Called with selected GIF |
| `onError` | `(message: string) => void` | No | Called on errors |
| `pickerKey` | `string` | Yes | Your FWD public embed key |
| `source` | `string` | Yes | Source identifier (`trey_tv`) |
| `context` | `FwdPickerContext` | Yes | Where picker is used |
| `userUid` | `string` | No | User ID for tracking |
| `theme` | `'dark' \| 'light'` | No | Theme (default: `dark`) |
| `mode` | `'compact' \| 'full'` | No | Display mode (default: `compact`) |

### FwdAppDrawerButton

A plus-button drawer component with FWD option.

**Props:**
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isDrawerOpen` | `boolean` | Yes | Whether drawer is open |
| `onToggleDrawer` | `() => void` | Yes | Toggle drawer |
| `onFwdClick` | `() => void` | Yes | Called when FWD is selected |
| `additionalApps` | `Array` | No | Other app options |

## Context Values

Use the appropriate context for better analytics:

| Context | Use Case |
|---------|----------|
| `message` | Direct messages, chat |
| `comment` | Video/post comments |
| `group_chat` | Group conversations |
| `watch_party` | Watch party chat |
| `creator_channel` | Creator channel discussions |
| `feed_post` | Feed/timeline posts |
| `profile_reaction` | Profile reactions |

## Storing GIF Data

When a user selects a GIF, store these fields in your message/comment:

```ts
interface StoredGif {
  // Required
  id: string;           // GIF unique ID
  mediaUrl: string;     // Full quality URL
  
  // Recommended
  title: string;        // For accessibility
  thumbnailUrl: string; // For previews
  previewUrl: string;   // For loading states
  
  // Optional
  width: number;
  height: number;
  altText: string;
}
```

## Testing Locally

1. Add `http://localhost:3000` to your picker key's allowed origins
2. Make sure FWD is running at `https://fwd.treytv.com` or override:

```ts
// In development, you can override the FWD URL
window.__FWD_APP_URL__ = 'http://localhost:5173';
```

## PostMessage Events

The picker sends these events to your app:

### FWD_GIF_SELECTED
```ts
{
  type: 'FWD_GIF_SELECTED',
  provider: 'fwd',
  gif: { id, title, mediaUrl, ... },
  usage: { source, context, userUid }
}
```

### FWD_PICKER_CLOSED
```ts
{
  type: 'FWD_PICKER_CLOSED',
  provider: 'fwd'
}
```

### FWD_PICKER_ERROR
```ts
{
  type: 'FWD_PICKER_ERROR',
  provider: 'fwd',
  message: 'User-friendly error message'
}
```

## Security Notes

- Picker keys are **public** - they're safe to include in client-side code
- Origin checking prevents unauthorized domains from using your key
- Never trust `userUid` for permissions - it's only for usage tracking
- The picker never sends session tokens or secrets

## Support

- FWD Dashboard: https://fwd.treytv.com
- Integration Status: https://fwd.treytv.com/integration-status
- Picker Keys: https://fwd.treytv.com/picker-api-keys
