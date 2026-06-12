'use client';

/* eslint-disable @next/next/no-img-element */

// =========================
// 00 依赖与字体
// =========================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import localFont from 'next/font/local';

const clarendonLight = localFont({ src: '../fonts/ClarendonCom-Light.ttf' });
const clarendonBold = localFont({ src: '../fonts/ClarendonCom-Bold.ttf' });
const clarendonMedium = localFont({ src: '../fonts/ClarendonCom-Medium.ttf' });
const monaco = localFont({ src: '../fonts/Monaco.ttf' });
const antiqueOlive = localFont({ src: '../fonts/AntiqueOlive-Regular.ttf' });

// =========================
// 01 类型与常量
// =========================
type ChapterMode = 'none' | 'dimension' | 'slicing' | 'noclipping';

type SliceFrame = {
  src: string;
  label: string;
  elapsed: number;
};

type NoclipIndexFile = {
  images?: string[];
};

type NavigatorWithDeviceInfo = Navigator & {
  connection?: {
    effectiveType?: string;
  };
  deviceMemory?: number;
};

type SliceMirrorConfig = {
  id: number;
  x: number;
  y: number;
  width: number;
  rotate: number;
  z: number;
  ampX: number;
  ampY: number;
  speed: number;
  phase: number;
};

type DimensionWritableFile = {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
};

type DimensionFileHandle = {
  createWritable: () => Promise<DimensionWritableFile>;
};

type DimensionDirectoryHandle = {
  getFileHandle: (name: string, options: { create: boolean }) => Promise<DimensionFileHandle>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<DimensionDirectoryHandle>;
};

type DimensionCaptureMetadata = {
  timestamp: string;
  deltaTime: number;
  chapter: 'dimension';
  gridX: number;
  gridY: number;
  pixelCount: number;
  motion: number;
  stillness: number;
  entropy: number;
  contrast: number;
  edgeDensity: number;
  lumaAverage: number;
  lumaVariance: number;
  averageRGB: { r: number; g: number; b: number };
  dominantRGB: { r: number; g: number; b: number };
  centerRGB: { r: number; g: number; b: number };
  saturationAverage: number;
  colorRichness: number;
  canvasSize: { width: number; height: number };
  exportSize: { width: number; height: number };
  videoSize: { width: number; height: number };
  devicePixelRatio: number;
  screenSize: { width: number; height: number };
  samplingDensity: number;
  informationBudget: number;
  lowPowerState: boolean;
};

type DimensionFrameAnalysis = {
  entropy: number;
  contrast: number;
  edgeDensity: number;
  lumaAverage: number;
  lumaVariance: number;
  averageRGB: { r: number; g: number; b: number };
  dominantRGB: { r: number; g: number; b: number };
  centerRGB: { r: number; g: number; b: number };
  saturationAverage: number;
  colorRichness: number;
};

const MIRROR_ASPECT = 806 / 1125;

const INNER_BOUNDS = {
  left: '3.7%',
  top: '3.1%',
  width: '92.6%',
  height: '93.4%',
} as const;

// 🟡 修复3：主镜面宽度改为响应式
// 原来写死 605px，在手机或小屏上会撑出屏幕边缘
// 改为 min(605px, 100vw - 48px)，保证在任何屏幕宽度下都有左右各 24px 的安全边距
// slicing 镜子布局参数（未改动）
const SLICE_MIRRORS: SliceMirrorConfig[] = Array.from({ length: 24 }, (_, i) => {
  const row = Math.floor(i / 6);
  const col = i % 6;
  const baseW = 112;
  const jitter = (((i * 17) % 7) - 3) * 6;
  return {
    id: i,
    x: 10 + col * 15 + (row % 2 ? 2.5 : -1.5) + (((i * 7) % 5) - 2),
    y: 12 + row * 20 + (col % 2 ? 1.8 : -1.2) + (((i * 11) % 4) - 1.5),
    width: baseW + jitter,
    rotate: -18 + ((i * 19) % 37),
    z: 20 + Math.round((row + 1) * 10 + ((i * 5) % 9)),
    ampX: 6 + (i % 4) * 2.2,
    ampY: 5 + (i % 3) * 2.1,
    speed: 0.22 + (i % 5) * 0.045,
    phase: i * 0.47,
  };
}).sort((a, b) => a.z - b.z);

// noclip 章节：空间图档数据
type NoclipAxis = { label: string; src: string };

type NoclipSpaceConfig = {
  id: string;
  axes: NoclipAxis[];
  top: string;
  left: string;
  width: string;
  rotate: number;
  z: number;
};

const NOCLIP_SPACES: NoclipSpaceConfig[] = [
  {
    id: '12314',
    axes: [
      { label: '+z', src: '/spaces/12314_pz.png' },  // 首图：俯视，有物体标注
      { label: '+x', src: '/spaces/12314_px.png' },
      { label: '−x', src: '/spaces/12314_nx.png' },
      { label: '+y', src: '/spaces/12314_py.png' },
      { label: '−y', src: '/spaces/12314_ny.png' },
      { label: '−z', src: '/spaces/12314_nz.png' },
    ],
    top: '8vh', left: '16vw', width: '52vw', rotate: -1.2, z: 2,
  },
  {
    id: '01',
    axes: [
      { label: '+x', src: '/spaces/01_px.png' },
      { label: '−x', src: '/spaces/01_nx.png' },
      { label: '+y', src: '/spaces/01_py.png' },
      { label: '+z', src: '/spaces/01_pz.png' },
      { label: '−z', src: '/spaces/01_nz.png' },
    ],
    top: '4vh', left: '62vw', width: '38vw', rotate: 2.1, z: 3,
  },
  {
    id: '02',
    axes: [
      { label: '+x', src: '/spaces/02_px.png' },
      { label: '−x', src: '/spaces/02_nx.png' },
      { label: '+y', src: '/spaces/02_py.png' },
      { label: '−y', src: '/spaces/02_ny.png' },
      { label: '+z', src: '/spaces/02_pz.png' },
      { label: '−z', src: '/spaces/02_nz.png' },
    ],
    top: '48vh', left: '2vw', width: '36vw', rotate: -2.4, z: 6,
  },
  {
    id: '03',
    axes: [
      { label: '+x', src: '/spaces/03_px.png' },
      { label: '−x', src: '/spaces/03_nx.png' },
      { label: '+y', src: '/spaces/03_py.png' },
      { label: '−y', src: '/spaces/03_ny.png' },
      { label: '+z', src: '/spaces/03_pz.png' },
      { label: '−z', src: '/spaces/03_nz.png' },
    ],
    top: '54vh', left: '38vw', width: '44vw', rotate: 1.5, z: 5,
  },
  {
    id: '14',
    axes: [
      { label: '+x', src: '/spaces/14_px.png' },
      { label: '−x', src: '/spaces/14_nx.png' },
      { label: '+y', src: '/spaces/14_py.png' },
      { label: '−y', src: '/spaces/14_ny.png' },
      { label: '+z', src: '/spaces/14_pz.png' },
      { label: '−z', src: '/spaces/14_nz.png' },
    ],
    top: '10vh', left: '-3vw', width: '25vw', rotate: 3.1, z: 4,
  },
];

type NoclipCutout = {
  src: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width: string;
};

// 首图物体标注：12314_pz.png (+z 俯视) 中可辨认的物体
// 坐标为 slide 容器百分比（已补偿 objectFit:cover 的水平裁切）
type IntroLabel = { text: string; left?: string; right?: string; top: string };

const INTRO_LABELS: IntroLabel[] = [
  { text: 'flat-pack shelves',  left: '36%', top: '14%' },
  { text: 'plastic chair',      left: '7%',  top: '24%' },
  { text: 'shopping bags',      left: '2%',  top: '18%' },
  { text: 'plastic wrap',       left: '48%', top: '50%' },
  { text: 'car mirror',         left: '39%', top: '46%' },
  { text: 'green bag',          left: '60%', top: '53%' },
  { text: 'red safety cover',   left: '9%',  top: '72%' },
  { text: 'blue drum',          right: '5%', top: '6%'  },
];

const NOCLIP_CUTOUTS: Record<string, NoclipCutout> = {
  '14':    { src: '/cutouts/14_cutout.png',    top: '10%',  left: '36%',  width: '48%' },
  '03':    { src: '/cutouts/03_cutout.png',    top: '-4%',  left: '-1%',  width: '20%' },
  '12314': { src: '/cutouts/12314_cutout.png', top: '-3%',  left: '14%',  width: '68%' },
  '01':    { src: '/cutouts/01_cutout.png',    top: '20%',  right: '6%',  width: '24%' },
  '02':    { src: '/cutouts/02_cutout.png',    top: '40%',  left: '16%',  width: '26%' },
};

// =========================
// 02 小工具函数（未改动）
// =========================
function drawCoverFromVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dw: number,
  dh: number
) {
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (!vW || !vH) return;
  const vRatio = vW / vH;
  const dRatio = dw / dh;
  let sx = 0, sy = 0, sw = vW, sh = vH;
  if (vRatio > dRatio) { sw = vH * dRatio; sx = (vW - sw) / 2; }
  else { sh = vW / dRatio; sy = (vH - sh) / 2; }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
}

function withBasePath(path: string, basePath: string) {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  if (!path.startsWith('/')) return `${basePath}/${path}`;
  return `${basePath}${path}`;
}

function analyzeDimensionPixels(data: Uint8ClampedArray, width: number, height: number): DimensionFrameAnalysis {
  const pxCount = Math.max(1, width * height);
  let rSum = 0, gSum = 0, bSum = 0, lumaSum = 0, lumaSqSum = 0;
  let satSum = 0, edgeSum = 0;
  const bins = new Array(16).fill(0);
  const colorBuckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      rSum += r; gSum += g; bSum += b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = max === 0 ? 0 : (max - min) / max;
      lumaSum += luma;
      lumaSqSum += luma * luma;
      satSum += sat;
      bins[Math.min(15, Math.floor(luma / 16))] += 1;
      const bucketKey = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = colorBuckets.get(bucketKey);
      if (bucket) {
        bucket.count += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        colorBuckets.set(bucketKey, { count: 1, r, g, b });
      }
      if (x < width - 1) {
        const j = i + 4;
        edgeSum += Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
      }
      if (y < height - 1) {
        const k = i + width * 4;
        edgeSum += Math.abs(r - data[k]) + Math.abs(g - data[k + 1]) + Math.abs(b - data[k + 2]);
      }
    }
  }
  const avgR = rSum / pxCount, avgG = gSum / pxCount, avgB = bSum / pxCount;
  const avgLuma = lumaSum / pxCount;
  const variance = lumaSqSum / pxCount - avgLuma * avgLuma;
  const contrast = Math.sqrt(Math.max(variance, 0));
  let entropy = 0;
  for (const count of bins) {
    if (count === 0) continue;
    const p = count / pxCount;
    entropy -= p * Math.log2(p);
  }
  let dominant = { count: 0, r: avgR, g: avgG, b: avgB };
  for (const bucket of colorBuckets.values()) {
    if (bucket.count > dominant.count) dominant = bucket;
  }
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const centerIndex = (centerY * width + centerX) * 4;
  return {
    entropy,
    contrast,
    edgeDensity: edgeSum / (pxCount * 6),
    lumaAverage: avgLuma,
    lumaVariance: variance,
    averageRGB: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
    dominantRGB: {
      r: Math.round(dominant.r / Math.max(1, dominant.count)),
      g: Math.round(dominant.g / Math.max(1, dominant.count)),
      b: Math.round(dominant.b / Math.max(1, dominant.count)),
    },
    centerRGB: { r: data[centerIndex], g: data[centerIndex + 1], b: data[centerIndex + 2] },
    saturationAverage: satSum / pxCount,
    colorRichness: colorBuckets.size / pxCount,
  };
}

function ChapterButton(props: {
  label: string;
  hovered: boolean;
  active: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const { label, hovered, active, onMouseEnter, onMouseLeave, onClick } = props;
  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.4)',
        fontSize: '24px',
        padding: 0,
        lineHeight: 1,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
        <span
          className={clarendonLight.className}
          style={{
            opacity: hovered || active ? 0 : 1,
            visibility: hovered || active ? 'hidden' : 'visible',
            transition: 'opacity 220ms ease',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {label}
        </span>
        <span
          className={clarendonBold.className}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: hovered || active ? 1 : 0,
            transition: 'opacity 220ms ease',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

// =========================
// 03 主组件
// =========================
export default function Home({ onBackHome }: { onBackHome?: () => void }) {

  // =========================
  // 10 核心引用：视频与画布
  // =========================
  const videoSourceRef = useRef<HTMLVideoElement | null>(null);
  const videoDisplayRef = useRef<HTMLVideoElement | null>(null);
  const slicingBgVideoRef = useRef<HTMLVideoElement | null>(null);
  const slicingLiveCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const rafSlicingLiveDrawRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dimensionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dimensionDirectoryRef = useRef<DimensionDirectoryHandle | null>(null);
  const dimensionCapturingRef = useRef(false);
  const dimensionScanCountRef = useRef(0);
  const dimensionSaveCountRef = useRef(0);
  const dimensionLastScanTimeRef = useRef<number | null>(null);
  const dimensionSaveQueueRef = useRef(Promise.resolve());
  const noclipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const noclipScrollRef = useRef<HTMLDivElement | null>(null);
  const sliceCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 🟡 修复4：用 ref 记录每个 slicing canvas 是否已经设置过尺寸
  // 原来每次 React 重新渲染都会在 ref 回调里重设 el.width / el.height
  // 重设 canvas 尺寸会清空画面内容，导致频繁切换时出现闪烁
  // 用这个 Set 记录"已经初始化过的 canvas 索引"，只初始化一次
  const slicingCanvasInitedRef = useRef<Set<number>>(new Set());

  // =========================
  // 11 循环与统计引用
  // =========================
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const rafMetaRef = useRef<number | null>(null);
  const rafDimensionRef = useRef<number | null>(null);
  const rafNoclipRef = useRef<number | null>(null);
  const rafSlicingFloatRef = useRef<number | null>(null);
  const slicingIntervalRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const lastLogTimeRef = useRef(0);
  const sliceWriteIndexRef = useRef(0);

  // =========================
  // 12 基础 UI 状态
  // =========================
  const [hasStarted, setHasStarted] = useState(false);
  const [isHomeHovered, setIsHomeHovered] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [isMetaHovered, setIsMetaHovered] = useState(false);
  const [isInfoPinned, setIsInfoPinned] = useState(false);
  const [isMetaPinned, setIsMetaPinned] = useState(false);
  const [hoveredChapter, setHoveredChapter] = useState<ChapterMode>('none');
  const [activeChapter, setActiveChapter] = useState<ChapterMode>('none');
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  // 🟡 修复5：新增摄像头错误状态
  // 原来摄像头权限被拒绝时，页面没有任何反应，用户不知道发生了什么
  // 现在用 cameraError 存储错误信息，并在页面上显示提示
  const [cameraError, setCameraError] = useState<string | null>(null);

  // =========================
  // 13 元数据与 slicing 状态
  // =========================
  const [metaLog, setMetaLog] = useState<string[]>([]);
  const [sliceFrames, setSliceFrames] = useState<SliceFrame[]>([]);
  const [slicingTime, setSlicingTime] = useState(0);
  const [dimensionCaptureStatus, setDimensionCaptureStatus] = useState({
    capturing: false,
    frameCount: 0,
    saveCount: 0,
  });

  // =========================
  // 14 noclip 素材
  // =========================
  const [noclipImages, setNoclipImages] = useState<string[]>([]);
  const [activeNoclipImage, setActiveNoclipImage] = useState<string | null>(null);
  // noclip 滚动位置（像素）
  const [noclipScrollY, setNoclipScrollY] = useState(0);
  const [noclipInfiniteCount, setNoclipInfiniteCount] = useState(36);

  // =========================
  // 20 读取 noclip 清单（未改动）
  // =========================
  useEffect(() => {
    const updateViewport = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(withBasePath('/noclip/images/index.json', basePath));
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) return;
        const json = (await res.json()) as NoclipIndexFile;
        if (cancelled) return;
        if (json.images && Array.isArray(json.images)) {
          setNoclipImages(json.images.map((image) => withBasePath(image, basePath)));
        }
      } catch (err) {
        console.error('noclip index load error:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [basePath]);

  // =========================
  // 21 开启摄像头
  // =========================
  const startCamera = async () => {
    try {
      if (streamRef.current) return;

      // 🔴 修复3：指定 facingMode: 'user' 强制使用前置摄像头
      // 原来只写 video: true，手机上可能默认打开后置摄像头
      // facingMode: 'user' 表示"面向用户的摄像头"，即前置摄像头
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      // 🟡 修复5：成功获取摄像头后清除之前的错误提示
      setCameraError(null);
      streamRef.current = stream;
      setHasStarted(true);
    } catch (err) {
      console.error('camera error:', err);

      // 🟡 修复5：摄像头失败时显示具体原因
      // NotAllowedError = 用户拒绝了权限
      // NotFoundError = 设备没有摄像头
      // 其他情况显示通用提示
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setCameraError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头后刷新页面');
        } else if (err.name === 'NotFoundError') {
          setCameraError('未检测到摄像头设备');
        } else {
          setCameraError('无法开启摄像头，请检查设备或浏览器设置');
        }
      } else {
        setCameraError('无法开启摄像头，请检查设备或浏览器设置');
      }
    }
  };

  // =========================
  // 22 重置：关闭摄像头 + 清理所有循环
  // =========================
  const resetMirror = () => {
    // 停止摄像头轨道，释放设备权限（摄像头指示灯会熄灭）
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // 断开所有 video 元素的视频流
    if (videoSourceRef.current) videoSourceRef.current.srcObject = null;
    if (videoDisplayRef.current) videoDisplayRef.current.srcObject = null;
    if (slicingBgVideoRef.current) slicingBgVideoRef.current.srcObject = null;

    // 取消所有 requestAnimationFrame 渲染循环
    if (rafMetaRef.current) cancelAnimationFrame(rafMetaRef.current);
    if (rafDimensionRef.current) cancelAnimationFrame(rafDimensionRef.current);
    if (rafNoclipRef.current) cancelAnimationFrame(rafNoclipRef.current);
    if (rafSlicingFloatRef.current) cancelAnimationFrame(rafSlicingFloatRef.current);
    if (rafSlicingLiveDrawRef.current) cancelAnimationFrame(rafSlicingLiveDrawRef.current);

    rafMetaRef.current = null;
    rafDimensionRef.current = null;
    rafNoclipRef.current = null;
    rafSlicingFloatRef.current = null;
    rafSlicingLiveDrawRef.current = null;

    // 取消 slicing 定时截帧
    if (slicingIntervalRef.current) window.clearInterval(slicingIntervalRef.current);
    slicingIntervalRef.current = null;

    // 重置所有统计数据
    prevFrameRef.current = null;
    frameCountRef.current = 0;
    startTimeRef.current = null;
    lastLogTimeRef.current = 0;
    sliceWriteIndexRef.current = 0;

    // 🟡 修复4：重置 canvas 初始化记录，下次进入 slicing 重新初始化尺寸
    slicingCanvasInitedRef.current.clear();

    // 重置所有 UI 状态回到初始值
    stopDimensionCapture();
    setMetaLog([]);
    setSliceFrames([]);
    setSlicingTime(0);
    setActiveChapter('none');
    setActiveNoclipImage(null);
    setNoclipScrollY(0);
    setNoclipInfiniteCount(36);
    if (noclipScrollRef.current) noclipScrollRef.current.scrollTop = 0;
    setCameraError(null);
    setIsInfoPinned(false);
    setIsMetaPinned(false);
    setHasStarted(false);
  };

  // =========================
  // 🔴 修复1：新增 goHome 函数，正确处理从任何章节返回 home
  // 原来 Mirror home 按钮直接调用 setActiveChapter('none')
  // 这样跳过了 slicing 章节的清理逻辑，导致 startTimeRef、sliceFrames 等残留
  // 现在改为调用 goHome()，它会完整清理 slicing 相关状态
  // =========================
  const goHome = () => {
    // 如果当前在 slicing 章节，需要额外清理 slicing 的专属状态
    if (activeChapter === 'slicing') {
      setSliceFrames([]);
      sliceWriteIndexRef.current = 0;
      startTimeRef.current = null;

      // 停止 slicing 的定时截帧
      if (slicingIntervalRef.current) {
        window.clearInterval(slicingIntervalRef.current);
        slicingIntervalRef.current = null;
      }

      // 停止 slicing 的浮动动画循环
      if (rafSlicingFloatRef.current) {
        cancelAnimationFrame(rafSlicingFloatRef.current);
        rafSlicingFloatRef.current = null;
      }

      // 停止 slicing 的实时画面绘制循环
      if (rafSlicingLiveDrawRef.current) {
        cancelAnimationFrame(rafSlicingLiveDrawRef.current);
        rafSlicingLiveDrawRef.current = null;
      }
    }
    if (activeChapter === 'dimension') stopDimensionCapture();

    // 切换章节到 home（摄像头继续保持开启，只是换回普通镜子显示）
    setActiveChapter('none');
    setIsInfoPinned(false);
    setIsMetaPinned(false);
  };

  const stopDimensionCapture = () => {
    dimensionCapturingRef.current = false;
    dimensionLastScanTimeRef.current = null;
    setDimensionCaptureStatus((prev) => ({ ...prev, capturing: false }));
  };

  const writeDimensionFile = useCallback(async (filename: string, blob: Blob) => {
    if (!dimensionDirectoryRef.current) throw new Error('Dimension capture directory is not selected');
    const fileHandle = await dimensionDirectoryRef.current.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }, []);

  const formatDimensionTimestamp = useCallback((date: Date) => {
    const pad = (n: number, size = 2) => String(n).padStart(size, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
  }, []);

  const saveDimensionCapture = useCallback(async (metadata: DimensionCaptureMetadata) => {
    const sourceCanvas = dimensionCanvasRef.current;
    if (!sourceCanvas) return;
    if (!sourceCanvas.width || !sourceCanvas.height) {
      console.error('dimension capture PNG export failed: canvas is empty');
      return;
    }
    const pngBlob = await new Promise<Blob | null>((resolve) => {
      sourceCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
    if (!pngBlob || pngBlob.size === 0) {
      console.error('dimension capture PNG export failed');
      return;
    }
    const rgb = metadata.dominantRGB;
    const baseName = `dimension__${formatDimensionTimestamp(new Date(metadata.timestamp))}__dt-${Math.round(metadata.deltaTime)}ms__grid-${metadata.gridX}x${metadata.gridY}__motion-${metadata.motion.toFixed(3)}__entropy-${metadata.entropy.toFixed(3)}__rgb-${rgb.r}-${rgb.g}-${rgb.b}`;
    const pngFilename = `${baseName}.png`;
    const jsonFilename = `${baseName}.json`;
    await writeDimensionFile(pngFilename, pngBlob);
    console.log(`dimension capture PNG saved: ${pngFilename}`);
    const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    await writeDimensionFile(jsonFilename, jsonBlob);
    console.log(`dimension capture JSON saved: ${jsonFilename}`);
  }, [formatDimensionTimestamp, writeDimensionFile]);

  const toggleDimensionCapture = async () => {
    if (dimensionCapturingRef.current) {
      stopDimensionCapture();
      return;
    }
    if (!dimensionDirectoryRef.current) {
      const pickerWindow = window as WindowWithDirectoryPicker;
      if (pickerWindow.showDirectoryPicker) {
        try {
          dimensionDirectoryRef.current = await pickerWindow.showDirectoryPicker();
        } catch {
          return;
        }
      } else {
        console.error('dimension capture requires showDirectoryPicker support');
        window.alert('图像采集需要使用支持文件夹选择的浏览器（例如 Chrome 或 Edge），并选择一个保存目录。');
        return;
      }
    }
    dimensionScanCountRef.current = 0;
    dimensionSaveCountRef.current = 0;
    dimensionLastScanTimeRef.current = null;
    dimensionCapturingRef.current = true;
    setDimensionCaptureStatus({ capturing: true, frameCount: 0, saveCount: 0 });
  };

  // =========================
  // 23 把 stream 挂到 videoSource 与 videoDisplay（未改动）
  // =========================
  useEffect(() => {
    if (!hasStarted || !streamRef.current) return;
    const stream = streamRef.current;
    if (videoSourceRef.current) {
      if (videoSourceRef.current.srcObject !== stream) videoSourceRef.current.srcObject = stream;
      videoSourceRef.current.play().catch(() => {});
    }
    if (videoDisplayRef.current) {
      if (videoDisplayRef.current.srcObject !== stream) videoDisplayRef.current.srcObject = stream;
      videoDisplayRef.current.play().catch(() => {});
    }
  }, [hasStarted]);

  // =========================
  // 23.1 slicing 背景补挂载（未改动）
  // =========================
  useEffect(() => {
    if (!hasStarted || activeChapter !== 'slicing') return;
    const stream = streamRef.current;
    const bg = slicingBgVideoRef.current;
    if (!stream || !bg) return;
    if (bg.srcObject !== stream) bg.srcObject = stream;
    bg.play().catch(() => {});
  }, [hasStarted, activeChapter]);

  // =========================
  // 24 切换章节（未改动）
  // =========================
  const activateChapter = (chapter: ChapterMode) => {
    if (chapter !== 'dimension') stopDimensionCapture();
    setActiveChapter(chapter);
    setIsInfoPinned(false);
    setIsMetaPinned(false);
    if (chapter === 'slicing') {
      setSliceFrames([]);
      sliceWriteIndexRef.current = 0;
      startTimeRef.current = performance.now();
    }
    if (chapter === 'noclipping') {
      if (rafMetaRef.current) { cancelAnimationFrame(rafMetaRef.current); rafMetaRef.current = null; }
      setNoclipScrollY(0);
      setNoclipInfiniteCount(36);
      if (noclipScrollRef.current) noclipScrollRef.current.scrollTop = 0;
      if (noclipImages.length) {
        const pick = noclipImages[Math.floor(Math.random() * noclipImages.length)];
        setActiveNoclipImage(pick || null);
      } else {
        setActiveNoclipImage(null);
      }
    }
  };

  // =========================
  // 30 slicing：浮动时间驱动（未改动）
  // =========================
  useEffect(() => {
    if (activeChapter !== 'slicing') return;
    const tick = () => {
      setSlicingTime(performance.now() / 1000);
      rafSlicingFloatRef.current = requestAnimationFrame(tick);
    };
    rafSlicingFloatRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafSlicingFloatRef.current) cancelAnimationFrame(rafSlicingFloatRef.current);
      rafSlicingFloatRef.current = null;
    };
  }, [activeChapter]);

  // =========================
  // 31 slicing：每 2.2 秒截一帧（未改动）
  // =========================
  useEffect(() => {
    if (!hasStarted || activeChapter !== 'slicing') return;
    const video = videoSourceRef.current;
    const canvas = sliceCaptureCanvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 240;
    const H = Math.round(W / MIRROR_ASPECT);
    canvas.width = W;
    canvas.height = H;
    const capture = () => {
      if (!video || video.readyState < 2) return;
      if (!video.videoWidth || !video.videoHeight) return;
      if (!startTimeRef.current) startTimeRef.current = performance.now();
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      ctx.clearRect(0, 0, W, H);
      drawCoverFromVideo(ctx, video, W, H);
      const src = canvas.toDataURL('image/jpeg', 0.72);
      const now = new Date();
      const frame: SliceFrame = {
        src,
        label: `${now.toLocaleTimeString('en-GB')}  +${elapsed.toFixed(1)}s`,
        elapsed,
      };
      const writeIndex = sliceWriteIndexRef.current;
      setSliceFrames((prev) => {
        const next = prev.slice();
        if (next.length < 24) next.push(frame);
        else next[writeIndex] = frame;
        return next;
      });
      sliceWriteIndexRef.current = (writeIndex + 1) % 24;
    };
    capture();
    slicingIntervalRef.current = window.setInterval(capture, 2200);
    return () => {
      if (slicingIntervalRef.current) window.clearInterval(slicingIntervalRef.current);
      slicingIntervalRef.current = null;
    };
  }, [hasStarted, activeChapter]);

  // =========================
  // 32 slicing：实时画面绘制到 24 个小 canvas（未改动）
  // =========================
  useEffect(() => {
    if (!hasStarted || activeChapter !== 'slicing') {
      if (rafSlicingLiveDrawRef.current) cancelAnimationFrame(rafSlicingLiveDrawRef.current);
      rafSlicingLiveDrawRef.current = null;
      return;
    }
    const video = videoSourceRef.current;
    if (!video) return;
    const draw = () => {
      if (!video.videoWidth || !video.videoHeight) {
        rafSlicingLiveDrawRef.current = requestAnimationFrame(draw);
        return;
      }
      for (let i = 0; i < 24; i += 1) {
        const c = slicingLiveCanvasRefs.current[i];
        if (!c) continue;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        ctx.clearRect(0, 0, c.width, c.height);
        drawCoverFromVideo(ctx, video, c.width, c.height);
      }
      rafSlicingLiveDrawRef.current = requestAnimationFrame(draw);
    };
    rafSlicingLiveDrawRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafSlicingLiveDrawRef.current) cancelAnimationFrame(rafSlicingLiveDrawRef.current);
      rafSlicingLiveDrawRef.current = null;
    };
  }, [hasStarted, activeChapter]);

  // =========================
  // 40 元数据分析（未改动）
  // =========================
  useEffect(() => {
    if (!hasStarted) return;
    const canvas = analysisCanvasRef.current;
    const video = videoSourceRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const sampleW = 48;
    const sampleH = 64;
    canvas.width = sampleW;
    canvas.height = sampleH;
    const update = () => {
      if (!video.videoWidth || !video.videoHeight) {
        rafMetaRef.current = requestAnimationFrame(update);
        return;
      }
      if (!startTimeRef.current) startTimeRef.current = performance.now();
      ctx.drawImage(video, 0, 0, sampleW, sampleH);
      const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
      const data = imageData.data;
      let rSum = 0, gSum = 0, bSum = 0, lumaSum = 0, lumaSqSum = 0;
      let satSum = 0, motionSum = 0, edgeSum = 0;
      const bins = new Array(16).fill(0);
      for (let y = 0; y < sampleH; y += 1) {
        for (let x = 0; x < sampleW; x += 1) {
          const i = (y * sampleW + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          rSum += r; gSum += g; bSum += b;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const sat = max === 0 ? 0 : (max - min) / max;
          lumaSum += luma; lumaSqSum += luma * luma; satSum += sat;
          bins[Math.min(15, Math.floor(luma / 16))] += 1;
          if (prevFrameRef.current) {
            motionSum += Math.abs(r - prevFrameRef.current[i])
              + Math.abs(g - prevFrameRef.current[i + 1])
              + Math.abs(b - prevFrameRef.current[i + 2]);
          }
          if (x < sampleW - 1) {
            const j = i + 4;
            edgeSum += Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
          }
          if (y < sampleH - 1) {
            const k = i + sampleW * 4;
            edgeSum += Math.abs(r - data[k]) + Math.abs(g - data[k + 1]) + Math.abs(b - data[k + 2]);
          }
        }
      }
      const pxCount = sampleW * sampleH;
      const avgR = rSum / pxCount, avgG = gSum / pxCount, avgB = bSum / pxCount;
      const avgLuma = lumaSum / pxCount;
      const variance = lumaSqSum / pxCount - avgLuma * avgLuma;
      const contrast = Math.sqrt(Math.max(variance, 0));
      const avgSat = satSum / pxCount;
      const motion = prevFrameRef.current ? motionSum / (pxCount * 3) : 0;
      const edgeDensity = edgeSum / (pxCount * 6);
      let entropy = 0;
      for (const count of bins) {
        if (count === 0) continue;
        const p = count / pxCount;
        entropy -= p * Math.log2(p);
      }
      const centerX = Math.floor(sampleW / 2);
      const centerY = Math.floor(sampleH / 2);
      const centerIndex = (centerY * sampleW + centerX) * 4;
      const centerR = data[centerIndex], centerG = data[centerIndex + 1], centerB = data[centerIndex + 2];
      const elapsed = (performance.now() - (startTimeRef.current || performance.now())) / 1000;
      frameCountRef.current += 1;
      const fps = frameCountRef.current / Math.max(elapsed, 0.001);
      const dominantChannel = avgR > avgG && avgR > avgB ? 'R' : avgG > avgB ? 'G' : 'B';
      const deviceNavigator = navigator as NavigatorWithDeviceInfo;
      const connection = deviceNavigator.connection?.effectiveType ?? 'n/a';
      const memory = deviceNavigator.deviceMemory ?? 'n/a';
      const cores = navigator.hardwareConcurrency ?? 'n/a';
      const colorDepth = window.screen.colorDepth ?? 'n/a';
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'n/a';
      const now = performance.now();
      if (now - lastLogTimeRef.current > 320) {
        const timestamp = new Date().toLocaleTimeString('en-GB');
        const chunk = [
          `[${timestamp}] frame:${frameCountRef.current} fps:${fps.toFixed(2)} elapsed:${elapsed.toFixed(3)}s`,
          `video:${video.videoWidth}x${video.videoHeight} sample:${sampleW}x${sampleH} ps:${video.videoWidth * video.videoHeight} aspect:${(video.videoWidth / video.videoHeight).toFixed(5)}`,
          `rgb.avg r:${avgR.toFixed(2)} g:${avgG.toFixed(2)} b:${avgB.toFixed(2)} center r:${centerR} g:${centerG} b:${centerB}`,
          `image.luma:${avgLuma.toFixed(3)} contrast:${contrast.toFixed(3)} variance:${variance.toFixed(3)} saturation:${avgSat.toFixed(4)}`,
          `image.entropy:${entropy.toFixed(4)} edge:${edgeDensity.toFixed(5)} motion:${motion.toFixed(5)} dominant:${dominantChannel}`,
          `ratio r/g:${(avgR / (avgG + 0.001)).toFixed(3)} g/b:${(avgG / (avgB + 0.001)).toFixed(3)} r/b:${(avgR / (avgB + 0.001)).toFixed(3)}`,
          `structure.index:${(entropy * contrast).toFixed(4)} noise.index:${(variance / (avgLuma + 0.001)).toFixed(4)} stability:${(1 / (motion + 0.001)).toFixed(4)}`,
          `human.presence:${(avgSat * contrast).toFixed(4)} face.likelihood:${(contrast / (motion + 0.1)).toFixed(4)} visibility:${(avgLuma / 255).toFixed(4)}`,
          `occlusion:${(motion / (edgeDensity + 0.001)).toFixed(4)} center.weight:${((centerR + centerG + centerB) / (avgR + avgG + avgB + 0.001)).toFixed(3)} temporal.drift:${Math.abs(motion - avgLuma).toFixed(4)}`,
          `state:${avgLuma < 60 ? 'low-light' : avgLuma > 180 ? 'over-exposed' : 'normal-range'} color.state:${avgSat < 0.1 ? 'desaturated' : avgSat > 0.5 ? 'vivid' : 'neutral'}`,
          `device.dpr:${window.devicePixelRatio.toFixed(2)} screen:${window.innerWidth}x${window.innerHeight} colordepth:${colorDepth} language:${navigator.language}`,
          `system.cores:${cores} memory:${memory} network:${connection} timezone:${timezone}`,
          `camera:active capture:live sensor:rolling`,
          `---`,
        ];
        setMetaLog((prev) => [...chunk, ...prev].slice(0, 42));
        lastLogTimeRef.current = now;
      }
      prevFrameRef.current = new Uint8ClampedArray(data);
      rafMetaRef.current = requestAnimationFrame(update);
    };
    rafMetaRef.current = requestAnimationFrame(update);
    return () => {
      if (rafMetaRef.current) cancelAnimationFrame(rafMetaRef.current);
      rafMetaRef.current = null;
    };
  }, [hasStarted]);

  // =========================
  // 50 Dimension（未改动）
  // =========================
  useEffect(() => {
    if (!hasStarted || activeChapter !== 'dimension') return;
    const video = videoSourceRef.current;
    const canvas = dimensionCanvasRef.current;
    if (!video || !canvas) return;
    const displayW = 520;
    const displayH = Math.round(displayW / MIRROR_ASPECT);
    canvas.width = displayW;
    canvas.height = displayH;
    const displayCtx = canvas.getContext('2d');
    if (!displayCtx) return;
    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return;
    const minGridX = 1;
    const maxGridX = 18;
    const analysisInterval = 33.3;
    const captureInterval = 900;
    let previousSignalImg: Uint8ClampedArray | null = null;
    let smoothedDensity = 0;
    let lastAnalysisTime = 0;
    let motion = 0;
    let stillness = 1;
    let gridX = minGridX;
    let gridY = Math.max(1, Math.round(gridX / 0.716));
    const draw = (now: number) => {
      if (!video.videoWidth || !video.videoHeight) {
        rafDimensionRef.current = requestAnimationFrame(draw);
        return;
      }
      const vW = video.videoWidth, vH = video.videoHeight;
      const vRatio = vW / vH;
      if (now - lastAnalysisTime >= analysisInterval) {
        lastAnalysisTime = now;
        const signalW = maxGridX;
        const signalH = Math.max(1, Math.round(signalW / 0.716));
        sampleCanvas.width = signalW;
        sampleCanvas.height = signalH;
        sampleCtx.clearRect(0, 0, signalW, signalH);
        const signalRatio = signalW / signalH;
        let signalSx = 0, signalSy = 0, signalSw = vW, signalSh = vH;
        if (vRatio > signalRatio) { signalSw = vH * signalRatio; signalSx = (vW - signalSw) / 2; }
        else { signalSh = vW / signalRatio; signalSy = (vH - signalSh) / 2; }
        sampleCtx.drawImage(video, signalSx, signalSy, signalSw, signalSh, 0, 0, signalW, signalH);
        const signalImg = sampleCtx.getImageData(0, 0, signalW, signalH).data;
        let motionSum = 0;
        for (let y = 0; y < signalH; y += 1) {
          for (let x = 0; x < signalW; x += 1) {
            const i = (y * signalW + x) * 4;
            if (previousSignalImg) {
              motionSum += Math.abs(signalImg[i] - previousSignalImg[i])
                + Math.abs(signalImg[i + 1] - previousSignalImg[i + 1])
                + Math.abs(signalImg[i + 2] - previousSignalImg[i + 2]);
            }
          }
        }
        const signalPx = signalW * signalH;
        motion = previousSignalImg ? motionSum / (signalPx * 3) : 0;
        stillness = Math.max(0, Math.min(1, 1 - motion / 28));
        const targetDensity = Math.max(0, Math.min(1, motion / 24));
        const smoothing = 0.22;
        smoothedDensity += (targetDensity - smoothedDensity) * smoothing;
        previousSignalImg = new Uint8ClampedArray(signalImg);
        gridX = Math.max(minGridX, Math.min(maxGridX, Math.round(minGridX + smoothedDensity * (maxGridX - minGridX))));
        gridY = Math.max(1, Math.round(gridX / 0.716));
      }
      const renderRatio = gridX / gridY;
      let sx = 0, sy = 0, sw = vW, sh = vH;
      if (vRatio > renderRatio) { sw = vH * renderRatio; sx = (vW - sw) / 2; }
      else { sh = vW / renderRatio; sy = (vH - sh) / 2; }
      sampleCanvas.width = gridX;
      sampleCanvas.height = gridY;
      sampleCtx.clearRect(0, 0, gridX, gridY);
      sampleCtx.drawImage(video, sx, sy, sw, sh, 0, 0, gridX, gridY);
      const gridImage = sampleCtx.getImageData(0, 0, gridX, gridY);
      displayCtx.clearRect(0, 0, displayW, displayH);
      displayCtx.imageSmoothingEnabled = false;
      displayCtx.drawImage(sampleCanvas, -1, -1, displayW + 2, displayH + 2);
      displayCtx.save();
      displayCtx.strokeStyle = 'rgba(0,0,0,0.06)';
      displayCtx.lineWidth = 1;
      const cellW = displayW / gridX;
      const cellH = displayH / gridY;
      for (let x = 0; x <= gridX; x += 1) {
        displayCtx.beginPath();
        displayCtx.moveTo(x * cellW, 0);
        displayCtx.lineTo(x * cellW, displayH);
        displayCtx.stroke();
      }
      for (let y = 0; y <= gridY; y += 1) {
        displayCtx.beginPath();
        displayCtx.moveTo(0, y * cellH);
        displayCtx.lineTo(displayW, y * cellH);
        displayCtx.stroke();
      }
      displayCtx.restore();
      if (dimensionCapturingRef.current) {
        dimensionScanCountRef.current += 1;
        const lastScanTime = dimensionLastScanTimeRef.current;
        const shouldSave = lastScanTime === null || now - lastScanTime >= captureInterval;
        if (shouldSave) {
          const analysis = analyzeDimensionPixels(gridImage.data, gridX, gridY);
          const deltaTime = lastScanTime === null ? 0 : now - lastScanTime;
          const metadata: DimensionCaptureMetadata = {
            timestamp: new Date().toISOString(),
            deltaTime,
            chapter: 'dimension',
            gridX,
            gridY,
            pixelCount: gridX * gridY,
            motion,
            stillness,
            samplingDensity: smoothedDensity,
            informationBudget: gridX * gridY * Math.max(0, analysis.entropy),
            lowPowerState: stillness > 0.82,
            canvasSize: { width: displayW, height: displayH },
            exportSize: { width: displayW, height: displayH },
            videoSize: { width: video.videoWidth, height: video.videoHeight },
            devicePixelRatio: window.devicePixelRatio,
            screenSize: { width: window.innerWidth, height: window.innerHeight },
            ...analysis,
          };
          dimensionLastScanTimeRef.current = now;
          dimensionSaveCountRef.current += 1;
          const saveCount = dimensionSaveCountRef.current;
          dimensionSaveQueueRef.current = dimensionSaveQueueRef.current
            .then(() => saveDimensionCapture(metadata))
            .catch((err) => console.error('dimension capture save error:', err));
          setDimensionCaptureStatus({
            capturing: true,
            frameCount: dimensionScanCountRef.current,
            saveCount,
          });
        } else if (dimensionScanCountRef.current % 12 === 0) {
          setDimensionCaptureStatus((prev) => ({
            ...prev,
            frameCount: dimensionScanCountRef.current,
          }));
        }
      }
      rafDimensionRef.current = requestAnimationFrame(draw);
    };
    rafDimensionRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafDimensionRef.current) cancelAnimationFrame(rafDimensionRef.current);
      rafDimensionRef.current = null;
    };
  }, [hasStarted, activeChapter, saveDimensionCapture]);

  // =========================
  // 60 Noclipping（空间拼贴）
  // =========================
  useEffect(() => {
    if (!hasStarted || activeChapter !== 'noclipping') return;
    const video = videoSourceRef.current;
    const outCanvas = noclipCanvasRef.current;
    if (!video || !outCanvas) return;
    const width = 320;
    const height = Math.round(width / MIRROR_ASPECT);
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) return;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width; srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) return;
    let mounted = true;

    type NoclipFragment = {
      x: number;
      y: number;
      w: number;
      h: number;
      points: Array<{ x: number; y: number }>;
      replace: boolean;
      depth: number;
      img: HTMLImageElement | null;
      crop: { sx: number; sy: number; sw: number; sh: number };
      rotation: number;
      scale: number;
      offsetX: number;
      offsetY: number;
      edgeAngle: number;
      text: string | null;
      textSize: number;
      liveIndex: number;
    };

    const loadedImages: HTMLImageElement[] = [];
    const liveCanvases: HTMLCanvasElement[] = Array.from({ length: 8 }, () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    });
    let liveWriteIndex = 0;
    let liveCapturedCount = 0;
    let lastLiveCaptureTime = -1000;
    const imageSources = noclipImages.length ? noclipImages : activeNoclipImage ? [activeNoclipImage] : [];
    imageSources.forEach((src) => {
      const img = new Image();
      img.onload = () => { if (mounted) loadedImages.push(img); };
      img.onerror = (e) => console.error('noclipping image load error:', e);
      img.src = src;
    });

    const fontName = 'RorrimNoclip';
    let fontReady = false;
    if ('FontFace' in window) {
      const font = new FontFace(fontName, `url(${withBasePath('/noclip/rorrim.otf', basePath)})`);
      font.load()
        .then((loadedFont) => {
          if (!mounted) return;
          document.fonts.add(loadedFont);
          fontReady = true;
        })
        .catch(() => { fontReady = false; });
    }

    const rand = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const regionStats = (data: Uint8ClampedArray, x: number, y: number, w: number, h: number) => {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(width - 1, Math.floor(x + w));
      const y1 = Math.min(height - 1, Math.floor(y + h));
      let luma = 0, lumaSq = 0, edge = 0, count = 0, dx = 0, dy = 0;
      const buckets = new Map<number, number>();
      for (let py = y0; py <= y1; py += 3) {
        for (let px = x0; px <= x1; px += 3) {
          const i = (py * width + px) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          luma += l;
          lumaSq += l * l;
          buckets.set(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5), (buckets.get(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)) || 0) + 1);
          if (px + 3 <= x1) {
            const j = (py * width + px + 3) * 4;
            const next = 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
            const diff = next - l;
            edge += Math.abs(diff);
            dx += diff;
          }
          if (py + 3 <= y1) {
            const k = ((py + 3) * width + px) * 4;
            const next = 0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2];
            const diff = next - l;
            edge += Math.abs(diff);
            dy += diff;
          }
          count += 1;
        }
      }
      const avg = luma / Math.max(1, count);
      const variance = lumaSq / Math.max(1, count) - avg * avg;
      return {
        contrast: Math.sqrt(Math.max(0, variance)) / 64,
        edge: Math.min(1, edge / Math.max(1, count * 42)),
        colorBlocks: buckets.size,
        angle: Math.atan2(dy, dx || 0.001),
      };
    };

    const makeClip = (ctx: CanvasRenderingContext2D, points: NoclipFragment['points']) => {
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.clip();
    };

    let fragments: NoclipFragment[] = [];
    let lastPlanTime = -1000;
    const rebuildPlan = (frame: ImageData, now: number) => {
      const next: NoclipFragment[] = [];
      let y = -8;
      let row = 0;
      while (y < height) {
        const rowSeed = Math.floor(now / 900) * 97 + row * 41;
        const baseH = 34 + rand(rowSeed) * 62;
        let x = -10;
        let col = 0;
        while (x < width) {
          const seed = rowSeed + col * 131;
          const baseW = 38 + rand(seed + 1) * 76;
          const stats = regionStats(frame.data, x, y, baseW, baseH);
          const split = stats.edge > 0.34 || stats.contrast > 0.42;
          const cols = split ? 2 : 1;
          const rows = split && rand(seed + 2) > 0.35 ? 2 : 1;
          for (let sy = 0; sy < rows; sy += 1) {
            for (let sx = 0; sx < cols; sx += 1) {
              const fragSeed = seed + sx * 17 + sy * 29;
              const fw = baseW / cols + rand(fragSeed + 3) * 10;
              const fh = baseH / rows + rand(fragSeed + 4) * 10;
              const fx = x + sx * (baseW / cols) + (rand(fragSeed + 5) - 0.5) * 12;
              const fy = y + sy * (baseH / rows) + (rand(fragSeed + 6) - 0.5) * 12;
              const overlap = stats.edge > 0.32 ? 3 : 11;
              const img = loadedImages.length ? loadedImages[Math.floor(rand(fragSeed + 7) * loadedImages.length)] : null;
              const naturalW = img?.naturalWidth || 1;
              const naturalH = img?.naturalHeight || 1;
              const cropScale = 0.38 + rand(fragSeed + 8) * 0.54;
              const sw = Math.max(1, naturalW * cropScale);
              const sh = Math.max(1, naturalH * cropScale);
              const sxCrop = Math.max(0, rand(fragSeed + 9) * Math.max(1, naturalW - sw));
              const syCrop = Math.max(0, rand(fragSeed + 10) * Math.max(1, naturalH - sh));
              const jitter = 6 + rand(fragSeed + 11) * 16;
              next.push({
                x: fx - overlap / 2,
                y: fy - overlap / 2,
                w: fw + overlap,
                h: fh + overlap,
                points: [
                  { x: fx + (rand(fragSeed + 12) - 0.5) * jitter, y: fy + (rand(fragSeed + 13) - 0.5) * jitter },
                  { x: fx + fw + (rand(fragSeed + 14) - 0.5) * jitter, y: fy + (rand(fragSeed + 15) - 0.5) * jitter },
                  { x: fx + fw + (rand(fragSeed + 16) - 0.5) * jitter, y: fy + fh + (rand(fragSeed + 17) - 0.5) * jitter },
                  { x: fx + (rand(fragSeed + 18) - 0.5) * jitter, y: fy + fh + (rand(fragSeed + 19) - 0.5) * jitter },
                ],
                replace: !!img && rand(fragSeed + 20) < 0.58 - stats.edge * 0.18 + stats.contrast * 0.16,
                depth: fy + rand(fragSeed + 21) * 90 - stats.edge * 35,
                img,
                crop: { sx: sxCrop, sy: syCrop, sw, sh },
                rotation: (rand(fragSeed + 22) - 0.5) * (Math.PI / 6),
                scale: 0.5 + rand(fragSeed + 23) * 2,
                offsetX: (rand(fragSeed + 24) - 0.5) * 24,
                offsetY: (rand(fragSeed + 25) - 0.5) * 24,
                edgeAngle: stats.angle,
                text: rand(fragSeed + 26) > 0.84 ? 'MIRROR'.charAt(Math.floor(rand(fragSeed + 27) * 6)) : null,
                textSize: Math.max(28, Math.min(110, Math.max(fw, fh) * (0.8 + rand(fragSeed + 28) * 1.4))),
                liveIndex: Math.floor(rand(fragSeed + 29) * liveCanvases.length),
              });
            }
          }
          x += baseW * (0.84 + rand(seed + 30) * 0.22);
          col += 1;
        }
        y += baseH * (0.82 + rand(rowSeed + 31) * 0.26);
        row += 1;
      }
      fragments = next.sort((a, b) => a.depth - b.depth);
      lastPlanTime = now;
    };

    const draw = () => {
      if (!mounted) return;
      if (!video.videoWidth || !video.videoHeight) {
        rafNoclipRef.current = requestAnimationFrame(draw);
        return;
      }
      srcCtx.clearRect(0, 0, width, height);
      drawCoverFromVideo(srcCtx, video, width, height);
      const frame = srcCtx.getImageData(0, 0, width, height);
      const now = performance.now();
      if (now - lastLiveCaptureTime > 260) {
        const liveCanvas = liveCanvases[liveWriteIndex];
        const liveCtx = liveCanvas.getContext('2d');
        if (liveCtx) {
          liveCtx.clearRect(0, 0, width, height);
          liveCtx.drawImage(srcCanvas, 0, 0);
          liveWriteIndex = (liveWriteIndex + 1) % liveCanvases.length;
          liveCapturedCount = Math.min(liveCapturedCount + 1, liveCanvases.length);
          lastLiveCaptureTime = now;
        }
      }
      if (!fragments.length || now - lastPlanTime > 1100) rebuildPlan(frame, now);
      outCtx.clearRect(0, 0, width, height);
      outCtx.fillStyle = '#f4f1eb';
      outCtx.fillRect(0, 0, width, height);
      for (const fragment of fragments) {
        outCtx.save();
        makeClip(outCtx, fragment.points);
        outCtx.translate(fragment.x + fragment.w / 2 + fragment.offsetX, fragment.y + fragment.h / 2 + fragment.offsetY);
        outCtx.rotate(fragment.rotation);
        const liveCanvas = liveCapturedCount > 2
          ? liveCanvases[(liveWriteIndex + liveCanvases.length - 1 - fragment.liveIndex) % liveCanvases.length]
          : null;
        if (fragment.replace && liveCanvas && (!fragment.img || fragment.liveIndex % 3 !== 0)) {
          const sx = Math.max(0, Math.min(width - 1, fragment.crop.sx % width));
          const sy = Math.max(0, Math.min(height - 1, fragment.crop.sy % height));
          const sw = Math.max(1, Math.min(width - sx, fragment.crop.sw % width || fragment.w));
          const sh = Math.max(1, Math.min(height - sy, fragment.crop.sh % height || fragment.h));
          const dw = fragment.w * fragment.scale;
          const dh = fragment.h * fragment.scale;
          outCtx.drawImage(liveCanvas, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        } else if (fragment.replace && fragment.img) {
          const dw = fragment.w * fragment.scale;
          const dh = fragment.h * fragment.scale;
          outCtx.drawImage(fragment.img, fragment.crop.sx, fragment.crop.sy, fragment.crop.sw, fragment.crop.sh, -dw / 2, -dh / 2, dw, dh);
        } else {
          outCtx.drawImage(srcCanvas, fragment.x, fragment.y, fragment.w, fragment.h, -fragment.w / 2, -fragment.h / 2, fragment.w, fragment.h);
        }
        if (fragment.text) {
          outCtx.globalCompositeOperation = 'multiply';
          outCtx.fillStyle = '#111';
          outCtx.font = `${fragment.textSize}px ${fontReady ? fontName : 'serif'}`;
          outCtx.textAlign = 'center';
          outCtx.textBaseline = 'middle';
          outCtx.rotate(fragment.edgeAngle * 0.35);
          outCtx.fillText(fragment.text, 0, 0);
          outCtx.globalCompositeOperation = 'source-over';
        }
        outCtx.restore();
      }
      rafNoclipRef.current = requestAnimationFrame(draw);
    };
    rafNoclipRef.current = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      if (rafNoclipRef.current) cancelAnimationFrame(rafNoclipRef.current);
      rafNoclipRef.current = null;
    };
  }, [hasStarted, activeChapter, activeNoclipImage, basePath, noclipImages]);

  // =========================
  // 70 卸载清理（未改动）
  // =========================
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (rafMetaRef.current) cancelAnimationFrame(rafMetaRef.current);
      if (rafDimensionRef.current) cancelAnimationFrame(rafDimensionRef.current);
      if (rafNoclipRef.current) cancelAnimationFrame(rafNoclipRef.current);
      if (rafSlicingFloatRef.current) cancelAnimationFrame(rafSlicingFloatRef.current);
      if (rafSlicingLiveDrawRef.current) cancelAnimationFrame(rafSlicingLiveDrawRef.current);
      if (slicingIntervalRef.current) window.clearInterval(slicingIntervalRef.current);
    };
  }, []);

  // =========================
  // 80 顶部导航透明度（未改动）
  // =========================
  const isMobile = viewportSize.width > 0 ? viewportSize.width <= 768 : false;
  const viewportHeight = viewportSize.height > 0 ? `${viewportSize.height}px` : '100dvh';
  const showInfoOverlay = isInfoHovered || isInfoPinned;
  const showMetaOverlay = isMetaHovered || isMetaPinned;
  const mainMirrorStyle = {
    position: 'relative' as const,
    width: isMobile
      ? 'min(calc(100vw - 32px), calc((100dvh - 160px) * 806 / 1125))'
      : 'min(605px, calc(100vw - 48px), calc((100dvh - 80px) * 806 / 1125))',
    aspectRatio: '806 / 1125',
    zIndex: 2,
  };

  const topNavChapterOpacity = useMemo(() => ({
    opacity: hasStarted ? 1 : 0,
    pointerEvents: hasStarted ? ('auto' as const) : ('none' as const),
    transition: 'opacity 1100ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '12px' : '28px',
    flexWrap: 'wrap' as const,
  }), [hasStarted, isMobile]);

  // =========================
  // 81 meta picture 覆盖层（未改动）
  // =========================
  const renderMetaOverlay = () => {
    if (!showMetaOverlay) return null;
    return (
      <div style={{
        position: 'absolute',
        left: INNER_BOUNDS.left, top: INNER_BOUNDS.top,
        width: INNER_BOUNDS.width, height: INNER_BOUNDS.height,
        background: '#fff', zIndex: 2, overflow: 'hidden',
        padding: isMobile ? '12px 14px' : '18px 20px', boxSizing: 'border-box',
      }}>
        <div className={monaco.className} style={{
          width: '100%', height: '100%', color: 'rgba(0,0,0,0.62)',
          fontSize: isMobile ? '9px' : '11px', lineHeight: 1.9, textAlign: 'left', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          justifyContent: 'flex-start', gap: '3px', whiteSpace: 'nowrap', letterSpacing: '0.15px',
        }}>
          {metaLog.map((line, index) => (
            <div key={index} style={{ width: '100%', overflow: 'hidden', textOverflow: 'clip' }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // =========================
  // 82 普通镜子（未改动）
  // =========================
  const renderNormalMirror = () => (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      filter: showInfoOverlay ? 'blur(28px)' : 'none', transition: 'filter 300ms ease',
    }}>
      <div style={{
        position: 'absolute', left: INNER_BOUNDS.left, top: INNER_BOUNDS.top,
        width: INNER_BOUNDS.width, height: INNER_BOUNDS.height, overflow: 'hidden', zIndex: 1,
      }}>
        <video ref={videoDisplayRef} autoPlay playsInline muted style={{
          width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
        }} />
      </div>
      {renderMetaOverlay()}
      <img src={withBasePath('/Mirror-frame.png', basePath)} alt='' style={{
        width: '100%', display: 'block', zIndex: 3, position: 'relative', pointerEvents: 'none',
      }} />
    </div>
  );

  // =========================
  // 83 Dimension 镜子（未改动）
  // =========================
  const renderDimensionMirror = () => (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      filter: showInfoOverlay ? 'blur(28px)' : 'none', transition: 'filter 300ms ease',
    }}>
      <div style={{
        position: 'absolute', left: INNER_BOUNDS.left, top: INNER_BOUNDS.top,
        width: INNER_BOUNDS.width, height: INNER_BOUNDS.height,
        overflow: 'hidden', zIndex: 1, background: '#fff',
      }}>
        <canvas ref={dimensionCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      {renderMetaOverlay()}
      <img src={withBasePath('/Mirror-frame.png', basePath)} alt='' style={{
        width: '100%', display: 'block', zIndex: 3, position: 'relative', pointerEvents: 'none',
      }} />
    </div>
  );

  // =========================
  // 84 Noclipping 场景（无尽空间滚动 + 视差 + 抠图浮层）
  // =========================
  const renderNoclipScene = () => {
    const VH = viewportSize.height || 900;
    const bandH = Math.max(220, VH * 0.5);
    const totalH = Math.ceil(noclipInfiniteCount * bandH + VH * 2);
    const visibleStart = Math.max(0, Math.floor((noclipScrollY - VH) / bandH));
    const visibleEnd = Math.min(noclipInfiniteCount, Math.ceil((noclipScrollY + VH * 1.8) / bandH));
    const rand = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const visibleItems = Array.from({ length: Math.max(0, visibleEnd - visibleStart) }, (_, offset) => visibleStart + offset);

    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#f4f1eb',
        overflow: 'hidden', zIndex: 2,
        filter: showInfoOverlay ? 'blur(28px)' : 'none',
        transition: 'filter 300ms ease',
      }}>

        {/* 滚动捕获层：透明置顶，截获滚轮/触摸 */}
        <div
          ref={noclipScrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const nextY = el.scrollTop;
            setNoclipScrollY(nextY);
            if (el.scrollHeight - (nextY + el.clientHeight) < VH * 4) {
              setNoclipInfiniteCount((count) => count + 18);
            }
          }}
          style={{
            position: 'absolute', inset: 0,
            overflowY: 'scroll',
            zIndex: 200,
            cursor: 'default',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ height: `${totalH}px` }} />
        </div>

        {/* 视觉图层 */}
        {visibleItems.map((i) => {
          const seed = 9103 + i * 7919;
          const space = NOCLIP_SPACES[Math.floor(rand(seed) * NOCLIP_SPACES.length)];
          const secondSpace = NOCLIP_SPACES[Math.floor(rand(seed + 1) * NOCLIP_SPACES.length)];
          const axisIdx = Math.floor(rand(seed + 2) * space.axes.length);
          const secondAxisIdx = Math.floor(rand(seed + 3) * secondSpace.axes.length);
          const cur = space.axes[axisIdx];
          const second = secondSpace.axes[secondAxisIdx];
          const cutout = NOCLIP_CUTOUTS[space.id];
          const secondCutout = NOCLIP_CUTOUTS[secondSpace.id];
          const yBase = i * bandH - noclipScrollY;
          const drift = (rand(seed + 4) - 0.5) * VH * 0.45;
          const parallax = yBase * (0.16 + rand(seed + 5) * 0.28);
          const monumental = rand(seed + 35) > 0.68;
          const huge = rand(seed + 36) > 0.46;
          const primaryW = isMobile
            ? (monumental ? 180 + rand(seed + 6) * 180 : 118 + rand(seed + 6) * 128)
            : (monumental ? 142 + rand(seed + 6) * 190 : 86 + rand(seed + 6) * 122);
          const primaryLeft = isMobile
            ? -98 + rand(seed + 7) * 130
            : -74 + rand(seed + 7) * 112;
          const primaryTop = yBase + drift;
          const secondaryW = isMobile
            ? (huge ? 92 + rand(seed + 8) * 120 : 58 + rand(seed + 8) * 76)
            : (huge ? 76 + rand(seed + 8) * 118 : 42 + rand(seed + 8) * 84);
          const secondaryLeft = isMobile
            ? -54 + rand(seed + 9) * 122
            : -46 + rand(seed + 9) * 118;
          const secondaryTop = yBase + bandH * (-0.18 + rand(seed + 10) * 0.92);
          const primaryRotate = -18 + rand(seed + 11) * 36;
          const secondaryRotate = -24 + rand(seed + 12) * 48;
          const labelSize = isMobile
            ? `clamp(96px, ${34 + rand(seed + 13) * 58}vw, 420px)`
            : `clamp(140px, ${18 + rand(seed + 13) * 24}vw, 620px)`;
          const labelLeft = -28 + rand(seed + 14) * 92;
          const labelTop = yBase + bandH * (-0.16 + rand(seed + 15) * 0.72);
          const tertiarySpace = NOCLIP_SPACES[Math.floor(rand(seed + 37) * NOCLIP_SPACES.length)];
          const tertiaryAxisIdx = Math.floor(rand(seed + 38) * tertiarySpace.axes.length);
          const tertiary = tertiarySpace.axes[tertiaryAxisIdx];
          const tertiaryW = isMobile ? 72 + rand(seed + 39) * 160 : 58 + rand(seed + 39) * 150;
          const tertiaryLeft = -80 + rand(seed + 40) * 142;
          const tertiaryTop = yBase + bandH * (0.18 + rand(seed + 41) * 0.72);
          const objectLabel = INTRO_LABELS[Math.floor(rand(seed + 29) * INTRO_LABELS.length)];

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1 + (i % 9),
                pointerEvents: 'none',
              }}
            >
              <img
                src={withBasePath(cur.src, basePath)}
                alt={`${space.id} ${cur.label}`}
                style={{
                  position: 'absolute',
                  left: `${primaryLeft}%`,
                  top: `${primaryTop - parallax * 0.32}px`,
                  width: `${primaryW}vw`,
                  height: 'auto',
                  transform: `rotate(${primaryRotate}deg) scale(${1 + rand(seed + 42) * 0.35})`,
                  display: 'block',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  mixBlendMode: rand(seed + 43) > 0.7 ? 'multiply' : 'normal',
                }}
              />

              <img
                src={withBasePath(second.src, basePath)}
                alt={`${secondSpace.id} ${second.label}`}
                style={{
                  position: 'absolute',
                  left: `${secondaryLeft}%`,
                  top: `${secondaryTop - parallax * 0.58}px`,
                  width: `${secondaryW}vw`,
                  height: 'auto',
                  transform: `rotate(${secondaryRotate}deg) scale(${1 + rand(seed + 44) * 0.55})`,
                  display: 'block',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  mixBlendMode: rand(seed + 16) > 0.32 ? 'multiply' : 'normal',
                }}
              />

              <img
                src={withBasePath(tertiary.src, basePath)}
                alt={`${tertiarySpace.id} ${tertiary.label}`}
                style={{
                  position: 'absolute',
                  left: `${tertiaryLeft}%`,
                  top: `${tertiaryTop - parallax * 0.9}px`,
                  width: `${tertiaryW}vw`,
                  height: 'auto',
                  transform: `rotate(${-28 + rand(seed + 45) * 56}deg) scale(${1.15 + rand(seed + 46) * 0.75})`,
                  display: 'block',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  mixBlendMode: rand(seed + 47) > 0.58 ? 'multiply' : 'normal',
                  opacity: 0.92,
                }}
              />

              <div
                className={clarendonBold.className}
                style={{
                  position: 'absolute',
                  top: `${labelTop - parallax * 0.12}px`,
                  left: `${labelLeft}%`,
                  fontSize: labelSize,
                  lineHeight: 1,
                  color: 'rgba(0,0,0,0.88)',
                  transform: `rotate(${-10 + rand(seed + 17) * 20}deg) scale(${1 + rand(seed + 48) * 0.55})`,
                  zIndex: 4,
                  userSelect: 'none', whiteSpace: 'nowrap', pointerEvents: 'none',
                }}
              >
                {space.id}
              </div>

              <div
                className={monaco.className}
                style={{
                  position: 'absolute',
                  top: `${yBase + 24 + rand(seed + 18) * bandH * 0.28}px`,
                  right: `${6 + rand(seed + 19) * 28}%`,
                  fontSize: isMobile ? '10px' : '11px', letterSpacing: '0.12em',
                  color: 'rgba(0,0,0,0.4)',
                  zIndex: 4,
                  userSelect: 'none', pointerEvents: 'none',
                }}
              >
                {cur.label}
              </div>

              {cutout && (
                <img
                  src={withBasePath(cutout.src, basePath)}
                  alt=""
                  style={{
                    position: 'absolute',
                    top: `${primaryTop + bandH * (-0.28 + rand(seed + 20) * 0.56) - parallax * 0.78}px`,
                    left: `${primaryLeft - 10 + rand(seed + 21) * 36}%`,
                    width: isMobile ? `${88 + rand(seed + 22) * 120}vw` : `${58 + rand(seed + 22) * 118}vw`,
                    height: 'auto',
                    transform: `rotate(${-18 + rand(seed + 23) * 36}deg) scale(${1 + rand(seed + 49) * 0.5})`,
                    zIndex: 5,
                    userSelect: 'none', pointerEvents: 'none',
                  }}
                />
              )}

              {secondCutout && rand(seed + 24) > 0.38 && (
                <img
                  src={withBasePath(secondCutout.src, basePath)}
                  alt=""
                  style={{
                    position: 'absolute',
                    top: `${secondaryTop - bandH * (0.08 + rand(seed + 25) * 0.22) - parallax * 0.44}px`,
                    left: `${secondaryLeft - 8 + rand(seed + 26) * 34}%`,
                    width: isMobile ? `${66 + rand(seed + 27) * 92}vw` : `${46 + rand(seed + 27) * 88}vw`,
                    height: 'auto',
                    transform: `rotate(${-22 + rand(seed + 28) * 44}deg) scale(${1 + rand(seed + 50) * 0.6})`,
                    zIndex: 6,
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {objectLabel && rand(seed + 30) > 0.42 && (
                <div
                  className={antiqueOlive.className}
                  style={{
                    position: 'absolute',
                    top: `${yBase + bandH * (0.1 + rand(seed + 31) * 0.68) - parallax * 0.22}px`,
                    left: `${-14 + rand(seed + 32) * 96}%`,
                    background: '#000',
                    color: '#fff',
                    fontSize: isMobile ? `clamp(14px, ${5 + rand(seed + 33) * 7}vw, 64px)` : `${28 + rand(seed + 33) * 58}px`,
                    lineHeight: 1.2,
                    padding: isMobile ? '1px 5px 2px' : '1px 7px 2px',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    transform: `rotate(${-14 + rand(seed + 34) * 28}deg) scale(${1 + rand(seed + 51) * 0.8})`,
                    zIndex: 8,
                  }}
                >
                  {objectLabel.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // =========================
  // 85 Slicing 场景
  // =========================
  const renderSlicingScene = () => {
    const stageOffsetY = isMobile ? 76 : 140;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, overflow: 'hidden',
        filter: showInfoOverlay ? 'blur(28px)' : 'none', transition: 'filter 300ms ease', background: '#fff',
      }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <video ref={slicingBgVideoRef} autoPlay playsInline muted style={{
            width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
          }} />
        </div>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          transform: `translateY(${stageOffsetY}px)`,
        }}>
          {SLICE_MIRRORS.map((mirror, index) => {
            const shot = sliceFrames[index];
            const offsetX = Math.sin(slicingTime * mirror.speed + mirror.phase) * mirror.ampX;
            const offsetY = Math.cos(slicingTime * mirror.speed * 0.86 + mirror.phase) * mirror.ampY;
            const w = mirror.width * (isMobile ? 0.9 : 1.5);
            const z = 10 + mirror.z * 3;
            return (
              <div key={mirror.id} style={{
                position: 'absolute', left: `${mirror.x}%`, top: `${mirror.y}%`,
                width: `${w}px`, aspectRatio: '806 / 1125',
                transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${mirror.rotate}deg)`,
                zIndex: z, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', left: INNER_BOUNDS.left, top: INNER_BOUNDS.top,
                  width: INNER_BOUNDS.width, height: INNER_BOUNDS.height,
                  overflow: 'hidden', background: 'transparent', zIndex: 1,
                }}>
                  {/* 🟡 修复4：只在首次挂载时设置 canvas 尺寸，避免重复渲染时清空画面导致闪烁 */}
                  <canvas
                    ref={(el) => {
                      slicingLiveCanvasRefs.current[index] = el;
                      if (!el) return;
                      // 检查这个 canvas 是否已经初始化过
                      if (slicingCanvasInitedRef.current.has(index)) return;
                      // 只在第一次挂载时设置尺寸
                      const W = 260;
                      const H = Math.round(W / MIRROR_ASPECT);
                      el.width = W;
                      el.height = H;
                      // 标记为已初始化，下次渲染时跳过
                      slicingCanvasInitedRef.current.add(index);
                    }}
                    style={{ width: '100%', height: '100%', display: 'block', transform: 'scaleX(-1)' }}
                  />
                  {shot?.src ? (
                    <img src={shot.src} alt='' style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', display: 'block', transform: 'scaleX(-1)',
                      opacity: 1, transition: 'opacity 1200ms ease', pointerEvents: 'none',
                    }} />
                  ) : null}
                </div>
                <img src={withBasePath('/Mirror-frame.png', basePath)} alt='' style={{
                  width: '100%', height: '100%', display: 'block',
                  position: 'relative', zIndex: 2, pointerEvents: 'none',
                }} />
                <div className={clarendonLight.className} style={{
                  position: 'absolute', top: '100%', left: '50%',
                  transform: 'translateX(-50%)', marginTop: '6px',
                  fontSize: isMobile ? '8px' : '9px', lineHeight: 1.15, color: 'rgba(0,0,0,0.4)',
                  whiteSpace: 'nowrap', textAlign: 'center', width: isMobile ? '170px' : '240px', zIndex: 3,
                  opacity: shot ? 1 : 0, transition: 'opacity 400ms ease',
                }}>
                  {shot ? shot.label : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================
  // 86 已开启摄像头后的主体渲染（未改动）
  // =========================
  const renderStartedStage = () => {
    if (activeChapter === 'slicing') return renderSlicingScene();
    if (activeChapter === 'dimension') return <div style={mainMirrorStyle}>{renderDimensionMirror()}</div>;
    if (activeChapter === 'noclipping') return renderNoclipScene();
    return <div style={mainMirrorStyle}>{renderNormalMirror()}</div>;
  };

  // =========================
  // 90 页面渲染
  // =========================
  return (
    <main style={{
      height: viewportHeight, minHeight: '100dvh', width: '100vw', background: '#fff', position: 'relative',
      overflow: 'hidden',
      display: activeChapter === 'slicing' ? 'block' : 'flex',
      alignItems: activeChapter === 'slicing' ? undefined : 'center',
      justifyContent: activeChapter === 'slicing' ? undefined : 'center',
    }}>

      {/* 顶部左侧：Mirror home + 章节导航 */}
      <div style={{
        position: 'absolute', top: isMobile ? 'max(16px, env(safe-area-inset-top))' : '24px', left: isMobile ? '16px' : '24px',
        right: isMobile ? '16px' : undefined,
        display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '28px', zIndex: 40,
        flexWrap: 'wrap', rowGap: '10px',
      }}>
        {/* 🔴 修复1 + 🔴 修复2：Mirror home 按钮双重功能
            - 单击：调用 goHome() 正确清理 slicing 状态后切回 home（修复1）
            - 双击：调用 resetMirror() 完全关闭摄像头回到初始状态（修复2）
            - 原来单击只调用 setActiveChapter('none')，跳过了清理逻辑
            - 原来 resetMirror 写了但没有任何按钮调用它 */}
        <button
          onClick={() => {
            if (onBackHome) {
              onBackHome();
              return;
            }
            if (activeChapter === 'none') resetMirror();
            else goHome();
          }}
          onMouseEnter={() => setIsHomeHovered(true)}
          onMouseLeave={() => setIsHomeHovered(false)}
          style={{
            minWidth: isMobile ? '128px' : '180px', background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'rgba(0,0,0,0.4)', fontSize: '24px',
            textAlign: 'left', padding: 0, lineHeight: 1,
          }}
        >
          <span style={{ position: 'relative', display: 'inline-block', width: '100%', whiteSpace: 'nowrap' }}>
            <span className={clarendonLight.className} style={{
              display: 'block', width: '100%',
              opacity: isHomeHovered ? 0 : 1,
              visibility: isHomeHovered ? 'hidden' : 'visible',
              transition: 'opacity 220ms ease', whiteSpace: 'nowrap',
            }}>
              Mirror home
            </span>
            <span className={clarendonBold.className} style={{
              position: 'absolute', inset: 0, display: 'block', width: '100%',
              opacity: isHomeHovered ? 1 : 0, transition: 'opacity 220ms ease', whiteSpace: 'nowrap',
            }}>
              Mirror home
            </span>
          </span>
        </button>

        <div style={topNavChapterOpacity}>
          <ChapterButton label='dimension'
            hovered={hoveredChapter === 'dimension'} active={activeChapter === 'dimension'}
            onMouseEnter={() => setHoveredChapter('dimension')} onMouseLeave={() => setHoveredChapter('none')}
            onClick={() => activateChapter('dimension')} />
          <ChapterButton label='slicing'
            hovered={hoveredChapter === 'slicing'} active={activeChapter === 'slicing'}
            onMouseEnter={() => setHoveredChapter('slicing')} onMouseLeave={() => setHoveredChapter('none')}
            onClick={() => activateChapter('slicing')} />
          <ChapterButton label='noclipping'
            hovered={hoveredChapter === 'noclipping'} active={activeChapter === 'noclipping'}
            onMouseEnter={() => setHoveredChapter('noclipping')} onMouseLeave={() => setHoveredChapter('none')}
            onClick={() => activateChapter('noclipping')} />
        </div>
      </div>

      {/* 顶部右侧：info 按钮（未改动） */}
      <button
        onMouseEnter={() => setIsInfoHovered(true)}
        onMouseLeave={() => setIsInfoHovered(false)}
        onClick={() => {
          if (!isCoarsePointer) return;
          setIsMetaPinned(false);
          setIsInfoPinned((prev) => !prev);
        }}
        style={{
          position: 'absolute', top: isMobile ? 'max(16px, env(safe-area-inset-top))' : '24px', right: isMobile ? '16px' : '24px', width: isMobile ? 'auto' : '120px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(0,0,0,0.4)', fontSize: isMobile ? '20px' : '24px', textAlign: 'right', zIndex: 40,
          padding: 0,
        }}
      >
        <span style={{ position: 'relative', display: 'inline-block', width: '100%', whiteSpace: 'nowrap' }}>
          <span className={clarendonLight.className} style={{
            display: 'block', width: '100%', opacity: showInfoOverlay ? 0 : 1,
            visibility: showInfoOverlay ? 'hidden' : 'visible', transition: 'opacity 220ms ease', whiteSpace: 'nowrap',
          }}>info</span>
          <span className={clarendonBold.className} style={{
            position: 'absolute', inset: 0, display: 'block', width: '100%',
            opacity: showInfoOverlay ? 1 : 0, transition: 'opacity 220ms ease', whiteSpace: 'nowrap',
          }}>info</span>
        </span>
      </button>

      {/* 右下角：slicing 时显示红点，其他时候显示 meta picture 按钮（未改动） */}
      {activeChapter === 'slicing' ? (
        <div style={{
          position: 'absolute', right: '24px', bottom: '24px',
          width: '28px', height: '28px', borderRadius: '999px', background: '#d40000', zIndex: 40,
        }} />
      ) : (
        <button
          onMouseEnter={() => setIsMetaHovered(true)}
          onMouseLeave={() => setIsMetaHovered(false)}
          onClick={() => {
            if (!isCoarsePointer) return;
            setIsInfoPinned(false);
            setIsMetaPinned((prev) => !prev);
          }}
          style={{
            position: 'absolute',
            right: isMobile ? '16px' : '24px',
            bottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : '24px',
            width: isMobile ? 'auto' : '220px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(0,0,0,0.4)', fontSize: isMobile ? '20px' : '24px', textAlign: 'right', zIndex: 40,
            padding: 0,
          }}
        >
          <span style={{ position: 'relative', display: 'inline-block', width: '100%', whiteSpace: 'nowrap' }}>
            <span className={clarendonLight.className} style={{
              display: 'block', width: '100%', opacity: showMetaOverlay ? 0 : 1,
              visibility: showMetaOverlay ? 'hidden' : 'visible', transition: 'opacity 220ms ease', whiteSpace: 'nowrap',
            }}>meta picture</span>
            <span className={clarendonBold.className} style={{
              position: 'absolute', inset: 0, display: 'block', width: '100%',
              opacity: showMetaOverlay ? 1 : 0, transition: 'opacity 220ms ease', whiteSpace: 'nowrap',
            }}>meta picture</span>
          </span>
        </button>
      )}

      {activeChapter === 'dimension' && (
        <button
          onClick={() => { void toggleDimensionCapture(); }}
          className={monaco.className}
          style={{
            position: 'absolute',
            left: isMobile ? '16px' : '24px',
            bottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : '24px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: dimensionCaptureStatus.capturing ? '#d40000' : 'rgba(0,0,0,0.42)',
            fontSize: isMobile ? '9px' : '11px',
            lineHeight: 1.6,
            textAlign: 'left',
            padding: 0,
            zIndex: 45,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ display: 'block' }}>
            {dimensionCaptureStatus.capturing ? 'stop dimension capture' : 'start dimension capture'}
          </span>
          <span style={{ display: 'block', color: 'rgba(0,0,0,0.35)' }}>
            scan {dimensionCaptureStatus.frameCount} / save {dimensionCaptureStatus.saveCount}
          </span>
        </button>
      )}

      {/* 摄像头未开启时：静态镜面 */}
      {!hasStarted && (
        <>
          <img src={withBasePath('/Mirror-blur.png', basePath)} alt='' style={{
            position: 'absolute', left: '50%', top: '50%', width: '1256px', height: 'auto',
            transform: 'translate(-50%, -50%)', opacity: showInfoOverlay ? 1 : 0,
            transition: 'opacity 300ms ease', pointerEvents: 'none', zIndex: 1, filter: 'blur(28px)',
          }} />
          <div style={mainMirrorStyle}>
            <img src={withBasePath('/Mirror.png', basePath)} alt='' style={{
              width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 2,
              opacity: showInfoOverlay ? 0 : 1, transition: 'opacity 300ms ease', pointerEvents: 'none',
            }} />
            <div className={clarendonMedium.className} style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              color: 'rgba(0,0,0,0.4)', fontSize: isMobile ? '16px' : '20px', opacity: showInfoOverlay ? 1 : 0,
              transition: 'opacity 300ms ease', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
            }}>
              This is a mirror.
            </div>

            {/* 🟡 修复5：摄像头错误提示
                原来权限被拒绝时页面没有任何反应
                现在在镜面中央显示错误原因，字体颜色和风格与整体一致 */}
            {cameraError && (
              <div className={clarendonMedium.className} style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'rgba(0,0,0,0.5)', fontSize: isMobile ? '12px' : '14px',
                textAlign: 'center', zIndex: 12, pointerEvents: 'none',
                whiteSpace: 'pre-wrap', lineHeight: 1.6,
                width: '80%',
              }}>
                {cameraError}
              </div>
            )}

            {/* 点击镜面触发开启摄像头的透明按钮 */}
            <button
              onClick={startCamera}
              style={{
                position: 'absolute', left: '3.7%', top: '2.6%',
                width: '92.6%', height: '94.4%', zIndex: 11,
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            />
          </div>
        </>
      )}

      {/* 摄像头已开启时：渲染各章节内容 */}
      {hasStarted && (
        <>
          {renderStartedStage()}
          <div className={clarendonMedium.className} style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: '#fff', fontSize: isMobile ? '16px' : '20px', opacity: showInfoOverlay ? 1 : 0,
            transition: 'opacity 300ms ease', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 50,
          }}>
            This isn&apos;t a mirror.
          </div>
        </>
      )}

      {/* 隐藏的分析用 canvas 和截帧 canvas */}
      <canvas ref={analysisCanvasRef} style={{ display: 'none' }} />
      <canvas ref={sliceCaptureCanvasRef} style={{ display: 'none' }} />

      {/* 隐藏的视频源，所有章节共用这一个视频流 */}
      <video ref={videoSourceRef} autoPlay playsInline muted style={{
        position: 'fixed', left: '-9999px', top: '-9999px',
        width: '1px', height: '1px', opacity: 0, pointerEvents: 'none',
      }} />
    </main>
  );
}
