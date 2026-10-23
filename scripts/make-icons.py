"""生成桌面端图标（icon.png / icon.ico / icon.icns）。

用法（需要 Pillow）：
    python scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "desktop" / "build"

SIZE = 2048
TOP = (20, 184, 166)
BOTTOM = (15, 118, 110)

FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/arialbd.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
]


def pick_font() -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), int(SIZE * 0.44))
    return ImageFont.load_default(int(SIZE * 0.44))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    gradient = Image.new("RGB", (1, SIZE))
    pixels = gradient.load()
    for y in range(SIZE):
        t = y / (SIZE - 1)
        pixels[0, y] = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    gradient = gradient.resize((SIZE, SIZE))

    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, SIZE - 1, SIZE - 1], radius=int(SIZE * 0.228), fill=255
    )

    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    icon.paste(gradient, (0, 0), mask)

    draw = ImageDraw.Draw(icon)
    font = pick_font()
    bbox = draw.textbbox((0, 0), "VP", font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    draw.text(
        ((SIZE - text_width) / 2 - bbox[0], (SIZE - text_height) / 2 - bbox[1]),
        "VP",
        font=font,
        fill=(255, 255, 255, 245),
    )

    icon = icon.resize((1024, 1024), Image.LANCZOS)
    icon.save(OUT_DIR / "icon.png", optimize=True)
    icon.save(
        OUT_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    icon.save(OUT_DIR / "icon.icns", format="ICNS")
    print(f"written to {OUT_DIR}")


if __name__ == "__main__":
    main()
