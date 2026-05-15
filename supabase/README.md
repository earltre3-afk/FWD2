# FWD Supabase backend notes

Vercel deploys the FWD frontend only. Apply the SQL migration and deploy the Edge Function separately in Supabase.

## Deploy picker-key verification

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy verify-picker-key --no-verify-jwt
```

The function expects these Supabase-provided secrets to exist in the Edge Function runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Test

```bash
curl -i "https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-picker-key?key=PUBLIC_KEY" \
  -H "Origin: https://treytv.com" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

A valid key with a matching allowed origin returns `200` and `{ "allowed": true }`. Any missing key, unknown key, or unapproved origin returns `403`.
