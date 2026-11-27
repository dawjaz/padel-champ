# Building the Android and iOS apps (Capacitor)

appId `studio.davj.portres`, name PorTres (`capacitor.config.ts`). The appId cannot change after the first store release.
The apps are only a shell around the web build (`dist/`); the game code is the same. App-only code lives in `src/native.ts`
(system browser for the privacy page, Android back button, splash hide); in a browser it does nothing.

## Every time the game changed
    npm run build
    npx cap sync          # copies dist/ into android/ and ios/

## Android (needs Android Studio or the Android SDK + JDK 21)
    npx cap open android  # then Run on a phone with USB debugging, or Build > Build APK(s)
Command line: `cd android && ./gradlew assembleDebug` -> `android/app/build/outputs/apk/debug/app-debug.apk` (install on a phone directly).
Release (Play Store): create a keystore once (`keytool -genkey -v -keystore portres.keystore -alias portres -keyalg RSA -keysize 2048 -validity 10000`),
keep it OUT of git (ignored: `*.keystore`, `keystore.properties`) and back it up in a password manager (lose it and you cannot update the app).
Then Build > Generate Signed App Bundle (.aab) and upload it in Google Play Console. Needs a Google Play developer account (25 USD once).

## iOS (needs a Mac with Xcode; an Apple ID is enough to run on your own iPhone)
    npx cap open ios      # Xcode: pick your team under Signing, Run on the phone
The App Store needs the Apple Developer Program (99 USD a year); upload via Xcode (Product > Archive).

## Icons
App icons come from `design/brand/` (already copied into `android/app/src/main/res/mipmap-*` and the iOS `AppIcon` set). Replace there if the brand changes.

## Not done yet / to check on a phone
- Never built here: this workspace has no Android SDK or Gradle download (blocked), so the first APK build is untested. Expect small fixes.
- Check: sound after the first tap, save data kept after closing the app, Android back button on the start screen, notch and status bar,
  the PRIVACY POLICY button opens the system browser.
