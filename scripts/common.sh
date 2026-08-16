#!/bin/bash
# Shared environment for all build/install steps on this machine.
# The user's ~/.npm cache contains root-owned files (an old npm bug), so we
# redirect every cache into the workspace to avoid EPERM errors.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/.." && pwd)"
WORKSPACE="$(cd "$PROJECT/.." && pwd)"

export npm_config_cache="$WORKSPACE/.npm-cache"
export ELECTRON_CACHE="$WORKSPACE/.electron-cache"
export electron_config_cache="$WORKSPACE/.electron-cache"
export ELECTRON_BUILDER_CACHE="$WORKSPACE/.electron-builder-cache"
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
