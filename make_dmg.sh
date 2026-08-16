#!/bin/bash
# Build the .app (ad-hoc signed) and wrap it in a DMG: ./make_dmg.sh
# No Apple Developer certificate is used, so first launch on another Mac needs
# right-click → Open to bypass Gatekeeper.
set -euo pipefail
cd "$(dirname "$0")"
source scripts/common.sh

if [ ! -f build/icon.icns ]; then
  scripts/build_icon.sh
fi

# 1. Build + ad-hoc sign the .app (electron-builder, no dependency rebuild).
npm run pack

APP_DIR=$(find dist -maxdepth 2 -name "DeepSeek Harness.app" -type d | head -1)
if [ -z "$APP_DIR" ]; then
  echo "❌ .app not found under dist/" >&2
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")
ARCH=$(uname -m)
DMG="dist/DeepSeek Harness-${VERSION}-${ARCH}.dmg"

# 2. Wrap in a DMG with hdiutil (fully local; electron-builder's dmg target
#    made a network call that is unreliable here).
rm -rf .dmg_staging
mkdir -p .dmg_staging
cp -R "$APP_DIR" .dmg_staging/
ln -s /Applications .dmg_staging/Applications
find .dmg_staging -name '.DS_Store' -delete 2>/dev/null || true

rm -f "$DMG"
hdiutil create -volname "DeepSeek Harness" -srcfolder .dmg_staging -ov -format UDZO "$DMG"
rm -rf .dmg_staging

echo "✅ built $DMG ($(du -h "$DMG" | cut -f1))"
