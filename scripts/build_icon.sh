#!/bin/bash
# Generate build/icon.icns from the official DeepSeek whale mark
# (scripts/gen_icon.py renders build/icon_1024.png from build/deepseek-whale.png).
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p build

python3 scripts/gen_icon.py build/icon_1024.png

ICONSET="build/icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

for s in 16 32 128 256 512; do
  sips -z $s $s build/icon_1024.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z $d $d build/icon_1024.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o build/icon.icns
rm -rf "$ICONSET"
echo "✅ built build/icon.icns"
