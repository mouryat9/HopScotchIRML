# Hopscotch 4 All — iPad / iOS app (Capacitor)

The iPad app is the **same web app** wrapped in a native iOS shell with
[Capacitor](https://capacitorjs.com). It looks and behaves identically to
hopscotch4all.com — the native project just loads the built `dist/` and adds
native file-save/share for PDFs.

Everything except the final macOS build has already been set up in this repo:

- Capacitor + iOS platform installed (`ios/` Xcode project scaffolded)
- `capacitor.config.json` (appId `com.hopscotch4all.app`, name "Hopscotch 4 All")
- `src/api.js` forces the **production API** when running natively
- PDF / Conceptual-Framework / CSV downloads use the native **Share sheet** on iOS
- Backend CORS allows the `capacitor://localhost` origin

## What you need (one-time)
1. A **Mac** with **Xcode** (latest) + Command Line Tools.
2. **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`).
3. An **Apple Developer Program** account ($99/yr) — required to sign & submit.

## Build & run on an iPad (on the Mac)
```bash
cd hopscotch-ui
npm install                 # install web + Capacitor deps
npm run ios:sync            # builds the web app and copies it into ios/ (runs pod install)
npm run ios:open            # opens the project in Xcode
```
In Xcode:
1. Select the **App** target → **Signing & Capabilities** → pick your Team (auto-signing).
2. (Optional) set the app icon: drop a 1024×1024 PNG via `npx @capacitor/assets generate --ios`.
3. Choose an iPad simulator or a connected iPad → press **Run**. You'll see the full app.

## Ship to the App Store
1. In Xcode: **Product → Archive** → **Distribute App** → App Store Connect.
2. In App Store Connect: create the app record, add screenshots, description,
   and the **privacy policy URL** (required — handles student data).
3. Submit for review. (Education/kids apps get stricter privacy review — no
   third-party ad/analytics SDKs, clear data-use disclosures.)

Use **TestFlight** first to test on real iPads before public release.

## Important note on the API
The native app talks to `https://api.hopscotch4all.com` (production). For that to
work, the **production** backend must allow the Capacitor CORS origins (already
added in `app_chat.py` on staging — promote it to prod before releasing the app).

## Everyday workflow after a web change
```bash
npm run ios:sync    # rebuild web + copy into the native project
npm run ios:open    # then Run/Archive in Xcode
```
