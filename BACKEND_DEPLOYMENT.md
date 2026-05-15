# FWD Backend Deployment Guide

This guide explains how to configure the Supabase backend for the FWD app.

## Overview

The FWD app is a standalone GIF/reaction platform with these backend components:
- **Supabase Auth**: Email/password and Google OAuth authentication
- **Supabase Storage**: `fwd-uploads` bucket for GIF/video uploads
- **Supabase Database**: Tables for profiles, GIFs, favorites, collections, picker API keys
- **Supabase Edge Function**: `verify-picker-key` for embed picker security

---

## 1. Supabase Project Requirements

### Required Setup

1. **Create a Supabase project** at https://supabase.com
2. **Enable Auth** in Authentication settings
3. **Get your API credentials** from Settings > API:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon/public key - safe for frontend)
   - `SUPABASE_SERVICE_ROLE_KEY` (service role - server-side only, never expose to frontend)

### Auth Configuration

Enable these auth providers in Supabase Dashboard > Authentication > Providers:

- **Email provider**: Enabled (default)
- **Google OAuth**: Optional - see section 4 for setup

---

## 2. Required Vercel Environment Variables

Add these in Vercel Project Settings > Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Yes |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | Yes |
| `VITE_FWD_APP_URL` | `https://fwd.treytv.com` | Yes |
| `VITE_FWD_ALLOWED_PARENT_ORIGINS` | `https://tv.treytrizzy.com,https://treytv.com,https://www.treytv.com,http://localhost:3000,http://localhost:5173` | Yes |

**Important**: Never add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. It must only be used in Edge Functions (server-side).

---

## 3. Supabase Auth Redirect URLs

Configure redirect URLs in Supabase Dashboard > Authentication > URL Configuration:

### Local Development
```
http://localhost:5173
http://localhost:5173/login
http://localhost:5173/create-profile
```

### Production
```
https://fwd.treytv.com
https://fwd.treytv.com/login
https://fwd.treytv.com/create-profile
https://fwd.treytv.com/profile
```

**Note**: If using a different local port, add that port's redirect URLs to match your dev server.

---

## 4. Google OAuth Setup (Optional)

To enable Google sign-in:

1. **Enable Google provider** in Supabase Dashboard > Authentication > Providers > Google
2. **Get Google OAuth credentials**:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 credentials (Web application)
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. **Add credentials to Supabase**:
   - Client ID → `Google Client ID` field
   - Client Secret → `Google Client Secret` field
4. **Important**: Never put Google OAuth secrets in frontend code

---

## 5. Storage Setup

### Create the Storage Bucket

Create a bucket named: `fwd-uploads`

### Bucket Configuration

- **Public bucket**: Yes (the app uses public URLs for uploaded media)
- **Allowed MIME types**:
  - `image/gif`
  - `image/png`
  - `image/jpeg`
  - `image/webp`
  - `video/webm`
  - `video/mp4`
  - `video/quicktime`

- **Max file size**: 25MB (configurable in code at `UploadDropzone.tsx` and `CameraCapture.tsx`)

### Upload Path Scheme

Files are stored with this path pattern:
```
{user_id}/{timestamp}-{random}.{ext}
```

Example: `550e8400-e29b-41d4-a716-446655440000/1699900000000-a1b2c3d.gif`

---

## 6. Edge Function Setup

### Deploy the verify-picker-key Function

```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy verify-picker-key --no-verify-jwt
```

### Function Environment Variables

The Edge Function automatically receives these from Supabase runtime:
- `SUPABASE_URL` (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

### What the Function Checks

The `verify-picker-key` function validates:
1. `key` query parameter is present
2. `Origin` header is present and matches `allowed_origins` in `picker_api_keys` table
3. The key exists in `picker_api_keys` table
4. The key is active (`is_active = true`)

Returns:
- `200` with `{ "allowed": true }` for valid requests
- `403` for invalid key or unauthorized origin
- `400` for missing key parameter

---

## 7. Database Migration Order

Apply migrations in this order:

### 1. Profiles and Auth Support
```sql
-- fwd_profiles table
-- Enables user profiles with display names, usernames, avatars
```

### 2. GIF Tables
```sql
-- fwd_gifs table
-- Stores uploaded GIF metadata and URLs
```

### 3. Favorites and Collections
```sql
-- fwd_favorites table
-- User GIF favorites

-- fwd_collections table
-- User-created GIF collections

-- fwd_collection_items table
-- Items within collections
```

### 4. Picker API Keys
```sql
-- picker_api_keys table
-- API keys for external embed access
```

### 5. Trey TV Integration
```sql
-- fwd_trey_tv_uses table
-- Tracks GIF usage in Trey TV platform
```

### 6. Storage Policies
```sql
-- Storage bucket policies for fwd-uploads
```

### 7. RLS Policies
```sql
-- Row Level Security policies for all tables
```

---

## 8. Testing Checklist

After deployment, test:

- [ ] User can sign up with email/password
- [ ] User can sign in with existing account
- [ ] User can upload a GIF via UploadDropzone
- [ ] User can record via CameraCapture and upload
- [ ] User can favorite a GIF
- [ ] User can create a collection
- [ ] User can add GIF to collection
- [ ] Embed picker validates key correctly
- [ ] Embed picker blocks unauthorized domains

---

## Security Notes

- **Never expose service role keys** in frontend code
- **Never hardcode Supabase secrets** in git
- **Always use RLS policies** to protect user data
- **Validate picker keys** before allowing embed access
- **Use environment variables** for all sensitive configuration

---

## Support

For issues with:
- **Vercel deployment**: Check Vercel dashboard logs
- **Supabase backend**: Check Supabase dashboard logs
- **Edge Functions**: Check Supabase Functions logs in dashboard
