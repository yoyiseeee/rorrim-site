#!/usr/bin/env python3
"""
Export the current ABC-derived glyph system from generate.py into:
- a Glyphs source file (.glyphs)
- a JSON export map for auditing

generate.py is the single source of truth. We do not read alphabet.html/svg.
"""

from __future__ import annotations

import importlib.util
import json
import math
import os
import plistlib
import re
import sys
import uuid
from dataclasses import dataclass
from typing import Any

from fontTools.pens.recordingPen import RecordingPen
from fontTools.svgLib.path import parse_path


ROOT = os.path.dirname(__file__)
GENERATE_PY = os.path.join(ROOT, "generate.py")
OUT_GLYPHS = os.path.join(ROOT, "ABC-derived.glyphs")
OUT_MAP = os.path.join(ROOT, "export_map.json")

MASTER_NAME = "Regular"
FONT_FAMILY_NAME = "rorrim"
UPM = 1500
ASCENDER = 1534
DESCENDER = -320
LINE_GAP = 250


@dataclass
class Node:
    x: float
    y: float
    kind: str  # LINE / CURVE / OFFCURVE


@dataclass
class Contour:
    nodes: list[Node]
    closed: bool = True


@dataclass
class GlyphExport:
    char: str
    glyph_name: str
    unicode_hex: str
    width: int
    category: str
    source_function: str
    delegated_from: str | None
    derivation_source: str
    derivation_note: str
    contours: list[Contour]


def load_generate_module():
    spec = importlib.util.spec_from_file_location("alphabet_generate", GENERATE_PY)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def char_to_glyph_name(ch: str) -> str:
    if ch.isalpha():
        return ch
    return {
        "0": "zero",
        "1": "one",
        "2": "two",
        "3": "three",
        "4": "four",
        "5": "five",
        "6": "six",
        "7": "seven",
        "8": "eight",
        "9": "nine",
    }[ch]


def char_category(ch: str) -> str:
    if ch.isupper():
        return "uppercase"
    if ch.islower():
        return "lowercase"
    return "digit"


def source_function_name(ch: str) -> str:
    if ch.isupper():
        return "glyph_UC"
    if ch.islower():
        return "glyph_lc"
    return "glyph_digit"


def delegated_from(ch: str) -> str | None:
    if ch in "xyz":
        # Keep this explicit in the export map so these can later diverge into
        # independent lowercase designs without changing the file format.
        return f"glyph_UC('{ch.upper()}') via glyph_lc('{ch}')"
    return None


def get_paths(generate: Any, ch: str) -> list[str]:
    if ch.isupper():
        return generate.glyph_UC(ch)
    if ch.islower():
        return generate.glyph_lc(ch)
    return generate.glyph_digit(ch)


def glyph_center_offsets(generate: Any, paths: list[str]) -> tuple[float, float]:
    min_x, min_y, max_x, max_y = generate.glyph_bbox(paths)
    dx = (UPM - (max_x - min_x)) / 2 - min_x
    dy = (generate.CAP - (max_y - min_y)) / 2 - min_y
    return dx, dy


def quad_to_cubic(p0: tuple[float, float], p1: tuple[float, float], p2: tuple[float, float]):
    c1 = (
        p0[0] + (2.0 / 3.0) * (p1[0] - p0[0]),
        p0[1] + (2.0 / 3.0) * (p1[1] - p0[1]),
    )
    c2 = (
        p2[0] + (2.0 / 3.0) * (p1[0] - p2[0]),
        p2[1] + (2.0 / 3.0) * (p1[1] - p2[1]),
    )
    return c1, c2, p2


def points_equal(a: Node, b: Node, tol: float = 1e-6) -> bool:
    return abs(a.x - b.x) <= tol and abs(a.y - b.y) <= tol


def contours_from_svg_path(pathdef: str) -> list[Contour]:
    pen = RecordingPen()
    parse_path(pathdef, pen)

    contours: list[Contour] = []
    nodes: list[Node] = []
    current: tuple[float, float] | None = None
    start: tuple[float, float] | None = None

    def flush(closed: bool):
        nonlocal nodes
        if not nodes:
            return
        contour_nodes = nodes[:]
        if closed and len(contour_nodes) >= 2 and points_equal(contour_nodes[-1], contour_nodes[0]):
            last = contour_nodes.pop()
            contour_nodes[0].kind = last.kind
        contours.append(Contour(nodes=contour_nodes, closed=closed))
        nodes = []

    for op, pts in pen.value:
        if op == "moveTo":
            flush(closed=False)
            x, y = pts[0]
            start = (x, y)
            current = (x, y)
            nodes = [Node(x, y, "LINE")]
        elif op == "lineTo":
            x, y = pts[0]
            nodes.append(Node(x, y, "LINE"))
            current = (x, y)
        elif op == "curveTo":
            c1, c2, end = pts
            nodes.append(Node(c1[0], c1[1], "OFFCURVE"))
            nodes.append(Node(c2[0], c2[1], "OFFCURVE"))
            nodes.append(Node(end[0], end[1], "CURVE"))
            current = end
        elif op == "qCurveTo":
            assert current is not None
            if len(pts) != 2:
                raise ValueError(f"Unsupported qCurveTo segment count: {pts}")
            c1, c2, end = quad_to_cubic(current, pts[0], pts[1])
            nodes.append(Node(c1[0], c1[1], "OFFCURVE"))
            nodes.append(Node(c2[0], c2[1], "OFFCURVE"))
            nodes.append(Node(end[0], end[1], "CURVE"))
            current = end
        elif op == "closePath":
            if start is not None and current is not None and (current[0] != start[0] or current[1] != start[1]):
                nodes.append(Node(start[0], start[1], "LINE"))
            flush(closed=True)
            current = None
            start = None
        elif op == "endPath":
            flush(closed=False)
            current = None
            start = None
        else:
            raise ValueError(f"Unsupported SVG pen op: {op}")

    flush(closed=False)
    return contours


def centered_contours(generate: Any, paths: list[str]) -> list[Contour]:
    dx, dy = glyph_center_offsets(generate, paths)
    contours: list[Contour] = []
    for pathdef in paths:
        for contour in contours_from_svg_path(pathdef):
            shifted = [
                Node(
                    x=node.x + dx,
                    y=node.y + dy,
                    kind=node.kind,
                )
                for node in contour.nodes
            ]
            contours.append(Contour(nodes=shifted, closed=contour.closed))
    return contours


def collect_exports(generate: Any) -> list[GlyphExport]:
    exports: list[GlyphExport] = []
    charset = list(generate.UPPERCASE) + list(generate.LOWERCASE) + list(generate.DIGITS)

    for ch in charset:
        paths = get_paths(generate, ch)
        if not paths:
            raise ValueError(f"No paths returned for {ch!r}")

        derivation_source, derivation_note = generate.DERIVATION[ch]
        exports.append(
            GlyphExport(
                char=ch,
                glyph_name=char_to_glyph_name(ch),
                unicode_hex=f"{ord(ch):04X}",
                width=UPM,
                category=char_category(ch),
                source_function=source_function_name(ch),
                delegated_from=delegated_from(ch),
                derivation_source=derivation_source,
                derivation_note=derivation_note,
                contours=centered_contours(generate, paths),
            )
        )
    return exports


def encode_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def format_number(value: float | int) -> str:
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if math.isclose(value, round(value), abs_tol=1e-6):
        return str(int(round(value)))
    return f"{value:.6f}".rstrip("0").rstrip(".")


def needs_quotes(key: str) -> bool:
    return re.fullmatch(r"[A-Za-z0-9_.]+", key) is None


def format_key(key: str) -> str:
    return encode_string(key) if needs_quotes(key) else key


def serialize_openstep(value: Any, indent: int = 0) -> str:
    pad = "  " * indent
    next_pad = "  " * (indent + 1)

    if isinstance(value, dict):
        lines = ["{"]
        for key, item in value.items():
            lines.append(f"{next_pad}{format_key(key)} = {serialize_openstep(item, indent + 1)};")
        lines.append(f"{pad}}}")
        return "\n".join(lines)

    if isinstance(value, list):
        if not value:
            return "()"
        lines = ["("]
        for item in value:
            lines.append(f"{next_pad}{serialize_openstep(item, indent + 1)},")
        lines.append(f"{pad})")
        return "\n".join(lines)

    if isinstance(value, str):
        return encode_string(value)

    if isinstance(value, (int, float, bool)):
        return format_number(value)

    raise TypeError(f"Unsupported OpenStep value: {type(value)!r}")


def node_string(node: Node) -> str:
    x = format_number(node.x)
    y = format_number(node.y)
    return f"{x} {y} {node.kind}"


def contour_dict(contour: Contour) -> dict[str, Any]:
    return {
        "closed": 1 if contour.closed else 0,
        "nodes": [node_string(node) for node in contour.nodes],
    }


def layer_dict(master_id: str, glyph: GlyphExport) -> dict[str, Any]:
    return {
        "layerId": master_id,
        "width": glyph.width,
        "paths": [contour_dict(contour) for contour in glyph.contours],
    }


def glyph_dict(master_id: str, glyph: GlyphExport) -> dict[str, Any]:
    return {
        "glyphname": glyph.glyph_name,
        "unicode": glyph.unicode_hex,
        "layers": [layer_dict(master_id, glyph)],
    }


def font_master_dict(master_id: str) -> dict[str, Any]:
    return {
        "id": master_id,
        "name": MASTER_NAME,
        "ascender": ASCENDER,
        "capHeight": ASCENDER,
        "descender": DESCENDER,
        "xHeight": 767,
        "customParameters": [
            {"name": "typoAscender", "value": ASCENDER},
            {"name": "typoDescender", "value": DESCENDER},
            {"name": "typoLineGap", "value": LINE_GAP},
            {"name": "hheaAscender", "value": ASCENDER},
            {"name": "hheaDescender", "value": DESCENDER},
            {"name": "hheaLineGap", "value": LINE_GAP},
        ],
    }


def glyphs_file_dict(exports: list[GlyphExport], master_id: str) -> dict[str, Any]:
    return {
        ".appVersion": "3220",
        "formatVersion": 2,
        "familyName": FONT_FAMILY_NAME,
        "unitsPerEm": UPM,
        "versionMajor": 1,
        "versionMinor": 0,
        "customParameters": [
            {"name": "Use Typo Metrics", "value": 1},
            {"name": "winAscent", "value": ASCENDER + LINE_GAP},
            {"name": "winDescent", "value": abs(DESCENDER)},
        ],
        "fontMaster": [font_master_dict(master_id)],
        "glyphs": [glyph_dict(master_id, glyph) for glyph in exports],
    }


def export_map(exports: list[GlyphExport]) -> dict[str, Any]:
    return {
        "source_of_truth": GENERATE_PY,
        "notes": [
            "All outlines are exported directly from generate.py.",
            "No geometry is reconstructed from alphabet.html or alphabet.svg.",
            "Lowercase x/y/z currently reuse uppercase X/Y/Z logic via glyph_lc delegation.",
        ],
        "glyphs": [
            {
                "char": glyph.char,
                "glyph_name": glyph.glyph_name,
                "unicode": glyph.unicode_hex,
                "category": glyph.category,
                "source_function": glyph.source_function,
                "delegated_from": glyph.delegated_from,
                "derivation_source": glyph.derivation_source,
                "derivation_note": glyph.derivation_note,
                "width": glyph.width,
                "contour_count": len(glyph.contours),
                "node_count": sum(len(contour.nodes) for contour in glyph.contours),
            }
            for glyph in exports
        ],
    }


def write_glyphs_plist(path: str, payload: Any):
    with open(path, "wb") as f:
        plistlib.dump(payload, f, sort_keys=False)


def write_json(path: str, payload: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    generate = load_generate_module()
    exports = collect_exports(generate)
    failures: list[str] = []

    master_id = str(uuid.uuid4()).upper()
    glyphs_payload = glyphs_file_dict(exports, master_id)

    try:
        write_glyphs_plist(OUT_GLYPHS, glyphs_payload)
    except Exception as exc:  # pragma: no cover - user-facing export report
        failures.append(f"glyphs:{exc}")

    try:
        write_json(OUT_MAP, export_map(exports))
    except Exception as exc:  # pragma: no cover - user-facing export report
        failures.append(f"export_map:{exc}")

    exported_names = [glyph.glyph_name for glyph in exports]
    print(f"Exported {len(exports)} glyphs")
    print("Glyphs:", ", ".join(exported_names))
    print(f"Glyphs file: {OUT_GLYPHS}")
    print(f"Export map: {OUT_MAP}")
    if failures:
        print("Failures:")
        for item in failures:
            print(f"- {item}")
    else:
        print("Failures: none")
        print("Openability: structure written as a standard .glyphs text source; not GUI-verified in this step.")


if __name__ == "__main__":
    main()
