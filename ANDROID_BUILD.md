# FWD Android Build Guide

This guide provides instructions on how to build, sync, and release the FWD app for Android using Capacitor.

## Prerequisites
- Node.js & npm
- Android Studio installed and configured with Android SDK 35+
  - *If your Android SDK is missing, open Android Studio once and install the Android SDK through Android Studio > SDK Manager.*
- Capacitor CLI (`npm install -g @capacitor/cli`)
- Java Development Kit (JDK) 17. 
  - Ensure the `JAVA_HOME` environment variable is correctly set to your JDK path (e.g. `C:\Program Files\Microsoft\jdk-17...` or your Android Studio `jbr` folder).

## Local Development & Sync

Whenever you make changes to the web app (`src/`), follow these steps to build and sync the changes to the Android native project:

1. **Build the production web app:**
   ```bash
   npm run build
   ```

2. **Sync changes to Android:**
   ```bash
   npx cap sync android
   ```

3. **Run in Development (Live Reload):**
   *(Optional)* If you want to use live reload with an Android device:
   ```bash
   npx cap run android -l --external
   ```

## Opening Android Studio

To open the Android project in Android Studio for native debugging, configuration, or signing:

```bash
npx cap open android
```

## Debug APK

To build a debug APK directly from the command line without opening Android Studio:

```bash
cd android
./gradlew assembleDebug
```
The resulting APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Release AAB (Google Play)

To generate an Android App Bundle (`.aab`) ready for publishing on Google Play, you need to sign the app.

1. **Sync your latest changes:**
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Open Android Studio:**
   ```bash
   npx cap open android
   ```

3. **Generate Signed Bundle:**
   - In Android Studio, go to **Build** > **Generate Signed Bundle / APK...**
   - Select **Android App Bundle**.
   - Create a new keystore or use an existing one for `com.treytv.fwd`.
   - Complete the wizard.

Alternatively, from the command line (if your `build.gradle` is configured with a release signing config):

```bash
cd android
./gradlew bundleRelease
```
The release bundle will be available at `android/app/build/outputs/bundle/release/app-release.aab`.

## Supabase Auth Configuration

For Android deep linking to work correctly during OAuth, magic link, and signup confirmation:
1. Go to your Supabase project dashboard -> Authentication -> URL Configuration.
2. Under "Redirect URLs", ensure you add both of these values:
   - `https://fwd.treytv.com/auth/callback`
   - `com.treytv.fwd://auth/callback`

## Android App Links (assetlinks.json)

To ensure Android opens `https://fwd.treytv.com` deep links seamlessly without showing the "Open with" browser disambiguation dialog, you must configure Android App Links.

1. Find the `public/.well-known/assetlinks.json` file.
2. Replace `"YOUR_SHA256_CERTIFICATE_FINGERPRINT_HERE"` with your actual release certificate SHA-256 fingerprint.
3. Deploy this file so it's accessible at `https://fwd.treytv.com/.well-known/assetlinks.json`.

**How to get your SHA-256 fingerprint:**
If you sign with Android Studio / Play App Signing, go to the Google Play Console -> App integrity -> App signing, and copy the SHA-256 certificate fingerprint.
If signing locally with a keystore:
```bash
keytool -list -v -keystore my-release-key.keystore
```

*Note: HTTPS app links will not reliably open the Android app automatically until `assetlinks.json` is deployed correctly. The custom scheme `com.treytv.fwd://` will work out of the box.*

## Notes
- **App ID:** `com.treytv.fwd`
- **Target SDK:** 36 (Android 15)
- All Supabase/Stripe secrets are kept out of the frontend and are managed securely.
- Deep links are configured for `https://fwd.treytv.com` and custom scheme `com.treytv.fwd://`.
