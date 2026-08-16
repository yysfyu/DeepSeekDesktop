#!/bin/bash
# Build the unpacked .app: ./make_app.sh → dist/mac/DeepSeek Harness.app
set -euo pipefail
cd "$(dirname "$0")"
source scripts/common.sh

# Make sure the icon exists.
if [ ! -f build/icon.icns ]; then
  scripts/build_icon.sh
fi

npm run pack
echo "✅ .app built under dist/mac/"
