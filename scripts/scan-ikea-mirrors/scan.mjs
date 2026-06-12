#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_YEARS = ["1950", "1951", "1952", "1953", "1961"];
const OCR_KEYWORDS = [
  "mirror",
  "mirrors",
  "looking glass",
  "bathroom",
  "wardrobe",
  "dressing table",
  "vanity",
  "reflection",
  "reflective",
  "spegel",
  "speglar",
  "badrum",
  "garderob",
  "toalettbord",
  "reflex",
  "spegling",
];
const PRIMARY_OCR_KEYWORDS = [
  "mirror",
  "mirrors",
  "looking glass",
  "bathroom",
  "vanity mirror",
  "reflection",
  "reflective",
  "spegel",
  "speglar",
  "spegelglas",
  "toalettspegel",
  "badrum",
  "reflexion",
  "spegling",
];
const OCR_FALSE_CONTEXT = [
  "spegelreflex",
  "innehållsförteckning",
  "innehallsforteckning",
  "rättelser till denna katalog",
  "rattelser till denna katalog",
];

const root = process.cwd();
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const scanRoot = path.join(root, "ikea-mirror-scan");
const outputDir = path.join(root, "public", "noclipping", "ikea-mirror-catalogue");

const options = parseArgs(process.argv.slice(2));

function parseArgs(args) {
  const out = {
    years: DEFAULT_YEARS,
    threshold: 0.58,
    visualOnlyThreshold: 1.01,
    maxWidth: 1800,
    force: false,
    skipOcr: false,
    skipVisual: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--years") out.years = args[++i].split(",").map((year) => year.trim()).filter(Boolean);
    else if (arg === "--threshold") out.threshold = Number(args[++i]);
    else if (arg === "--visual-only-threshold") out.visualOnlyThreshold = Number(args[++i]);
    else if (arg === "--max-width") out.maxWidth = Number(args[++i]);
    else if (arg === "--force") out.force = true;
    else if (arg === "--skip-ocr") out.skipOcr = true;
    else if (arg === "--skip-visual") out.skipVisual = true;
    else if (arg === "--help") {
      console.log("Usage: node scripts/scan-ikea-mirrors/scan.mjs [--years 1950,1951] [--threshold 0.58] [--visual-only-threshold 0.98] [--force]");
      process.exit(0);
    }
  }
  return out;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 ikea-mirror-scan/1.0",
      "accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function download(url, file) {
  const tmp = `${file}.tmp`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 ikea-mirror-scan/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, file);
  return buffer.length;
}

function extractPublicationUrl(html, year) {
  const match = html.match(/data-publication="([^"]+)"/);
  if (match) return match[1].replace(/&amp;/g, "&");
  return `https://ikeacatalogues.ikea.com/sv-${year}/`;
}

function extractReaderData(html) {
  const marker = "var data";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) throw new Error("Publitas reader data not found");
  const equalsIndex = html.indexOf("=", markerIndex);
  const start = html.indexOf("{", equalsIndex);
  if (start === -1) throw new Error("Publitas reader JSON start not found");

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }
  throw new Error("Publitas reader JSON end not found");
}

async function pageFiles(pageDir) {
  try {
    return (await fs.readdir(pageDir))
      .filter((name) => /^page_\d{4}\.png$/.test(name))
      .sort();
  } catch {
    return [];
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}

function keywordMatches(text) {
  const normalized = text.toLowerCase();
  return OCR_KEYWORDS.filter((keyword) => normalized.includes(keyword));
}

function scoreOcr(text) {
  const normalized = text.toLowerCase();
  const matches = keywordMatches(text);
  const primaryMatches = PRIMARY_OCR_KEYWORDS.filter((keyword) => normalized.includes(keyword));
  if (primaryMatches.length === 0) return { score: 0, matches };

  const hasFalseContext = OCR_FALSE_CONTEXT.some((phrase) => normalized.includes(phrase));
  const onlyReflex = primaryMatches.every((keyword) => keyword === "reflexion" || keyword === "reflection" || keyword === "reflective");
  if (hasFalseContext || normalized.includes("spegelreflex") || onlyReflex) {
    return { score: 0, matches };
  }

  return {
    score: Math.min(0.95, 0.66 + primaryMatches.length * 0.07 + Math.max(0, matches.length - primaryMatches.length) * 0.02),
    matches,
  };
}

function combineRecord(year, page, ocr, visual) {
  const ocrScore = scoreOcr(ocr?.text ?? "");
  const visualScore = Number(visual?.score ?? 0);
  const visualOnlyScore = visualScore >= options.visualOnlyThreshold ? visualScore : 0;
  const score = Math.max(ocrScore.score, visualOnlyScore);
  const reasons = [];
  if (ocrScore.matches.length) reasons.push(`OCR keywords: ${ocrScore.matches.join(", ")}`);
  if (visualScore >= 0.5) reasons.push(visual.reason || "visual mirror-like cue");
  if (!reasons.length) reasons.push("weak mirror cue");
  return {
    year,
    page,
    score: Number(score.toFixed(2)),
    reason: reasons.join(" / "),
  };
}

async function cleanOutput() {
  await ensureDir(outputDir);
  const files = await fs.readdir(outputDir).catch(() => []);
  await Promise.all(files
    .filter((name) => /^\d{4}_page_\d{4}_score_\d+\.\d+\.png$/.test(name) || name === "index.json" || name === "review.html")
    .map((name) => fs.unlink(path.join(outputDir, name)).catch(() => {})));
}

async function copyCandidate(record, sourcePath) {
  const filename = `${record.year}_page_${String(record.page).padStart(4, "0")}_score_${record.score.toFixed(2)}.png`;
  const dest = path.join(outputDir, filename);
  await fs.copyFile(sourcePath, dest);
  return `/noclipping/ikea-mirror-catalogue/${filename}`;
}

function reviewHtml(records) {
  const payload = JSON.stringify(records, null, 2).replace(/</g, "\\u003c");
  const cards = records.map((record) => `
    <article class="card">
      <img src="${record.image}" alt="${record.year} page ${record.page}">
      <div class="meta">
        <strong>${record.year} / page ${record.page}</strong>
        <span>score ${record.score.toFixed(2)}</span>
        <p>${escapeHtml(record.reason)}</p>
      </div>
    </article>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IKEA mirror catalogue review</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f3ee; color: #191919; }
    header { position: sticky; top: 0; z-index: 1; padding: 16px 20px; background: rgba(245, 243, 238, 0.94); border-bottom: 1px solid #d9d4ca; backdrop-filter: blur(10px); }
    h1 { margin: 0; font-size: 18px; }
    header p { margin: 4px 0 0; color: #5f5a51; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; padding: 20px; }
    .card { background: #fff; border: 1px solid #ddd7cc; border-radius: 6px; overflow: hidden; }
    img { display: block; width: 100%; background: #eee8dd; }
    .meta { padding: 10px 12px 12px; }
    .meta strong, .meta span { display: block; }
    .meta span { color: #686158; font-size: 12px; margin-top: 2px; }
    .meta p { margin: 8px 0 0; color: #403b34; }
  </style>
</head>
<body>
  <header>
    <h1>IKEA mirror catalogue candidates</h1>
    <p>${records.length} candidate pages. Delete unwanted PNG files here, then regenerate index if needed.</p>
  </header>
  <main>${cards}</main>
  <script type="application/json" id="records">${payload}</script>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function processYear(year) {
  const yearDir = path.join(scanRoot, year);
  const pageDir = yearDir;
  const metaPath = path.join(yearDir, "metadata.json");
  const pdfPath = path.join(yearDir, "catalogue.pdf");
  const ocrPath = path.join(yearDir, "ocr.json");
  const visualPath = path.join(yearDir, "visual.json");
  await ensureDir(yearDir);

  console.log(`\n[${year}] Fetching catalogue metadata`);
  let metadata = await readJson(metaPath);
  if (!metadata || options.force) {
    const museumUrl = `https://ikeamuseum.com/en/explore/ikea-catalogue/${year}-ikea-catalogue/`;
    const museumHtml = await fetchText(museumUrl);
    const publicationUrl = extractPublicationUrl(museumHtml, year);
    const publicationHtml = await fetchText(publicationUrl);
    const data = extractReaderData(publicationHtml);
    metadata = {
      year,
      museumUrl,
      publicationUrl,
      publicationId: data.id,
      groupId: data.groupId,
      slug: data.slug,
      numPages: data.numPages,
      pdfUrl: data.config?.downloadPdfUrl ?? null,
      fetchedAt: new Date().toISOString(),
      sourceHash: createHash("sha256").update(publicationHtml).digest("hex"),
    };
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  if (!metadata.pdfUrl) {
    throw new Error(`[${year}] no PDF URL found; Playwright fallback is not implemented in this offline run`);
  }

  if (!(await exists(pdfPath)) || options.force) {
    console.log(`[${year}] Downloading PDF`);
    const bytes = await download(metadata.pdfUrl, pdfPath);
    console.log(`[${year}] Downloaded ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  }

  const pages = await pageFiles(pageDir);
  if (pages.length < metadata.numPages || options.force) {
    console.log(`[${year}] Rendering ${metadata.numPages} PDF pages`);
    run("swift", [
      path.join(scriptDir, "render_pdf_pages.swift"),
      pdfPath,
      pageDir,
      String(options.maxWidth),
    ]);
  } else {
    console.log(`[${year}] Reusing ${pages.length} rendered pages`);
  }

  if (!options.skipOcr && (!(await exists(ocrPath)) || options.force)) {
    console.log(`[${year}] Running Vision OCR`);
    run("swift", [path.join(scriptDir, "ocr_images.swift"), pageDir, ocrPath]);
  }

  if (!options.skipVisual && (!(await exists(visualPath)) || options.force)) {
    console.log(`[${year}] Running visual mirror heuristics`);
    run("python3", [path.join(scriptDir, "visual_score.py"), pageDir, visualPath]);
  }

  const ocrRecords = new Map((await readJson(ocrPath, [])).map((item) => [item.page, item]));
  const visualRecords = new Map((await readJson(visualPath, [])).map((item) => [item.page, item]));
  const currentPages = await pageFiles(pageDir);
  const records = [];
  for (const file of currentPages) {
    const page = Number(file.match(/page_(\d{4})\.png$/)?.[1] ?? 0);
    const combined = combineRecord(year, page, ocrRecords.get(page), visualRecords.get(page));
    if (combined.score >= options.threshold) {
      records.push({
        ...combined,
        source: path.join(pageDir, file),
      });
    }
  }

  console.log(`[${year}] ${records.length} candidate pages`);
  return { metadata, records };
}

async function main() {
  await ensureDir(scanRoot);
  await cleanOutput();

  const allRecords = [];
  const summaries = [];
  for (const year of options.years) {
    const { metadata, records } = await processYear(year);
    summaries.push({ year, pages: metadata.numPages, candidates: records.length });
    for (const record of records) {
      const image = await copyCandidate(record, record.source);
      const publicRecord = { ...record };
      delete publicRecord.source;
      allRecords.push({ ...publicRecord, image });
    }
  }

  allRecords.sort((a, b) => a.year.localeCompare(b.year) || a.page - b.page);
  await fs.writeFile(path.join(outputDir, "index.json"), JSON.stringify(allRecords, null, 2));
  await fs.writeFile(path.join(outputDir, "review.html"), reviewHtml(allRecords));

  console.log("\nDone");
  console.table(summaries);
  console.log(`Candidates: ${allRecords.length}`);
  console.log(`Output: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
