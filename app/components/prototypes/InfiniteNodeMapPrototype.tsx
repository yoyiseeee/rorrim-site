'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import MetadataGalleryExperience from './MetadataGalleryExperience';
import NoiseChapter, { preloadNoiseEruptionImages } from '../chapters/NoiseChapter';
import ParadoxChapter from '../chapters/ParadoxChapter';
import DodecahedronNavigator, { D12_ROLL_DURATION_MS, preloadDodecahedronImages } from './DodecahedronNavigator';
import { d12ChapterNumberAssets } from './d12ChapterNumberAssets';
import InfiniteNodeMapDevPanel from './InfiniteNodeMapDevPanel';
import TypographyEnginePanel from './TypographyEnginePanel';
import {
  DEFAULT_TYPOGRAPHY_PRESET,
  TYPOGRAPHY_RUNTIME_STYLE_ID,
  TYPOGRAPHY_STORAGE_KEY,
  createTypographyPreset,
  generateTypographyCSS,
  parseTypographyPreset,
  readStoredTypographyPreset,
  type TypographyPreset,
} from './typographyEngineState';
import {
  DODECAHEDRON_FACES,
  DODECAHEDRON_EDGE_CHAPTERS,
  getDodecahedronEdgeChapter,
  getDodecahedronNeighborByEdge,
  getNextDodecahedronFace,
} from './dodecahedronTopology';
import {
  getPentagonVertices,
  placeNeighborPentagon,
  type PentagonPatchTile,
} from './pentagonPatchTopology';
import styles from './InfiniteNodeMapPrototype.module.css';
import {
  createEdgeId,
  createEnteredNodeRecord,
  createExplorationMetrics,
  createExplorationNode,
  createOriginNodeRecord,
  createPentagonUnit,
  CHAPTERS,
  CHAPTER_VISUAL_WIDTH,
  getImageAspect,
  getNodePhase,
  getPentagonChapterPosition,
  getPentagonTargetPosition,
  getTargetCoord,
  NODE_DIRECTIONS,
  NODE_LAYOUT,
  nodeKey,
  PX_PER_MM,
  type ChapterId,
  type ChapterConfig,
  type ExplorationEdge,
  type ExplorationNode,
  type ExplorationNodeRecord,
  type NodeCoord,
  type NodeDirection,
  type PentagonUnit,
} from './infiniteNodeMapModel';
import {
  DEFAULT_PROTOTYPE_SETTINGS,
  normalizeSettings,
  readStoredSettings,
  SETTINGS_STORAGE_KEY,
  type PrototypeSettings,
} from './infiniteNodeMapSettings';
import { noclippingAdCopy, type NoclippingAdCopy } from './noclippingAdCopy';
import {
  closingAnnouncementOrder,
  getNoclippingAdAudioCue,
  noclippingBackgroundMusicSrc,
  type NoclippingAdAudioCue,
} from './noclippingAdAudio';
import {
  noclippingCatalogueVideos,
  type NoclippingCatalogueVideo,
} from './noclippingCatalogueVideos';
import {
  noclippingMirrorProductCrops,
  type NoclippingMirrorProductCrop,
} from './noclippingMirrorProductCrops';

const DEFAULT_VIEWPORT = {
  width: 1440,
  height: 900,
};
const MAP_DESIGN_VIEWPORT = {
  width: 2560,
  height: 1440,
};
const MIN_VIEWPORT_FIT_SCALE = 0.72;

const ORIGIN_COORD: NodeCoord = { q: 0, r: 0 };
const ORIGIN_KEY = nodeKey(ORIGIN_COORD);
const ORIGIN_PLAY_NODE_ID = 'play:origin';
const CAMERA_ANIMATION_MS = 680;
const MAX_RELEASE_SPEED = 1.35;
const INERTIA_MIN_SPEED = 0.035;
const SNAP_MAX_DISTANCE = 540;
const ACTIVE_SNAP_DISTANCE = 70;
const DRAG_REVEAL_RATIO = 0.34;
const DRAG_SPEED_MULTIPLIER = 1.55;
const HIDDEN_CURSOR_CLICK_MOVE_LIMIT = 3;
const HIDDEN_CURSOR_CLICK_TIME_LIMIT_MS = 220;
const HIDDEN_CURSOR_CLICK_SPEED_LIMIT = 0.018;
const RELEASE_PROJECTION_MS = 180;
const INTRO_DOT_DURATION_MS = 800;
const INTRO_TITLE_STAGGER_MS = 250;
const INTRO_TITLE_FADE_MS = 400;
const INTRO_CHROME_FADE_MS = 420;
const INTRO_SEQUENCE_MS = INTRO_DOT_DURATION_MS + INTRO_TITLE_STAGGER_MS * 4 + INTRO_TITLE_FADE_MS + INTRO_CHROME_FADE_MS;
const INTRO_MAP_OFFSET_Y = 300;
const INTRO_MIRROR_AXIS_OFFSET_Y = 30;
const INTRO_SCROLL_SPEED = 0.85;
const INTRO_SCROLL_EXTRA_Y = 800;
const INTRO_CHAPTER_SCALE = 1.75;
const INTRO_ALPHABET_DWELL_MS = 300;
const INTRO_ALPHABET_PREVIEW_PROGRESS = 0.74;
const INTRO_ALPHABET_PROGRESS_EASE = 0.075;
const CHAPTER_PORTAL_FADE_IN_MS = 1400;
const CHAPTER_PORTAL_FADE_OUT_MS = 1600;
const CHAPTER_PORTAL_UNMOUNT_BUFFER_MS = 120;
const EXTRA_INTRO_FOCUS_CHAPTERS = ['dimension', 'paradox', 'noise'] as const satisfies readonly ChapterId[];
const NOISE_AUDIO_SRC = '/audio/ikea-exit-music.m4a';
const NOISE_AUDIO_TIME_KEY = 'mirror-site:infinite-node-map:noiseAudioTime';
const PLAY_IDLE_CLOCK_DELAY_MS = 10000;
const PLAY_PATCH_DEPTH = 1;
const CHAOS_TRIGGER_PROBABILITY = 0.02;
const chapterRoutes: Partial<Record<ChapterId, string>> = {
  alphabet: '/alphabet/Mirror%20Alphabet.html',
};

type NodeStore = Record<string, ExplorationNodeRecord>;
type EdgeStore = Record<string, ExplorationEdge>;
type AppMode = 'intro' | 'play';
type ActiveExperience = 'alphabet' | 'noclipping' | 'paradox' | 'noise' | 'metadata' | null;
type CameraState = 'idle' | 'prompting' | 'requesting' | 'selecting-device' | 'ready' | 'denied' | 'error';
type CameraPanelMode = 'continuity-tip' | 'device-select' | null;
type DimensionPhase = 'dot' | 'mirror-waiting' | 'mosaic' | 'camera-unavailable';
type DimensionExtractedObject = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  vx: number;
  vy: number;
};
type NoiseEruptionOrigin = { x: number; y: number } | null;
type ChapterPortalPhase = 'idle' | 'fading' | 'loading' | 'revealing';
type ChapterPortalTarget = {
  chapterType: 'noclipping' | 'dimension';
  nodeKey: string | null;
};
type NoclipAxis = { label: string; src: string };
type NoclipSpaceConfig = {
  id: string;
  axes: NoclipAxis[];
};
type NoclipCutout = {
  src: string;
};
type NoclipAdState = {
  phase: 'entering' | 'playing' | 'exiting';
  video: NoclippingCatalogueVideo | null;
  imageSequence: NoclippingMirrorProductCrop[];
  startedAt: number;
  playStartedAt: number | null;
  duration: number;
  durationMs: number;
  preview: boolean;
  prompt: NoclippingAdCopy;
  cue: NoclippingAdAudioCue;
  entryEdge: NoclipAdEntryEdge;
  runId: number;
};
type NoclipAdEntryEdge = 'left' | 'right' | 'top' | 'bottom';
type NoclipAdVisual = {
  video: NoclippingCatalogueVideo | null;
  imageSequence: NoclippingMirrorProductCrop[];
};
type NoclipExplosionDot = {
  id: string;
  x: number;
  y: number;
  radius: number;
  power: number;
};
type NoclipExplosionParticle = {
  active: boolean;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  imageIndex: number;
  bornAt: number;
  lifeMs: number;
  settleMs: number;
  rotation: number;
  spin: number;
  scale: number;
  endScale: number;
  opacity: number;
};
type TopologyTransitionDebug = {
  currentFace: number;
  crossedEdge: number;
  neighborFace: number;
  backEdge: number;
  path: string;
};
type TopologyGate = {
  id: string;
  stableId: string;
  tileId: string;
  previewOnly: boolean;
  depth: number;
  direction: NodeDirection;
  edgeIndex: number;
  chapter: ChapterConfig;
  x: number;
  y: number;
  revealIndex: number;
};
type PlayNodeRecord = {
  id: string;
  faceIndex: number;
  rotation: number;
  center: { x: number; y: number };
  entryChapter: ChapterId | null;
  edgeChapters: ChapterId[];
  links: Partial<Record<number, string>>;
  parentNodeId: string | null;
  enteredFromEdge: number | null;
  enteredFromChapter: ChapterId | null;
  backEdgeIndex: number | null;
  createdOrder: number;
};
type PlayNodeStore = Record<string, PlayNodeRecord>;
type PlayPatchTile = PentagonPatchTile & {
  nodeId: string | null;
  entryChapter: ChapterId | null;
  edgeChapters: ChapterId[];
  previewOnly: boolean;
};

const PREFERRED_CAMERA_DEVICE_ID_KEY = 'mirror.preferredCameraDeviceId.v1';
const PREFERRED_CAMERA_LABEL_KEY = 'mirror.preferredCameraLabel.v1';
const IPHONE_CAMERA_PATTERNS = [
  /iphone/i,
  /continuity/i,
  /apple/i,
  /yangnixuan.*iphone/i,
  /nixuan.*iphone/i,
  /iphone camera/i,
];

type CameraDeviceOption = {
  deviceId: string;
  label: string;
};

const NOCLIP_AXIS_ROOMS = [
  '01', '02', '03', '04', '05',
  '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15',
  '16', '17', '18', '19', '20',
];
const NOCLIP_AXIS_KEYS = ['x', 'y', 'z', 'nx', 'ny', 'nz'] as const;
const NOCLIP_AXIS_LABELS: Record<(typeof NOCLIP_AXIS_KEYS)[number], string> = {
  x: 'x',
  y: 'y',
  z: 'z',
  nx: '-x',
  ny: '-y',
  nz: '-z',
};
const NOCLIP_SPACES: NoclipSpaceConfig[] = NOCLIP_AXIS_ROOMS.map((room) => ({
  id: room,
  axes: NOCLIP_AXIS_KEYS
    .filter((axis) => !(room === '01' && axis === 'ny'))
    .map((axis) => ({
      label: NOCLIP_AXIS_LABELS[axis],
      src: `/noclipping/axis-demo/${room}/${axis}.jpg`,
    })),
}));

function isMacBrowser() {
  if (typeof navigator === 'undefined') return false;
  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /mac/i.test(platform);
}

function normalizeCameraDevices(devices: MediaDeviceInfo[]): CameraDeviceOption[] {
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
}

async function listVideoInputDevices(): Promise<CameraDeviceOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return normalizeCameraDevices(devices);
}

function cameraLooksLikeIPhone(label: string) {
  return IPHONE_CAMERA_PATTERNS.some((pattern) => pattern.test(label));
}

function getPreferredCameraDevice(devices: CameraDeviceOption[]): CameraDeviceOption | null {
  if (!devices.length) return null;

  const storedDeviceId = window.localStorage.getItem(PREFERRED_CAMERA_DEVICE_ID_KEY);
  if (storedDeviceId) {
    const stored = devices.find((device) => device.deviceId === storedDeviceId);
    if (stored) return stored;
  }

  return devices.find((device) => cameraLooksLikeIPhone(device.label)) ?? null;
}

function readStoredCameraPreference() {
  return {
    deviceId: window.localStorage.getItem(PREFERRED_CAMERA_DEVICE_ID_KEY) ?? '',
    label: window.localStorage.getItem(PREFERRED_CAMERA_LABEL_KEY) ?? '',
  };
}

function saveCameraPreference(device: CameraDeviceOption) {
  window.localStorage.setItem(PREFERRED_CAMERA_DEVICE_ID_KEY, device.deviceId);
  window.localStorage.setItem(PREFERRED_CAMERA_LABEL_KEY, device.label);
}

const NOCLIP_CUTOUTS: Record<string, NoclipCutout> = {};
const NOCLIP_AD_ENTRY_DURATION = 1.1;
const NOCLIP_AD_EXIT_DURATION = 0.72;
const NOCLIP_AD_ENTRY_EDGES: NoclipAdEntryEdge[] = ['left', 'right', 'top', 'bottom'];
const NOCLIP_AD_FALL_INTERVALS = [34, 31, 28, 25, 22];
const NOCLIP_AD_IMAGE_GROUPS = [
  [0, 4, 8, 12, 16],
  [1, 5, 9, 13, 17],
  [2, 6, 10, 14, 18],
];
const NOCLIP_AD_DURATION_FALLBACK_MS = 10000;
const NOCLIP_TERMINAL_FALL_SPEED = 260;
const NOCLIP_FALL_ACCELERATION_MS = 22000;
const NOCLIP_BACKGROUND_GAIN = 1;
const NOCLIP_BACKGROUND_AD_GAIN = 0.1;
const NOCLIP_AD_GAIN = 6;
const NOCLIP_AD_GAIN_RAMP_IN = 2.5;
const NOCLIP_AD_GAIN_RAMP_OUT = 4;
const NOCLIP_EXPLOSION_IMAGE_COUNT = 1200;
const NOCLIP_EXPLOSION_PRELOAD_COUNT = 420;
const NOCLIP_EXPLOSION_MAX_PARTICLES = 6800;
const NOCLIP_EXPLOSION_SPAWN_BASE = 180;
const NOCLIP_EXPLOSION_COMBO_WINDOW_MS = 5200;
const NOCLIP_EXPLOSION_FRAGMENT_SRCS = Array.from({ length: NOCLIP_EXPLOSION_IMAGE_COUNT }, (_, index) => (
  `/noise-prebaked/fragments/noise-fragment-${String(index + 1).padStart(4, '0')}.png`
));
const DIMENSION_WAVE_ANALYSIS_WIDTH = 96;
const DIMENSION_WAVE_ANALYSIS_HEIGHT = 72;
const DIMENSION_WAVE_SAMPLE_INTERVAL_MS = 140;
const DIMENSION_WAVE_MOTION_THRESHOLD = 24;
const DIMENSION_WAVE_REQUIRED_HITS = 3;
const DIMENSION_OBJECT_STABLE_MS = 1000;
const DIMENSION_OBJECT_MOTION_RESET_THRESHOLD = 24;
const DIMENSION_OBJECT_STABLE_MOTION_THRESHOLD = 12;
const DIMENSION_OBJECT_DETAIL_THRESHOLD = 2.4;
const DIMENSION_OBJECT_EXTRACT_COOLDOWN_MS = 900;
const DIMENSION_MAX_EXTRACTED_OBJECTS = 40;
const DIMENSION_REVEAL_RAMP_IN_MS = 780;
const DIMENSION_REVEAL_HOLD_MS = 1000;
const DIMENSION_REVEAL_RAMP_OUT_MS = 1150;
const NOCLIP_AUDIO_SRC = noclippingBackgroundMusicSrc;
const NOCLIP_PRELOAD_IMAGE_SRCS = Array.from(new Set([
  ...NOCLIP_SPACES.flatMap((space) => space.axes.map((axis) => axis.src)),
  ...Object.values(NOCLIP_CUTOUTS).map((cutout) => cutout.src),
  ...noclippingMirrorProductCrops.map((crop) => crop.src),
]));
const NOCLIP_PRELOAD_VIDEO_SRCS = noclippingCatalogueVideos.slice(0, 2).map((video) => video.src);
const CHAPTER_IMAGE_SRCS = CHAPTERS.map((chapter) => chapter.src);
type ImageLoadStatus = 'loading' | 'loaded' | 'failed';
const chapterImageStatusCache = new Map<string, ImageLoadStatus>();
const chapterImagePromiseCache = new Map<string, Promise<ImageLoadStatus>>();

function preloadChapterImage(src: string): Promise<ImageLoadStatus> {
  const existingStatus = chapterImageStatusCache.get(src);
  if (existingStatus === 'loaded' || existingStatus === 'failed') {
    return Promise.resolve(existingStatus);
  }

  const cached = chapterImagePromiseCache.get(src);
  if (cached) return cached;

  chapterImageStatusCache.set(src, 'loading');
  const promise = new Promise<ImageLoadStatus>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const status: ImageLoadStatus = image.naturalWidth > 0 && image.naturalHeight > 0 ? 'loaded' : 'failed';
      chapterImageStatusCache.set(src, status);
      resolve(status);
    };
    image.onerror = () => {
      chapterImageStatusCache.set(src, 'failed');
      resolve('failed');
    };
    image.src = src;
    image.decode?.()
      .then(() => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          chapterImageStatusCache.set(src, 'loaded');
          resolve('loaded');
        }
      })
      .catch(() => {});
  });
  chapterImagePromiseCache.set(src, promise);
  return promise;
}

const noclipAudioDurationCache = new Map<string, Promise<number | null>>();

const resolveAudioDurationMs = (src?: string, playbackRate = 1): Promise<number | null> => {
  if (!src || typeof window === 'undefined') return Promise.resolve(null);
  const cacheKey = `${src}@${playbackRate}`;
  const cached = noclipAudioDurationCache.get(cacheKey);
  if (cached) return cached;

  const durationPromise = new Promise<number | null>((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (durationMs: number | null) => {
      if (settled) return;
      settled = true;
      audio.removeAttribute('src');
      audio.load();
      resolve(durationMs);
    };
    const timeout = window.setTimeout(() => finish(null), 6000);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      window.clearTimeout(timeout);
      const rawDurationMs = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration * 1000
        : null;
      finish(rawDurationMs === null ? null : rawDurationMs / Math.max(0.01, playbackRate));
    }, { once: true });
    audio.addEventListener('error', () => {
      window.clearTimeout(timeout);
      finish(null);
    }, { once: true });
    audio.src = src;
  });

  noclipAudioDurationCache.set(cacheKey, durationPromise);
  return durationPromise;
};

const resolveAdDurationMs = async (cue: NoclippingAdAudioCue): Promise<number> => {
  const durations = await Promise.all([
    resolveAudioDurationMs(cue.musicSrc, 1),
    resolveAudioDurationMs(cue.announcementSrc, cue.playbackRate),
  ]);
  const validDurations = durations.filter((duration): duration is number => (
    duration !== null && Number.isFinite(duration) && duration > 0
  ));

  return validDurations.length
    ? Math.max(...validDurations)
    : NOCLIP_AD_DURATION_FALLBACK_MS;
};

const NOCLIP_LABELS = [
  'flat-pack shelves',
  'plastic chair',
  'shopping bags',
  'plastic wrap',
  'car mirror',
  'green bag',
  'red safety cover',
  'blue drum',
];

export default function InfiniteNodeMapPrototype() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <main className={styles.viewport} />;
  }

  return <MountedInfiniteNodeMapPrototype />;
}

function MountedInfiniteNodeMapPrototype() {
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const initialDisplayScale = getViewportFitScale(DEFAULT_VIEWPORT);
  const [offset, setOffset] = useState(() => ({
    x: DEFAULT_VIEWPORT.width / 2,
    y: getIntroStartOffsetY(DEFAULT_VIEWPORT, initialDisplayScale),
  }));
  const [scale, setScale] = useState(1);
  const [flickerTime, setFlickerTime] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_PROTOTYPE_SETTINGS);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [typographyPanelOpen, setTypographyPanelOpen] = useState(false);
  const [typographyPreset, setTypographyPreset] = useState<TypographyPreset>(DEFAULT_TYPOGRAPHY_PRESET);
  const [typographyDirty, setTypographyDirty] = useState(false);
  const [typographyStatus, setTypographyStatus] = useState('默认排版已应用');
  const [showDots, setShowDots] = useState(true);
  const [showChapters, setShowChapters] = useState(true);
  const [appMode, setAppMode] = useState<AppMode>('intro');
  const [playPaused, setPlayPaused] = useState(false);
  const [pauseDiceRolling, setPauseDiceRolling] = useState(false);
  const [pauseDiceRollSignal, setPauseDiceRollSignal] = useState(0);
  const [pauseDiceFaceIndex, setPauseDiceFaceIndex] = useState(0);
  const [introSequencePlayed, setIntroSequencePlayed] = useState(false);
  const [hoveredChapter, setHoveredChapter] = useState<ChapterId | null>(null);
  const [introAlphabetProgress, setIntroAlphabetProgress] = useState(0);
  const [introAlphabetManifestoVisible, setIntroAlphabetManifestoVisible] = useState(false);
  const [introAlphabetManifestoExiting, setIntroAlphabetManifestoExiting] = useState(false);
  const [introNoclippingProgress, setIntroNoclippingProgress] = useState(0);
  const [introNoclippingManifestoVisible, setIntroNoclippingManifestoVisible] = useState(false);
  const [introNoclippingManifestoExiting, setIntroNoclippingManifestoExiting] = useState(false);
  const [introExtraFocusChapter, setIntroExtraFocusChapter] = useState<ChapterId | null>(null);
  const [introExtraFocusProgress, setIntroExtraFocusProgress] = useState(0);
  const [introExtraFocusManifestoVisible, setIntroExtraFocusManifestoVisible] = useState(false);
  const [introExtraFocusManifestoExiting, setIntroExtraFocusManifestoExiting] = useState(false);
  const [mouseVisualShift, setMouseVisualShift] = useState({ x: 0, y: 0 });
  const [customCursor, setCustomCursor] = useState({
    x: DEFAULT_VIEWPORT.width / 2,
    y: DEFAULT_VIEWPORT.height / 2,
    size: DEFAULT_PROTOTYPE_SETTINGS.cursorMinSize,
  });
  const [customCursorInDevPanel, setCustomCursorInDevPanel] = useState(false);
  const [mirrorOpened, setMirrorOpened] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [playCameraState, setPlayCameraState] = useState<CameraState>('idle');
  const [cameraPanelMode, setCameraPanelMode] = useState<CameraPanelMode>(null);
  const [cameraDevices, setCameraDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState('');
  const [selectedCameraLabel, setSelectedCameraLabel] = useState('');
  const [cameraSwitchPrompt, setCameraSwitchPrompt] = useState<string | null>(null);
  const [cameraDeviceStatus, setCameraDeviceStatus] = useState('');
  const [activeMirrorNodeKey, setActiveMirrorNodeKey] = useState<string | null>(null);
  const [activeMirrorChapterType, setActiveMirrorChapterType] = useState<ChapterId | null>(null);
  const [dimensionCameraStarted, setDimensionCameraStarted] = useState(false);
  const [dimensionCameraError, setDimensionCameraError] = useState<string | null>(null);
  const [dimensionPhase, setDimensionPhase] = useState<DimensionPhase>('dot');
  const [dimensionExtractedObjects, setDimensionExtractedObjects] = useState<DimensionExtractedObject[]>([]);
  const [activeExperience, setActiveExperience] = useState<ActiveExperience>(null);
  const [noiseEruptionOrigin, setNoiseEruptionOrigin] = useState<NoiseEruptionOrigin>(null);
  const [noclippingAdPreviewRequested, setNoclippingAdPreviewRequested] = useState(false);
  const [chapterPortalPhase, setChapterPortalPhase] = useState<ChapterPortalPhase>('idle');
  const [chapterPortalTarget, setChapterPortalTarget] = useState<ChapterPortalTarget | null>(null);
  const [chapterPortalReady, setChapterPortalReady] = useState(false);
  const [chapterPortalDiceStep, setChapterPortalDiceStep] = useState(0);
  const [chapterPortalDots, setChapterPortalDots] = useState(1);
  const [activeAudioChapter, setActiveAudioChapter] = useState<ChapterId | null>(null);
  const [playIdleClockVisible, setPlayIdleClockVisible] = useState(false);
  const [playIdleClockTime, setPlayIdleClockTime] = useState(() => new Date());
  const paused = appMode !== 'play' || playPaused;
  const [currentKey, setCurrentKey] = useState(ORIGIN_KEY);
  const [nodeCoords, setNodeCoords] = useState<NodeStore>(() => ({
    [ORIGIN_KEY]: createOriginNodeRecord(),
  }));
  const [edges, setEdges] = useState<EdgeStore>({});
  const [activeSnappedNodeKey, setActiveSnappedNodeKey] = useState<string | null>(ORIGIN_KEY);
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const [currentFaceRotation, setCurrentFaceRotation] = useState(0);
  const [currentChapterType, setCurrentChapterType] = useState<ChapterId | null>(null);
  const [playPath, setPlayPath] = useState<ChapterId[]>([]);
  const [playNodes, setPlayNodes] = useState<PlayNodeStore>(() => ({
    [ORIGIN_PLAY_NODE_ID]: createOriginPlayNode(),
  }));
  const [currentPlayNodeId, setCurrentPlayNodeId] = useState(ORIGIN_PLAY_NODE_ID);
  const [latestRevealedPlayNodeId, setLatestRevealedPlayNodeId] = useState<string | null>(null);
  const [revealedGateIds, setRevealedGateIds] = useState<Set<string>>(() => new Set());
  const [revealingGateIds, setRevealingGateIds] = useState<Set<string>>(() => new Set());
  const [playMovingTargetTileId, setPlayMovingTargetTileId] = useState<string | null>(null);
  const [playBlockedPromptVisible, setPlayBlockedPromptVisible] = useState(false);
  const [hudDockSettled, setHudDockSettled] = useState(false);
  const [mapPreviewMode, setMapPreviewMode] = useState(false);
  const [chaosActive, setChaosActive] = useState(false);
  const [visitedFaces, setVisitedFaces] = useState<Set<number>>(() => new Set([0]));
  const [lastTopologyTransition, setLastTopologyTransition] = useState<TopologyTransitionDebug | null>(null);
  const offsetRef = useRef(offset);
  const scaleRef = useRef(scale);
  const viewportRef = useRef(viewport);
  const displayScaleRef = useRef(scale * getViewportFitScale(viewport));
  const settingsRef = useRef(settings);
  const appModeRef = useRef(appMode);
  const pausedRef = useRef(paused);
  const pauseDiceRollingRef = useRef(false);
  const currentKeyRef = useRef(currentKey);
  const nodeCoordsRef = useRef(nodeCoords);
  const activeSnappedNodeKeyRef = useRef(activeSnappedNodeKey);
  const currentFaceIndexRef = useRef(0);
  const currentFaceRotationRef = useRef(0);
  const currentChapterTypeRef = useRef<ChapterId | null>(null);
  const playNodesRef = useRef(playNodes);
  const currentPlayNodeIdRef = useRef(currentPlayNodeId);
  const playMovingRef = useRef(false);
  const playPatchRadiusRef = useRef(DEFAULT_PROTOTYPE_SETTINGS.pentagonRadius);
  const nextPlayNodeSerialRef = useRef(1);
  const playBlockedPromptTimeoutRef = useRef<number | null>(null);
  const gateRevealTimeoutRef = useRef<number | null>(null);
  const playIdleClockTimeoutRef = useRef<number | null>(null);
  const nodeFacesRef = useRef<Record<string, number>>({ [ORIGIN_KEY]: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    startTime: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velocityX: number;
    velocityY: number;
    startNodeKey: string;
    moved: boolean;
    canOpenOnRelease: boolean;
  } | null>(null);

  useEffect(() => {
    if (!devPanelOpen) {
      const frame = window.requestAnimationFrame(() => setCustomCursorInDevPanel(false));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [devPanelOpen]);
  const cameraFrameRef = useRef<number | null>(null);
  const motionFrameRef = useRef<number | null>(null);
  const visualFrameRef = useRef<number | null>(null);
  const customCursorFrameRef = useRef<number | null>(null);
  const mouseVisualShiftRef = useRef(mouseVisualShift);
  const mouseVisualTargetRef = useRef(mouseVisualShift);
  const lastPointerRef = useRef({ x: DEFAULT_VIEWPORT.width / 2, y: DEFAULT_VIEWPORT.height / 2 });
  const customCursorRef = useRef(customCursor);
  const customCursorTargetRef = useRef(customCursor);
  const introAlphabetProgressRef = useRef(0);
  const introAlphabetTargetRef = useRef(0);
  const introAlphabetFrameRef = useRef<number | null>(null);
  const introAlphabetDwellTimeoutRef = useRef<number | null>(null);
  const introAlphabetExitTimeoutRef = useRef<number | null>(null);
  const introAlphabetManifestoVisibleRef = useRef(false);
  const introNoclippingProgressRef = useRef(0);
  const introNoclippingTargetRef = useRef(0);
  const introNoclippingFrameRef = useRef<number | null>(null);
  const introNoclippingDwellTimeoutRef = useRef<number | null>(null);
  const introNoclippingExitTimeoutRef = useRef<number | null>(null);
  const introNoclippingManifestoVisibleRef = useRef(false);
  const introExtraFocusChapterRef = useRef<ChapterId | null>(null);
  const introExtraFocusProgressRef = useRef(0);
  const introExtraFocusTargetRef = useRef(0);
  const introExtraFocusFrameRef = useRef<number | null>(null);
  const introExtraFocusDwellTimeoutRef = useRef<number | null>(null);
  const introExtraFocusExitTimeoutRef = useRef<number | null>(null);
  const introExtraFocusManifestoVisibleRef = useRef(false);
  const storageReadyRef = useRef(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const playCameraStateRef = useRef<CameraState>('idle');
  const cameraDevicesRef = useRef<CameraDeviceOption[]>([]);
  const selectedCameraDeviceIdRef = useRef('');
  const cameraTipShownRef = useRef(false);
  const mirrorVideoRef = useRef<HTMLVideoElement | null>(null);
  const dimensionStreamRef = useRef<MediaStream | null>(null);
  const dimensionVideoRef = useRef<HTMLVideoElement | null>(null);
  const dimensionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dimensionFrameRef = useRef<number | null>(null);
  const dimensionMotionIntervalRef = useRef<number | null>(null);
  const dimensionExtractSerialRef = useRef(0);
  const dimensionMosaicRevealStartRef = useRef<number | null>(null);
  const noiseAudioRef = useRef<HTMLAudioElement | null>(null);
  const noiseAudioTimeRef = useRef(0);

  const startMouseVisualShiftAnimation = useCallback(() => {
    if (visualFrameRef.current !== null) return;

    const tick = () => {
      const current = mouseVisualShiftRef.current;
      const target = mouseVisualTargetRef.current;
      const ease = settingsRef.current.parallaxEase;
      const next = {
        x: current.x + (target.x - current.x) * ease,
        y: current.y + (target.y - current.y) * ease,
      };
      const distance = Math.hypot(target.x - next.x, target.y - next.y);

      if (distance < 0.02) {
        mouseVisualShiftRef.current = target;
        setMouseVisualShift(target);
        visualFrameRef.current = null;
        return;
      }

      mouseVisualShiftRef.current = next;
      setMouseVisualShift(next);
      visualFrameRef.current = window.requestAnimationFrame(tick);
    };

    visualFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const setMouseVisualTarget = useCallback((target: { x: number; y: number }) => {
    mouseVisualTargetRef.current = target;
    startMouseVisualShiftAnimation();
  }, [startMouseVisualShiftAnimation]);

  const updateMouseVisualTarget = useCallback((clientX: number, clientY: number) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.parallaxEnabled || currentSettings.parallaxRange <= 0) {
      setMouseVisualTarget({ x: 0, y: 0 });
      return;
    }

    const currentViewport = viewportRef.current;
    const range = currentSettings.parallaxRange;
    const normalizedX = currentViewport.width > 0 ? (clientX / currentViewport.width - 0.5) * 2 : 0;
    const normalizedY = currentViewport.height > 0 ? (clientY / currentViewport.height - 0.5) * 2 : 0;
    setMouseVisualTarget({
      x: normalizedX * range,
      y: normalizedY * range,
    });
  }, [setMouseVisualTarget]);

  const holdMouseVisualShiftAtOrigin = useCallback(() => {
    if (visualFrameRef.current !== null) {
      window.cancelAnimationFrame(visualFrameRef.current);
      visualFrameRef.current = null;
    }
    mouseVisualShiftRef.current = { x: 0, y: 0 };
    mouseVisualTargetRef.current = { x: 0, y: 0 };
    setMouseVisualShift({ x: 0, y: 0 });
  }, []);

  const startCustomCursorAnimation = useCallback(() => {
    if (customCursorFrameRef.current !== null) return;

    const tick = () => {
      const current = customCursorRef.current;
      const target = customCursorTargetRef.current;
      const ease = settingsRef.current.cursorEase;
      const next = {
        x: target.x,
        y: target.y,
        size: current.size + (target.size - current.size) * ease,
      };
      const sizeDistance = Math.abs(target.size - next.size);

      if (sizeDistance < 0.05) {
        customCursorRef.current = target;
        setCustomCursor(target);
        customCursorFrameRef.current = null;
        return;
      }

      customCursorRef.current = next;
      setCustomCursor(next);
      customCursorFrameRef.current = window.requestAnimationFrame(tick);
    };

    customCursorFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const updateCustomCursorTarget = useCallback((clientX: number, clientY: number) => {
    const next = {
      x: clientX,
      y: clientY,
      size: getCustomCursorSize(displayScaleRef.current, settingsRef.current),
    };
    customCursorTargetRef.current = next;
    startCustomCursorAnimation();
  }, [startCustomCursorAnimation]);


  const startIntroAlphabetProgressAnimation = useCallback(() => {
    if (introAlphabetFrameRef.current !== null) return;

    const tick = () => {
      const current = introAlphabetProgressRef.current;
      const target = introAlphabetTargetRef.current;
      const next = current + (target - current) * INTRO_ALPHABET_PROGRESS_EASE;

      if (Math.abs(target - next) < 0.001) {
        introAlphabetProgressRef.current = target;
        setIntroAlphabetProgress(target);
        introAlphabetFrameRef.current = null;

        if (target === 0 && !introAlphabetManifestoVisibleRef.current) {
          const pointer = lastPointerRef.current;
          updateMouseVisualTarget(pointer.x, pointer.y);
        }
        return;
      }

      introAlphabetProgressRef.current = next;
      setIntroAlphabetProgress(next);
      introAlphabetFrameRef.current = window.requestAnimationFrame(tick);
    };

    introAlphabetFrameRef.current = window.requestAnimationFrame(tick);
  }, [updateMouseVisualTarget]);

  const setIntroAlphabetTargetProgress = useCallback((progress: number) => {
    introAlphabetTargetRef.current = Math.max(0, Math.min(1, progress));
    startIntroAlphabetProgressAnimation();
  }, [startIntroAlphabetProgressAnimation]);

  const startIntroNoclippingProgressAnimation = useCallback(() => {
    if (introNoclippingFrameRef.current !== null) return;

    const tick = () => {
      const current = introNoclippingProgressRef.current;
      const target = introNoclippingTargetRef.current;
      const next = current + (target - current) * INTRO_ALPHABET_PROGRESS_EASE;

      if (Math.abs(target - next) < 0.001) {
        introNoclippingProgressRef.current = target;
        setIntroNoclippingProgress(target);
        introNoclippingFrameRef.current = null;

        if (target === 0 && !introNoclippingManifestoVisibleRef.current) {
          const pointer = lastPointerRef.current;
          updateMouseVisualTarget(pointer.x, pointer.y);
        }
        return;
      }

      introNoclippingProgressRef.current = next;
      setIntroNoclippingProgress(next);
      introNoclippingFrameRef.current = window.requestAnimationFrame(tick);
    };

    introNoclippingFrameRef.current = window.requestAnimationFrame(tick);
  }, [updateMouseVisualTarget]);

  const setIntroNoclippingTargetProgress = useCallback((progress: number) => {
    introNoclippingTargetRef.current = Math.max(0, Math.min(1, progress));
    startIntroNoclippingProgressAnimation();
  }, [startIntroNoclippingProgressAnimation]);

  const startIntroExtraFocusProgressAnimation = useCallback(() => {
    if (introExtraFocusFrameRef.current !== null) return;

    const tick = () => {
      const current = introExtraFocusProgressRef.current;
      const target = introExtraFocusTargetRef.current;
      const next = current + (target - current) * INTRO_ALPHABET_PROGRESS_EASE;

      if (Math.abs(target - next) < 0.001) {
        introExtraFocusProgressRef.current = target;
        setIntroExtraFocusProgress(target);
        introExtraFocusFrameRef.current = null;

        if (target === 0 && !introExtraFocusManifestoVisibleRef.current) {
          const pointer = lastPointerRef.current;
          updateMouseVisualTarget(pointer.x, pointer.y);
        }
        return;
      }

      introExtraFocusProgressRef.current = next;
      setIntroExtraFocusProgress(next);
      introExtraFocusFrameRef.current = window.requestAnimationFrame(tick);
    };

    introExtraFocusFrameRef.current = window.requestAnimationFrame(tick);
  }, [updateMouseVisualTarget]);

  const setIntroExtraFocusTargetProgress = useCallback((progress: number) => {
    introExtraFocusTargetRef.current = Math.max(0, Math.min(1, progress));
    startIntroExtraFocusProgressAnimation();
  }, [startIntroExtraFocusProgressAnimation]);

  const stopDimensionCamera = useCallback(() => {
    if (dimensionFrameRef.current !== null) {
      window.cancelAnimationFrame(dimensionFrameRef.current);
      dimensionFrameRef.current = null;
    }
    if (dimensionMotionIntervalRef.current !== null) {
      window.clearInterval(dimensionMotionIntervalRef.current);
      dimensionMotionIntervalRef.current = null;
    }
    if (dimensionStreamRef.current) {
      dimensionStreamRef.current = null;
    }
    if (dimensionVideoRef.current) {
      dimensionVideoRef.current.pause();
      dimensionVideoRef.current.srcObject = null;
    }
    setDimensionCameraStarted(false);
  }, []);

  const closeActiveMirror = useCallback(() => {
    stopDimensionCamera();
    setActiveMirrorNodeKey(null);
    setActiveMirrorChapterType(null);
    setDimensionCameraError(null);
    setDimensionPhase('dot');
  }, [stopDimensionCamera]);

  const stopSharedCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (mirrorVideoRef.current) {
      mirrorVideoRef.current.pause();
      mirrorVideoRef.current.srcObject = null;
    }
    if (dimensionVideoRef.current) {
      dimensionVideoRef.current.pause();
      dimensionVideoRef.current.srcObject = null;
    }
    setCameraStarted(false);
    setDimensionCameraStarted(false);
  }, []);

  const applyCameraStream = useCallback((stream: MediaStream, device?: CameraDeviceOption | null) => {
    cameraStreamRef.current = stream;
    setCameraError(null);
    setCameraStarted(true);
    playCameraStateRef.current = 'ready';
    setPlayCameraState('ready');
    setCameraPanelMode(null);
    setCameraSwitchPrompt(null);

    if (device) {
      setSelectedCameraDeviceId(device.deviceId);
      setSelectedCameraLabel(device.label);
      saveCameraPreference(device);
    } else {
      const track = stream.getVideoTracks()[0];
      const label = track?.label || 'Default camera';
      const deviceId = track?.getSettings?.().deviceId ?? '';
      setSelectedCameraLabel(label);
      if (deviceId) {
        saveCameraPreference({ deviceId, label });
      }
    }
  }, []);

  const requestCameraStreamForDevice = useCallback(async (device?: CameraDeviceOption | null) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('mediaDevices.getUserMedia unavailable');
    }

    if (device?.deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: device.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { ideal: device.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          return navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
    }

    return navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  }, []);

  const showCameraDevicePanel = useCallback((devices: CameraDeviceOption[], preferred?: CameraDeviceOption | null) => {
    setCameraDevices(devices);
    const nextSelected = preferred ?? devices[0] ?? null;
    setSelectedCameraDeviceId(nextSelected?.deviceId ?? '');
    setSelectedCameraLabel(nextSelected?.label ?? '');
    playCameraStateRef.current = 'selecting-device';
    setPlayCameraState('selecting-device');
    setCameraPanelMode('device-select');
  }, []);

  const requestPlayCameraOnce = useCallback(async (options: { skipContinuityTip?: boolean; forceSelection?: boolean } = {}) => {
    if (cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().some((track) => track.readyState === 'live')) {
      playCameraStateRef.current = 'ready';
      setPlayCameraState('ready');
      setCameraStarted(true);
      return cameraStreamRef.current;
    }

    if (cameraRequestPromiseRef.current) {
      return cameraRequestPromiseRef.current;
    }

    if (!window.isSecureContext) {
      playCameraStateRef.current = 'error';
      setPlayCameraState('error');
      setCameraStarted(false);
      setCameraError('摄像头需要 HTTPS 或 localhost。\nCamera requires HTTPS or localhost.');
      return null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      playCameraStateRef.current = 'error';
      setPlayCameraState('error');
      setCameraStarted(false);
      setCameraError('摄像头未开启，无法识别挥手。\nCamera is not available.');
      return null;
    }

    if (!options.skipContinuityTip && isMacBrowser() && !cameraTipShownRef.current) {
      cameraTipShownRef.current = true;
      playCameraStateRef.current = 'prompting';
      setPlayCameraState('prompting');
      setCameraPanelMode('continuity-tip');
      return null;
    }

    playCameraStateRef.current = 'requesting';
    setPlayCameraState('requesting');
    cameraRequestPromiseRef.current = (async () => {
      const temporaryStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const devices = await listVideoInputDevices();
      const preferred = devices.length ? getPreferredCameraDevice(devices) : null;
      setCameraDevices(devices);

      if (devices.length > 1 || options.forceSelection) {
        if (preferred) {
          setSelectedCameraDeviceId(preferred.deviceId);
          setSelectedCameraLabel(preferred.label);
        } else {
          const stored = readStoredCameraPreference();
          setSelectedCameraDeviceId(stored.deviceId || devices[0]?.deviceId || '');
          setSelectedCameraLabel(stored.label || devices[0]?.label || '');
        }
        temporaryStream.getTracks().forEach((track) => track.stop());
        showCameraDevicePanel(devices, preferred);
        return null;
      }

      if (preferred) {
        temporaryStream.getTracks().forEach((track) => track.stop());
        const stream = await requestCameraStreamForDevice(preferred);
        applyCameraStream(stream, preferred);
        return stream;
      }

      applyCameraStream(temporaryStream, devices[0] ?? null);
      return temporaryStream;
    })()
      .catch((error) => {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError';
        setCameraStarted(false);
        playCameraStateRef.current = denied ? 'denied' : 'error';
        setPlayCameraState(denied ? 'denied' : 'error');
        setCameraPanelMode(null);
        setCameraError(denied ? '摄像头权限被拒绝' : '无法开启摄像头');
        return null;
      })
      .finally(() => {
        cameraRequestPromiseRef.current = null;
      });

    return cameraRequestPromiseRef.current;
  }, [applyCameraStream, requestCameraStreamForDevice, showCameraDevicePanel]);

  const chooseCameraDevice = useCallback(async (deviceId: string) => {
    const device = cameraDevicesRef.current.find((item) => item.deviceId === deviceId) ?? cameraDevicesRef.current[0] ?? null;
    if (!device) {
      setCameraError('没有找到可用摄像头。\nCamera is not available.');
      return;
    }

    playCameraStateRef.current = 'requesting';
    setPlayCameraState('requesting');
    setCameraError(null);
    stopSharedCameraStream();

    try {
      const stream = await requestCameraStreamForDevice(device);
      applyCameraStream(stream, device);
    } catch {
      playCameraStateRef.current = 'error';
      setPlayCameraState('error');
      setCameraError('无法开启所选摄像头，已尝试回退默认摄像头。\nCamera is not available.');
    }
  }, [applyCameraStream, requestCameraStreamForDevice, stopSharedCameraStream]);

  const useDefaultCamera = useCallback(async () => {
    playCameraStateRef.current = 'requesting';
    setPlayCameraState('requesting');
    setCameraError(null);
    stopSharedCameraStream();

    try {
      const stream = await requestCameraStreamForDevice(null);
      applyCameraStream(stream, null);
    } catch {
      playCameraStateRef.current = 'error';
      setPlayCameraState('error');
      setCameraError('无法开启默认摄像头。\nCamera is not available.');
    }
  }, [applyCameraStream, requestCameraStreamForDevice, stopSharedCameraStream]);

  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setCameraError('无法读取摄像头列表。\nCamera is not available.');
      return null;
    }

    try {
      const devices = await listVideoInputDevices();
      if (!devices.length) {
        setCameraError('没有找到可用摄像头。\nCamera is not available.');
        setCameraDeviceStatus('没有找到可用摄像头。');
        return null;
      }
      const preferred = getPreferredCameraDevice(devices);
      setCameraDevices(devices);
      if (preferred) {
        setSelectedCameraDeviceId(preferred.deviceId);
        setSelectedCameraLabel(preferred.label);
        setCameraDeviceStatus(`已检测到推荐摄像头：${preferred.label}`);
      } else {
        const currentStillExists = devices.some((device) => device.deviceId === selectedCameraDeviceIdRef.current);
        const fallback = currentStillExists
          ? devices.find((device) => device.deviceId === selectedCameraDeviceIdRef.current)
          : devices[0];
        setSelectedCameraDeviceId(fallback?.deviceId ?? '');
        setSelectedCameraLabel(fallback?.label ?? '');
        setCameraDeviceStatus('未检测到 iPhone / Continuity Camera。请确认 iPhone 靠近 Mac、Wi-Fi 和蓝牙已开启，然后点刷新。');
      }
      return { devices, preferred };
    } catch {
      setCameraError('无法读取摄像头列表。\nCamera is not available.');
      setCameraDeviceStatus('无法读取摄像头列表。');
      return null;
    }
  }, []);

  const openCameraSelectionPanel = useCallback(async () => {
    const result = await refreshCameraDevices();
    if (!result) return;
    showCameraDevicePanel(result.devices, result.preferred);
  }, [refreshCameraDevices, showCameraDevicePanel]);

  useEffect(() => {
    if (cameraPanelMode !== 'device-select') return undefined;

    let attempts = 0;
    let stopped = false;
    const timer = window.setInterval(() => {
      attempts += 1;
      void refreshCameraDevices().then((result) => {
        if (stopped || !result?.preferred) return;
        if (attempts >= 2) {
          setCameraDeviceStatus(`已检测到推荐摄像头：${result.preferred.label}`);
        }
      });
      if (attempts >= 12) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [cameraPanelMode, refreshCameraDevices]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return undefined;

    const handleDeviceChange = async () => {
      const result = await refreshCameraDevices();
      if (!result?.preferred) return;
      if (cameraPanelMode === 'device-select') {
        setCameraDeviceStatus(`已检测到推荐摄像头：${result.preferred.label}`);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [cameraPanelMode, refreshCameraDevices]);

  const changeCamera = useCallback(async () => {
    stopSharedCameraStream();
    await openCameraSelectionPanel();
  }, [openCameraSelectionPanel, stopSharedCameraStream]);

  const saveNoiseAudioTime = useCallback(() => {
    const audio = noiseAudioRef.current;
    if (!audio) return;

    const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    noiseAudioTimeRef.current = nextTime;
    window.localStorage.setItem(NOISE_AUDIO_TIME_KEY, String(nextTime));
  }, []);

  const stopNoiseAudio = useCallback(() => {
    const audio = noiseAudioRef.current;
    if (audio) {
      saveNoiseAudioTime();
      audio.pause();
    }
    setActiveAudioChapter(null);
  }, [saveNoiseAudioTime]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIntroSequencePlayed(true), INTRO_SEQUENCE_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('adPreview') !== '1') return;
    setNoclippingAdPreviewRequested(true);
    setActiveExperience('noclipping');
  }, []);

  useEffect(() => {
    const audio = new Audio(NOISE_AUDIO_SRC);
    audio.preload = 'auto';
    const savedTime = Number(window.localStorage.getItem(NOISE_AUDIO_TIME_KEY));
    noiseAudioTimeRef.current = Number.isFinite(savedTime) && savedTime >= 0 ? savedTime : 0;

    const onEnded = () => {
      audio.currentTime = 0;
      noiseAudioTimeRef.current = 0;
      window.localStorage.setItem(NOISE_AUDIO_TIME_KEY, '0');
      audio.play().catch(() => {});
    };

    audio.addEventListener('ended', onEnded);
    noiseAudioRef.current = audio;

    return () => {
      audio.removeEventListener('ended', onEnded);
      const finalTime = Number.isFinite(audio.currentTime) ? audio.currentTime : noiseAudioTimeRef.current;
      window.localStorage.setItem(NOISE_AUDIO_TIME_KEY, String(finalTime));
      audio.pause();
      noiseAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSettings(readStoredSettings(window.localStorage.getItem(SETTINGS_STORAGE_KEY)));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  // Typography engine — default -> localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredTypographyPreset(window.localStorage.getItem(TYPOGRAPHY_STORAGE_KEY));
    setTypographyPreset(stored.preset);
    setTypographyDirty(false);
    setTypographyStatus(stored.message);
  }, []);

  // Typography engine — inject runtime CSS into <head> whenever preview state changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let el = document.getElementById(TYPOGRAPHY_RUNTIME_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = TYPOGRAPHY_RUNTIME_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = generateTypographyCSS(typographyPreset);
  }, [typographyPreset]);

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const previousViewport = viewportRef.current;
      const previousDisplayScale = displayScaleRef.current;
      const previousOffset = offsetRef.current;
      const previousFocus = getCameraFocusPoint(previousViewport);
      const focusedWorld = {
        x: (previousFocus.x - previousOffset.x) / previousDisplayScale,
        y: (previousFocus.y - previousOffset.y) / previousDisplayScale,
      };
      const nextViewport = { width, height };
      const nextDisplayScale = scaleRef.current * getViewportFitScale(nextViewport);
      const nextFocus = getCameraFocusPoint(nextViewport);
      const nextOffset = {
        x: nextFocus.x - focusedWorld.x * nextDisplayScale,
        y: nextFocus.y - focusedWorld.y * nextDisplayScale,
      };

      viewportRef.current = nextViewport;
      displayScaleRef.current = nextDisplayScale;
      offsetRef.current = nextOffset;
      setViewport({ width, height });
      setOffset(nextOffset);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const displayScale = useMemo(() => scale * getViewportFitScale(viewport), [scale, viewport]);

  useEffect(() => {
    displayScaleRef.current = displayScale;
  }, [displayScale]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    if (appMode === 'play') return;
    setPlayPaused(false);
    setPauseDiceRolling(false);
    pauseDiceRollingRef.current = false;
  }, [appMode]);

  useEffect(() => {
    const canShowIdleClock = () => (
      appMode === 'play' &&
      !playPaused &&
      !activeExperience &&
      !activeMirrorNodeKey &&
      !chaosActive &&
      chapterPortalPhase === 'idle'
    );

    const clearIdleClockTimer = () => {
      if (playIdleClockTimeoutRef.current !== null) {
        window.clearTimeout(playIdleClockTimeoutRef.current);
        playIdleClockTimeoutRef.current = null;
      }
    };

    const scheduleIdleClock = () => {
      clearIdleClockTimer();
      if (!canShowIdleClock()) {
        setPlayIdleClockVisible(false);
        return;
      }
      playIdleClockTimeoutRef.current = window.setTimeout(() => {
        if (!canShowIdleClock()) return;
        setPlayIdleClockTime(new Date());
        setPlayIdleClockVisible(true);
      }, PLAY_IDLE_CLOCK_DELAY_MS);
    };

    const handleActivity = () => {
      setPlayIdleClockVisible(false);
      scheduleIdleClock();
    };

    scheduleIdleClock();
    window.addEventListener('pointermove', handleActivity, { passive: true });
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity, { passive: true });

    return () => {
      clearIdleClockTimer();
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [activeExperience, activeMirrorNodeKey, appMode, chaosActive, chapterPortalPhase, playPaused]);

  useEffect(() => {
    if (!playIdleClockVisible) return undefined;
    const timer = window.setInterval(() => {
      setPlayIdleClockTime(new Date());
    }, 250);
    return () => window.clearInterval(timer);
  }, [playIdleClockVisible]);

  useEffect(() => {
    const resetTimeout = window.setTimeout(() => setHudDockSettled(false), 0);
    if (appMode !== 'play') {
      return () => window.clearTimeout(resetTimeout);
    }

    const settleTimeout = window.setTimeout(() => setHudDockSettled(true), 3400);
    return () => {
      window.clearTimeout(resetTimeout);
      window.clearTimeout(settleTimeout);
    };
  }, [appMode]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    currentKeyRef.current = currentKey;
  }, [currentKey]);

  useEffect(() => {
    currentFaceIndexRef.current = currentFaceIndex;
  }, [currentFaceIndex]);

  useEffect(() => {
    currentFaceRotationRef.current = currentFaceRotation;
  }, [currentFaceRotation]);

  useEffect(() => {
    playCameraStateRef.current = playCameraState;
  }, [playCameraState]);

  useEffect(() => {
    cameraDevicesRef.current = cameraDevices;
  }, [cameraDevices]);

  useEffect(() => {
    selectedCameraDeviceIdRef.current = selectedCameraDeviceId;
  }, [selectedCameraDeviceId]);

  useEffect(() => {
    currentChapterTypeRef.current = currentChapterType;
  }, [currentChapterType]);

  useEffect(() => {
    playNodesRef.current = playNodes;
  }, [playNodes]);

  useEffect(() => {
    currentPlayNodeIdRef.current = currentPlayNodeId;
  }, [currentPlayNodeId]);

  useEffect(() => {
    nodeCoordsRef.current = nodeCoords;
  }, [nodeCoords]);

  useEffect(() => {
    activeSnappedNodeKeyRef.current = activeSnappedNodeKey;
  }, [activeSnappedNodeKey]);

  useEffect(() => {
    introAlphabetManifestoVisibleRef.current = introAlphabetManifestoVisible;
  }, [introAlphabetManifestoVisible]);

  useEffect(() => {
    introNoclippingManifestoVisibleRef.current = introNoclippingManifestoVisible;
  }, [introNoclippingManifestoVisible]);

  useEffect(() => {
    introExtraFocusChapterRef.current = introExtraFocusChapter;
  }, [introExtraFocusChapter]);

  useEffect(() => {
    introExtraFocusManifestoVisibleRef.current = introExtraFocusManifestoVisible;
  }, [introExtraFocusManifestoVisible]);

  useEffect(() => {
    return () => {
      if (cameraFrameRef.current !== null) {
        window.cancelAnimationFrame(cameraFrameRef.current);
      }
      if (motionFrameRef.current !== null) {
        window.cancelAnimationFrame(motionFrameRef.current);
      }
      if (visualFrameRef.current !== null) {
        window.cancelAnimationFrame(visualFrameRef.current);
        visualFrameRef.current = null;
      }
      if (customCursorFrameRef.current !== null) {
        window.cancelAnimationFrame(customCursorFrameRef.current);
        customCursorFrameRef.current = null;
      }
      if (introAlphabetFrameRef.current !== null) {
        window.cancelAnimationFrame(introAlphabetFrameRef.current);
        introAlphabetFrameRef.current = null;
      }
      if (introAlphabetDwellTimeoutRef.current !== null) {
        window.clearTimeout(introAlphabetDwellTimeoutRef.current);
        introAlphabetDwellTimeoutRef.current = null;
      }
      if (introAlphabetExitTimeoutRef.current !== null) {
        window.clearTimeout(introAlphabetExitTimeoutRef.current);
        introAlphabetExitTimeoutRef.current = null;
      }
      if (introNoclippingFrameRef.current !== null) {
        window.cancelAnimationFrame(introNoclippingFrameRef.current);
        introNoclippingFrameRef.current = null;
      }
      if (introNoclippingDwellTimeoutRef.current !== null) {
        window.clearTimeout(introNoclippingDwellTimeoutRef.current);
        introNoclippingDwellTimeoutRef.current = null;
      }
      if (introNoclippingExitTimeoutRef.current !== null) {
        window.clearTimeout(introNoclippingExitTimeoutRef.current);
        introNoclippingExitTimeoutRef.current = null;
      }
      if (introExtraFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(introExtraFocusFrameRef.current);
        introExtraFocusFrameRef.current = null;
      }
      if (introExtraFocusDwellTimeoutRef.current !== null) {
        window.clearTimeout(introExtraFocusDwellTimeoutRef.current);
        introExtraFocusDwellTimeoutRef.current = null;
      }
      if (introExtraFocusExitTimeoutRef.current !== null) {
        window.clearTimeout(introExtraFocusExitTimeoutRef.current);
        introExtraFocusExitTimeoutRef.current = null;
      }
      if (playBlockedPromptTimeoutRef.current !== null) {
        window.clearTimeout(playBlockedPromptTimeoutRef.current);
        playBlockedPromptTimeoutRef.current = null;
      }
      if (gateRevealTimeoutRef.current !== null) {
        window.clearTimeout(gateRevealTimeoutRef.current);
        gateRevealTimeoutRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (dimensionFrameRef.current !== null) {
        window.cancelAnimationFrame(dimensionFrameRef.current);
        dimensionFrameRef.current = null;
      }
      if (dimensionMotionIntervalRef.current !== null) {
        window.clearInterval(dimensionMotionIntervalRef.current);
        dimensionMotionIntervalRef.current = null;
      }
      if (dimensionStreamRef.current) {
        dimensionStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!settings.parallaxEnabled || settings.parallaxRange <= 0) {
      setMouseVisualTarget({ x: 0, y: 0 });
    }
  }, [settings.parallaxEnabled, settings.parallaxRange, setMouseVisualTarget]);

  useEffect(() => {
    const pointer = lastPointerRef.current;
    updateCustomCursorTarget(pointer.x, pointer.y);
  }, [
    displayScale,
    settings.cursorEase,
    settings.cursorMaxSize,
    settings.cursorMinSize,
    settings.cursorSizeScale,
    updateCustomCursorTarget,
  ]);

  useEffect(() => {
    if (appMode !== 'play' || !settings.hideSystemCursor) return undefined;

    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      setCustomCursorInDevPanel(
        target instanceof Element &&
          Boolean(target.closest('[data-dev-panel="true"]')),
      );
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      updateCustomCursorTarget(event.clientX, event.clientY);
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [appMode, settings.hideSystemCursor, updateCustomCursorTarget]);

  useEffect(() => {
    if (!cameraStarted || !cameraStreamRef.current || !mirrorVideoRef.current) return;
    const video = mirrorVideoRef.current;
    if (video.srcObject !== cameraStreamRef.current) {
      video.srcObject = cameraStreamRef.current;
    }
    video.play().catch(() => {});
  }, [cameraStarted]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return undefined;

    const handleDeviceChange = async () => {
      try {
        const devices = await listVideoInputDevices();
        setCameraDevices(devices);
        const preferred = getPreferredCameraDevice(devices);
        const currentLabel = selectedCameraLabel || cameraStreamRef.current?.getVideoTracks()[0]?.label || '';
        if (
          preferred &&
          !cameraLooksLikeIPhone(currentLabel) &&
          playCameraStateRef.current === 'ready'
        ) {
          setCameraSwitchPrompt('检测到 iPhone 摄像头，可切换。\niPhone camera detected. Switch?');
        }
      } catch {
        // Device labels are best-effort; ignore transient enumeration failures.
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [selectedCameraLabel]);

  useEffect(() => {
    if (
      activeMirrorChapterType !== 'dimension' ||
      (dimensionPhase !== 'mirror-waiting' && dimensionPhase !== 'mosaic') ||
      playCameraState !== 'ready' ||
      !cameraStreamRef.current ||
      !dimensionVideoRef.current
    ) return;

    const video = dimensionVideoRef.current;
    if (video.srcObject !== cameraStreamRef.current) {
      video.srcObject = cameraStreamRef.current;
    }
    video.play().catch(() => {});
  }, [activeMirrorChapterType, dimensionPhase, playCameraState]);

  useEffect(() => {
    if (
      activeMirrorChapterType === 'dimension' &&
      dimensionPhase === 'mirror-waiting' &&
      (playCameraState === 'denied' || playCameraState === 'error')
    ) {
      setDimensionPhase('camera-unavailable');
      setDimensionCameraStarted(false);
      setDimensionCameraError('摄像头未开启，无法识别挥手。\nCamera is not available.');
    }
  }, [activeMirrorChapterType, dimensionPhase, playCameraState]);

  useEffect(() => {
    if (
      activeMirrorChapterType !== 'dimension' ||
      dimensionPhase !== 'mirror-waiting' ||
      playCameraState !== 'ready'
    ) return undefined;

    const video = dimensionVideoRef.current;
    if (!video) return undefined;

    const analysisCanvas = document.createElement('canvas');
    analysisCanvas.width = DIMENSION_WAVE_ANALYSIS_WIDTH;
    analysisCanvas.height = DIMENSION_WAVE_ANALYSIS_HEIGHT;
    const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
    if (!analysisCtx) return undefined;

    let previousFrame: Uint8ClampedArray | null = null;
    let hitCount = 0;

    dimensionMotionIntervalRef.current = window.setInterval(() => {
      if (!video.videoWidth || !video.videoHeight) return;

      analysisCtx.clearRect(0, 0, DIMENSION_WAVE_ANALYSIS_WIDTH, DIMENSION_WAVE_ANALYSIS_HEIGHT);
      drawMirroredCoverFromVideo(
        analysisCtx,
        video,
        DIMENSION_WAVE_ANALYSIS_WIDTH,
        DIMENSION_WAVE_ANALYSIS_HEIGHT,
      );

      const frame = analysisCtx.getImageData(
        0,
        0,
        DIMENSION_WAVE_ANALYSIS_WIDTH,
        DIMENSION_WAVE_ANALYSIS_HEIGHT,
      ).data;

      let motionSum = 0;
      if (previousFrame) {
        for (let index = 0; index < frame.length; index += 4) {
          motionSum += Math.abs(frame[index] - previousFrame[index])
            + Math.abs(frame[index + 1] - previousFrame[index + 1])
            + Math.abs(frame[index + 2] - previousFrame[index + 2]);
        }
      }

      const pixelCount = DIMENSION_WAVE_ANALYSIS_WIDTH * DIMENSION_WAVE_ANALYSIS_HEIGHT;
      const motionEnergy = previousFrame ? motionSum / (pixelCount * 3) : 0;
      previousFrame = new Uint8ClampedArray(frame);

      if (motionEnergy > DIMENSION_WAVE_MOTION_THRESHOLD) {
        hitCount += 1;
      } else {
        hitCount = Math.max(0, hitCount - 1);
      }

      if (hitCount >= DIMENSION_WAVE_REQUIRED_HITS) {
        if (dimensionMotionIntervalRef.current !== null) {
          window.clearInterval(dimensionMotionIntervalRef.current);
          dimensionMotionIntervalRef.current = null;
        }
        setDimensionCameraError(null);
        setDimensionCameraStarted(true);
        setDimensionPhase('mosaic');
      }
    }, DIMENSION_WAVE_SAMPLE_INTERVAL_MS);

    return () => {
      if (dimensionMotionIntervalRef.current !== null) {
        window.clearInterval(dimensionMotionIntervalRef.current);
        dimensionMotionIntervalRef.current = null;
      }
    };
  }, [activeMirrorChapterType, dimensionPhase, playCameraState]);

  useEffect(() => {
    if (activeMirrorChapterType !== 'dimension' || dimensionPhase !== 'mosaic' || !dimensionCameraStarted) return;
    const video = dimensionVideoRef.current;
    const canvas = dimensionCanvasRef.current;
    if (!video || !canvas) return;

    const displayW = 520;
    const displayH = Math.round(displayW / (806 / 1125));
    canvas.width = displayW;
    canvas.height = displayH;
    const displayCtx = canvas.getContext('2d');
    if (!displayCtx) return;

    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return;
    const sourceCanvas = document.createElement('canvas');
    const sourceCtx = sourceCanvas.getContext('2d');
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    if (!sourceCtx || !cropCtx) return;

    const minGridX = 1;
    const maxGridX = 128;
    const signalW = 64;
    const signalH = Math.max(1, Math.round(signalW / 0.716));
    const analysisInterval = 33;
    let previousSignalImg: Uint8ClampedArray | null = null;
    let clarity = 0;
    let stableSince: number | null = null;
    let lastAnalysisTime = 0;
    let gridX = minGridX;
    let gridY = Math.max(1, Math.round(gridX / 0.716));
    let latestDetailBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    let lastExtractAt = 0;
    let lastExtractSignature = '';
    let clearUntil = 0;

    const extractStableObject = (
      bounds: { minX: number; minY: number; maxX: number; maxY: number },
      signature: string,
      now: number,
    ) => {
      if (now - lastExtractAt < DIMENSION_OBJECT_EXTRACT_COOLDOWN_MS) return false;
      sourceCanvas.width = displayW;
      sourceCanvas.height = displayH;
      sourceCtx.clearRect(0, 0, displayW, displayH);
      drawMirroredCoverFromVideo(sourceCtx, video, displayW, displayH);

      const padX = displayW * 0.08;
      const padY = displayH * 0.08;
      const scaleX = displayW / signalW;
      const scaleY = displayH / signalH;
      const rawX = bounds.minX * scaleX - padX;
      const rawY = bounds.minY * scaleY - padY;
      const rawW = (bounds.maxX - bounds.minX + 1) * scaleX + padX * 2;
      const rawH = (bounds.maxY - bounds.minY + 1) * scaleY + padY * 2;
      const sx = clampBetween(rawX, 0, displayW - 1);
      const sy = clampBetween(rawY, 0, displayH - 1);
      const sw = clampBetween(rawW, 96, displayW - sx);
      const sh = clampBetween(rawH, 96, displayH - sy);
      const cropW = 520;
      const cropH = Math.max(90, Math.round(cropW * (sh / sw)));
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      cropCtx.clearRect(0, 0, cropW, cropH);
      cropCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, cropW, cropH);
      const cropImage = cropCtx.getImageData(0, 0, cropW, cropH);
      const data = cropImage.data;
      const cornerSize = Math.max(10, Math.round(Math.min(cropW, cropH) * 0.1));
      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      let bgCount = 0;
      for (let y = 0; y < cropH; y += 1) {
        for (let x = 0; x < cropW; x += 1) {
          const inCorner = (x < cornerSize || x >= cropW - cornerSize) && (y < cornerSize || y >= cropH - cornerSize);
          if (!inCorner) continue;
          const index = (y * cropW + x) * 4;
          bgR += data[index];
          bgG += data[index + 1];
          bgB += data[index + 2];
          bgCount += 1;
        }
      }
      bgR /= Math.max(1, bgCount);
      bgG /= Math.max(1, bgCount);
      bgB /= Math.max(1, bgCount);
      const backgroundMask = new Uint8Array(cropW * cropH);
      const queue = new Int32Array(cropW * cropH);
      let queueStart = 0;
      let queueEnd = 0;
      const enqueue = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= cropW || y >= cropH) return;
        const pixelIndex = y * cropW + x;
        if (backgroundMask[pixelIndex]) return;
        const index = pixelIndex * 4;
        const colorDistance = Math.hypot(data[index] - bgR, data[index + 1] - bgG, data[index + 2] - bgB);
        const luma = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
        const leftIndex = (y * cropW + Math.max(0, x - 1)) * 4;
        const topIndex = (Math.max(0, y - 1) * cropW + x) * 4;
        const leftLuma = data[leftIndex] * 0.299 + data[leftIndex + 1] * 0.587 + data[leftIndex + 2] * 0.114;
        const topLuma = data[topIndex] * 0.299 + data[topIndex + 1] * 0.587 + data[topIndex + 2] * 0.114;
        const localEdge = Math.max(Math.abs(luma - leftLuma), Math.abs(luma - topLuma));
        if (colorDistance > 38 || localEdge > 18) return;
        backgroundMask[pixelIndex] = 1;
        queue[queueEnd] = pixelIndex;
        queueEnd += 1;
      };
      for (let x = 0; x < cropW; x += 1) {
        enqueue(x, 0);
        enqueue(x, cropH - 1);
      }
      for (let y = 0; y < cropH; y += 1) {
        enqueue(0, y);
        enqueue(cropW - 1, y);
      }
      while (queueStart < queueEnd) {
        const pixelIndex = queue[queueStart];
        queueStart += 1;
        const x = pixelIndex % cropW;
        const y = Math.floor(pixelIndex / cropW);
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
      }

      let opaquePixelCount = 0;
      for (let y = 0; y < cropH; y += 1) {
        for (let x = 0; x < cropW; x += 1) {
          const pixelIndex = y * cropW + x;
          const index = (y * cropW + x) * 4;
          let neighborBackground = 0;
          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              const nx = x + ox;
              const ny = y + oy;
              if (nx < 0 || ny < 0 || nx >= cropW || ny >= cropH) {
                neighborBackground += 1;
              } else if (backgroundMask[ny * cropW + nx]) {
                neighborBackground += 1;
              }
            }
          }
          const distance = Math.hypot(data[index] - bgR, data[index + 1] - bgG, data[index + 2] - bgB);
          const colorKeep = Math.max(0, Math.min(1, (distance - 18) / 72));
          const maskKeep = backgroundMask[pixelIndex] ? 0 : 1;
          const feather = Math.max(0, Math.min(1, 1 - neighborBackground / 9));
          const alpha = Math.round(255 * Math.max(maskKeep * feather, colorKeep * 0.72));
          data[index + 3] = alpha;
          if (alpha > 24) opaquePixelCount += 1;
        }
      }
      if (opaquePixelCount < cropW * cropH * 0.08) {
        for (let y = 0; y < cropH; y += 1) {
          for (let x = 0; x < cropW; x += 1) {
            const index = (y * cropW + x) * 4;
            const edgeFade = Math.min(x, y, cropW - x - 1, cropH - y - 1) / Math.max(1, cornerSize);
            data[index + 3] = Math.round(255 * Math.max(0, Math.min(1, edgeFade)));
          }
        }
      }
      cropCtx.putImageData(cropImage, 0, 0);

      const src = cropCanvas.toDataURL('image/png');
      const serial = dimensionExtractSerialRef.current;
      dimensionExtractSerialRef.current += 1;
      const viewportWidth = viewportRef.current.width;
      const viewportHeight = viewportRef.current.height;
      const currentOffset = offsetRef.current;
      const currentScale = displayScaleRef.current || 1;
      const screenWidth = Math.min(760, Math.max(430, Math.min(viewportWidth, viewportHeight) * (0.42 + (serial % 4) * 0.035)));
      const screenHeight = screenWidth * (cropH / cropW);
      const columns = Math.max(2, Math.floor(viewportWidth / Math.max(280, screenWidth * 0.58)));
      const rows = Math.max(2, Math.floor(viewportHeight / Math.max(240, screenHeight * 0.62)));
      const col = serial % columns;
      const row = Math.floor(serial / columns) % rows;
      const targetScreenX = clampBetween(
        24 + col * Math.max(180, (viewportWidth - screenWidth - 48) / Math.max(1, columns - 1)) + ((serial * 37) % 44) - 22,
        8,
        Math.max(8, viewportWidth - screenWidth - 8),
      );
      const targetScreenY = clampBetween(
        82 + row * Math.max(170, (viewportHeight - screenHeight - 140) / Math.max(1, rows - 1)) + ((serial * 29) % 38) - 19,
        8,
        Math.max(8, viewportHeight - screenHeight - 8),
      );
      lastExtractAt = now;
      lastExtractSignature = signature;
      setDimensionExtractedObjects((objects) => [
        ...objects.slice(-DIMENSION_MAX_EXTRACTED_OBJECTS + 1),
        {
          id: `dimension-object-${serial}`,
          src,
          x: (targetScreenX - currentOffset.x) / currentScale,
          y: (targetScreenY - currentOffset.y) / currentScale,
          width: screenWidth / currentScale,
          height: screenHeight / currentScale,
          rotation: ((serial * 17) % 13) - 6,
          vx: ((serial % 2 === 0 ? 1 : -1) * (28 + (serial % 5) * 9)),
          vy: ((serial % 3 === 0 ? -1 : 1) * (22 + (serial % 4) * 7)),
        },
      ]);
      return true;
    };

    const draw = (now: number) => {
      if (!video.videoWidth || !video.videoHeight) {
        dimensionFrameRef.current = window.requestAnimationFrame(draw);
        return;
      }

      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const vRatio = vW / vH;

      if (now - lastAnalysisTime >= analysisInterval) {
        lastAnalysisTime = now;
        sampleCanvas.width = signalW;
        sampleCanvas.height = signalH;
        sampleCtx.clearRect(0, 0, signalW, signalH);
        drawMirroredCoverFromVideo(sampleCtx, video, signalW, signalH);
        const signalImg = sampleCtx.getImageData(0, 0, signalW, signalH).data;
        let motionSum = 0;
        let detailSum = 0;
        let detailHits = 0;
        let detailMinX = signalW;
        let detailMinY = signalH;
        let detailMaxX = 0;
        let detailMaxY = 0;
        let averageR = 0;
        let averageG = 0;
        let averageB = 0;
        if (previousSignalImg) {
          for (let i = 0; i < signalImg.length; i += 4) {
            motionSum += Math.abs(signalImg[i] - previousSignalImg[i])
              + Math.abs(signalImg[i + 1] - previousSignalImg[i + 1])
              + Math.abs(signalImg[i + 2] - previousSignalImg[i + 2]);
          }
        }
        for (let y = 0; y < signalH; y += 1) {
          for (let x = 0; x < signalW; x += 1) {
            const index = (y * signalW + x) * 4;
            averageR += signalImg[index];
            averageG += signalImg[index + 1];
            averageB += signalImg[index + 2];
            const luma = signalImg[index] * 0.299 + signalImg[index + 1] * 0.587 + signalImg[index + 2] * 0.114;
            let edge = 0;
            if (x > 0) {
              const previousIndex = index - 4;
              const previousLuma = signalImg[previousIndex] * 0.299 + signalImg[previousIndex + 1] * 0.587 + signalImg[previousIndex + 2] * 0.114;
              edge = Math.max(edge, Math.abs(luma - previousLuma));
            }
            if (y > 0) {
              const upperIndex = ((y - 1) * signalW + x) * 4;
              const upperLuma = signalImg[upperIndex] * 0.299 + signalImg[upperIndex + 1] * 0.587 + signalImg[upperIndex + 2] * 0.114;
              edge = Math.max(edge, Math.abs(luma - upperLuma));
            }
            detailSum += edge;
            if (edge > 18) {
              detailHits += 1;
              detailMinX = Math.min(detailMinX, x);
              detailMinY = Math.min(detailMinY, y);
              detailMaxX = Math.max(detailMaxX, x);
              detailMaxY = Math.max(detailMaxY, y);
            }
          }
        }
        const signalPx = signalW * signalH;
        const motion = previousSignalImg ? motionSum / (signalPx * 3) : 0;
        const detail = detailSum / signalPx;
        const hasObjectLikeDetail = detail > DIMENSION_OBJECT_DETAIL_THRESHOLD;
        const isStable = motion < DIMENSION_OBJECT_STABLE_MOTION_THRESHOLD;
        const signature = [
          Math.round((averageR / signalPx) / 18),
          Math.round((averageG / signalPx) / 18),
          Math.round((averageB / signalPx) / 18),
          Math.round(detail / 4),
          Math.round(detailHits / 8),
        ].join('-');

        if (motion > DIMENSION_OBJECT_MOTION_RESET_THRESHOLD) {
          stableSince = null;
          clarity += (0 - clarity) * 0.5;
        } else if (isStable) {
          stableSince ??= now;
          const heldMs = now - stableSince;
          clarity += (0 - clarity) * 0.3;
          latestDetailBounds = detailHits > 5 && hasObjectLikeDetail
            ? { minX: detailMinX, minY: detailMinY, maxX: detailMaxX, maxY: detailMaxY }
            : null;
          if (latestDetailBounds && heldMs >= DIMENSION_OBJECT_STABLE_MS) {
            const boundsW = latestDetailBounds.maxX - latestDetailBounds.minX + 1;
            const boundsH = latestDetailBounds.maxY - latestDetailBounds.minY + 1;
            const boundsArea = (boundsW * boundsH) / signalPx;
            const looksLikeSingleObject = boundsArea > 0.035 && boundsArea < 0.82;
            if (looksLikeSingleObject && extractStableObject(latestDetailBounds, signature, now)) {
              clearUntil = now + 560;
              clarity = 1;
              stableSince = null;
            }
          }
        } else {
          stableSince = null;
          clarity += (0 - clarity) * 0.42;
          latestDetailBounds = null;
        }

        previousSignalImg = new Uint8ClampedArray(signalImg);
        const motionDetail = (() => {
          if (motion < 7) return 0;
          if (motion < 12) return 1 / maxGridX;
          if (motion < 18) return 2 / maxGridX;
          const normalized = clampBetween((motion - 18) / 52, 0, 1);
          return Math.pow(normalized, 2.85);
        })();
        const targetGridX = motion < 7
          ? 1
          : motion < 12
            ? 2
            : motion < 18
              ? 3
              : Math.round(4 + motionDetail * (maxGridX - 4));
        if (targetGridX <= 3) {
          gridX = targetGridX;
        } else {
          const easing = targetGridX > gridX ? 0.18 : 0.12;
          gridX = Math.max(minGridX, Math.min(maxGridX, Math.round(gridX + (targetGridX - gridX) * easing)));
        }
        gridY = Math.max(1, Math.round(gridX / 0.716));
      }

      displayCtx.clearRect(0, 0, displayW, displayH);
      const revealStartedAt = dimensionMosaicRevealStartRef.current;
      let revealProgress = 0;
      if (revealStartedAt !== null) {
        const revealElapsed = now - revealStartedAt;
        if (revealElapsed < DIMENSION_REVEAL_RAMP_IN_MS) {
          const t = clampBetween(revealElapsed / DIMENSION_REVEAL_RAMP_IN_MS, 0, 1);
          revealProgress = t * t * (3 - 2 * t);
        } else if (revealElapsed < DIMENSION_REVEAL_RAMP_IN_MS + DIMENSION_REVEAL_HOLD_MS) {
          revealProgress = 1;
        } else if (
          revealElapsed <
          DIMENSION_REVEAL_RAMP_IN_MS + DIMENSION_REVEAL_HOLD_MS + DIMENSION_REVEAL_RAMP_OUT_MS
        ) {
          const t = clampBetween(
            (revealElapsed - DIMENSION_REVEAL_RAMP_IN_MS - DIMENSION_REVEAL_HOLD_MS) / DIMENSION_REVEAL_RAMP_OUT_MS,
            0,
            1,
          );
          revealProgress = 1 - t * t * (3 - 2 * t);
        } else {
          dimensionMosaicRevealStartRef.current = null;
        }
      }

      if (now < clearUntil || revealProgress >= 0.995) {
        displayCtx.imageSmoothingEnabled = true;
        drawMirroredCoverFromVideo(displayCtx, video, displayW, displayH);
        dimensionFrameRef.current = window.requestAnimationFrame(draw);
        return;
      } else if (clarity > 0) {
        clarity = 0;
      }

      const effectiveGridX = revealProgress > 0
        ? Math.max(1, Math.round(gridX + (displayW - gridX) * revealProgress))
        : gridX;
      const effectiveGridY = revealProgress > 0
        ? Math.max(1, Math.round(effectiveGridX / 0.716))
        : gridY;
      const renderRatio = effectiveGridX / effectiveGridY;
      let sx = 0;
      let sy = 0;
      let sw = vW;
      let sh = vH;
      if (vRatio > renderRatio) {
        sw = vH * renderRatio;
        sx = (vW - sw) / 2;
      } else {
        sh = vW / renderRatio;
        sy = (vH - sh) / 2;
      }

      sampleCanvas.width = effectiveGridX;
      sampleCanvas.height = effectiveGridY;
      sampleCtx.clearRect(0, 0, effectiveGridX, effectiveGridY);
      sampleCtx.save();
      sampleCtx.translate(effectiveGridX, 0);
      sampleCtx.scale(-1, 1);
      sampleCtx.drawImage(video, sx, sy, sw, sh, 0, 0, effectiveGridX, effectiveGridY);
      sampleCtx.restore();

      displayCtx.imageSmoothingEnabled = false;
      displayCtx.drawImage(sampleCanvas, -1, -1, displayW + 2, displayH + 2);

      if (effectiveGridX > 1 && effectiveGridX < 80) {
        displayCtx.save();
        displayCtx.strokeStyle = 'rgba(0,0,0,0.045)';
        displayCtx.lineWidth = 1;
        const cellW = displayW / effectiveGridX;
        const cellH = displayH / effectiveGridY;
        for (let x = 0; x <= effectiveGridX; x += 1) {
          displayCtx.beginPath();
          displayCtx.moveTo(x * cellW, 0);
          displayCtx.lineTo(x * cellW, displayH);
          displayCtx.stroke();
        }
        for (let y = 0; y <= effectiveGridY; y += 1) {
          displayCtx.beginPath();
          displayCtx.moveTo(0, y * cellH);
          displayCtx.lineTo(displayW, y * cellH);
          displayCtx.stroke();
        }
        displayCtx.restore();
      }

      dimensionFrameRef.current = window.requestAnimationFrame(draw);
    };

    dimensionFrameRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (dimensionFrameRef.current !== null) {
        window.cancelAnimationFrame(dimensionFrameRef.current);
        dimensionFrameRef.current = null;
      }
    };
  }, [activeMirrorChapterType, dimensionCameraStarted, dimensionPhase]);

  useEffect(() => {
    if (!dimensionExtractedObjects.length || appMode !== 'play') return;
    let frameId: number | null = null;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const currentOffset = offsetRef.current;
      const currentScale = displayScaleRef.current || 1;
      const currentViewport = viewportRef.current;

      setDimensionExtractedObjects((objects) => objects.map((object) => {
        let nextX = object.x + (object.vx * dt) / currentScale;
        let nextY = object.y + (object.vy * dt) / currentScale;
        let nextVx = object.vx;
        let nextVy = object.vy;
        const screenWidth = object.width * currentScale;
        const screenHeight = object.height * currentScale;
        const screenX = currentOffset.x + nextX * currentScale;
        const screenY = currentOffset.y + nextY * currentScale;

        if (screenX < 0) {
          nextX = (0 - currentOffset.x) / currentScale;
          nextVx = Math.abs(nextVx);
        } else if (screenX + screenWidth > currentViewport.width) {
          nextX = (currentViewport.width - screenWidth - currentOffset.x) / currentScale;
          nextVx = -Math.abs(nextVx);
        }

        if (screenY < 0) {
          nextY = (0 - currentOffset.y) / currentScale;
          nextVy = Math.abs(nextVy);
        } else if (screenY + screenHeight > currentViewport.height) {
          nextY = (currentViewport.height - screenHeight - currentOffset.y) / currentScale;
          nextVy = -Math.abs(nextVy);
        }

        return {
          ...object,
          x: nextX,
          y: nextY,
          vx: nextVx,
          vy: nextVy,
        };
      }));

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [appMode, dimensionExtractedObjects.length]);

  useEffect(() => {
    if (!storageReadyRef.current) {
      storageReadyRef.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [settings]);

  useEffect(() => {
    CHAPTER_IMAGE_SRCS.forEach((src) => {
      preloadChapterImage(src);
    });
    preloadDodecahedronImages([
      ...CHAPTER_IMAGE_SRCS,
      ...Object.values(d12ChapterNumberAssets).map((asset) => asset.src),
    ]);
    preloadNoiseEruptionImages();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === 'Space') {
        if (
          appMode === 'play' &&
          activeMirrorChapterType === 'dimension' &&
          dimensionPhase === 'mosaic' &&
          dimensionCameraStarted
        ) {
          event.preventDefault();
          dimensionMosaicRevealStartRef.current = performance.now();
          return;
        }

        if (appMode === 'intro') {
          event.preventDefault();
          void requestPlayCameraOnce();
          if (introAlphabetDwellTimeoutRef.current !== null) {
            window.clearTimeout(introAlphabetDwellTimeoutRef.current);
            introAlphabetDwellTimeoutRef.current = null;
          }
          if (introAlphabetFrameRef.current !== null) {
            window.cancelAnimationFrame(introAlphabetFrameRef.current);
            introAlphabetFrameRef.current = null;
          }
          introAlphabetTargetRef.current = 0;
          introAlphabetProgressRef.current = 0;
          setIntroAlphabetProgress(0);
          introAlphabetManifestoVisibleRef.current = false;
          setIntroAlphabetManifestoVisible(false);
          setIntroAlphabetManifestoExiting(false);
          if (introNoclippingDwellTimeoutRef.current !== null) {
            window.clearTimeout(introNoclippingDwellTimeoutRef.current);
            introNoclippingDwellTimeoutRef.current = null;
          }
          if (introNoclippingFrameRef.current !== null) {
            window.cancelAnimationFrame(introNoclippingFrameRef.current);
            introNoclippingFrameRef.current = null;
          }
          introNoclippingTargetRef.current = 0;
          introNoclippingProgressRef.current = 0;
          setIntroNoclippingProgress(0);
          introNoclippingManifestoVisibleRef.current = false;
          setIntroNoclippingManifestoVisible(false);
          setIntroNoclippingManifestoExiting(false);
          if (introExtraFocusDwellTimeoutRef.current !== null) {
            window.clearTimeout(introExtraFocusDwellTimeoutRef.current);
            introExtraFocusDwellTimeoutRef.current = null;
          }
          if (introExtraFocusExitTimeoutRef.current !== null) {
            window.clearTimeout(introExtraFocusExitTimeoutRef.current);
            introExtraFocusExitTimeoutRef.current = null;
          }
          if (introExtraFocusFrameRef.current !== null) {
            window.cancelAnimationFrame(introExtraFocusFrameRef.current);
            introExtraFocusFrameRef.current = null;
          }
          introExtraFocusTargetRef.current = 0;
          introExtraFocusProgressRef.current = 0;
          setIntroExtraFocusProgress(0);
          introExtraFocusChapterRef.current = null;
          setIntroExtraFocusChapter(null);
          introExtraFocusManifestoVisibleRef.current = false;
          setIntroExtraFocusManifestoVisible(false);
          setIntroExtraFocusManifestoExiting(false);
          setHoveredChapter(null);
          currentFaceIndexRef.current = 0;
          currentFaceRotationRef.current = 0;
          currentChapterTypeRef.current = null;
          playMovingRef.current = false;
          const originPlayNode = createOriginPlayNode(settingsRef.current.pentagonRotation);
          playNodesRef.current = { [ORIGIN_PLAY_NODE_ID]: originPlayNode };
          currentPlayNodeIdRef.current = ORIGIN_PLAY_NODE_ID;
          nextPlayNodeSerialRef.current = 1;
          setCurrentFaceIndex(0);
          setCurrentFaceRotation(0);
          setCurrentChapterType(null);
          setPlayPath([]);
          setPlayNodes({ [ORIGIN_PLAY_NODE_ID]: originPlayNode });
          setCurrentPlayNodeId(ORIGIN_PLAY_NODE_ID);
          setLatestRevealedPlayNodeId(null);
          setRevealedGateIds(new Set());
          setRevealingGateIds(new Set());
          setPlayMovingTargetTileId(null);
          setPlayBlockedPromptVisible(false);
          setMapPreviewMode(false);
          setChaosActive(false);
          setLastTopologyTransition(null);
          setVisitedFaces(new Set([0]));
          setPlayPaused(false);
          setPauseDiceRolling(false);
          setAppMode('play');
        }
        return;
      }

      if (event.key === 'Escape') {
        if (activeExperience) {
          event.preventDefault();
          setActiveExperience(null);
          setNoiseEruptionOrigin(null);
          return;
        }

        if (activeMirrorNodeKey) {
          event.preventDefault();
          closeActiveMirror();
          return;
        }

        if (activeAudioChapter === 'noise') {
          event.preventDefault();
          stopNoiseAudio();
          return;
        }

        if (chaosActive) {
          event.preventDefault();
          setChaosActive(false);
          return;
        }

        if (appMode === 'play') {
          event.preventDefault();
          if (playPaused) {
            setPlayPaused(false);
            setPauseDiceRolling(false);
            return;
          }
          setPauseDiceFaceIndex(currentFaceIndexRef.current);
          setPlayPaused(true);
        }
        return;
      }

      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setDevPanelOpen((open) => !open);
      }

      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setTypographyPanelOpen((open) => !open);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeAudioChapter,
    activeExperience,
    activeMirrorChapterType,
    activeMirrorNodeKey,
    appMode,
    chaosActive,
    closeActiveMirror,
    dimensionCameraStarted,
    dimensionPhase,
    requestPlayCameraOnce,
    stopNoiseAudio,
  ]);

  useEffect(() => {
    const clamped = clampScale(scaleRef.current, settingsRef.current);
    if (clamped !== scaleRef.current) {
      scaleRef.current = clamped;
      displayScaleRef.current = clamped * getViewportFitScale(viewportRef.current);
      setScale(clamped);
    }
  }, [settings.minZoom, settings.maxZoom]);

  useEffect(() => {
    if (paused || !settings.showMirror || !settings.flickerEnabled) {
      return;
    }

    let frame = 0;
    const start = performance.now();
      const tick = (time: number) => {
      setFlickerTime((time - start) / 1000);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [paused, settings.flickerEnabled, settings.showMirror]);

  useEffect(() => {
    if (!paused) return;
    if (cameraFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }
    if (motionFrameRef.current !== null) {
      window.cancelAnimationFrame(motionFrameRef.current);
      motionFrameRef.current = null;
    }
    dragRef.current = null;
  }, [paused]);

  const metrics = useMemo(
    () => createExplorationMetrics(settings.nodeSpacingX, settings.nodeSpacingY),
    [settings.nodeSpacingX, settings.nodeSpacingY],
  );
  const pentagonUnit = useMemo(() => createPentagonUnit({
    radius: settings.pentagonRadius,
    chapterEdgeOffset: settings.chapterEdgeOffset,
    rotation: settings.pentagonRotation,
  }), [settings.chapterEdgeOffset, settings.pentagonRadius, settings.pentagonRotation]);
  const playPatchRadius = settings.pentagonRadius;
  const currentPlayNode = playNodes[currentPlayNodeId] ?? playNodes[ORIGIN_PLAY_NODE_ID] ?? createOriginPlayNode();
  const playPatchRootNode = mapPreviewMode
    ? playNodes[ORIGIN_PLAY_NODE_ID] ?? createOriginPlayNode()
    : currentPlayNode;
  const playPatchTiles = useMemo(() => createPlayPatchTiles({
    currentNode: playPatchRootNode,
    playNodes,
    radius: playPatchRadius,
    previewMode: mapPreviewMode,
    viewport,
    offset,
    scale: displayScale,
  }), [displayScale, mapPreviewMode, offset, playNodes, playPatchRadius, playPatchRootNode, viewport]);
  const playTopologyNodes = useMemo(() => (
    mapPreviewMode
      ? []
      : playPatchTiles
        .filter((tile) => tile.nodeId !== null)
        .map((tile) => createTopologyNodeFromTile(tile, playNodes))
  ), [mapPreviewMode, playNodes, playPatchTiles]);
  const playTopologyGates = useMemo(() => (
    mapPreviewMode ? [] : createTopologyGates(playPatchTiles, settings)
  ), [mapPreviewMode, playPatchTiles, settings]);
  const playCurrentChaptersByDirection = useMemo(() => (
    createChapterAssignmentFromIds(currentPlayNode.edgeChapters)
  ), [currentPlayNode.edgeChapters]);
  const previewVisual = useMemo(() => getPreviewVisualState(displayScale, mapPreviewMode), [displayScale, mapPreviewMode]);
  const currentSharedEdges = useMemo(() => Object.keys(currentPlayNode.links).length, [currentPlayNode.links]);

  useEffect(() => {
    playPatchRadiusRef.current = playPatchRadius;
  }, [playPatchRadius]);

  useEffect(() => {
    if (appMode !== 'play') return;
    auditPlayTopology(playPatchTiles, {
      mode: mapPreviewMode ? 'overview' : 'play',
      currentNodeId: currentPlayNodeId,
    });
  }, [appMode, currentPlayNodeId, mapPreviewMode, playPatchTiles]);

  const nodes = useMemo(() => (
    Object.values(nodeCoords).map((record) => createExplorationNode(record, metrics))
  ), [metrics, nodeCoords]);

  const nodesByKey = useMemo(() => (
    Object.fromEntries(nodes.map((node) => [node.key, node])) as Record<string, ExplorationNode>
  ), [nodes]);

  const edgeList = useMemo(() => getUniqueEdges(Object.values(edges)), [edges]);
  const edgeGateList = useMemo(() => (
    edgeList.flatMap((edge) => {
      const from = nodesByKey[edge.fromKey];
      const to = nodesByKey[edge.toKey];
      if (!from || !to) return [];
      const titlePosition = getPentagonChapterPosition(from.position, edge.direction, pentagonUnit);
      const chapterOffset = getChapterOffset(edge.direction, settings);
      const titleOffset = getChapterTitleOffset(edge.chapter.id, settings);

      return [{
        id: edge.id,
        sourceKey: edge.fromKey,
        direction: edge.direction,
        chapter: edge.chapter,
        x: titlePosition.x + chapterOffset.x + titleOffset.x,
        y: titlePosition.y + chapterOffset.y + titleOffset.y,
        explored: true,
      }];
    })
  ), [edgeList, nodesByKey, pentagonUnit, settings]);
  const gateList = useMemo(() => (
    nodes.flatMap((node) => {
      const occupiedDirections = getOccupiedDirectionsForNode(node, edgeList, nodesByKey, pentagonUnit);

      return NODE_DIRECTIONS.flatMap((direction) => {
        if (occupiedDirections.has(direction)) {
          return [];
        }

      const targetCoord = getTargetCoord(node.coord, direction);
      const targetKey = nodeKey(targetCoord);
      if (hasConnectedEdge(node.key, targetKey, edgeList)) {
        return [];
      }

      const titlePosition = getPentagonChapterPosition(node.position, direction, pentagonUnit);
      const edgeId = createEdgeId(node.key, direction);
      const chapter = node.chaptersByDirection[direction];
      const chapterOffset = getChapterOffset(direction, settings);
      const titleOffset = getChapterTitleOffset(chapter.id, settings);

      return [{
        id: edgeId,
        sourceKey: node.key,
        direction,
        chapter,
        x: titlePosition.x + chapterOffset.x + titleOffset.x,
        y: titlePosition.y + chapterOffset.y + titleOffset.y,
        explored: Boolean(edges[edgeId]),
      }];
      });
    })
  ), [edgeList, edges, nodes, nodesByKey, pentagonUnit, settings]);
  const mapStyle = useMemo(() => createMapStyle(settings), [settings]);
  const introAlphabetGate = useMemo(() => (
    gateList.find((gate) => gate.sourceKey === ORIGIN_KEY && gate.chapter.id === 'alphabet') ?? null
  ), [gateList]);
  const introNoclippingGate = useMemo(() => (
    gateList.find((gate) => gate.sourceKey === ORIGIN_KEY && gate.chapter.id === 'noclipping') ?? null
  ), [gateList]);
  const getIntroAlphabetProximity = useCallback((clientX: number, clientY: number) => {
    if (appMode !== 'intro' || !introSequencePlayed || !introAlphabetGate) {
      return { progress: 0, insideSmall: false, insideBig: false };
    }

    const gateScreenCenter = {
      x: offset.x + introAlphabetGate.x * displayScale,
      y: offset.y + introAlphabetGate.y * displayScale,
    };
    const chapterWidth = CHAPTER_VISUAL_WIDTH.alphabet *
      NODE_LAYOUT.titleScale *
      settings.globalScale *
      settings.chapterScale *
      INTRO_CHAPTER_SCALE *
      displayScale;
    const chapterHeight = chapterWidth * getImageAspect('alphabet');
    const bigRadius = Math.max(72, Math.min(chapterWidth, chapterHeight) * 0.32);
    const smallRadius = Math.max(28, bigRadius * 0.22);
    const distance = Math.hypot(clientX - gateScreenCenter.x, clientY - gateScreenCenter.y);

    if (distance > bigRadius) {
      return { progress: 0, insideSmall: false, insideBig: false };
    }

    const insideSmall = distance <= smallRadius;

    const rawProgress = 1 - (distance - smallRadius) / (bigRadius - smallRadius);
    const easedProgress = Math.pow(rawProgress, 2.2);
    return {
      progress: (insideSmall ? 1 : easedProgress) * INTRO_ALPHABET_PREVIEW_PROGRESS,
      insideSmall,
      insideBig: true,
    };
  }, [appMode, displayScale, introAlphabetGate, introSequencePlayed, offset, settings.chapterScale, settings.globalScale]);
  const updateIntroAlphabetFocus = useCallback((clientX: number, clientY: number) => {
    const proximity = getIntroAlphabetProximity(clientX, clientY);

    if (proximity.insideBig && !introAlphabetManifestoVisibleRef.current && introAlphabetDwellTimeoutRef.current === null) {
      introAlphabetDwellTimeoutRef.current = window.setTimeout(() => {
        introAlphabetDwellTimeoutRef.current = null;
        const pointer = lastPointerRef.current;
        const latestProximity = getIntroAlphabetProximity(pointer.x, pointer.y);
        if (!latestProximity.insideBig) return;

        introAlphabetManifestoVisibleRef.current = true;
        setIntroAlphabetManifestoVisible(true);
        setIntroAlphabetManifestoExiting(false);
        setHoveredChapter('alphabet');
        setIntroAlphabetTargetProgress(1);
        holdMouseVisualShiftAtOrigin();
      }, INTRO_ALPHABET_DWELL_MS);
    }

    if (!proximity.insideBig && introAlphabetDwellTimeoutRef.current !== null) {
      window.clearTimeout(introAlphabetDwellTimeoutRef.current);
      introAlphabetDwellTimeoutRef.current = null;
    }

    if (!proximity.insideBig && introAlphabetManifestoVisibleRef.current) {
      introAlphabetManifestoVisibleRef.current = false;
      setIntroAlphabetManifestoVisible(false);
      setIntroAlphabetManifestoExiting(true);
      setHoveredChapter(null);
      if (introAlphabetExitTimeoutRef.current !== null) {
        window.clearTimeout(introAlphabetExitTimeoutRef.current);
      }
      introAlphabetExitTimeoutRef.current = window.setTimeout(() => {
        introAlphabetExitTimeoutRef.current = null;
        setIntroAlphabetManifestoExiting(false);
      }, 440);
    }

    if (introAlphabetManifestoVisibleRef.current && proximity.insideBig) {
      setIntroAlphabetTargetProgress(1);
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    setIntroAlphabetTargetProgress(proximity.progress);

    if (proximity.insideBig || introAlphabetProgressRef.current > 0.001 || introAlphabetTargetRef.current > 0.001) {
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    return false;
  }, [
    getIntroAlphabetProximity,
    holdMouseVisualShiftAtOrigin,
    setIntroAlphabetTargetProgress,
  ]);
  const introAlphabetFocusShift = useMemo(() => {
    if (
      appMode !== 'intro' ||
      !introSequencePlayed ||
      !introAlphabetGate ||
      introAlphabetProgress <= 0
    ) {
      return { x: 0, y: 0 };
    }

    return {
      x: (viewport.width / 2 - (offset.x + introAlphabetGate.x * displayScale)) * introAlphabetProgress,
      y: (viewport.height / 2 - (offset.y + introAlphabetGate.y * displayScale)) * introAlphabetProgress,
    };
  }, [appMode, displayScale, introAlphabetGate, introAlphabetProgress, introSequencePlayed, offset, viewport]);
  const getIntroNoclippingProximity = useCallback((clientX: number, clientY: number) => {
    if (appMode !== 'intro' || !introSequencePlayed || !introNoclippingGate) {
      return { insideBig: false };
    }

    const gateScreenCenter = {
      x: offset.x + introNoclippingGate.x * displayScale,
      y: offset.y + introNoclippingGate.y * displayScale,
    };
    const chapterWidth = CHAPTER_VISUAL_WIDTH.noclipping *
      NODE_LAYOUT.titleScale *
      settings.globalScale *
      settings.chapterScale *
      INTRO_CHAPTER_SCALE *
      displayScale;
    const chapterHeight = chapterWidth * getImageAspect('noclipping');
    const bigRadius = Math.max(72, Math.min(chapterWidth, chapterHeight) * 0.32);
    const distance = Math.hypot(clientX - gateScreenCenter.x, clientY - gateScreenCenter.y);

    return {
      insideBig: distance <= bigRadius,
    };
  }, [appMode, displayScale, introNoclippingGate, introSequencePlayed, offset, settings.chapterScale, settings.globalScale]);
  const updateIntroNoclippingFocus = useCallback((clientX: number, clientY: number) => {
    const proximity = getIntroNoclippingProximity(clientX, clientY);

    if (proximity.insideBig && !introNoclippingManifestoVisibleRef.current && introNoclippingDwellTimeoutRef.current === null) {
      introNoclippingDwellTimeoutRef.current = window.setTimeout(() => {
        introNoclippingDwellTimeoutRef.current = null;
        const pointer = lastPointerRef.current;
        const latestProximity = getIntroNoclippingProximity(pointer.x, pointer.y);
        if (!latestProximity.insideBig) return;

        introNoclippingManifestoVisibleRef.current = true;
        setIntroNoclippingManifestoVisible(true);
        setIntroNoclippingManifestoExiting(false);
        setHoveredChapter('noclipping');
        setIntroNoclippingTargetProgress(1);
        holdMouseVisualShiftAtOrigin();
      }, INTRO_ALPHABET_DWELL_MS);
    }

    if (!proximity.insideBig && introNoclippingDwellTimeoutRef.current !== null) {
      window.clearTimeout(introNoclippingDwellTimeoutRef.current);
      introNoclippingDwellTimeoutRef.current = null;
    }

    if (!proximity.insideBig && introNoclippingManifestoVisibleRef.current) {
      introNoclippingManifestoVisibleRef.current = false;
      setIntroNoclippingManifestoVisible(false);
      setIntroNoclippingManifestoExiting(true);
      setHoveredChapter(null);
      setIntroNoclippingTargetProgress(0);
      if (introNoclippingExitTimeoutRef.current !== null) {
        window.clearTimeout(introNoclippingExitTimeoutRef.current);
      }
      introNoclippingExitTimeoutRef.current = window.setTimeout(() => {
        introNoclippingExitTimeoutRef.current = null;
        setIntroNoclippingManifestoExiting(false);
      }, 440);
    }

    if (introNoclippingManifestoVisibleRef.current && proximity.insideBig) {
      setIntroNoclippingTargetProgress(1);
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    if (proximity.insideBig) {
      setIntroNoclippingTargetProgress(0);
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    if (introNoclippingProgressRef.current > 0.001 || introNoclippingTargetRef.current > 0.001) {
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    return false;
  }, [
    getIntroNoclippingProximity,
    holdMouseVisualShiftAtOrigin,
    setIntroNoclippingTargetProgress,
  ]);
  const introNoclippingFocusShift = useMemo(() => {
    if (
      appMode !== 'intro' ||
      !introSequencePlayed ||
      !introNoclippingGate ||
      introNoclippingProgress <= 0
    ) {
      return { x: 0, y: 0 };
    }

    return {
      x: (viewport.width / 2 - (offset.x + introNoclippingGate.x * displayScale)) * introNoclippingProgress,
      y: (viewport.height / 2 - (offset.y + introNoclippingGate.y * displayScale)) * introNoclippingProgress,
    };
  }, [appMode, displayScale, introNoclippingGate, introNoclippingProgress, introSequencePlayed, offset, viewport]);
  const getIntroExtraFocusGate = useCallback((chapter: ChapterId | null) => {
    if (!chapter || !EXTRA_INTRO_FOCUS_CHAPTERS.includes(chapter as (typeof EXTRA_INTRO_FOCUS_CHAPTERS)[number])) {
      return null;
    }
    return gateList.find((gate) => gate.sourceKey === ORIGIN_KEY && gate.chapter.id === chapter) ?? null;
  }, [gateList]);
  const getIntroExtraFocusProximity = useCallback((chapter: ChapterId, clientX: number, clientY: number) => {
    const gate = getIntroExtraFocusGate(chapter);
    if (appMode !== 'intro' || !introSequencePlayed || !gate) {
      return { insideBig: false };
    }

    const gateScreenCenter = {
      x: offset.x + gate.x * displayScale,
      y: offset.y + gate.y * displayScale,
    };
    const chapterWidth = CHAPTER_VISUAL_WIDTH[chapter] *
      NODE_LAYOUT.titleScale *
      settings.globalScale *
      settings.chapterScale *
      INTRO_CHAPTER_SCALE *
      displayScale;
    const chapterHeight = chapterWidth * getImageAspect(chapter);
    const bigRadius = Math.max(72, Math.min(chapterWidth, chapterHeight) * 0.32);
    const distance = Math.hypot(clientX - gateScreenCenter.x, clientY - gateScreenCenter.y);

    return { insideBig: distance <= bigRadius };
  }, [appMode, displayScale, getIntroExtraFocusGate, introSequencePlayed, offset, settings.chapterScale, settings.globalScale]);
  const updateIntroExtraFocus = useCallback((clientX: number, clientY: number) => {
    const activeChapter = introExtraFocusChapterRef.current;
    const activeProximity = activeChapter ? getIntroExtraFocusProximity(activeChapter, clientX, clientY) : null;

    if (activeChapter && !activeProximity?.insideBig && introExtraFocusManifestoVisibleRef.current) {
      introExtraFocusManifestoVisibleRef.current = false;
      setIntroExtraFocusManifestoVisible(false);
      setIntroExtraFocusManifestoExiting(true);
      setHoveredChapter(null);
      setIntroExtraFocusTargetProgress(0);
      if (introExtraFocusExitTimeoutRef.current !== null) {
        window.clearTimeout(introExtraFocusExitTimeoutRef.current);
      }
      introExtraFocusExitTimeoutRef.current = window.setTimeout(() => {
        introExtraFocusExitTimeoutRef.current = null;
        setIntroExtraFocusManifestoExiting(false);
        introExtraFocusChapterRef.current = null;
        setIntroExtraFocusChapter(null);
      }, 440);
    }

    if (activeChapter && introExtraFocusManifestoVisibleRef.current && activeProximity?.insideBig) {
      setIntroExtraFocusTargetProgress(1);
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    if (!activeChapter && introExtraFocusDwellTimeoutRef.current === null) {
      const nextChapter = EXTRA_INTRO_FOCUS_CHAPTERS.find((chapter) => (
        getIntroExtraFocusProximity(chapter, clientX, clientY).insideBig
      ));

      if (nextChapter) {
        introExtraFocusChapterRef.current = nextChapter;
        setIntroExtraFocusChapter(nextChapter);
        introExtraFocusDwellTimeoutRef.current = window.setTimeout(() => {
          introExtraFocusDwellTimeoutRef.current = null;
          const pointer = lastPointerRef.current;
          const latestProximity = getIntroExtraFocusProximity(nextChapter, pointer.x, pointer.y);
          if (!latestProximity.insideBig) {
            introExtraFocusChapterRef.current = null;
            setIntroExtraFocusChapter(null);
            return;
          }

          introExtraFocusManifestoVisibleRef.current = true;
          setIntroExtraFocusManifestoVisible(true);
          setIntroExtraFocusManifestoExiting(false);
          setHoveredChapter(nextChapter);
          setIntroExtraFocusTargetProgress(1);
          holdMouseVisualShiftAtOrigin();
        }, INTRO_ALPHABET_DWELL_MS);
      }
    }

    if (activeChapter && !activeProximity?.insideBig && introExtraFocusDwellTimeoutRef.current !== null) {
      window.clearTimeout(introExtraFocusDwellTimeoutRef.current);
      introExtraFocusDwellTimeoutRef.current = null;
      introExtraFocusChapterRef.current = null;
      setIntroExtraFocusChapter(null);
    }

    if (activeChapter && activeProximity?.insideBig) {
      setIntroExtraFocusTargetProgress(0);
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    if (introExtraFocusProgressRef.current > 0.001 || introExtraFocusTargetRef.current > 0.001) {
      holdMouseVisualShiftAtOrigin();
      return true;
    }

    return false;
  }, [
    getIntroExtraFocusProximity,
    holdMouseVisualShiftAtOrigin,
    setIntroExtraFocusTargetProgress,
  ]);
  const introExtraFocusShift = useMemo(() => {
    if (
      appMode !== 'intro' ||
      !introSequencePlayed ||
      !introExtraFocusChapter ||
      introExtraFocusProgress <= 0
    ) {
      return { x: 0, y: 0 };
    }

    const gate = getIntroExtraFocusGate(introExtraFocusChapter);
    if (!gate) return { x: 0, y: 0 };

    return {
      x: (viewport.width / 2 - (offset.x + gate.x * displayScale)) * introExtraFocusProgress,
      y: (viewport.height / 2 - (offset.y + gate.y * displayScale)) * introExtraFocusProgress,
    };
  }, [appMode, displayScale, getIntroExtraFocusGate, introExtraFocusChapter, introExtraFocusProgress, introSequencePlayed, offset, viewport]);
  const introFocusActive = introAlphabetProgress > 0.001 ||
    introAlphabetManifestoVisible ||
    introNoclippingProgress > 0.001 ||
    introNoclippingManifestoVisible ||
    introExtraFocusProgress > 0.001 ||
    introExtraFocusManifestoVisible;
  const effectiveMouseVisualShift = introFocusActive
    ? { x: 0, y: 0 }
    : mouseVisualShift;
  const visualLayerShift = useMemo(() => {
    const safeScale = displayScale || 1;
    return {
      x: (introAlphabetFocusShift.x + introNoclippingFocusShift.x + introExtraFocusShift.x + effectiveMouseVisualShift.x) / safeScale,
      y: (introAlphabetFocusShift.y + introNoclippingFocusShift.y + introExtraFocusShift.y + effectiveMouseVisualShift.y) / safeScale,
    };
  }, [displayScale, effectiveMouseVisualShift.x, effectiveMouseVisualShift.y, introAlphabetFocusShift, introExtraFocusShift, introNoclippingFocusShift]);

  const updateSettings = (patch: Partial<PrototypeSettings>) => {
    setSettings((current) => normalizeSettings({ ...current, ...patch }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_PROTOTYPE_SETTINGS);
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
  };

  const updateTypographyPreset = (nextPreset: TypographyPreset) => {
    const selectionOnly = nextPreset.scopes === typographyPreset.scopes &&
      nextPreset.globalEnabled === typographyPreset.globalEnabled &&
      nextPreset.activeScopeId !== typographyPreset.activeScopeId;
    setTypographyPreset(nextPreset);
    if (selectionOnly) {
      setTypographyStatus(`当前作用范围：${nextPreset.activeScopeId}`);
      return;
    }
    setTypographyDirty(true);
    setTypographyStatus('未保存：当前修改已即时应用到 Intro');
  };

  const saveTypographyPreset = () => {
    const nextPreset = createTypographyPreset({
      ...typographyPreset,
      updatedAt: new Date().toISOString(),
    });
    try {
      window.localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(nextPreset));
      setTypographyPreset(nextPreset);
      setTypographyDirty(false);
      setTypographyStatus('已保存到 localStorage');
    } catch {
      setTypographyStatus('保存失败：localStorage 不可用或容量不足');
    }
  };

  const resetTypographyPreset = () => {
    window.localStorage.removeItem(TYPOGRAPHY_STORAGE_KEY);
    setTypographyPreset(DEFAULT_TYPOGRAPHY_PRESET);
    setTypographyDirty(false);
    setTypographyStatus('已恢复默认，并清除 localStorage 配置');
  };

  const exportTypographyPreset = () => {
    const json = JSON.stringify(typographyPreset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mirror-typography-preset.json';
    link.click();
    URL.revokeObjectURL(url);
    setTypographyStatus('已导出 JSON 配置');
  };

  const importTypographyPreset = (text: string) => {
    const parsed = parseTypographyPreset(text, 'import');
    setTypographyPreset(parsed.preset);
    setTypographyDirty(parsed.ok);
    setTypographyStatus(parsed.message);
  };

  const copyTypographyPreset = () => {
    const json = JSON.stringify(typographyPreset, null, 2);
    navigator.clipboard.writeText(json)
      .then(() => setTypographyStatus('已复制 JSON 配置到剪贴板'))
      .catch(() => setTypographyStatus('复制失败：浏览器未允许剪贴板访问'));
  };

  const startIntroMirrorCamera = async () => {
    if (!mirrorOpened || cameraStreamRef.current) return;

    await requestPlayCameraOnce();
  };

  const cancelCameraFrame = () => {
    if (cameraFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    }
  };

  const cancelMotionFrame = () => {
    if (motionFrameRef.current !== null) {
      window.cancelAnimationFrame(motionFrameRef.current);
      motionFrameRef.current = null;
    }
  };

  const updateActiveSnappedNode = (nextOffset: { x: number; y: number }) => {
    const nextActiveKey = findActiveSnappedNode(nextOffset, viewportRef.current, displayScaleRef.current, nodeCoordsRef.current, !pausedRef.current);
    if (nextActiveKey === activeSnappedNodeKeyRef.current) return;

    activeSnappedNodeKeyRef.current = nextActiveKey;
    setActiveSnappedNodeKey(nextActiveKey);
  };

  const showPlayBlockedPrompt = () => {
    if (playBlockedPromptTimeoutRef.current !== null) {
      window.clearTimeout(playBlockedPromptTimeoutRef.current);
    }
    setPlayBlockedPromptVisible(true);
    playBlockedPromptTimeoutRef.current = window.setTimeout(() => {
      playBlockedPromptTimeoutRef.current = null;
      setPlayBlockedPromptVisible(false);
    }, 920);
  };

  const startGateRevealOnce = (node: PlayNodeRecord) => {
    const nextGateIds = getNewGateIdsForPlayNode(node).filter((gateId) => !revealedGateIds.has(gateId));
    if (nextGateIds.length === 0) return;

    const nextGateSet = new Set(nextGateIds);
    setRevealingGateIds(nextGateSet);
    if (gateRevealTimeoutRef.current !== null) {
      window.clearTimeout(gateRevealTimeoutRef.current);
    }
    gateRevealTimeoutRef.current = window.setTimeout(() => {
      gateRevealTimeoutRef.current = null;
      setRevealedGateIds((current) => {
        const next = new Set(current);
        nextGateIds.forEach((gateId) => next.add(gateId));
        return next;
      });
      setRevealingGateIds(new Set());
    }, 980);
  };

  const transitionThroughPlayEdge = (crossedEdge: number): boolean => {
    if (playMovingRef.current || activeExperience || activeMirrorNodeKey) return false;

    const currentNode = playNodesRef.current[currentPlayNodeIdRef.current] ?? createOriginPlayNode();
    const chapter = currentNode.edgeChapters[crossedEdge] ?? getDodecahedronEdgeChapter(crossedEdge);
    const localPatch = createPlayPatchTiles({
      currentNode,
      playNodes: playNodesRef.current,
      radius: playPatchRadiusRef.current,
    });
    const neighborTile = localPatch.find((tile) => (
      tile.depth === 1 && tile.parentEdgeIndex === crossedEdge
    ));

    if (!neighborTile) return false;

    let nextPlayNodes = playNodesRef.current;
    let targetNodeId = currentNode.links[crossedEdge] ?? null;
    let targetNode = targetNodeId ? nextPlayNodes[targetNodeId] : null;
    let createdTargetNode = false;

    if (!targetNode) {
      targetNodeId = `play:${nextPlayNodeSerialRef.current}`;
      const created = createPlayNodeAfterTransition({
        currentNode,
        edgeIndex: crossedEdge,
        nodeId: targetNodeId,
        playNodes: nextPlayNodes,
        radius: playPatchRadiusRef.current,
        createdOrder: nextPlayNodeSerialRef.current,
      });
      if (!created) {
        animatePlayCameraToWorldPoint(currentNode.center, `transition-blocked:${currentNode.id}:edge:${crossedEdge}`, currentNode.center);
        showPlayBlockedPrompt();
        return false;
      }
      nextPlayNodeSerialRef.current += 1;
      nextPlayNodes = created.playNodes;
      targetNode = created.node;
      createdTargetNode = true;
      startGateRevealOnce(targetNode);
      playNodesRef.current = nextPlayNodes;
      setPlayNodes(nextPlayNodes);
    }

    if (!targetNode || !targetNodeId) return false;

    const neighborFace = targetNode.faceIndex;
    const backEdge = findLinkedEdgeIndex(targetNode, currentNode.id) ?? targetNode.backEdgeIndex ?? getPreferredEdgeIndexForChapter(chapter);
    const focus = getCameraFocusPoint(viewportRef.current, true);
    const targetOffset = {
      x: focus.x - targetNode.center.x * displayScaleRef.current,
      y: focus.y - targetNode.center.y * displayScaleRef.current,
    };
    const settledOffset = targetOffset;
    const snapDebug = {
      label: `transition:${currentNode.id}:edge:${crossedEdge}->${targetNodeId}`,
      startCenter: currentNode.center,
      targetCenter: targetNode.center,
    };

    playMovingRef.current = true;
    setPlayMovingTargetTileId(targetNodeId);
    cancelCameraFrame();
    cancelMotionFrame();
    stopNoiseAudio();

    if (getDeterministicProbability(`${currentNode.id}:${crossedEdge}:${targetNodeId}`) < CHAOS_TRIGGER_PROBABILITY) {
      setChaosActive(true);
    }

    const startOffset = offsetRef.current;
    let start: number | null = null;

    const step = (time: number) => {
      if (start === null) {
        start = time;
      }
      const progress = Math.min(1, (time - start) / CAMERA_ANIMATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const animatedOffset = {
        x: startOffset.x + (targetOffset.x - startOffset.x) * eased,
        y: startOffset.y + (targetOffset.y - startOffset.y) * eased,
      };

      offsetRef.current = animatedOffset;
      setOffset(animatedOffset);

      if (progress >= 1) {
        const settledNode = targetNode;
        currentFaceIndexRef.current = neighborFace;
        currentFaceRotationRef.current = settledNode.rotation;
        currentChapterTypeRef.current = settledNode.entryChapter;
        currentPlayNodeIdRef.current = settledNode.id;
        offsetRef.current = settledOffset;
        playMovingRef.current = false;
        setCurrentFaceIndex(neighborFace);
        setCurrentFaceRotation(settledNode.rotation);
        setCurrentChapterType(settledNode.entryChapter);
        setCurrentPlayNodeId(settledNode.id);
        setLatestRevealedPlayNodeId(createdTargetNode ? settledNode.id : null);
        setPlayBlockedPromptVisible(false);
        setPlayPath((path) => [...path, chapter]);
        setPlayMovingTargetTileId(null);
        setOffset(settledOffset);
        setVisitedFaces((current) => (
          current.has(neighborFace) ? current : new Set([...current, neighborFace])
        ));
        setLastTopologyTransition({
          currentFace: currentNode.faceIndex,
          crossedEdge,
          neighborFace,
          backEdge,
          path: settledNode.id,
        });
        auditSnapSettle({
          ...snapDebug,
          animationEndCenter: settledNode.center,
          offset: settledOffset,
          displayScale: displayScaleRef.current,
          viewport: viewportRef.current,
        });
        cameraFrameRef.current = null;
        return;
      }

      cameraFrameRef.current = window.requestAnimationFrame(step);
    };

    cameraFrameRef.current = window.requestAnimationFrame(step);
    return true;
  };

  const animatePlayCameraToWorldPoint = (
    worldPoint: { x: number; y: number },
    debugLabel = 'animatePlayCameraToWorldPoint',
    snapStartCenter: { x: number; y: number } | null = null,
  ) => {
    if (pausedRef.current) return;
    cancelCameraFrame();
    cancelMotionFrame();

    const startOffset = offsetRef.current;
    const focus = getCameraFocusPoint(viewportRef.current, true);
    const targetOffset = {
      x: focus.x - worldPoint.x * displayScaleRef.current,
      y: focus.y - worldPoint.y * displayScaleRef.current,
    };
    let start: number | null = null;

    const step = (time: number) => {
      if (start === null) {
        start = time;
      }
      const progress = Math.min(1, (time - start) / CAMERA_ANIMATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextOffset = {
        x: startOffset.x + (targetOffset.x - startOffset.x) * eased,
        y: startOffset.y + (targetOffset.y - startOffset.y) * eased,
      };

      offsetRef.current = nextOffset;
      setOffset(nextOffset);

      if (progress >= 1) {
        offsetRef.current = targetOffset;
        setOffset(targetOffset);
        auditSnapSettle({
          label: debugLabel,
          startCenter: snapStartCenter ?? worldPoint,
          targetCenter: worldPoint,
          animationEndCenter: worldPoint,
          offset: targetOffset,
          displayScale: displayScaleRef.current,
          viewport: viewportRef.current,
        });
        cameraFrameRef.current = null;
        return;
      }

      cameraFrameRef.current = window.requestAnimationFrame(step);
    };

    cameraFrameRef.current = window.requestAnimationFrame(step);
  };

  const startPlaySnap = (velocity = { x: 0, y: 0 }) => {
    if (playMovingRef.current || activeExperience || activeMirrorNodeKey) return;

    const currentNode = playNodesRef.current[currentPlayNodeIdRef.current] ?? createOriginPlayNode();
    const patch = createPlayPatchTiles({
      currentNode,
      playNodes: playNodesRef.current,
      radius: playPatchRadiusRef.current,
    });
    const candidate = findPlaySnapTile({
      offset: offsetRef.current,
      velocity,
      viewport: viewportRef.current,
      scale: displayScaleRef.current,
      tiles: patch,
      playNodes: playNodesRef.current,
    });

    if (!candidate) {
      animatePlayCameraToWorldPoint(currentNode.center, 'snap:blocked-return-current', currentNode.center);
      showPlayBlockedPrompt();
      return;
    }

    if (candidate.depth > 0 && candidate.parentEdgeIndex !== null) {
      transitionThroughPlayEdge(candidate.parentEdgeIndex);
      return;
    }

    animatePlayCameraToWorldPoint(
      getPlayTileCanonicalCenter(candidate, playNodesRef.current),
      `snap:${currentNode.id}->${candidate.id}`,
      currentNode.center,
    );
  };

  const setCurrentFaceForNode = (nodeKeyValue: string) => {
    const nextFace = nodeFacesRef.current[nodeKeyValue] ?? 0;
    currentFaceIndexRef.current = nextFace;
    setCurrentFaceIndex(nextFace);
    setVisitedFaces((current) => (
      current.has(nextFace) ? current : new Set([...current, nextFace])
    ));
  };

  const setCameraOffset = (nextOffset: { x: number; y: number }, shouldReveal = true): boolean => {
    if (appModeRef.current === 'play' && !activeExperience) {
      offsetRef.current = nextOffset;
      setOffset(nextOffset);
      return false;
    }

    offsetRef.current = nextOffset;
    setOffset(nextOffset);
    updateActiveSnappedNode(nextOffset);
    if (shouldReveal) {
      revealNearestReachableNode(nextOffset);
    }
    return false;
  };

  const animateCameraToNode = (node: ExplorationNode) => {
    if (pausedRef.current) return;
    cancelCameraFrame();
    cancelMotionFrame();

    const startOffset = offsetRef.current;
    const currentScale = displayScaleRef.current;
    const currentViewport = viewportRef.current;
    const focus = getCameraFocusPoint(currentViewport, !pausedRef.current);
    const targetOffset = {
      x: focus.x - node.position.x * currentScale,
      y: focus.y - node.position.y * currentScale,
    };
    let start: number | null = null;

    const step = (time: number) => {
      if (start === null) {
        start = time;
      }
      const progress = Math.min(1, (time - start) / CAMERA_ANIMATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCameraOffset({
        x: startOffset.x + (targetOffset.x - startOffset.x) * eased,
        y: startOffset.y + (targetOffset.y - startOffset.y) * eased,
      }, false);

      if (progress >= 1) {
        cameraFrameRef.current = null;
        return;
      }

      cameraFrameRef.current = window.requestAnimationFrame(step);
    };

    cameraFrameRef.current = window.requestAnimationFrame(step);
  };

  const recordExploration = (fromKey: string, direction: NodeDirection, targetCoord: NodeCoord) => {
    const fromRecord = nodeCoordsRef.current[fromKey];
    if (!fromRecord) return;

    const targetKey = nodeKey(targetCoord);
    const edgeId = createEdgeId(fromKey, direction);
    const chapter = fromRecord.chaptersByDirection[direction];
    const existingEdge = findConnectedEdge(fromKey, targetKey, Object.values(edges));
    const fromFace = nodeFacesRef.current[fromKey] ?? currentFaceIndexRef.current;
    const targetFace = nodeFacesRef.current[targetKey] ??
      getDodecahedronNeighborByEdge(fromFace, NODE_DIRECTIONS.indexOf(direction));
    const targetPosition = nodeCoordsRef.current[targetKey]?.position ??
      getPentagonTargetPosition(fromRecord.position, direction, pentagonUnit);
    const targetRecord = nodeCoordsRef.current[targetKey] ?? createEnteredNodeRecord({
      coord: targetCoord,
      parentNodeId: fromKey,
      enteredFrom: direction,
      chapter,
      position: targetPosition,
    });
    nodeFacesRef.current = {
      ...nodeFacesRef.current,
      [targetKey]: targetFace,
    };
    currentFaceIndexRef.current = targetFace;

    nodeCoordsRef.current = {
      ...nodeCoordsRef.current,
      [targetKey]: targetRecord,
    };
    currentKeyRef.current = targetKey;

    setNodeCoords((current) => (
      current[targetKey]
        ? current
        : { ...current, [targetKey]: targetRecord }
    ));
    setEdges((current) => (
      current[edgeId] || existingEdge || hasConnectedEdge(fromKey, targetKey, Object.values(current))
        ? current
        : {
            ...current,
            [edgeId]: {
              id: edgeId,
              fromKey,
              toKey: targetKey,
              direction,
              chapter,
            },
          }
    ));
    setCurrentKey(targetKey);
    setCurrentFaceIndex(targetFace);
    setVisitedFaces((current) => (
      current.has(targetFace) ? current : new Set([...current, targetFace])
    ));
  };

  const revealNearestReachableNode = (nextOffset: { x: number; y: number }) => {
    const candidate = findNearestReachableNode(nextOffset, viewportRef.current, displayScaleRef.current, nodeCoordsRef.current, pentagonUnit, settingsRef.current, false, true);
    if (!candidate || candidate.key === currentKeyRef.current) return;

    if (candidate.fromKey && candidate.direction) {
      recordExploration(candidate.fromKey, candidate.direction, candidate.coord);
      return;
    }

    currentKeyRef.current = candidate.key;
    setCurrentKey(candidate.key);
    setCurrentFaceForNode(candidate.key);
  };

  const startSnapFromNode = (startNodeKey: string, velocity = { x: 0, y: 0 }) => {
    if (pausedRef.current) return;
    cancelMotionFrame();

    const candidate = findSnapCandidateFromNode({
      startNodeKey,
      offset: offsetRef.current,
      velocity,
      viewport: viewportRef.current,
      scale: displayScaleRef.current,
      nodeCoords: nodeCoordsRef.current,
      pentagonUnit,
      forPlay: true,
    });
    if (!candidate) return;

    if (candidate.fromKey && candidate.direction) {
      recordExploration(candidate.fromKey, candidate.direction, candidate.coord);
    } else {
      currentKeyRef.current = candidate.key;
      setCurrentKey(candidate.key);
      setCurrentFaceForNode(candidate.key);
    }

    const targetPosition = candidate.position;
    const focus = getCameraFocusPoint(viewportRef.current, true);
    const targetOffset = {
      x: focus.x - targetPosition.x * displayScaleRef.current,
      y: focus.y - targetPosition.y * displayScaleRef.current,
    };
    let springVelocity = { x: 0, y: 0 };

    const step = () => {
      const current = offsetRef.current;
      springVelocity = {
        x: (springVelocity.x + (targetOffset.x - current.x) * 0.08) * 0.72,
        y: (springVelocity.y + (targetOffset.y - current.y) * 0.08) * 0.72,
      };
      const next = {
        x: current.x + springVelocity.x,
        y: current.y + springVelocity.y,
      };

      setCameraOffset(next, false);

      if (
        Math.hypot(targetOffset.x - next.x, targetOffset.y - next.y) < 0.4 &&
        Math.hypot(springVelocity.x, springVelocity.y) < 0.25
      ) {
        setCameraOffset(targetOffset, false);
        motionFrameRef.current = null;
        return;
      }

      motionFrameRef.current = window.requestAnimationFrame(step);
    };

    motionFrameRef.current = window.requestAnimationFrame(step);
  };

  const startInertia = (velocity: { x: number; y: number }, startNodeKey: string) => {
    if (pausedRef.current) return;
    cancelMotionFrame();

    const speed = Math.hypot(velocity.x, velocity.y);
    const currentSettings = settingsRef.current;
    if (!currentSettings.inertiaEnabled || speed < INERTIA_MIN_SPEED) {
      startSnapFromNode(startNodeKey, velocity);
      return;
    }

    const scaledVelocity = {
      x: velocity.x * currentSettings.inertiaVelocityScale,
      y: velocity.y * currentSettings.inertiaVelocityScale,
    };
    const scaledSpeed = Math.hypot(scaledVelocity.x, scaledVelocity.y);
    const releaseVelocity = scaledSpeed > MAX_RELEASE_SPEED
      ? {
          x: (scaledVelocity.x / scaledSpeed) * MAX_RELEASE_SPEED,
          y: (scaledVelocity.y / scaledSpeed) * MAX_RELEASE_SPEED,
        }
      : scaledVelocity;

    let vx = releaseVelocity.x;
    let vy = releaseVelocity.y;
    let lastTime: number | null = null;

    const step = (time: number) => {
      const dt = lastTime === null ? 16.67 : Math.min(32, Math.max(8, time - lastTime));
      lastTime = time;
      const current = offsetRef.current;

      setCameraOffset({
        x: current.x + vx * dt,
        y: current.y + vy * dt,
      }, false);

      const friction = Math.pow(settingsRef.current.inertiaFriction, dt / 16.67);
      vx *= friction;
      vy *= friction;

      if (Math.hypot(vx, vy) < INERTIA_MIN_SPEED) {
        motionFrameRef.current = null;
        startSnapFromNode(startNodeKey, { x: vx, y: vy });
        return;
      }

      motionFrameRef.current = window.requestAnimationFrame(step);
    };

    motionFrameRef.current = window.requestAnimationFrame(step);
  };

  const resetExploration = () => {
    cancelCameraFrame();
    cancelMotionFrame();
    stopNoiseAudio();
    const originRecord = createOriginNodeRecord();
    nodeCoordsRef.current = { [ORIGIN_KEY]: originRecord };
    currentKeyRef.current = ORIGIN_KEY;
    currentFaceIndexRef.current = 0;
    currentFaceRotationRef.current = 0;
    currentChapterTypeRef.current = null;
    playMovingRef.current = false;
    const originPlayNode = createOriginPlayNode(settingsRef.current.pentagonRotation);
    playNodesRef.current = { [ORIGIN_PLAY_NODE_ID]: originPlayNode };
    currentPlayNodeIdRef.current = ORIGIN_PLAY_NODE_ID;
    nextPlayNodeSerialRef.current = 1;
    nodeFacesRef.current = { [ORIGIN_KEY]: 0 };
    setNodeCoords({ [ORIGIN_KEY]: originRecord });
    setEdges({});
    setCurrentKey(ORIGIN_KEY);
    setCurrentFaceIndex(0);
    setCurrentFaceRotation(0);
    setCurrentChapterType(null);
    setPlayPath([]);
    setPlayNodes({ [ORIGIN_PLAY_NODE_ID]: originPlayNode });
    setCurrentPlayNodeId(ORIGIN_PLAY_NODE_ID);
    setLatestRevealedPlayNodeId(null);
    setRevealedGateIds(new Set());
    setRevealingGateIds(new Set());
    setPlayMovingTargetTileId(null);
    setPlayBlockedPromptVisible(false);
    setMapPreviewMode(false);
    setChaosActive(false);
    setVisitedFaces(new Set([0]));
    setLastTopologyTransition(null);
    animateCameraToNode(createExplorationNode(originRecord, metrics));
  };

  const startChapterPortal = useCallback((target: ChapterPortalTarget) => {
    if (chapterPortalPhase !== 'idle') return;
    setChapterPortalTarget(target);
    setChapterPortalReady(false);
    setChapterPortalDiceStep(0);
    setChapterPortalDots(1);
    setChapterPortalPhase('fading');
  }, [chapterPortalPhase]);

  const getNoiseEruptionOrigin = useCallback((worldPoint: { x: number; y: number }) => ({
    x: offsetRef.current.x + worldPoint.x * displayScaleRef.current,
    y: offsetRef.current.y + worldPoint.y * displayScaleRef.current,
  }), []);

  const openDimensionMirror = useCallback((nodeKey: string) => {
    stopDimensionCamera();
    dimensionExtractSerialRef.current = 0;
    setActiveMirrorNodeKey(nodeKey);
    setActiveMirrorChapterType('dimension');
    setDimensionCameraError(null);
    setDimensionCameraStarted(false);
    setDimensionExtractedObjects([]);
    setDimensionPhase(
      playCameraStateRef.current === 'denied' || playCameraStateRef.current === 'error'
        ? 'camera-unavailable'
        : 'mirror-waiting',
    );
  }, [stopDimensionCamera]);

  const enterChapterFromPauseDice = useCallback((chapter: ChapterId) => {
    setPlayPaused(false);
    setPauseDiceRolling(false);
    stopNoiseAudio();
    closeActiveMirror();

    if (chapter === 'alphabet') {
      setActiveExperience('alphabet');
      return;
    }

    if (chapter === 'paradox') {
      setActiveExperience('paradox');
      return;
    }

    if (chapter === 'noclipping') {
      setActiveExperience('noclipping');
      return;
    }

    if (chapter === 'dimension') {
      openDimensionMirror(currentPlayNodeIdRef.current);
      return;
    }

    if (chapter === 'noise') {
      const currentNode = playNodesRef.current[currentPlayNodeIdRef.current] ?? createOriginPlayNode();
      setNoiseEruptionOrigin(getNoiseEruptionOrigin(currentNode.center));
      setActiveExperience('noise');
    }
  }, [closeActiveMirror, getNoiseEruptionOrigin, openDimensionMirror]);

  const rollPauseDice = useCallback(() => {
    if (pauseDiceRollingRef.current || appModeRef.current !== 'play') return;
    pauseDiceRollingRef.current = true;

    const availableChapters = DODECAHEDRON_EDGE_CHAPTERS;
    const chapter = availableChapters[Math.floor(Math.random() * availableChapters.length)] ?? 'alphabet';
    const targetFaceIndex = getNextDodecahedronFace(currentFaceIndexRef.current, chapter);
    setPauseDiceFaceIndex(targetFaceIndex);
    setPauseDiceRolling(true);
    setPauseDiceRollSignal((signal) => signal + 1);

    window.setTimeout(() => {
      currentFaceIndexRef.current = targetFaceIndex;
      setCurrentFaceIndex(targetFaceIndex);
      enterChapterFromPauseDice(chapter);
      pauseDiceRollingRef.current = false;
    }, D12_ROLL_DURATION_MS + 220);
  }, [enterChapterFromPauseDice]);

  const applyChapterPortalTarget = useCallback((target: ChapterPortalTarget) => {
    if (target.chapterType === 'noclipping') {
      setActiveExperience('noclipping');
      return;
    }

    if (target.chapterType === 'dimension' && target.nodeKey) {
      openDimensionMirror(target.nodeKey);
      return;
    }

    console.log(`Coming soon: ${target.chapterType}`);
  }, [openDimensionMirror]);

  const handleChapterNodeClick = (node: ExplorationNode) => {
    if (!node.chapterType || node.chapterType === 'home') return;
    if (chapterPortalPhase !== 'idle') return;

    if (node.chapterType === 'noise') {
      closeActiveMirror();
      stopNoiseAudio();
      setNoiseEruptionOrigin(getNoiseEruptionOrigin(node.position));
      setActiveExperience('noise');
      return;
    }

    stopNoiseAudio();
    closeActiveMirror();

    if (appModeRef.current === 'play') {
      if (node.chapterType === 'alphabet') {
        setActiveExperience('alphabet');
        return;
      }

      if (node.chapterType === 'paradox') {
        setActiveExperience('paradox');
        return;
      }

      if (node.chapterType === 'dimension') {
        openDimensionMirror(node.key);
        return;
      }

      if (node.chapterType === 'noclipping') {
        startChapterPortal({
          chapterType: node.chapterType,
          nodeKey: node.key,
        });
        return;
      }

      console.log(`Coming soon: ${node.chapterType}`);
      return;
    }

    currentKeyRef.current = node.key;
    setCurrentKey(node.key);
    setCurrentFaceForNode(node.key);
    animateCameraToNode(node);

    if (node.chapterType === 'alphabet') {
      setActiveExperience('alphabet');
      return;
    }

    if (node.chapterType === 'paradox') {
      setActiveExperience('paradox');
      return;
    }

    if (node.chapterType === 'dimension') {
      openDimensionMirror(node.key);
      return;
    }

    if (node.chapterType === 'noclipping') {
      startChapterPortal({
        chapterType: node.chapterType,
        nodeKey: node.key,
      });
      return;
    }

    console.log(`Coming soon: ${node.chapterType}`);
  };

  const startAlphabetNoclippingPortal = useCallback(() => {
    startChapterPortal({
      chapterType: 'noclipping',
      nodeKey: null,
    });
  }, [startChapterPortal]);

  const handleNoclippingReady = useCallback(() => {
    setChapterPortalReady(true);
  }, []);

  useEffect(() => {
    if (chapterPortalPhase !== 'fading') return undefined;

    const timer = window.setTimeout(() => {
      if (chapterPortalTarget) {
        applyChapterPortalTarget(chapterPortalTarget);
      }
      setChapterPortalPhase('loading');
    }, CHAPTER_PORTAL_FADE_IN_MS);

    return () => window.clearTimeout(timer);
  }, [applyChapterPortalTarget, chapterPortalPhase, chapterPortalTarget]);

  useEffect(() => {
    if (chapterPortalPhase !== 'loading') return undefined;

    const dotsTimer = window.setInterval(() => {
      setChapterPortalDots((dots) => (dots % 3) + 1);
    }, 420);
    const diceTimer = window.setInterval(() => {
      setChapterPortalDiceStep((step) => step + 1);
    }, 1100);

    return () => {
      window.clearInterval(dotsTimer);
      window.clearInterval(diceTimer);
    };
  }, [chapterPortalPhase]);

  useEffect(() => {
    if (chapterPortalPhase !== 'loading' || chapterPortalDiceStep < 3) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setChapterPortalPhase('revealing');
    }, 350);

    return () => window.clearTimeout(timer);
  }, [chapterPortalDiceStep, chapterPortalPhase]);

  useEffect(() => {
    if (chapterPortalPhase !== 'revealing') return undefined;

    const timer = window.setTimeout(() => {
      setChapterPortalPhase('idle');
      setChapterPortalTarget(null);
      setChapterPortalReady(false);
      setChapterPortalDiceStep(0);
      setChapterPortalDots(1);
    }, CHAPTER_PORTAL_FADE_OUT_MS + CHAPTER_PORTAL_UNMOUNT_BUFFER_MS);

    return () => window.clearTimeout(timer);
  }, [chapterPortalPhase]);

  const chapterPortalActive = chapterPortalPhase !== 'idle';
  const chapterPortalFaceIndex = chapterPortalDiceStep % DODECAHEDRON_FACES.length;

  const handleHiddenCursorViewportClick = () => {
    if (activeMirrorNodeKey) return;

    if (appModeRef.current === 'play') {
      const currentNode = playNodesRef.current[currentPlayNodeIdRef.current] ?? createOriginPlayNode();
      const chapterNode = getNearestTopologyChapterNode(
        offsetRef.current,
        viewportRef.current,
        displayScaleRef.current,
        createPlayPatchTiles({
          currentNode,
          playNodes: playNodesRef.current,
          radius: playPatchRadiusRef.current,
        }),
        playNodesRef.current,
      );
      if (chapterNode) {
        handleChapterNodeClick(chapterNode);
      }
      return;
    }

    const nodeKeyToOpen = activeSnappedNodeKeyRef.current ?? currentKeyRef.current;
    const nodeRecord = nodeCoordsRef.current[nodeKeyToOpen];
    if (!nodeRecord) return;

    handleChapterNodeClick(createExplorationNode(nodeRecord, metrics));
  };

  function playNoiseAudioFromSavedTime() {
    let audio = noiseAudioRef.current;
    if (!audio) {
      audio = new Audio(NOISE_AUDIO_SRC);
      audio.preload = 'auto';
      noiseAudioRef.current = audio;
    }
    if (activeAudioChapter === 'noise' && !audio.paused) {
      return;
    }

    const savedTime = Math.max(0, noiseAudioTimeRef.current);
    if (Number.isFinite(savedTime)) {
      seekAudio(audio, savedTime);
    }
    audio.play()
      .then(() => setActiveAudioChapter('noise'))
      .catch((error) => console.error('noise audio play failed:', error));
  }

  const startDimensionCamera = async () => {
    if (playCameraStateRef.current === 'ready') {
      setDimensionCameraError(null);
      setDimensionPhase('mirror-waiting');
      return;
    }

    setDimensionCameraStarted(false);
    setDimensionPhase('camera-unavailable');
    setDimensionCameraError('摄像头未开启，无法识别挥手。\nCamera is not available.');
  };

  const cameraCursorActive = cameraPanelMode !== null ||
    playCameraState === 'prompting' ||
    playCameraState === 'requesting' ||
    playCameraState === 'selecting-device';
  const shouldHideSystemCursor = appMode === 'play' &&
    settings.hideSystemCursor &&
    !cameraCursorActive;
  const customCursorVisible = appMode === 'play' &&
    settings.hideSystemCursor &&
    !playPaused &&
    !customCursorInDevPanel &&
    !cameraCursorActive &&
    !activeExperience &&
    !activeMirrorNodeKey;
  const playHudRows = [
    { kind: 'zh', text: '面' },
    { kind: 'en', text: 'Face' },
    { kind: 'value', text: `${String(currentFaceIndex + 1).padStart(2, '0')} / 12` },
    { kind: 'zh', text: '当前章节' },
    { kind: 'en', text: 'Entry Chapter' },
    { kind: 'value', text: currentChapterType ? getChapterConfig(currentChapterType).label : 'None' },
    { kind: 'zh', text: '已穿越镜面' },
    { kind: 'en', text: 'Mirrors Crossed' },
    { kind: 'value', text: String(visitedFaces.size) },
    { kind: 'zh', text: '兔子洞' },
    { kind: 'en', text: 'Rabbit Holes' },
    { kind: 'value', text: String(playPath.length) },
    { kind: 'zh', text: '已记录路径' },
    { kind: 'en', text: 'Recorded Path' },
    { kind: 'value', text: `${Object.keys(playNodes).length} nodes` },
    { kind: 'zh', text: '共享边' },
    { kind: 'en', text: 'Shared Edges' },
    { kind: 'value', text: `${currentSharedEdges} locked` },
    { kind: 'zh', text: '可进入方向' },
    { kind: 'en', text: 'Open Edges' },
    { kind: 'value', text: `${5 - currentSharedEdges} / 5` },
    { kind: 'zh', text: '尺度' },
    { kind: 'en', text: 'Scale' },
    { kind: 'value', text: `${displayScale.toFixed(2)}x` },
    { kind: 'zh', text: '拓扑状态' },
    { kind: 'en', text: 'Topology' },
    { kind: 'value', text: mapPreviewMode ? 'Preview' : playBlockedPromptVisible ? 'Blocked' : 'Stable' },
    { kind: 'zh', text: '预览密度' },
    { kind: 'en', text: 'Preview Density' },
    { kind: 'value', text: mapPreviewMode ? `${playTopologyGates.length} gates` : 'Off' },
  ] as const;

  return (
    <main
      className={`${styles.viewport}${playPaused ? ` ${styles.paused}` : ''}${shouldHideSystemCursor ? ` ${styles.hideCursor}` : ''}${(devPanelOpen || typographyPanelOpen) ? ` ${styles.controlsVisible}` : ''}${settings.textDifferenceEnabled ? ` ${styles.textDifferenceEnabled}` : ''}`}
      style={mapStyle}
      onPointerDown={(event) => {
        if (appMode === 'play') {
          updateCustomCursorTarget(event.clientX, event.clientY);
        }
        if (activeExperience) return;
        if (playPaused) {
          event.preventDefault();
          event.stopPropagation();
          rollPauseDice();
          return;
        }
        if (paused || event.button !== 0) return;
        cancelCameraFrame();
        cancelMotionFrame();
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffsetX: offsetRef.current.x,
          startOffsetY: offsetRef.current.y,
          startTime: event.timeStamp,
          lastX: event.clientX,
          lastY: event.clientY,
          lastTime: event.timeStamp,
          velocityX: 0,
          velocityY: 0,
          startNodeKey: currentKeyRef.current,
          moved: false,
          canOpenOnRelease: appMode === 'play' && settings.hideSystemCursor && !devPanelOpen,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (appMode === 'play') {
          updateCustomCursorTarget(event.clientX, event.clientY);
        }
        if (activeExperience) return;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        if (appMode === 'intro' && !introSequencePlayed) {
          holdMouseVisualShiftAtOrigin();
          return;
        }
        const alphabetLocked = updateIntroAlphabetFocus(event.clientX, event.clientY);
        const noclippingLocked = updateIntroNoclippingFocus(event.clientX, event.clientY);
        const extraLocked = updateIntroExtraFocus(event.clientX, event.clientY);
        const visualLocked = alphabetLocked || noclippingLocked || extraLocked;
        if (visualLocked) {
          holdMouseVisualShiftAtOrigin();
        } else {
          updateMouseVisualTarget(event.clientX, event.clientY);
        }
        const drag = dragRef.current;
        if (paused || !drag || drag.pointerId !== event.pointerId) return;

        const dt = Math.max(8, event.timeStamp - drag.lastTime);
        const deltaX = event.clientX - drag.lastX;
        const deltaY = event.clientY - drag.lastY;
        const totalDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (totalDistance > HIDDEN_CURSOR_CLICK_MOVE_LIMIT) {
          drag.moved = true;
        }
        drag.velocityX = drag.velocityX * 0.72 + (deltaX / dt) * 0.28;
        drag.velocityY = drag.velocityY * 0.72 + (deltaY / dt) * 0.28;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        drag.lastTime = event.timeStamp;

        const crossedPlayEdge = setCameraOffset({
          x: drag.startOffsetX + (event.clientX - drag.startX) * DRAG_SPEED_MULTIPLIER,
          y: drag.startOffsetY + (event.clientY - drag.startY) * DRAG_SPEED_MULTIPLIER,
        }, false);
        if (crossedPlayEdge && appModeRef.current === 'play') {
          drag.startX = event.clientX;
          drag.startY = event.clientY;
          drag.startOffsetX = offsetRef.current.x;
          drag.startOffsetY = offsetRef.current.y;
          drag.velocityX = 0;
          drag.velocityY = 0;
        }
      }}
      onPointerUp={(event) => {
        if (activeExperience) return;
        if (paused || dragRef.current?.pointerId !== event.pointerId) return;

        const releaseVelocity = {
          x: dragRef.current.velocityX,
          y: dragRef.current.velocityY,
        };
        const startNodeKey = dragRef.current.startNodeKey;
        const moved = dragRef.current.moved;
        const canOpenOnRelease = dragRef.current.canOpenOnRelease;
        const pressDuration = event.timeStamp - dragRef.current.startTime;
        const totalDistance = Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY);
        const releaseSpeed = Math.hypot(releaseVelocity.x, releaseVelocity.y);
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);

        if (appMode === 'play') {
          const isIntentionalClick = canOpenOnRelease &&
            !moved &&
            totalDistance <= HIDDEN_CURSOR_CLICK_MOVE_LIMIT &&
            pressDuration <= HIDDEN_CURSOR_CLICK_TIME_LIMIT_MS &&
            releaseSpeed <= HIDDEN_CURSOR_CLICK_SPEED_LIMIT;

          if (isIntentionalClick) {
            handleHiddenCursorViewportClick();
            return;
          }

          startPlaySnap(moved ? releaseVelocity : { x: 0, y: 0 });
          return;
        }

        const isIntentionalClick = canOpenOnRelease &&
          !moved &&
          totalDistance <= HIDDEN_CURSOR_CLICK_MOVE_LIMIT &&
          pressDuration <= HIDDEN_CURSOR_CLICK_TIME_LIMIT_MS &&
          releaseSpeed <= HIDDEN_CURSOR_CLICK_SPEED_LIMIT;

        if (isIntentionalClick) {
          handleHiddenCursorViewportClick();
          return;
        }

        if (!moved) {
          startSnapFromNode(startNodeKey);
          return;
        }
        startInertia(releaseVelocity, startNodeKey);
      }}
      onPointerCancel={(event) => {
        if (activeExperience) return;
        if (paused || dragRef.current?.pointerId !== event.pointerId) return;

        const startNodeKey = dragRef.current.startNodeKey;
        dragRef.current = null;
        if (appMode === 'play') {
          startPlaySnap();
          return;
        }
        startSnapFromNode(startNodeKey);
      }}
      onPointerLeave={() => {
        if (introAlphabetDwellTimeoutRef.current !== null) {
          window.clearTimeout(introAlphabetDwellTimeoutRef.current);
          introAlphabetDwellTimeoutRef.current = null;
        }
        introAlphabetManifestoVisibleRef.current = false;
        setIntroAlphabetManifestoVisible(false);
        setIntroAlphabetManifestoExiting(false);
        setHoveredChapter((chapter) => (chapter === 'alphabet' ? null : chapter));
        setIntroAlphabetTargetProgress(0);
        if (introNoclippingDwellTimeoutRef.current !== null) {
          window.clearTimeout(introNoclippingDwellTimeoutRef.current);
          introNoclippingDwellTimeoutRef.current = null;
        }
        introNoclippingManifestoVisibleRef.current = false;
        setIntroNoclippingManifestoVisible(false);
        setIntroNoclippingManifestoExiting(false);
        setHoveredChapter((chapter) => (chapter === 'noclipping' ? null : chapter));
        setIntroNoclippingTargetProgress(0);
        if (introExtraFocusDwellTimeoutRef.current !== null) {
          window.clearTimeout(introExtraFocusDwellTimeoutRef.current);
          introExtraFocusDwellTimeoutRef.current = null;
        }
        if (introExtraFocusExitTimeoutRef.current !== null) {
          window.clearTimeout(introExtraFocusExitTimeoutRef.current);
          introExtraFocusExitTimeoutRef.current = null;
        }
        introExtraFocusManifestoVisibleRef.current = false;
        setIntroExtraFocusManifestoVisible(false);
        setIntroExtraFocusManifestoExiting(false);
        setHoveredChapter((chapter) => (chapter && EXTRA_INTRO_FOCUS_CHAPTERS.includes(chapter as (typeof EXTRA_INTRO_FOCUS_CHAPTERS)[number]) ? null : chapter));
        setIntroExtraFocusTargetProgress(0);
        introExtraFocusChapterRef.current = null;
        setIntroExtraFocusChapter(null);
        holdMouseVisualShiftAtOrigin();
      }}
      onWheel={(event) => {
        if (activeExperience && activeExperience !== 'noise') return;
        if (appMode === 'intro') {
          if (!introSequencePlayed) return;
          event.preventDefault();
          cancelCameraFrame();
          cancelMotionFrame();

          const currentOffset = offsetRef.current;
          const currentViewport = viewportRef.current;
          const currentDisplayScale = displayScaleRef.current;
          const startY = getIntroStartOffsetY(currentViewport, currentDisplayScale);
          const targetY = currentViewport.height / 2 - INTRO_SCROLL_EXTRA_Y * currentDisplayScale;
          const travelDirection = targetY >= startY ? 1 : -1;
          const wheelDirection = event.deltaY >= 0 ? 1 : -1;
          const nextY = clampBetween(
            currentOffset.y + wheelDirection * travelDirection * Math.abs(event.deltaY) * INTRO_SCROLL_SPEED,
            startY,
            targetY,
          );

          setCameraOffset({
            x: currentOffset.x,
            y: nextY,
          }, false);
          return;
        }
        if (paused) return;
        event.preventDefault();
        cancelCameraFrame();
        cancelMotionFrame();

        const currentScale = scaleRef.current;
        const currentDisplayScale = displayScaleRef.current;
        const currentOffset = offsetRef.current;
        const nextScale = clampScale(currentScale * (1 - event.deltaY * settingsRef.current.zoomSensitivity), settingsRef.current);
        if (nextScale === currentScale) return;

        const focus = getCameraFocusPoint(viewportRef.current, appModeRef.current === 'play');
        const nextDisplayScale = nextScale * getViewportFitScale(viewportRef.current);
        const worldX = (focus.x - currentOffset.x) / currentDisplayScale;
        const worldY = (focus.y - currentOffset.y) / currentDisplayScale;

        scaleRef.current = nextScale;
        displayScaleRef.current = nextDisplayScale;
        setScale(nextScale);
        setCameraOffset({
          x: focus.x - worldX * nextDisplayScale,
          y: focus.y - worldY * nextDisplayScale,
        }, false);
      }}
    >
      <div
        className={styles.mapLayer}
        style={{
          '--visual-shift-x': `${visualLayerShift.x}px`,
          '--visual-shift-y': `${visualLayerShift.y}px`,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${displayScale})`,
        } as CSSProperties}
      >
        {appMode === 'play' && (
          <PentagonPatchRenderer
            tiles={playPatchTiles}
            currentFaceIndex={currentFaceIndex}
            onEdgeSelect={transitionThroughPlayEdge}
            debug={settings.showPentagonGuide}
            preview={mapPreviewMode}
            lineOpacity={previewVisual.lineOpacity}
            pointOpacity={previewVisual.pointOpacity}
          />
        )}

        {appMode === 'intro' && settings.showPentagonGuide && nodes.map((node) => (
          <PentagonGuide
            key={`pentagon-guide-${node.key}`}
            node={node}
            pentagonUnit={pentagonUnit}
          />
        ))}

        {appMode === 'intro' && showChapters && edgeGateList.map((gate) => (
          <ChapterGate
            key={gate.id}
            direction={gate.direction}
            chapter={gate.chapter}
            x={gate.x}
            y={gate.y}
            explored={gate.explored}
            active={false}
            onClick={undefined}
            settings={settings}
            revealing={false}
            previewOpacity={1}
            intro={false}
            introAnimated={false}
            hovered={false}
            introFocus={false}
            introHoverEnabled={false}
            onHoverChapter={setHoveredChapter}
            sequenceIndex={0}
          />
        ))}

        {appMode === 'play' && !mapPreviewMode && showChapters && playTopologyGates.map((gate) => {
          const revealing = revealingGateIds.has(gate.stableId);
          const revealed = revealedGateIds.has(gate.stableId);
          const linkedPathGate = Boolean(playNodes[gate.tileId]?.links[gate.edgeIndex]);
          const stablePathGate = gate.tileId === ORIGIN_PLAY_NODE_ID || linkedPathGate || (gate.depth > 0 && !gate.previewOnly);
          const previewOpacity = gate.previewOnly || mapPreviewMode
            ? previewVisual.titleOpacity
            : revealing || revealed || stablePathGate
              ? 1
              : 0;

          return (
            <ChapterGate
              key={gate.id}
              direction={gate.direction}
              chapter={gate.chapter}
              x={gate.x}
              y={gate.y}
              explored={gate.depth > 0}
              active={!mapPreviewMode && gate.tileId === currentPlayNodeId}
              onClick={!mapPreviewMode && gate.tileId === currentPlayNodeId ? () => transitionThroughPlayEdge(gate.edgeIndex) : undefined}
              settings={settings}
              revealing={revealing}
              previewOpacity={previewOpacity}
              intro={false}
              introAnimated={false}
              hovered={false}
              introFocus={false}
              introHoverEnabled={false}
              onHoverChapter={setHoveredChapter}
              sequenceIndex={gate.revealIndex}
            />
          );
        })}

        {appMode === 'intro' && showChapters && gateList.map((gate) => (
          <ChapterGate
            key={gate.id}
            direction={gate.direction}
            chapter={gate.chapter}
            x={gate.x}
            y={gate.y}
            explored={gate.explored}
            active={false}
            onClick={undefined}
            settings={settings}
            revealing={false}
            previewOpacity={1}
            intro={true}
            introAnimated={!introSequencePlayed && gate.sourceKey === ORIGIN_KEY}
            hovered={introSequencePlayed && hoveredChapter === gate.chapter.id}
            introFocus={introSequencePlayed && (
              (gate.chapter.id === 'alphabet' && (hoveredChapter === 'alphabet' || introAlphabetManifestoExiting)) ||
              (gate.chapter.id === 'noclipping' && (hoveredChapter === 'noclipping' || introNoclippingManifestoExiting)) ||
              (introExtraFocusChapter === gate.chapter.id && (hoveredChapter === gate.chapter.id || introExtraFocusManifestoExiting))
            )}
            introHoverEnabled={introSequencePlayed}
            onHoverChapter={setHoveredChapter}
            sequenceIndex={NODE_DIRECTIONS.indexOf(gate.direction)}
          />
        ))}

        {appMode === 'play' && !mapPreviewMode && playTopologyNodes.map(({ tile, node }) => (
          <MapNode
            key={node.key}
            node={node}
            current={tile.nodeId === currentPlayNodeId}
            snapped={(tile.nodeId === currentPlayNodeId && !playMovingTargetTileId) || tile.id === playMovingTargetTileId}
            revealing={tile.nodeId === latestRevealedPlayNodeId}
            introAnimated={false}
            introOrigin={false}
            mirrorOpened={mirrorOpened}
            cameraStarted={cameraStarted}
            cameraError={cameraError}
            videoRef={mirrorVideoRef}
            onOpenMirror={() => setMirrorOpened(true)}
            onStartCamera={startIntroMirrorCamera}
            activeMirrorChapterType={node.key === activeMirrorNodeKey ? activeMirrorChapterType : null}
            dimensionCameraStarted={dimensionCameraStarted}
            dimensionCameraError={dimensionCameraError}
            dimensionPhase={dimensionPhase}
          dimensionVideoRef={dimensionVideoRef}
          dimensionCanvasRef={dimensionCanvasRef}
          onStartDimensionCamera={startDimensionCamera}
          onChangeCamera={changeCamera}
          onChapterNodeClick={tile.depth === 0 && currentChapterType ? handleChapterNodeClick : undefined}
            showDots={showDots}
            settings={settings}
            flickerTime={flickerTime}
            previewOnly={mapPreviewMode || tile.nodeId === null || tile.previewOnly}
          />
        ))}

        {appMode === 'intro' && nodes.map((node) => (
          <MapNode
            key={node.key}
            node={node}
            current={node.key === currentKey}
            snapped={false}
            revealing={false}
            introAnimated={!introSequencePlayed && node.key === ORIGIN_KEY}
            introOrigin={node.key === ORIGIN_KEY}
            mirrorOpened={mirrorOpened}
            cameraStarted={cameraStarted}
            cameraError={cameraError}
            videoRef={mirrorVideoRef}
            onOpenMirror={() => setMirrorOpened(true)}
            onStartCamera={startIntroMirrorCamera}
            activeMirrorChapterType={node.key === activeMirrorNodeKey ? activeMirrorChapterType : null}
            dimensionCameraStarted={dimensionCameraStarted}
            dimensionCameraError={dimensionCameraError}
            dimensionPhase={dimensionPhase}
            dimensionVideoRef={dimensionVideoRef}
            dimensionCanvasRef={dimensionCanvasRef}
            onStartDimensionCamera={startDimensionCamera}
            onChangeCamera={changeCamera}
            onChapterNodeClick={undefined}
            showDots={showDots}
            settings={settings}
            flickerTime={flickerTime}
            previewOnly={false}
          />
        ))}

        {appMode === 'play' && dimensionExtractedObjects.length > 0 && (
          <div className={styles.dimensionExtractedLayer} aria-hidden="true">
            {dimensionExtractedObjects.map((object) => (
              <img
                key={object.id}
                className={styles.dimensionExtractedObject}
                src={object.src}
                alt=""
                style={{
                  '--dimension-object-x': `${object.x}px`,
                  '--dimension-object-y': `${object.y}px`,
                  '--dimension-object-origin-x': `${(viewport.width / 2 - offset.x) / displayScale}px`,
                  '--dimension-object-origin-y': `${(viewport.height / 2 - offset.y) / displayScale}px`,
                  '--dimension-object-width': `${object.width}px`,
                  '--dimension-object-height': `${object.height}px`,
                  '--dimension-object-rotation': `${object.rotation}deg`,
                } as CSSProperties}
                draggable={false}
              />
            ))}
          </div>
        )}
      </div>

      {appMode === 'play' && !activeExperience && (
        <>
          <DodecahedronNavigator
            currentFaceIndex={playPaused ? pauseDiceFaceIndex : currentFaceIndex}
            chaptersByDirection={playCurrentChaptersByDirection}
            modelScale={settings.d12Scale}
            lineWidth={settings.d12LineWidth + (playPaused ? 0 : 1)}
            interactive={playPaused}
            rollSignal={pauseDiceRollSignal}
            rollTargetFaceIndex={pauseDiceFaceIndex}
            visualMode={playPaused ? 'chapters' : 'numbers'}
            onClick={rollPauseDice}
          />

          <div className={`${styles.hudDock}${hudDockSettled ? ` ${styles.hudDockSettled}` : ''}`} aria-hidden="true">
            <div className={styles.hudTrigger} />
            <div className={styles.topHud}>
              {playHudRows.map((row, index) => (
                <span
                  key={`${row.kind}-${index}`}
                  className={row.kind === 'zh' ? styles.hudChinese : row.kind === 'en' ? styles.hudEnglish : undefined}
                  style={{ '--hud-row-index': index } as CSSProperties}
                >
                  {row.text}
                </span>
              ))}
            </div>
          </div>
          {settings.showPentagonGuide && (
            <TopologyDebugOverlay
              currentFaceIndex={currentFaceIndex}
              currentFaceRotation={currentFaceRotation}
              transition={lastTopologyTransition}
            />
          )}
          <button
            type="button"
            className={styles.previewToggle}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              setMapPreviewMode(false);
              setActiveExperience('metadata');
            }}
            aria-label="Open Meta-Data image sequence"
          >
            *
          </button>
        </>
      )}

      <ModeChrome
        mode={appMode}
        animated={appMode === 'intro' && !introSequencePlayed}
        blocked={appMode === 'play' && playBlockedPromptVisible}
        pausedRoll={playPaused}
        settings={settings}
      />

      {playIdleClockVisible && (
        <PlayIdleClock time={playIdleClockTime} />
      )}

      {cameraPanelMode && (
        <CameraSelectionPanel
          mode={cameraPanelMode}
          devices={cameraDevices}
          selectedDeviceId={selectedCameraDeviceId}
          cameraState={playCameraState}
          cameraError={cameraError}
          cameraDeviceStatus={cameraDeviceStatus}
          onSelectedDeviceChange={(deviceId) => {
            setSelectedCameraDeviceId(deviceId);
            setSelectedCameraLabel(cameraDevices.find((device) => device.deviceId === deviceId)?.label ?? '');
          }}
          onContinue={() => void requestPlayCameraOnce({ skipContinuityTip: true, forceSelection: true })}
          onUseSelected={() => void chooseCameraDevice(selectedCameraDeviceId)}
          onUseDefault={() => void useDefaultCamera()}
          onRefreshDevices={() => void refreshCameraDevices()}
          onClose={() => {
            setCameraPanelMode(null);
            if (playCameraState === 'prompting' || playCameraState === 'selecting-device') {
              playCameraStateRef.current = cameraStreamRef.current ? 'ready' : 'idle';
              setPlayCameraState(cameraStreamRef.current ? 'ready' : 'idle');
            }
          }}
        />
      )}

      {appMode === 'play' && cameraSwitchPrompt && !cameraPanelMode && (
        <div className={styles.cameraSwitchPrompt}>
          <span>{cameraSwitchPrompt}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCameraSwitchPrompt(null);
              void changeCamera();
            }}
          >
            Change camera
          </button>
        </div>
      )}

      {activeExperience === 'noclipping' && (
        <NoclippingExperience
          viewport={viewport}
          settings={settings}
          adPreview={noclippingAdPreviewRequested}
          onReady={handleNoclippingReady}
        />
      )}

      {activeExperience === 'alphabet' && (
        <AlphabetExperience
          onClose={() => setActiveExperience(null)}
          onEnterNoclipping={startAlphabetNoclippingPortal}
        />
      )}

      {activeExperience === 'paradox' && (
        <ParadoxChapter onBack={() => setActiveExperience(null)} />
      )}

      {activeExperience === 'noise' && (
        <NoiseChapter
          origin={noiseEruptionOrigin ?? undefined}
          onBack={() => {
            setActiveExperience(null);
            setNoiseEruptionOrigin(null);
          }}
        />
      )}

      {activeExperience === 'metadata' && (
        <MetadataGalleryExperience onBack={() => setActiveExperience(null)} />
      )}

      {chapterPortalActive && (
        <div
          className={[
            styles.chapterPortalOverlay,
            chapterPortalPhase === 'fading' || chapterPortalPhase === 'loading'
              ? styles.chapterPortalOverlayVisible
              : '',
            chapterPortalPhase === 'revealing' ? styles.chapterPortalOverlayRevealing : '',
          ].filter(Boolean).join(' ')}
          aria-live="polite"
          aria-label="Loading next mirror"
        >
          <div
            className={[
              styles.chapterPortalContent,
              chapterPortalPhase === 'loading' ? styles.chapterPortalContentVisible : '',
            ].filter(Boolean).join(' ')}
          >
            <div className={styles.chapterPortalD12} aria-hidden="true">
              <DodecahedronNavigator
                currentFaceIndex={chapterPortalFaceIndex}
                chaptersByDirection={playCurrentChaptersByDirection}
                modelScale={settings.d12Scale}
                lineWidth={settings.d12LineWidth}
              />
            </div>
            <div className={styles.chapterPortalLoadingText}>
              loading{'.'.repeat(chapterPortalDots)}
            </div>
          </div>
        </div>
      )}

      {customCursorVisible && (
        <div
          className={styles.customCursor}
          aria-hidden="true"
          style={{
            '--custom-cursor-x': `${customCursor.x - (80 / 256) * customCursor.size}px`,
            '--custom-cursor-y': `${customCursor.y - (38 / 256) * customCursor.size}px`,
            '--custom-cursor-size': `${customCursor.size}px`,
          } as CSSProperties}
        />
      )}

      {devPanelOpen && (
        <InfiniteNodeMapDevPanel
          settings={settings}
          showDots={showDots}
          showChapters={showChapters}
          onChange={updateSettings}
          onShowDotsChange={setShowDots}
          onShowChaptersChange={setShowChapters}
          onResetExploration={resetExploration}
          onReset={resetSettings}
          onOpenTypography={() => setTypographyPanelOpen((open) => !open)}
          onPanelPointerEnter={() => setCustomCursorInDevPanel(true)}
          onPanelPointerLeave={() => setCustomCursorInDevPanel(false)}
        />
      )}

      {typographyPanelOpen && (
        <TypographyEnginePanel
          preset={typographyPreset}
          dirty={typographyDirty}
          status={typographyStatus}
          onPresetChange={updateTypographyPreset}
          onSave={saveTypographyPreset}
          onReset={resetTypographyPreset}
          onExport={exportTypographyPreset}
          onImportText={importTypographyPreset}
          onCopy={copyTypographyPreset}
          onClose={() => setTypographyPanelOpen(false)}
          onPanelPointerEnter={() => setCustomCursorInDevPanel(true)}
          onPanelPointerLeave={() => setCustomCursorInDevPanel(false)}
        />
      )}
    </main>
  );
}

function PentagonPatchRenderer({
  tiles,
  currentFaceIndex,
  onEdgeSelect,
  debug,
  preview,
  lineOpacity,
  pointOpacity,
}: {
  tiles: PlayPatchTile[];
  currentFaceIndex: number;
  onEdgeSelect: (edgeIndex: number) => void;
  debug: boolean;
  preview: boolean;
  lineOpacity: number;
  pointOpacity: number;
}) {
  const orderedTiles = [...tiles].sort((a, b) => b.depth - a.depth);
  const showGrid = debug || preview;
  const uniqueEdges = getUniquePatchEdges(orderedTiles);
  const uniqueCenterTiles = getUniqueCenterTiles(orderedTiles);
  const currentTile = orderedTiles.find((tile) => tile.depth === 0) ?? null;

  return (
    <svg
      className={styles.pentagonPatch}
      aria-label="D12 pentagon topology patch"
      style={{
        '--preview-line-opacity': lineOpacity,
        '--preview-point-opacity': pointOpacity,
      } as CSSProperties}
    >
      {showGrid && uniqueEdges.map((edge) => (
        <line
          key={edge.key}
          className={`${styles.pentagonPatchEdge}${preview && !debug ? ` ${styles.previewPatchEdge}` : ''}`}
          x1={edge.start.x}
          y1={edge.start.y}
          x2={edge.end.x}
          y2={edge.end.y}
        />
      ))}
      {orderedTiles.map((tile) => {
        const points = tile.vertices
          .map((vertex) => `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)}`)
          .join(' ');
        const showTileDebug = tile.depth <= 2;
        const showEdgeDebug = tile.depth <= 1;

        return (
          <g
            key={tile.id}
            className={`${styles.pentagonPatchTile}${tile.depth === 0 ? ` ${styles.currentPatchTile}` : ''}`}
          >
            {debug && <polygon className={styles.pentagonPatchFace} points={points} />}
            {tile.edges.map((edge) => (
              <g key={`${tile.id}:edge-${edge.edgeIndex}`}>
                {debug && tile.depth === 0 && (
                  <line
                    className={styles.pentagonPatchEdgeHit}
                    x1={edge.start.x}
                    y1={edge.start.y}
                    x2={edge.end.x}
                    y2={edge.end.y}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdgeSelect(edge.edgeIndex);
                    }}
                  />
                )}
                {debug && showEdgeDebug && (
                  <text
                    className={styles.pentagonPatchEdgeLabel}
                    x={edge.midpoint.x}
                    y={edge.midpoint.y}
                    textAnchor="middle"
                  >
                    e{edge.edgeIndex}:f{edge.neighborFaceIndex}
                  </text>
                )}
              </g>
            ))}
            {debug && showTileDebug && (
              <text
                className={styles.pentagonPatchFaceLabel}
                x={tile.centerPoint.x}
                y={tile.centerPoint.y + 18}
                textAnchor="middle"
              >
                f{tile.faceIndex} p:{tile.path.length > 0 ? tile.path.join('.') : 'center'}
              </text>
            )}
          </g>
        );
      })}
      {showGrid && uniqueCenterTiles.map((tile) => (
        <circle
          key={`center-${tile.id}`}
          className={`${styles.pentagonPatchCenterDot}${preview && !debug ? ` ${styles.previewPatchCenterDot}` : ''}`}
          cx={tile.centerPoint.x}
          cy={tile.centerPoint.y}
          r={currentTile && tile.id === currentTile.id ? 4.2 : 2.8}
        />
      ))}
      {debug && (
        <text className={styles.pentagonPatchCurrentLabel} x={0} y={-18} textAnchor="middle">
          current face {currentFaceIndex} / mirror node
        </text>
      )}
    </svg>
  );
}

function TopologyDebugOverlay({
  currentFaceIndex,
  currentFaceRotation,
  transition,
}: {
  currentFaceIndex: number;
  currentFaceRotation: number;
  transition: TopologyTransitionDebug | null;
}) {
  return (
    <aside className={styles.topologyDebug} aria-hidden="true">
      <div>currentFace: {currentFaceIndex}</div>
      <div>rotation: {(currentFaceRotation * 180 / Math.PI).toFixed(2)}deg</div>
      <div>crossedEdge: {transition?.crossedEdge ?? '-'}</div>
      <div>neighborFace: {transition?.neighborFace ?? '-'}</div>
      <div>backEdge: {transition?.backEdge ?? '-'}</div>
      <div>path: {transition?.path || 'center'}</div>
    </aside>
  );
}

function getPointKey(point: { x: number; y: number }): string {
  return `${Math.round(point.x * 1000) / 1000}:${Math.round(point.y * 1000) / 1000}`;
}

function getTileGeometryKey(tile: PlayPatchTile): string {
  return `${tile.faceIndex}:${getPointKey(tile.centerPoint)}`;
}

function getPatchEdgeKey(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const startKey = getPointKey(start);
  const endKey = getPointKey(end);
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function getUniquePatchEdges(tiles: PlayPatchTile[]): Array<{ key: string; start: { x: number; y: number }; end: { x: number; y: number } }> {
  const edges = new Map<string, { key: string; start: { x: number; y: number }; end: { x: number; y: number } }>();

  for (const tile of tiles) {
    for (const edge of tile.edges) {
      const key = getPatchEdgeKey(edge.start, edge.end);
      if (!edges.has(key)) {
        edges.set(key, {
          key,
          start: edge.start,
          end: edge.end,
        });
      }
    }
  }

  return [...edges.values()];
}

function getUniqueCenterTiles(tiles: PlayPatchTile[]): PlayPatchTile[] {
  const seen = new Set<string>();
  const uniqueTiles: PlayPatchTile[] = [];

  for (const tile of tiles) {
    const key = getTileGeometryKey(tile);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTiles.push(tile);
  }

  return uniqueTiles;
}

function getPentagonCentroid(vertices: Array<{ x: number; y: number }>): { x: number; y: number } {
  return vertices.reduce(
    (sum, vertex) => ({
      x: sum.x + vertex.x / vertices.length,
      y: sum.y + vertex.y / vertices.length,
    }),
    { x: 0, y: 0 },
  );
}

function auditPlayTopology(
  tiles: PlayPatchTile[],
  context: { mode: 'play' | 'overview'; currentNodeId: string },
) {
  if (typeof console === 'undefined') return;

  const edgeMap = new Map<string, Array<{ tileId: string; center: { x: number; y: number } }>>();
  const centerMap = new Map<string, PlayPatchTile[]>();
  const tileRows = tiles.map((tile) => {
    const edgeKeys = tile.edges.map((edge) => getPatchEdgeKey(edge.start, edge.end));
    const centroid = getPentagonCentroid(tile.vertices);
    const centroidError = Math.hypot(centroid.x - tile.centerPoint.x, centroid.y - tile.centerPoint.y);
    const centerKey = getPointKey(tile.centerPoint);
    centerMap.set(centerKey, [...(centerMap.get(centerKey) ?? []), tile]);

    tile.edges.forEach((edge, edgeIndex) => {
      const edgeKey = edgeKeys[edgeIndex];
      edgeMap.set(edgeKey, [
        ...(edgeMap.get(edgeKey) ?? []),
        { tileId: tile.id, center: tile.centerPoint },
      ]);
    });

    if (tile.vertices.length !== 5 || tile.edges.length !== 5) {
      console.warn('[topology-audit] invalid pentagon side count', {
        mode: context.mode,
        tileId: tile.id,
        faceIndex: tile.faceIndex,
        vertices: tile.vertices.length,
        edges: tile.edges.length,
      });
    }

    if (centroidError > 0.5) {
      console.warn('[topology-audit] black dot is not pentagon centroid', {
        mode: context.mode,
        tileId: tile.id,
        faceIndex: tile.faceIndex,
        center: tile.centerPoint,
        centroid,
        centroidError,
      });
    }

    return {
      tileId: tile.id,
      faceIndex: tile.faceIndex,
      center: getPointKey(tile.centerPoint),
      vertices: tile.vertices.map(getPointKey),
      edgeKeys,
      centroidError: Number(centroidError.toFixed(4)),
    };
  });

  for (const [centerKey, centerTiles] of centerMap) {
    if (centerTiles.length > 1) {
      console.warn('[topology-audit] duplicate tile center', {
        mode: context.mode,
        centerKey,
        tiles: centerTiles.map((tile) => ({
          tileId: tile.id,
          faceIndex: tile.faceIndex,
          path: tile.path,
        })),
      });
    }
  }

  const edgeRows = [...edgeMap.entries()].map(([edgeKey, connected]) => {
    if (connected.length !== 1 && connected.length !== 2) {
      console.warn('[topology-audit] invalid shared edge connection count', {
        mode: context.mode,
        edgeKey,
        connectedTileCount: connected.length,
        connectedCenters: connected.map((entry) => ({
          tileId: entry.tileId,
          center: getPointKey(entry.center),
        })),
      });
    }

    return {
      edgeKey,
      connectedTileCount: connected.length,
      connectedCenters: connected.map((entry) => `${entry.tileId}@${getPointKey(entry.center)}`),
    };
  });

  console.debug('[topology-audit] tiles', {
    mode: context.mode,
    currentNodeId: context.currentNodeId,
    tileCount: tiles.length,
    edgeCount: edgeRows.length,
    tiles: tileRows,
  });
  console.debug('[topology-audit] edges', {
    mode: context.mode,
    currentNodeId: context.currentNodeId,
    edges: edgeRows,
  });
}

function auditSnapSettle({
  label,
  startCenter,
  targetCenter,
  animationEndCenter,
  offset,
  displayScale,
  viewport,
}: {
  label: string;
  startCenter: { x: number; y: number };
  targetCenter: { x: number; y: number };
  animationEndCenter: { x: number; y: number };
  offset: { x: number; y: number };
  displayScale: number;
  viewport: { width: number; height: number };
}) {
  if (typeof console === 'undefined') return;

  const focus = getCameraFocusPoint(viewport, true);
  const finalScreenCenter = {
    x: offset.x + targetCenter.x * displayScale,
    y: offset.y + targetCenter.y * displayScale,
  };
  const finalScreenError = Math.hypot(finalScreenCenter.x - focus.x, finalScreenCenter.y - focus.y);
  const targetCenterDrift = Math.hypot(animationEndCenter.x - targetCenter.x, animationEndCenter.y - targetCenter.y);
  const payload = {
    label,
    snapStartCenter: startCenter,
    snapTargetCenter: targetCenter,
    animationEndCenter,
    finalScreenCenter,
    expectedScreenCenter: focus,
    finalScreenError,
    targetCenterDrift,
  };

  if (finalScreenError > 0.5 || targetCenterDrift > 0.5) {
    console.warn('[snap-audit] snap target drift or final center error', payload);
    return;
  }

  console.debug('[snap-audit] snap settled', payload);
}

function createOriginPlayNode(rotation = 0): PlayNodeRecord {
  return {
    id: ORIGIN_PLAY_NODE_ID,
    faceIndex: 0,
    rotation,
    center: { x: 0, y: 0 },
    entryChapter: null,
    edgeChapters: [...DODECAHEDRON_EDGE_CHAPTERS],
    links: {},
    parentNodeId: null,
    enteredFromEdge: null,
    enteredFromChapter: null,
    backEdgeIndex: null,
    createdOrder: 0,
  };
}

function createPlayPatchTiles({
  currentNode,
  playNodes,
  radius,
  previewMode = false,
  viewport = DEFAULT_VIEWPORT,
  offset = { x: DEFAULT_VIEWPORT.width / 2, y: DEFAULT_VIEWPORT.height / 2 },
  scale = 1,
}: {
  currentNode: PlayNodeRecord;
  playNodes: PlayNodeStore;
  radius: number;
  previewMode?: boolean;
  viewport?: { width: number; height: number };
  offset?: { x: number; y: number };
  scale?: number;
}): PlayPatchTile[] {
  const previewMaxDepth = getPreviewMaxDepth(scale);
  const previewMaxTiles = getPreviewMaxTiles(scale);
  const worldBounds = getVisibleWorldBounds(viewport, offset, scale, radius * 1.6);
  const centerTile = createPlayPatchTile({
    nodeId: currentNode.id,
    faceIndex: currentNode.faceIndex,
    path: [],
    parentFaceIndex: null,
    parentEdgeIndex: null,
    enteredFromEdge: null,
    center: currentNode.center,
    radius,
    rotation: currentNode.rotation,
    depth: 0,
    entryChapter: currentNode.entryChapter,
    edgeChapters: currentNode.edgeChapters,
    previewOnly: false,
  });
  const tiles: PlayPatchTile[] = [centerTile];
  const placedNodeIds = new Set([currentNode.id]);
  const placedTileKeys = new Set([getTileGeometryKey(centerTile)]);
  const queue: Array<{ node: PlayNodeRecord; tile: PlayPatchTile; path: number[] }> = [{
    node: currentNode,
    tile: centerTile,
    path: [],
  }];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;

    for (let edgeIndex = 0; edgeIndex < DODECAHEDRON_EDGE_CHAPTERS.length; edgeIndex += 1) {
      const chapter = item.node.edgeChapters[edgeIndex] ?? getDodecahedronEdgeChapter(edgeIndex);
      const linkedNodeId = item.node.links[edgeIndex] ?? null;
      const linkedNode = linkedNodeId ? playNodes[linkedNodeId] : null;

      if (!linkedNode) {
        if (!previewMode && item.node.id !== currentNode.id) continue;
        const previewTile = createNeighborPlayTile({
          parentNode: item.node,
          parentTile: item.tile,
          edgeIndex,
          chapter,
          linkedNode: null,
          path: [...item.path, edgeIndex],
          radius,
          previewOnly: item.node.id !== currentNode.id || previewMode,
        });
        const previewTileKey = getTileGeometryKey(previewTile);
        if (placedTileKeys.has(previewTileKey)) continue;
        if (previewMode && !isTileNearBounds(previewTile, worldBounds) && previewTile.depth > 1) continue;
        placedTileKeys.add(previewTileKey);
        tiles.push(previewTile);
        if (
          previewMode &&
          tiles.length < previewMaxTiles &&
          previewTile.depth < previewMaxDepth
        ) {
          queue.push({
            node: createPreviewPlayNodeFromTile(previewTile, item.node.id, edgeIndex, chapter),
            tile: previewTile,
            path: previewTile.path,
          });
        }
        continue;
      }

      if (placedNodeIds.has(linkedNode.id)) continue;

      const linkedTile = createNeighborPlayTile({
        parentNode: item.node,
        parentTile: item.tile,
        edgeIndex,
        chapter,
        linkedNode,
        path: [...item.path, edgeIndex],
        radius,
        previewOnly: false,
      });
      const linkedTileKey = getTileGeometryKey(linkedTile);
      if (placedTileKeys.has(linkedTileKey)) continue;
      placedNodeIds.add(linkedNode.id);
      placedTileKeys.add(linkedTileKey);
      tiles.push(linkedTile);
      queue.push({
        node: linkedNode,
        tile: linkedTile,
        path: linkedTile.path,
      });
    }
  }

  return tiles;
}

function createNeighborPlayTile({
  parentNode,
  parentTile,
  edgeIndex,
  chapter,
  linkedNode,
  path,
  radius,
  previewOnly,
}: {
  parentNode: PlayNodeRecord;
  parentTile: PlayPatchTile;
  edgeIndex: number;
  chapter: ChapterId;
  linkedNode: PlayNodeRecord | null;
  path: number[];
  radius: number;
  previewOnly: boolean;
}): PlayPatchTile {
  const neighborFaceIndex = linkedNode?.faceIndex ?? getNextDodecahedronFace(parentNode.faceIndex, chapter);
  const neighborEdgeIndex = linkedNode
    ? findLinkedEdgeIndex(linkedNode, parentNode.id) ?? linkedNode.backEdgeIndex ?? getPreferredEdgeIndexForChapter(chapter)
    : getPreferredEdgeIndexForChapter(chapter);
  const placement = placeNeighborPentagon(
    parentTile,
    edgeIndex,
    neighborFaceIndex,
    neighborEdgeIndex,
  );

  return createPlayPatchTile({
    nodeId: linkedNode?.id ?? null,
    faceIndex: neighborFaceIndex,
    path,
    parentFaceIndex: parentNode.faceIndex,
    parentEdgeIndex: edgeIndex,
    enteredFromEdge: neighborEdgeIndex,
    center: linkedNode?.center ?? placement.center,
    radius,
    rotation: linkedNode?.rotation ?? placement.rotation,
    depth: path.length,
    entryChapter: linkedNode?.entryChapter ?? chapter,
    edgeChapters: linkedNode?.edgeChapters ?? createPreviewEdgeChapters(chapter, neighborEdgeIndex),
    previewOnly,
  });
}

function createPlayPatchTile({
  nodeId,
  faceIndex,
  path,
  parentFaceIndex,
  parentEdgeIndex,
  enteredFromEdge,
  center,
  radius,
  rotation,
  depth,
  entryChapter,
  edgeChapters,
  previewOnly,
}: {
  nodeId: string | null;
  faceIndex: number;
  path: number[];
  parentFaceIndex: number | null;
  parentEdgeIndex: number | null;
  enteredFromEdge: number | null;
  center: { x: number; y: number };
  radius: number;
  rotation: number;
  depth: number;
  entryChapter: ChapterId | null;
  edgeChapters: ChapterId[];
  previewOnly: boolean;
}): PlayPatchTile {
  const vertices = getPentagonVertices(center, radius, rotation);
  const id = nodeId ?? `preview:${faceIndex}:${getPointKey(center)}`;
  const edges = vertices.map((vertex, edgeIndex) => {
    const end = vertices[(edgeIndex + 1) % DODECAHEDRON_EDGE_CHAPTERS.length];
    const chapter = edgeChapters[edgeIndex] ?? getDodecahedronEdgeChapter(edgeIndex);
    return {
      edgeIndex,
      chapter,
      start: vertex,
      end,
      midpoint: {
        x: (vertex.x + end.x) / 2,
        y: (vertex.y + end.y) / 2,
      },
      neighborFaceIndex: getNextDodecahedronFace(faceIndex, chapter),
      neighborEdgeIndex: getPreferredEdgeIndexForChapter(chapter),
    };
  });

  return {
    id,
    nodeId,
    faceIndex,
    path,
    parentFaceIndex,
    parentEdgeIndex,
    enteredFromEdge,
    localPosition: center,
    rotation,
    scale: 1,
    radius,
    depth,
    centerPoint: center,
    vertices,
    edges,
    entryChapter,
    edgeChapters,
    previewOnly,
  };
}

function createPreviewPlayNodeFromTile(
  tile: PlayPatchTile,
  parentNodeId: string,
  enteredFromEdge: number,
  enteredFromChapter: ChapterId,
): PlayNodeRecord {
  return {
    id: tile.id,
    faceIndex: tile.faceIndex,
    rotation: tile.rotation,
    center: tile.centerPoint,
    entryChapter: tile.entryChapter,
    edgeChapters: tile.edgeChapters,
    links: {},
    parentNodeId,
    enteredFromEdge,
    enteredFromChapter,
    backEdgeIndex: tile.enteredFromEdge,
    createdOrder: -tile.depth,
  };
}

function createCanonicalNeighborPlayGeometry({
  currentNode,
  edgeIndex,
  enteredFromChapter,
  radius,
}: {
  currentNode: PlayNodeRecord;
  edgeIndex: number;
  enteredFromChapter: ChapterId;
  radius: number;
}): { faceIndex: number; backEdgeIndex: number; center: { x: number; y: number }; rotation: number } {
  const faceIndex = getNextDodecahedronFace(currentNode.faceIndex, enteredFromChapter);
  const backEdgeIndex = getPreferredEdgeIndexForChapter(enteredFromChapter);
  const currentTile = createPlayPatchTile({
    nodeId: currentNode.id,
    faceIndex: currentNode.faceIndex,
    path: [],
    parentFaceIndex: null,
    parentEdgeIndex: null,
    enteredFromEdge: null,
    center: currentNode.center,
    radius,
    rotation: currentNode.rotation,
    depth: 0,
    entryChapter: currentNode.entryChapter,
    edgeChapters: currentNode.edgeChapters,
    previewOnly: false,
  });
  const placement = placeNeighborPentagon(
    currentTile,
    edgeIndex,
    faceIndex,
    backEdgeIndex,
  );

  return {
    faceIndex,
    backEdgeIndex,
    center: placement.center,
    rotation: placement.rotation,
  };
}

function getPlayTileCanonicalCenter(
  tile: PlayPatchTile,
  playNodes: PlayNodeStore,
): { x: number; y: number } {
  if (!tile.nodeId) return tile.centerPoint;
  return playNodes[tile.nodeId]?.center ?? tile.centerPoint;
}

function getPreviewMaxDepth(scale: number): number {
  if (scale < 0.42) return 2;
  if (scale < 0.68) return 3;
  if (scale < 0.95) return 3;
  return 2;
}

function getPreviewMaxTiles(scale: number): number {
  if (scale < 0.42) return 80;
  if (scale < 0.68) return 140;
  if (scale < 0.95) return 120;
  return 60;
}

function getVisibleWorldBounds(
  viewport: { width: number; height: number },
  offset: { x: number; y: number },
  scale: number,
  padding: number,
) {
  const safeScale = scale || 1;
  return {
    left: (0 - offset.x) / safeScale - padding,
    right: (viewport.width - offset.x) / safeScale + padding,
    top: (0 - offset.y) / safeScale - padding,
    bottom: (viewport.height - offset.y) / safeScale + padding,
  };
}

function isTileNearBounds(tile: PlayPatchTile, bounds: { left: number; right: number; top: number; bottom: number }) {
  return tile.centerPoint.x >= bounds.left &&
    tile.centerPoint.x <= bounds.right &&
    tile.centerPoint.y >= bounds.top &&
    tile.centerPoint.y <= bounds.bottom;
}

function createPlayNodeAfterTransition({
  currentNode,
  edgeIndex,
  nodeId,
  playNodes,
  radius,
  createdOrder,
}: {
  currentNode: PlayNodeRecord;
  edgeIndex: number;
  nodeId: string;
  playNodes: PlayNodeStore;
  radius: number;
  createdOrder: number;
}): { node: PlayNodeRecord; playNodes: PlayNodeStore } | null {
  const enteredFromChapter = currentNode.edgeChapters[edgeIndex] ?? getDodecahedronEdgeChapter(edgeIndex);
  const canonicalGeometry = createCanonicalNeighborPlayGeometry({
    currentNode,
    edgeIndex,
    enteredFromChapter,
    radius,
  });
  const edgeChapters: Array<ChapterId | null> = Array.from({ length: DODECAHEDRON_EDGE_CHAPTERS.length }, () => null);
  const links: Partial<Record<number, string>> = {
    [canonicalGeometry.backEdgeIndex]: currentNode.id,
  };
  edgeChapters[canonicalGeometry.backEdgeIndex] = enteredFromChapter;
  if (currentNode.links[edgeIndex] && currentNode.links[edgeIndex] !== nodeId) {
    return null;
  }

  const updatedPlayNodes: PlayNodeStore = {
    ...playNodes,
    [currentNode.id]: {
      ...currentNode,
      links: {
        ...currentNode.links,
        [edgeIndex]: nodeId,
      },
    },
  };

  for (const existingNode of Object.values(playNodes)) {
    if (existingNode.id === currentNode.id) continue;

    const sharedChapter = getChapterConnectingFaces(canonicalGeometry.faceIndex, existingNode.faceIndex);
    if (!sharedChapter || sharedChapter === enteredFromChapter) continue;

    const newEdgeIndex = getPreferredEdgeIndexForChapter(sharedChapter);
    const existingEdgeIndex = existingNode.edgeChapters.findIndex((chapter) => chapter === sharedChapter);
    if (existingEdgeIndex < 0) continue;
    if (!doesSharedEdgeAlign({
      existingNode,
      existingEdgeIndex,
      newFaceIndex: canonicalGeometry.faceIndex,
      newEdgeIndex,
      newCenter: canonicalGeometry.center,
      radius,
    })) continue;

    const existingLink = existingNode.links[existingEdgeIndex];
    if (existingLink && existingLink !== nodeId) return null;
    if (edgeChapters[newEdgeIndex] && edgeChapters[newEdgeIndex] !== sharedChapter) return null;

    edgeChapters[newEdgeIndex] = sharedChapter;
    links[newEdgeIndex] = existingNode.id;
    updatedPlayNodes[existingNode.id] = {
      ...existingNode,
      links: {
        ...existingNode.links,
        [existingEdgeIndex]: nodeId,
      },
    };
  }

  const filledEdgeChapters = fillRemainingEdgeChapters(edgeChapters, `${currentNode.id}:${edgeIndex}:${nodeId}`);
  if (!filledEdgeChapters) return null;

  const node: PlayNodeRecord = {
    id: nodeId,
    faceIndex: canonicalGeometry.faceIndex,
    rotation: canonicalGeometry.rotation,
    center: canonicalGeometry.center,
    entryChapter: enteredFromChapter,
    edgeChapters: filledEdgeChapters,
    links,
    parentNodeId: currentNode.id,
    enteredFromEdge: edgeIndex,
    enteredFromChapter,
    backEdgeIndex: canonicalGeometry.backEdgeIndex,
    createdOrder,
  };

  return {
    node,
    playNodes: {
      ...updatedPlayNodes,
      [node.id]: node,
    },
  };
}

function createPreviewEdgeChapters(sharedChapter: ChapterId, sharedEdgeIndex: number): ChapterId[] {
  const edgeChapters: Array<ChapterId | null> = Array.from({ length: DODECAHEDRON_EDGE_CHAPTERS.length }, () => null);
  edgeChapters[sharedEdgeIndex] = sharedChapter;
  return fillRemainingEdgeChapters(edgeChapters, `${sharedChapter}:${sharedEdgeIndex}:preview`) ?? [...DODECAHEDRON_EDGE_CHAPTERS];
}

function doesSharedEdgeAlign({
  existingNode,
  existingEdgeIndex,
  newFaceIndex,
  newEdgeIndex,
  newCenter,
  radius,
}: {
  existingNode: PlayNodeRecord;
  existingEdgeIndex: number;
  newFaceIndex: number;
  newEdgeIndex: number;
  newCenter: { x: number; y: number };
  radius: number;
}): boolean {
  const existingTile = createPlayPatchTile({
    nodeId: existingNode.id,
    faceIndex: existingNode.faceIndex,
    path: [],
    parentFaceIndex: null,
    parentEdgeIndex: null,
    enteredFromEdge: null,
    center: existingNode.center,
    radius,
    rotation: existingNode.rotation,
    depth: 0,
    entryChapter: existingNode.entryChapter,
    edgeChapters: existingNode.edgeChapters,
    previewOnly: false,
  });
  const placement = placeNeighborPentagon(
    existingTile,
    existingEdgeIndex,
    newFaceIndex,
    newEdgeIndex,
  );
  return Math.hypot(
    placement.center.x - newCenter.x,
    placement.center.y - newCenter.y,
  ) <= radius * 0.08;
}

function fillRemainingEdgeChapters(edgeChapters: Array<ChapterId | null>, seed: string): ChapterId[] | null {
  const usedChapters = new Set(edgeChapters.filter((chapter): chapter is ChapterId => Boolean(chapter)));
  const remainingChapters = seededShuffle(
    DODECAHEDRON_EDGE_CHAPTERS.filter((chapter) => !usedChapters.has(chapter)),
    seed,
  );
  let remainingIndex = 0;

  for (let index = 0; index < edgeChapters.length; index += 1) {
    if (!edgeChapters[index]) {
      edgeChapters[index] = remainingChapters[remainingIndex] ?? getDodecahedronEdgeChapter(index);
      remainingIndex += 1;
    }
  }

  return edgeChapters as ChapterId[];
}

function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  let state = hashString(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getDeterministicProbability(seed: string): number {
  return hashString(seed) / 0xffffffff;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getPreviewVisualState(scale: number, enabled: boolean): { titleOpacity: number; lineOpacity: number; pointOpacity: number } {
  if (!enabled) {
    return {
      titleOpacity: 1,
      lineOpacity: 0,
      pointOpacity: 0,
    };
  }

  const titleOpacity = smoothstep(0.96, 1.24, scale);
  const lineIn = smoothstep(0.34, 0.52, scale);
  const lineOut = smoothstep(0.88, 1.12, scale);
  const pointOut = smoothstep(1.02, 1.22, scale);

  return {
    titleOpacity,
    lineOpacity: Math.max(0, Math.min(0.62, lineIn * (1 - lineOut) * 0.62)),
    pointOpacity: Math.max(0.16, 1 - pointOut * 0.68),
  };
}

function getGateIdForPlayNodeEdge(nodeId: string, edgeIndex: number, chapterId: ChapterId): string {
  return `${nodeId}:edge:${edgeIndex}:${chapterId}`;
}

function getNewGateIdsForPlayNode(node: PlayNodeRecord): string[] {
  return node.edgeChapters.flatMap((chapter, edgeIndex) => {
    if (node.links[edgeIndex]) return [];
    return [getGateIdForPlayNodeEdge(node.id, edgeIndex, chapter)];
  });
}

function createTopologyNodeFromTile(
  tile: PlayPatchTile,
  playNodes?: PlayNodeStore,
): { tile: PlayPatchTile; node: ExplorationNode } {
  const position = playNodes ? getPlayTileCanonicalCenter(tile, playNodes) : tile.centerPoint;
  const coord = {
    q: tile.path.reduce((sum, edgeIndex, index) => sum + edgeIndex * (index + 1), 0),
    r: tile.depth,
  };

  return {
    tile,
    node: {
      key: tile.id,
      id: tile.id,
      coord,
      chapterType: tile.entryChapter,
      enteredFrom: tile.parentEdgeIndex === null ? null : NODE_DIRECTIONS[tile.parentEdgeIndex],
      parentNodeId: tile.parentFaceIndex === null ? null : `${tile.parentFaceIndex}:${tile.path.slice(0, -1).join('-') || 'center'}`,
      chaptersByDirection: createChapterAssignmentFromIds(tile.edgeChapters),
      position,
    },
  };
}

function createTopologyGates(tiles: PlayPatchTile[], settings: PrototypeSettings): TopologyGate[] {
  const seen = new Set<string>();

  return tiles
    .filter((tile) => tile.nodeId !== null)
    .flatMap((tile) => tile.edges.flatMap((edge) => {
      const direction = NODE_DIRECTIONS[edge.edgeIndex];
      const chapter = getChapterConfig(edge.chapter);
      const outward = normalizePoint({
        x: edge.midpoint.x - tile.centerPoint.x,
        y: edge.midpoint.y - tile.centerPoint.y,
      });
      const chapterOffset = getChapterOffset(direction, settings);
      const titleOffset = getChapterTitleOffset(chapter.id, settings);
      const x = edge.midpoint.x + outward.x * settings.chapterEdgeOffset + chapterOffset.x + titleOffset.x;
      const y = edge.midpoint.y + outward.y * settings.chapterEdgeOffset + chapterOffset.y + titleOffset.y;
      const dedupeKey = `${chapter.id}:${Math.round(edge.midpoint.x * 100) / 100}:${Math.round(edge.midpoint.y * 100) / 100}`;

      if (seen.has(dedupeKey)) {
        return [];
      }
      seen.add(dedupeKey);

      return {
        id: `${tile.id}:gate-${edge.edgeIndex}`,
        stableId: getGateIdForPlayNodeEdge(tile.id, edge.edgeIndex, chapter.id),
        tileId: tile.id,
        previewOnly: tile.previewOnly,
        depth: tile.depth,
        direction,
        edgeIndex: edge.edgeIndex,
        chapter,
        x,
        y,
        revealIndex: edge.edgeIndex,
      };
    }));
}

function getNearestTopologyChapterNode(
  offset: { x: number; y: number },
  viewport: { width: number; height: number },
  scale: number,
  tiles: PlayPatchTile[],
  playNodes: PlayNodeStore,
): ExplorationNode | null {
  const focus = getCameraFocusPoint(viewport, true);
  const centerWorld = {
    x: (focus.x - offset.x) / scale,
    y: (focus.y - offset.y) / scale,
  };
  let nearest: { node: ExplorationNode; distance: number } | null = null;

  for (const tile of tiles) {
    if (tile.nodeId === null) continue;
    const { node } = createTopologyNodeFromTile(tile, playNodes);
    if (!node.chapterType || node.chapterType === 'home') continue;
    const distance = Math.hypot(node.position.x - centerWorld.x, node.position.y - centerWorld.y) * scale;
    if (distance > ACTIVE_SNAP_DISTANCE * 1.8) continue;
    if (!nearest || distance < nearest.distance) {
      nearest = { node, distance };
    }
  }

  return nearest?.node ?? null;
}

function findPlaySnapTile({
  offset,
  velocity,
  viewport,
  scale,
  tiles,
  playNodes,
}: {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  viewport: { width: number; height: number };
  scale: number;
  tiles: PlayPatchTile[];
  playNodes: PlayNodeStore;
}): PlayPatchTile | null {
  const projectedDelta = {
    x: velocity.x * RELEASE_PROJECTION_MS,
    y: velocity.y * RELEASE_PROJECTION_MS,
  };
  const projectedDistance = Math.hypot(projectedDelta.x, projectedDelta.y);
  const projectionLimit = SNAP_MAX_DISTANCE;
  const projectionScale = projectedDistance > projectionLimit && projectedDistance > 0
    ? projectionLimit / projectedDistance
    : 1;
  const projectedOffset = {
    x: offset.x + projectedDelta.x * projectionScale,
    y: offset.y + projectedDelta.y * projectionScale,
  };
  const focus = getCameraFocusPoint(viewport, true);
  const centerWorld = {
    x: (focus.x - projectedOffset.x) / scale,
    y: (focus.y - projectedOffset.y) / scale,
  };

  let nearest: { tile: PlayPatchTile; distance: number; rank: number } | null = null;

  for (const tile of tiles) {
    if (tile.depth > PLAY_PATCH_DEPTH) continue;
    const center = getPlayTileCanonicalCenter(tile, playNodes);

    const distance = Math.hypot(
      center.x - centerWorld.x,
      center.y - centerWorld.y,
    );
    const rank = tile.nodeId === null ? 1 : 0;

    if (
      !nearest ||
      distance < nearest.distance - 0.001 ||
      (Math.abs(distance - nearest.distance) <= 0.001 && rank < nearest.rank)
    ) {
      nearest = { tile, distance, rank };
    }
  }

  return nearest?.tile ?? null;
}

function getPreferredEdgeIndexForChapter(chapter: ChapterId): number {
  const index = DODECAHEDRON_EDGE_CHAPTERS.findIndex((candidate) => candidate === chapter);
  return index >= 0 ? index : 0;
}

function findLinkedEdgeIndex(node: PlayNodeRecord, targetNodeId: string): number | null {
  for (const [edgeIndex, linkedNodeId] of Object.entries(node.links)) {
    if (linkedNodeId === targetNodeId) {
      return Number(edgeIndex);
    }
  }
  return null;
}

function getChapterConnectingFaces(faceIndex: number, targetFaceIndex: number): ChapterId | null {
  return DODECAHEDRON_EDGE_CHAPTERS.find((chapter) => (
    getNextDodecahedronFace(faceIndex, chapter) === targetFaceIndex
  )) ?? null;
}

function getChapterConfig(chapterId: ChapterId): ChapterConfig {
  return CHAPTERS.find((chapter) => chapter.id === chapterId) ?? CHAPTERS[0];
}

function createChapterAssignmentFromIds(edgeChapters: ChapterId[]): Record<NodeDirection, ChapterConfig> {
  return Object.fromEntries(NODE_DIRECTIONS.map((direction, edgeIndex) => [
    direction,
    getChapterConfig(edgeChapters[edgeIndex] ?? getDodecahedronEdgeChapter(edgeIndex)),
  ])) as Record<NodeDirection, ChapterConfig>;
}

function normalizePoint(point: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(point.x, point.y);
  if (length === 0) return { x: 0, y: 0 };
  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function MapNode({
  node,
  current,
  snapped,
  revealing,
  introAnimated,
  introOrigin,
  mirrorOpened,
  cameraStarted,
  cameraError,
  videoRef,
  onOpenMirror,
  onStartCamera,
  activeMirrorChapterType,
  dimensionCameraStarted,
  dimensionCameraError,
  dimensionPhase,
  dimensionVideoRef,
  dimensionCanvasRef,
  onStartDimensionCamera,
  onChangeCamera,
  onChapterNodeClick,
  showDots,
  settings,
  flickerTime,
  previewOnly,
}: {
  node: ExplorationNode;
  current: boolean;
  snapped: boolean;
  revealing: boolean;
  introAnimated: boolean;
  introOrigin: boolean;
  mirrorOpened: boolean;
  cameraStarted: boolean;
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onOpenMirror: () => void;
  onStartCamera: () => void;
  activeMirrorChapterType: ChapterId | null;
  dimensionCameraStarted: boolean;
  dimensionCameraError: string | null;
  dimensionPhase: DimensionPhase;
  dimensionVideoRef: RefObject<HTMLVideoElement | null>;
  dimensionCanvasRef: RefObject<HTMLCanvasElement | null>;
  onStartDimensionCamera: () => void;
  onChangeCamera: () => void;
  onChapterNodeClick?: (node: ExplorationNode) => void;
  showDots: boolean;
  settings: PrototypeSettings;
  flickerTime: number;
  previewOnly: boolean;
}) {
  const mirrorOpacity = getMirrorOpacity(node.coord, settings, flickerTime);
  const showIntroMirror = !previewOnly && introOrigin && mirrorOpened;
  const showDimensionMirror = !previewOnly && activeMirrorChapterType === 'dimension';
  const isChapterNode = Boolean(node.chapterType && node.chapterType !== 'home');
  const canClickChapterNode = Boolean(onChapterNodeClick && isChapterNode);

  return (
    <section
      className={`${styles.node}${current ? ` ${styles.currentNode}` : ''}${snapped ? ` ${styles.snappedNode}` : ''}${revealing ? ` ${styles.revealingNode}` : ''}`}
      style={{
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
      }}
      aria-label={`node ${node.coord.q}, ${node.coord.r}`}
    >
      {showIntroMirror && (
        <IntroMirror
          cameraStarted={cameraStarted}
          cameraError={cameraError}
          videoRef={videoRef}
          onStartCamera={onStartCamera}
        />
      )}
      {showDimensionMirror && (
        <DimensionMirror
          cameraStarted={dimensionCameraStarted}
          cameraError={dimensionCameraError}
          phase={dimensionPhase}
          videoRef={dimensionVideoRef}
          canvasRef={dimensionCanvasRef}
          onStartCamera={onStartDimensionCamera}
          onChangeCamera={onChangeCamera}
        />
      )}
      {!previewOnly && !showIntroMirror && !showDimensionMirror && settings.showMirror && (
        <img
          className={styles.mirror}
          src="/Mirror.png"
          alt=""
          draggable={false}
          style={{ opacity: mirrorOpacity }}
        />
      )}
      {showDots && !showIntroMirror && !showDimensionMirror && (
        introOrigin ? (
          <button
            type="button"
            className={`${styles.introDotButton}${introAnimated ? ` ${styles.introDotAnimated}` : ''}`}
            onClick={onOpenMirror}
            aria-label="Open intro mirror"
          >
            <svg className={styles.dot} viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r={current ? 7 : 6.5} />
            </svg>
          </button>
        ) : canClickChapterNode ? (
          <button
            type="button"
            className={`${styles.nodeDotButton}${node.chapterType === 'alphabet' ? ` ${styles.alphabetNodeButton}` : ''}`}
            data-noise-chapter={node.chapterType}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onChapterNodeClick?.(node);
            }}
            aria-label={`${node.chapterType} node`}
          >
            <svg className={`${styles.dot}${introAnimated ? ` ${styles.introDotAnimated}` : ''}`} viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r={current ? 7 : 6.5} />
            </svg>
          </button>
        ) : (
          <svg
            className={`${styles.dot}${introAnimated ? ` ${styles.introDotAnimated}` : ''}`}
            data-noise-chapter={node.chapterType ?? undefined}
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r={current ? 7 : 6.5} />
          </svg>
        )
      )}
    </section>
  );
}

function IntroMirror({
  cameraStarted,
  cameraError,
  videoRef,
  onStartCamera,
}: {
  cameraStarted: boolean;
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onStartCamera: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.introMirror}
      onClick={onStartCamera}
      aria-label={cameraStarted ? 'Intro mirror camera active' : 'Start intro mirror camera'}
    >
      {cameraStarted && (
        <div className={styles.introMirrorVideoMask}>
          <video
            ref={videoRef}
            className={styles.introMirrorVideo}
            autoPlay
            playsInline
            muted
          />
        </div>
      )}
      <img
        className={styles.introMirrorImage}
        src={cameraStarted ? '/Mirror-frame.png' : '/Mirror.png'}
        alt=""
        draggable={false}
      />
      {cameraError && (
        <span className={styles.introCameraError}>{cameraError}</span>
      )}
    </button>
  );
}

function DimensionMirror({
  cameraStarted,
  cameraError,
  phase,
  videoRef,
  canvasRef,
  onStartCamera,
  onChangeCamera,
}: {
  cameraStarted: boolean;
  cameraError: string | null;
  phase: DimensionPhase;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStartCamera: () => void;
  onChangeCamera: () => void;
}) {
  const showMosaic = phase === 'mosaic' && cameraStarted;
  const showCameraUnavailable = phase === 'camera-unavailable';

  return (
    <button
      type="button"
      className={`${styles.introMirror} ${styles.dimensionMirror}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (showCameraUnavailable) {
          onStartCamera();
        }
      }}
      aria-label={showMosaic ? 'Dimension mosaic mirror active' : 'Dimension mirror waiting for wave'}
    >
      <div className={styles.introMirrorVideoMask}>
        {showMosaic ? (
          <canvas ref={canvasRef} className={styles.dimensionMirrorCanvas} />
        ) : (
          <div className={styles.dimensionMirrorBlank} aria-hidden="true" />
        )}
      </div>
      {showCameraUnavailable && (
        <div className={styles.introMirrorVideoMask}>
          <span className={styles.dimensionCameraUnavailable}>
            摄像头未开启，无法识别挥手。
            <br />
            Camera is not available.
          </span>
        </div>
      )}
      <video ref={videoRef} className={styles.dimensionHiddenVideo} autoPlay playsInline muted />
      <img
        className={styles.introMirrorImage}
        src="/Mirror-frame.png"
        alt=""
        draggable={false}
      />
      {cameraError && !showCameraUnavailable && (
        <span className={styles.introCameraError}>{cameraError}</span>
      )}
    </button>
  );
}

function CameraSelectionPanel({
  mode,
  devices,
  selectedDeviceId,
  cameraState,
  cameraError,
  cameraDeviceStatus,
  onSelectedDeviceChange,
  onContinue,
  onUseSelected,
  onUseDefault,
  onRefreshDevices,
  onClose,
}: {
  mode: CameraPanelMode;
  devices: CameraDeviceOption[];
  selectedDeviceId: string;
  cameraState: CameraState;
  cameraError: string | null;
  cameraDeviceStatus: string;
  onSelectedDeviceChange: (deviceId: string) => void;
  onContinue: () => void;
  onUseSelected: () => void;
  onUseDefault: () => void;
  onRefreshDevices: () => void;
  onClose: () => void;
}) {
  const requesting = cameraState === 'requesting';

  return (
    <div
      className={styles.cameraSelectionOverlay}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'continuity-tip' ? 'Use iPhone as camera' : 'Choose Camera'}
    >
      <section className={styles.cameraSelectionPanel}>
        {mode === 'continuity-tip' ? (
          <>
            <h2>推荐使用 iPhone 摄像头</h2>
            <ol>
              <li>打开 iPhone 设置 → 通用 → AirPlay 与连续互通 → 开启连续互通摄像头。</li>
              <li>确保 Mac 和 iPhone 使用同一个 Apple ID。</li>
              <li>打开 Wi-Fi 和蓝牙。</li>
              <li>让 iPhone 靠近 Mac。</li>
              <li>在浏览器摄像头权限里选择 iPhone / Continuity Camera。</li>
            </ol>
            <p>
              Use iPhone as camera: Enable Continuity Camera on iPhone, keep Wi-Fi and Bluetooth on,
              place iPhone near your Mac, then select iPhone / Continuity Camera as the video input.
            </p>
            <div className={styles.cameraSelectionActions}>
              <button type="button" onClick={onContinue} disabled={requesting}>
                继续选择摄像头
                <br />
                Continue to camera selection
              </button>
              <button type="button" onClick={onClose} disabled={requesting}>
                稍后
                <br />
                Later
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>选择摄像头</h2>
            <p>
              如果你正在使用 Mac，可以优先选择 iPhone / Continuity Camera。
              <br />
              If you are on Mac, choose iPhone / Continuity Camera if available.
            </p>
            <select
              value={selectedDeviceId}
              onChange={(event) => onSelectedDeviceChange(event.target.value)}
              disabled={requesting || devices.length === 0}
            >
              {devices.length ? devices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              )) : (
                <option value="">Camera 1</option>
              )}
            </select>
            {cameraDeviceStatus && <p className={styles.cameraDeviceStatus}>{cameraDeviceStatus}</p>}
            {cameraError && <p className={styles.cameraSelectionError}>{cameraError}</p>}
            <div className={styles.cameraSelectionActions}>
              <button type="button" onClick={onUseSelected} disabled={requesting || !selectedDeviceId}>
                使用此摄像头
                <br />
                Use this camera
              </button>
              <button type="button" onClick={onUseDefault} disabled={requesting}>
                使用默认摄像头
                <br />
                Use default camera
              </button>
              <button type="button" onClick={onRefreshDevices} disabled={requesting}>
                刷新摄像头列表
                <br />
                Refresh cameras
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function AlphabetExperience({
  onClose,
  onEnterNoclipping,
}: {
  onClose: () => void;
  onEnterNoclipping: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const attachEscapeHandler = useCallback(() => {
    const iframe = iframeRef.current;
    const iframeWindow = iframe?.contentWindow;
    if (!iframeWindow) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    iframeWindow.addEventListener('keydown', onKeyDown, true);
    return () => iframeWindow.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    return attachEscapeHandler();
  }, [attachEscapeHandler]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'alphabet:enter-noclipping') {
        onEnterNoclipping();
        return;
      }
      if (event.data?.type === 'alphabet:return-home') {
        onClose();
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onClose, onEnterNoclipping]);

  return (
    <section
      className={styles.alphabetOverlay}
      aria-label="Alphabet experience"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <iframe
        ref={iframeRef}
        className={styles.alphabetFrame}
        src={chapterRoutes.alphabet ?? ''}
        title="Alphabet"
        onLoad={attachEscapeHandler}
      />
    </section>
  );
}

function NoclippingExperience({
  viewport,
  settings,
  adPreview = false,
  onReady,
}: {
  viewport: { width: number; height: number };
  settings: PrototypeSettings;
  adPreview?: boolean;
  onReady?: () => void;
}) {
  const [scrollY, setScrollY] = useState(0);
  const [bandCount, setBandCount] = useState(36);
  const [adState, setAdState] = useState<NoclipAdState | null>(null);
  const [adCopyIndex, setAdCopyIndex] = useState(0);
  const [adVideoIndex, setAdVideoIndex] = useState(0);
  const [adEntryEdgeIndex, setAdEntryEdgeIndex] = useState(0);
  const [adCueIndex, setAdCueIndex] = useState(0);
  const overlayRef = useRef<HTMLElement | null>(null);
  const explosionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const explosionFrameRef = useRef<number | null>(null);
  const hoverUntilRef = useRef(0);
  const wheelSlowdownRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const explosionLastFrameTimeRef = useRef<number | null>(null);
  const fallYRef = useRef(0);
  const currentSpeedRef = useRef(Math.min(settings.noclipNormalFallSpeed, 32));
  const noclippingStartedAtRef = useRef(0);
  const nextAdAtRef = useRef(0);
  const adStateRef = useRef<NoclipAdState | null>(null);
  const adEnterTimerRef = useRef<number | null>(null);
  const adPlayTimerRef = useRef<number | null>(null);
  const adExitTimerRef = useRef<number | null>(null);
  const adAudioStopTimerRef = useRef<number | null>(null);
  const adVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const adMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const adAnnouncementAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const adMusicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const adAnnouncementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const adMusicGainRef = useRef<GainNode | null>(null);
  const adAnnouncementGainRef = useRef<GainNode | null>(null);
  const currentGainRef = useRef(0);
  const currentAdMusicGainRef = useRef(0);
  const currentAdAnnouncementGainRef = useRef(0);
  const backgroundGainTargetRef = useRef(0);
  const adRunIdRef = useRef(0);
  const adSequenceIndexRef = useRef(0);
  const explosionImagesRef = useRef<HTMLImageElement[]>([]);
  const explosionLoadedIndexesRef = useRef<number[]>([]);
  const explosionDotsRef = useRef<NoclipExplosionDot[]>([]);
  const lastDotScanAtRef = useRef(0);
  const explosionParticlesRef = useRef<NoclipExplosionParticle[]>([]);
  const explosionParticlePoolRef = useRef<NoclipExplosionParticle[]>([]);
  const activatedDotsRef = useRef<Set<string>>(new Set());
  const explosionComboRef = useRef(0);
  const lastExplosionAtRef = useRef(0);
  const viewportHeight = viewport.height || 900;
  const viewportWidth = viewport.width || 1440;
  const isMobile = viewportWidth <= 768;
  const bandHeight = Math.max(180, (viewportHeight * 0.5) / settings.noclipImageDensity);
  const visibleStart = Math.max(0, Math.floor((scrollY - viewportHeight * 1.4) / bandHeight));
  const visibleEnd = Math.min(bandCount, Math.ceil((scrollY + viewportHeight * 3.6) / bandHeight));
  const visibleItems = Array.from({ length: Math.max(0, visibleEnd - visibleStart) }, (_, offset) => visibleStart + offset);
  const clearAdTimers = () => {
    [adEnterTimerRef, adPlayTimerRef, adExitTimerRef, adAudioStopTimerRef].forEach((timerRef) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });
  };
  const getAdCopy = (index: number) => noclippingAdCopy[
    ((index % noclippingAdCopy.length) + noclippingAdCopy.length) % noclippingAdCopy.length
  ] ?? noclippingAdCopy[0];
  const getCatalogueVideo = (index: number) => {
    if (!noclippingCatalogueVideos.length) return null;
    return noclippingCatalogueVideos[
      ((index % noclippingCatalogueVideos.length) + noclippingCatalogueVideos.length) % noclippingCatalogueVideos.length
    ] ?? noclippingCatalogueVideos[0];
  };
  const getAdImageSequence = (groupIndex: number) => {
    if (!noclippingMirrorProductCrops.length) return [];
    const group = NOCLIP_AD_IMAGE_GROUPS[
      ((groupIndex % NOCLIP_AD_IMAGE_GROUPS.length) + NOCLIP_AD_IMAGE_GROUPS.length) % NOCLIP_AD_IMAGE_GROUPS.length
    ] ?? NOCLIP_AD_IMAGE_GROUPS[0];

    return group
      .map((imageIndex) => noclippingMirrorProductCrops[imageIndex % noclippingMirrorProductCrops.length])
      .filter((image): image is NoclippingMirrorProductCrop => Boolean(image));
  };
  const getAdVisual = (index: number): NoclipAdVisual => {
    const slot = ((index % closingAnnouncementOrder.length) + closingAnnouncementOrder.length) % closingAnnouncementOrder.length;

    if (slot === 0) {
      return { video: getCatalogueVideo(0), imageSequence: [] };
    }
    if (slot === 2) {
      return { video: getCatalogueVideo(1), imageSequence: [] };
    }

    const imageGroupIndex = slot === 1 ? 0 : slot === 3 ? 1 : 2;
    return {
      video: null,
      imageSequence: getAdImageSequence(imageGroupIndex),
    };
  };
  const getEntryEdge = (index: number) => NOCLIP_AD_ENTRY_EDGES[
    ((index % NOCLIP_AD_ENTRY_EDGES.length) + NOCLIP_AD_ENTRY_EDGES.length) % NOCLIP_AD_ENTRY_EDGES.length
  ] ?? NOCLIP_AD_ENTRY_EDGES[0];
  const getAdCue = (index: number) => getNoclippingAdAudioCue(closingAnnouncementOrder[
    ((index % closingAnnouncementOrder.length) + closingAnnouncementOrder.length) % closingAnnouncementOrder.length
  ] ?? closingAnnouncementOrder[0]);
  const getFallIntervalSeconds = (index: number) => (
    NOCLIP_AD_FALL_INTERVALS[Math.min(index, NOCLIP_AD_FALL_INTERVALS.length - 1)] ?? NOCLIP_AD_FALL_INTERVALS[0]
  );

  const rampGain = (
    gain: GainNode | null,
    currentRef: { current: number },
    target: number,
    seconds: number,
  ) => {
    const audioContext = audioContextRef.current;
    if (!audioContext || !gain) return;
    const now = audioContext.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(currentRef.current, now);
    gain.gain.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
    currentRef.current = target;
  };

  const stopAdAudio = (rampSeconds = NOCLIP_AD_GAIN_RAMP_OUT) => {
    rampGain(adMusicGainRef.current, currentAdMusicGainRef, 0, rampSeconds);
    rampGain(adAnnouncementGainRef.current, currentAdAnnouncementGainRef, 0, rampSeconds);
    if (adAudioStopTimerRef.current !== null) {
      window.clearTimeout(adAudioStopTimerRef.current);
    }
    adAudioStopTimerRef.current = window.setTimeout(() => {
      [adMusicAudioRef.current, adAnnouncementAudioRef.current].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
      });
      adAudioStopTimerRef.current = null;
    }, rampSeconds * 1000);
  };

  const playAdAudio = (cue: NoclippingAdAudioCue) => {
    audioContextRef.current?.resume().catch(() => {});

    const playable = [
      { audio: adMusicAudioRef.current, src: cue.musicSrc },
      { audio: adAnnouncementAudioRef.current, src: cue.announcementSrc },
    ];

    playable.forEach(({ audio, src }) => {
      if (!audio || !src) return;
      if (audio.src !== window.location.origin + src) {
        audio.src = src;
      }
      audio.playbackRate = audio === adAnnouncementAudioRef.current ? cue.playbackRate : 1;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });

    rampGain(adMusicGainRef.current, currentAdMusicGainRef, cue.musicSrc ? NOCLIP_AD_GAIN : 0, NOCLIP_AD_GAIN_RAMP_IN);
    rampGain(
      adAnnouncementGainRef.current,
      currentAdAnnouncementGainRef,
      cue.announcementSrc ? NOCLIP_AD_GAIN : 0,
      NOCLIP_AD_GAIN_RAMP_IN,
    );
  };

  const scheduleAdPlayback = (enteringState: NoclipAdState, enterSeconds = NOCLIP_AD_ENTRY_DURATION) => {
    adEnterTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const durationMs = await resolveAdDurationMs(enteringState.cue);
        if (adStateRef.current?.runId !== enteringState.runId) return;
        const playStartedAt = performance.now();
        const playingStatePatch = {
          phase: 'playing' as const,
          playStartedAt,
          duration: durationMs / 1000,
          durationMs,
        };
        setAdState((current) => (
          current?.runId === enteringState.runId
            ? { ...current, ...playingStatePatch }
            : current
        ));
        adStateRef.current = adStateRef.current?.runId === enteringState.runId
          ? { ...adStateRef.current, ...playingStatePatch }
          : adStateRef.current;
        playAdAudio(enteringState.cue);

        adPlayTimerRef.current = window.setTimeout(() => {
          setAdState((current) => (
            current?.runId === enteringState.runId
              ? { ...current, phase: 'exiting' }
              : current
          ));
          adStateRef.current = adStateRef.current?.runId === enteringState.runId
            ? { ...adStateRef.current, phase: 'exiting' }
            : adStateRef.current;
          stopAdAudio();

          adExitTimerRef.current = window.setTimeout(() => {
            setAdState((current) => (current?.runId === enteringState.runId ? null : current));
            if (adStateRef.current?.runId === enteringState.runId) {
              adStateRef.current = null;
            }
            if (!enteringState.preview) {
              nextAdAtRef.current = performance.now() + getFallIntervalSeconds(adSequenceIndexRef.current) * 1000;
            }
          }, NOCLIP_AD_EXIT_DURATION * 1000);
        }, durationMs);
      })();
    }, enterSeconds * 1000);
  };

  const skipCurrentAd = () => {
    const current = adStateRef.current;
    if (!current || current.phase !== 'playing') return;

    if (adPlayTimerRef.current !== null) {
      window.clearTimeout(adPlayTimerRef.current);
      adPlayTimerRef.current = null;
    }
    if (adExitTimerRef.current !== null) {
      window.clearTimeout(adExitTimerRef.current);
      adExitTimerRef.current = null;
    }

    setAdState((state) => (
      state?.runId === current.runId
        ? { ...state, phase: 'exiting' }
        : state
    ));
    adStateRef.current = { ...current, phase: 'exiting' };
    stopAdAudio(0.22);

    adExitTimerRef.current = window.setTimeout(() => {
      setAdState((state) => (state?.runId === current.runId ? null : state));
      if (adStateRef.current?.runId === current.runId) {
        adStateRef.current = null;
      }
      if (!current.preview) {
        nextAdAtRef.current = performance.now() + getFallIntervalSeconds(adSequenceIndexRef.current) * 1000;
      }
    }, NOCLIP_AD_EXIT_DURATION * 1000);
  };

  const startAdPreview = (
    copyIndex = adCopyIndex,
    videoIndex = adVideoIndex,
    entryEdgeIndex = adEntryEdgeIndex,
    cueIndex = adCueIndex,
  ) => {
    const now = performance.now();
    const visual = getAdVisual(cueIndex);
    const video = visual.video ?? (visual.imageSequence.length ? null : getCatalogueVideo(videoIndex));
    const cue = getAdCue(cueIndex);
    const previewState: NoclipAdState = {
      phase: 'entering',
      video,
      imageSequence: visual.imageSequence,
      startedAt: now,
      playStartedAt: null,
      duration: cue.duration,
      durationMs: Math.max(1, Math.round(cue.duration * 1000)),
      preview: true,
      prompt: getAdCopy(copyIndex),
      cue,
      entryEdge: getEntryEdge(entryEdgeIndex),
      runId: adRunIdRef.current + 1,
    };

    adRunIdRef.current = previewState.runId;
    clearAdTimers();
    stopAdAudio(0.18);
    setAdState(previewState);
    adStateRef.current = previewState;
    scheduleAdPlayback(previewState);
  };

  const getExplosionParticle = (): NoclipExplosionParticle => (
    explosionParticlePoolRef.current.pop() ?? {
      active: false,
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0,
      imageIndex: 0,
      bornAt: 0,
      lifeMs: 4200,
      settleMs: 900,
      rotation: 0,
      spin: 0,
      scale: 1,
      endScale: 1,
      opacity: 1,
    }
  );

  const recycleExplosionParticle = (particle: NoclipExplosionParticle) => {
    particle.active = false;
    explosionParticlePoolRef.current.push(particle);
  };

  const scanVisibleMirrorDots = () => {
    if (typeof document === 'undefined') return;
    const selectors = [
      `.${styles.nodeDotButton}`,
      `.${styles.introDotButton}`,
      `.${styles.pentagonPatchCenterDot}`,
      `.${styles.dot}`,
    ];
    const seen = new Set<string>();
    const dots: NoclipExplosionDot[] = [];
    document.querySelectorAll<HTMLElement | SVGElement>(selectors.join(',')).forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < -80 || x > viewportWidth + 80 || y < -80 || y > viewportHeight + 80) return;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.02) return;
      const key = `${Math.round(x)}:${Math.round(y)}`;
      if (seen.has(key)) return;
      seen.add(key);
      const radius = Math.max(8, Math.min(34, Math.max(rect.width, rect.height) / 2));
      dots.push({
        id: `${element.className || element.tagName}:${index}:${key}`,
        x,
        y,
        radius,
        power: 0.9 + Math.min(1.6, radius / 18),
      });
    });
    explosionDotsRef.current = dots;
  };

  const spawnNoclippingExplosion = (dot: NoclipExplosionDot, now = performance.now()) => {
    const withinCombo = now - lastExplosionAtRef.current < NOCLIP_EXPLOSION_COMBO_WINDOW_MS;
    explosionComboRef.current = withinCombo ? Math.min(10, explosionComboRef.current + 1) : 1;
    lastExplosionAtRef.current = now;
    activatedDotsRef.current.add(dot.id);
    wheelSlowdownRef.current = Math.min(1, wheelSlowdownRef.current + 0.22);
    hoverUntilRef.current = now + settings.noclipRecoveryTime * 1600;
    audioContextRef.current?.resume().catch(() => {});
    audioRef.current?.play().catch(() => {});

    const combo = explosionComboRef.current;
    const count = Math.min(
      560,
      Math.round(NOCLIP_EXPLOSION_SPAWN_BASE * 0.54 * dot.power * (1 + combo * 0.3)),
    );
    const particles = explosionParticlesRef.current;
    const loadedIndexes = explosionLoadedIndexesRef.current;

    for (let i = 0; i < count; i += 1) {
      while (particles.length >= NOCLIP_EXPLOSION_MAX_PARTICLES) {
        const removed = particles.shift();
        if (removed) recycleExplosionParticle(removed);
      }
      const rng = seededRandom(73129 + i * 97 + Math.floor(now) + dot.id.length * 409);
      const angle = Math.PI * 2 * seededRandom(3817 + i * 53 + Math.floor(dot.x * 10) + combo * 17);
      const radius = Math.hypot(viewportWidth, viewportHeight) * (0.12 + seededRandom(9137 + i * 31 + combo) * 0.78);
      const screenSide = seededRandom(1181 + i * 43 + combo);
      const targetX = screenSide < 0.28
        ? -viewportWidth * (0.08 + seededRandom(41 + i) * 0.34)
        : screenSide < 0.56
          ? viewportWidth * (1.08 + seededRandom(61 + i) * 0.34)
          : dot.x + Math.cos(angle) * radius;
      const targetY = screenSide >= 0.56
        ? dot.y + Math.sin(angle) * radius
        : viewportHeight * (-0.18 + seededRandom(71 + i) * 1.36);
      const startScatter = seededRandom(1723 + i) * dot.radius * 1.8;
      const startAngle = seededRandom(2371 + i) * Math.PI * 2;
      const particle = getExplosionParticle();
      particle.active = true;
      particle.startX = dot.x + Math.cos(startAngle) * startScatter;
      particle.startY = dot.y + Math.sin(startAngle) * startScatter;
      particle.x = particle.startX;
      particle.y = particle.startY;
      particle.targetX = targetX;
      particle.targetY = targetY;
      particle.vx = Math.cos(angle) * (18 + rng * 155) * (1 + combo * 0.12);
      particle.vy = Math.sin(angle) * (18 + rng * 155) * (1 + combo * 0.12);
      particle.imageIndex = loadedIndexes.length
        ? loadedIndexes[Math.floor(seededRandom(911 + i + combo) * loadedIndexes.length)]
        : Math.floor(seededRandom(919 + i + combo) * NOCLIP_EXPLOSION_IMAGE_COUNT);
      particle.bornAt = now;
      particle.lifeMs = 9600 + seededRandom(997 + i) * 15200 + combo * 720;
      particle.settleMs = 2200 + seededRandom(1237 + i) * 5200;
      particle.rotation = seededRandom(1291 + i) * Math.PI * 2;
      particle.spin = (-1.8 + seededRandom(1439 + i) * 3.6) * (1 + combo * 0.08);
      particle.scale = (0.22 + seededRandom(1543 + i) * 1.05) * (1 + combo * 0.1);
      particle.endScale = particle.scale * (1.28 + seededRandom(1601 + i) * 1.55);
      particle.opacity = Math.min(1, 0.62 + seededRandom(1699 + i) * 0.52);
      particles.push(particle);
    }
  };

  useEffect(() => {
    if (!onReady) return undefined;

    const frame = window.requestAnimationFrame(() => {
      onReady();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [onReady]);

  useEffect(() => {
    if (!adPreview) return;
    startAdPreview(0);
  // This is intentionally a one-shot mount preview for ?adPreview=1.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adPreview]);

  useEffect(() => {
    const decodedImages = NOCLIP_PRELOAD_IMAGE_SRCS.map((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.src = src;
      image.decode?.().catch(() => {});
      return image;
    });
    const videoPreloadLinks = NOCLIP_PRELOAD_VIDEO_SRCS.map((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = src;
      document.head.appendChild(link);
      return link;
    });
    document.fonts?.load('400 36px "AntiqueOliveNoclip"').catch(() => {});
    document.fonts?.load('400 36px "RorrimNoclip"').catch(() => {});
    document.fonts?.load('500 36px "AkzidenzGrotesk"').catch(() => {});

    return () => {
      videoPreloadLinks.forEach((link) => link.remove());
      decodedImages.length = 0;
    };
  }, []);

  useEffect(() => {
    adStateRef.current = adState;
  }, [adState]);

  useEffect(() => {
    let cancelled = false;
    NOCLIP_EXPLOSION_FRAGMENT_SRCS.slice(0, NOCLIP_EXPLOSION_PRELOAD_COUNT).forEach((src, index) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.onload = () => {
        if (cancelled) return;
        explosionImagesRef.current[index] = image;
        if (!explosionLoadedIndexesRef.current.includes(index)) {
          explosionLoadedIndexesRef.current.push(index);
        }
      };
      image.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = explosionCanvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewportWidth * dpr);
      canvas.height = Math.floor(viewportHeight * dpr);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFallbackShard = (
      x: number,
      y: number,
      width: number,
      height: number,
      rotation: number,
      alpha: number,
      seed: number,
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = seededRandom(seed) > 0.78 ? '#fe3b1f' : '#000000';
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    };

    const tick = (time: number) => {
      const lastTime = explosionLastFrameTimeRef.current ?? time;
      const dt = Math.min(50, Math.max(0, time - lastTime));
      explosionLastFrameTimeRef.current = time;
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);
      if (time - lastDotScanAtRef.current > 220) {
        lastDotScanAtRef.current = time;
        scanVisibleMirrorDots();
      }

      const particles = explosionParticlesRef.current;
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const age = time - particle.bornAt;
        if (age > particle.lifeMs || particle.opacity <= 0.01) {
          particles.splice(index, 1);
          recycleExplosionParticle(particle);
          continue;
        }
        const settle = Math.min(1, age / particle.settleMs);
        const eased = 1 - ((1 - settle) ** 3);
        const drift = Math.min(1, Math.max(0, (age - particle.settleMs) / 5200));
        const slowDt = dt / 1000;
        particle.x = particle.startX + (particle.targetX - particle.startX) * eased + particle.vx * slowDt * 0.42 * drift;
        particle.y = particle.startY + (particle.targetY - particle.startY) * eased + particle.vy * slowDt * 0.42 * drift;
        particle.vx *= 0.994;
        particle.vy = particle.vy * 0.994 + 4.5 * slowDt;
        particle.rotation += particle.spin * (dt / 1000);
        const lifeT = Math.min(1, age / particle.lifeMs);
        const scale = particle.scale + (particle.endScale - particle.scale) * lifeT;
        const alpha = particle.opacity * Math.min(1, age / 520) * Math.min(1, (particle.lifeMs - age) / 2200);
        const image = explosionImagesRef.current[particle.imageIndex];
        const baseWidth = 24 + scale * 62;
        if (image?.complete && image.naturalWidth > 0) {
          const aspect = image.naturalHeight / Math.max(1, image.naturalWidth);
          const drawWidth = baseWidth * (1 + lifeT * 0.8);
          const drawHeight = drawWidth * aspect;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.rotation);
          ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          ctx.restore();
        } else {
          drawFallbackShard(
            particle.x,
            particle.y,
            baseWidth,
            5 + scale * 18,
            particle.rotation,
            alpha,
            particle.imageIndex + index,
          );
        }
      }

      explosionFrameRef.current = window.requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    explosionFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      if (explosionFrameRef.current !== null) {
        window.cancelAnimationFrame(explosionFrameRef.current);
        explosionFrameRef.current = null;
      }
      explosionLastFrameTimeRef.current = null;
      explosionParticlesRef.current = [];
      explosionParticlePoolRef.current = [];
      activatedDotsRef.current.clear();
      explosionComboRef.current = 0;
    };
  // The canvas loop intentionally reads mutable refs for dots, images, and particles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportHeight, viewportWidth]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        event.stopPropagation();
        startAdPreview(adCopyIndex, adVideoIndex, adEntryEdgeIndex, adCueIndex);
        return;
      }
      if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === '[' ? -1 : 1;
        const nextIndex = ((adCopyIndex + direction) % noclippingAdCopy.length + noclippingAdCopy.length) % noclippingAdCopy.length;
        const nextCopy = getAdCopy(nextIndex);
        setAdCopyIndex(nextIndex);
        setAdState((current) => (current ? { ...current, prompt: nextCopy } : current));
        adStateRef.current = adStateRef.current
          ? { ...adStateRef.current, prompt: nextCopy }
          : adStateRef.current;
        if (!adStateRef.current) {
          startAdPreview(nextIndex, adVideoIndex, adEntryEdgeIndex, adCueIndex);
        }
        return;
      }
      if (event.key.toLowerCase() === 'v') {
        event.preventDefault();
        event.stopPropagation();
        const nextVideoIndex = noclippingCatalogueVideos.length
          ? (adVideoIndex + 1) % noclippingCatalogueVideos.length
          : 0;
        setAdVideoIndex(nextVideoIndex);
        startAdPreview(adCopyIndex, nextVideoIndex, adEntryEdgeIndex, adCueIndex);
        return;
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        event.stopPropagation();
        const nextEntryEdgeIndex = (adEntryEdgeIndex + 1) % NOCLIP_AD_ENTRY_EDGES.length;
        setAdEntryEdgeIndex(nextEntryEdgeIndex);
        startAdPreview(adCopyIndex, adVideoIndex, nextEntryEdgeIndex, adCueIndex);
        return;
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        event.stopPropagation();
        const nextCueIndex = (adCueIndex + 1) % closingAnnouncementOrder.length;
        setAdCueIndex(nextCueIndex);
        startAdPreview(adCopyIndex, adVideoIndex, adEntryEdgeIndex, nextCueIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // Shortcuts are local because this component is only mounted while Noclipping is active.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adCopyIndex, adCueIndex, adEntryEdgeIndex, adVideoIndex]);

  useEffect(() => {
    const video = adVideoRef.current;
    if (!video) return;

    if (adState?.phase === 'playing') {
      const start = Math.max(0, adState.video?.segmentStart ?? 0);
      video.loop = true;
      video.playbackRate = adState.cue.playbackRate;
      if (Math.abs(video.currentTime - start) > 0.25 && adState.playStartedAt !== null) {
        video.currentTime = start;
      }
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [adState?.cue.playbackRate, adState?.phase, adState?.playStartedAt, adState?.video?.src]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY > 0) {
        wheelSlowdownRef.current = Math.min(
          1,
          wheelSlowdownRef.current + Math.min(0.36, Math.abs(event.deltaY) / 720),
        );
        hoverUntilRef.current = performance.now() + settings.noclipRecoveryTime * 1000;
        audioContextRef.current?.resume().catch(() => {});
        audioRef.current?.play().catch(() => {});
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    overlay.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      overlay.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [settings.noclipRecoveryTime]);

  useEffect(() => {
    if (!settings.noclipMusicEnabled) return undefined;

    const AudioContextClass = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const audio = new Audio(NOCLIP_AUDIO_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    const adMusicAudio = new Audio();
    adMusicAudio.loop = false;
    adMusicAudio.preload = 'auto';
    const adAnnouncementAudio = new Audio();
    adAnnouncementAudio.loop = false;
    adAnnouncementAudio.preload = 'auto';
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaElementSource(audio);
    const adMusicSource = audioContext.createMediaElementSource(adMusicAudio);
    const adAnnouncementSource = audioContext.createMediaElementSource(adAnnouncementAudio);
    const gain = audioContext.createGain();
    const adMusicGain = audioContext.createGain();
    const adAnnouncementGain = audioContext.createGain();
    gain.gain.value = 0;
    adMusicGain.gain.value = 0;
    adAnnouncementGain.gain.value = 0;
    source.connect(gain);
    gain.connect(audioContext.destination);
    adMusicSource.connect(adMusicGain);
    adMusicGain.connect(audioContext.destination);
    adAnnouncementSource.connect(adAnnouncementGain);
    adAnnouncementGain.connect(audioContext.destination);

    audioRef.current = audio;
    adMusicAudioRef.current = adMusicAudio;
    adAnnouncementAudioRef.current = adAnnouncementAudio;
    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    adMusicSourceRef.current = adMusicSource;
    adAnnouncementSourceRef.current = adAnnouncementSource;
    gainRef.current = gain;
    adMusicGainRef.current = adMusicGain;
    adAnnouncementGainRef.current = adAnnouncementGain;

    return () => {
      audio.pause();
      adMusicAudio.pause();
      adAnnouncementAudio.pause();
      audio.src = '';
      adMusicAudio.src = '';
      adAnnouncementAudio.src = '';
      source.disconnect();
      adMusicSource.disconnect();
      adAnnouncementSource.disconnect();
      gain.disconnect();
      adMusicGain.disconnect();
      adAnnouncementGain.disconnect();
      audioContext.close().catch(() => {});
      audioRef.current = null;
      adMusicAudioRef.current = null;
      adAnnouncementAudioRef.current = null;
      audioContextRef.current = null;
      audioSourceRef.current = null;
      adMusicSourceRef.current = null;
      adAnnouncementSourceRef.current = null;
      gainRef.current = null;
      adMusicGainRef.current = null;
      adAnnouncementGainRef.current = null;
      currentGainRef.current = 0;
      currentAdMusicGainRef.current = 0;
      currentAdAnnouncementGainRef.current = 0;
    };
  }, [settings.noclipMusicEnabled]);

  const startAd = (now: number) => {
    if (!settings.noclipAdsEnabled || adStateRef.current) return;

    const sequenceIndex = adSequenceIndexRef.current;
    const cue = getAdCue(sequenceIndex);
    const visual = getAdVisual(sequenceIndex);
    const prompt = getAdCopy(sequenceIndex * 2);
    const enteringState: NoclipAdState = {
      phase: 'entering',
      video: visual.video,
      imageSequence: visual.imageSequence,
      startedAt: now,
      playStartedAt: null,
      duration: cue.duration,
      durationMs: Math.max(1, Math.round(cue.duration * 1000)),
      preview: false,
      prompt,
      cue,
      entryEdge: getEntryEdge(sequenceIndex),
      runId: adRunIdRef.current + 1,
    };
    adRunIdRef.current = enteringState.runId;
    clearAdTimers();
    stopAdAudio(0.18);
    setAdState(enteringState);
    adStateRef.current = enteringState;
    adSequenceIndexRef.current = sequenceIndex + 1;
    scheduleAdPlayback(enteringState);
  };

  useEffect(() => {
    const tick = (time: number) => {
      if (noclippingStartedAtRef.current === 0) {
        noclippingStartedAtRef.current = time;
      }
      const lastTime = lastFrameTimeRef.current ?? time;
      const dt = Math.min(64, Math.max(0, time - lastTime));
      lastFrameTimeRef.current = time;
      const currentAd = adStateRef.current;
      if (time >= hoverUntilRef.current && wheelSlowdownRef.current > 0) {
        const recoveryStep = dt / Math.max(50, settings.noclipRecoveryTime * 1000);
        wheelSlowdownRef.current = Math.max(0, wheelSlowdownRef.current - recoveryStep);
      }
      const slowdown = Math.max(0, Math.min(1, wheelSlowdownRef.current));
      const fallElapsed = Math.max(0, time - noclippingStartedAtRef.current);
      const fallT = Math.max(0, Math.min(1, fallElapsed / NOCLIP_FALL_ACCELERATION_MS));
      const baseFallSpeed = Math.min(settings.noclipNormalFallSpeed, 32);
      const hoverFallSpeed = Math.min(settings.noclipHoverFallSpeed, 10);
      const freefallSpeed = baseFallSpeed +
        (NOCLIP_TERMINAL_FALL_SPEED - baseFallSpeed) * (fallT ** 3);
      const targetSpeed = freefallSpeed + (hoverFallSpeed - freefallSpeed) * slowdown;
      const easingTime = targetSpeed < currentSpeedRef.current
        ? settings.noclipHoverEaseTime
        : settings.noclipRecoveryTime;
      const speedEase = Math.min(1, dt / Math.max(50, easingTime * 1000));
      currentSpeedRef.current += (targetSpeed - currentSpeedRef.current) * speedEase;

      if (!currentAd) {
        if (nextAdAtRef.current === 0) {
          nextAdAtRef.current = time + getFallIntervalSeconds(adSequenceIndexRef.current) * 1000;
        }
        const nextY = fallYRef.current + (currentSpeedRef.current * dt) / 1000;
        fallYRef.current = nextY;
        setScrollY(nextY);

        if (bandCount * bandHeight - (nextY + viewportHeight) < viewportHeight * 5) {
          setBandCount((count) => count + 24);
        }
        if (settings.noclipAdsEnabled && time >= nextAdAtRef.current) {
          startAd(time);
        }
      }

      if (gainRef.current) {
        const targetGain = currentAd ? NOCLIP_BACKGROUND_AD_GAIN : NOCLIP_BACKGROUND_GAIN;
        if (Math.abs(targetGain - backgroundGainTargetRef.current) > 0.02) {
          backgroundGainTargetRef.current = targetGain;
          rampGain(gainRef.current, currentGainRef, targetGain, currentAd ? NOCLIP_AD_GAIN_RAMP_IN : 0.9);
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      clearAdTimers();
      lastFrameTimeRef.current = null;
    };
  // startAd reads current refs/settings inside the animation loop; keeping it out avoids restarting the loop every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.noclipAdsEnabled,
    settings.noclipHoverFallSpeed,
    settings.noclipHoverEaseTime,
    settings.noclipNormalFallSpeed,
    settings.noclipRecoveryTime,
    bandCount,
    bandHeight,
    viewportHeight,
  ]);

  const currentAdVideo = adState?.video ?? null;
  const currentAdImageSequence = adState?.imageSequence ?? [];
  const currentAdFocus = currentAdVideo?.focus;
  const currentAdStartTime = Math.max(0, currentAdVideo?.segmentStart ?? 0);
  const currentAdZoom = currentAdFocus?.zoom ?? 3.5;
  const currentAdFocusX = `${currentAdFocus?.x ?? 50}%`;
  const currentAdFocusY = `${currentAdFocus?.y ?? 50}%`;
  const currentAdCue = adState?.cue ?? null;
  const currentAdTickerChars = Array.from(currentAdCue?.transcript ?? '');
  let currentAdTickerLetterIndex = -1;
  const currentAdTickerItems = currentAdTickerChars.map((char) => {
    const morphIndex = /\S/.test(char) ? ++currentAdTickerLetterIndex : null;
    return { char, morphIndex };
  });
  const currentAdTickerLetterCount = Math.max(1, currentAdTickerLetterIndex + 1);
  const currentAdDurationMs = adState?.durationMs ?? NOCLIP_AD_DURATION_FALLBACK_MS;
  const currentAdCharDelayMaxMs = currentAdDurationMs * 0.72;
  const currentAdCharMorphMs = Math.max(300, Math.min(1800, currentAdDurationMs * 0.18));
  const currentAdImageCycleMs = Math.max(2200, Math.min(3200, currentAdDurationMs / 8));
  const fallIntensity = Math.max(0, Math.min(1, currentSpeedRef.current / NOCLIP_TERMINAL_FALL_SPEED));
  const layerChaosMultiplier = 1 + (3.5 - 1) * fallIntensity;
  const mirrorProductDensity = 0.25 + 0.1 * fallIntensity;
  const handleNoclippingExplosionPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    scanVisibleMirrorDots();
    const dots = explosionDotsRef.current;
    if (!dots.length) return;
    const x = event.clientX;
    const y = event.clientY;
    let nearest: NoclipExplosionDot | undefined;
    let nearestDistance = Infinity;
    for (const dot of dots) {
      const distance = Math.hypot(dot.x - x, dot.y - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = dot;
      }
    }
    if (!nearest) return;
    const activationRadius = Math.max(74, nearest.radius * 4.2);
    if (nearestDistance <= activationRadius) {
      spawnNoclippingExplosion(nearest);
    }
  };

  return (
    <section
      ref={overlayRef}
      className={styles.noclippingOverlay}
      aria-label="Noclipping experience"
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className={styles.noclippingScrollLayer}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      />

      <div className={styles.noclippingVisualLayer} aria-hidden="true">
        {visibleItems.map((index) => {
          const seed = 9103 + index * 7919;
          const space = NOCLIP_SPACES[Math.floor(seededRandom(seed) * NOCLIP_SPACES.length)];
          const secondSpace = NOCLIP_SPACES[Math.floor(seededRandom(seed + 1) * NOCLIP_SPACES.length)];
          const tertiarySpace = NOCLIP_SPACES[Math.floor(seededRandom(seed + 37) * NOCLIP_SPACES.length)];
          const primaryAxis = space.axes[Math.floor(seededRandom(seed + 2) * space.axes.length)];
          const secondaryAxis = secondSpace.axes[Math.floor(seededRandom(seed + 3) * secondSpace.axes.length)];
          const tertiaryAxis = tertiarySpace.axes[Math.floor(seededRandom(seed + 38) * tertiarySpace.axes.length)];
          const cutout = NOCLIP_CUTOUTS[space.id];
          const secondCutout = NOCLIP_CUTOUTS[secondSpace.id];
          const mirrorProduct = noclippingMirrorProductCrops.length
            ? noclippingMirrorProductCrops[Math.floor(seededRandom(seed + 60) * noclippingMirrorProductCrops.length)]
            : null;
          const showMirrorProduct = Boolean(mirrorProduct && seededRandom(seed + 61) < mirrorProductDensity);
          const yBase = index * bandHeight - scrollY;
          const drift = (seededRandom(seed + 4) - 0.5) * viewportHeight * 0.45 * layerChaosMultiplier;
          const upwardFlight = scrollY *
            (0.08 + seededRandom(seed + 5) * 0.28 * settings.noclipImageSpeedVariance) *
            layerChaosMultiplier;
          const monumental = seededRandom(seed + 35) > 0.68;
          const huge = seededRandom(seed + 36) > 0.46;
          const primaryScale = settings.noclipImageMinScale +
            seededRandom(seed + 42) * (settings.noclipImageMaxScale - settings.noclipImageMinScale);
          const secondaryScale = settings.noclipImageMinScale +
            seededRandom(seed + 44) * (settings.noclipImageMaxScale - settings.noclipImageMinScale);
          const tertiaryScale = settings.noclipImageMinScale +
            seededRandom(seed + 46) * (settings.noclipImageMaxScale - settings.noclipImageMinScale);
          const primaryWidth = isMobile
            ? (monumental ? 180 + seededRandom(seed + 6) * 180 : 118 + seededRandom(seed + 6) * 128)
            : (monumental ? 142 + seededRandom(seed + 6) * 190 : 86 + seededRandom(seed + 6) * 122);
          const primaryLeft = isMobile
            ? -98 + seededRandom(seed + 7) * 130
            : -74 + seededRandom(seed + 7) * 112;
          const primaryTop = yBase + drift;
          const secondaryWidth = isMobile
            ? (huge ? 92 + seededRandom(seed + 8) * 120 : 58 + seededRandom(seed + 8) * 76)
            : (huge ? 76 + seededRandom(seed + 8) * 118 : 42 + seededRandom(seed + 8) * 84);
          const secondaryLeft = isMobile
            ? -54 + seededRandom(seed + 9) * 122
            : -46 + seededRandom(seed + 9) * 118;
          const secondaryTop = yBase + bandHeight * (-0.18 + seededRandom(seed + 10) * 0.92);
          const tertiaryWidth = isMobile ? 72 + seededRandom(seed + 39) * 160 : 58 + seededRandom(seed + 39) * 150;
          const tertiaryLeft = -80 + seededRandom(seed + 40) * 142;
          const tertiaryTop = yBase + bandHeight * (0.18 + seededRandom(seed + 41) * 0.72);
          const mirrorProductWidth = isMobile
            ? 28 + seededRandom(seed + 62) * 88
            : 18 + seededRandom(seed + 62) * 74;
          const mirrorProductLeft = -16 + seededRandom(seed + 63) * 118;
          const mirrorProductTop = yBase +
            bandHeight * (-0.18 + seededRandom(seed + 64) * 1.1) -
            upwardFlight * (0.25 + seededRandom(seed + 65) * 0.72);
          const mirrorProductScale = 0.28 + seededRandom(seed + 66) * 1.07;
          const mirrorProductRotation = (-8 + seededRandom(seed + 67) * 16) * (1 + 1.2 * fallIntensity);
          const mirrorProductOpacity = Math.min(0.82, 0.22 + seededRandom(seed + 68) * 0.56 + fallIntensity * 0.08);
          const label = NOCLIP_LABELS[Math.floor(seededRandom(seed + 29) * NOCLIP_LABELS.length)];

          return (
            <div
              key={index}
              className={styles.noclippingBand}
              style={{ zIndex: 1 + (index % 9) }}
            >
              <img
                src={primaryAxis.src}
                alt=""
                className={styles.noclippingImage}
                style={{
                  left: `${primaryLeft}%`,
                  top: `${primaryTop - upwardFlight * 0.32}px`,
                  width: `${primaryWidth}vw`,
                  transform: `rotate(${-18 + seededRandom(seed + 11) * 36}deg) scale(${primaryScale})`,
                  mixBlendMode: seededRandom(seed + 43) > 0.7 ? 'multiply' : 'normal',
                }}
              />
              <img
                src={secondaryAxis.src}
                alt=""
                className={styles.noclippingImage}
                style={{
                  left: `${secondaryLeft}%`,
                  top: `${secondaryTop - upwardFlight * 0.58}px`,
                  width: `${secondaryWidth}vw`,
                  transform: `rotate(${-24 + seededRandom(seed + 12) * 48}deg) scale(${secondaryScale})`,
                  mixBlendMode: seededRandom(seed + 16) > 0.32 ? 'multiply' : 'normal',
                }}
              />
              <img
                src={tertiaryAxis.src}
                alt=""
                className={styles.noclippingImage}
                style={{
                  left: `${tertiaryLeft}%`,
                  top: `${tertiaryTop - upwardFlight * 0.9}px`,
                  width: `${tertiaryWidth}vw`,
                  opacity: 0.92,
                  transform: `rotate(${-28 + seededRandom(seed + 45) * 56}deg) scale(${tertiaryScale})`,
                  mixBlendMode: seededRandom(seed + 47) > 0.58 ? 'multiply' : 'normal',
                }}
              />
              {showMirrorProduct && mirrorProduct && (
                <img
                  src={mirrorProduct.src}
                  alt=""
                  className={styles.noclippingMirrorProduct}
                  style={{
                    left: `${mirrorProductLeft}%`,
                    top: `${mirrorProductTop}px`,
                    width: `${mirrorProductWidth}vw`,
                    opacity: mirrorProductOpacity,
                    transform: `rotate(${mirrorProductRotation}deg) scale(${mirrorProductScale})`,
                    mixBlendMode: seededRandom(seed + 69) > 0.42 ? 'multiply' : 'normal',
                  }}
                />
              )}
              <div
                className={styles.noclippingSpaceLabel}
                style={{
                  left: `${-28 + seededRandom(seed + 14) * 92}%`,
                  top: `${yBase + bandHeight * (-0.16 + seededRandom(seed + 15) * 0.72) - upwardFlight * 0.12}px`,
                  fontSize: isMobile
                    ? `clamp(96px, ${34 + seededRandom(seed + 13) * 58}vw, 420px)`
                    : `clamp(140px, ${18 + seededRandom(seed + 13) * 24}vw, 620px)`,
                  transform: `rotate(${-10 + seededRandom(seed + 17) * 20}deg) scale(${1 + seededRandom(seed + 48) * 0.55})`,
                  fontFamily: '"RorrimNoclip", "Rorrim", Georgia, serif',
                  fontWeight: 400,
                }}
              >
                {space.id} {primaryAxis.label}
              </div>
              <div
                className={styles.noclippingAxisLabel}
                style={{
                  top: `${yBase + 24 + seededRandom(seed + 18) * bandHeight * 0.28}px`,
                  right: `${6 + seededRandom(seed + 19) * 28}%`,
                }}
              >
                {primaryAxis.label}
              </div>
              {cutout && (
                <img
                  src={cutout.src}
                  alt=""
                  className={styles.noclippingCutout}
                  style={{
                    top: `${primaryTop + bandHeight * (-0.28 + seededRandom(seed + 20) * 0.56) - upwardFlight * 0.78}px`,
                    left: `${primaryLeft - 10 + seededRandom(seed + 21) * 36}%`,
                    width: isMobile ? `${88 + seededRandom(seed + 22) * 120}vw` : `${58 + seededRandom(seed + 22) * 118}vw`,
                    transform: `rotate(${-18 + seededRandom(seed + 23) * 36}deg) scale(${1 + seededRandom(seed + 49) * 0.5})`,
                  }}
                />
              )}
              {secondCutout && seededRandom(seed + 24) > 0.38 && (
                <img
                  src={secondCutout.src}
                  alt=""
                  className={styles.noclippingCutout}
                  style={{
                    top: `${secondaryTop - bandHeight * (0.08 + seededRandom(seed + 25) * 0.22) - upwardFlight * 0.44}px`,
                    left: `${secondaryLeft - 8 + seededRandom(seed + 26) * 34}%`,
                    width: isMobile ? `${66 + seededRandom(seed + 27) * 92}vw` : `${46 + seededRandom(seed + 27) * 88}vw`,
                    transform: `rotate(${-22 + seededRandom(seed + 28) * 44}deg) scale(${1 + seededRandom(seed + 50) * 0.6})`,
                  }}
                />
              )}
              {seededRandom(seed + 30) > 0.42 && (
                <div
                  className={styles.noclippingObjectLabel}
                  style={{
                    top: `${yBase + bandHeight * (0.1 + seededRandom(seed + 31) * 0.68) - upwardFlight * 0.22}px`,
                    left: `${-14 + seededRandom(seed + 32) * 96}%`,
                    fontSize: isMobile ? `clamp(14px, ${5 + seededRandom(seed + 33) * 7}vw, 64px)` : `${28 + seededRandom(seed + 33) * 58}px`,
                    transform: `rotate(${-14 + seededRandom(seed + 34) * 28}deg) scale(${1 + seededRandom(seed + 51) * 0.8})`,
                    fontFamily: '"AntiqueOliveNoclip", "AntiqueOlive", Arial, sans-serif',
                    fontWeight: 400,
                  }}
                >
                  {label}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <canvas
        ref={explosionCanvasRef}
        className={styles.noclippingExplosionCanvas}
        aria-label="Noclipping black mirror eruption field"
        onPointerDown={handleNoclippingExplosionPointerDown}
      />
      {adState && createPortal(
        <aside
          className={styles.noclippingAd}
          data-ad-phase={adState.phase}
          data-entry-edge={adState.entryEdge}
          style={{
            '--noclip-ad-enter': `${NOCLIP_AD_ENTRY_DURATION}s`,
            '--noclip-ad-exit': `${NOCLIP_AD_EXIT_DURATION}s`,
            '--noclip-ad-duration': `${currentAdDurationMs}ms`,
            '--noclip-ticker-duration': `${currentAdDurationMs}ms`,
            '--noclip-char-morph-duration': `${currentAdCharMorphMs}ms`,
            '--noclip-image-cycle-duration': `${currentAdImageCycleMs}ms`,
          } as CSSProperties}
          aria-label="IKEA catalogue interruption"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <div className={styles.noclippingAdPanel}>
            <div className={styles.noclippingAdVideoViewport}>
              {currentAdVideo?.src ? (
                <video
                  key={`${adState.runId}-${currentAdVideo.id}`}
                  ref={adVideoRef}
                  className={styles.noclippingAdVideo}
                  src={currentAdVideo.src}
                  playsInline
                  muted
                  loop
                  preload="auto"
                  style={{
                    '--noclip-ad-video-scale': `${currentAdZoom}`,
                    '--noclip-ad-focus-x': currentAdFocusX,
                    '--noclip-ad-focus-y': currentAdFocusY,
                  } as CSSProperties}
                  onLoadedMetadata={(event) => {
                    const video = event.currentTarget;
                    video.muted = true;
                    video.volume = 0;
                    video.loop = true;
                    video.playbackRate = adState.cue.playbackRate;
                    video.currentTime = currentAdStartTime;
                    if (adStateRef.current?.phase === 'playing') {
                      video.play().catch(() => {});
                    }
                  }}
                />
              ) : currentAdImageSequence.length ? (
                <div className={styles.noclippingAdImageSequence}>
                  {currentAdImageSequence.map((image, imageIndex) => {
                    const sequenceLength = currentAdImageSequence.length;
                    const cycleOffsetMs = sequenceLength > 1
                      ? -(((sequenceLength - imageIndex) % sequenceLength) / sequenceLength) * currentAdImageCycleMs
                      : 0;
                    return (
                      <img
                        key={`${adState.runId}-${image.id}`}
                        className={styles.noclippingAdImageSlice}
                        src={image.src}
                        alt=""
                        style={{
                          '--noclip-image-delay': `${cycleOffsetMs}ms`,
                          '--noclip-image-scale': `${1.08 + imageIndex * 0.045}`,
                          '--noclip-image-x': `${50 + ((imageIndex % 2 === 0 ? -1 : 1) * (2 + imageIndex * 1.2))}%`,
                          '--noclip-image-y': `${50 + ((imageIndex % 3) - 1) * 3}%`,
                        } as CSSProperties}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noclippingAdMissingVideo}>
                  missing catalogue visual
                </div>
              )}
              <div className={styles.noclippingAdVeil} aria-hidden="true" />
            </div>
            <div className={styles.noclippingAdPrompt} aria-live="polite">
              <span className={styles.noclippingAdPromptMarker}>{adState.prompt.marker}</span>
              <span className={styles.noclippingAdPromptChinese}>{adState.prompt.zh}</span>
              <span className={styles.noclippingAdPromptEnglish}>{adState.prompt.en}</span>
            </div>
          </div>
          <div className={styles.noclippingAdTicker} aria-live="polite">
            <div
              key={`${adState.runId}-ticker-${currentAdCue?.id ?? 'missing'}`}
              className={styles.noclippingAdTickerTrack}
            >
              <span className={styles.noclippingAdTickerMarker}>
                {currentAdCue?.marker ?? 'missing'}
              </span>
              {currentAdTickerItems.map(({ char, morphIndex }, index) => {
                const charDelayMs = morphIndex === null
                  ? 0
                  : (morphIndex / currentAdTickerLetterCount) * currentAdCharDelayMaxMs;
                return (
                <span
                  key={`${adState.runId}-${index}-${char}`}
                  className={styles.noclippingAdTickerChar}
                  style={{
                    '--noclip-char-delay': `${charDelayMs}ms`,
                  } as CSSProperties}
                >
                  {char}
                </span>
                );
              })}
            </div>
            <div
              key={`${adState.runId}-progress`}
              className={styles.noclippingAdProgress}
            >
              <span className={styles.noclippingAdProgressFill} />
            </div>
          </div>
          <button
            type="button"
            className={styles.noclippingAdSkip}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              skipCurrentAd();
            }}
          >
            Skip
          </button>
        </aside>,
        document.body,
      )}
    </section>
  );
}

function ModeChrome({
  mode,
  animated,
  blocked,
  pausedRoll,
  settings,
}: {
  mode: AppMode;
  animated: boolean;
  blocked: boolean;
  pausedRoll: boolean;
  settings: PrototypeSettings;
}) {
  const chromeStyle = {
    '--intro-delay': `${INTRO_SEQUENCE_MS - INTRO_CHROME_FADE_MS}ms`,
  } as CSSProperties;

  return (
    <>
      {mode === 'intro' && (
        <>
          <div
            className={`${styles.introInfo}${animated ? ` ${styles.introChromeAnimated}` : ''}`}
            style={chromeStyle}
          >
            <span className={`${styles.chromeEnglish} ${styles.infoLabel}`} data-typo-scope="intro.infoLabel">info</span>
            <div className={styles.introInfoText} aria-hidden="true">
              <p className={styles.infoChinese} data-typo-scope="intro.preface.zh">
                {settings.prefaceZh}
              </p>
              <p className={styles.infoEnglish} data-typo-scope="intro.preface.en">
                {settings.prefaceEn}
              </p>
            </div>
          </div>
          <header
            className={`${styles.introTitle}${animated ? ` ${styles.introChromeAnimated}` : ''}`}
            style={chromeStyle}
          >
            <span className={styles.chromeChinese} data-typo-scope="intro.title.zh">镜中宣言</span>
            <span className={styles.chromeEnglish} data-typo-scope="intro.title.en">Looking-Glass Manifesto</span>
            <span className={styles.introTitleDetail} aria-hidden="true">
              <span className={`${styles.chromeChinese} ${styles.introTitleDetailChinese}`} data-typo-scope="intro.titleText.zh">拟像从来都不是隐藏真理之物——隐藏了没有真理这回事的正是真理。拟像是真的。</span>
              <span className={`${styles.chromeEnglish} ${styles.introTitleDetailEnglish}`} data-typo-scope="intro.titleText.en">The simulacrum is never what hides the truth - it is truth that hides the fact that there is none. The simulacrum is true.</span>
            </span>
          </header>
          <footer
            className={`${styles.introCopyright}${animated ? ` ${styles.introChromeAnimated}` : ''}`}
            style={chromeStyle}
          >
            <span className={styles.chromeEnglish} data-typo-scope="intro.footer">Meta-Data 2026</span>
            <span className={styles.chromeEnglish} data-typo-scope="intro.footer">Central Academy of Fine Arts</span>
            <span className={styles.chromeEnglish} data-typo-scope="intro.footer">Work by Nixuan Yang</span>
            <span className={styles.chromeEnglish} data-typo-scope="intro.footer">© 2026 Nixuan Yang. All rights reserved.</span>
          </footer>
        </>
      )}
      <div
        className={`${styles.modeHint}${mode === 'intro' || pausedRoll ? ` ${styles.introBreathingHint}` : ''}${mode === 'play' && blocked ? ` ${styles.blockedHint}` : ''}${mode === 'intro' && animated ? ` ${styles.introChromeAnimated}` : ''}`}
        style={mode === 'intro' ? chromeStyle : undefined}
      >
        {pausedRoll ? (
          <>
            <span className={styles.chromeChinese}>点击任意处掷骰子</span>
            <span className={styles.chromeEnglish}>Click Anywhere to Roll</span>
          </>
        ) : mode === 'intro' ? (
          <>
            <span className={styles.chromeChinese} data-typo-scope="intro.hint.zh">按空格开始游戏</span>
            <span className={styles.chromeEnglish} data-typo-scope="intro.hint.en">Press Space to Begin</span>
          </>
        ) : blocked ? (
          <>
            <span className={styles.chromeChinese}>无法进入</span>
            <span className={styles.chromeEnglish}>Unable to enter</span>
          </>
        ) : (
          <>
            <span className={styles.chromeChinese}>按 Esc 暂停</span>
            <span className={styles.chromeEnglish}>Press Esc to Pause</span>
          </>
        )}
      </div>
    </>
  );
}

function PlayIdleClock({ time }: { time: Date }) {
  const year = String(time.getFullYear());
  const monthDay = `${String(time.getMonth() + 1).padStart(2, '0')}${String(time.getDate()).padStart(2, '0')}`;
  const hour = String(time.getHours()).padStart(2, '0');
  const minute = String(time.getMinutes()).padStart(2, '0');
  const second = String(time.getSeconds()).padStart(2, '0');
  const colonVisible = time.getSeconds() % 2 === 0;
  const renderRow = (value: string, key: string) => (
    <span className={styles.playIdleClockRow}>
      {value.split('').map((char, index) => (
        <span key={`${key}-${char}-${index}`}>{char}</span>
      ))}
    </span>
  );

  return (
    <div className={styles.playIdleClock} aria-hidden="true">
      {renderRow(year, 'year')}
      {renderRow(monthDay, 'month-day')}
      <span className={styles.playIdleClockRow}>
        {hour.split('').map((char, index) => (
          <span key={`hour-${char}-${index}`}>{char}</span>
        ))}
        <span className={colonVisible ? undefined : styles.playIdleClockColonDim}>:</span>
        {minute.split('').map((char, index) => (
          <span key={`minute-${char}-${index}`}>{char}</span>
        ))}
        <span className={colonVisible ? undefined : styles.playIdleClockColonDim}>:</span>
        {second.split('').map((char, index) => (
          <span key={`second-${char}-${index}`}>{char}</span>
        ))}
      </span>
    </div>
  );
}

function PentagonGuide({
  node,
  pentagonUnit,
}: {
  node: ExplorationNode;
  pentagonUnit: PentagonUnit;
}) {
  const padding = Math.max(120, pentagonUnit.radius * 0.2);
  const viewSize = (pentagonUnit.radius + padding) * 2;
  const viewMin = -viewSize / 2;
  const normalLength = Math.max(90, pentagonUnit.radius * 0.16);
  const polygonPoints = pentagonUnit.vertices
    .map((vertex) => `${vertex.x.toFixed(2)},${vertex.y.toFixed(2)}`)
    .join(' ');
  const edgeEntries = NODE_DIRECTIONS.map((direction) => pentagonUnit.edges[direction]);

  return (
    <svg
      className={styles.pentagonGuide}
      style={{
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0) translate(-50%, -50%)`,
      }}
      viewBox={`${viewMin} ${viewMin} ${viewSize} ${viewSize}`}
      aria-hidden="true"
    >
      <polygon className={styles.pentagonGuidePolygon} points={polygonPoints} />
      {pentagonUnit.vertices.map((vertex, index) => (
        <circle
          key={`vertex-${index}`}
          className={styles.pentagonGuideVertex}
          cx={vertex.x}
          cy={vertex.y}
          r={7}
        />
      ))}
      {edgeEntries.map((edge) => (
        <g key={edge.direction}>
          <line
            className={styles.pentagonGuideEdge}
            x1={edge.start.x}
            y1={edge.start.y}
            x2={edge.end.x}
            y2={edge.end.y}
          />
          <circle
            className={styles.pentagonGuideMidpoint}
            cx={edge.midpoint.x}
            cy={edge.midpoint.y}
            r={8}
          />
          <line
            className={styles.pentagonGuideNormal}
            x1={edge.midpoint.x}
            y1={edge.midpoint.y}
            x2={edge.midpoint.x + edge.normal.x * normalLength}
            y2={edge.midpoint.y + edge.normal.y * normalLength}
          />
        </g>
      ))}
      <circle className={styles.pentagonGuideCenter} cx={0} cy={0} r={9} />
    </svg>
  );
}

function ChapterGate({
  direction,
  chapter,
  x,
  y,
  explored,
  active,
  onClick,
  settings,
  revealing,
  previewOpacity,
  intro,
  introAnimated,
  hovered,
  introFocus,
  introHoverEnabled,
  onHoverChapter,
  sequenceIndex,
}: {
  direction: NodeDirection;
  chapter: ChapterConfig;
  x: number;
  y: number;
  explored: boolean;
  active: boolean;
  onClick?: () => void;
  settings: PrototypeSettings;
  revealing: boolean;
  previewOpacity: number;
  intro: boolean;
  introAnimated: boolean;
  hovered: boolean;
  introFocus: boolean;
  introHoverEnabled: boolean;
  onHoverChapter: (chapter: ChapterId | null) => void;
  sequenceIndex: number;
}) {
  const width = CHAPTER_VISUAL_WIDTH[chapter.id] * NODE_LAYOUT.titleScale * settings.globalScale * settings.chapterScale * INTRO_CHAPTER_SCALE;
  const aspect = getImageAspect(chapter.id);
  const height = width * aspect;
  const manifesto = getChapterManifestoText(chapter.id, settings);
  const manifestoOffset = getChapterManifestoOffset(chapter.id, settings);
  const manifestoOffsetX = settings.chapterManifestoOffsetX + manifestoOffset.x;
  const manifestoOffsetY = settings.chapterManifestoOffsetY + manifestoOffset.y;
  const manifestoWidth = getChapterManifestoWidth(chapter.id, settings);
  const canHoverIntro = intro &&
    introHoverEnabled &&
    chapter.id !== 'alphabet' &&
    chapter.id !== 'noclipping' &&
    !EXTRA_INTRO_FOCUS_CHAPTERS.includes(chapter.id as (typeof EXTRA_INTRO_FOCUS_CHAPTERS)[number]);

  return (
    <button
      type="button"
      className={`${styles.chapterGate}${active ? ` ${styles.activeGate}` : ''}${explored ? ` ${styles.exploredGate}` : ''}${revealing ? ` ${styles.revealingGate}` : ''}${intro ? ` ${styles.introGate}` : ''}${introAnimated ? ` ${styles.introGateAnimated}` : ''}${hovered ? ` ${styles.introChapterHovered}` : ''}${introFocus ? ` ${styles.introFocusGate}` : ''}${introFocus && chapter.id === 'noclipping' ? ` ${styles.noclippingFocusGate}` : ''}${introFocus && chapter.id === 'dimension' ? ` ${styles.dimensionFocusGate}` : ''}${introFocus && chapter.id === 'paradox' ? ` ${styles.paradoxFocusGate}` : ''}${introFocus && chapter.id === 'noise' ? ` ${styles.noiseFocusGate}` : ''}`}
      style={{
        '--gate-x': `${x}px`,
        '--gate-y': `${y}px`,
        '--intro-delay': `${INTRO_DOT_DURATION_MS + sequenceIndex * INTRO_TITLE_STAGGER_MS}ms`,
        '--gate-reveal-delay': `${sequenceIndex * 80}ms`,
        '--preview-title-opacity': `${previewOpacity}`,
        '--chapter-manifesto-current-offset-x': `${manifestoOffsetX}px`,
        '--chapter-manifesto-current-offset-y': `${manifestoOffsetY}px`,
        '--chapter-manifesto-current-width': `${manifestoWidth}mm`,
        '--gate-half-width': `${width / 2}px`,
        '--gate-half-height': `${height / 2}px`,
        width: `${width}px`,
        minHeight: `${height}px`,
        transform: 'translate3d(var(--gate-x), var(--gate-y), 0) translate(-50%, -50%)',
      } as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onMouseEnter={canHoverIntro ? () => onHoverChapter(chapter.id) : undefined}
      onMouseLeave={canHoverIntro ? () => onHoverChapter(null) : undefined}
      onFocus={canHoverIntro ? () => onHoverChapter(chapter.id) : undefined}
      onBlur={canHoverIntro ? () => onHoverChapter(null) : undefined}
      disabled={!active && !intro}
      aria-label={`${chapter.label} gate ${direction}`}
    >
      <span className={styles.introChapterImage}>
        <ChapterImage src={chapter.src} label={chapter.label} />
      </span>
      {intro && (
        <span
          className={`${styles.manifestoText}${chapter.id === 'dimension' ? ` ${styles.dimensionManifestoText}` : ''}`}
          aria-hidden={!hovered}
        >
          <span className={styles.manifestoChinese} data-typo-scope={`intro.manifesto.${chapter.id}.zh`}>{manifesto.zh}</span>
          <span className={styles.manifestoEnglish} data-typo-scope={`intro.manifesto.${chapter.id}.en`}>{manifesto.en}</span>
        </span>
      )}
    </button>
  );
}

function ChapterImage({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  const [status, setStatus] = useState<ImageLoadStatus>(() => chapterImageStatusCache.get(src) ?? 'loading');

  useEffect(() => {
    let cancelled = false;
    setStatus(chapterImageStatusCache.get(src) ?? 'loading');
    preloadChapterImage(src).then((nextStatus) => {
      if (!cancelled) setStatus(nextStatus);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (status === 'failed') {
    return (
      <span className={styles.fallback}>
        {label}
        <br />
        {src}
      </span>
    );
  }

  return (
    <>
      <img
        className={`${styles.chapterImage}${status === 'loading' ? ` ${styles.imageLoading}` : ''}`}
        src={src}
        alt={label}
        draggable={false}
        onLoad={(event) => {
          const image = event.currentTarget;
          const nextStatus: ImageLoadStatus = image.naturalWidth > 0 && image.naturalHeight > 0 ? 'loaded' : 'failed';
          chapterImageStatusCache.set(src, nextStatus);
          setStatus(nextStatus);
        }}
        onError={() => {
          chapterImageStatusCache.set(src, 'failed');
          setStatus('failed');
        }}
      />
    </>
  );
}

function createMapStyle(settings: PrototypeSettings): CSSProperties {
  return {
    '--dot-size': `${settings.nodeDotSizeMM * PX_PER_MM}px`,
    '--dot-opacity': `${settings.nodeDotOpacity}`,
    '--mirror-width': `${NODE_LAYOUT.mirrorWidth * settings.globalScale * settings.mirrorScale}px`,
    '--title-opacity': `${settings.titleOpacity}`,
    '--pause-blur': `${settings.pauseBlur}px`,
    '--ui-text-size': `${settings.uiTextSize}px`,
    '--intro-title-text-size': `${settings.introTitleTextSize}px`,
    '--intro-title-offset-x': `${settings.introTitleOffsetX}px`,
    '--intro-title-offset-y': `${settings.introTitleOffsetY}px`,
    '--mode-hint-text-size': `${settings.modeHintTextSize}px`,
    '--mode-hint-offset-x': `${settings.modeHintOffsetX}px`,
    '--mode-hint-offset-y': `${settings.modeHintOffsetY}px`,
    '--intro-info-text-size': `${settings.introInfoTextSize}px`,
    '--intro-info-offset-x': `${settings.introInfoOffsetX}px`,
    '--intro-info-offset-y': `${settings.introInfoOffsetY}px`,
    '--intro-preface-text-size': `${settings.introPrefaceTextSize}px`,
    '--intro-preface-offset-x': `${settings.introPrefaceOffsetX}px`,
    '--intro-preface-offset-y': `${settings.introPrefaceOffsetY}px`,
    '--intro-preface-width': `${settings.prefaceTextWidthMM}mm`,
    '--intro-copyright-text-size': `${settings.introCopyrightTextSize}px`,
    '--intro-copyright-offset-x': `${settings.introCopyrightOffsetX}px`,
    '--intro-copyright-offset-y': `${settings.introCopyrightOffsetY}px`,
    '--intro-title-detail-text-size': `${settings.introTitleDetailTextSize}px`,
    '--intro-title-detail-offset-x': `${settings.introTitleDetailOffsetX}px`,
    '--intro-title-detail-offset-y': `${settings.introTitleDetailOffsetY}px`,
    '--intro-title-detail-chinese-offset-x': `${settings.introTitleDetailChineseOffsetX}px`,
    '--intro-title-detail-chinese-offset-y': `${settings.introTitleDetailChineseOffsetY}px`,
    '--intro-title-detail-english-offset-x': `${settings.introTitleDetailEnglishOffsetX}px`,
    '--intro-title-detail-english-offset-y': `${settings.introTitleDetailEnglishOffsetY}px`,
    '--chapter-manifesto-text-size': `${settings.chapterManifestoTextSize}px`,
    '--chapter-manifesto-offset-x': `${settings.chapterManifestoOffsetX}px`,
    '--chapter-manifesto-offset-y': `${settings.chapterManifestoOffsetY}px`,
    '--top-hud-text-size': `${settings.topHudTextSize}px`,
    '--top-hud-offset-x': `${settings.topHudOffsetX}px`,
    '--top-hud-offset-y': `${settings.topHudOffsetY}px`,
  } as CSSProperties;
}

function getChapterManifestoText(chapter: ChapterId, settings: PrototypeSettings) {
  switch (chapter) {
    case 'alphabet':
      return { zh: settings.alphabetManifestoZh, en: settings.alphabetManifestoEn };
    case 'noclipping':
      return { zh: settings.noclippingManifestoZh, en: settings.noclippingManifestoEn };
    case 'dimension':
      return { zh: settings.dimensionManifestoZh, en: settings.dimensionManifestoEn };
    case 'paradox':
      return { zh: settings.paradoxManifestoZh, en: settings.paradoxManifestoEn };
    case 'noise':
      return { zh: settings.noiseManifestoZh, en: settings.noiseManifestoEn };
  }
}

function getChapterManifestoWidth(chapter: ChapterId, settings: PrototypeSettings) {
  switch (chapter) {
    case 'alphabet':
      return settings.alphabetManifestoWidthMM;
    case 'noclipping':
      return settings.noclippingManifestoWidthMM;
    case 'dimension':
      return settings.dimensionManifestoWidthMM;
    case 'paradox':
      return settings.paradoxManifestoWidthMM;
    case 'noise':
      return settings.noiseManifestoWidthMM;
  }
}

function getChapterOffset(direction: NodeDirection, settings: PrototypeSettings) {
  switch (direction) {
    case 'up':
      return { x: settings.chapterUpOffsetX, y: settings.chapterUpOffsetY };
    case 'topRight':
      return { x: settings.chapterTopRightOffsetX, y: settings.chapterTopRightOffsetY };
    case 'bottomRight':
      return { x: settings.chapterBottomRightOffsetX, y: settings.chapterBottomRightOffsetY };
    case 'bottomLeft':
      return { x: settings.chapterBottomLeftOffsetX, y: settings.chapterBottomLeftOffsetY };
    case 'topLeft':
      return { x: settings.chapterTopLeftOffsetX, y: settings.chapterTopLeftOffsetY };
  }
}

function getChapterTitleOffset(chapter: ChapterId, settings: PrototypeSettings) {
  switch (chapter) {
    case 'alphabet':
      return { x: settings.alphabetOffsetX, y: settings.alphabetOffsetY };
    case 'noclipping':
      return { x: settings.noclippingOffsetX, y: settings.noclippingOffsetY };
    case 'dimension':
      return { x: settings.dimensionOffsetX, y: settings.dimensionOffsetY };
    case 'paradox':
      return { x: settings.paradoxOffsetX, y: settings.paradoxOffsetY };
    case 'noise':
      return { x: settings.noiseOffsetX, y: settings.noiseOffsetY };
  }
}

function getChapterManifestoOffset(chapter: ChapterId, settings: PrototypeSettings) {
  switch (chapter) {
    case 'alphabet':
      return { x: settings.alphabetManifestoOffsetX, y: settings.alphabetManifestoOffsetY };
    case 'noclipping':
      return { x: settings.noclippingManifestoOffsetX, y: settings.noclippingManifestoOffsetY };
    case 'dimension':
      return { x: settings.dimensionManifestoOffsetX, y: settings.dimensionManifestoOffsetY };
    case 'paradox':
      return { x: settings.paradoxManifestoOffsetX, y: settings.paradoxManifestoOffsetY };
    case 'noise':
      return { x: settings.noiseManifestoOffsetX, y: settings.noiseManifestoOffsetY };
  }
}

function findNearestReachableNode(
  offset: { x: number; y: number },
  viewport: { width: number; height: number },
  scale: number,
  nodeCoords: NodeStore,
  pentagonUnit: PentagonUnit,
  settings: PrototypeSettings,
  force = false,
  forPlay = false,
): {
  key: string;
  coord: NodeCoord;
  position: { x: number; y: number };
  fromKey?: string;
  direction?: NodeDirection;
} | null {
  const focus = getCameraFocusPoint(viewport, forPlay);
  const centerWorld = {
    x: (focus.x - offset.x) / scale,
    y: (focus.y - offset.y) / scale,
  };
  const visitedKeys = new Set(Object.keys(nodeCoords));
  const threshold = force
    ? SNAP_MAX_DISTANCE / scale
    : pentagonUnit.apothem * 2 * DRAG_REVEAL_RATIO;
  let nearest: {
    key: string;
    coord: NodeCoord;
    position: { x: number; y: number };
    distance: number;
    fromKey?: string;
    direction?: NodeDirection;
  } | null = null;

  const consider = (candidate: {
    key: string;
    coord: NodeCoord;
    position: { x: number; y: number };
    fromKey?: string;
    direction?: NodeDirection;
  }) => {
    const distance = Math.hypot(candidate.position.x - centerWorld.x, candidate.position.y - centerWorld.y);

    if (distance > threshold) return;
    if (!nearest || distance < nearest.distance) {
      nearest = { ...candidate, distance };
    }
  };

  for (const [key, record] of Object.entries(nodeCoords)) {
    consider({ key, coord: record.coord, position: record.position });

    for (const direction of NODE_DIRECTIONS) {
      const targetCoord = getTargetCoord(record.coord, direction);
      const targetKey = nodeKey(targetCoord);
      if (visitedKeys.has(targetKey)) continue;
      consider({
        key: targetKey,
        coord: targetCoord,
        position: getPentagonTargetPosition(record.position, direction, pentagonUnit),
        fromKey: key,
        direction,
      });
    }
  }

  return nearest;
}

function findSnapCandidateFromNode({
  startNodeKey,
  offset,
  velocity,
  viewport,
  scale,
  nodeCoords,
  pentagonUnit,
  forPlay = false,
}: {
  startNodeKey: string;
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  viewport: { width: number; height: number };
  scale: number;
  nodeCoords: NodeStore;
  pentagonUnit: PentagonUnit;
  forPlay?: boolean;
}): {
  key: string;
  coord: NodeCoord;
  position: { x: number; y: number };
  fromKey?: string;
  direction?: NodeDirection;
} | null {
  const startRecord = nodeCoords[startNodeKey];
  if (!startRecord) return null;

  const projectedOffset = {
    x: offset.x + velocity.x * RELEASE_PROJECTION_MS,
    y: offset.y + velocity.y * RELEASE_PROJECTION_MS,
  };
  const focus = getCameraFocusPoint(viewport, forPlay);
  const centerWorld = {
    x: (focus.x - projectedOffset.x) / scale,
    y: (focus.y - projectedOffset.y) / scale,
  };
  const startPosition = startRecord.position;
  const startDistance = Math.hypot(startPosition.x - centerWorld.x, startPosition.y - centerWorld.y);
  let nearest: {
    key: string;
    coord: NodeCoord;
    position: { x: number; y: number };
    distance: number;
    fromKey?: string;
    direction?: NodeDirection;
  } = {
    key: startNodeKey,
    coord: startRecord.coord,
    position: startPosition,
    distance: startDistance,
  };

  for (const direction of NODE_DIRECTIONS) {
    const coord = getTargetCoord(startRecord.coord, direction);
    const key = nodeKey(coord);
    const position = nodeCoords[key]?.position ?? getPentagonTargetPosition(startRecord.position, direction, pentagonUnit);
    const distance = Math.hypot(position.x - centerWorld.x, position.y - centerWorld.y);

    if (distance < nearest.distance) {
      nearest = {
        key,
        coord,
        position,
        distance,
        fromKey: startNodeKey,
        direction,
      };
    }
  }

  return nearest.distance < startDistance ? nearest : {
    key: startNodeKey,
    coord: startRecord.coord,
    position: startPosition,
  };
}

function findActiveSnappedNode(
  offset: { x: number; y: number },
  viewport: { width: number; height: number },
  scale: number,
  nodeCoords: NodeStore,
  forPlay = false,
): string | null {
  const focus = getCameraFocusPoint(viewport, forPlay);
  const centerWorld = {
    x: (focus.x - offset.x) / scale,
    y: (focus.y - offset.y) / scale,
  };
  let nearestKey: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [key, record] of Object.entries(nodeCoords)) {
    const position = record.position;
    const screenDistance = Math.hypot(position.x - centerWorld.x, position.y - centerWorld.y) * scale;

    if (screenDistance < nearestDistance) {
      nearestKey = key;
      nearestDistance = screenDistance;
    }
  }

  return nearestDistance <= ACTIVE_SNAP_DISTANCE ? nearestKey : null;
}

function getOccupiedDirectionsForNode(
  node: ExplorationNode,
  edges: ExplorationEdge[],
  nodesByKey: Record<string, ExplorationNode>,
  pentagonUnit: PentagonUnit,
): Set<NodeDirection> {
  const slots = NODE_DIRECTIONS.map((direction) => {
    const targetPosition = getPentagonTargetPosition(node.position, direction, pentagonUnit);
    return {
      direction,
      midpoint: getMidpoint(node.position, targetPosition),
    };
  });
  const occupied = new Set<NodeDirection>();

  for (const edge of edges) {
    if (edge.fromKey !== node.key && edge.toKey !== node.key) {
      continue;
    }

    const from = nodesByKey[edge.fromKey];
    const to = nodesByKey[edge.toKey];
    if (!from || !to) continue;

    const edgeMidpoint = getMidpoint(from.position, to.position);
    const nearestSlot = slots
      .filter((slot) => !occupied.has(slot.direction))
      .sort((a, b) => (
        distanceSquared(a.midpoint, edgeMidpoint) - distanceSquared(b.midpoint, edgeMidpoint)
      ))[0];

    if (nearestSlot) {
      occupied.add(nearestSlot.direction);
    }
  }

  return occupied;
}

function hasConnectedEdge(fromKey: string, toKey: string, edges: ExplorationEdge[]): boolean {
  return Boolean(findConnectedEdge(fromKey, toKey, edges));
}

function findConnectedEdge(fromKey: string, toKey: string, edges: ExplorationEdge[]): ExplorationEdge | null {
  return edges.some((edge) => (
    (edge.fromKey === fromKey && edge.toKey === toKey) ||
    (edge.fromKey === toKey && edge.toKey === fromKey)
  ))
    ? edges.find((edge) => (
        (edge.fromKey === fromKey && edge.toKey === toKey) ||
        (edge.fromKey === toKey && edge.toKey === fromKey)
      )) ?? null
    : null;
}

function getUniqueEdges(edges: ExplorationEdge[]): ExplorationEdge[] {
  const seen = new Set<string>();
  const unique: ExplorationEdge[] = [];

  for (const edge of edges) {
    const key = edgePairKey(edge.fromKey, edge.toKey);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(edge);
  }

  return unique;
}

function edgePairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getMidpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function getMirrorOpacity(coord: NodeCoord, settings: PrototypeSettings, time: number): number {
  if (!settings.flickerEnabled) return settings.mirrorOpacityMax;
  const phase = getNodePhase(coord) * settings.flickerRandomness;
  const primary = 0.5 + 0.5 * Math.sin(time * settings.flickerSpeed * Math.PI * 2 + phase);
  const secondary = 0.5 + 0.5 * Math.sin(time * settings.flickerSpeed * 2.322 + phase * 1.9);
  const mixed = primary * (1 - settings.flickerNoiseAmount) + secondary * settings.flickerNoiseAmount;
  return settings.mirrorOpacityMin + (settings.mirrorOpacityMax - settings.mirrorOpacityMin) * mixed;
}

function drawMirroredCoverFromVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dw: number,
  dh: number,
) {
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (!vW || !vH) return;

  const vRatio = vW / vH;
  const dRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = vW;
  let sh = vH;
  if (vRatio > dRatio) {
    sw = vH * dRatio;
    sx = (vW - sw) / 2;
  } else {
    sh = vW / dRatio;
    sy = (vH - sh) / 2;
  }

  ctx.save();
  ctx.translate(dw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.restore();
}

function seededRandom(seed: number): number {
  let value = seed + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function seekAudio(audio: HTMLAudioElement, time: number) {
  audio.currentTime = time;
}

function clampScale(value: number, settings: PrototypeSettings): number {
  return Math.max(settings.minZoom, Math.min(settings.maxZoom, value));
}

function getCustomCursorSize(displayScale: number, settings: PrototypeSettings): number {
  const zoomProgress = settings.maxZoom > settings.minZoom
    ? (displayScale - settings.minZoom) / (settings.maxZoom - settings.minZoom)
    : 1;
  const clampedProgress = Math.max(0, Math.min(1, zoomProgress));
  const baseSize = settings.cursorMinSize +
    (settings.cursorMaxSize - settings.cursorMinSize) * clampedProgress;
  return Math.max(settings.cursorMinSize, Math.min(settings.cursorMaxSize, baseSize * settings.cursorSizeScale));
}

function getViewportFitScale(viewport: { width: number; height: number }): number {
  const fit = Math.min(
    viewport.width / MAP_DESIGN_VIEWPORT.width,
    viewport.height / MAP_DESIGN_VIEWPORT.height,
  );

  return Math.max(MIN_VIEWPORT_FIT_SCALE, Math.min(1, fit));
}

function getCameraFocusPoint(
  viewport: { width: number; height: number },
  forPlay = false,
): { x: number; y: number } {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2 + (forPlay ? 0 : INTRO_MAP_OFFSET_Y),
  };
}

function getIntroStartOffsetY(viewport: { height: number }, displayScale: number): number {
  return viewport.height / 2 + INTRO_MAP_OFFSET_Y + INTRO_MIRROR_AXIS_OFFSET_Y * displayScale;
}

function clampBetween(value: number, a: number, b: number): number {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return Math.max(min, Math.min(max, value));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}
