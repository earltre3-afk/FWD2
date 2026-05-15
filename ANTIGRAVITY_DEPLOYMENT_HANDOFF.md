# FWD Antigravity Deployment Handoff

**For**: Next developer/agent (Antigravity team)  
**Project**: FWD - Standalone GIF/Reaction Platform  
**Frontend URL**: https://fwd.treytv.com  
**Embed Path**: https://fwd.treytv.com/embed/picker

---

## What is FWD?

FWD is a standalone GIF/reaction app that lets users:
- Upload GIFs, videos, and images
- Record quick 5-second clips via camera
- Organize favorites and collections
- Create and share reactions
- Embed as a picker/add-on in Trey TV

It is **not** part of Trey TV directly - it's a standalone service that Trey TV can embed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  React App  │  │  /embed/    │  │  CameraCapture  │  │
│  │  (Main UI)  │  │  picker     │  │  UploadDropzone │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                          │
│  Environment Variables:                                  │
│  - VITE_SUPABASE_URL                                     │
│  - VITE_SUPABASE_ANON_KEY                                │
│  - VITE_FWD_APP_URL                                      │
│  - VITE_FWD_ALLOWED_PARENT_ORIGINS                       │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP / REST
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase (Backend)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   Auth   │  │ Database │  │ Storage  │  │  Edge   │ │
│  │          │  │  (SQL)   │  │ (Files)  │  │ Function│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                          │
│  Service Role Key: ONLY for Edge Functions             │
│  Anon Key: Safe for frontend                             │
└─────────────────────────────────────────────────────────┘
```

---

## 1. What Frontend Deploys on Vercel

The Vercel deployment includes:
- React SPA with Vite
- All routes (SPA routing via `vercel.json`)
- `/embed/picker` for Trey TV integration
- CameraCapture and UploadDropzone components

### Vercel Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Root Directory | `.` |

### Required Vercel Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FWD_APP_URL=https://fwd.treytv.com
VITE_FWD_ALLOWED_PARENT_ORIGINS=https://tv.treytrizzy.com,https://treytv.com,https://www.treytv.com,http://localhost:3000,http://localhost:5173
```

---

## 2. What Backend Must Be Configured in Supabase

### Database Tables (see `supabase/migrations/20260515_fwd_full_schema.sql`)

1. **fwd_profiles** - User profiles (display_name, username, avatar, bio)
2. **fwd_gifs** - GIF metadata (title, media_url, tags, visibility)
3. **fwd_favorites** - User's favorited GIFs
4. **fwd_collections** - User-created GIF collections
5. **fwd_collection_items** - GIFs within collections
6. **picker_api_keys** - API keys for embed picker access
7. **fwd_trey_tv_uses** - Tracks GIF usage in Trey TV

### Storage Bucket

- **Name**: `fwd-uploads`
- **Public**: Yes (uses public URLs)
- **Max file size**: 25MB
- **Allowed MIME types**: image/gif, image/png, image/jpeg, image/webp, video/webm, video/mp4, video/quicktime

### Edge Function

- **Name**: `verify-picker-key`
- **Deploy**: `supabase functions deploy verify-picker-key --no-verify-jwt`
- **Purpose**: Validates picker key + origin for embed security

### Auth Configuration

**Redirect URLs** (Authentication > URL Configuration):
```
http://localhost:5173
http://localhost:5173/login
http://localhost:5173/create-profile
https://fwd.treytv.com
https://fwd.treytv.com/login
https://fwd.treytv.com/create-profile
https://fwd.treytv.com/profile
```

**Providers**:
- Email: Enabled (default)
- Google OAuth: Optional (requires Google Cloud setup)

---

## 3. Migration Order

Apply migrations in Supabase SQL Editor in this order:

1. `20260515_fwd_full_schema.sql` - Full schema with all tables, RLS policies, storage policies
2. `20260515_picker_api_keys_enforcement.sql` - Additional picker key indexes (if not in main schema)

Or apply via CLI:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

---

## 4. How to Test

### Test Auth

1. Go to `/signup` - create account with email/password
2. Check email for confirmation (if enabled)
3. Sign out and sign back in at `/login`
4. Check profile is created at `/profile`

### Test Upload

1. Go to `/create`
2. Use UploadDropzone to upload a GIF
3. Verify file appears in `fwd-uploads` bucket in Supabase Dashboard
4. Verify `fwd_gifs` row is created

### Test Camera

1. Go to `/camera`
2. Allow camera access
3. Record a 5-second clip
4. Click "Use Clip"
5. Verify upload to `fwd-uploads` and redirect to `/create`

### Test Picker Key Enforcement

1. Create a picker API key at `/picker-api-keys`
2. Add allowed origin: `http://localhost:3000`
3. Test embed:
   ```html
   <iframe src="https://fwd.treytv.com/embed/picker?key=YOUR_KEY&mode=compact"></iframe>
   ```
4. Verify it shows "Checking embed access..." then loads
5. Test with wrong key - should show "This embed is not allowed"
6. Test with key but wrong origin - should be blocked

### Test Embedded Picker as Add-on

Embed in Trey TV or test HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>FWD Picker Test</title>
</head>
<body>
  <h1>Test Embed</h1>
  <button onclick="openPicker()">Open FWD Picker</button>
  
  <script>
    function openPicker() {
      const picker = window.open(
        'https://fwd.treytv.com/embed/picker?key=YOUR_KEY&source=test&mode=compact',
        'fwd-picker',
        'width=500,height=600'
      );
    }
    
    // Listen for selections
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'FWD_GIF_SELECTED') {
        console.log('Selected GIF:', e.data.gif);
      }
      if (e.data?.type === 'FWD_PICKER_CLOSED') {
        console.log('Picker closed');
      }
      if (e.data?.type === 'FWD_PICKER_ERROR') {
        console.error('Picker error:', e.data.message);
      }
    });
  </script>
</body>
</html>
```

---

## 5. What NOT To Do

❌ **Never expose secrets**:
- Don't put `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- Don't hardcode any Supabase keys in git
- Don't log sensitive credentials

❌ **Never remove picker enforcement**:
- The `/embed/picker` route MUST verify the key via `verify-picker-key` Edge Function
- Don't skip the origin check
- Don't allow any domain by default

❌ **Never fake login/upload success**:
- Don't mock auth responses that pretend to succeed
- Don't show fake "upload complete" without actual storage upload
- Don't bypass RLS policies

❌ **Never merge FWD into Trey TV directly**:
- FWD is a standalone service
- Trey TV should embed FWD via iframe/postMessage
- Don't copy FWD code into Trey TV repo

❌ **Never disable RLS**:
- All tables must have RLS enabled
- Policies must be restrictive (user can only access own data)
- Public content should be explicitly marked `visibility = 'public'`

---

## 6. File Locations

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client initialization |
| `src/pages/CameraCapture.tsx` | Camera recording component |
| `src/components/UploadDropzone.tsx` | File upload component |
| `src/pages/EmbedPicker.tsx` | Embed picker interface |
| `src/pages/PickerKeys.tsx` | API key management |
| `supabase/migrations/20260515_fwd_full_schema.sql` | Database schema |
| `supabase/functions/verify-picker-key/index.ts` | Edge Function |
| `vercel.json` | Vercel deployment config |
| `.env.example` | Environment variable template |
| `BACKEND_DEPLOYMENT.md` | Detailed backend setup guide |

---

## 7. Quick Reference Commands

```bash
# Deploy Edge Function
supabase functions deploy verify-picker-key --no-verify-jwt

# Apply migrations
supabase db push

# Local development
npm install
npm run dev

# Production build
npm run build
```

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth not working | Check redirect URLs in Supabase Auth settings |
| Uploads failing | Verify `fwd-uploads` bucket exists and is public |
| Picker blocked | Check `picker_api_keys` table and `allowed_origins` |
| CORS errors | Add origin to `VITE_FWD_ALLOWED_PARENT_ORIGINS` |
| Camera not working | Ensure HTTPS (required for getUserMedia) |

---

## 9. Contact / Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **FWD Repo**: See project root for full codebase

---

**Last Updated**: 2024-05-15  
**Build Status**: ✅ Passing  
**Deployment Ready**: Yes (pending Supabase backend setup)
