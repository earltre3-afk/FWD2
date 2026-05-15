# FWD Deployment Audit — Second Pass

## Frontend deployment status

- `npm install`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `npm run lint`: PASS with warnings only, no blocking errors
- Vercel SPA routing: READY through `vercel.json`
- Vercel framework: Vite
- Vercel output directory: `dist`

## Second-pass fixes made

1. Removed hardcoded fallback database credentials from `src/lib/supabase.ts`.
   - The app now uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Vercel.
   - If they are missing, the app warns instead of silently connecting to a previous generated database.

2. Added Supabase Edge Function package for picker-domain enforcement.
   - Function path: `supabase/functions/verify-picker-key/index.ts`
   - Migration path: `supabase/migrations/20260515_picker_api_keys_enforcement.sql`
   - Supabase notes: `supabase/README.md`

3. Updated `/embed/picker` to verify the `key` query param before rendering.
   - If verification fails, it shows: “This embed is not allowed on this domain.”
   - It keeps the FWD postMessage contract for successful GIF selections.

4. Updated Picker API Keys page.
   - Removed “Not configured” language.
   - Shows domain/origin protection as active.
   - Embed URLs include `key=`.

5. Replaced the camera simulation with a real browser recording flow.
   - Uses `getUserMedia` and `MediaRecorder`.
   - Records up to 5 seconds.
   - Supports front/back camera switching when supported by the device/browser.
   - Allows preview, retake, and upload.
   - Uploads to the `fwd-uploads` bucket using the same user/date/random path scheme as `UploadDropzone`.
   - Navigates to `/create?mediaUrl=...&type=camera` after upload.
   - Shows the required camera permission denied state and Upload instead fallback.

6. Updated `/create` to accept camera-prefilled media URLs and render video previews.

## Vercel settings

Use these settings in Vercel:

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `.`

## Required Vercel environment variables

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FWD_APP_URL=https://fwd.treytv.com
VITE_FWD_ALLOWED_PARENT_ORIGINS=https://tv.treytrizzy.com,https://treytv.com,https://www.treytv.com,http://localhost:3000,http://localhost:5173
```

## Backend notes

Vercel deploys the frontend only. The database tables, storage bucket, Google OAuth configuration, and Edge Function must be configured in Supabase/DatabasePad separately.

Required backend pieces:

- Auth enabled
- Google OAuth configured
- `profiles`
- `favorites`
- `collections`
- `user_gifs`
- `follows`
- `picker_api_keys`
- `fwd-uploads` storage bucket
- `verify-picker-key` Edge Function deployed

## Known non-blocking warnings

- Vite reports a large JS chunk. This does not block deployment.
- ESLint reports generated-code style warnings such as `any` and fast-refresh export warnings. These do not block deployment.
- `npm audit` reports moderate dev-server advisories through Vite/esbuild. The recommended automatic fix would force a breaking Vite upgrade, so this was left unchanged for deployment stability. This does not affect the production static bundle directly.
