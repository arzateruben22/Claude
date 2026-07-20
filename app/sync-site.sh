#!/bin/sh
# Copy the live site into the app bundle, then sync the iOS project.
# Run from the app/ directory: ./sync-site.sh
set -e
rm -rf www
mkdir -p www
cp -r ../index.html ../css ../js ../fonts ../media ../icons ../manifest.webmanifest ../sw.js www/
npx cap sync ios
echo "Synced. Open ios/App/App.xcodeproj in Xcode to build."
