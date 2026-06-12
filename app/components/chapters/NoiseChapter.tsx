'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './NoiseChapter.module.css';

const NOISE_AUDIO_SRC = '/audio/ikea-exit-music.m4a';
const NOISE_ATLAS_SRC = '/noise-prebaked/atlas/noise-fragments-atlas.webp';
const NOISE_ATLAS_METADATA_SRC = '/noise-prebaked/atlas/noise-fragments-atlas.json';
const NOISE_SEED = 20260528;
const POINT_DWELL_MS = 5200;
const BURST_DURATION_MS = POINT_DWELL_MS * 6;
const PLANNED_FRAGMENT_COUNT = 6600;
const MAX_VISIBLE_FRAGMENTS = 3600;
const PREBAKED_IMAGE_TARGET = 5981;
const MAX_SPAWN_PER_FRAME = 42;
const MAX_EXTRA_QUEUE = 1300;
const FLOOD_GRID_COLUMNS = 28;
const FLOOD_GRID_ROWS = 16;
const CHAPTER_ERUPTION_ORDER = ['alphabet', 'noclipping', 'dimension', 'paradox', 'noise'] as const;

type NoiseChapterKey = typeof CHAPTER_ERUPTION_ORDER[number] | 'origin';

type Depth = 'far' | 'mid' | 'near';

type NoiseTopologyFragment = {
  id: string;
  src: string;
  room: string;
  fileName: string;
};

type NoiseBurstParticlePlan = {
  spawnTimeMs: number;
  imageIndex: number;
  angle: number;
  speed: number;
  spin: number;
  startScale: number;
  endScale: number;
  lifeMs: number;
  gravity: number;
  drag: number;
  outwardForce: number;
  opacity: number;
  depth: Depth;
};

type LoadedNoiseImage = {
  frame: NoiseAtlasFrame;
  fragment: NoiseTopologyFragment;
  loaded: boolean;
};

type NoiseAtlasFrame = {
  id: string;
  fileName: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type NoiseAtlasMetadata = {
  atlas: string;
  count: number;
  usableCount?: number;
  width: number;
  height: number;
  frames: ([number, number, number, number] | NoiseAtlasFrame)[];
};

type NoiseParticle = {
  active: boolean;
  imageIndex: number;
  depth: Depth;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  startScale: number;
  endScale: number;
  scale: number;
  opacity: number;
  baseOpacity: number;
  gravity: number;
  drag: number;
  outwardForce: number;
  bornAt: number;
  lifeMs: number;
  settleMs: number;
};

type NoiseEruptionPoint = {
  id: string;
  chapter: NoiseChapterKey;
  order: number;
  x: number;
  y: number;
  radius: number;
  power: number;
};

function createSeededRng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

const noiseImagePoolFragments: NoiseTopologyFragment[] = Array.from({ length: PREBAKED_IMAGE_TARGET }, (_, index) => {
  const number = String(index + 1).padStart(4, '0');
  return {
    id: `noise-prebaked-${number}`,
    src: `/noise-prebaked/fragments/noise-fragment-${number}.png`,
    room: 'prebaked',
    fileName: `noise-fragment-${number}.png`,
  };
});

function getPhase(elapsedMs: number) {
  if (elapsedMs < 1200) return 0;
  if (elapsedMs < 3600) return 1;
  if (elapsedMs < 7200) return 2;
  return 3;
}

function chooseDepth(rng: () => number, phase: number): Depth {
  const roll = rng();
  if (phase >= 3) {
    if (roll < 0.2) return 'far';
    if (roll < 0.68) return 'mid';
    return 'near';
  }
  if (phase >= 2) {
    if (roll < 0.32) return 'far';
    if (roll < 0.78) return 'mid';
    return 'near';
  }
  if (roll < 0.5) return 'far';
  if (roll < 0.88) return 'mid';
  return 'near';
}

function buildBurstPlan(imageCount: number) {
  const rng = createSeededRng(NOISE_SEED);
  const plan: NoiseBurstParticlePlan[] = [];
  const burstWeights = [1.4, 0.72, 1.05, 1.55, 0.9, 1.72, 0.82, 1.28, 1.9, 1.1, 1.48, 0.86, 1.66, 1.2, 2.02, 1.34, 1.76, 1.46, 2.18, 2.36];
  const totalWeight = burstWeights.reduce((sum, weight) => sum + weight, 0);
  let emitted = 0;

  burstWeights.forEach((weight, burstIndex) => {
    const time = (burstIndex / burstWeights.length) * BURST_DURATION_MS;
    const phase = getPhase(time);
    const count = burstIndex === burstWeights.length - 1
      ? PLANNED_FRAGMENT_COUNT - emitted
      : Math.floor((weight / totalWeight) * PLANNED_FRAGMENT_COUNT);
    const burstWindow = (BURST_DURATION_MS / burstWeights.length) * 0.72;
    const directionBias = rng() * Math.PI * 2;

    for (let i = 0; i < count; i += 1) {
      const depth = chooseDepth(rng, phase);
      const angle = rng() < 0.36
        ? directionBias + (rng() - 0.5) * Math.PI * 0.72
        : rng() * Math.PI * 2;
      const depthSpeed = depth === 'far' ? 0.68 : depth === 'mid' ? 1 : 1.42;
      const phaseSpeed = phase === 0 ? 1 : phase === 1 ? 1.18 : phase === 2 ? 1.42 : 1.78;
      const speed = lerp(18, 86 + phase * 18, rng()) * depthSpeed * phaseSpeed;
      const lateScaleBoost = lerp(1, 1.8, clamp(time / BURST_DURATION_MS, 0, 1));
      const startScale = (depth === 'far'
        ? lerp(0.08, 0.22, rng())
        : depth === 'mid'
          ? lerp(0.16, 0.54, rng())
          : lerp(0.44, 1.18, rng())) * lateScaleBoost;
      plan.push({
        spawnTimeMs: time + (i / Math.max(1, count - 1)) * burstWindow + rng() * 3,
        imageIndex: imageCount > 0 ? Math.floor(rng() * imageCount) : 0,
        angle,
        speed,
        spin: lerp(-4.4, 4.4, rng()),
        startScale,
        endScale: startScale * lerp(0.9, 1.32, rng()),
        lifeMs: lerp(16000, 62000, rng()),
        gravity: lerp(-18, 36 + phase * 8, rng()),
        drag: lerp(0.992, 0.998, rng()),
        outwardForce: 0,
        opacity: depth === 'far' ? lerp(0.28, 0.54, rng()) : depth === 'mid' ? lerp(0.5, 0.84, rng()) : lerp(0.7, 0.97, rng()),
        depth,
      });
    }
    emitted += count;
  });

  return plan.sort((a, b) => a.spawnTimeMs - b.spawnTimeMs);
}

const noiseBurstPlan = buildBurstPlan(PREBAKED_IMAGE_TARGET);
const noisePrebakeCache = {
  started: false,
  ready: false,
  atlasImage: null as HTMLImageElement | null,
  atlasFrames: [] as NoiseAtlasFrame[],
  images: [] as LoadedNoiseImage[],
  loadedImageIndexes: [] as number[],
  listeners: new Set<() => void>(),
};

function notifyNoisePrebakeListeners() {
  noisePrebakeCache.listeners.forEach((listener) => listener());
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      image.decode?.().then(() => resolve(image)).catch(() => resolve(image));
    };
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

export function preloadNoiseEruptionImages(onUpdate?: () => void) {
  if (typeof window === 'undefined') return () => {};
  if (onUpdate) {
    noisePrebakeCache.listeners.add(onUpdate);
  }
  if (!noisePrebakeCache.started) {
    noisePrebakeCache.started = true;
    Promise.all([
      fetch(NOISE_ATLAS_METADATA_SRC).then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${NOISE_ATLAS_METADATA_SRC}`);
        return response.json() as Promise<NoiseAtlasMetadata>;
      }),
      loadImage(NOISE_ATLAS_SRC),
    ])
      .then(([metadata, atlasImage]) => {
        const frames = metadata.frames.slice(0, PREBAKED_IMAGE_TARGET).map((frame, index): NoiseAtlasFrame => {
          if (Array.isArray(frame)) {
            return {
              id: `noise-prebaked-${String(index + 1).padStart(4, '0')}`,
              fileName: `atlas-frame-${String(index + 1).padStart(4, '0')}`,
              x: frame[0],
              y: frame[1],
              width: frame[2],
              height: frame[3],
            };
          }
          return frame;
        });
        noisePrebakeCache.atlasImage = atlasImage;
        noisePrebakeCache.atlasFrames = frames;
        noisePrebakeCache.images = frames.map((frame) => ({
          frame,
          fragment: {
            id: frame.id,
            src: NOISE_ATLAS_SRC,
            room: 'atlas',
            fileName: frame.fileName,
          },
          loaded: true,
        }));
        noisePrebakeCache.loadedImageIndexes = frames.map((_, index) => index);
        noisePrebakeCache.ready = frames.length > 0;
        notifyNoisePrebakeListeners();
      })
      .catch(() => {
        noisePrebakeCache.ready = false;
        notifyNoisePrebakeListeners();
      });
  }
  if (noisePrebakeCache.ready) {
    window.setTimeout(() => onUpdate?.(), 0);
  }
  return () => {
    if (onUpdate) noisePrebakeCache.listeners.delete(onUpdate);
  };
}

export default function NoiseChapter({
  origin,
}: {
  onBack: () => void;
  origin?: { x: number; y: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<NoiseParticle[]>([]);
  const particlePoolRef = useRef<NoiseParticle[]>([]);
  const imagesRef = useRef<LoadedNoiseImage[]>([]);
  const loadedImageIndexesRef = useRef<number[]>([]);
  const planCursorRef = useRef(0);
  const lastPlanCycleElapsedRef = useRef(0);
  const extraQueueRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const eruptionPointsRef = useRef<NoiseEruptionPoint[]>([]);
  const lastPointScanAtRef = useRef(0);
  const lastSequencePointIndexRef = useRef(-1);
  const [prebakedReady, setPrebakedReady] = useState(noisePrebakeCache.ready);

  const imagePoolFragments = useMemo(() => noiseImagePoolFragments, []);
  const burstPlan = useMemo(() => noiseBurstPlan, []);

  useEffect(() => {
    imagesRef.current = noisePrebakeCache.images;
    loadedImageIndexesRef.current = noisePrebakeCache.loadedImageIndexes;
    return preloadNoiseEruptionImages(() => {
      imagesRef.current = noisePrebakeCache.images;
      loadedImageIndexesRef.current = noisePrebakeCache.loadedImageIndexes;
      setPrebakedReady(noisePrebakeCache.ready);
    });
  }, []);

  function getParticle() {
    return particlePoolRef.current.pop() ?? {
      active: false,
      imageIndex: 0,
      depth: 'mid',
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rotation: 0,
      spin: 0,
      startScale: 1,
      endScale: 1,
      scale: 1,
      opacity: 1,
      baseOpacity: 1,
      gravity: 0,
      drag: 0.99,
      outwardForce: 0,
      bornAt: 0,
      lifeMs: 30000,
      settleMs: 1200,
    };
  }

  function recycleParticle(particle: NoiseParticle) {
    particle.active = false;
    particlePoolRef.current.push(particle);
  }

  function trimParticles() {
    const particles = particlesRef.current;
    while (particles.length >= MAX_VISIBLE_FRAGMENTS) {
      const [particle] = particles.splice(0, 1);
      if (particle) recycleParticle(particle);
    }
  }

  function scanVisibleMirrorDots() {
    if (typeof document === 'undefined') return eruptionPointsRef.current;
    const selectors = [
      '[class*="nodeDotButton"]',
      '[class*="introDotButton"]',
      '[class*="pentagonPatchCenterDot"]',
      'svg[class*="dot"]',
    ];
    const seen = new Set<string>();
    const dots: NoiseEruptionPoint[] = [];
    const chapterIndexOf = (chapter: NoiseChapterKey) => (
      chapter === 'origin' ? -1 : CHAPTER_ERUPTION_ORDER.indexOf(chapter)
    );
    const readChapter = (element: Element): NoiseChapterKey | null => {
      const raw = element.getAttribute('data-noise-chapter') ||
        element.closest('[data-noise-chapter]')?.getAttribute('data-noise-chapter') ||
        element.getAttribute('aria-label') ||
        '';
      const normalized = raw.toLowerCase();
      return CHAPTER_ERUPTION_ORDER.find((chapter) => normalized.includes(chapter)) ?? null;
    };

    document.querySelectorAll<HTMLElement | SVGElement>(selectors.join(',')).forEach((element, index) => {
      if (element.closest('[data-noise-overlay="true"]')) return;
      const chapter = readChapter(element);
      if (!chapter) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.width > 90 || rect.height > 90) return;
      const stylesForElement = window.getComputedStyle(element);
      if (stylesForElement.display === 'none' || stylesForElement.visibility === 'hidden') return;
      if (Number.parseFloat(stylesForElement.opacity || '1') <= 0.02) return;

      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < -24 || y < -24 || x > window.innerWidth + 24 || y > window.innerHeight + 24) return;
      const key = `${Math.round(x / 5) * 5}:${Math.round(y / 5) * 5}`;
      if (seen.has(key)) return;
      seen.add(key);
      const radius = Math.max(5, Math.min(18, Math.max(rect.width, rect.height) / 2));
      const order = chapterIndexOf(chapter);
      dots.push({
        id: `${key}:${index}`,
        chapter,
        order,
        x,
        y,
        radius,
        power: 1.08 + Math.max(0, order) * 0.22,
      });
    });

    if (dots.length === 0 && originRef.current.x > 0 && originRef.current.y > 0) {
      dots.push({
        id: 'fallback-current-noise-node',
        chapter: 'origin',
        order: -1,
        x: originRef.current.x,
        y: originRef.current.y,
        radius: 9,
        power: 1.18,
      });
    }

    const originPoint: NoiseEruptionPoint = {
      id: 'entry-black-dot',
      chapter: 'origin',
      order: -1,
      x: originRef.current.x,
      y: originRef.current.y,
      radius: 10,
      power: 1.26,
    };
    const viewportCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const sortedChapterDots = dots
      .filter((dot) => dot.chapter !== 'origin')
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        const angleA = Math.atan2(a.y - viewportCenter.y, a.x - viewportCenter.x);
        const angleB = Math.atan2(b.y - viewportCenter.y, b.x - viewportCenter.x);
        return angleA - angleB;
      });
    eruptionPointsRef.current = [
      originPoint,
      ...sortedChapterDots,
    ];
    return eruptionPointsRef.current;
  }

  function getCurrentEruptionPoint(elapsed: number) {
    const points = eruptionPointsRef.current.length > 0 ? eruptionPointsRef.current : scanVisibleMirrorDots();
    const fallback = {
      id: 'fallback-origin',
      chapter: 'origin' as const,
      order: -1,
      x: originRef.current.x,
      y: originRef.current.y,
      radius: 9,
      power: 1,
    };
    const sequence = points.length > 0 ? points : [fallback];
    const index = Math.floor(elapsed / POINT_DWELL_MS) % sequence.length;
    if (lastSequencePointIndexRef.current !== index) {
      lastSequencePointIndexRef.current = index;
      const point = sequence[index] ?? fallback;
      extraQueueRef.current = Math.min(MAX_EXTRA_QUEUE, extraQueueRef.current + Math.round(360 * point.power));
    }
    return sequence[index] ?? fallback;
  }

  function spawnParticle(plan: NoiseBurstParticlePlan, now: number, origin: NoiseEruptionPoint) {
    trimParticles();
    const particle = getParticle();
    const originRng = createSeededRng(Math.floor(now + plan.spawnTimeMs + plan.imageIndex));
    const progress = clamp(plan.spawnTimeMs / BURST_DURATION_MS, 0, 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = -42;
    const maxScreenRadius = Math.hypot(
      Math.max(origin.x, width - origin.x),
      Math.max(origin.y, height - origin.y),
    ) * 1.34;
    const radiusLimit = lerp(24, maxScreenRadius, Math.pow(progress, 0.42));
    const screenFillChance = smoothstep((progress - 0.08) / 0.66);
    const centerCluster = originRng() > screenFillChance && originRng() < 0.16;
    const chapterJet = origin.order >= 0 ? origin.order : 0;
    const jetAngle = -Math.PI / 2 + (chapterJet / Math.max(1, CHAPTER_ERUPTION_ORDER.length)) * Math.PI * 2;
    const theta = originRng() < 0.58
      ? jetAngle + lerp(-0.58, 0.58, originRng())
      : originRng() * Math.PI * 2;
    const radius = radiusLimit * (centerCluster ? Math.pow(originRng(), 1.8) : Math.pow(originRng(), 0.2));
    const burstAngle = radius > 24 ? theta + (originRng() - 0.5) * 0.62 : plan.angle;
    const startRadius = lerp(0, origin.radius * 2.3, originRng());
    const startTheta = originRng() * Math.PI * 2;
    const cellCount = FLOOD_GRID_COLUMNS * FLOOD_GRID_ROWS;
    const cellIndex = Math.floor(originRng() * cellCount);
    const cellX = cellIndex % FLOOD_GRID_COLUMNS;
    const cellY = Math.floor(cellIndex / FLOOD_GRID_COLUMNS);
    const gridTargetX = ((cellX + 0.12 + originRng() * 0.76) / FLOOD_GRID_COLUMNS) * width;
    const gridTargetY = ((cellY + 0.12 + originRng() * 0.76) / FLOOD_GRID_ROWS) * height;
    const radialTargetX = clamp(origin.x + Math.cos(theta) * radius, margin, width - margin);
    const radialTargetY = clamp(origin.y + Math.sin(theta) * radius, margin, height - margin);
    const randomTargetX = lerp(margin, width - margin, originRng());
    const randomTargetY = lerp(margin, height - margin, originRng());
    const targetX = centerCluster
      ? radialTargetX
      : lerp(randomTargetX, gridTargetX, screenFillChance);
    const targetY = centerCluster
      ? radialTargetY
      : lerp(randomTargetY, gridTargetY, screenFillChance);
    particle.active = true;
    particle.imageIndex = plan.imageIndex % Math.max(1, imagePoolFragments.length);
    particle.depth = plan.depth;
    particle.startX = origin.x + Math.cos(startTheta) * startRadius;
    particle.startY = origin.y + Math.sin(startTheta) * startRadius;
    particle.targetX = targetX;
    particle.targetY = targetY;
    particle.x = particle.startX;
    particle.y = particle.startY;
    const slowMotionSpeed = lerp(0.045, 0.088, screenFillChance) * origin.power;
    particle.vx = Math.cos(burstAngle) * plan.speed * slowMotionSpeed;
    particle.vy = Math.sin(burstAngle) * plan.speed * slowMotionSpeed;
    particle.rotation = originRng() * Math.PI * 2;
    particle.spin = plan.spin * 0.34;
    const scaleBoost = lerp(0.9, 1.65, screenFillChance);
    particle.startScale = plan.startScale * scaleBoost * lerp(0.92, 1.38, Math.min(1, origin.power / 2.8));
    particle.endScale = plan.endScale * scaleBoost * lerp(0.98, 1.48, Math.min(1, origin.power / 2.8));
    particle.scale = particle.startScale;
    particle.opacity = plan.opacity;
    particle.baseOpacity = plan.opacity;
    particle.gravity = plan.gravity;
    particle.drag = plan.drag;
    particle.outwardForce = plan.outwardForce;
    particle.bornAt = now;
    particle.lifeMs = plan.lifeMs * 1.7;
    particle.settleMs = lerp(2600, 7800, originRng()) * lerp(1.06, 0.82, screenFillChance);
    particlesRef.current.push(particle);
  }

  function spawnScheduledParticles(elapsed: number, now: number, origin: NoiseEruptionPoint) {
    const cycleElapsed = elapsed % BURST_DURATION_MS;
    if (cycleElapsed < lastPlanCycleElapsedRef.current) {
      planCursorRef.current = 0;
      lastSequencePointIndexRef.current = -1;
      extraQueueRef.current = Math.min(MAX_EXTRA_QUEUE, extraQueueRef.current + 520);
    }
    lastPlanCycleElapsedRef.current = cycleElapsed;

    let spawned = 0;
    while (
      planCursorRef.current < burstPlan.length &&
      burstPlan[planCursorRef.current].spawnTimeMs <= cycleElapsed &&
      spawned < MAX_SPAWN_PER_FRAME
    ) {
      spawnParticle(burstPlan[planCursorRef.current], now, origin);
      planCursorRef.current += 1;
      spawned += 1;
    }

    let extra = Math.min(extraQueueRef.current, MAX_SPAWN_PER_FRAME - spawned);
    while (extra > 0) {
      const pressureRng = createSeededRng(Math.floor(now * 10 + extraQueueRef.current + origin.order * 997));
      const phase = getPhase(cycleElapsed);
      const depth = chooseDepth(pressureRng, Math.max(phase, 2));
      spawnParticle({
        spawnTimeMs: cycleElapsed,
        imageIndex: Math.floor(pressureRng() * Math.max(1, imagePoolFragments.length)),
        angle: pressureRng() * Math.PI * 2,
        speed: lerp(15, 62, pressureRng()),
        spin: lerp(-2.8, 2.8, pressureRng()),
        startScale: depth === 'near' ? lerp(0.22, 0.72, pressureRng()) : lerp(0.045, 0.26, pressureRng()),
        endScale: depth === 'near' ? lerp(0.28, 0.86, pressureRng()) : lerp(0.08, 0.34, pressureRng()),
        lifeMs: lerp(34000, 92000, pressureRng()),
        gravity: lerp(-8, 28, pressureRng()),
        drag: lerp(0.992, 0.998, pressureRng()),
        outwardForce: 0,
        opacity: depth === 'far' ? 0.5 : depth === 'mid' ? 0.78 : 0.94,
        depth,
      }, now, origin);
      extraQueueRef.current -= 1;
      extra -= 1;
    }
  }

  function updateAndEraseParticles(now: number) {
    const dt = 1 / 90;
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      const age = now - particle.bornAt;
      if (age > particle.lifeMs || particle.opacity <= 0.01) {
        particles.splice(i, 1);
        recycleParticle(particle);
        continue;
      }

      const settleProgress = clamp(age / particle.settleMs, 0, 1);
      const easedSettle = 1 - Math.pow(1 - settleProgress, 3);
      particle.vx *= particle.drag;
      particle.vy = particle.vy * particle.drag + particle.gravity * dt * 0.025;
      const driftAge = Math.max(0, age - particle.settleMs);
      const driftScale = clamp(driftAge / 5200, 0, 1);
      particle.x = lerp(particle.startX, particle.targetX, easedSettle) + particle.vx * dt * driftScale;
      particle.y = lerp(particle.startY, particle.targetY, easedSettle) + particle.vy * dt * driftScale;
      const margin = 12;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (particle.x < margin) {
        particle.x = margin;
        particle.targetX = margin;
        particle.vx *= -0.08;
      } else if (particle.x > width - margin) {
        particle.x = width - margin;
        particle.targetX = width - margin;
        particle.vx *= -0.08;
      }
      if (particle.y < margin) {
        particle.y = margin;
        particle.targetY = margin;
        particle.vy *= -0.08;
      } else if (particle.y > height - margin) {
        particle.y = height - margin;
        particle.targetY = height - margin;
        particle.vy *= -0.08;
      }
      particle.rotation += particle.spin * dt;
      particle.scale = lerp(particle.startScale, particle.endScale, clamp(age / particle.lifeMs, 0, 1));
      particle.opacity = particle.baseOpacity;
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D) {
    const atlasImage = noisePrebakeCache.atlasImage;
    if (!atlasImage) return;
    const particles = particlesRef.current;
    particles.forEach((particle) => {
      const loadedIndexes = loadedImageIndexesRef.current;
      if (loadedIndexes.length === 0) return;
      const imageIndex = loadedIndexes[particle.imageIndex % loadedIndexes.length];
      const loaded = imagesRef.current[imageIndex];
      if (!loaded?.loaded) return;
      const frame = loaded.frame;
      const maxBaseWidth = particle.depth === 'near' ? 128 : particle.depth === 'mid' ? 84 : 48;
      const baseWidth = clamp(frame.width, 18, maxBaseWidth);
      const aspect = frame.height / Math.max(1, frame.width);
      const width = baseWidth * particle.scale;
      const height = width * aspect;
      ctx.save();
      ctx.globalAlpha = particle.opacity;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.drawImage(
        atlasImage,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        -width / 2,
        -height / 2,
        width,
        height,
      );
      ctx.restore();
    });
  }

  function startEruption() {
    if (startedAtRef.current) return;
    startedAtRef.current = performance.now();
    planCursorRef.current = 0;
    lastPlanCycleElapsedRef.current = 0;
    extraQueueRef.current = 0;
    lastSequencePointIndexRef.current = -1;
    particlesRef.current = [];
    const audio = new Audio(NOISE_AUDIO_SRC);
    audio.loop = true;
    audio.volume = 0.58;
    audioRef.current = audio;
    audio.play().catch(() => {
      // Ignore transient browser audio aborts; the visual eruption must not surface a dev overlay.
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      originRef.current = origin ?? { x: width * 0.52, y: height * 0.5 };
      ctx.clearRect(0, 0, width, height);
      scanVisibleMirrorDots();
    };

    resize();
    window.addEventListener('resize', resize);

    if (!prebakedReady) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    const draw = (now: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

      const rawElapsed = now - (startedAtRef.current ?? now);
      const elapsed = Math.max(0, rawElapsed);
      if (now - lastPointScanAtRef.current > 420) {
        lastPointScanAtRef.current = now;
        scanVisibleMirrorDots();
      }
      const eruptionOrigin = getCurrentEruptionPoint(elapsed);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      spawnScheduledParticles(elapsed, now, eruptionOrigin);
      updateAndEraseParticles(now);
      drawParticles(ctx);
      ctx.restore();

      rafRef.current = window.requestAnimationFrame(draw);
    };

    startEruption();
    rafRef.current = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
      particlePoolRef.current = [];
      audioRef.current?.pause();
      audioRef.current = null;
  };
  // The animation helpers intentionally read the latest mutable refs each frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, prebakedReady]);

  return (
    <section className={styles.noiseChapter} data-noise-overlay="true">
      <canvas ref={canvasRef} className={styles.noiseCanvas} aria-label="Noise topology fragment eruption" />
    </section>
  );
}
