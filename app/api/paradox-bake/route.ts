import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type BakedObject = {
  id: string;
  name: string;
  src: string;
  layer: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function safeName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'asset';
}

function parseDataUrl(src: string) {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(src);
  if (!match) return null;
  const mime = match[1];
  const ext = MIME_EXTENSIONS[mime] ?? 'bin';
  return {
    ext,
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as { objects?: BakedObject[] } | null;
  if (!payload || !Array.isArray(payload.objects)) {
    return NextResponse.json({ error: 'Invalid paradox bake payload' }, { status: 400 });
  }

  const publicDir = path.join(process.cwd(), 'public');
  const assetRoot = path.join(publicDir, 'paradox-assets');
  const imageDir = path.join(assetRoot, 'images');
  await mkdir(imageDir, { recursive: true });

  let written = 0;
  const objects = await Promise.all(payload.objects.map(async (item, index) => {
    if (item.src.startsWith('/paradox-assets/')) return item;

    const parsed = parseDataUrl(item.src);
    if (!parsed) return item;

    const fileName = `${String(index + 1).padStart(3, '0')}-${safeName(item.id)}-${safeName(item.name)}.${parsed.ext}`;
    const filePath = path.join(imageDir, fileName);
    await writeFile(filePath, parsed.buffer);
    written += 1;

    return {
      ...item,
      src: `/paradox-assets/images/${fileName}`,
    };
  }));

  await writeFile(
    path.join(assetRoot, 'layout.json'),
    JSON.stringify({
      version: 1,
      bakedAt: new Date().toISOString(),
      objects,
    }, null, 2),
  );

  return NextResponse.json({ written, objects });
}
