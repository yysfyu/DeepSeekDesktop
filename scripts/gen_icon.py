#!/usr/bin/env python3
"""Generate build/icon_1024.png — the official DeepSeek whale mark on white.

Source: build/deepseek-whale.png (official DeepSeek chat icon, blue #4d6bfe
whale on transparent, fetched from https://cdn.deepseek.com/chat/icon.png).
"""
import sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/icon_1024.png"
SRC = "build/deepseek-whale.png"
SIZE = 1024
WHALE_FRACTION = 0.72  # whale occupies ~72% of the canvas width

whale = Image.open(SRC).convert("RGBA")

# Crop to the non-transparent bounding box so scaling is exact.
bbox = whale.getbbox()
if bbox is None:
    raise SystemExit("whale source has no opaque pixels")
whale = whale.crop(bbox)

# Scale the whale so its longer side fits WHALE_FRACTION of the canvas.
side = max(whale.size)
target = int(SIZE * WHALE_FRACTION)
scale = target / side
whale = whale.resize(
    (max(1, round(whale.width * scale)), max(1, round(whale.height * scale))),
    Image.LANCZOS,
)

# White background + centered whale.
canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
x = (SIZE - whale.width) // 2
y = (SIZE - whale.height) // 2
canvas.alpha_composite(whale, (x, y))

canvas.convert("RGB").save(OUT, "PNG")
print(f"wrote {OUT} ({whale.width}x{whale.height} whale)")
