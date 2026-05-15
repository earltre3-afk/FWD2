# FWD

FWD is a standalone futuristic GIF, reaction, meme, and short-loop app with upload, camera capture, favorites, collections, profiles, and an embeddable picker route.

## Vercel deployment

This project is a Vite React app and is ready for Vercel.

Recommended Vercel settings:

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `.`

The included `vercel.json` handles SPA rewrites so direct routes such as `/camera`, `/create`, `/profile`, and `/embed/picker` do not 404 on refresh.

## Environment variables

Copy `.env.example` into Vercel Project Settings > Environment Variables.

Required for production auth/database/storage behavior:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FWD_APP_URL=https://fwd.treytv.com
VITE_FWD_ALLOWED_PARENT_ORIGINS=https://tv.treytrizzy.com,https://treytv.com,https://www.treytv.com,http://localhost:3000,http://localhost:5173
```

The app currently includes fallback public database credentials from the source export so the Famous.ai preview can keep working. For production, set the Vercel variables above and manage the database/backend from the database provider dashboard.

## Local check

```bash
npm install
npm run build
npm run lint
```

## Main routes

- `/` landing
- `/home` app home
- `/login` login route
- `/signup` signup route
- `/create-profile` profile setup route
- `/create` GIF creator
- `/camera` camera capture
- `/favorites` favorites
- `/collections` collections
- `/discover` follow/discover
- `/profile` account profile
- `/settings/picker-keys` picker key manager
- `/embed/picker` embeddable FWD picker
- `/demo` plus-button app drawer demo

## Backend notes

The uploaded backend export contains database tables, storage policy definitions, and bundled functions. Vercel deploys the frontend only. Database tables, storage bucket `fwd-uploads`, auth providers, and edge/database functions must be configured in the database provider separately.

For Google OAuth, configure the app URL and redirect URLs in the auth provider dashboard after the Vercel domain is live.
