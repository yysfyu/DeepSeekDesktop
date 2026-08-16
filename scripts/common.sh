#!/bin/bash
# Shared environment for all build/install steps.
#
# On this machine (~/.npm has root-owned files + China network) we redirect the
# caches into the workspace and download Electron from npmmirror. On GitHub
# Actions we instead use the default npmjs registry and the GitHub Electron
# mirror, both of which are nearby/fast on the hosted runner.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/.." && pwd)"
WORKSPACE="$(cd "$PROJECT/.." && pwd)"

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  # Hosted runner: default caches, npmjs registry, GitHub Electron mirror.
  export npm_config_registry="https://registry.npmjs.org/"
else
  # Local machine: workspace caches + China mirrors.
  export npm_config_cache="$WORKSPACE/.npm-cache"
  export ELECTRON_CACHE="$WORKSPACE/.electron-cache"
  export electron_config_cache="$WORKSPACE/.electron-cache"
  export ELECTRON_BUILDER_CACHE="$WORKSPACE/.electron-builder-cache"
  export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
fi
