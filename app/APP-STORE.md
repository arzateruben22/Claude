# Los Güeros — iPhone App (ready to build)

This folder is a Capacitor iOS wrapper around the website. Everything is
pre-configured; building and submitting requires a Mac with Xcode and an
Apple Developer account ($99/yr).

## When the time comes

1. On a Mac: install Xcode (App Store) and CocoaPods if prompted.
2. `cd app && npm install`
3. `./sync-site.sh` — copies the latest site into the app and syncs.
4. `npx cap open ios` — opens the project in Xcode.
5. In Xcode: select the App target → Signing & Capabilities → choose your
   Apple Developer team. Bundle ID is `com.losgueros.anaheim`.
6. Product → Archive → Distribute App → App Store Connect.
7. In App Store Connect: create the app listing (name "Los Güeros",
   screenshots, description), attach the build, submit for review.

## Notes

- App icon is already set (Assets.xcassets/AppIcon).
- Re-run `./sync-site.sh` after any website change, then re-archive.
- Apple can reject thin wrappers (guideline 4.2). The app already bundles
  ordering, rewards, membership, and offline support, which strengthens the
  case — mention these in the review notes.
- Android later: `npm i @capacitor/android && npx cap add android`.
