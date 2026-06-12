#!/usr/bin/env python3
import json
import math
import os
import re
import sys

import cv2
import numpy as np


def page_number(path):
    match = re.search(r"page_(\d+)\.png$", os.path.basename(path))
    return int(match.group(1)) if match else 0


def resize_for_scan(image, max_side=1200):
    h, w = image.shape[:2]
    scale = min(1.0, max_side / max(h, w))
    if scale == 1.0:
        return image
    return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def clamp(value, lo=0.0, hi=1.0):
    return max(lo, min(hi, value))


def score_candidate(image, contour, page_area):
    x, y, w, h = cv2.boundingRect(contour)
    H, W = image.shape[:2]
    area = w * h
    if area < page_area * 0.004 or area > page_area * 0.42:
        return None
    if x <= 4 and y <= 4 and w >= W * 0.88 and h >= H * 0.88:
        return None

    aspect = w / max(h, 1)
    if aspect < 0.22 or aspect > 4.8:
        return None

    contour_area = abs(cv2.contourArea(contour))
    fill_ratio = contour_area / max(area, 1)
    perimeter = cv2.arcLength(contour, True)
    if perimeter <= 0:
        return None
    circularity = 4 * math.pi * contour_area / (perimeter * perimeter)
    approx = cv2.approxPolyDP(contour, 0.035 * perimeter, True)

    rectangular = len(approx) == 4 and 0.08 < fill_ratio < 0.98
    oval = len(contour) >= 20 and circularity > 0.42 and 0.4 < aspect < 2.5
    framed = rectangular or oval
    if not framed:
        return None

    pad_x = max(2, int(w * 0.12))
    pad_y = max(2, int(h * 0.12))
    ix0, iy0 = x + pad_x, y + pad_y
    ix1, iy1 = x + w - pad_x, y + h - pad_y
    if ix1 <= ix0 or iy1 <= iy0:
        return None

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    inner = hsv[iy0:iy1, ix0:ix1]
    inner_gray = gray[iy0:iy1, ix0:ix1]
    outer_gray = gray[y:y + h, x:x + w]

    saturation = float(inner[:, :, 1].mean())
    value = float(inner[:, :, 2].mean())
    highlights = float(np.mean((inner[:, :, 2] > 185) & (inner[:, :, 1] < 70)))
    darks = float(np.mean(inner[:, :, 2] < 65))
    contrast = float(inner_gray.std())
    border_contrast = abs(float(outer_gray.mean()) - float(inner_gray.mean()))

    edges = cv2.Canny(inner_gray, 60, 150)
    edge_density = float(np.mean(edges > 0))

    score = 0.26
    if rectangular:
        score += 0.14
    if oval:
        score += 0.17
    if 0.35 <= aspect <= 1.35:
        score += 0.10
    if saturation < 78:
        score += 0.11
    if value > 95:
        score += 0.08
    if highlights > 0.025:
        score += 0.10
    if 12 <= contrast <= 82:
        score += 0.07
    if 0.012 <= edge_density <= 0.18:
        score += 0.08
    if border_contrast > 9:
        score += 0.06
    if darks > 0.42:
        score -= 0.12

    # Very thin furniture legs, table tops, and text boxes often look rectangular.
    if aspect > 2.8 or aspect < 0.28:
        score -= 0.10
    if area < page_area * 0.012:
        score -= 0.06

    reason_bits = []
    if oval:
        reason_bits.append("oval framed reflective shape")
    if rectangular:
        reason_bits.append("rectangular framed reflective shape")
    if saturation < 78 and value > 95:
        reason_bits.append("low-saturation bright interior")
    if highlights > 0.025:
        reason_bits.append("highlight/reflection patches")

    return {
        "score": clamp(score),
        "box": [int(x), int(y), int(w), int(h)],
        "reason": " / ".join(reason_bits) or "visual mirror-like shape",
    }


def scan_image(path):
    image = cv2.imread(path, cv2.IMREAD_COLOR)
    if image is None:
        return {"page": page_number(path), "image": os.path.basename(path), "score": 0, "reason": "unreadable image", "candidates": []}

    image = resize_for_scan(image)
    H, W = image.shape[:2]
    page_area = H * W
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 45, 140)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        candidate = score_candidate(image, contour, page_area)
        if candidate:
            candidates.append(candidate)

    candidates.sort(key=lambda item: item["score"], reverse=True)
    top = candidates[:5]
    base = top[0]["score"] if top else 0.0
    if len([c for c in top if c["score"] >= 0.55]) >= 2:
        base = min(0.92, base + 0.05)

    return {
        "page": page_number(path),
        "image": os.path.basename(path),
        "score": round(float(base), 4),
        "reason": top[0]["reason"] if top else "no strong visual mirror cue",
        "candidates": top,
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: visual_score.py <page-dir> <output-json>", file=sys.stderr)
        sys.exit(1)

    page_dir, output_path = sys.argv[1], sys.argv[2]
    paths = [
        os.path.join(page_dir, name)
        for name in sorted(os.listdir(page_dir))
        if name.startswith("page_") and name.lower().endswith(".png")
    ]
    records = [scan_image(path) for path in paths]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    print(f"Visual scored {len(records)} pages")


if __name__ == "__main__":
    main()
