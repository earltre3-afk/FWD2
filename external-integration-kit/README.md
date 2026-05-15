# FWD External Integration Kit

This kit provides everything you need to integrate the FWD GIF picker into any web application.

## Overview

FWD provides an embeddable GIF picker that can be integrated into any app via an iframe. When a user selects a GIF, the picker sends a `postMessage` event with the GIF data to your app.

## Getting Started

### 1. Get a Picker Key

1. Visit [FWD Picker Keys](https://fwd.treytv.com/picker-api-keys)
2. Create a new embed key
3. Add your domain(s) to the allowed origins list
4. Copy your public key (starts with `pk_fwd_...`)

### 2. Build the Embed URL

```
https://fwd.treytv.com/embed/picker?key=YOUR_KEY&source=your_app&context=message&theme=dark&mode=compact
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `key` | Yes | Your public embed key |
| `source` | Yes | Your app identifier (e.g., `my_chat_app`) |
| `context` | No | Where picker is used: `message`, `comment`, `group_chat`, `watch_party`, `creator_channel`, `feed_post`, `profile_reaction` |
| `user_uid` | No | User identifier for analytics (public, non-sensitive) |
| `theme` | No | `dark` or `light` (default: `dark`) |
| `mode` | No | `compact` or `full` (default: `compact`) |

### 3. Listen for Events

The picker sends events via `postMessage`. Listen for these in your app:

```javascript
window.addEventListener('message', (event) => {
  // Security: verify origin
  if (!event.origin.includes('fwd.treytv.com')) return;
  
  const data = event.data;
  if (!data || data.provider !== 'fwd') return;
  
  switch (data.type) {
    case 'FWD_GIF_SELECTED':
      console.log('GIF selected:', data.gif);
      // data.gif contains: id, title, mediaUrl, previewUrl, thumbnailUrl, etc.
      break;
      
    case 'FWD_PICKER_CLOSED':
      console.log('Picker closed');
      break;
      
    case 'FWD_PICKER_ERROR':
      console.log('Error:', data.message);
      break;
      
    case 'FWD_PICKER_READY':
      console.log('Picker ready');
      break;
  }
});
```

## Examples

### Simple HTML + JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>FWD Integration Example</title>
  <style>
    .fwd-modal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9999;
    }
    .fwd-modal.open { display: flex; align-items: center; justify-content: center; }
    .fwd-modal iframe {
      width: 100%;
      max-width: 480px;
      height: 80vh;
      max-height: 600px;
      border: none;
      border-radius: 16px;
    }
    .gif-preview { max-width: 200px; margin: 10px 0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>FWD GIF Picker Demo</h1>
  
  <button id="openPicker">Add GIF</button>
  
  <div id="selectedGif"></div>
  
  <!-- FWD Picker Modal -->
  <div id="fwdModal" class="fwd-modal">
    <iframe id="fwdIframe" src="" allow="clipboard-write"></iframe>
  </div>

  <script>
    const PICKER_KEY = 'pk_fwd_your_key_here';
    const PICKER_URL = `https://fwd.treytv.com/embed/picker?key=${PICKER_KEY}&source=my_app&context=message&theme=dark&mode=compact`;
    
    const modal = document.getElementById('fwdModal');
    const iframe = document.getElementById('fwdIframe');
    const selectedGifDiv = document.getElementById('selectedGif');
    
    // Open picker
    document.getElementById('openPicker').addEventListener('click', () => {
      iframe.src = PICKER_URL;
      modal.classList.add('open');
    });
    
    // Close modal on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
        iframe.src = '';
      }
    });
    
    // Listen for FWD events
    window.addEventListener('message', (event) => {
      if (!event.origin.includes('fwd.treytv.com')) return;
      
      const data = event.data;
      if (!data || data.provider !== 'fwd') return;
      
      if (data.type === 'FWD_GIF_SELECTED') {
        selectedGifDiv.innerHTML = `
          <p>Selected: ${data.gif.title}</p>
          <img src="${data.gif.mediaUrl}" class="gif-preview" alt="${data.gif.altText}">
          <button onclick="clearGif()">Remove</button>
        `;
        modal.classList.remove('open');
        iframe.src = '';
      }
      
      if (data.type === 'FWD_PICKER_CLOSED') {
        modal.classList.remove('open');
        iframe.src = '';
      }
    });
    
    function clearGif() {
      selectedGifDiv.innerHTML = '';
    }
  </script>
</body>
</html>
```

### React Example

```tsx
import React, { useState, useEffect, useCallback } from 'react';

interface FwdGif {
  id: string;
  title: string;
  mediaUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  altText: string;
  tags: string[];
}

interface FwdPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onGifSelected: (gif: FwdGif) => void;
  pickerKey: string;
  source?: string;
  context?: string;
  userUid?: string;
}

const FwdPicker: React.FC<FwdPickerProps> = ({
  isOpen,
  onClose,
  onGifSelected,
  pickerKey,
  source = 'external_app',
  context = 'message',
  userUid,
}) => {
  const params = new URLSearchParams({
    key: pickerKey,
    source,
    context,
    theme: 'dark',
    mode: 'compact',
    ...(userUid && { user_uid: userUid }),
  });
  
  const pickerUrl = `https://fwd.treytv.com/embed/picker?${params}`;
  
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.origin.includes('fwd.treytv.com')) return;
    
    const data = event.data;
    if (!data || data.provider !== 'fwd') return;
    
    if (data.type === 'FWD_GIF_SELECTED') {
      onGifSelected(data.gif);
      onClose();
    }
    if (data.type === 'FWD_PICKER_CLOSED') {
      onClose();
    }
  }, [onGifSelected, onClose]);
  
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, handleMessage]);
  
  if (!isOpen) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <iframe
        src={pickerUrl}
        title="FWD GIF Picker"
        allow="clipboard-write"
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '80vh',
          maxHeight: '600px',
          border: 'none',
          borderRadius: '16px',
        }}
      />
    </div>
  );
};

// Usage
function App() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedGif, setSelectedGif] = useState<FwdGif | null>(null);
  
  return (
    <div>
      <button onClick={() => setPickerOpen(true)}>Add GIF</button>
      
      {selectedGif && (
        <div>
          <img src={selectedGif.mediaUrl} alt={selectedGif.altText} />
          <button onClick={() => setSelectedGif(null)}>Remove</button>
        </div>
      )}
      
      <FwdPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onGifSelected={setSelectedGif}
        pickerKey="pk_fwd_your_key_here"
        source="my_app"
        context="message"
      />
    </div>
  );
}
```

## GIF Payload Structure

When a GIF is selected, you receive:

```typescript
{
  type: 'FWD_GIF_SELECTED',
  provider: 'fwd',
  gif: {
    id: string;           // Unique GIF ID
    title: string;        // Human-readable title
    mediaUrl: string;     // Full quality URL
    previewUrl: string;   // Preview quality URL
    thumbnailUrl: string; // Thumbnail URL
    width: number;        // Width in pixels
    height: number;       // Height in pixels
    duration: number;     // Duration in seconds
    format: string;       // 'gif', 'mp4', or 'webm'
    altText: string;      // Accessibility text
    tags: string[];       // Keywords
  },
  usage: {
    source: string;       // Your app identifier
    context: string;      // Where picker was used
    userUid?: string;     // User ID if provided
  }
}
```

## Security Notes

1. **Picker keys are public** - Safe to include in client-side code
2. **Origin checking** - Only domains in your allowed origins list can use your key
3. **No secrets transmitted** - The picker never sends session tokens or sensitive data
4. **User tracking is optional** - `user_uid` is for analytics only, not permissions

## Allowed Origins

Your picker will only work on domains listed in your key's allowed origins:

- **Exact match required** - `https://example.com` won't match `https://www.example.com`
- **Include all variants** - Add both `www` and non-`www` if needed
- **Localhost for dev** - Add `http://localhost:3000` for local development
- **No wildcards** - Each origin must be explicitly listed

## Troubleshooting

### "This embed is not allowed on this domain"

- Check that your current domain is in the allowed origins
- Make sure you're using the correct picker key
- Verify the key is still active

### Picker doesn't load

- Check browser console for CORS errors
- Verify the picker URL is correct
- Ensure Supabase is configured on the FWD side

### Events not received

- Verify you're listening to `message` events on `window`
- Check that the origin check matches `fwd.treytv.com`
- Make sure the event data has `provider: 'fwd'`

## Support

- FWD Dashboard: https://fwd.treytv.com
- Integration Status: https://fwd.treytv.com/integration-status
- Picker Keys: https://fwd.treytv.com/picker-api-keys
