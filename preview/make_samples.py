"""Generate placeholder result images for the preview harness."""
from PIL import Image, ImageDraw, ImageFilter
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "samples")
os.makedirs(OUT, exist_ok=True)

PALETTES = [
    ((24, 32, 56), (86, 120, 190), (232, 180, 140)),
    ((30, 48, 42), (110, 170, 140), (238, 214, 168)),
    ((48, 26, 40), (170, 96, 130), (245, 206, 180)),
]


def make(index, palette, size=1024):
    image = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(image)
    night, mid, warm = palette
    for y in range(size):
        t = y / (size - 1)
        r = int(night[0] + (mid[0] - night[0]) * t)
        g = int(night[1] + (mid[1] - night[1]) * t)
        b = int(night[2] + (mid[2] - night[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    # warm sun disc
    draw.ellipse([size * 0.58, size * 0.18, size * 0.86, size * 0.46], fill=warm)
    # layered hills
    for band, alpha in ((0.62, 0.55), (0.72, 0.75), (0.82, 0.95)):
        points = [(0, size)]
        for x in range(0, size + 1, 32):
            y = size * band - math.sin((x / size) * math.pi * 2 + index) * size * 0.05
            points.append((x, y))
        points.append((size, size))
        shade = int(255 * (1 - alpha))
        draw.polygon(points, fill=(max(0, mid[0] - shade // 3), max(0, mid[1] - shade // 3), max(0, mid[2] - shade // 4)))
    image = image.filter(ImageFilter.GaussianBlur(0.6))
    image.save(os.path.join(OUT, f"sample-{index + 1}.jpg"), quality=92)


for i, palette in enumerate(PALETTES):
    make(i, palette)
print("samples:", ", ".join(sorted(os.listdir(OUT))))
