"""Generate build/icon.png (1024), icon.icns (macOS, needs iconutil) and icon.ico (Windows).

Run: python3 build/make-icon.py   (requires Pillow)
"""
import math
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
S = 4096  # supersampled canvas
OUT = 1024


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def squircle_mask(size, margin, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((margin, margin, size - margin, size - margin), radius, fill=255)
    return m


def build():
    margin = int(S * 0.098)  # macOS icon grid: ~824/1024 body
    radius = int((S - 2 * margin) * 0.225)

    # diagonal gradient background
    top, bottom = (58, 150, 112), (14, 52, 38)
    grad = Image.new("RGB", (S, S))
    px = grad.load()
    for y in range(S):
        for x in range(S):
            px[x, y] = lerp(top, bottom, (x * 0.35 + y * 0.65) / S)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = squircle_mask(S, margin, radius)
    img.paste(grad, (0, 0), mask)

    # subtle top sheen: vertical alpha fade, clipped to the body
    sheen = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sp = sheen.load()
    for y in range(margin, int(S * 0.55)):
        a = int(46 * (1 - (y - margin) / (S * 0.55 - margin)) ** 2)
        for x in range(margin, S - margin):
            sp[x, y] = (255, 255, 255, a)
    sheen.putalpha(ImageChops.multiply(sheen.getchannel("A"), mask))
    img = Image.alpha_composite(img, sheen)

    cx = cy = S / 2
    r = S * 0.255
    w = S * 0.066
    cream = (255, 226, 170, 255)

    def layer():
        return Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # ring track
    track = layer()
    box = (cx - r, cy - r, cx + r, cy + r)
    ImageDraw.Draw(track).ellipse(box, outline=(255, 255, 255, 55), width=int(w))
    img = Image.alpha_composite(img, track)

    # progress arc, clockwise from 12 o'clock, round caps
    sweep = 250
    arc = layer()
    d = ImageDraw.Draw(arc)
    d.arc(box, -90, -90 + sweep, fill=cream, width=int(w))
    for ang in (-90, -90 + sweep):
        t = math.radians(ang)
        x, y = cx + (r - w / 2) * math.cos(t), cy + (r - w / 2) * math.sin(t)
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=cream)
    img = Image.alpha_composite(img, arc)

    # hands (minute up, hour toward ~4 o'clock) and hub
    hands = layer()
    d = ImageDraw.Draw(hands)
    hw = int(S * 0.036)
    for ang, length in ((-90, r * 0.60), (30, r * 0.40)):
        t = math.radians(ang)
        x, y = cx + length * math.cos(t), cy + length * math.sin(t)
        d.line((cx, cy, x, y), fill=(255, 255, 255, 255), width=hw)
        d.ellipse((x - hw / 2, y - hw / 2, x + hw / 2, y + hw / 2), fill=(255, 255, 255, 255))
    c = S * 0.032
    d.ellipse((cx - c, cy - c, cx + c, cy + c), fill=cream)
    img = Image.alpha_composite(img, hands)

    return img.resize((OUT, OUT), Image.LANCZOS)


def main():
    icon = build()
    icon.save(os.path.join(HERE, "icon.png"))

    sizes = [16, 32, 64, 128, 256, 512, 1024]
    icon.resize((256, 256), Image.LANCZOS).save(
        os.path.join(HERE, "icon.ico"), sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)]
    )

    if shutil.which("iconutil"):
        with tempfile.TemporaryDirectory() as tmp:
            iconset = os.path.join(tmp, "icon.iconset")
            os.mkdir(iconset)
            names = {16: ["icon_16x16"], 32: ["icon_16x16@2x", "icon_32x32"], 64: ["icon_32x32@2x"],
                     128: ["icon_128x128"], 256: ["icon_128x128@2x", "icon_256x256"],
                     512: ["icon_256x256@2x", "icon_512x512"], 1024: ["icon_512x512@2x"]}
            for s, ns in names.items():
                im = icon.resize((s, s), Image.LANCZOS)
                for n in ns:
                    im.save(os.path.join(iconset, n + ".png"))
            subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(HERE, "icon.icns")], check=True)


if __name__ == "__main__":
    main()
