# FWD × Trey TV — Ecosystem Integration Architecture

## The Core Principle

**FWD and Trey TV are separate public products that work together securely in the background.**

From the outside:
- FWD is its own standalone GIF and reaction platform — own branding, own domain, own users.
- Trey TV is its own standalone entertainment and social platform — own branding, own domain, own users.

From the inside:
- They are connected through a verified shared identity, a secure embedded picker, and a safe usage tracking layer.
- No private database access is shared. No secrets cross the boundary. No app absorbs the other.

---

## Ownership Map

### Trey TV owns
- Trey TV user profiles and authentication
- Trey TV messages, comments, group chats, watch parties
- Trey TV creator channels and feeds
- The **public 16-digit UID** — the canonical cross-platform user identity
- Trey TV OAuth token issuance

### FWD owns
- GIFs, GIF uploads, GIF search
- User favorites and collections
- FWD user profiles
- Picker API keys and allowed origins
- GIF usage records
- The FWD memory reserve (saved/recent/created GIFs per user)

### Shared safely (public data only)
- Public Trey TV UID (16-digit, not internal UUID)
- Public display name
- Public avatar URL
- Public Trey TV profile URL
- Selected GIF payload (id, URL, tags, metadata)
- Safe usage context strings: `message`, `comment`, `group_chat`, `watch_party`, `creator_channel`, `feed_post`

### Never shared
- Service role keys or database passwords
- Internal auth UUIDs used as public identity
- Raw OAuth tokens
- Private emails (unless user explicitly authorizes)
- Admin roles
- Private profile fields
- Any Trey TV private database tables

---

## 1. Shared Public UID Identity

**Trey TV is the authority for the public UID.**

When a user connects their Trey TV account to FWD via "Continue with Trey TV":

1. FWD backend (Edge Function) exchanges the OAuth code for a Trey TV access token server-side.
2. FWD fetches the Trey TV userinfo endpoint to get the **public UID** (not Trey TV's internal database ID).
3. FWD stores only public identity fields:

```
fwd_profiles:
  trey_tv_uid             — public 16-digit UID
  trey_tv_display_name    — mirrored for display
  trey_tv_avatar_url      — public avatar
  trey_tv_profile_url     — public profile link
  identity_provider       — 'trey_tv'
  identity_verified_at    — timestamp of last backend verification
  identity_sync_status    — 'synced' | 'pending' | 'error'
```

FWD never stores Trey TV's internal database UUID as the public user identity.

The FWD profile page shows "Connected to Trey TV — UID: XXXX" only after backend verification.

---

## 2. Continue with Trey TV Login

### What it looks like to the user
- FWD login page shows a "Continue with Trey TV" button.
- Button uses the Trey TV logo (silver script + gold TV).
- Clicking redirects to `https://tv.treytrizzy.com/api/fwd/oauth/authorize`.
- After Trey TV login, user is redirected back to `https://fwd.treytv.com/auth/trey-tv/callback`.
- FWD shows "Connecting to Trey TV…", then either creates a new FWD profile or links to an existing one.

### What happens in the background (never visible to the browser)
```
Browser → FWD /auth/trey-tv/callback
       → FWD calls supabase Edge Function: trey-tv-login-exchange
       → Edge Function exchanges code for access_token (server-side, client_secret never leaves)
       → Edge Function fetches Trey TV userinfo
       → Edge Function upserts fwd_connected_accounts + fwd_profiles
       → Edge Function returns ONLY safe public profile fields
       → Browser never sees the access_token or client_secret
```

### Branding rules
- FWD says: "Continue with Trey TV" / "Connected to Trey TV"
- FWD does NOT say: "Trey TV Login" or "Sign in to Trey TV"
- FWD does NOT rebrand itself as "Trey TV GIFs"

---

## 3. FWD Picker Inside Trey TV

### What it looks like to the Trey TV user
- User taps the "+" (plus) button in a message, comment, group chat, or watch party.
- An app drawer opens. FWD appears as "GIFs & reactions — Powered by FWD".
- User taps FWD.
- FWD picker opens in a bottom sheet or modal (compact mode by default).
- User searches or browses GIFs.
- User taps a GIF.
- GIF attaches to the Trey TV message or comment.
- Picker closes.

### What Trey TV receives
A `postMessage` event with this payload (and only this):
```json
{
  "type": "FWD_GIF_SELECTED",
  "provider": "fwd",
  "source": "trey_tv",
  "usage": {
    "source": "trey_tv",
    "context": "message",
    "userUid": "USER_PUBLIC_UID"
  },
  "gif": {
    "id": "gif_id",
    "title": "Side Eye",
    "mediaUrl": "https://...",
    "previewUrl": "https://...",
    "thumbnailUrl": "https://...",
    "width": 480,
    "height": 480,
    "duration": 2.8,
    "format": "gif",
    "altText": "Side Eye reaction GIF",
    "tags": ["reactions", "shade"]
  }
}
```

Trey TV receives zero FWD private data. FWD receives zero Trey TV private data.

### Embed URL format
```
https://fwd.treytv.com/embed/picker
  ?key=fwd_pk_<PUBLIC_KEY>
  &source=trey_tv
  &context=message          (message|comment|group_chat|watch_party|creator_channel|feed_post)
  &user_uid=<PUBLIC_UID>    (optional — public Trey TV UID for usage attribution)
  &mode=compact             (compact|full)
  &theme=dark               (dark|light)
```

---

## 4. Picker Key Security

Every FWD picker embed is gated by a picker API key verified server-side.

### Flow
```
Trey TV iframe loads /embed/picker?key=fwd_pk_xxx&source=trey_tv
→ FWD calls verify-picker-key Edge Function
→ Edge Function looks up the key in picker_api_keys
→ Checks: is_active = true
→ Checks: requesting Origin is in allowed_origins
→ If all pass → returns { allowed: true }
→ If any fail → picker shows "This embed is not allowed on this domain."
```

### Key properties
```
picker_api_keys:
  public_key        — safe to use in embed URLs (not a secret)
  allowed_origins   — exact-match list (e.g. ["https://tv.treytrizzy.com"])
  app_name          — human label (e.g. "Trey TV")
  is_active         — can be disabled without deleting
```

### How to get a key (for Trey TV)
1. Log into FWD at `https://fwd.treytv.com`
2. Go to Settings → Integrations (or `/settings/integrations`)
3. Create a new key with app name "Trey TV" and origins:
   ```
   https://tv.treytrizzy.com
   https://treytv.com
   ```
4. Copy the public key into the Trey TV embed configuration.

---

## 5. Safe Usage Tracking

When Trey TV users pick a GIF, FWD tracks usage through the `fwd-track-gif-use` Edge Function.

### Trey TV sends (POST to FWD Edge Function)
```json
{
  "key": "fwd_pk_<PUBLIC_KEY>",
  "gif_id": "gif_abc123",
  "source_platform": "trey_tv",
  "context": "message",
  "trey_tv_uid": "USER_PUBLIC_UID"
}
```

### FWD validates and stores
- Verifies the picker key + origin before accepting any data.
- Validates `trey_tv_uid` is a public-format UID (not a UUID-shaped internal ID).
- Validates `context` against a known-safe allowlist.
- Stores in `fwd_gif_use_log` — never any private Trey TV fields.
- Also writes to `fwd_trey_tv_uses` for backward compatibility.

### Trey TV's privacy guarantee
- FWD never receives Trey TV message content, user emails, or private profile data.
- FWD never receives Trey TV session tokens.
- Only the public UID and a context label are shared.

---

## 6. User Memory Reserve

Every FWD user (signed in) gets a persistent memory reserve:

```
fwd_user_memory:
  recent_gif_ids    — last 50 GIFs used on ANY integrated platform
  saved_gif_ids     — explicitly favorited GIFs
  created_gif_ids   — GIFs the user uploaded
  last_seen_by      — { "fwd": "timestamp", "trey_tv": "timestamp" }
  preferences       — per-user display/theme settings
```

The memory is portable — if a user uses FWD from within Trey TV, their recents and saved GIFs follow them when they visit `fwd.treytv.com` directly.

---

## 7. Branding Rules

| Surface | Correct copy |
|---|---|
| FWD login page | "Continue with Trey TV" |
| FWD profile page | "Connected to Trey TV" |
| Trey TV plus-button drawer | "GIFs & reactions · Powered by FWD" |
| Inside FWD picker in Trey TV | FWD logo + "Powered by FWD" footer |
| Trey TV confirmation after GIF pick | "Sent with FWD" (optional) |

**Never:**
- Rename FWD to "Trey TV GIFs"
- Make FWD look like a Trey TV page
- Make Trey TV look like a FWD app
- Describe the apps as one merged product

---

## 8. Future App Integrations

Any app — not just Trey TV — can integrate FWD using the same pattern:

1. **Register** — create a picker key at `/settings/integrations`, add your origin.
2. **Embed** — iframe `/embed/picker?key=YOUR_KEY&source=YOUR_APP`.
3. **Listen** — handle `FWD_GIF_SELECTED` postMessage events.
4. **Track** (optional) — POST to `fwd-track-gif-use` Edge Function with your picker key.

No direct database access. No service role keys. No private data.

---

## 9. Data Flow Summary

```
┌─────────────────────────┐          ┌──────────────────────────┐
│         FWD             │          │        Trey TV           │
│  fwd.treytv.com         │          │  tv.treytrizzy.com       │
│                         │          │                          │
│  • GIFs                 │          │  • Users & profiles      │
│  • Favorites            │  PUBLIC  │  • Messages & comments   │
│  • Collections          │◄────────►│  • Creator channels      │
│  • Picker keys          │   DATA   │  • Public UID authority  │
│  • Usage logs           │   ONLY   │  • OAuth token issuance  │
│  • FWD profiles         │          │                          │
│  • Memory reserve       │          │                          │
└─────────────────────────┘          └──────────────────────────┘
          ▲                                       ▲
          │         SECURE INTEGRATION LAYER      │
          │                                       │
          ▼                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Edge Functions                     │
│                                                             │
│  trey-tv-login-exchange   — OAuth code exchange (no secret  │
│                             ever reaches the browser)       │
│                                                             │
│  verify-picker-key        — origin + key validation         │
│                                                             │
│  fwd-track-gif-use        — safe usage ingestion            │
│                             (key-verified, no private data) │
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: 2026-05-15*
*This document is the source of truth for FWD × Trey TV integration decisions.*
