#!/bin/bash
# Bump iOS build number, archive, and upload straight to App Store Connect /
# TestFlight via xcodebuild automatic signing + -allowProvisioningUpdates.
# Adapted from slide-tracker's proven pipeline (incl. the CFBundleVersion guard).
set -euo pipefail
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree isn't clean — commit or stash first, then re-run." >&2
  exit 1
fi

CURRENT=$(python3 -c "import json;print(json.load(open('app.json'))['expo']['ios']['buildNumber'])")
NEXT=$((CURRENT + 1))

echo "==> Bumping build number: $CURRENT -> $NEXT"
sed -i '' "s/\"buildNumber\": \"$CURRENT\"/\"buildNumber\": \"$NEXT\"/" app.json
sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT;/CURRENT_PROJECT_VERSION = $NEXT;/g" ios/Hangtime.xcodeproj/project.pbxproj

git add app.json ios/Hangtime.xcodeproj/project.pbxproj
git commit -m "Bump build number to $NEXT for release"
git push

echo "==> Archiving (build $NEXT)"
rm -rf build/Hangtime.xcarchive build/export
xcodebuild clean archive \
  -workspace ios/Hangtime.xcworkspace \
  -scheme Hangtime \
  -configuration Release \
  -archivePath build/Hangtime.xcarchive \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates

SHIPPED=$(/usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" build/Hangtime.xcarchive/Info.plist)
if [ "$SHIPPED" != "$NEXT" ]; then
  echo "Archive build number ($SHIPPED) doesn't match expected ($NEXT) — check ios/Hangtime/Info.plist's CFBundleVersion substitution before uploading." >&2
  exit 1
fi

echo "==> Exporting + uploading to App Store Connect"
xcodebuild -exportArchive \
  -archivePath build/Hangtime.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist scripts/ExportOptionsUpload.plist \
  -allowProvisioningUpdates

echo "==> Done. Build $NEXT is processing in App Store Connect / TestFlight."
