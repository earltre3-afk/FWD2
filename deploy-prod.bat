@echo off
echo === FWD Vercel Production Deploy ===
cd /d "C:\Users\info\fwd-vercel-second-pass-ready - Copy"
echo Deploying prebuilt output to production (skips pnpm build)...
vercel deploy --prebuilt --prod
echo.
echo === Verifying assetlinks.json ===
curl -s https://fwd.treytv.com/.well-known/assetlinks.json
echo.
pause
