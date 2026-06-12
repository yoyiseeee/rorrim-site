# IKEA mirror catalogue scan

Runs a contained asset pipeline for candidate mirror pages in IKEA Museum catalogues.

```bash
node scripts/scan-ikea-mirrors/scan.mjs --years 1950,1951,1952,1953,1961
```

Outputs:

- Raw rendered pages: `ikea-mirror-scan/YYYY/page_0001.png`
- OCR cache: `ikea-mirror-scan/YYYY/ocr.json`
- Visual heuristic cache: `ikea-mirror-scan/YYYY/visual.json`
- Candidate images: `public/noclipping/ikea-mirror-catalogue/`
- Candidate index: `public/noclipping/ikea-mirror-catalogue/index.json`
- Manual review grid: `public/noclipping/ikea-mirror-catalogue/review.html`

Useful options:

- `--years 1950,1951` limits the catalogue years.
- `--force` re-fetches metadata/PDFs and regenerates render/OCR/visual caches.
- `--threshold 0.58` changes the final candidate cutoff.
- `--visual-only-threshold 0.98` allows very high-confidence visual-only pages into the final output. It defaults to disabled because the current contour heuristic intentionally avoids flooding the review set.
- `--skip-ocr` or `--skip-visual` reuse existing cache files.
