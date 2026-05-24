from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


A4_WIDTH = 1240
A4_HEIGHT = 1754
MARGIN_X = 92
MARGIN_TOP = 86
MARGIN_BOTTOM = 80
LINE_GAP = 12


def find_font(explicit: str | None = None) -> str:
    candidates = [
        explicit,
        "/tmp/NotoSansCJKsc-Regular.otf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for item in candidates:
        if item and Path(item).exists():
            return item
    raise FileNotFoundError("No usable font found. Pass --font /path/to/chinese-font.otf")


def font(path: str, size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    if bold and Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf").exists():
        # CJK fonts in this environment are regular only; use size/spacing for hierarchy.
        return ImageFont.truetype(path, size=size)
    return ImageFont.truetype(path, size=size)


def text_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> float:
    return draw.textlength(text, font=fnt)


def wrap_line(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    text = text.strip()
    if not text:
        return [""]

    lines: list[str] = []
    current = ""
    tokens = re.findall(r"[A-Za-z0-9_./:+#-]+|\s+|.", text)
    for token in tokens:
        if token.isspace():
            candidate = current + " "
        else:
            candidate = current + token
        if current and text_width(draw, candidate, fnt) > max_width:
            lines.append(current.rstrip())
            current = token.lstrip()
        else:
            current = candidate
    if current.strip():
        lines.append(current.rstrip())
    return lines or [text]


def new_page() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (A4_WIDTH, A4_HEIGHT), "#fffdf8")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, A4_WIDTH, 22], fill="#1d8a72")
    draw.rectangle([0, A4_HEIGHT - 18, A4_WIDTH, A4_HEIGHT], fill="#e6f2ed")
    return img, draw


def render_markdown_to_pdf(md_path: Path, pdf_path: Path, font_path: str) -> None:
    body = md_path.read_text(encoding="utf-8")
    pages: list[Image.Image] = []
    img, draw = new_page()
    pages.append(img)
    y = MARGIN_TOP

    fonts = {
        "h1": font(font_path, 42),
        "h2": font(font_path, 30),
        "h3": font(font_path, 24),
        "body": font(font_path, 20),
        "small": font(font_path, 17),
    }
    colors = {
        "title": "#183b39",
        "heading": "#1d6e59",
        "text": "#273d3a",
        "muted": "#5f706d",
        "line": "#d6e4dd",
    }

    def ensure(space: int) -> None:
        nonlocal img, draw, y
        if y + space <= A4_HEIGHT - MARGIN_BOTTOM:
            return
        img, draw = new_page()
        pages.append(img)
        y = MARGIN_TOP

    def draw_wrapped(text: str, fnt: ImageFont.FreeTypeFont, fill: str, indent: int = 0, gap: int = LINE_GAP) -> None:
        nonlocal y
        width = A4_WIDTH - MARGIN_X * 2 - indent
        lines = wrap_line(draw, text, fnt, width)
        line_height = int(fnt.size * 1.55)
        ensure(line_height * len(lines) + gap)
        for line in lines:
            draw.text((MARGIN_X + indent, y), line, fill=fill, font=fnt)
            y += line_height
        y += gap

    for raw in body.splitlines():
        line = raw.rstrip()
        if not line:
            y += 8
            continue
        if line.startswith("# "):
            ensure(90)
            draw_wrapped(line[2:].strip(), fonts["h1"], colors["title"], gap=20)
            draw.line([MARGIN_X, y, A4_WIDTH - MARGIN_X, y], fill=colors["line"], width=2)
            y += 22
        elif line.startswith("## "):
            ensure(70)
            y += 10
            draw_wrapped(line[3:].strip(), fonts["h2"], colors["heading"], gap=14)
        elif line.startswith("### "):
            draw_wrapped(line[4:].strip(), fonts["h3"], colors["heading"], gap=10)
        elif line.startswith("- "):
            draw_wrapped("• " + line[2:].strip(), fonts["body"], colors["text"], indent=18, gap=6)
        elif re.match(r"^\d+\.\s+", line):
            draw_wrapped(line, fonts["body"], colors["text"], indent=18, gap=6)
        else:
            draw_wrapped(line, fonts["body"], colors["text"], gap=10)

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    first, *rest = pages
    first.save(pdf_path, "PDF", resolution=150.0, save_all=True, append_images=rest)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render CareRelay markdown summary to PDF.")
    parser.add_argument("markdown", type=Path)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--font", default=None)
    args = parser.parse_args()
    render_markdown_to_pdf(args.markdown, args.pdf, find_font(args.font))
    print(args.pdf)


if __name__ == "__main__":
    main()

