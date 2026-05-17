# AI GIF Scout

AI GIF Scout expands a user's GIF search into safer, more specific provider searches, calls official GIF APIs in parallel, and promotes results from searches that return fewer than 10 provider items.

When GIPHY/Tenor keys are not configured, AI GIF Scout still works against the existing FWD GIF library. It uses the AI-expanded phrases to search local FWD GIFs and the normal reaction scout fallback, then labels those picks as FWD library results. No open-web scraping is used.

Search uses an endless scroll model. The app keeps loading provider/API pages where available, then rotates through the existing FWD library and fallback reactions so the user never reaches a hard end state.

## Server Routes

- `POST /api/ai/gif-scout`
  - Body: `{ "query": string, "context"?: string, "limit"?: number }`
  - Uses Vercel AI Gateway when available.
  - Falls back to heuristic search phrases if AI is unavailable.
- Searches GIPHY and/or Tenor with server-only keys.
- If no provider keys are configured, the client surfaces FWD library picks from the same scouted phrases.
  - Returns `rareResults`, `regularResults`, `scoutedQueries`, and safe provider error codes.

- `POST /api/gifs/save`
  - Requires a Supabase user access token in `Authorization: Bearer <token>`.
  - Saves selected provider metadata into `saved_gifs`.
  - Uses `user_id + provider + provider_gif_id` to avoid duplicate saves.

## Environment

Server-only:

```bash
TENOR_API_KEY=
GIPHY_API_KEY=
AI_GIF_SCOUT_ENABLED=true
SUPABASE_SERVICE_ROLE_KEY=
VERCEL_AI_API_KEY=
```

Do not prefix provider keys, service role keys, or AI keys with `VITE_`.

## QA Checklist

- AI Scout returns rare results when a provider query returns fewer than 10 results.
- Normal GIF search still works if AI fails.
- Provider search works with only GIPHY or only Tenor configured.
- AI Scout still shows useful FWD library picks when no GIPHY/Tenor keys are configured.
- Search keeps appending results as the user scrolls and does not show an end-of-results state.
- Selected GIF saves to Supabase through `/api/gifs/save`.
- Selected GIF appears in the signed-in user's saved library/profile library after save.
- Selected GIF can be opened from create/search flows and used in a FWD.
- Selected/scouted GIF previews use `FwdMediaPlayer` with MP4/WebM preferred and GIF fallback for mobile Safari.
- Signed-in users cannot see another user's private saved GIFs because `saved_gifs` RLS limits rows to `auth.uid() = user_id`.
- Provider API keys are not exposed in the browser bundle.
- Duplicate GIF saves are handled cleanly by `user_id, provider, provider_gif_id`.
- No random web scraping is used.
- Public share pages still use existing public `fwd_gifs` behavior.
