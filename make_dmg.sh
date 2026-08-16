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

# 2. Wrap the .app in a DMG.
scripts/make_dmg_only.sh
