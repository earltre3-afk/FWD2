# Mobile Safari Media QA Checklist

Run this checklist on every release that touches `FwdMediaPlayer`, `FwdAnimatedGif`, or any page that renders GIFs/videos.

---

## Devices & browsers to test

| Device | Browser | Min OS |
|--------|---------|--------|
| iPhone (any model) | Safari | iOS 15 |
| iPhone (any model) | Chrome for iOS | iOS 15 |
| iPad | Safari | iPadOS 15 |
| Mac | Safari | macOS 12 |
| Android | Chrome | Android 10 |
| Desktop | Chrome | latest |
| Desktop | Firefox | latest |

---

## Checklist

### 1 — Autoplay (muted loop)

- [ ] GIFs on the Feed start playing automatically without user interaction on Mobile Safari
- [ ] GIFs on Discover start playing automatically without user interaction on Mobile Safari
- [ ] GIF on GifDetail starts playing automatically
- [ ] GIF on the public Share page (`/s/:id`) starts playing automatically (signed-out visitor)
- [ ] GIF thumbnails in GifCard grid start playing automatically

### 2 — Tap-to-play fallback

- [ ] When autoplay is suppressed (e.g., Low Power Mode on iOS), a **Tap to play** overlay appears over the video
- [ ] Tapping the overlay starts playback
- [ ] After tapping, the overlay disappears and the video loops

### 3 — Visibility & background recovery

- [ ] Switching the tab away and returning resumes playback on blocked videos
- [ ] Locking the phone and unlocking resumes playback
- [ ] Sending the app to background on iPhone and returning resumes playback

### 4 — Viewport-based play / pause

- [ ] Videos that scroll out of view pause (not just muted — actually paused)
- [ ] Videos that scroll back into view resume without user interaction

### 5 — Format & source ordering

- [ ] If a `mp4Url` prop is provided, the browser loads the MP4, not the WebM
- [ ] If only `webmUrl` is provided, the browser falls back to WebM
- [ ] If only `gifUrl` pointing to a `.gif` is provided, it renders as `<img>` on non-Safari and as `<video>` (after `.gif → .mp4` swap) on Safari for known CDNs (giphy, tenor)

### 6 — Error & unsupported states

- [ ] If a video URL 404s, the poster image is shown (if available), otherwise the "This FWD can't play in this browser yet." message appears
- [ ] The error state does not crash the page or throw an uncaught exception
- [ ] A broken 1×1 pixel placeholder GIF triggers `onError` (GifCard removes itself, GifDetail shows nothing)

### 7 — Blob URL lifecycle (CreateGif / CameraCapture)

- [ ] Recording a clip → retaking → recording again does not leak blob URLs (check DevTools memory)
- [ ] Navigating away from CreateGif revokes the preview blob URL
- [ ] `useClip` in CameraCapture revokes the preview blob before creating the navigation blob URL
- [ ] The blob URL passed to `/create` via router state is revoked by CreateGif after the GIF is uploaded

### 8 — Public Share page (signed-out)

- [ ] `/s/:id` loads without authentication
- [ ] The GIF plays on Mobile Safari without sign-in
- [ ] The "Forward this FWD" share button works on iOS (uses native share sheet when available)
- [ ] "Join FWD" / "Sign in" CTAs render correctly for unauthenticated visitors

---

## Notes

- `FwdMediaPlayer` uses `display: contents` on its wrapper div in the normal (no-overlay) state so the `<video>` or `<img>` element receives `className`/`style` directly — layout is identical to the old `FwdAnimatedGif` in those states.
- The `muted` and `playsInline` attributes are set both declaratively (JSX) and imperatively (`useEffect`) because Safari can lose these attributes across hydration.
- `preload="metadata"` is used when `lazy={true}` to avoid downloading the full video before it's near the viewport.
- The `IntersectionObserver` threshold is `0.2` — adjust in `FwdMediaPlayer.tsx` if pause/resume behaviour feels off in dense feed layouts.
