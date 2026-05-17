# Mobile Safari Media QA Checklist

Run this checklist on every release that touches `FwdMediaPlayer`, `FwdAnimatedGif`, CreateGif, CameraCapture, or any page that renders GIFs/videos.

## Devices And Browsers

| Device | Browser | Min OS |
|--------|---------|--------|
| iPhone | Safari | iOS 15 |
| iPhone | Chrome for iOS | iOS 15 |
| iPad | Safari | iPadOS 15 |
| Mac | Safari | macOS 12 |
| Android | Chrome | Android 10 |
| Desktop | Chrome | latest |
| Desktop | Firefox | latest |

## Checklist

### 1 - Autoplay

- [ ] GIFs on the Feed start playing automatically without user interaction on Mobile Safari
- [ ] GIFs on Discover start playing automatically without user interaction on Mobile Safari
- [ ] GIF on GifDetail starts playing automatically
- [ ] GIF on the public Share page (`/f/:id`) starts playing automatically for a signed-out visitor
- [ ] GIF thumbnails in GifCard grid start playing automatically

### 2 - Tap-To-Play Fallback

- [ ] When autoplay is suppressed, a Tap to play overlay appears over the video
- [ ] Tapping the overlay starts playback
- [ ] After tapping, the overlay disappears and the video loops

### 3 - Visibility Recovery

- [ ] Switching the tab away and returning resumes playback on blocked videos
- [ ] Locking the phone and unlocking resumes playback
- [ ] Sending the app to background on iPhone and returning resumes playback

### 4 - Viewport Play/Pause

- [ ] Videos that scroll out of view pause
- [ ] Videos that scroll back into view resume without user interaction

### 5 - Format And Source Ordering

- [ ] If `mp4Url` is provided, the browser loads MP4 before WebM
- [ ] If only `webmUrl` is provided, non-Safari browsers fall back to WebM
- [ ] If `gifUrl` points to a real `.gif`, it renders with a plain `<img>`
- [ ] Known GIF CDN `.gif` URLs can use the Safari MP4 swap when available
- [ ] `thumbnail_url`, `still_url`, and `preview_url` are poster/fallback fields, not the main animated source

### 6 - Error And Unsupported States

- [ ] If a video URL 404s, the poster image is shown when available
- [ ] If no poster is available, the user sees a clean playback message
- [ ] The error state does not crash the page
- [ ] A broken 1x1 placeholder GIF triggers `onError`

### 7 - Blob URL Lifecycle

- [ ] Recording a clip, retaking, and recording again does not leak blob URLs
- [ ] Navigating away from CreateGif revokes the preview blob URL
- [ ] CameraCapture creates a fresh navigation blob URL for `/create`
- [ ] The blob URL passed to `/create` is revoked by CreateGif after upload
- [ ] After conversion, the CreateGif preview uses the generated animated GIF blob, not the recorded video poster
- [ ] No `blob:` URL is saved in `gif_url`, `media_url`, or `source_video_url`

### 8 - User-Created GIF Pipeline

- [ ] Create a GIF from a 10-second iPhone Safari recording
- [ ] Confirm preview animates before save
- [ ] Save it to library
- [ ] Confirm library card animates
- [ ] Open feed and confirm the created GIF animates
- [ ] Open public `/f/:id` and confirm it animates
- [ ] Open profile grid and confirm it animates
- [ ] Refresh the page and confirm it still animates
- [ ] Sign out and open the public share link and confirm it animates if public
- [ ] Confirm normal external/search GIFs still animate

### 9 - Public Share Page

- [ ] `/f/:id` loads without authentication
- [ ] The GIF plays on Mobile Safari without sign-in
- [ ] The Forward this FWD share button works on iOS
- [ ] Join FWD and Sign in CTAs render correctly for unauthenticated visitors

## Notes

- `FwdMediaPlayer` keeps real GIF files on a plain `<img>` path so Safari does not receive an optimized still frame.
- Muted loop videos set `muted`, `playsInline`, and `webkit-playsinline` both declaratively and imperatively for Safari.
- `preload="metadata"` is used for lazy video previews.
- Created FWDs save `gif_url` as the animated GIF, `thumbnail_url`/`still_url` as poster-only fields, and `source_video_url` as an optional compatibility fallback.
