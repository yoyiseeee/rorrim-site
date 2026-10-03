#!/usr/bin/env python3
"""
Full A-Z uppercase + a-z lowercase (all at cap height).
Source: AntiqueOlive-Regular — only A, B, C outlines used as raw material.
X/Y/Z: shared uppercase/lowercase. Z has a middle bar (handwritten-z convention).
"""

import math
import os
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = "/Users/yangnixuan/mirror-site/app/fonts/AntiqueOlive-Regular.ttf"
OUT = os.path.join(os.path.dirname(__file__), "alphabet.html")

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

C_CX = (83 + 1163) // 2


def T(*a):
    return a


def flipH(cx):
    return T(-1, 0, 0, 1, 2 * cx, 0)


def flipV(cy):
    return T(1, 0, 0, -1, 0, 2 * cy)


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


def arc_D():
    return path("C", flipH(C_CX))


_U_ROT = compose(T(0, 1, -1, 0, CAP, 0), shift(-53, -83), sc(1.0, MID / 1080.0))


def arc_U():
    return path("C", _U_ROT)


def arc_n():
    return path("C", compose(_U_ROT, flipV(MID)))


_P_ARC = compose(flipH(C_CX), sc(1, 0.5), shift(0, MID))


def arc_P():
    return path("C", _P_ARC)


_C_TOP = compose(sc(1, 0.5), shift(0, MID))
_C_BOT = compose(sc(1, 0.5))
_D_TOP = compose(flipH(C_CX), sc(1, 0.5), shift(0, MID))
_D_BOT = compose(flipH(C_CX), sc(1, 0.5))


def open_C():
    return [path("C", _C_TOP), path("C", _C_BOT)]


def ring_four(scale_x=1.0, scale_y=1.0, dx=0.0, dy=0.0):
    t = compose(sc(scale_x, scale_y), shift((1 - scale_x) * CX + dx, dy))
    return [
        path("C", compose(_C_TOP, t)),
        path("C", compose(_C_BOT, t)),
        path("C", compose(_D_TOP, t)),
        path("C", compose(_D_BOT, t)),
    ]


_S_TOP = compose(sc(1, 0.55), shift(0, int(MID * 0.85)))
_S_BOT = compose(flipH(C_CX), sc(1, 0.55), shift(0, 0))


def glyph_UC(ch):  # noqa: C901
    if ch == "A":
        return [diag(LX, 0, CX, CAP), diag(CX, CAP, RX, 0), rect(LX + 180, MID - TH // 2, GW - 360, TH)]
    if ch == "B":
        return [path("B")]
    if ch == "C":
        return open_C()
    if ch == "D":
        return [arc_D(), rect(50, 0, SW, CAP)]
    if ch == "E":
        return [rect(LX, 0, SW, CAP), rect(LX, CAP - TH, int(GW * 0.82), TH), rect(LX, MID - TH // 2, int(GW * 0.56), TH), rect(LX, 0, int(GW * 0.82), TH)]
    if ch == "F":
        return [rect(LX, 0, SW, CAP), rect(LX, CAP - TH, GW, TH), rect(LX, MID - TH // 2, GW * 4 // 5, TH)]
    if ch == "G":
        return open_C() + [rect(CX - 20, MID - TH // 2, RX - CX + 20, TH), rect(RX - SW, MID - 260, SW, 260 + TH // 2)]
    if ch == "H":
        return [rect(LX, 0, SW, CAP), rect(RX - SW, 0, SW, CAP), rect(LX + SW // 2, MID - TH // 2, GW - SW, TH)]
    if ch == "I":
        return [rect(CX - SW // 2, 0, SW, CAP), rect(CX - SW // 2 - 200, 0, SW + 400, TH), rect(CX - SW // 2 - 200, CAP - TH, SW + 400, TH)]
    if ch == "J":
        hook = compose(sc(0.82, 0.52), shift(RX - int(1163 * 0.82), 0))
        return [rect(CX - 130, CAP - TH, 130 + SW, TH), rect(RX - SW, MID // 2, SW, CAP - MID // 2), path("C", hook)]
    if ch == "K":
        jx, jy = LX + SW, MID
        return [rect(LX, 0, SW, CAP), diag(jx, jy, RX, CAP), diag(jx, jy, RX, 0)]
    if ch == "L":
        return [rect(LX, 0, SW, CAP), rect(LX, 0, GW, TH)]
    if ch == "M":
        return [rect(LX, 0, SW, CAP), rect(RX - SW, 0, SW, CAP), diag(LX + SW // 2, CAP, CX, 0), diag(CX, 0, RX - SW // 2, CAP)]
    if ch == "N":
        return [rect(LX, 0, SW, CAP), rect(RX - SW, 0, SW, CAP), diag(LX, CAP, RX, 0)]
    if ch == "O":
        return ring_four()
    if ch == "P":
        return [rect(LX, 0, SW, CAP), arc_P()]
    if ch == "Q":
        return ring_four() + [diag(CX + 120, MID // 2, RX + 40, -TH // 3)]
    if ch == "R":
        return [rect(LX, 0, SW, CAP), arc_P(), diag(LX + SW, MID, RX, 0)]
    if ch == "S":
        return [path("C", _S_TOP), path("C", _S_BOT)]
    if ch == "T":
        return [rect(CX - SW // 2, 0, SW, CAP), rect(LX, CAP - TH, GW, TH)]
    if ch == "U":
        return [arc_U(), rect(LX, MID, SW, MID), rect(RX - SW, MID, SW, MID)]
    if ch == "V":
        return [diag(LX, CAP, CX, 0), diag(CX, 0, RX, CAP)]
    if ch == "W":
        q = (LX + CX) // 2
        t = (CX + RX) // 2
        return [diag(LX, CAP, q, 0), diag(q, 0, CX, CAP), diag(CX, CAP, t, 0), diag(t, 0, RX, CAP)]
    if ch == "X":
        return [diag(LX, CAP, RX, 0), diag(RX, CAP, LX, 0)]
    if ch == "Y":
        return [diag(LX, CAP, CX, MID), diag(RX, CAP, CX, MID), rect(CX - SW // 2, 0, SW, MID + TH // 2)]
    if ch == "Z":
        mid_w = int(GW * 0.6)
        return [rect(LX, CAP - TH, GW, TH), diag(RX, CAP, LX, 0), rect(CX - mid_w // 2, MID - TH // 2, mid_w, TH), rect(LX, 0, GW, TH)]
    return []


def glyph_lc(ch):  # noqa: C901
    if ch in ("x", "y", "z"):
        return glyph_UC(ch.upper())
    if ch == "a":
        return [path("C"), arc_D(), rect(RX - SW, 0, SW, CAP), rect(LX + 30, MID - TH // 2, RX - LX - SW - 30, TH)]
    if ch == "b":
        return [rect(LX, 0, SW, CAP), path("C", compose(flipH(C_CX), sc(1, 0.5)))]
    if ch == "c":
        sx_c = GW / (1163 - 83)
        return [path("C", compose(sc(sx_c, sx_c), shift(LX - 83 * sx_c, 0)))]
    if ch == "d":
        return [path("C", compose(sc(1, 0.5))), rect(RX - SW, 0, SW, CAP)]
    if ch == "e":
        return ring_four() + [rect(LX - 60, MID - TH // 2, GW + 60, TH)]
    if ch == "f":
        hook = compose(flipH(C_CX), sc(0.42, 0.38), shift(CX - SW // 2 - int(83 * 0.42) + 80, CAP - int(1565 * 0.38) + 20))
        return [path("C", hook), rect(CX - SW // 2, 0, SW, CAP), rect(CX - SW // 2 - 170, MID, SW + 340, TH)]
    if ch == "g":
        tail = path("C", compose(sc(0.7, 0.32), shift(RX - SW - int(1163 * 0.7), -int(CAP * 0.28))))
        return ring_four() + [rect(RX - SW, -int(CAP * 0.28), SW, CAP), tail]
    if ch == "h":
        return [arc_n(), rect(LX, 0, SW, CAP), rect(RX - SW, 0, SW, MID)]
    if ch == "i":
        return [rect(CX - SW // 2, 0, SW, CAP - TH * 2), rect(CX - SW // 2 - SW // 4, CAP - TH, SW + SW // 2, TH)]
    if ch == "j":
        hook = compose(sc(0.82, 0.52), shift(RX - int(1163 * 0.82), -120))
        return [path("C", hook), rect(RX - SW, -120, SW, CAP - TH * 3 + 120), rect(RX - SW - SW // 4, CAP - TH, SW + SW // 2, TH)]
    if ch == "k":
        return glyph_UC("K")
    if ch == "l":
        return [rect(CX - SW // 2, 0, SW, CAP)]
    if ch == "m":
        return [rect(LX, 0, SW, CAP), rect(CX - SW // 2, 0, SW, MID), rect(RX - SW, 0, SW, MID), path("C", compose(flipH(C_CX), sc(0.5, 0.5), shift(LX + SW - int(83 * 0.5), MID))), path("C", compose(flipH(C_CX), sc(0.5, 0.5), shift(CX - int(83 * 0.5), MID)))]
    if ch == "n":
        return [arc_n(), rect(LX, 0, SW, MID), rect(RX - SW, 0, SW, MID)]
    if ch == "o":
        return ring_four(0.86, 0.92)
    if ch == "p":
        return glyph_UC("P")
    if ch == "q":
        return [path("C", compose(sc(1, 0.5), shift(0, MID))), rect(RX - SW, 0, SW, CAP)]
    if ch == "r":
        return [rect(LX, 0, SW, CAP), rect(LX + SW, MID + 40, int(GW * 0.28), TH), diag(LX + SW + 40, MID + TH // 2, LX + SW + 260, CAP - 120, SW - 36)]
    if ch == "s":
        return glyph_UC("S")
    if ch == "t":
        return [rect(CX - SW // 2, 0, SW, CAP), rect(CX - SW // 2 - 200, int(CAP * 0.55), SW + 400, TH), rect(CX - SW // 2, CAP - TH, SW, TH)]
    if ch == "u":
        return glyph_UC("U")
    if ch == "v":
        return glyph_UC("V")
    if ch == "w":
        return glyph_UC("W")
    return []


def glyph_digit(ch):  # noqa: C901
    if ch == "0":
        return ring_four(0.82, 1.0)
    if ch == "1":
        return [rect(CX - SW // 2, 0, SW, CAP), rect(CX - SW // 2 - 200, CAP - TH, 200 + SW, TH), rect(CX - SW // 2 - 300, 0, SW + 600, TH)]
    if ch == "2":
        fc_top = path("C", compose(flipH(C_CX), sc(1, 0.5), shift(0, MID)))
        return [fc_top, diag(RX - 30, MID + TH // 2, LX + 100, TH), rect(RX - TH, MID - TH // 2, TH, TH), rect(LX, 0, GW, TH)]
    if ch == "3":
        return [path("C", compose(flipH(C_CX), sc(1, 0.5), shift(0, MID))), path("C", compose(flipH(C_CX), sc(1, 0.5)))]
    if ch == "4":
        return [diag(LX, CAP, LX, MID - TH // 2, SW), diag(LX, MID - TH // 2, RX, MID - TH // 2, SW), rect(RX - SW, 0, SW, CAP), diag(LX, CAP, RX - SW // 2, MID - TH // 2)]
    if ch == "5":
        return [rect(LX, CAP - TH, GW, TH), rect(LX, MID, SW, MID - TH), rect(LX, MID - TH // 2, int(GW * 0.7), TH), path("C", compose(flipH(C_CX), sc(1, 0.55)))]
    if ch == "6":
        return ring_four(0.88, 0.62) + [path("C", compose(sc(0.78, 0.44), shift(int(LX - 83 * 0.78), int(CAP * 0.58))))]
    if ch == "7":
        return [rect(LX, CAP - TH, GW, TH), diag(RX, CAP, LX + SW, 0), rect(int(LX + GW * 0.2), MID - TH // 2, int(GW * 0.5), TH)]
    if ch == "8":
        return ring_four(0.78, 0.42, dy=int(CAP * 0.56)) + ring_four(0.88, 0.46)
    if ch == "9":
        return ring_four(0.88, 0.56, dy=int(CAP * 0.42)) + [rect(RX - SW, 0, SW, int(CAP * 0.62) + TH), rect(CX + 40, MID - TH // 2, RX - CX - 40, TH)]
    return []


DERIVATION = {
    "A": ("A", "direct source — peak, legs, crossbar"),
    "B": ("B", "direct source — stem, two bumps"),
    "C": ("C", "direct source — open arc"),
    "D": ("C", "flipH(C) + B-stem rect to close"),
    "E": ("B+A", "B-stem + A-bar × 3 heights"),
    "F": ("B+A", "E minus bottom bar"),
    "G": ("C", "C + mid-right bar"),
    "H": ("B+A", "2 B-stems + A-bar cross"),
    "I": ("B", "B-stem centered + A-serif bars"),
    "J": ("C+B", "C scaled as hook + B-stem right"),
    "K": ("B+A", "B-stem + A-angle diagonals from mid"),
    "L": ("B+A", "B-stem + A-bar base"),
    "M": ("A+B", "scaled A between 2 B-stems"),
    "N": ("B+A", "2 B-stems + A-angle diagonal"),
    "O": ("C", "C + flipH(C) ring"),
    "P": ("C+B", "B-stem + flipH(C) top-half arc"),
    "Q": ("C", "O + diagonal tail"),
    "R": ("C+B", "P + A-angle lower leg"),
    "S": ("C", "C top + flipH(C) bottom stacked"),
    "T": ("B+A", "B-stem centered + A-bar top"),
    "U": ("C+B", "C rotated 90° as bowl + 2 B-stems"),
    "V": ("A", "A-angle diagonals meeting at bottom"),
    "W": ("A", "V × 2 side by side"),
    "X": ("A", "A + flipV(A, mid) — organic cross"),
    "Y": ("A+B", "A-angle arms + B-stem below fork"),
    "Z": ("A+B", "A-diagonal + A-bars + mid bar (handwritten z)"),
    "a": ("C+B", "O ring + right B-stem + eye bar"),
    "b": ("C+B", "full B-stem + lower flipH(C) arc"),
    "c": ("C", "C scaled to standard margins"),
    "d": ("C+B", "lower C arc + right B-stem"),
    "e": ("C", "O ring + wide mid bar"),
    "f": ("C+B", "C hook + B-stem + crossbar"),
    "g": ("C+B", "O ring + right stem + C tail"),
    "h": ("C+B", "full B-stem + n-arch (C rotated)"),
    "i": ("B", "B-stem centered + top dot"),
    "j": ("C+B", "J + dot"),
    "k": ("B+A", "same as K"),
    "l": ("B", "thin B-stem"),
    "m": ("C+B", "B-stem + 2 compressed P-arcs"),
    "n": ("C+B", "B-stem + n-arch (C rotated 90°)"),
    "o": ("C", "same as O"),
    "p": ("C+B", "same as P"),
    "q": ("C+B", "right B-stem + upper C arc"),
    "r": ("C+B", "B-stem + short upper arm"),
    "s": ("C", "same as S"),
    "t": ("B+A", "B-stem + A-bar cross + top cap"),
    "u": ("C+B", "same as U"),
    "v": ("A", "same as V"),
    "w": ("A", "same as W"),
    "x": ("A", "same as X — coordinate axis"),
    "y": ("A+B", "same as Y — coordinate axis"),
    "z": ("A+B", "same as Z + mid bar — coordinate axis"),
    "0": ("C", "C + flipH(C) ring — same as O"),
    "1": ("B+A", "B-stem + A-flag + base serif"),
    "2": ("C+A", "flipH(C) top arc + A-angle diagonal + base"),
    "3": ("C", "flipH(C) × 2 stacked at 50% height"),
    "4": ("A+B", "A-angle arm + B-crossbar + right B-stem"),
    "5": ("C+B", "top A-bar + left B-stem + lower D-arc"),
    "6": ("C", "lower O ring + upper C hook"),
    "7": ("A+B", "A-bar top + A-angle diagonal + mid bar"),
    "8": ("C", "two O rings stacked (top 48% + bot 52%)"),
    "9": ("C+B", "upper O ring + right B-stem + C tail (6 flipV)"),
}

UPPERCASE = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
LOWERCASE = list("abcdefghijklmnopqrstuvwxyz")
DIGITS = list("0123456789")
AXIS_CHARS = set("XYZxyz")

COLS = 13
CELL_W = 130
CELL_H = 170
LABEL_H = 36
PAD = 16
S = CELL_W / 1500.0
SVG_W = COLS * CELL_W + 2 * PAD
SVG_H = 5 * (CELL_H + LABEL_H) + 2 * PAD + 3 * 22
_SEC = [0, 0, 22, 22, 44]


def cell_tf(col, row):
    x0 = PAD + col * CELL_W
    y0 = PAD + row * (CELL_H + LABEL_H) + _SEC[row]
    return f"matrix({S:.5f},0,0,{-S:.5f},{x0:.1f},{y0 + CAP*S:.1f})"


def cell_xy(col, row):
    x0 = PAD + col * CELL_W
    y0 = PAD + row * (CELL_H + LABEL_H) + _SEC[row]
    return x0, y0


_TOKEN_RE = re.compile(r"[A-Za-z]|-?\d+(?:\.\d+)?")


def glyph_bbox(paths):
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")

    def add_point(x, y):
        nonlocal min_x, min_y, max_x, max_y
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x)
        max_y = max(max_y, y)

    for d in paths:
        tokens = _TOKEN_RE.findall(d)
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
            else:
                raise ValueError(f"Unsupported SVG command for centering: {cmd}")

    if min_x == float("inf"):
        return (0.0, 0.0, 0.0, 0.0)
    return (min_x, min_y, max_x, max_y)


def build_svg():
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_W}" height="{SVG_H}" viewBox="0 0 {SVG_W} {SVG_H}">']
    out.append("""<style>
  .glyph-cell { cursor:pointer }
  .glyph-cell:hover .bg { fill:#f5f0ff }
  .glyph-path { transition:fill .15s }
  .glyph-cell:hover .glyph-path { fill:#5d00b8 }
  .axis-cell .bg { fill:#fffbe6 }
  .axis-cell:hover .bg { fill:#fff0a0 }
  .axis-cell .glyph-path { fill:#b85d00 }
  .axis-cell:hover .glyph-path { fill:#c0392b }
  .lbl { font:bold 11px monospace; fill:#555 }
  .sec { font:bold 13px sans-serif; fill:#888 }
</style>""")
    all_chars = [(UPPERCASE[:13], 0), (UPPERCASE[13:], 1), (LOWERCASE[:13], 2), (LOWERCASE[13:], 3), (DIGITS, 4)]
    for chars_row, row in all_chars:
        if row == 0:
            out.append(f'<text class="sec" x="{PAD}" y="{PAD+14}">UPPERCASE</text>')
        if row == 2:
            sy = PAD + 2 * (CELL_H + LABEL_H) + _SEC[2] - 6
            out.append(f'<text class="sec" x="{PAD}" y="{sy}">LOWERCASE  (x = X, y = Y, z = Z — coordinate axis)</text>')
        if row == 4:
            sy = PAD + 4 * (CELL_H + LABEL_H) + _SEC[4] - 6
            out.append(f'<text class="sec" x="{PAD}" y="{sy}">DIGITS  0–9</text>')
        for col, ch in enumerate(chars_row):
            x0, y0 = cell_xy(col, row)
            is_axis = ch in AXIS_CHARS
            src, _desc = DERIVATION.get(ch, ("?", ""))
            gps = glyph_digit(ch) if ch in DIGITS else glyph_lc(ch) if ch.islower() else glyph_UC(ch)
            cls = "axis-cell glyph-cell" if is_axis else "glyph-cell"
            out.append(f'<g class="{cls}" data-ch="{ch}" data-src="{src}">')
            out.append(f'  <rect class="bg" x="{x0}" y="{y0}" width="{CELL_W}" height="{CELL_H}" fill="#fafafa" stroke="#ddd"/>')
            min_x, min_y, max_x, max_y = glyph_bbox(gps)
            dx = (1500 - (max_x - min_x)) / 2 - min_x
            dy = (CAP - (max_y - min_y)) / 2 - min_y
            a, b, c, d, e, f = [float(v) for v in cell_tf(col, row)[7:-1].split(",")]
            tf = f"matrix({a:.5f},{b:.0f},{c:.0f},{d:.5f},{e + dx*S:.1f},{f - dy*S:.1f})"
            out.append(f'  <g transform="{tf}" fill-rule="nonzero">')
            for d in gps:
                out.append(f'    <path class="glyph-path" d="{d}"/>')
            out.append("  </g>")
            out.append(f'  <text class="lbl" x="{x0+4}" y="{y0 + CELL_H + 14}">{ch} ← {src}</text>')
            out.append("</g>")
    out.append("</svg>")
    return "\n".join(out)


def build_html():
    svg = build_svg()
    deriv_js = "\n".join(f'  "{c}": "{DERIVATION[c][1]}",' for c in list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + list("abcdefghijklmnopqrstuvwxyz") + list("0123456789"))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ABC Alphabet — AntiqueOlive derived</title>
<style>
  body {{ font-family:sans-serif; background:#fff; padding:20px; }}
  h1   {{ font-size:16px; margin-bottom:4px }}
  p    {{ font-size:11px; color:#888; margin-bottom:14px }}
  #info {{ margin-top:10px; font-size:12px; color:#333; min-height:32px }}
  #info strong {{ font-size:16px }}
</style>
</head>
<body>
<h1>A B C → full alphabet  (source: AntiqueOlive-Regular, only A/B/C outlines)</h1>
<p>Orange = coordinate-axis glyphs (X Y Z shared uppercase/lowercase). Hover for derivation.</p>
{svg}
<div id="info">Hover a glyph.</div>
<script>
const deriv = {{
{deriv_js}
}};
document.querySelectorAll('.glyph-cell').forEach(el => {{
  el.addEventListener('mouseenter', () => {{
    const ch = el.dataset.ch, src = el.dataset.src;
    document.getElementById('info').innerHTML =
      `<strong>${{ch}}</strong> &larr; ${{src}} &nbsp;|&nbsp; ${{deriv[ch] || ''}}`;
  }});
}});
</script>
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
