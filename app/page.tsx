'use client';

// =========================
// 00 依赖与字体
// =========================
import { useEffect, useMemo, useRef, useState } from 'react';
import localFont from 'next/font/local';

const clarendonLight = localFont({ src: './fonts/ClarendonCom-Light.ttf' });
const clarendonBold = localFont({ src: './fonts/ClarendonCom-Bold.ttf' });
const clarendonMedium = localFont({ src: './fonts/ClarendonCom-Medium.ttf' });
const monaco = localFont({ src: './fonts/Monaco.ttf' });

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

const MIRROR_ASPECT = 806 / 1125;

const INNER_BOUNDS = {
  left: '3.7%',
  top: '3.1%',
  width: '92.6%',
  height: '93.4%',
} as const;

const MAIN_MIRROR_STYLE = {
  position: 'relative' as const,
  width: '605px',
  aspectRatio: '806 / 1125',
  zIndex: 2,
};

// slicing 镜子布局参数
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

// =========================
// 02 小工具函数
// =========================
function drawCoverFromVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, dw: number, dh: number) {
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

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const sw =
    img instanceof HTMLImageElement ? img.naturalWidth : img instanceof HTMLCanvasElement ? img.width : w;

  const sh =
    img instanceof HTMLImageElement ? img.naturalHeight : img instanceof HTMLCanvasElement ? img.height : h;

  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
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
            opacity: hovered ? 0 : 1,
            visibility: hovered ? 'hidden' : 'visible',
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
            opacity: hovered ? 1 : 0,
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
export default function Home() {
  // =========================
  // 10 核心引用：视频与画布
  // =========================
  const videoSourceRef = useRef<HTMLVideoElement | null>(null);
  const videoDisplayRef = useRef<HTMLVideoElement | null>(null);
  const slicingBgVideoRef = useRef<HTMLVideoElement | null>(null);

  // slicing：24 个小镜子实时画面 canvas 引用
  const slicingLiveCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  // slicing：实时画面绘制循环
  const rafSlicingLiveDrawRef = useRef<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dimensionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const noclipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sliceCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // slicing 覆盖写入指针：满 24 后循环覆盖
  const sliceWriteIndexRef = useRef(0);

  // =========================
  // 12 基础 UI 状态
  // =========================
  const [hasStarted, setHasStarted] = useState(false);

  const [isHomeHovered, setIsHomeHovered] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [isMetaHovered, setIsMetaHovered] = useState(false);

  const [hoveredChapter, setHoveredChapter] = useState<ChapterMode>('none');
  const [activeChapter, setActiveChapter] = useState<ChapterMode>('none');

  // =========================
  // 13 元数据与 slicing 状态
  // =========================
  const [metaLog, setMetaLog] = useState<string[]>([]);
  const [sliceFrames, setSliceFrames] = useState<SliceFrame[]>([]);
  const [slicingTime, setSlicingTime] = useState(0);

  // =========================
  // 14 noclip 素材
  // =========================
  const [noclipImages, setNoclipImages] = useState<string[]>([]);
  const [activeNoclipImage, setActiveNoclipImage] = useState<string | null>(null);

  // =========================
  // 20 读取 noclip 清单
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/noclip/index.json');

        // 保守处理：避免 res.json 因为内容不是 JSON 直接炸穿整个页面
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) return;

        const json = (await res.json()) as NoclipIndexFile;

        if (cancelled) return;
        if (json.images && Array.isArray(json.images)) setNoclipImages(json.images);
      } catch (err) {
        console.error('noclip index load error:', err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // =========================
  // 21 开启摄像头
  // =========================
  const startCamera = async () => {
    try {
      if (streamRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;
      setHasStarted(true);
    } catch (err) {
      console.error('camera error:', err);
    }
  };

  // =========================
  // 22 重置：关闭摄像头 + 清理所有循环
  // =========================
  const resetMirror = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoSourceRef.current) videoSourceRef.current.srcObject = null;
    if (videoDisplayRef.current) videoDisplayRef.current.srcObject = null;
    if (slicingBgVideoRef.current) slicingBgVideoRef.current.srcObject = null;

    if (rafMetaRef.current) cancelAnimationFrame(rafMetaRef.current);
    if (rafDimensionRef.current) cancelAnimationFrame(rafDimensionRef.current);
    if (rafNoclipRef.current) cancelAnimationFrame(rafNoclipRef.current);
    if (rafSlicingFloatRef.current) cancelAnimationFrame(rafSlicingFloatRef.current);

    rafMetaRef.current = null;
    rafDimensionRef.current = null;
    rafNoclipRef.current = null;
    rafSlicingFloatRef.current = null;

    if (rafSlicingLiveDrawRef.current) cancelAnimationFrame(rafSlicingLiveDrawRef.current);
    rafSlicingLiveDrawRef.current = null;

    if (slicingIntervalRef.current) window.clearInterval(slicingIntervalRef.current);
    slicingIntervalRef.current = null;

    prevFrameRef.current = null;
    frameCountRef.current = 0;
    startTimeRef.current = null;
    lastLogTimeRef.current = 0;

    sliceWriteIndexRef.current = 0;

    setMetaLog([]);
    setSliceFrames([]);
    setSlicingTime(0);

    setActiveChapter('none');
    setActiveNoclipImage(null);
    setHasStarted(false);
  };

  // =========================
  // 23 核心修复：把 stream 挂到 videoSource 与 videoDisplay
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
  // 23.1 slicing 背景补挂载
  // =========================
  useEffect(() => {
    if (!hasStarted) return;
    if (activeChapter !== 'slicing') return;

    const stream = streamRef.current;
    const bg = slicingBgVideoRef.current;
    if (!stream || !bg) return;

    if (bg.srcObject !== stream) bg.srcObject = stream;
    bg.play().catch(() => {});
  }, [hasStarted, activeChapter]);

  // =========================
  // 24 切换章节
  // =========================
  const activateChapter = (chapter: ChapterMode) => {
    setActiveChapter(chapter);

    if (chapter === 'slicing') {
      setSliceFrames([]);
      sliceWriteIndexRef.current = 0;
      startTimeRef.current = performance.now();
    }

    if (chapter === 'noclipping') {
      if (noclipImages.length) {
        const pick = noclipImages[Math.floor(Math.random() * noclipImages.length)];
        setActiveNoclipImage(pick || null);
      } else {
        setActiveNoclipImage(null);
      }
    }
  };

  // =========================
  // 30 slicing：浮动时间驱动
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
  // 31 slicing：每 2.2 秒截一帧，循环覆盖 24 张
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
  // 32 slicing：实时画面绘制到 24 个小 canvas
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

        const w = c.width;
        const h = c.height;

        ctx.clearRect(0, 0, w, h);
        drawCoverFromVideo(ctx, video, w, h);
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
  // 40 元数据分析：用于 meta picture 覆盖层
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

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let lumaSum = 0;
      let lumaSqSum = 0;
      let satSum = 0;
      let motionSum = 0;
      let edgeSum = 0;

      const bins = new Array(16).fill(0);

      for (let y = 0; y < sampleH; y += 1) {
        for (let x = 0; x < sampleW; x += 1) {
          const i = (y * sampleW + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          rSum += r;
          gSum += g;
          bSum += b;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const sat = max === 0 ? 0 : (max - min) / max;

          lumaSum += luma;
          lumaSqSum += luma * luma;
          satSum += sat;

          const binIndex = Math.min(15, Math.floor(luma / 16));
          bins[binIndex] += 1;

          if (prevFrameRef.current) {
            motionSum +=
              Math.abs(r - prevFrameRef.current[i]) +
              Math.abs(g - prevFrameRef.current[i + 1]) +
              Math.abs(b - prevFrameRef.current[i + 2]);
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
      const avgR = rSum / pxCount;
      const avgG = gSum / pxCount;
      const avgB = bSum / pxCount;
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
      const centerR = data[centerIndex];
      const centerG = data[centerIndex + 1];
      const centerB = data[centerIndex + 2];

      const elapsed = (performance.now() - (startTimeRef.current || performance.now())) / 1000;
      frameCountRef.current += 1;
      const fps = frameCountRef.current / Math.max(elapsed, 0.001);

      const dominantChannel = avgR > avgG && avgR > avgB ? 'R' : avgG > avgB ? 'G' : 'B';

      const connection = (navigator as any).connection?.effectiveType ?? 'n/a';
      const memory = (navigator as any).deviceMemory ?? 'n/a';
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
  // 50 Dimension：呼吸式采样 + Norm 式数据条
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

    const stages = [120, 84, 56, 36, 24, 16, 10, 6, 3];

    const draw = () => {
      if (!video.videoWidth || !video.videoHeight) {
        rafDimensionRef.current = requestAnimationFrame(draw);
        return;
      }

      const elapsed = startTimeRef.current ? (performance.now() - startTimeRef.current) / 1000 : 0;

      const n = stages.length - 1;
      const segment = 2.2;
      const totalSegments = n * 2;
      const cycle = totalSegments * segment;

      const u = cycle === 0 ? 0 : (elapsed % cycle) / cycle;
      const tri = u < 0.5 ? u * 2 : (1 - u) * 2;
      const s = tri * tri * (3 - 2 * tri);

      const pos = s * n;
      const i0 = Math.floor(pos);
      const i1 = Math.min(n, i0 + 1);
      const f = pos - i0;

      const cellsX = stages[i0] * (1 - f) + stages[i1] * f;
      const cellsY = Math.max(2, Math.round(cellsX / 0.716));

      const gridX = Math.max(2, Math.round(cellsX));
      const gridY = Math.max(2, Math.round(cellsY));

      sampleCanvas.width = gridX;
      sampleCanvas.height = gridY;

      sampleCtx.clearRect(0, 0, gridX, gridY);

      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const vRatio = vW / vH;
      const dRatio = gridX / gridY;

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

      sampleCtx.drawImage(video, sx, sy, sw, sh, 0, 0, gridX, gridY);

      displayCtx.clearRect(0, 0, displayW, displayH);
      displayCtx.imageSmoothingEnabled = false;
      displayCtx.drawImage(sampleCanvas, 0, 0, displayW, displayH);

      displayCtx.save();
      displayCtx.strokeStyle = 'rgba(0,0,0,0.06)';
      displayCtx.lineWidth = 1;

      const cellW = displayW / gridX;
      const cellH = displayH / gridY;

      for (let x = 0; x <= gridX; x += 1) {
        const px = x * cellW;
        displayCtx.beginPath();
        displayCtx.moveTo(px, 0);
        displayCtx.lineTo(px, displayH);
        displayCtx.stroke();
      }

      for (let y = 0; y <= gridY; y += 1) {
        const py = y * cellH;
        displayCtx.beginPath();
        displayCtx.moveTo(0, py);
        displayCtx.lineTo(displayW, py);
        displayCtx.stroke();
      }
      displayCtx.restore();

      const PS = gridX * gridY;
      const img = sampleCtx.getImageData(0, 0, gridX, gridY).data;

      const colorSet = new Set<number>();
      for (let i = 0; i < img.length; i += 4) {
        const r = img[i];
        const g = img[i + 1];
        const b = img[i + 2];
        const rq = r >> 3;
        const gq = g >> 3;
        const bq = b >> 3;
        const key = (rq << 10) | (gq << 5) | bq;
        colorSet.add(key);
      }

      const CR = Math.max(1, colorSet.size);
      const logPP = PS * Math.log10(CR);

      displayCtx.save();
      displayCtx.fillStyle = 'rgba(0,0,0,0.42)';
      displayCtx.font = '11px Monaco, monospace';
      displayCtx.textBaseline = 'bottom';
      displayCtx.fillText(
        `PS ${PS}   CR ${CR}   log10(PP) ${logPP.toFixed(2)}   stage ${i0}/${n}`,
        12,
        displayH - 10
      );
      displayCtx.restore();

      rafDimensionRef.current = requestAnimationFrame(draw);
    };

    rafDimensionRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafDimensionRef.current) cancelAnimationFrame(rafDimensionRef.current);
      rafDimensionRef.current = null;
    };
  }, [hasStarted, activeChapter]);

  // =========================
  // 60 Noclipping：锚定画面占比最大的颜色做穿墙替换
  // 修复目标：
  // 1 activeNoclipImage 为空时也要有画面（passthrough）
  // 2 替换图未加载完成时也要有画面（passthrough）
  // 3 进入 noclipping 即刻开始渲染，不会白屏
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
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) return;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = width;
    blurCanvas.height = height;
    const blurCtx = blurCanvas.getContext('2d');
    if (!blurCtx) return;

    const repCanvas = document.createElement('canvas');
    repCanvas.width = width;
    repCanvas.height = height;
    const repCtx = repCanvas.getContext('2d');
    if (!repCtx) return;

    // 参数：只调这几个
    const BUCKET = 32;
    const INNER = 26;
    const OUTER = 78;
    const FEATHER_BLUR = 4;
    const MIX_ORIGINAL = 1.0;

    let mounted = true;

    // 替换图与状态
    const img = new Image();
    let imgReady = false;

    if (activeNoclipImage) {
      img.src = activeNoclipImage;
      img.onload = () => {
        imgReady = true;
      };
      img.onerror = (e) => {
        imgReady = false;
        console.error('noclipping image load error:', e);
      };
    }

    const drawPassthrough = () => {
      outCtx.clearRect(0, 0, width, height);
      outCtx.drawImage(srcCanvas, 0, 0);
    };

    const draw = () => {
      if (!mounted) return;

      if (!video.videoWidth || !video.videoHeight) {
        rafNoclipRef.current = requestAnimationFrame(draw);
        return;
      }

      // A 当前帧
      srcCtx.clearRect(0, 0, width, height);
      drawCoverFromVideo(srcCtx, video, width, height);

      // 没有替换图 或 替换图还没准备好：直接输出原画面，保证“永远有画面”
      if (!activeNoclipImage || !imgReady) {
        drawPassthrough();
        rafNoclipRef.current = requestAnimationFrame(draw);
        return;
      }

      const frame = srcCtx.getImageData(0, 0, width, height);
      const px = frame.data;

      // B dominant color：量化直方图
      const hist = new Map<number, number>();
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];

        const rb = (r / BUCKET) | 0;
        const gb = (g / BUCKET) | 0;
        const bb = (b / BUCKET) | 0;

        const key = (rb << 16) | (gb << 8) | bb;
        hist.set(key, (hist.get(key) || 0) + 1);
      }

      let domKey = 0;
      let domCount = -1;
      for (const [k, c] of hist.entries()) {
        if (c > domCount) {
          domCount = c;
          domKey = k;
        }
      }

      const domRb = (domKey >> 16) & 0xff;
      const domGb = (domKey >> 8) & 0xff;
      const domBb = domKey & 0xff;

      const keyR = domRb * BUCKET + BUCKET / 2;
      const keyG = domGb * BUCKET + BUCKET / 2;
      const keyB = domBb * BUCKET + BUCKET / 2;

      // C mask（白色+alpha）
      const mask = maskCtx.createImageData(width, height);
      const m = mask.data;

      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];

        const dr = r - keyR;
        const dg = g - keyG;
        const db = b - keyB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);

        let a01 = 0;
        if (dist <= INNER) a01 = 1;
        else if (dist < OUTER) a01 = 1 - (dist - INNER) / (OUTER - INNER);

        const a = Math.max(0, Math.min(255, Math.round(a01 * 255)));

        m[i] = 255;
        m[i + 1] = 255;
        m[i + 2] = 255;
        m[i + 3] = a;
      }

      maskCtx.putImageData(mask, 0, 0);

      // D 羽化 mask
      blurCtx.clearRect(0, 0, width, height);
      blurCtx.save();
      blurCtx.filter = `blur(${FEATHER_BLUR}px)`;
      blurCtx.drawImage(maskCanvas, 0, 0);
      blurCtx.restore();

      // E replacement cover
      repCtx.clearRect(0, 0, width, height);
      drawImageCover(repCtx, img, width, height);

      // F 用羽化 mask 抠 replacement
      repCtx.globalCompositeOperation = 'destination-in';
      repCtx.drawImage(blurCanvas, 0, 0);
      repCtx.globalCompositeOperation = 'source-over';

      // G 输出合成
      outCtx.clearRect(0, 0, width, height);

      if (MIX_ORIGINAL >= 1) {
        outCtx.drawImage(srcCanvas, 0, 0);
      } else {
        outCtx.globalAlpha = MIX_ORIGINAL;
        outCtx.drawImage(srcCanvas, 0, 0);
        outCtx.globalAlpha = 1;
      }

      outCtx.drawImage(repCanvas, 0, 0);

      rafNoclipRef.current = requestAnimationFrame(draw);
    };

    rafNoclipRef.current = requestAnimationFrame(draw);

    return () => {
      mounted = false;
      if (rafNoclipRef.current) cancelAnimationFrame(rafNoclipRef.current);
      rafNoclipRef.current = null;
    };
  }, [hasStarted, activeChapter, activeNoclipImage]);

  // =========================
  // 70 卸载清理
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
  // 80 顶部章节导航：开启摄像头后缓慢可用
  // =========================
  const topNavChapterOpacity = useMemo(() => {
    return {
      opacity: hasStarted ? 1 : 0,
      pointerEvents: hasStarted ? ('auto' as const) : ('none' as const),
      transition: 'opacity 1100ms ease',
      display: 'flex',
      alignItems: 'center',
      gap: '28px',
    };
  }, [hasStarted]);

  // =========================
  // 81 meta picture 覆盖层
  // =========================
  const renderMetaOverlay = () => {
    if (!isMetaHovered) return null;

    return (
      <div
        style={{
          position: 'absolute',
          left: INNER_BOUNDS.left,
          top: INNER_BOUNDS.top,
          width: INNER_BOUNDS.width,
          height: INNER_BOUNDS.height,
          background: '#fff',
          zIndex: 2,
          overflow: 'hidden',
          padding: '18px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          className={monaco.className}
          style={{
            width: '100%',
            height: '100%',
            color: 'rgba(0,0,0,0.62)',
            fontSize: '11px',
            lineHeight: 1.9,
            textAlign: 'left',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            gap: '3px',
            whiteSpace: 'nowrap',
            letterSpacing: '0.15px',
          }}
        >
          {metaLog.map((line, index) => (
            <div
              key={index}
              style={{
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'clip',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // =========================
  // 82 普通镜子
  // =========================
  const renderNormalMirror = () => {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          filter: isInfoHovered ? 'blur(28px)' : 'none',
          transition: 'filter 300ms ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: INNER_BOUNDS.left,
            top: INNER_BOUNDS.top,
            width: INNER_BOUNDS.width,
            height: INNER_BOUNDS.height,
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          <video
            ref={videoDisplayRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
        </div>

        {renderMetaOverlay()}

        <img
          src='/Mirror-frame.png'
          alt=''
          style={{
            width: '100%',
            display: 'block',
            zIndex: 3,
            position: 'relative',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  };

  // =========================
  // 83 Dimension 镜子
  // =========================
  const renderDimensionMirror = () => {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          filter: isInfoHovered ? 'blur(28px)' : 'none',
          transition: 'filter 300ms ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: INNER_BOUNDS.left,
            top: INNER_BOUNDS.top,
            width: INNER_BOUNDS.width,
            height: INNER_BOUNDS.height,
            overflow: 'hidden',
            zIndex: 1,
            background: '#fff',
          }}
        >
          <canvas ref={dimensionCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {renderMetaOverlay()}

        <img
          src='/Mirror-frame.png'
          alt=''
          style={{
            width: '100%',
            display: 'block',
            zIndex: 3,
            position: 'relative',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  };

  // =========================
  // 84 Noclipping 镜子
  // =========================
  const renderNoclipMirror = () => {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          filter: isInfoHovered ? 'blur(28px)' : 'none',
          transition: 'filter 300ms ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: INNER_BOUNDS.left,
            top: INNER_BOUNDS.top,
            width: INNER_BOUNDS.width,
            height: INNER_BOUNDS.height,
            overflow: 'hidden',
            zIndex: 1,
            background: '#fff',
          }}
        >
          <canvas ref={noclipCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {renderMetaOverlay()}

        <img
          src='/Mirror-frame.png'
          alt=''
          style={{
            width: '100%',
            display: 'block',
            zIndex: 3,
            position: 'relative',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  };

  // =========================
  // 85 Slicing：背景实时影像 + 24 面镜子
  // 修复：避免 img src 为空字符串
  // =========================
  const renderSlicingScene = () => {
    const stageOffsetY = 140;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          overflow: 'hidden',
          filter: isInfoHovered ? 'blur(28px)' : 'none',
          transition: 'filter 300ms ease',
          background: '#fff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <video
            ref={slicingBgVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            transform: `translateY(${stageOffsetY}px)`,
          }}
        >
          {SLICE_MIRRORS.map((mirror, index) => {
            const shot = sliceFrames[index];

            const offsetX = Math.sin(slicingTime * mirror.speed + mirror.phase) * mirror.ampX;
            const offsetY = Math.cos(slicingTime * mirror.speed * 0.86 + mirror.phase) * mirror.ampY;

            const w = mirror.width * 1.5;
            const z = 10 + mirror.z * 3;

            return (
              <div
                key={mirror.id}
                style={{
                  position: 'absolute',
                  left: `${mirror.x}%`,
                  top: `${mirror.y}%`,
                  width: `${w}px`,
                  aspectRatio: '806 / 1125',
                  transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${mirror.rotate}deg)`,
                  zIndex: z,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: INNER_BOUNDS.left,
                    top: INNER_BOUNDS.top,
                    width: INNER_BOUNDS.width,
                    height: INNER_BOUNDS.height,
                    overflow: 'hidden',
                    background: 'transparent',
                    zIndex: 1,
                  }}
                >
                  <canvas
                    ref={(el) => {
                      slicingLiveCanvasRefs.current[index] = el;
                      if (!el) return;

                      const W = 260;
                      const H = Math.round(W / MIRROR_ASPECT);
                      if (el.width !== W) el.width = W;
                      if (el.height !== H) el.height = H;
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'block',
                      transform: 'scaleX(-1)',
                    }}
                  />

                  {shot?.src ? (
                    <img
                      src={shot.src}
                      alt=''
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transform: 'scaleX(-1)',
                        opacity: 1,
                        transition: 'opacity 1200ms ease',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                </div>

                <img
                  src='/Mirror-frame.png'
                  alt=''
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    position: 'relative',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />

                <div
                  className={clarendonLight.className}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '6px',
                    fontSize: '9px',
                    lineHeight: 1.15,
                    color: 'rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    width: '240px',
                    zIndex: 3,
                    opacity: shot ? 1 : 0,
                    transition: 'opacity 400ms ease',
                  }}
                >
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
  // 86 已开启摄像头后的主体渲染
  // =========================
  const renderStartedStage = () => {
    if (activeChapter === 'slicing') return renderSlicingScene();
    if (activeChapter === 'dimension') return <div style={MAIN_MIRROR_STYLE}>{renderDimensionMirror()}</div>;
    if (activeChapter === 'noclipping') return <div style={MAIN_MIRROR_STYLE}>{renderNoclipMirror()}</div>;
    return <div style={MAIN_MIRROR_STYLE}>{renderNormalMirror()}</div>;
  };

  // =========================
  // 90 页面渲染
  // =========================
  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#fff',
        position: 'relative',
        display: activeChapter === 'slicing' ? 'block' : 'flex',
        alignItems: activeChapter === 'slicing' ? undefined : 'center',
        justifyContent: activeChapter === 'slicing' ? undefined : 'center',
        overflow: activeChapter === 'slicing' ? 'hidden' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => {
            setActiveChapter('none');
          }}
          onMouseEnter={() => setIsHomeHovered(true)}
          onMouseLeave={() => setIsHomeHovered(false)}
          style={{
            width: '180px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(0,0,0,0.4)',
            fontSize: '24px',
            textAlign: 'left',
            padding: 0,
            lineHeight: 1,
          }}
        >
          <span style={{ position: 'relative', display: 'inline-block', width: '100%', whiteSpace: 'nowrap' }}>
            <span
              className={clarendonLight.className}
              style={{
                display: 'block',
                width: '100%',
                opacity: isHomeHovered ? 0 : 1,
                visibility: isHomeHovered ? 'hidden' : 'visible',
                transition: 'opacity 220ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              Mirror home
            </span>
            <span
              className={clarendonBold.className}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                width: '100%',
                opacity: isHomeHovered ? 1 : 0,
                transition: 'opacity 220ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              Mirror home
            </span>
          </span>
        </button>

        <div style={topNavChapterOpacity}>
          <ChapterButton
            label='dimension'
            hovered={hoveredChapter === 'dimension'}
            active={activeChapter === 'dimension'}
            onMouseEnter={() => setHoveredChapter('dimension')}
            onMouseLeave={() => setHoveredChapter('none')}
            onClick={() => activateChapter('dimension')}
          />
          <ChapterButton
            label='slicing'
            hovered={hoveredChapter === 'slicing'}
            active={activeChapter === 'slicing'}
            onMouseEnter={() => setHoveredChapter('slicing')}
            onMouseLeave={() => setHoveredChapter('none')}
            onClick={() => activateChapter('slicing')}
          />
          <ChapterButton
            label='noclipping'
            hovered={hoveredChapter === 'noclipping'}
            active={activeChapter === 'noclipping'}
            onMouseEnter={() => setHoveredChapter('noclipping')}
            onMouseLeave={() => setHoveredChapter('none')}
            onClick={() => activateChapter('noclipping')}
          />
        </div>
      </div>

      <button
        onMouseEnter={() => setIsInfoHovered(true)}
        onMouseLeave={() => setIsInfoHovered(false)}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          width: '120px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(0,0,0,0.4)',
          fontSize: '24px',
          textAlign: 'right',
          zIndex: 40,
        }}
      >
        <span style={{ position: 'relative', display: 'inline-block', width: '100%', whiteSpace: 'nowrap' }}>
          <span
            className={clarendonLight.className}
            style={{
              display: 'block',
              width: '100%',
              opacity: isInfoHovered ? 0 : 1,
              visibility: isInfoHovered ? 'hidden' : 'visible',
              transition: 'opacity 220ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            info
          </span>
          <span
            className={clarendonBold.className}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'block',
              width: '100%',
              opacity: isInfoHovered ? 1 : 0,
              transition: 'opacity 220ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            info
          </span>
        </span>
      </button>

      {activeChapter === 'slicing' ? (
        <div
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '24px',
            width: '28px',
            height: '28px',
            borderRadius: '999px',
            background: '#d40000',
            zIndex: 40,
          }}
        />
      ) : (
        <button
          onMouseEnter={() => setIsMetaHovered(true)}
          onMouseLeave={() => setIsMetaHovered(false)}
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '24px',
            width: '220px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(0,0,0,0.4)',
            fontSize: '24px',
            textAlign: 'right',
            zIndex: 40,
          }}
        >
          <span style={{ position: 'relative', display: 'inline-block', width: '100%', whiteSpace: 'nowrap' }}>
            <span
              className={clarendonLight.className}
              style={{
                display: 'block',
                width: '100%',
                opacity: isMetaHovered ? 0 : 1,
                visibility: isMetaHovered ? 'hidden' : 'visible',
                transition: 'opacity 220ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              meta picture
            </span>
            <span
              className={clarendonBold.className}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                width: '100%',
                opacity: isMetaHovered ? 1 : 0,
                transition: 'opacity 220ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              meta picture
            </span>
          </span>
        </button>
      )}

      {!hasStarted && (
        <>
          <img
            src='/Mirror-blur.png'
            alt=''
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '1256px',
              height: 'auto',
              transform: 'translate(-50%, -50%)',
              opacity: isInfoHovered ? 1 : 0,
              transition: 'opacity 300ms ease',
              pointerEvents: 'none',
              zIndex: 1,
              filter: 'blur(28px)',
            }}
          />

          <div style={MAIN_MIRROR_STYLE}>
            <img
              src='/Mirror.png'
              alt=''
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                position: 'relative',
                zIndex: 2,
                opacity: isInfoHovered ? 0 : 1,
                transition: 'opacity 300ms ease',
                pointerEvents: 'none',
              }}
            />

            <div
              className={clarendonMedium.className}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'rgba(0,0,0,0.4)',
                fontSize: '20px',
                opacity: isInfoHovered ? 1 : 0,
                transition: 'opacity 300ms ease',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              This is a mirror.
            </div>

            <button
              onClick={startCamera}
              style={{
                position: 'absolute',
                left: '3.7%',
                top: '2.6%',
                width: '92.6%',
                height: '94.4%',
                zIndex: 11,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            />
          </div>
        </>
      )}

      {hasStarted && (
        <>
          {renderStartedStage()}

          <div
            className={clarendonMedium.className}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              fontSize: '20px',
              opacity: isInfoHovered ? 1 : 0,
              transition: 'opacity 300ms ease',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 50,
            }}
          >
            This isn’t a mirror.
          </div>
        </>
      )}

      <canvas ref={analysisCanvasRef} style={{ display: 'none' }} />
      <canvas ref={sliceCaptureCanvasRef} style={{ display: 'none' }} />

      <video
        ref={videoSourceRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </main>
  );
}