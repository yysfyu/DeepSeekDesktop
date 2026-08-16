#!/bin/bash
# Wrap an already-built .app (under dist/) into a DMG.
# Assumes `npm run pack` or `npm run dist` has already produced
# dist/mac-<arch>/DeepSeek Harness.app.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_DIR=$(find dist -maxdepth 2 -name "DeepSeek Harness.app" -type d | head -1)
if [ -z "$APP_DIR" ]; then
  echo "❌ .app not found under dist/ — run 'npm run pack' (or 'npm run dist') first" >&2
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")
ARCH=$(uname -m)
DMG="dist/DeepSeek Harness-${VERSION}-${ARCH}.dmg"

rm -rf .dmg_staging
mkdir -p .dmg_staging
cp -R "$APP_DIR" .dmg_staging/
ln -s /Applications .dmg_staging/Applications
find .dmg_staging -name '.DS_Store' -delete 2>/dev/null || true

rm -f "$DMG"
hdiutil create -volname "DeepSeek Harness" -srcfolder .dmg_staging -ov -format UDZO "$DMG"
rm -rf .dmg_staging

echo "✅ built $DMG ($(du -h "$DMG" | cut -f1))"
