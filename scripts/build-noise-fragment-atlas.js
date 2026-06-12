const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'public/noise/topology-fragments');
const fallbackSourceDir = path.join(projectRoot, 'public/noise-prebaked/fragments');
const outputDir = path.join(projectRoot, 'public/noise-prebaked/atlas');
const atlasPath = path.join(outputDir, 'noise-fragments-atlas.webp');
const metadataPath = path.join(outputDir, 'noise-fragments-atlas.json');

const MAX_FRAGMENT_SIZE = 32;
const CELL_SIZE = 40;
const COLUMNS = 80;
const QUALITY = 18;

async function listPngFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPngFiles(entryPath));
    } else if (/\.png$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

function byTopologyPath(a, b) {
  const roomA = a.match(/room[_-](\d+)/i);
  const roomB = b.match(/room[_-](\d+)/i);
  const numberA = a.match(/(?:topo|fragment)[_-]?(\d+)\.png$/i);
  const numberB = b.match(/(?:topo|fragment)[_-]?(\d+)\.png$/i);
  const roomDiff = Number(roomA?.[1] ?? 0) - Number(roomB?.[1] ?? 0);
  if (roomDiff !== 0) return roomDiff;
  return Number(numberA?.[1] ?? 0) - Number(numberB?.[1] ?? 0);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  let sourceRoot = sourceDir;
  let files = await listPngFiles(sourceRoot).catch(() => []);
  if (files.length === 0) {
    sourceRoot = fallbackSourceDir;
    files = await listPngFiles(sourceRoot);
  }
  files.sort(byTopologyPath);

  const rows = Math.ceil(files.length / COLUMNS);
  const composites = [];
  const frames = [];
  const skipped = [];

  for (let index = 0; index < files.length; index += 1) {
    const inputPath = files[index];
    const relativeName = path.relative(sourceRoot, inputPath).replaceAll(path.sep, '/');
    const fileName = path.basename(inputPath);
    let buffer;
    let metadata;
    try {
      const resized = sharp(inputPath)
        .resize({
          width: MAX_FRAGMENT_SIZE,
          height: MAX_FRAGMENT_SIZE,
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.nearest,
        })
        .png({ compressionLevel: 9, palette: true, effort: 10 });

      buffer = await resized.toBuffer();
      metadata = await sharp(buffer).metadata();
    } catch (error) {
      skipped.push({ file: relativeName, reason: error.message });
      continue;
    }
    const width = metadata.width || MAX_FRAGMENT_SIZE;
    const height = metadata.height || MAX_FRAGMENT_SIZE;
    const frameIndex = frames.length;
    const column = frameIndex % COLUMNS;
    const row = Math.floor(frameIndex / COLUMNS);
    const left = column * CELL_SIZE + Math.floor((CELL_SIZE - width) / 2);
    const top = row * CELL_SIZE + Math.floor((CELL_SIZE - height) / 2);

    composites.push({ input: buffer, left, top });
    frames.push({
      id: `noise-prebaked-${String(index + 1).padStart(4, '0')}`,
      fileName: relativeName,
      x: left,
      y: top,
      width,
      height,
    });
  }

  const actualRows = Math.ceil(frames.length / COLUMNS);
  await sharp({
    create: {
      width: COLUMNS * CELL_SIZE,
      height: actualRows * CELL_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({
      quality: QUALITY,
      alphaQuality: 28,
      effort: 6,
      smartSubsample: false,
      nearLossless: false,
    })
    .toFile(atlasPath);

  const atlasStat = await fs.stat(atlasPath);
  const detailedMetadata = {
    generatedAt: new Date().toISOString(),
    source: path.relative(path.join(projectRoot, 'public'), sourceRoot).replaceAll(path.sep, '/'),
    atlas: '/noise-prebaked/atlas/noise-fragments-atlas.webp',
    format: 'webp',
    quality: QUALITY,
    count: files.length,
    usableCount: frames.length,
    skippedCount: skipped.length,
    skipped,
    columns: COLUMNS,
    cellSize: CELL_SIZE,
    maxFragmentSize: MAX_FRAGMENT_SIZE,
    width: COLUMNS * CELL_SIZE,
    height: actualRows * CELL_SIZE,
    bytes: atlasStat.size,
    frames,
  };
  await fs.writeFile(
    path.join(outputDir, 'noise-fragments-atlas.report.json'),
    JSON.stringify(detailedMetadata, null, 2),
  );
  await fs.writeFile(metadataPath, JSON.stringify({
    atlas: detailedMetadata.atlas,
    count: detailedMetadata.count,
    usableCount: detailedMetadata.usableCount,
    skippedCount: detailedMetadata.skippedCount,
    width: detailedMetadata.width,
    height: detailedMetadata.height,
    frames: frames.map((frame) => [frame.x, frame.y, frame.width, frame.height]),
  }));

  const originalStats = await Promise.all(files.map((file) => fs.stat(file)));
  const originalBytes = originalStats.reduce((sum, stat) => sum + stat.size, 0);
  console.log(JSON.stringify({
    count: files.length,
    usableCount: frames.length,
    skippedCount: skipped.length,
    originalBytes,
    atlasBytes: atlasStat.size,
    originalMB: +(originalBytes / 1024 / 1024).toFixed(2),
    atlasMB: +(atlasStat.size / 1024 / 1024).toFixed(2),
    atlasPath,
    metadataPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
