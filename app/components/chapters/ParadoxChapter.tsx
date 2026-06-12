'use client';

import {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './ParadoxChapter.module.css';

const MIRROR_WIDTH = 806;
const MIRROR_HEIGHT = 1125;
const MIRROR_ASPECT = MIRROR_WIDTH / MIRROR_HEIGHT;
const MIRROR_STAGE_HEIGHT_RATIO = MIRROR_HEIGHT / MIRROR_WIDTH;
const PORTAL_CENTER = { x: 50, y: 20.15 };
const PORTAL_WIDTH_MIN = 421;
const PORTAL_WIDTH_VW = 0.3888;
const PORTAL_WIDTH_MAX = 842;
const MAX_RECURSION_DEPTH = 4;
const MAX_PREVIEW_OBJECTS = 16;
const ZOOM_DURATION_MS = 3600;
const FINAL_RECURSION_DEPTH = 10;
const FINAL_SEQUENCE_EXIT_MS = 6800;
const PARADOX_CURSOR_HOTSPOT = { x: 80 / 256, y: 38 / 256 };
const FLEE_COOLDOWN_MS = 700;
const STORAGE_KEY = 'mirror-site:paradox-layer-layout:v1';
const DEV_PANEL_POSITION_KEY = 'mirror-site:paradox-dev-panel-position:v1';
const BAKED_LAYOUT_URL = '/paradox-assets/layout.json';
const PREFERRED_CAMERA_DEVICE_ID_KEY = 'mirror.preferredCameraDeviceId.v1';
const PREFERRED_CAMERA_LABEL_KEY = 'mirror.preferredCameraLabel.v1';
const DB_NAME = 'mirror-site-paradox-assets';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';
const INNER_BOUNDS = {
  left: 0.037,
  top: 0.031,
  width: 0.926,
  height: 0.934,
};
const INNER_SCENE_STYLE = {
  left: `${-(INNER_BOUNDS.left / INNER_BOUNDS.width) * 100}%`,
  top: `${-(INNER_BOUNDS.top / INNER_BOUNDS.height) * 100}%`,
  width: `${(1 / INNER_BOUNDS.width) * 100}%`,
  height: `${(1 / INNER_BOUNDS.height) * 100}%`,
} satisfies CSSProperties;
const MACBOOK_SCREEN_BOUNDS = {
  left: 64 / 608,
  top: 9 / 366,
  width: 480 / 608,
  height: 313 / 366,
};
const FINAL_TEXT_LINES = [
  { text: '1Alphabet', x: 23, y: 18 },
  { text: '2Noclipping', x: 68, y: 31 },
  { text: '3Dimension', x: 29, y: 52 },
  { text: '4Paradox', x: 66, y: 70 },
  { text: '5Noise', x: 36, y: 87 },
];

type ParadoxChapterProps = {
  onBack: () => void;
};

type ParadoxLayerKind = 'interior' | 'mirror' | 'object' | 'foreground';

type ParadoxPlacedImage = {
  id: string;
  name: string;
  src: string;
  layer: ParadoxLayerKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
};

type ImageRecord = {
  id: string;
  src: string;
};

type ParadoxFinalTextGlyph = {
  id: string;
  char: string;
  x: number;
  y: number;
  rotation: number;
  delay: number;
  size: number;
};

type SceneObjectRenderMode = 'full' | 'preview' | 'shell';

type PersistedPlacedImage = Omit<ParadoxPlacedImage, 'src'> & {
  src?: string;
};

type ExportedParadoxLayout = {
  version: 1;
  exportedAt: string;
  objects: ParadoxPlacedImage[];
};

type DragMode = 'move' | 'resize' | 'rotate';

type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  startDistance: number;
  startAngle: number;
  startObject: ParadoxPlacedImage;
  stageRect: DOMRect;
  centerX: number;
  centerY: number;
};

type DragSession = DragState & {
  pointerId: number;
};

type CursorState = {
  x: number;
  y: number;
  visible: boolean;
  overPortal: boolean;
  overPanel: boolean;
  grabbingObject: boolean;
};

type DevPanelPosition = {
  x: number;
  y: number;
};

type DevPanelDragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startPosition: DevPanelPosition;
  currentPosition: DevPanelPosition;
  panelWidth: number;
  panelHeight: number;
};

type FleeHomePosition = {
  x: number;
  y: number;
  rotation: number;
};

type ZoomSnapshotSet = {
  depth: number;
  signature: string;
  stageWidth: number;
  currentSceneSrc: string;
  nextSceneSrc: string;
  previousShellSrc: string;
};

const LAYER_LABELS: Record<ParadoxLayerKind, string> = {
  interior: '房间背景层',
  mirror: '镜子与入口层',
  object: '可点击物件层',
  foreground: '前景遮挡层',
};

const LAYER_DEFAULT_Z: Record<ParadoxLayerKind, number> = {
  interior: 4,
  mirror: 22,
  object: 36,
  foreground: 58,
};

const LAYER_ORDER: ParadoxLayerKind[] = ['interior', 'mirror', 'object', 'foreground'];
const canvasImageCache = new Map<string, Promise<HTMLImageElement>>();

function makeId(prefix = 'paradox-object') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStageWidth() {
  if (typeof window === 'undefined') return 1920;
  return window.matchMedia('(max-width: 720px)').matches
    ? window.innerWidth * 1.6
    : window.innerWidth;
}

function getZoomGeometry(stageWidthOverride?: number) {
  if (typeof window === 'undefined') {
    return {
      origin: { x: 960, y: 540 },
      scale: 1 / PORTAL_WIDTH_VW,
      portalWidthPercent: PORTAL_WIDTH_VW * 100,
    };
  }

  const stageWidth = stageWidthOverride ?? getStageWidth();
  const stageHeight = stageWidth * MIRROR_STAGE_HEIGHT_RATIO;
  const portalWidth = clamp(window.innerWidth * PORTAL_WIDTH_VW, PORTAL_WIDTH_MIN, PORTAL_WIDTH_MAX);
  const portalHeight = portalWidth / MIRROR_ASPECT;
  const portalWidthPercent = (portalWidth / stageWidth) * 100;
  const scale = stageWidth / portalWidth;
  const outerMirrorCenterX = stageWidth * (PORTAL_CENTER.x / 100);
  const outerMirrorCenterY = stageHeight * (PORTAL_CENTER.y / 100);
  const nextMirrorCenterX = outerMirrorCenterX + ((PORTAL_CENTER.x / 100) - 0.5) * portalWidth;
  const nextMirrorCenterY = outerMirrorCenterY + ((PORTAL_CENTER.y / 100) - 0.5) * portalHeight;

  return {
    origin: {
      x: (outerMirrorCenterX - scale * nextMirrorCenterX) / (1 - scale),
      y: (outerMirrorCenterY - scale * nextMirrorCenterY) / (1 - scale),
    },
    scale,
    portalWidthPercent,
  };
}

function normalizeName(name: string) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || '上传图片';
}

function objectToPersisted(item: ParadoxPlacedImage): PersistedPlacedImage {
  const persisted: PersistedPlacedImage = {
    id: item.id,
    name: item.name,
    layer: item.layer,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    opacity: 1,
    zIndex: item.zIndex,
  };

  if (item.src.startsWith('/paradox-assets/')) {
    persisted.src = item.src;
  }

  return persisted;
}

function writeLayoutToStorage(nextObjects: ParadoxPlacedImage[]) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(nextObjects.map(objectToPersisted));
  window.localStorage.setItem(STORAGE_KEY, payload);
}

async function loadBakedLayout() {
  const response = await fetch(`${BAKED_LAYOUT_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return [];
  const parsed = await response.json() as { objects?: ParadoxPlacedImage[] };
  if (!Array.isArray(parsed.objects)) return [];
  return parsed.objects.filter((item) => Boolean(item.src)).map(forceOpaqueObject);
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
    };
  });
}

async function saveImageRecord(id: string, src: string) {
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    tx.objectStore(IMAGE_STORE).put({ id, src });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function deleteImageRecord(id: string) {
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    tx.objectStore(IMAGE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadImageRecordsByIds(ids: string[]) {
  const db = await openImageDb();
  const records = await new Promise<ImageRecord[]>((resolve, reject) => {
    if (!ids.length) {
      resolve([]);
      return;
    }
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    const store = tx.objectStore(IMAGE_STORE);
    const result: ImageRecord[] = [];
    ids.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) result.push(request.result as ImageRecord);
      };
      request.onerror = () => reject(request.error);
    });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return new Map(records.map((record) => [record.id, record.src]));
}

async function loadAllImageRecords() {
  const db = await openImageDb();
  const records = await new Promise<ImageRecord[]>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    const request = tx.objectStore(IMAGE_STORE).getAll();
    request.onsuccess = () => resolve(request.result as ImageRecord[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = src;
  });
}

function getCoverSizeForStage(imageWidth: number, imageHeight: number) {
  const imageAspect = imageWidth / Math.max(1, imageHeight);
  if (imageAspect > MIRROR_ASPECT) {
    return {
      width: (imageAspect / MIRROR_ASPECT) * 100,
      height: 100,
    };
  }

  return {
    width: 100,
    height: (MIRROR_ASPECT / imageAspect) * 100,
  };
}

function getRotateAngle(clientX: number, clientY: number, centerX: number, centerY: number) {
  return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
}

function getPointerDistance(clientX: number, clientY: number, centerX: number, centerY: number) {
  return Math.hypot(clientX - centerX, clientY - centerY);
}

function getObjectStyle(item: ParadoxPlacedImage): CSSProperties {
  return {
    left: `${item.x}%`,
    top: `${item.y}%`,
    width: `${item.width}%`,
    height: `${item.height}%`,
    opacity: 1,
    zIndex: item.zIndex,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
  };
}

function getObjectsSignature(objects: ParadoxPlacedImage[]) {
  return objects.map((item) => [
    item.id,
    item.src,
    item.layer,
    item.x.toFixed(3),
    item.y.toFixed(3),
    item.width.toFixed(3),
    item.height.toFixed(3),
    item.rotation.toFixed(2),
    item.zIndex,
  ].join(':')).join('|');
}

function sortObjects(a: ParadoxPlacedImage, b: ParadoxPlacedImage) {
  return a.zIndex - b.zIndex || a.id.localeCompare(b.id);
}

function forceOpaqueObject(item: ParadoxPlacedImage): ParadoxPlacedImage {
  return {
    ...item,
    opacity: 1,
  };
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function decodeImageSource(src: string) {
  return new Promise<void>((resolve) => {
    if (!src) {
      resolve();
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      image.decode?.().then(() => resolve()).catch(() => resolve());
    };
    image.onerror = () => resolve();
    image.src = src;
  });
}

function loadCanvasImage(src: string) {
  const cached = canvasImageCache.get(src);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      image.decode?.().then(() => resolve(image)).catch(() => resolve(image));
    };
    image.onerror = () => reject(new Error(`Unable to load image ${src}`));
    image.src = src;
  });
  canvasImageCache.set(src, request);
  return request;
}

function canvasToObjectUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(canvas.toDataURL('image/png'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

function revokeZoomSnapshots(snapshots: ZoomSnapshotSet | null) {
  if (!snapshots) return;
  [
    snapshots.currentSceneSrc,
    snapshots.nextSceneSrc,
    snapshots.previousShellSrc,
  ].forEach((src) => {
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
  });
}

async function warmParadoxSceneAssets(objects: ParadoxPlacedImage[]) {
  const sources = Array.from(new Set([
    '/Mirror-frame.png',
    ...objects.map((item) => item.src).filter(Boolean),
  ]));

  await Promise.allSettled(sources.map((src) => decodeImageSource(src)));
  await waitForNextFrame();
  await waitForNextFrame();
}

async function warmMountedParadoxLayer(layer: HTMLElement | null) {
  if (!layer) return;

  const images = Array.from(layer.querySelectorAll('img'));
  await Promise.allSettled(images.map(async (image) => {
    if (!image.src) return;
    image.loading = 'eager';
    image.decoding = 'async';
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(timer);
          image.removeEventListener('load', finish);
          image.removeEventListener('error', finish);
          resolve();
        };
        const timer = window.setTimeout(finish, 1400);
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
      });
    }
    await image.decode?.().catch(() => undefined);
  }));

  const videos = Array.from(layer.querySelectorAll('video'));
  videos.forEach((video) => {
    video.preload = 'auto';
    video.play().catch(() => {});
  });

  layer.getBoundingClientRect();
  await waitForNextFrame();
  await waitForNextFrame();
}

function isClockFaceObject(item: ParadoxPlacedImage) {
  const name = item.name.toLowerCase();
  return name.includes('白色钟面') || name.includes('钟面') || name.includes('clock');
}

function isMacBookObject(item: ParadoxPlacedImage) {
  const name = item.name.toLowerCase();
  return name.includes('macbook') || name.includes('显示器') || name.includes('电脑');
}

function getClockHandRotations(now: Date) {
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return {
    second: `${-seconds * 6}deg`,
    minute: `${-minutes * 6}deg`,
    hour: `${-hours * 30}deg`,
  };
}

function getClockHandDegrees(now: Date) {
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return {
    second: -seconds * 6,
    minute: -minutes * 6,
    hour: -hours * 30,
  };
}

function drawClockHand(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  degrees: number,
  color: string,
) {
  const radians = degrees * (Math.PI / 180);
  ctx.save();
  ctx.rotate(radians);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -length);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

function drawClockHandsToCanvas(ctx: CanvasRenderingContext2D, boxWidth: number, boxHeight: number, now: Date) {
  const rotations = getClockHandDegrees(now);
  ctx.save();
  drawClockHand(ctx, boxHeight * 0.1806, boxWidth * 0.0127, rotations.hour, '#000000');
  drawClockHand(ctx, boxHeight * 0.2384, boxWidth * 0.0098, rotations.minute, '#000000');
  drawClockHand(ctx, boxHeight * 0.289, boxWidth * 0.0058, rotations.second, '#ff4324');
  ctx.beginPath();
  ctx.arc(0, 0, boxWidth * 0.00905, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.translate(left + width / 2, top + height / 2);
  ctx.scale(-1, 1);
  ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

async function drawPlacedImageToCanvas(
  ctx: CanvasRenderingContext2D,
  item: ParadoxPlacedImage,
  stageWidth: number,
  stageHeight: number,
  now: Date,
  cameraVideo?: HTMLVideoElement | null,
  showLiveEffects = true,
) {
  const image = await loadCanvasImage(item.src).catch(() => null);
  if (!image) return;

  const centerX = (item.x / 100) * stageWidth;
  const centerY = (item.y / 100) * stageHeight;
  const boxWidth = (item.width / 100) * stageWidth;
  const boxHeight = (item.height / 100) * stageHeight;
  const imageAspect = (image.naturalWidth || 1) / Math.max(1, image.naturalHeight || 1);
  const boxAspect = boxWidth / Math.max(1, boxHeight);
  const drawWidth = imageAspect > boxAspect ? boxWidth : boxHeight * imageAspect;
  const drawHeight = imageAspect > boxAspect ? boxWidth / imageAspect : boxHeight;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(item.rotation * (Math.PI / 180));

  if (showLiveEffects && cameraVideo && isMacBookObject(item)) {
    drawVideoCover(
      ctx,
      cameraVideo,
      -boxWidth / 2 + MACBOOK_SCREEN_BOUNDS.left * boxWidth,
      -boxHeight / 2 + MACBOOK_SCREEN_BOUNDS.top * boxHeight,
      MACBOOK_SCREEN_BOUNDS.width * boxWidth,
      MACBOOK_SCREEN_BOUNDS.height * boxHeight,
    );
  }

  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

  if (showLiveEffects && isClockFaceObject(item)) {
    drawClockHandsToCanvas(ctx, boxWidth, boxHeight, now);
  }

  ctx.restore();
}

async function drawMirrorFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  const frame = await loadCanvasImage('/Mirror-frame.png').catch(() => null);
  if (!frame) return;
  ctx.drawImage(frame, left, top, width, height);
}

async function drawCanvasScene(
  ctx: CanvasRenderingContext2D,
  objects: ParadoxPlacedImage[],
  stageWidth: number,
  stageHeight: number,
  portalWidthPercent: number,
  now: Date,
  cameraVideo: HTMLVideoElement | null,
  baseDepth: number,
  recursionDepth = 0,
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, stageWidth, stageHeight);

  const portalZ = 30;
  const beforePortal = objects.filter((item) => item.zIndex <= portalZ);
  const afterPortal = objects.filter((item) => item.zIndex > portalZ);

  for (const item of beforePortal) {
    await drawPlacedImageToCanvas(ctx, item, stageWidth, stageHeight, now, cameraVideo);
  }

  if (baseDepth < FINAL_RECURSION_DEPTH) {
    await drawCanvasPortal(
      ctx,
      objects,
      stageWidth,
      stageHeight,
      portalWidthPercent,
      now,
      cameraVideo,
      baseDepth,
      recursionDepth,
    );
  }

  for (const item of afterPortal) {
    await drawPlacedImageToCanvas(ctx, item, stageWidth, stageHeight, now, cameraVideo);
  }
}

async function drawCanvasPortal(
  ctx: CanvasRenderingContext2D,
  objects: ParadoxPlacedImage[],
  stageWidth: number,
  stageHeight: number,
  portalWidthPercent: number,
  now: Date,
  cameraVideo: HTMLVideoElement | null,
  baseDepth: number,
  recursionDepth: number,
) {
  const portalWidth = stageWidth * (portalWidthPercent / 100);
  const portalHeight = portalWidth / MIRROR_ASPECT;
  const portalLeft = stageWidth * (PORTAL_CENTER.x / 100) - portalWidth / 2;
  const portalTop = stageHeight * (PORTAL_CENTER.y / 100) - portalHeight / 2;
  const innerLeft = portalLeft + portalWidth * INNER_BOUNDS.left;
  const innerTop = portalTop + portalHeight * INNER_BOUNDS.top;
  const innerWidth = portalWidth * INNER_BOUNDS.width;
  const innerHeight = portalHeight * INNER_BOUNDS.height;

  if (recursionDepth < MAX_RECURSION_DEPTH) {
    const nestedCanvas = document.createElement('canvas');
    nestedCanvas.width = Math.max(1, Math.round(portalWidth));
    nestedCanvas.height = Math.max(1, Math.round(portalHeight));
    const nestedCtx = nestedCanvas.getContext('2d');
    if (nestedCtx) {
      await drawCanvasScene(
        nestedCtx,
        objects,
        portalWidth,
        portalHeight,
        portalWidthPercent,
        now,
        cameraVideo,
        baseDepth + recursionDepth + 1,
        recursionDepth + 1,
      );
      ctx.save();
      ctx.beginPath();
      ctx.rect(innerLeft, innerTop, innerWidth, innerHeight);
      ctx.clip();
      ctx.drawImage(nestedCanvas, portalLeft, portalTop, portalWidth, portalHeight);
      ctx.restore();
    }
  }

  await drawMirrorFrameToCanvas(ctx, portalLeft, portalTop, portalWidth, portalHeight);
}

async function drawCanvasShell(
  ctx: CanvasRenderingContext2D,
  objects: ParadoxPlacedImage[],
  stageWidth: number,
  stageHeight: number,
  portalWidthPercent: number,
  now: Date,
) {
  const shellObjects = objects.filter((item) => item.layer !== 'interior');
  const clips = getOutsideMirrorClips(portalWidthPercent);

  for (const clip of clips) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      (clip.left / 100) * stageWidth,
      (clip.top / 100) * stageHeight,
      (clip.width / 100) * stageWidth,
      (clip.height / 100) * stageHeight,
    );
    ctx.clip();
    for (const item of shellObjects) {
      await drawPlacedImageToCanvas(ctx, item, stageWidth, stageHeight, now, null, false);
    }
    ctx.restore();
  }

  const portalWidth = stageWidth * (portalWidthPercent / 100);
  const portalHeight = portalWidth / MIRROR_ASPECT;
  await drawMirrorFrameToCanvas(
    ctx,
    stageWidth * (PORTAL_CENTER.x / 100) - portalWidth / 2,
    stageHeight * (PORTAL_CENTER.y / 100) - portalHeight / 2,
    portalWidth,
    portalHeight,
  );
}

async function bakeZoomSnapshots(
  objects: ParadoxPlacedImage[],
  depth: number,
  stageWidth: number,
  portalWidthPercent: number,
  now: Date,
  cameraVideo: HTMLVideoElement | null,
  signature: string,
): Promise<ZoomSnapshotSet> {
  const stageHeight = stageWidth * MIRROR_STAGE_HEIGHT_RATIO;
  const makeCanvas = (transparent = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(stageWidth));
    canvas.height = Math.max(1, Math.round(stageHeight));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    if (transparent) ctx.clearRect(0, 0, canvas.width, canvas.height);
    return { canvas, ctx };
  };

  const current = makeCanvas();
  await drawCanvasScene(current.ctx, objects, stageWidth, stageHeight, portalWidthPercent, now, cameraVideo, depth);

  const next = makeCanvas();
  await drawCanvasScene(next.ctx, objects, stageWidth, stageHeight, portalWidthPercent, now, cameraVideo, depth + 1);

  const shell = makeCanvas(true);
  await drawCanvasShell(shell.ctx, objects, stageWidth, stageHeight, portalWidthPercent, now);

  return {
    depth,
    signature,
    stageWidth,
    currentSceneSrc: await canvasToObjectUrl(current.canvas),
    nextSceneSrc: await canvasToObjectUrl(next.canvas),
    previousShellSrc: await canvasToObjectUrl(shell.canvas),
  };
}

function getOutsideMirrorClips(portalWidthPercent: number) {
  const portalLeft = PORTAL_CENTER.x - portalWidthPercent / 2;
  const portalTop = PORTAL_CENTER.y - portalWidthPercent / 2;
  const innerLeft = clamp(portalLeft + portalWidthPercent * INNER_BOUNDS.left, 0, 100);
  const innerTop = clamp(portalTop + portalWidthPercent * INNER_BOUNDS.top, 0, 100);
  const innerRight = clamp(portalLeft + portalWidthPercent * (INNER_BOUNDS.left + INNER_BOUNDS.width), 0, 100);
  const innerBottom = clamp(portalTop + portalWidthPercent * (INNER_BOUNDS.top + INNER_BOUNDS.height), 0, 100);

  return [
    { id: 'top', left: 0, top: 0, width: 100, height: innerTop },
    { id: 'bottom', left: 0, top: innerBottom, width: 100, height: 100 - innerBottom },
    { id: 'left', left: 0, top: innerTop, width: innerLeft, height: innerBottom - innerTop },
    { id: 'right', left: innerRight, top: innerTop, width: 100 - innerRight, height: innerBottom - innerTop },
  ].filter((clip) => clip.width > 0 && clip.height > 0);
}

function getDefaultDevPanelPosition(): DevPanelPosition {
  if (typeof window === 'undefined') return { x: 18, y: 18 };
  const panelWidth = Math.min(420, Math.max(0, window.innerWidth - 36));
  return {
    x: Math.max(10, window.innerWidth - panelWidth - 18),
    y: 18,
  };
}

function clampDevPanelPosition(
  position: DevPanelPosition,
  panelWidth = 420,
  panelHeight = 620,
): DevPanelPosition {
  if (typeof window === 'undefined') return position;
  const maxX = Math.max(10, window.innerWidth - Math.min(panelWidth, window.innerWidth - 20));
  const maxY = Math.max(10, window.innerHeight - Math.min(panelHeight, window.innerHeight - 20));
  return {
    x: clamp(position.x, 10, maxX),
    y: clamp(position.y, 10, maxY),
  };
}

function readDevPanelPosition(): DevPanelPosition {
  if (typeof window === 'undefined') return getDefaultDevPanelPosition();
  const stored = window.localStorage.getItem(DEV_PANEL_POSITION_KEY);
  if (!stored) return getDefaultDevPanelPosition();
  try {
    const parsed = JSON.parse(stored) as Partial<DevPanelPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return getDefaultDevPanelPosition();
    }
    return clampDevPanelPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return getDefaultDevPanelPosition();
  }
}

function writeDevPanelPosition(position: DevPanelPosition) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEV_PANEL_POSITION_KEY, JSON.stringify(position));
}

function createFinalTextGlyphs(): ParadoxFinalTextGlyph[] {
  const glyphs: ParadoxFinalTextGlyph[] = [];
  FINAL_TEXT_LINES.forEach((line, lineIndex) => {
    const chars = Array.from(line.text);
    const spacing = line.text.length > 10 ? 4.25 : 4.8;
    const startX = line.x - ((chars.length - 1) * spacing) / 2;

    chars.forEach((char, charIndex) => {
      glyphs.push({
        id: `final-${lineIndex}-${charIndex}-${char}`,
        char,
        x: startX + charIndex * spacing,
        y: line.y,
        rotation: ((lineIndex * 11 + charIndex * 7) % 17) - 8,
        delay: lineIndex * 150 + charIndex * 38,
        size: char >= '0' && char <= '9' ? 9.5 : 11.2,
      });
    });
  });
  return glyphs;
}

export default function ParadoxChapter({ onBack }: ParadoxChapterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomNextSceneRef = useRef<HTMLDivElement | null>(null);
  const cursorElementRef = useRef<HTMLDivElement | null>(null);
  const devPanelRef = useRef<HTMLElement | null>(null);
  const fileInputRefs = useRef<Partial<Record<ParadoxLayerKind, HTMLInputElement | null>>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPointRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const activeDragRef = useRef<DragSession | null>(null);
  const detachDragListenersRef = useRef<(() => void) | null>(null);
  const activePanelDragRef = useRef<DevPanelDragSession | null>(null);
  const detachPanelDragListenersRef = useRef<(() => void) | null>(null);
  const finalExitTimerRef = useRef<number | null>(null);
  const finalSequenceStartedRef = useRef(false);
  const zoomingRef = useRef(false);
  const zoomWarmInProgressRef = useRef(false);
  const prebakedZoomRef = useRef<ZoomSnapshotSet | null>(null);
  const zoomSnapshotsRef = useRef<ZoomSnapshotSet | null>(null);
  const prebakeTimerRef = useRef<number | null>(null);
  const fleeingObjectTimesRef = useRef<Record<string, number>>({});
  const fleeingObjectHomeRef = useRef<Record<string, FleeHomePosition>>({});
  const grabbedObjectIdRef = useRef<string | null>(null);
  const [objects, setObjects] = useState<ParadoxPlacedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [zoomSnapshots, setZoomSnapshots] = useState<ZoomSnapshotSet | null>(null);
  const [zoomDepth, setZoomDepth] = useState(0);
  const [saveStatus, setSaveStatus] = useState('等待布置');
  const [zoomGeometry, setZoomGeometry] = useState(() => getZoomGeometry());
  const [imageLibrary, setImageLibrary] = useState<ImageRecord[]>([]);
  const [devPanelPosition, setDevPanelPosition] = useState<DevPanelPosition>(() => readDevPanelPosition());
  const [clockNow, setClockNow] = useState(() => new Date());
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [finalSequenceActive, setFinalSequenceActive] = useState(false);
  const [finalTextGlyphs, setFinalTextGlyphs] = useState<ParadoxFinalTextGlyph[]>(() => createFinalTextGlyphs());
  const [cursorState, setCursorState] = useState<CursorState>({
    x: 0,
    y: 0,
    visible: false,
    overPortal: false,
    overPanel: false,
    grabbingObject: false,
  });

  const selectedObject = useMemo(
    () => objects.find((item) => item.id === selectedId) ?? null,
    [objects, selectedId],
  );
  const sortedObjects = useMemo(() => [...objects].sort(sortObjects), [objects]);
  const objectsSignature = useMemo(() => getObjectsSignature(sortedObjects), [sortedObjects]);

  const updateObject = useCallback((id: string, updater: (item: ParadoxPlacedImage) => ParadoxPlacedImage) => {
    setObjects((current) => current.map((item) => (item.id === id ? updater(item) : item)));
    setSaveStatus('有未保存改动');
  }, []);

  const persistLayout = useCallback((nextObjects: ParadoxPlacedImage[]) => {
    writeLayoutToStorage(nextObjects);
    setSaveStatus(`已保存 ${nextObjects.length} 个图层`);
  }, []);

  const bakeLayoutToProject = useCallback(async () => {
    setSaveStatus('正在烘焙到项目文件夹...');
    const response = await fetch('/api/paradox-bake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objects }),
    });
    if (!response.ok) {
      setSaveStatus('烘焙失败，请确认 dev server 正在运行');
      return;
    }

    const result = await response.json() as {
      objects?: ParadoxPlacedImage[];
      written?: number;
    };
    if (!Array.isArray(result.objects)) {
      setSaveStatus('烘焙失败，返回数据不完整');
      return;
    }

    const opaqueObjects = result.objects.map(forceOpaqueObject);
    setObjects(opaqueObjects);
    writeLayoutToStorage(opaqueObjects);
    setImageLibrary(opaqueObjects.map((item) => ({ id: item.id, src: item.src })));
    setSaveStatus(`已烘焙 ${result.written ?? opaqueObjects.length} 个文件到项目`);
  }, [objects]);

  const refreshImageLibrary = useCallback(async () => {
    const records = await loadAllImageRecords();
    setImageLibrary(records);
  }, []);

  const clearFinalSequenceExit = useCallback(() => {
    if (finalExitTimerRef.current !== null) {
      window.clearTimeout(finalExitTimerRef.current);
      finalExitTimerRef.current = null;
    }
  }, []);

  const clearPrebakedZoom = useCallback(() => {
    if (prebakeTimerRef.current !== null) {
      window.clearTimeout(prebakeTimerRef.current);
      prebakeTimerRef.current = null;
    }
    revokeZoomSnapshots(prebakedZoomRef.current);
    prebakedZoomRef.current = null;
  }, []);

  const getCameraVideoElement = useCallback(() => (
    stageRef.current?.querySelector(`.${styles.macbookCameraVideo}`) as HTMLVideoElement | null
  ), []);

  const buildZoomSnapshots = useCallback(async () => {
    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? getStageWidth();
    const geometry = getZoomGeometry(stageWidth);
    return bakeZoomSnapshots(
      sortedObjects,
      zoomDepth,
      stageWidth,
      geometry.portalWidthPercent,
      new Date(),
      getCameraVideoElement(),
      objectsSignature,
    );
  }, [getCameraVideoElement, objectsSignature, sortedObjects, zoomDepth]);

  const startZoomAnimation = useCallback(() => {
    const stageWidth = stageRef.current?.getBoundingClientRect().width;
    setZoomGeometry(getZoomGeometry(stageWidth));
    zoomingRef.current = true;
    window.requestAnimationFrame(() => setZooming(true));
  }, []);

  const startZoomLoop = useCallback(() => {
    if (
      devOpen ||
      finalSequenceActive ||
      finalSequenceStartedRef.current ||
      zoomingRef.current ||
      zooming ||
      zoomWarmInProgressRef.current ||
      zoomDepth >= FINAL_RECURSION_DEPTH
    ) {
      return;
    }

    zoomWarmInProgressRef.current = true;
    const startAfterWarm = async () => {
      const stageWidth = stageRef.current?.getBoundingClientRect().width ?? getStageWidth();
      const cachedSnapshots = prebakedZoomRef.current;
      const snapshots = cachedSnapshots &&
        cachedSnapshots.depth === zoomDepth &&
        cachedSnapshots.signature === objectsSignature &&
        Math.abs(cachedSnapshots.stageWidth - stageWidth) < 1
        ? cachedSnapshots
        : await buildZoomSnapshots().catch(() => null);

      zoomWarmInProgressRef.current = false;
      if (
        devOpen ||
        finalSequenceActive ||
        finalSequenceStartedRef.current ||
        zoomingRef.current ||
        zooming ||
        zoomDepth >= FINAL_RECURSION_DEPTH
      ) {
        if (snapshots && snapshots !== cachedSnapshots) revokeZoomSnapshots(snapshots);
        return;
      }
      if (snapshots) {
        if (snapshots === cachedSnapshots) {
          prebakedZoomRef.current = null;
        }
        setZoomSnapshots((current) => {
          revokeZoomSnapshots(current);
          zoomSnapshotsRef.current = snapshots;
          return snapshots;
        });
        await waitForNextFrame();
      }
      startZoomAnimation();
    };
    startAfterWarm();
  }, [
    buildZoomSnapshots,
    devOpen,
    finalSequenceActive,
    objectsSignature,
    startZoomAnimation,
    zoomDepth,
    zooming,
  ]);

  const moveObjectAway = useCallback((id: string, event: ReactPointerEvent<HTMLElement>) => {
    if (devOpen || grabbedObjectIdRef.current === id) return;
    const now = performance.now();
    const lastMovedAt = fleeingObjectTimesRef.current[id] ?? 0;
    if (now - lastMovedAt < FLEE_COOLDOWN_MS) return;
    fleeingObjectTimesRef.current[id] = now;

    const stageRect = stageRef.current?.getBoundingClientRect();
    const pointerX = stageRect
      ? clamp(((event.clientX - stageRect.left) / stageRect.width) * 100, 0, 100)
      : 50;
    const pointerY = stageRect
      ? clamp(((event.clientY - stageRect.top) / stageRect.height) * 100, 0, 100)
      : 50;

    setObjects((current) => current.map((item) => {
      if (item.id !== id || item.layer !== 'object') return item;
      fleeingObjectHomeRef.current[item.id] ??= {
        x: item.x,
        y: item.y,
        rotation: item.rotation,
      };
      const referenceX = stageRect ? pointerX : item.x;
      const referenceY = stageRect ? pointerY : item.y;
      const targetX = referenceX < 50
        ? 58 + Math.random() * 34
        : 8 + Math.random() * 34;
      const targetY = referenceY < 50
        ? 58 + Math.random() * 34
        : 8 + Math.random() * 34;

      return {
        ...item,
        x: clamp(targetX, 6, 94),
        y: clamp(targetY, 6, 94),
      };
    }));
  }, [devOpen]);

  const resetEscapedItems = useCallback(() => {
    clearFinalSequenceExit();
    clearPrebakedZoom();
    finalSequenceStartedRef.current = false;
    zoomingRef.current = false;
    zoomWarmInProgressRef.current = false;
    setZooming(false);
    revokeZoomSnapshots(zoomSnapshotsRef.current);
    zoomSnapshotsRef.current = null;
    setZoomSnapshots(null);
    setZoomDepth(0);
    setFinalSequenceActive(false);
    const homePositions = fleeingObjectHomeRef.current;
    setObjects((current) => current.map((item) => {
      const home = homePositions[item.id];
      if (!home) return item;
      return {
        ...item,
        x: home.x,
        y: home.y,
        rotation: home.rotation,
      };
    }));
    setFinalTextGlyphs(createFinalTextGlyphs());
    fleeingObjectHomeRef.current = {};
    fleeingObjectTimesRef.current = {};
    grabbedObjectIdRef.current = null;
    setCursorState((current) => ({
      ...current,
      grabbingObject: false,
    }));
  }, [clearFinalSequenceExit, clearPrebakedZoom]);

  const startFinalSequenceNow = useCallback(() => {
    clearFinalSequenceExit();
    clearPrebakedZoom();
    finalSequenceStartedRef.current = true;
    zoomingRef.current = false;
    zoomWarmInProgressRef.current = false;
    setDevOpen(false);
    setZooming(false);
    revokeZoomSnapshots(zoomSnapshotsRef.current);
    zoomSnapshotsRef.current = null;
    setZoomSnapshots(null);
    setZoomDepth(FINAL_RECURSION_DEPTH);
    setFinalTextGlyphs(createFinalTextGlyphs());
    setFinalSequenceActive(true);
    finalExitTimerRef.current = window.setTimeout(() => {
      finalExitTimerRef.current = null;
      onBack();
    }, FINAL_SEQUENCE_EXIT_MS);
  }, [clearFinalSequenceExit, clearPrebakedZoom, onBack]);

  const moveFinalGlyphAway = useCallback((id: string, event: ReactPointerEvent<HTMLElement>) => {
    if (devOpen || grabbedObjectIdRef.current === id) return;
    const now = performance.now();
    const lastMovedAt = fleeingObjectTimesRef.current[id] ?? 0;
    if (now - lastMovedAt < FLEE_COOLDOWN_MS) return;
    fleeingObjectTimesRef.current[id] = now;

    const stageRect = stageRef.current?.getBoundingClientRect();
    const pointerX = stageRect
      ? clamp(((event.clientX - stageRect.left) / stageRect.width) * 100, 0, 100)
      : 50;
    const pointerY = stageRect
      ? clamp(((event.clientY - stageRect.top) / stageRect.height) * 100, 0, 100)
      : 50;

    setFinalTextGlyphs((current) => current.map((glyph) => {
      if (glyph.id !== id) return glyph;
      const referenceX = stageRect ? pointerX : glyph.x;
      const referenceY = stageRect ? pointerY : glyph.y;
      const targetX = referenceX < 50
        ? 57 + Math.random() * 35
        : 8 + Math.random() * 35;
      const targetY = referenceY < 50
        ? 58 + Math.random() * 34
        : 8 + Math.random() * 34;

      return {
        ...glyph,
        x: clamp(targetX, 5, 95),
        y: clamp(targetY, 5, 95),
        rotation: glyph.rotation + (Math.random() * 40 - 20),
      };
    }));
  }, [devOpen]);

  const grabObject = useCallback((id: string) => {
    if (devOpen) return;
    grabbedObjectIdRef.current = id;
    setCursorState((current) => ({
      ...current,
      grabbingObject: true,
      overPortal: false,
    }));
  }, [devOpen]);

  const releaseGrabbedObject = useCallback(() => {
    grabbedObjectIdRef.current = null;
    setCursorState((current) => ({
      ...current,
      grabbingObject: false,
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('pointerup', releaseGrabbedObject);
    window.addEventListener('pointercancel', releaseGrabbedObject);
    return () => {
      window.removeEventListener('pointerup', releaseGrabbedObject);
      window.removeEventListener('pointercancel', releaseGrabbedObject);
    };
  }, [releaseGrabbedObject]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (typeof window === 'undefined') return;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const bakedObjects = await loadBakedLayout().catch(() => []);
      const persisted = stored
        ? (JSON.parse(stored) as PersistedPlacedImage[])
        : bakedObjects.map(objectToPersisted);
      const missingIds = persisted.filter((item) => !item.src).map((item) => item.id);
      const imageRecords = await loadImageRecordsByIds(missingIds)
        .catch(() => new Map<string, string>());
      if (cancelled) return;
      setObjects(persisted.map((item) => ({
        ...item,
        opacity: 1,
        src: item.src ?? imageRecords.get(item.id) ?? '',
      })).filter((item) => Boolean(item.src)).map(forceOpaqueObject));
      loadedRef.current = true;
      setSaveStatus(persisted.length ? `已载入 ${persisted.length} 个图层` : '空舞台');
    };
    load().catch(() => {
      loadedRef.current = true;
      setSaveStatus('无法载入已保存布置');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncZoomGeometry = () => setZoomGeometry(getZoomGeometry());
    syncZoomGeometry();
    window.addEventListener('resize', syncZoomGeometry);
    return () => window.removeEventListener('resize', syncZoomGeometry);
  }, []);

  useEffect(() => {
    const tick = () => setClockNow(new Date());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const openPreferredCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof window === 'undefined') return null;
      let deviceId = window.localStorage.getItem(PREFERRED_CAMERA_DEVICE_ID_KEY) ?? '';
      const storedLabel = window.localStorage.getItem(PREFERRED_CAMERA_LABEL_KEY) ?? '';

      if (!deviceId && storedLabel && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const matchedDevice = devices.find((device) => (
          device.kind === 'videoinput' &&
          device.label &&
          device.label === storedLabel
        ));
        deviceId = matchedDevice?.deviceId ?? '';
      }

      if (!deviceId) return null;

      return navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    };

    openPreferredCamera()
      .then((nextStream) => {
        if (!nextStream) {
          if (!cancelled) setCameraStream(null);
          return;
        }
        stream = nextStream;
        if (cancelled) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setCameraStream(nextStream);
      })
      .catch(() => {
        if (!cancelled) setCameraStream(null);
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const syncDevPanelPosition = () => {
      const rect = devPanelRef.current?.getBoundingClientRect();
      setDevPanelPosition((current) => {
        const next = clampDevPanelPosition(current, rect?.width, rect?.height);
        writeDevPanelPosition(next);
        return next;
      });
    };

    window.addEventListener('resize', syncDevPanelPosition);
    return () => window.removeEventListener('resize', syncDevPanelPosition);
  }, []);

  const stopPanelDrag = useCallback((persistPosition = true) => {
    const session = activePanelDragRef.current;
    activePanelDragRef.current = null;
    detachPanelDragListenersRef.current?.();
    detachPanelDragListenersRef.current = null;
    if (persistPosition && session) {
      const next = clampDevPanelPosition(session.currentPosition, session.panelWidth, session.panelHeight);
      writeDevPanelPosition(next);
      setDevPanelPosition(next);
    }
  }, []);

  useEffect(() => () => {
    stopPanelDrag(false);
  }, [stopPanelDrag]);

  useEffect(() => () => {
    clearFinalSequenceExit();
    clearPrebakedZoom();
    zoomingRef.current = false;
    zoomWarmInProgressRef.current = false;
    revokeZoomSnapshots(zoomSnapshotsRef.current);
    zoomSnapshotsRef.current = null;
  }, [clearFinalSequenceExit, clearPrebakedZoom]);

  useEffect(() => {
    clearPrebakedZoom();
    if (
      devOpen ||
      finalSequenceActive ||
      !loadedRef.current ||
      !objects.length ||
      zooming ||
      zoomDepth >= FINAL_RECURSION_DEPTH
    ) {
      return undefined;
    }

    let cancelled = false;
    prebakeTimerRef.current = window.setTimeout(() => {
      prebakeTimerRef.current = null;
      buildZoomSnapshots()
        .then((snapshots) => {
          if (cancelled) {
            revokeZoomSnapshots(snapshots);
            return;
          }
          revokeZoomSnapshots(prebakedZoomRef.current);
          prebakedZoomRef.current = snapshots;
        })
        .catch(() => {});
    }, 650);

    return () => {
      cancelled = true;
      if (prebakeTimerRef.current !== null) {
        window.clearTimeout(prebakeTimerRef.current);
        prebakeTimerRef.current = null;
      }
    };
  }, [
    buildZoomSnapshots,
    clearPrebakedZoom,
    devOpen,
    finalSequenceActive,
    objects.length,
    objectsSignature,
    zoomDepth,
    zooming,
  ]);

  useEffect(() => {
    if (devOpen || finalSequenceActive || !zooming) {
      return undefined;
    }

    let cancelled = false;
    const warmAnimationLayer = async () => {
      await warmParadoxSceneAssets(objects);
      if (cancelled) return;
      await warmMountedParadoxLayer(zoomNextSceneRef.current);
    };

    warmAnimationLayer().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [devOpen, finalSequenceActive, objects, zoomDepth, zooming]);

  const handleDevPanelHeaderPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('button, input, select, textarea, a, [data-panel-no-drag="true"]')
    ) {
      return;
    }

    const rect = devPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    stopPanelDrag(false);

    const session: DevPanelDragSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: devPanelPosition,
      currentPosition: devPanelPosition,
      panelWidth: rect.width,
      panelHeight: rect.height,
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId) return;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const nextPosition = clampDevPanelPosition({
        x: session.startPosition.x + moveEvent.clientX - session.startX,
        y: session.startPosition.y + moveEvent.clientY - session.startY,
      }, session.panelWidth, session.panelHeight);
      session.currentPosition = nextPosition;
      setDevPanelPosition(nextPosition);
    };

    const onPointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== session.pointerId) return;
      endEvent.preventDefault();
      endEvent.stopPropagation();
      onPointerMove(endEvent);
      stopPanelDrag();
    };

    const listenerOptions = { capture: true, passive: false } as AddEventListenerOptions;
    window.addEventListener('pointermove', onPointerMove, listenerOptions);
    window.addEventListener('pointerup', onPointerEnd, listenerOptions);
    window.addEventListener('pointercancel', onPointerEnd, listenerOptions);
    detachPanelDragListenersRef.current = () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerEnd, true);
      window.removeEventListener('pointercancel', onPointerEnd, true);
    };
    activePanelDragRef.current = session;
  }, [devPanelPosition, stopPanelDrag]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typingInPanel = target instanceof Element &&
        Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

      if ((event.code === 'Space' || event.key === ' ') && !typingInPanel) {
        event.preventDefault();
        event.stopPropagation();
        resetEscapedItems();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        setDevOpen((value) => {
          const nextValue = !value;
          if (nextValue) {
            clearFinalSequenceExit();
            finalSequenceStartedRef.current = false;
            setFinalSequenceActive(false);
            zoomingRef.current = false;
            zoomWarmInProgressRef.current = false;
            setZooming(false);
            refreshImageLibrary().catch(() => setSaveStatus('无法读取已上传图片库'));
          }
          return nextValue;
        });
        return;
      }

      if (event.key.toLowerCase() === 'f' && !typingInPanel) {
        event.preventDefault();
        event.stopPropagation();
        startFinalSequenceNow();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (devOpen) {
          setDevOpen(false);
          return;
        }
        onBack();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [clearFinalSequenceExit, devOpen, onBack, refreshImageLibrary, resetEscapedItems, startFinalSequenceNow]);

  const applyDragToObjects = useCallback((session: DragSession, clientX: number, clientY: number) => {
    const { startObject, stageRect } = session;
    const deltaXPercent = ((clientX - session.startX) / stageRect.width) * 100;
    const deltaYPercent = ((clientY - session.startY) / stageRect.height) * 100;

    setObjects((current) => current.map((item) => {
      if (item.id !== session.id) return item;
      if (session.mode === 'move') {
        return {
          ...item,
          x: startObject.x + deltaXPercent,
          y: startObject.y + deltaYPercent,
        };
      }

      if (session.mode === 'resize') {
        const currentDistance = getPointerDistance(clientX, clientY, session.centerX, session.centerY);
        const scale = clamp(currentDistance / Math.max(1, session.startDistance), 0.03, 20);
        return {
          ...item,
          width: Math.max(0.25, startObject.width * scale),
          height: Math.max(0.25, startObject.height * scale),
        };
      }

      const currentAngle = getRotateAngle(clientX, clientY, session.centerX, session.centerY);
      return {
        ...item,
        rotation: startObject.rotation + currentAngle - session.startAngle,
      };
    }));
  }, []);

  const stopActiveDrag = useCallback((commitStatus = true) => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const session = activeDragRef.current;
    const point = pendingDragPointRef.current;
    if (session && point) {
      applyDragToObjects(session, point.clientX, point.clientY);
    }
    pendingDragPointRef.current = null;
    activeDragRef.current = null;
    detachDragListenersRef.current?.();
    detachDragListenersRef.current = null;
    if (commitStatus) {
      setSaveStatus('有未保存改动');
    }
  }, [applyDragToObjects]);

  useEffect(() => () => {
    stopActiveDrag(false);
  }, [stopActiveDrag]);

  const createImageObject = useCallback(async (file: File, layer: ParadoxLayerKind) => {
    const src = await readFileAsDataUrl(file);
    const dimensions = await getImageDimensions(src);
    const id = makeId(layer);
    const coverSize = getCoverSizeForStage(dimensions.width, dimensions.height);
    const width = layer === 'interior' ? coverSize.width : layer === 'mirror' ? 24 : 12;
    const naturalRatio = dimensions.height / Math.max(1, dimensions.width);
    const height = layer === 'interior'
      ? coverSize.height
      : width * naturalRatio * MIRROR_ASPECT;
    const item: ParadoxPlacedImage = {
      id,
      name: normalizeName(file.name),
      src,
      layer,
      x: layer === 'interior' ? 50 : PORTAL_CENTER.x,
      y: layer === 'interior' ? 50 : PORTAL_CENTER.y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      zIndex: LAYER_DEFAULT_Z[layer] + objects.filter((object) => object.layer === layer).length,
    };
    await saveImageRecord(id, src);
    setImageLibrary((current) => [...current.filter((record) => record.id !== id), { id, src }]);
    setObjects((current) => [...current, item]);
    setSelectedId(id);
    setSaveStatus('有未保存改动');
  }, [objects]);

  const handleUpload = useCallback(async (
    event: ChangeEvent<HTMLInputElement>,
    layer: ParadoxLayerKind,
  ) => {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await createImageObject(file, layer);
      }
    }
    event.target.value = '';
  }, [createImageObject]);

  const handleObjectPointerDown = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    item: ParadoxPlacedImage,
    mode: DragMode,
  ) => {
    if (!devOpen || !stageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    stopActiveDrag();
    setSaveStatus('正在编辑，记得保存');
    const stageRect = stageRef.current.getBoundingClientRect();
    const centerX = stageRect.left + (item.x / 100) * stageRect.width;
    const centerY = stageRect.top + (item.y / 100) * stageRect.height;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Safari can throw if capture is already owned; the window listener below still handles drag.
    }
    const startAngle = getRotateAngle(event.clientX, event.clientY, centerX, centerY);
    const startDistance = getPointerDistance(event.clientX, event.clientY, centerX, centerY);
    const session: DragSession = {
      id: item.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startDistance,
      startAngle,
      startObject: item,
      stageRect,
      centerX,
      centerY,
    };

    const scheduleDrag = (clientX: number, clientY: number) => {
      pendingDragPointRef.current = { clientX, clientY };
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = window.requestAnimationFrame(() => {
        const currentSession = activeDragRef.current;
        const point = pendingDragPointRef.current;
        dragFrameRef.current = null;
        if (!currentSession || !point) return;
        applyDragToObjects(currentSession, point.clientX, point.clientY);
      });
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId) return;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      scheduleDrag(moveEvent.clientX, moveEvent.clientY);
    };

    const onPointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== session.pointerId) return;
      endEvent.preventDefault();
      endEvent.stopPropagation();
      scheduleDrag(endEvent.clientX, endEvent.clientY);
      stopActiveDrag();
    };

    const listenerOptions = { capture: true, passive: false } as AddEventListenerOptions;
    window.addEventListener('pointermove', onPointerMove, listenerOptions);
    window.addEventListener('pointerup', onPointerEnd, listenerOptions);
    window.addEventListener('pointercancel', onPointerEnd, listenerOptions);
    detachDragListenersRef.current = () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerEnd, true);
      window.removeEventListener('pointercancel', onPointerEnd, true);
    };

    activeDragRef.current = session;
    setSelectedId(item.id);
  }, [applyDragToObjects, devOpen, stopActiveDrag]);

  const deleteSelected = useCallback(() => {
    if (!selectedObject) return;
    deleteImageRecord(selectedObject.id).catch(() => {});
    setImageLibrary((current) => current.filter((record) => record.id !== selectedObject.id));
    setObjects((current) => current.filter((item) => item.id !== selectedObject.id));
    setSelectedId(null);
    setSaveStatus('有未保存改动');
  }, [selectedObject]);

  const deleteUploadedImage = useCallback(async (id: string) => {
    await deleteImageRecord(id);
    setImageLibrary((current) => current.filter((record) => record.id !== id));
    setObjects((current) => current.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    setSaveStatus('已删除图片，有未保存改动');
  }, []);

  const duplicateSelected = useCallback(async () => {
    if (!selectedObject) return;
    const id = makeId(`${selectedObject.layer}-copy`);
    const copy: ParadoxPlacedImage = {
      ...selectedObject,
      id,
      name: `${selectedObject.name} 副本`,
      x: selectedObject.x + 2,
      y: selectedObject.y + 2,
      zIndex: selectedObject.zIndex + 1,
    };
    await saveImageRecord(id, selectedObject.src);
    setImageLibrary((current) => [...current.filter((record) => record.id !== id), { id, src: selectedObject.src }]);
    setObjects((current) => [...current, copy]);
    setSelectedId(id);
    setSaveStatus('有未保存改动');
  }, [selectedObject]);

  const exportLayout = useCallback(() => {
    const payload: ExportedParadoxLayout = {
      version: 1,
      exportedAt: new Date().toISOString(),
      objects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paradox-mirror-layout-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [objects]);

  const importLayout = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as ExportedParadoxLayout;
    if (!parsed.objects || !Array.isArray(parsed.objects)) return;
    for (const item of parsed.objects) {
      if (item.src) {
        await saveImageRecord(item.id, item.src);
      }
    }
    await refreshImageLibrary().catch(() => {});
    const opaqueObjects = parsed.objects.map(forceOpaqueObject);
    setObjects(opaqueObjects);
    setSelectedId(opaqueObjects[0]?.id ?? null);
    setSaveStatus('已导入配置，点击保存后刷新才会保留');
  }, [refreshImageLibrary]);

  const handleCursorMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    cursorElementRef.current?.style.setProperty('--paradox-cursor-x', `${event.clientX}px`);
    cursorElementRef.current?.style.setProperty('--paradox-cursor-y', `${event.clientY}px`);

    const target = event.target;
    const overPanel = target instanceof Element && Boolean(target.closest('[data-paradox-dev-panel="true"]'));
    const overPortal = !devOpen &&
      !overPanel &&
      target instanceof Element &&
      Boolean(target.closest('[data-paradox-portal="true"]'));

    const grabbingObject = grabbedObjectIdRef.current !== null;
    setCursorState((current) => {
      if (
        current.visible &&
        current.overPortal === overPortal &&
        current.overPanel === overPanel &&
        current.grabbingObject === grabbingObject
      ) {
        return current;
      }

      return {
        x: event.clientX,
        y: event.clientY,
        visible: true,
        overPortal,
        overPanel,
        grabbingObject,
      };
    });
  }, [devOpen]);

  const handleCursorLeave = useCallback(() => {
    setCursorState((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const finishZoomLoop = useCallback(() => {
    if (!zoomingRef.current) return;
    zoomingRef.current = false;
    setZooming(false);
    revokeZoomSnapshots(zoomSnapshotsRef.current);
    zoomSnapshotsRef.current = null;
    setZoomSnapshots(null);
    setZoomDepth((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!zooming) return undefined;
    const timer = window.setTimeout(() => {
      finishZoomLoop();
    }, ZOOM_DURATION_MS + 80);
    return () => window.clearTimeout(timer);
  }, [finishZoomLoop, zooming]);

  useEffect(() => {
    if (
      devOpen ||
      zooming ||
      zoomDepth < FINAL_RECURSION_DEPTH ||
      finalSequenceStartedRef.current
    ) {
      return undefined;
    }

    const startTimer = window.setTimeout(() => {
      startFinalSequenceNow();
    }, 0);

    return () => window.clearTimeout(startTimer);
  }, [devOpen, startFinalSequenceNow, zoomDepth, zooming]);

  function renderClockHands() {
    const rotations = getClockHandRotations(clockNow);

    return (
      <div className={styles.clockHands} aria-hidden="true">
        <span
          className={[styles.clockHand, styles.clockHourHand].join(' ')}
          style={{ '--clock-hand-angle': rotations.hour } as CSSProperties}
        />
        <span
          className={[styles.clockHand, styles.clockMinuteHand].join(' ')}
          style={{ '--clock-hand-angle': rotations.minute } as CSSProperties}
        />
        <span
          className={[styles.clockHand, styles.clockSecondHand].join(' ')}
          style={{ '--clock-hand-angle': rotations.second } as CSSProperties}
        />
        <span className={styles.clockCenterDot} />
      </div>
    );
  }

  function renderMacBookCameraScreen() {
    if (!cameraStream) return null;

    return (
      <div
        className={styles.macbookCameraScreen}
        style={{
          left: `${MACBOOK_SCREEN_BOUNDS.left * 100}%`,
          top: `${MACBOOK_SCREEN_BOUNDS.top * 100}%`,
          width: `${MACBOOK_SCREEN_BOUNDS.width * 100}%`,
          height: `${MACBOOK_SCREEN_BOUNDS.height * 100}%`,
        }}
        aria-hidden="true"
      >
        <video
          ref={(node) => {
            if (node && node.srcObject !== cameraStream) {
              node.srcObject = cameraStream;
            }
          }}
          autoPlay
          muted
          playsInline
          className={styles.macbookCameraVideo}
        />
      </div>
    );
  }

  function renderFinalTextGlyphs() {
    if (!finalSequenceActive) return null;

    return (
      <div className={styles.finalTextLayer} aria-label="章节文本逃难">
        {finalTextGlyphs.map((glyph) => (
          <span
            key={glyph.id}
            className={styles.finalTextGlyph}
            style={{
              left: `${glyph.x}%`,
              top: `${glyph.y}%`,
              '--final-glyph-delay': `${glyph.delay}ms`,
              '--final-glyph-size': `${glyph.size}vw`,
              '--final-glyph-rotation': `${glyph.rotation}deg`,
            } as CSSProperties}
            onPointerEnter={(event) => moveFinalGlyphAway(glyph.id, event)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              grabObject(glyph.id);
            }}
          >
            {glyph.char}
          </span>
        ))}
      </div>
    );
  }

  function renderFinalSequenceScene(baseDepth: number) {
    return (
      <>
        <div className={styles.interior} aria-hidden="true" />
        <div
          className={[
            styles.finalUploadedScene,
            finalSequenceActive ? styles.finalUploadedSceneActive : '',
          ].filter(Boolean).join(' ')}
          aria-hidden="true"
        >
          {renderSceneObjects(baseDepth, 'preview', (item) => item.layer === 'interior')}
        </div>
        <div className={styles.finalStaticScene} aria-hidden="true">
          {renderSceneObjects(baseDepth, 'full', (item) => item.layer !== 'interior')}
        </div>
        {renderFinalTextGlyphs()}
      </>
    );
  }

  function renderSceneObjects(
    recursionDepth: number,
    mode: SceneObjectRenderMode = 'full',
    filterItem?: (item: ParadoxPlacedImage) => boolean,
  ) {
    const isLightweight = mode !== 'full';
    const sceneObjects = sortedObjects
    .filter((item) => (filterItem ? filterItem(item) : true))
    .filter((item) => {
      if (mode === 'shell') return item.layer !== 'interior';
      return true;
    });
    const visibleObjects = mode === 'shell'
      ? sceneObjects
      : isLightweight
        ? [
          ...sceneObjects.slice(0, MAX_PREVIEW_OBJECTS),
          ...sceneObjects.filter((item) => (
            isClockFaceObject(item) ||
            isMacBookObject(item)
          )),
        ].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
        : sceneObjects;

    return visibleObjects
    .map((item) => {
      const isLiveFleeObject = mode === 'full' &&
        !finalSequenceActive &&
        item.layer === 'object' &&
        recursionDepth === zoomDepth &&
        !zooming;
      const isLiveMediaObject = isClockFaceObject(item) || isMacBookObject(item);
      const showLiveEffects = isLiveMediaObject && mode !== 'shell';
      const reduceImageClarity = item.layer !== 'interior' && !isClockFaceObject(item) && !isMacBookObject(item);
      return (
        <div
          key={`${item.id}-scene-${recursionDepth}-${mode}`}
          className={[
            styles.stageObject,
            styles.recursiveObject,
            isLightweight ? styles.lightweightObject : '',
            isLiveMediaObject ? styles.liveMediaObject : '',
            isLiveFleeObject ? styles.fleeObject : '',
          ].filter(Boolean).join(' ')}
          style={getObjectStyle(item)}
          onPointerEnter={(event) => {
            if (isLiveFleeObject) moveObjectAway(item.id, event);
          }}
          onPointerDown={(event) => {
            if (!isLiveFleeObject || event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            grabObject(item.id);
          }}
        >
          {showLiveEffects && isMacBookObject(item) && renderMacBookCameraScreen()}
          <img
            className={reduceImageClarity ? styles.reducedSceneImage : undefined}
            src={item.src}
            alt=""
            draggable={false}
            decoding="async"
            loading={isLightweight ? 'lazy' : 'eager'}
          />
          {showLiveEffects && isClockFaceObject(item) && renderClockHands()}
        </div>
      );
    });
  }

  function renderEditOverlay() {
    return (
      <div className={styles.editOverlay} aria-label="Paradox 编辑热区">
        {sortedObjects
        .map((item) => {
          const selected = item.id === selectedId;
          return (
            <div
              key={`${item.id}-editor`}
              className={[
                styles.stageObject,
                styles.editableObject,
                selected ? styles.selectedObject : '',
              ].filter(Boolean).join(' ')}
              style={getObjectStyle(item)}
              onPointerDown={(event) => handleObjectPointerDown(event, item, 'move')}
              role="button"
              tabIndex={0}
              aria-label={item.name}
            >
              {selected && (
            <>
              <button
                className={styles.resizeHandle}
                aria-label="缩放图片"
                onPointerDown={(event) => handleObjectPointerDown(event, item, 'resize')}
              />
              <button
                className={styles.rotateHandle}
                aria-label="旋转图片"
                onPointerDown={(event) => handleObjectPointerDown(event, item, 'rotate')}
              />
            </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderPortal(
    baseDepth: number,
    recursionDepth: number,
    nested = false,
    mode: 'full' | 'frameOnly' | 'contentOnly' = 'full',
  ) {
    const portalStyle: CSSProperties = nested
      ? { width: 'var(--portal-width-percent)' }
      : { width: 'clamp(421px, 38.88vw, 842px)' };
    const showContent = mode === 'full' || mode === 'contentOnly';
    const showFrame = mode === 'full' || mode === 'frameOnly';

    return (
      <div
        data-paradox-portal={nested ? undefined : 'true'}
        className={nested ? styles.recursivePortal : styles.portal}
        style={portalStyle}
        onClick={(event) => {
          event.stopPropagation();
          startZoomLoop();
        }}
      >
        {showContent && (
          <div className={styles.mirrorInterior}>
            <div className={styles.recursiveScene} style={INNER_SCENE_STYLE}>
              {renderSceneObjects(baseDepth + recursionDepth + 1, 'preview')}
              {recursionDepth < MAX_RECURSION_DEPTH && renderPortal(baseDepth, recursionDepth + 1, true)}
            </div>
          </div>
        )}
        {showFrame && (
          <img className={styles.defaultMirrorFrame} src="/Mirror-frame.png" alt="" draggable={false} />
        )}
      </div>
    );
  }

  function renderRecursiveScene(baseDepth: number) {
    if (baseDepth >= FINAL_RECURSION_DEPTH) {
      return renderFinalSequenceScene(baseDepth);
    }

    return (
      <>
        <div className={styles.interior} aria-hidden="true" />
        {renderSceneObjects(baseDepth)}
        {renderPortal(baseDepth, 0)}
      </>
    );
  }

  function renderOutsideMirrorObjects(baseDepth: number) {
    return getOutsideMirrorClips(zoomGeometry.portalWidthPercent).map((clip) => (
      <div
        className={styles.outsideMirrorClip}
        key={`outside-clip-${clip.id}-${baseDepth}`}
        style={{
          left: `${clip.left}%`,
          top: `${clip.top}%`,
          width: `${clip.width}%`,
          height: `${clip.height}%`,
        }}
      >
        <div
          className={styles.outsideMirrorClipContent}
          style={{
            left: `${-(clip.left / clip.width) * 100}%`,
            top: `${-(clip.top / clip.height) * 100}%`,
            width: `${(100 / clip.width) * 100}%`,
            height: `${(100 / clip.height) * 100}%`,
          }}
        >
          {renderSceneObjects(baseDepth, 'shell')}
        </div>
      </div>
    ));
  }

  function renderRecursiveShell(baseDepth: number) {
    return (
      <>
        {renderOutsideMirrorObjects(baseDepth)}
        {renderPortal(baseDepth, 0, false, 'frameOnly')}
      </>
    );
  }

  const cursorHotspot = PARADOX_CURSOR_HOTSPOT;
  const cursorVisible = cursorState.visible && !cursorState.overPanel && !devOpen;

  return (
    <section
      className={styles.paradoxChapter}
      aria-label="Paradox 递归镜面空间"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => {
        event.stopPropagation();
        handleCursorMove(event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        releaseGrabbedObject();
      }}
      onPointerLeave={handleCursorLeave}
    >
      <div className={styles.viewContainer}>
        <div
          ref={stageRef}
          className={[
            styles.fullview,
            devOpen ? styles.editing : '',
          ].filter(Boolean).join(' ')}
          style={{
            '--mirror-aspect': MIRROR_ASPECT,
            '--stage-height-ratio': MIRROR_STAGE_HEIGHT_RATIO,
            '--portal-x': `${PORTAL_CENTER.x}%`,
            '--portal-y': `${PORTAL_CENTER.y}%`,
            '--zoom-origin-x': `${zoomGeometry.origin.x}px`,
            '--zoom-origin-y': `${zoomGeometry.origin.y}px`,
            '--zoom-scale': zoomGeometry.scale,
            '--portal-width-percent': `${zoomGeometry.portalWidthPercent}%`,
          } as CSSProperties}
        >
          {zooming ? (
            <>
              {zoomSnapshots ? (
                <>
                  <div
                    className={[styles.sceneLayer, styles.zoomNextScene].join(' ')}
                    aria-hidden="true"
                  >
                    <img className={styles.bakedSceneImage} src={zoomSnapshots.nextSceneSrc} alt="" draggable={false} />
                  </div>
                  <div className={[styles.sceneLayer, styles.zoomPreviousContentScene].join(' ')}>
                    <img
                      className={styles.bakedSceneImage}
                      src={zoomSnapshots.currentSceneSrc}
                      alt=""
                      draggable={false}
                    />
                  </div>
                  <div
                    className={[styles.sceneLayer, styles.zoomPreviousShellScene].join(' ')}
                    onAnimationEnd={finishZoomLoop}
                  >
                    <img
                      className={styles.bakedSceneImage}
                      src={zoomSnapshots.previousShellSrc}
                      alt=""
                      draggable={false}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div
                    ref={zoomNextSceneRef}
                    className={[styles.sceneLayer, styles.zoomNextScene].join(' ')}
                    aria-hidden="true"
                    data-paradox-warm-layer="next"
                  >
                    {renderRecursiveScene(zoomDepth + 1)}
                  </div>
                  <div className={[styles.sceneLayer, styles.zoomPreviousContentScene].join(' ')}>
                    {renderRecursiveScene(zoomDepth)}
                  </div>
                  <div
                    className={[styles.sceneLayer, styles.zoomPreviousShellScene].join(' ')}
                    onAnimationEnd={finishZoomLoop}
                  >
                    {renderRecursiveShell(zoomDepth)}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className={styles.sceneLayer}>
              {renderRecursiveScene(zoomDepth)}
            </div>
          )}
          {devOpen && renderEditOverlay()}
          {!devOpen && !finalSequenceActive && zoomDepth < FINAL_RECURSION_DEPTH && (
            <button
              data-paradox-portal="true"
              className={styles.zoomloop}
              aria-label="进入递归镜面"
              onClick={(event) => {
                event.stopPropagation();
                startZoomLoop();
              }}
            />
          )}
        </div>
      </div>

      {cursorVisible && (
        <div
          ref={cursorElementRef}
          className={styles.paradoxCursor}
          aria-hidden="true"
          style={{
            '--paradox-cursor-x': `${cursorState.x}px`,
            '--paradox-cursor-y': `${cursorState.y}px`,
            '--paradox-cursor-hotspot-x': cursorHotspot.x,
            '--paradox-cursor-hotspot-y': cursorHotspot.y,
          } as CSSProperties}
        />
      )}

      {devOpen && (
        <aside
          ref={devPanelRef}
          className={styles.devPanel}
          aria-label="Paradox 开发者面板"
          data-paradox-dev-panel="true"
          style={{
            '--dev-panel-x': `${devPanelPosition.x}px`,
            '--dev-panel-y': `${devPanelPosition.y}px`,
          } as CSSProperties}
        >
          <header
            className={styles.devHeader}
            onPointerDown={handleDevPanelHeaderPointerDown}
          >
            <div>
              <p>悖论图层</p>
              <span>拖动这里移动面板，按 Tab 关闭</span>
            </div>
            <button type="button" onClick={() => setDevOpen(false)}>关闭</button>
          </header>

          <div className={styles.uploadGrid}>
            {LAYER_ORDER.map((layer) => (
              <div className={styles.uploadRow} key={layer}>
                <div>
                  <strong>{LAYER_LABELS[layer]}</strong>
                  <span>{objects.filter((item) => item.layer === layer).length} 张图片</span>
                </div>
                <button type="button" onClick={() => fileInputRefs.current[layer]?.click()}>
                  上传
                </button>
                <input
                  ref={(node) => {
                    fileInputRefs.current[layer] = node;
                  }}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => handleUpload(event, layer)}
                />
              </div>
            ))}
          </div>

          <section className={styles.selectedPanel}>
            <h2>当前选中</h2>
            {selectedObject ? (
              <>
                <label>
                  名称
                  <input
                    value={selectedObject.name}
                    onChange={(event) => updateObject(selectedObject.id, (item) => ({
                      ...item,
                      name: event.target.value,
                    }))}
                  />
                </label>
                <label>
                  图层
                  <select
                    value={selectedObject.layer}
                    onChange={(event) => updateObject(selectedObject.id, (item) => ({
                      ...item,
                      layer: event.target.value as ParadoxLayerKind,
                    }))}
                  >
                    {LAYER_ORDER.map((layer) => (
                      <option value={layer} key={layer}>{LAYER_LABELS[layer]}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.controlGrid}>
                  <label>
                    横向
                    <input
                      type="number"
                      value={selectedObject.x.toFixed(2)}
                      onChange={(event) => updateObject(selectedObject.id, (item) => ({
                        ...item,
                        x: Number(event.target.value),
                      }))}
                    />
                  </label>
                  <label>
                    纵向
                    <input
                      type="number"
                      value={selectedObject.y.toFixed(2)}
                      onChange={(event) => updateObject(selectedObject.id, (item) => ({
                        ...item,
                        y: Number(event.target.value),
                      }))}
                    />
                  </label>
                  <label>
                    宽度
                    <input
                      type="number"
                      value={selectedObject.width.toFixed(2)}
                      onChange={(event) => updateObject(selectedObject.id, (item) => ({
                        ...item,
                        width: Math.max(0.25, Number(event.target.value)),
                      }))}
                    />
                  </label>
                  <label>
                    高度
                    <input
                      type="number"
                      value={selectedObject.height.toFixed(2)}
                      onChange={(event) => updateObject(selectedObject.id, (item) => ({
                        ...item,
                        height: Math.max(0.25, Number(event.target.value)),
                      }))}
                    />
                  </label>
                </div>
                <label>
                  层级
                  <input
                    type="number"
                    value={selectedObject.zIndex}
                    onChange={(event) => updateObject(selectedObject.id, (item) => ({
                      ...item,
                      zIndex: Number(event.target.value),
                    }))}
                  />
                </label>
                <label>
                  旋转
                  <input
                    type="number"
                    value={selectedObject.rotation.toFixed(1)}
                    onChange={(event) => updateObject(selectedObject.id, (item) => ({
                      ...item,
                      rotation: Number(event.target.value),
                    }))}
                  />
                </label>
                <div className={styles.buttonRow}>
                  <button type="button" onClick={duplicateSelected}>复制</button>
                  <button type="button" onClick={deleteSelected}>删除</button>
                </div>
              </>
            ) : (
              <p className={styles.emptySelected}>尚未选中图片。</p>
            )}
          </section>

          <section className={styles.libraryPanel}>
            <header>
              <h2>已上传图片库</h2>
              <button type="button" onClick={() => refreshImageLibrary().catch(() => setSaveStatus('无法刷新图片库'))}>
                刷新
              </button>
            </header>
            <p>共 {imageLibrary.length} 张，删除后点击保存当前画面。</p>
            <div className={styles.libraryGrid}>
              {imageLibrary.map((record) => {
                const linkedObject = objects.find((item) => item.id === record.id);
                const linkedSelected = Boolean(linkedObject && linkedObject.id === selectedId);
                return (
                  <article
                    className={[
                      styles.libraryItem,
                      linkedSelected ? styles.selectedLibraryItem : '',
                    ].filter(Boolean).join(' ')}
                    key={record.id}
                    onClick={() => {
                      if (linkedObject) setSelectedId(linkedObject.id);
                    }}
                  >
                    <button
                      type="button"
                      className={styles.libraryThumb}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (linkedObject) setSelectedId(linkedObject.id);
                      }}
                      aria-label={linkedObject ? `选中 ${linkedObject.name}` : '未保存图片'}
                    >
                      <img src={record.src} alt="" draggable={false} />
                    </button>
                    <div>
                      <strong>{linkedObject?.name ?? '未保存图片'}</strong>
                      <span>{linkedObject ? LAYER_LABELS[linkedObject.layer] : '不在当前画面中'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteUploadedImage(record.id).catch(() => setSaveStatus('删除失败'));
                      }}
                    >
                      删除
                    </button>
                  </article>
                );
              })}
              {!imageLibrary.length && (
                <p className={styles.emptySelected}>还没有上传图片。</p>
              )}
            </div>
          </section>

          <footer className={styles.devFooter}>
            <button type="button" onClick={() => persistLayout(objects)}>保存当前画面</button>
            <button type="button" onClick={() => bakeLayoutToProject().catch(() => setSaveStatus('烘焙失败'))}>
              烘焙到项目
            </button>
            <button type="button" onClick={exportLayout}>导出配置</button>
            <button type="button" onClick={() => importInputRef.current?.click()}>导入配置</button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importLayout}
            />
            <p>{saveStatus}</p>
          </footer>
        </aside>
      )}
    </section>
  );
}
