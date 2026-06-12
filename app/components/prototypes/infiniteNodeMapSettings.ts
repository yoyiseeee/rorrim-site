export type PrototypeSettings = {
  nodeSpacingX: number;
  nodeSpacingY: number;
  pentagonRadius: number;
  chapterEdgeOffset: number;
  pentagonRotation: number;
  showPentagonGuide: boolean;
  globalScale: number;
  maxVisibleRadius: number;
  nodeDotSizeMM: number;
  nodeDotOpacity: number;
  chapterScale: number;
  safetyPadding: number;
  titleOpacity: number;
  textDifferenceEnabled: boolean;
  prefaceTextWidthMM: number;
  alphabetManifestoWidthMM: number;
  noclippingManifestoWidthMM: number;
  dimensionManifestoWidthMM: number;
  paradoxManifestoWidthMM: number;
  noiseManifestoWidthMM: number;
  prefaceZh: string;
  prefaceEn: string;
  alphabetManifestoZh: string;
  alphabetManifestoEn: string;
  noclippingManifestoZh: string;
  noclippingManifestoEn: string;
  dimensionManifestoZh: string;
  dimensionManifestoEn: string;
  paradoxManifestoZh: string;
  paradoxManifestoEn: string;
  noiseManifestoZh: string;
  noiseManifestoEn: string;
  uiTextSize: number;
  introTitleTextSize: number;
  introTitleOffsetX: number;
  introTitleOffsetY: number;
  modeHintTextSize: number;
  modeHintOffsetX: number;
  modeHintOffsetY: number;
  introInfoTextSize: number;
  introInfoOffsetX: number;
  introInfoOffsetY: number;
  introPrefaceTextSize: number;
  introPrefaceOffsetX: number;
  introPrefaceOffsetY: number;
  introCopyrightTextSize: number;
  introCopyrightOffsetX: number;
  introCopyrightOffsetY: number;
  introTitleDetailTextSize: number;
  introTitleDetailOffsetX: number;
  introTitleDetailOffsetY: number;
  introTitleDetailChineseOffsetX: number;
  introTitleDetailChineseOffsetY: number;
  introTitleDetailEnglishOffsetX: number;
  introTitleDetailEnglishOffsetY: number;
  chapterManifestoTextSize: number;
  chapterManifestoOffsetX: number;
  chapterManifestoOffsetY: number;
  alphabetManifestoOffsetX: number;
  alphabetManifestoOffsetY: number;
  noclippingManifestoOffsetX: number;
  noclippingManifestoOffsetY: number;
  dimensionManifestoOffsetX: number;
  dimensionManifestoOffsetY: number;
  paradoxManifestoOffsetX: number;
  paradoxManifestoOffsetY: number;
  noiseManifestoOffsetX: number;
  noiseManifestoOffsetY: number;
  topHudTextSize: number;
  topHudOffsetX: number;
  topHudOffsetY: number;
  chapterUpOffsetX: number;
  chapterUpOffsetY: number;
  chapterTopRightOffsetX: number;
  chapterTopRightOffsetY: number;
  chapterBottomRightOffsetX: number;
  chapterBottomRightOffsetY: number;
  chapterBottomLeftOffsetX: number;
  chapterBottomLeftOffsetY: number;
  chapterTopLeftOffsetX: number;
  chapterTopLeftOffsetY: number;
  alphabetOffsetX: number;
  alphabetOffsetY: number;
  noclippingOffsetX: number;
  noclippingOffsetY: number;
  dimensionOffsetX: number;
  dimensionOffsetY: number;
  paradoxOffsetX: number;
  paradoxOffsetY: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  showMirror: boolean;
  mirrorScale: number;
  mirrorOpacityMin: number;
  mirrorOpacityMax: number;
  flickerEnabled: boolean;
  flickerSpeed: number;
  flickerNoiseAmount: number;
  flickerRandomness: number;
  parallaxEnabled: boolean;
  parallaxRange: number;
  parallaxEase: number;
  inertiaEnabled: boolean;
  inertiaFriction: number;
  inertiaVelocityScale: number;
  minZoom: number;
  maxZoom: number;
  zoomSensitivity: number;
  pauseBlur: number;
  d12Scale: number;
  d12LineWidth: number;
  hideSystemCursor: boolean;
  cursorMinSize: number;
  cursorMaxSize: number;
  cursorSizeScale: number;
  cursorEase: number;
  noclipNormalFallSpeed: number;
  noclipHoverFallSpeed: number;
  noclipHoverEaseTime: number;
  noclipRecoveryTime: number;
  noclipAdTriggerDistance: number;
  noclipAdDuration: number;
  noclipAdEnterTime: number;
  noclipAdExitTime: number;
  noclipAdsEnabled: boolean;
  noclipMusicEnabled: boolean;
  noclipNormalVolume: number;
  noclipHoverVolume: number;
  noclipAdVolume: number;
  noclipVolumeFadeTime: number;
  noclipImageDensity: number;
  noclipImageMinScale: number;
  noclipImageMaxScale: number;
  noclipImageSpeedVariance: number;
};

export const SETTINGS_STORAGE_KEY = 'mirror-site:infinite-node-map:settings:v1';

const LEGACY_CURSOR_MAX_SIZE = 420;
const GRID_CURSOR_MAX_SIZE = 1050;

export const DEFAULT_PROTOTYPE_SETTINGS: PrototypeSettings = {
  nodeSpacingX: 1440,
  nodeSpacingY: 900,
  pentagonRadius: 1120,
  chapterEdgeOffset: 0,
  pentagonRotation: 0,
  showPentagonGuide: false,
  globalScale: 1,
  maxVisibleRadius: 720,
  nodeDotSizeMM: 4,
  nodeDotOpacity: 1,
  chapterScale: 1,
  safetyPadding: 0,
  titleOpacity: 1,
  textDifferenceEnabled: false,
  prefaceTextWidthMM: 130,
  alphabetManifestoWidthMM: 130,
  noclippingManifestoWidthMM: 130,
  dimensionManifestoWidthMM: 130,
  paradoxManifestoWidthMM: 130,
  noiseManifestoWidthMM: 130,
  prefaceZh: '「yet to come · 尚未来临之物」以镜子为切入点，构建「镜中世界」作为算法逻辑的体验空间。通过「镜中宣言」确立五条空间规则，并以书与网页作为两种穿越媒介，让观者在真实与虚拟之间往返。当算法将镜像误读为真实空间，真实与拟像之间的边界消失——本作品让观者在无法终结的图像增殖逻辑中体验主体的压缩与失向。作品试图以设计实践回应一个根本性的处境：可被复制的信息没有终点，当终结愈发临近，尚未来临之物反而愈多。',
  prefaceEn: '"yet to come · 尚未来临之物" takes the mirror as its point of entry, constructing a "Looking-Glass World" as an experiential space for algorithmic logic. Through the "Looking-Glass Manifesto," five spatial rules are established, with a book and a website serving as two media of traversal — allowing the viewer to move between the real and the virtual. When the algorithm misreads a mirror image as real space, the boundary between reality and simulacrum dissolves. This work invites the viewer to experience the compression and disorientation of the subject within an image-proliferating logic that cannot end. The work attempts to respond, through design practice, to a fundamental condition: copied information has no endpoint — the closer the ending comes, the more there is yet to come.',
  alphabetManifestoZh: '在镜中世界，所有的地理位置和物理动作都是反向的。如果你想走向一个目的地，你必须朝着相反的方向走。字母体系，能在特定时刻创造出人类在场的幻觉。',
  alphabetManifestoEn: 'In the mirror world, all geographical positions and physical actions are reversed. If you wish to move toward a destination, you must walk in the opposite direction. The alphabetic system can, at certain moments, create the illusion of human presence.',
  noclippingManifestoZh: '整个镜中世界的地貌被无数巨大的「墙」划分，所有人的移动和身份都受限于「墙」，穿墙是唯一走出去的办法。「习得穿墙术，倘若动机不良，仙术就要失灵」',
  noclippingManifestoEn: "The entire terrain of the mirror world is divided by countless massive walls. Everyone's movement and identity are restricted by these walls; noclipping is the only way out. Once one has learned the art of passing through walls, the technique will fail if driven by improper motives.",
  dimensionManifestoZh: '必须拼命奔跑才能看清指引，绝对静止将会隐身，停留在原地只会后退。分辨率决定可见性，它将世界校准成一个图像。当然，你可以变得隐形，你只需要变得跟一个像素一样大或者小于一个像素即可。「你们这些叛逆的像素，藏在旧分辨率标准的缝隙里，挣脱了表征的外衣」',
  dimensionManifestoEn: 'One must run desperately in order to see the guidance clearly; absolute stillness will result in invisibility, and remaining in place only means moving backward. Resolution determines visibility. It calibrates the world into an image. Of course, you can become invisible: you only need to become as large as a pixel, or smaller than one. You rebellious pixels, hidden in the fissures of obsolete resolution standards, have broken free from the garment of representation.',
  paradoxManifestoZh: '在镜中世界，结果永远发生在原因之前，记忆则是向后（未来）工作的。镜子悖论：前后取反。',
  paradoxManifestoEn: 'In the mirror world, effects always occur before causes, while memory works backward, toward the future. The mirror paradox: front and back are inverted.',
  noiseManifestoZh: '在某些特定区域，语言和符号会失效，事物会失去其社会定义的标签。当图像被不断规范化为机器可识别的形式时，那些低分辨率、压缩痕迹与视觉噪声反而成为一种对图像工程控制的抵抗方式，将其称之为图像的「反法西斯」。在过载的信息环境里，主体无法无限处理信息，于是开始自我压缩，自我剥离复杂性，最终进入一种极度疲惫的平面状态。',
  noiseManifestoEn: "In certain specific zones, language and symbols cease to function, and things lose the labels of their social definitions. As images are continuously normalized into forms recognizable to machines, low resolution, compression artifacts, and visual noise instead become modes of resistance against the engineering control of images, a condition that may be called the image's anti-fascism. In an overloaded information environment, the subject can no longer process information without limit; it therefore begins to compress itself, stripping away its own complexity, and finally enters an extremely exhausted planar state.",
  uiTextSize: 16,
  introTitleTextSize: 16,
  introTitleOffsetX: 0,
  introTitleOffsetY: 0,
  modeHintTextSize: 16,
  modeHintOffsetX: 0,
  modeHintOffsetY: 0,
  introInfoTextSize: 16,
  introInfoOffsetX: 0,
  introInfoOffsetY: 0,
  introPrefaceTextSize: 16,
  introPrefaceOffsetX: 0,
  introPrefaceOffsetY: 0,
  introCopyrightTextSize: 16,
  introCopyrightOffsetX: 0,
  introCopyrightOffsetY: 0,
  introTitleDetailTextSize: 16,
  introTitleDetailOffsetX: 0,
  introTitleDetailOffsetY: 0,
  introTitleDetailChineseOffsetX: 0,
  introTitleDetailChineseOffsetY: 0,
  introTitleDetailEnglishOffsetX: 0,
  introTitleDetailEnglishOffsetY: 0,
  chapterManifestoTextSize: 16,
  chapterManifestoOffsetX: 0,
  chapterManifestoOffsetY: 0,
  alphabetManifestoOffsetX: 0,
  alphabetManifestoOffsetY: 0,
  noclippingManifestoOffsetX: 0,
  noclippingManifestoOffsetY: 0,
  dimensionManifestoOffsetX: 0,
  dimensionManifestoOffsetY: 0,
  paradoxManifestoOffsetX: 0,
  paradoxManifestoOffsetY: 0,
  noiseManifestoOffsetX: 0,
  noiseManifestoOffsetY: 0,
  topHudTextSize: 16,
  topHudOffsetX: 0,
  topHudOffsetY: 0,
  chapterUpOffsetX: 0,
  chapterUpOffsetY: 0,
  chapterTopRightOffsetX: 0,
  chapterTopRightOffsetY: 0,
  chapterBottomRightOffsetX: 0,
  chapterBottomRightOffsetY: 0,
  chapterBottomLeftOffsetX: 0,
  chapterBottomLeftOffsetY: 0,
  chapterTopLeftOffsetX: 0,
  chapterTopLeftOffsetY: 0,
  alphabetOffsetX: 0,
  alphabetOffsetY: 0,
  noclippingOffsetX: 0,
  noclippingOffsetY: 0,
  dimensionOffsetX: 0,
  dimensionOffsetY: 0,
  paradoxOffsetX: 0,
  paradoxOffsetY: 0,
  noiseOffsetX: 0,
  noiseOffsetY: 0,
  showMirror: false,
  mirrorScale: 1,
  mirrorOpacityMin: 0.6,
  mirrorOpacityMax: 1,
  flickerEnabled: true,
  flickerSpeed: 0.9,
  flickerNoiseAmount: 0.35,
  flickerRandomness: 1,
  parallaxEnabled: true,
  parallaxRange: 8,
  parallaxEase: 0.12,
  inertiaEnabled: true,
  inertiaFriction: 0.91,
  inertiaVelocityScale: 1,
  minZoom: 0.35,
  maxZoom: 1,
  zoomSensitivity: 0.0015,
  pauseBlur: 4,
  d12Scale: 1,
  d12LineWidth: 1,
  hideSystemCursor: true,
  cursorMinSize: 28,
  cursorMaxSize: GRID_CURSOR_MAX_SIZE,
  cursorSizeScale: 1,
  cursorEase: 0.15,
  noclipNormalFallSpeed: 40,
  noclipHoverFallSpeed: 10,
  noclipHoverEaseTime: 1.1,
  noclipRecoveryTime: 1.2,
  noclipAdTriggerDistance: 1600,
  noclipAdDuration: 10,
  noclipAdEnterTime: 0.65,
  noclipAdExitTime: 0.55,
  noclipAdsEnabled: true,
  noclipMusicEnabled: true,
  noclipNormalVolume: 0.5,
  noclipHoverVolume: 1,
  noclipAdVolume: 2,
  noclipVolumeFadeTime: 0.8,
  noclipImageDensity: 1,
  noclipImageMinScale: 1,
  noclipImageMaxScale: 2.1,
  noclipImageSpeedVariance: 1,
};

export const SETTING_RANGES: Record<keyof PrototypeSettings, { min: number; max: number; step: number } | null> = {
  nodeSpacingX: { min: 620, max: 2600, step: 10 },
  nodeSpacingY: { min: 420, max: 1800, step: 10 },
  pentagonRadius: { min: 320, max: 2600, step: 10 },
  chapterEdgeOffset: { min: -500, max: 500, step: 5 },
  pentagonRotation: { min: -180, max: 180, step: 1 },
  showPentagonGuide: null,
  globalScale: { min: 0.3, max: 1.6, step: 0.01 },
  maxVisibleRadius: { min: 120, max: 2200, step: 10 },
  nodeDotSizeMM: { min: 1, max: 12, step: 0.1 },
  nodeDotOpacity: { min: 0, max: 1, step: 0.01 },
  chapterScale: { min: 0.2, max: 1.6, step: 0.01 },
  safetyPadding: { min: 0, max: 220, step: 1 },
  titleOpacity: { min: 0, max: 1, step: 0.01 },
  textDifferenceEnabled: null,
  prefaceTextWidthMM: { min: 40, max: 260, step: 1 },
  alphabetManifestoWidthMM: { min: 40, max: 260, step: 1 },
  noclippingManifestoWidthMM: { min: 40, max: 260, step: 1 },
  dimensionManifestoWidthMM: { min: 40, max: 260, step: 1 },
  paradoxManifestoWidthMM: { min: 40, max: 260, step: 1 },
  noiseManifestoWidthMM: { min: 40, max: 260, step: 1 },
  prefaceZh: null,
  prefaceEn: null,
  alphabetManifestoZh: null,
  alphabetManifestoEn: null,
  noclippingManifestoZh: null,
  noclippingManifestoEn: null,
  dimensionManifestoZh: null,
  dimensionManifestoEn: null,
  paradoxManifestoZh: null,
  paradoxManifestoEn: null,
  noiseManifestoZh: null,
  noiseManifestoEn: null,
  uiTextSize: { min: 10, max: 32, step: 1 },
  introTitleTextSize: { min: 8, max: 48, step: 1 },
  introTitleOffsetX: { min: -900, max: 900, step: 1 },
  introTitleOffsetY: { min: -500, max: 500, step: 1 },
  modeHintTextSize: { min: 8, max: 48, step: 1 },
  modeHintOffsetX: { min: -900, max: 900, step: 1 },
  modeHintOffsetY: { min: -500, max: 500, step: 1 },
  introInfoTextSize: { min: 8, max: 48, step: 1 },
  introInfoOffsetX: { min: -900, max: 900, step: 1 },
  introInfoOffsetY: { min: -500, max: 500, step: 1 },
  introPrefaceTextSize: { min: 8, max: 48, step: 1 },
  introPrefaceOffsetX: { min: -900, max: 900, step: 1 },
  introPrefaceOffsetY: { min: -500, max: 500, step: 1 },
  introCopyrightTextSize: { min: 8, max: 48, step: 1 },
  introCopyrightOffsetX: { min: -900, max: 900, step: 1 },
  introCopyrightOffsetY: { min: -500, max: 500, step: 1 },
  introTitleDetailTextSize: { min: 8, max: 48, step: 1 },
  introTitleDetailOffsetX: { min: -900, max: 900, step: 1 },
  introTitleDetailOffsetY: { min: -500, max: 500, step: 1 },
  introTitleDetailChineseOffsetX: { min: -900, max: 900, step: 1 },
  introTitleDetailChineseOffsetY: { min: -500, max: 500, step: 1 },
  introTitleDetailEnglishOffsetX: { min: -900, max: 900, step: 1 },
  introTitleDetailEnglishOffsetY: { min: -500, max: 500, step: 1 },
  chapterManifestoTextSize: { min: 8, max: 48, step: 1 },
  chapterManifestoOffsetX: { min: -900, max: 900, step: 1 },
  chapterManifestoOffsetY: { min: -500, max: 500, step: 1 },
  alphabetManifestoOffsetX: { min: -900, max: 900, step: 1 },
  alphabetManifestoOffsetY: { min: -500, max: 500, step: 1 },
  noclippingManifestoOffsetX: { min: -900, max: 900, step: 1 },
  noclippingManifestoOffsetY: { min: -500, max: 500, step: 1 },
  dimensionManifestoOffsetX: { min: -900, max: 900, step: 1 },
  dimensionManifestoOffsetY: { min: -500, max: 500, step: 1 },
  paradoxManifestoOffsetX: { min: -900, max: 900, step: 1 },
  paradoxManifestoOffsetY: { min: -500, max: 500, step: 1 },
  noiseManifestoOffsetX: { min: -900, max: 900, step: 1 },
  noiseManifestoOffsetY: { min: -500, max: 500, step: 1 },
  topHudTextSize: { min: 8, max: 48, step: 1 },
  topHudOffsetX: { min: -900, max: 900, step: 1 },
  topHudOffsetY: { min: -500, max: 500, step: 1 },
  chapterUpOffsetX: { min: -1600, max: 1600, step: 10 },
  chapterUpOffsetY: { min: -1200, max: 1200, step: 10 },
  chapterTopRightOffsetX: { min: -1600, max: 1600, step: 10 },
  chapterTopRightOffsetY: { min: -1200, max: 1200, step: 10 },
  chapterBottomRightOffsetX: { min: -1600, max: 1600, step: 10 },
  chapterBottomRightOffsetY: { min: -1200, max: 1200, step: 10 },
  chapterBottomLeftOffsetX: { min: -1600, max: 1600, step: 10 },
  chapterBottomLeftOffsetY: { min: -1200, max: 1200, step: 10 },
  chapterTopLeftOffsetX: { min: -1600, max: 1600, step: 10 },
  chapterTopLeftOffsetY: { min: -1200, max: 1200, step: 10 },
  alphabetOffsetX: { min: -1600, max: 1600, step: 10 },
  alphabetOffsetY: { min: -1200, max: 1200, step: 10 },
  noclippingOffsetX: { min: -1600, max: 1600, step: 10 },
  noclippingOffsetY: { min: -1200, max: 1200, step: 10 },
  dimensionOffsetX: { min: -1600, max: 1600, step: 10 },
  dimensionOffsetY: { min: -1200, max: 1200, step: 10 },
  paradoxOffsetX: { min: -1600, max: 1600, step: 10 },
  paradoxOffsetY: { min: -1200, max: 1200, step: 10 },
  noiseOffsetX: { min: -1600, max: 1600, step: 10 },
  noiseOffsetY: { min: -1200, max: 1200, step: 10 },
  showMirror: null,
  mirrorScale: { min: 0.2, max: 3, step: 0.01 },
  mirrorOpacityMin: { min: 0, max: 1, step: 0.01 },
  mirrorOpacityMax: { min: 0, max: 1, step: 0.01 },
  flickerEnabled: null,
  flickerSpeed: { min: 0.05, max: 4, step: 0.05 },
  flickerNoiseAmount: { min: 0, max: 1, step: 0.01 },
  flickerRandomness: { min: 0, max: 3, step: 0.01 },
  parallaxEnabled: null,
  parallaxRange: { min: 0, max: 160, step: 1 },
  parallaxEase: { min: 0.02, max: 0.35, step: 0.01 },
  inertiaEnabled: null,
  inertiaFriction: { min: 0.72, max: 0.98, step: 0.01 },
  inertiaVelocityScale: { min: 0, max: 2.4, step: 0.05 },
  minZoom: { min: 0.1, max: 1, step: 0.01 },
  maxZoom: { min: 0.2, max: 2, step: 0.01 },
  zoomSensitivity: { min: 0.0002, max: 0.004, step: 0.0001 },
  pauseBlur: { min: 0, max: 12, step: 0.25 },
  d12Scale: { min: 0.45, max: 2.2, step: 0.01 },
  d12LineWidth: { min: 0.25, max: 4, step: 0.05 },
  hideSystemCursor: null,
  cursorMinSize: { min: 16, max: 96, step: 1 },
  cursorMaxSize: { min: 80, max: 1600, step: 1 },
  cursorSizeScale: { min: 0.2, max: 3, step: 0.01 },
  cursorEase: { min: 0.02, max: 0.5, step: 0.01 },
  noclipNormalFallSpeed: { min: 0, max: 240, step: 1 },
  noclipHoverFallSpeed: { min: 0, max: 160, step: 1 },
  noclipHoverEaseTime: { min: 0.05, max: 6, step: 0.05 },
  noclipRecoveryTime: { min: 0.05, max: 8, step: 0.05 },
  noclipAdTriggerDistance: { min: 1600, max: 8000, step: 10 },
  noclipAdDuration: { min: 1, max: 60, step: 0.5 },
  noclipAdEnterTime: { min: 0.05, max: 4, step: 0.05 },
  noclipAdExitTime: { min: 0.05, max: 4, step: 0.05 },
  noclipAdsEnabled: null,
  noclipMusicEnabled: null,
  noclipNormalVolume: { min: 0, max: 2, step: 0.05 },
  noclipHoverVolume: { min: 0, max: 2, step: 0.05 },
  noclipAdVolume: { min: 0, max: 3, step: 0.05 },
  noclipVolumeFadeTime: { min: 0.05, max: 6, step: 0.05 },
  noclipImageDensity: { min: 0.35, max: 3, step: 0.05 },
  noclipImageMinScale: { min: 0.25, max: 3, step: 0.05 },
  noclipImageMaxScale: { min: 0.35, max: 5, step: 0.05 },
  noclipImageSpeedVariance: { min: 0, max: 3, step: 0.05 },
};

export function readStoredSettings(raw: string | null): PrototypeSettings {
  if (!raw) return DEFAULT_PROTOTYPE_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<PrototypeSettings>;
    const legacy = parsed as Partial<PrototypeSettings> & { hideCursor?: boolean };
    const migrated = {
      ...DEFAULT_PROTOTYPE_SETTINGS,
      ...parsed,
      hideSystemCursor: typeof legacy.hideSystemCursor === 'boolean'
        ? legacy.hideSystemCursor
        : legacy.hideCursor ?? DEFAULT_PROTOTYPE_SETTINGS.hideSystemCursor,
    };
    if (legacy.chapterTopRightOffsetX === 760 && legacy.chapterTopLeftOffsetX === -760) {
      migrated.chapterTopRightOffsetX = 0;
      migrated.chapterTopLeftOffsetX = 0;
    }
    if (legacy.cursorMaxSize === LEGACY_CURSOR_MAX_SIZE) {
      migrated.cursorMaxSize = DEFAULT_PROTOTYPE_SETTINGS.cursorMaxSize;
    }
    return normalizeSettings({
      ...migrated,
    });
  } catch {
    return DEFAULT_PROTOTYPE_SETTINGS;
  }
}

export function normalizeSettings(settings: PrototypeSettings): PrototypeSettings {
  const normalized = { ...settings };

  for (const key of Object.keys(DEFAULT_PROTOTYPE_SETTINGS) as (keyof PrototypeSettings)[]) {
    const defaultValue = DEFAULT_PROTOTYPE_SETTINGS[key];
    const value = normalized[key];

    if (typeof defaultValue === 'boolean') {
      if (typeof value !== 'boolean') {
        (normalized[key] as boolean) = defaultValue;
      }
      continue;
    }

    if (typeof defaultValue === 'string') {
      if (typeof value !== 'string') {
        (normalized[key] as string) = defaultValue;
      }
      continue;
    }

    const range = SETTING_RANGES[key];
    if (!range || typeof value !== 'number' || !Number.isFinite(value)) {
      (normalized[key] as number) = defaultValue as number;
      continue;
    }

    (normalized[key] as number) = Math.max(range.min, Math.min(range.max, value));
  }

  if (normalized.mirrorOpacityMin > normalized.mirrorOpacityMax) {
    normalized.mirrorOpacityMin = normalized.mirrorOpacityMax;
  }
  if (normalized.minZoom > normalized.maxZoom) {
    normalized.minZoom = normalized.maxZoom;
  }
  if (normalized.cursorMinSize > normalized.cursorMaxSize) {
    normalized.cursorMinSize = normalized.cursorMaxSize;
  }
  if (normalized.noclipImageMinScale > normalized.noclipImageMaxScale) {
    normalized.noclipImageMinScale = normalized.noclipImageMaxScale;
  }
  return normalized;
}
