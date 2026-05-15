# Trey TV OAuth — Live Configuration Guide

This document covers every step to make "Continue with Trey TV" fully functional
in the live FWD production environment (`https://fwd.treytv.com`).

---

## 1. Register FWD as an OAuth Application on Trey TV

On the Trey TV admin / developer console (`https://tv.treytrizzy.com`):

1. Go to **Developer Settings → OAuth Apps → New Application**
2. Fill in:
   - **App name**: `FWD`
   - **Homepage URL**: `https://fwd.treytv.com`
   - **Redirect URI (callback URL)**:
     ```
     https://fwd.treytv.com/auth/trey-tv/callback
     ```
     ⚠️ This must match `VITE_FWD_TREY_TV_REDIRECT_URI` **exactly**.
3. Copy the generated:
   - **Client ID** → `TREY_TV_OAUTH_CLIENT_ID`
   - **Client Secret** → `TREY_TV_OAUTH_CLIENT_SECRET` *(never put this in frontend code)*

---

## 2. Set Vercel Environment Variables (Frontend)

In **Vercel → fwd-vercel-second-pass-ready → Settings → Environment Variables**,
add these to the **Production** environment:

| Variable | Value |
|---|---|
| `VITE_TREY_TV_AUTH_URL` | `https://tv.treytrizzy.com` |
| `VITE_TREY_TV_OAUTH_CLIENT_ID` | `<client_id from step 1>` |
| `VITE_FWD_TREY_TV_REDIRECT_URI` | `https://fwd.treytv.com/auth/trey-tv/callback` |

**Do NOT add** `TREY_TV_OAUTH_CLIENT_SECRET` here. It must only go in Supabase.

After adding, trigger a **Redeploy** (or push a new commit) for the values to take effect.

---

## 3. Set Supabase Edge Function Secrets (Backend)

The `trey-tv-login-exchange` Edge Function needs server-side secrets.

Run these in your terminal (from the project root, with Supabase CLI logged in):

```bash
supabase secrets set TREY_TV_AUTH_URL=https://tv.treytrizzy.com
supabase secrets set TREY_TV_OAUTH_CLIENT_ID=<your_client_id>
supabase secrets set TREY_TV_OAUTH_CLIENT_SECRET=<your_client_secret>
```

Verify they're set:
```bash
supabase secrets list
```

---

## 4. Deploy the Edge Function

```bash
supabase functions deploy trey-tv-login-exchange --no-verify-jwt
```

The `--no-verify-jwt` flag is required because this function is called
from the browser (not with a Supabase auth token — the whole point is that
the user isn't logged in yet when they hit this function).

---

## 5. Run the Database Migrations

Apply the two new migrations to your Supabase database:

```bash
supabase db push
```

Or run them manually in the Supabase Dashboard → SQL Editor:

1. `supabase/migrations/20260515_trey_tv_login_bridge.sql`
   - Creates `fwd_connected_accounts` table
   - Adds `connected_trey_tv_uid` and `login_provider` to `fwd_profiles`

2. `supabase/migrations/20260515_fwd_user_memory.sql`
   - Creates `fwd_user_memory` and `fwd_memory_events` tables
   - Provisions memory row on user sign-up
   - Registers `fwd_record_gif_use` RPC function

---

## 6. Test End-to-End

1. Visit `https://fwd.treytv.com/login`
2. Click **Continue with Trey TV**
3. You should be redirected to `https://tv.treytrizzy.com/api/fwd/oauth/authorize?...`
4. Log in on Trey TV
5. You should be redirected back to `https://fwd.treytv.com/auth/trey-tv/callback?code=...&state=...`
6. FWD shows "Connecting to Trey TV…"
7. If it's a new user → redirected to `/create-profile` prefilled with Trey TV data
8. If existing linked user → redirected to `/profile`

---

## 7. Future: Full Supabase Auth Session

Currently the Trey TV login bridge:
- ✅ Validates the OAuth code server-side
- ✅ Fetches the Trey TV user profile
- ✅ Creates/updates `fwd_connected_accounts`
- ⏳ Does NOT yet mint a full Supabase Auth session for Trey-TV-only users

To complete this, choose one of:

**Option A — Magic Link (simplest)**
After the exchange, if the Trey TV user has an email, send them a Supabase magic link:
```ts
await supabase.auth.signInWithOtp({ email: treyUser.email })
```

**Option B — Custom JWT (most seamless)**
Have Supabase issue a custom access token for the linked user, allowing a full
`session` without a separate email step. Requires a custom auth server/middleware.

**Option C — Wait for Supabase OIDC Federation**
Supabase is adding native OIDC provider federation — once available, Trey TV
can be registered as an OIDC provider directly in Supabase.

---

## 8. Future URL Support

When Trey TV moves to `https://treytv.com`, update:

**Vercel env:**
```
VITE_TREY_TV_AUTH_URL=https://treytv.com
```

**Supabase secret:**
```bash
supabase secrets set TREY_TV_AUTH_URL=https://treytv.com
```

No code changes needed — the URL is fully driven by env vars.
