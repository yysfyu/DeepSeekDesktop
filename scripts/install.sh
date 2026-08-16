#!/bin/bash
# Install dependencies (production + dev), approve lifecycle scripts, and
# download the Electron binary via the npmmirror mirror into a workspace-local
# cache (the user's ~/.npm cache contains root-owned files — see common.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/common.sh

npm install --no-audit --no-fund

# npm 12 blocks dependency lifecycle scripts unless approved; the approvals are
# pinned in package.json's allowScripts, so a plain install already honors them.
# (If this is a fresh checkout without allowScripts, approve them explicitly.)
npm install-scripts approve --all 2>/dev/null || true
npm rebuild 2>/dev/null || true

# Electron 43 ships no postinstall script, so the binary is downloaded lazily.
node node_modules/electron/install.js

echo "✅ dependencies installed (node + electron + dsh)"
