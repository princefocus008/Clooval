from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

base = Path("frontend") / "public"
base.mkdir(parents=True, exist_ok=True)

for size in [192, 512]:
    path = base / f"icon-{size}.png"
    img = Image.new("RGBA", (size, size), (17, 17, 17, 255))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", size // 3)
    except Exception:
        font = ImageFont.load_default()

    text = "C"
    bbox = font.getbbox(text)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - w) / 2, (size - h) / 2), text, fill=(255, 255, 255, 255), font=font)
    img.save(path)
    print(f"created {path}")
