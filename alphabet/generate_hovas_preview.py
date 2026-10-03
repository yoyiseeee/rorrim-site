#!/usr/bin/env python3
"""
Structure preview v2.
Only H / O / A / V / S are allowed as mother glyph sources.
Preview only a small test set in the website before any font export work.
"""

import math
import os
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = "/Users/yangnixuan/mirror-site/app/fonts/AntiqueOlive-Regular.ttf"
OUT = os.path.join(os.path.dirname(__file__), "alphabet_hovas_preview.html")

font = TTFont(FONT)
gs = font.getGlyphSet()

CAP = 1534
MID = CAP // 2
SW = 222
TH = 224

LX = 100
RX = 1300
GW = RX - LX
CX = (LX + RX) // 2

MOTHERS = ["H", "O", "A", "V", "S"]
TEST_GLYPHS = ["C", "D", "E", "F", "G", "I", "L", "P", "U", "X", "Y", "Q", "R", "W"]
DISPLAY_ORDER = [("Mother Glyphs", MOTHERS), ("Derived Tests", TEST_GLYPHS)]

SUMMARY = {
    "成立": ["C", "D", "E", "F", "G", "L", "P", "Q", "W"],
    "仍然牵强": ["I", "U", "X", "Y"],
    "后续可能需要人工重画": ["R"],
}

META = {
    "H": {"sources": ["H"], "ops": ["direct"], "note": "direct mother glyph"},
    "O": {"sources": ["O"], "ops": ["direct"], "note": "direct mother glyph"},
    "A": {"sources": ["A"], "ops": ["direct"], "note": "direct mother glyph"},
    "V": {"sources": ["V"], "ops": ["direct"], "note": "direct mother glyph"},
    "S": {"sources": ["S"], "ops": ["direct"], "note": "direct mother glyph"},
    "C": {"sources": ["O"], "ops": ["crop", "occlude"], "note": "O opened on the right"},
    "D": {"sources": ["O", "H"], "ops": ["crop", "mirror-splice"], "note": "half O plus H stem"},
    "E": {"sources": ["H"], "ops": ["crop", "repeat"], "note": "H stem redistributed into three bars"},
    "F": {"sources": ["H"], "ops": ["crop"], "note": "E without lower bar"},
    "G": {"sources": ["O", "H"], "ops": ["crop", "intervene"], "note": "C plus a horizontal insertion"},
    "I": {"sources": ["H"], "ops": ["crop", "mirror"], "note": "central stem with top and bottom caps"},
    "L": {"sources": ["H"], "ops": ["crop"], "note": "left stem plus base"},
    "P": {"sources": ["O", "H"], "ops": ["crop", "splice"], "note": "upper bowl from O with H stem"},
    "U": {"sources": ["O", "H"], "ops": ["crop", "splice"], "note": "lower O with two short stems"},
    "X": {"sources": ["A", "V"], "ops": ["mirror", "splice"], "note": "upper convergence plus lower convergence"},
    "Y": {"sources": ["V", "H"], "ops": ["crop", "splice"], "note": "upper fork plus lower stem"},
    "Q": {"sources": ["O", "V"], "ops": ["splice"], "note": "O ring with a short descending tail"},
    "R": {"sources": ["O", "H"], "ops": ["crop", "splice", "rotate"], "note": "P logic plus a diagonal leg"},
    "W": {"sources": ["V"], "ops": ["mirror", "repeat"], "note": "double V construction"},
}


def T(*a):
    return a


def shift(dx, dy):
    return T(1, 0, 0, 1, dx, dy)


def sc(sx, sy):
    return T(sx, 0, 0, sy, 0, 0)


def compose(*tt):
    def mul(a, b):
        return (
            a[0] * b[0] + a[1] * b[2],
            a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2],
            a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4],
            a[4] * b[1] + a[5] * b[3] + b[5],
        )

    r = tt[0]
    for t in tt[1:]:
        r = mul(r, t)
    return r


def path(name, t=None):
    inner = SVGPathPen(gs)
    gs[name].draw(TransformPen(inner, t) if t else inner)
    return inner.getCommands()


def rect(x, y, w, h):
    return f"M{x:.1f} {y:.1f}H{x+w:.1f}V{y+h:.1f}H{x:.1f}Z"


def diag(x1, y1, x2, y2, sw=SW):
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    px, py = -dy / length * sw / 2, dx / length * sw / 2
    return (
        f"M{x1+px:.1f} {y1+py:.1f}L{x2+px:.1f} {y2+py:.1f}"
        f"L{x2-px:.1f} {y2-py:.1f}L{x1-px:.1f} {y1-py:.1f}Z"
    )


def layer(d, fill="#111111"):
    return {"d": d, "fill": fill}


def mother(ch):
    if ch not in MOTHERS:
        raise ValueError(f"{ch} is not an allowed mother glyph")
    return [layer(path(ch))]


def derived(ch):
    if ch == "C":
        return [layer(path("O")), layer(rect(CX + 150, -80, 520, CAP + 160), "#ffffff")]
    if ch == "D":
        return [
            layer(path("O")),
            layer(rect(LX + SW + 40, -80, 240, CAP + 160), "#ffffff"),
            layer(rect(LX, 0, SW, CAP)),
        ]
    if ch == "E":
        return [
            layer(rect(LX, 0, SW, CAP)),
            layer(rect(LX, CAP - TH, int(GW * 0.84), TH)),
            layer(rect(LX, MID - TH // 2, int(GW * 0.60), TH)),
            layer(rect(LX, 0, int(GW * 0.84), TH)),
        ]
    if ch == "F":
        return [
            layer(rect(LX, 0, SW, CAP)),
            layer(rect(LX, CAP - TH, int(GW * 0.84), TH)),
            layer(rect(LX, MID - TH // 2, int(GW * 0.60), TH)),
        ]
    if ch == "G":
        return derived("C") + [
            layer(rect(CX + 10, MID - TH // 2, int(GW * 0.35), TH)),
            layer(rect(RX - SW, MID - 180, SW, 180 + TH // 2)),
        ]
    if ch == "I":
        cap_w = SW + 360
        return [
            layer(rect(CX - SW // 2, 0, SW, CAP)),
            layer(rect(CX - cap_w // 2, CAP - TH, cap_w, TH)),
            layer(rect(CX - cap_w // 2, 0, cap_w, TH)),
        ]
    if ch == "L":
        return [layer(rect(LX, 0, SW, CAP)), layer(rect(LX, 0, int(GW * 0.8), TH))]
    if ch == "P":
        return [
            layer(path("O")),
            layer(rect(LX + SW + 40, -80, 240, CAP + 160), "#ffffff"),
            layer(rect(LX - 10, -80, GW + 20, MID - TH // 2 - 20), "#ffffff"),
            layer(rect(LX, 0, SW, CAP)),
        ]
    if ch == "U":
        return [
            layer(path("O")),
            layer(rect(LX - 20, MID + TH, GW + 40, CAP), "#ffffff"),
            layer(rect(LX, MID, SW, MID)),
            layer(rect(RX - SW, MID, SW, MID)),
        ]
    if ch == "X":
        return [layer(diag(LX, CAP, RX, 0)), layer(diag(RX, CAP, LX, 0))]
    if ch == "Y":
        return [
            layer(diag(LX, CAP, CX, MID)),
            layer(diag(RX, CAP, CX, MID)),
            layer(rect(CX - SW // 2, 0, SW, MID + TH // 2)),
        ]
    if ch == "Q":
        return mother("O") + [layer(diag(CX + 120, MID // 2, RX + 90, -120))]
    if ch == "R":
        return [
            layer(path("O")),
            layer(rect(LX + SW + 40, -80, 240, CAP + 160), "#ffffff"),
            layer(rect(LX - 10, -80, GW + 20, MID - TH // 2 - 20), "#ffffff"),
            layer(rect(LX, 0, SW, CAP)),
            layer(diag(LX + SW, MID, RX, 0)),
        ]
    if ch == "W":
        q = (LX + CX) // 2
        t = (CX + RX) // 2
        return [
            layer(diag(LX, CAP, q, 0)),
            layer(diag(q, 0, CX, CAP)),
            layer(diag(CX, CAP, t, 0)),
            layer(diag(t, 0, RX, CAP)),
        ]
    raise ValueError(f"{ch} is not in the current derived test set")


def glyph_layers(ch):
    if ch in MOTHERS:
        return mother(ch)
    if ch in TEST_GLYPHS:
        return derived(ch)
    raise ValueError(f"Unsupported preview glyph: {ch}")


_TOKEN_RE = re.compile(r"[A-Za-z]|-?\d+(?:\.\d+)?")


def glyph_bbox(layers):
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")

    def add_point(x, y):
        nonlocal min_x, min_y, max_x, max_y
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x)
        max_y = max(max_y, y)

    for item in layers:
        if item["fill"] == "#ffffff":
            continue
        tokens = _TOKEN_RE.findall(item["d"])
        i = 0
        cmd = None
        x = y = 0.0
        sx = sy = 0.0
        while i < len(tokens):
            if tokens[i].isalpha():
                cmd = tokens[i]
                i += 1
                if cmd in ("Z", "z"):
                    x, y = sx, sy
                continue
            if cmd in ("M", "L"):
                x = float(tokens[i])
                y = float(tokens[i + 1])
                i += 2
                add_point(x, y)
                if cmd == "M":
                    sx, sy = x, y
                    cmd = "L"
            elif cmd == "H":
                x = float(tokens[i])
                i += 1
                add_point(x, y)
            elif cmd == "V":
                y = float(tokens[i])
                i += 1
                add_point(x, y)
            elif cmd == "Q":
                x1 = float(tokens[i])
                y1 = float(tokens[i + 1])
                x = float(tokens[i + 2])
                y = float(tokens[i + 3])
                i += 4
                add_point(x1, y1)
                add_point(x, y)
            elif cmd == "C":
                x1 = float(tokens[i])
                y1 = float(tokens[i + 1])
                x2 = float(tokens[i + 2])
                y2 = float(tokens[i + 3])
                x = float(tokens[i + 4])
                y = float(tokens[i + 5])
                i += 6
                add_point(x1, y1)
                add_point(x2, y2)
                add_point(x, y)

    if min_x == float("inf"):
        return (0.0, 0.0, 0.0, 0.0)
    return (min_x, min_y, max_x, max_y)


def centered_transform(layers, x0, y0, box_w, box_h):
    min_x, min_y, max_x, max_y = glyph_bbox(layers)
    glyph_w = max_x - min_x
    glyph_h = max_y - min_y
    scale = min((box_w - 36) / max(glyph_w, 1), (box_h - 34) / max(glyph_h, 1))
    dx = x0 + (box_w - glyph_w * scale) / 2 - min_x * scale
    dy = y0 + (box_h + glyph_h * scale) / 2 + min_y * scale
    return scale, dx, dy


def glyph_card_svg(ch):
    layers = glyph_layers(ch)
    scale, dx, dy = centered_transform(layers, 0, 0, 170, 170)
    items = [f'<svg viewBox="0 0 170 170" width="170" height="170" aria-label="{ch}">']
    items.append('<rect x="0" y="0" width="170" height="170" rx="18" fill="#faf7f1" stroke="#d7d0c4"/>')
    items.append(f'<g transform="matrix({scale:.5f},0,0,{-scale:.5f},{dx:.1f},{dy:.1f})" fill-rule="nonzero">')
    for item in layers:
        items.append(f'<path d="{item["d"]}" fill="{item["fill"]}"/>')
    items.append("</g>")
    items.append("</svg>")
    return "\n".join(items)


def card_html(ch):
    meta = META[ch]
    sources = " + ".join(meta["sources"])
    ops = " / ".join(meta["ops"])
    kind = "mother" if ch in MOTHERS else "derived"
    return f"""
<article class="card {kind}">
  <div class="glyphbox">{glyph_card_svg(ch)}</div>
  <h3>{ch}</h3>
  <p class="meta"><strong>Source:</strong> {sources}</p>
  <p class="meta"><strong>Ops:</strong> {ops}</p>
  <p class="note">{meta["note"]}</p>
</article>"""


def build_svg():
    cols = 5
    card_w = 170
    card_h = 236
    gap = 24
    pad = 24
    header_h = 36
    rows = 1 + math.ceil(len(TEST_GLYPHS) / cols)
    svg_w = pad * 2 + cols * card_w + (cols - 1) * gap
    svg_h = pad * 2 + rows * card_h + (rows - 1) * gap + header_h * 2 + 24
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}">',
        """<style>
        .title { font: 700 18px sans-serif; fill: #222; }
        .sub { font: 600 11px monospace; fill: #7a6f60; letter-spacing: 0.06em; }
        .small { font: 500 10px sans-serif; fill: #544c41; }
        .note { font: 500 10px sans-serif; fill: #7b7267; }
        </style>""",
    ]
    y = pad
    for title, chars in DISPLAY_ORDER:
        out.append(f'<text class="title" x="{pad}" y="{y}">{title}</text>')
        y += 16
        for index, ch in enumerate(chars):
            col = index % cols
            row = index // cols
            x0 = pad + col * (card_w + gap)
            y0 = y + 12 + row * (card_h + gap)
            out.append(f'<rect x="{x0}" y="{y0}" width="{card_w}" height="{card_h}" rx="20" fill="#fffdf8" stroke="#ddd4c5"/>')
            layers = glyph_layers(ch)
            scale, dx, dy = centered_transform(layers, x0, y0 + 8, card_w, 148)
            out.append(f'<g transform="matrix({scale:.5f},0,0,{-scale:.5f},{dx:.1f},{dy:.1f})" fill-rule="nonzero">')
            for item in layers:
                out.append(f'<path d="{item["d"]}" fill="{item["fill"]}"/>')
            out.append("</g>")
            meta = META[ch]
            out.append(f'<text class="sub" x="{x0+14}" y="{y0+174}">{ch}</text>')
            out.append(f'<text class="small" x="{x0+14}" y="{y0+192}">{" + ".join(meta["sources"])}</text>')
            out.append(f'<text class="note" x="{x0+14}" y="{y0+208}">{" / ".join(meta["ops"])}</text>')
        y += 12 + math.ceil(len(chars) / cols) * (card_h + gap) + header_h
    out.append("</svg>")
    return "\n".join(out)


def build_summary_html():
    sections = []
    for title, chars in SUMMARY.items():
        items = "".join(f"<li>{ch}</li>" for ch in chars)
        sections.append(f"<section><h4>{title}</h4><ul>{items}</ul></section>")
    return "".join(sections)


def build_html():
    mother_cards = "".join(card_html(ch) for ch in MOTHERS)
    derived_cards = "".join(card_html(ch) for ch in TEST_GLYPHS)
    board_svg = build_svg()
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>rorrim Structure Preview v2</title>
<style>
  :root {{
    --bg: #f3efe7;
    --paper: #fffdf8;
    --ink: #171513;
    --muted: #6e655b;
    --line: #ddd4c5;
    --card: #faf7f1;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    background:
      radial-gradient(circle at top left, #fffdf6 0, #f6f1e7 45%, #efe7d9 100%);
    color: var(--ink);
    padding: 28px;
  }}
  main {{ max-width: 1180px; margin: 0 auto; }}
  h1 {{ margin: 0 0 6px; font-size: 26px; }}
  .lede {{ margin: 0 0 20px; color: var(--muted); line-height: 1.5; max-width: 860px; }}
  .board {{
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 24px;
    padding: 18px;
    margin-bottom: 28px;
  }}
  .section-title {{
    margin: 30px 0 14px;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--muted);
  }}
  .grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 18px;
  }}
  .card {{
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 14px;
    box-shadow: 0 8px 26px rgba(34, 26, 12, 0.05);
  }}
  .glyphbox {{
    width: 170px;
    margin: 0 auto 10px;
  }}
  .card h3 {{
    margin: 0 0 8px;
    text-align: center;
    font-size: 22px;
  }}
  .meta {{
    margin: 4px 0;
    font-size: 12px;
    color: #3d372f;
  }}
  .note {{
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }}
  .summary {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 18px;
    margin-top: 12px;
  }}
  .summary section {{
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 14px 16px;
  }}
  .summary h4 {{ margin: 0 0 10px; font-size: 15px; }}
  .summary ul {{ margin: 0; padding-left: 18px; }}
  .summary li {{ margin: 4px 0; }}
  @media (max-width: 700px) {{
    body {{ padding: 18px; }}
    .glyphbox {{ width: 100%; max-width: 170px; }}
  }}
</style>
</head>
<body>
<main>
  <h1>Structure Preview v2: H / O / A / V / S</h1>
  <p class="lede">
    This round only allows <strong>H</strong>, <strong>O</strong>, <strong>A</strong>,
    <strong>V</strong>, <strong>S</strong> as mother glyphs. The goal is not full font output yet,
    but to test whether a minimal mother set can plausibly support the Latin skeletons.
    All previewed glyphs are kept at cap height.
  </p>

  <section class="board">
    {board_svg}
  </section>

  <h2 class="section-title">Mother Glyphs</h2>
  <section class="grid">
    {mother_cards}
  </section>

  <h2 class="section-title">Derived Test Glyphs</h2>
  <section class="grid">
    {derived_cards}
  </section>

  <h2 class="section-title">Quick Summary</h2>
  <section class="summary">
    {build_summary_html()}
  </section>
</main>
</body>
</html>"""


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    html = build_html()
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"→ {OUT}")
    svg_out = OUT.replace(".html", ".svg")
    with open(svg_out, "w", encoding="utf-8") as f:
        f.write(build_svg())
    print(f"→ {svg_out}")
