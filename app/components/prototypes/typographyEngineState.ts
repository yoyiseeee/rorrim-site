// Typography Engine — Intro-only scoped typography presets and runtime CSS.

export const TYPOGRAPHY_STORAGE_KEY = 'mirror.typography.v5';
export const TYPOGRAPHY_RUNTIME_STYLE_ID = 'mirror-typography-runtime';
export const TYPOGRAPHY_RED = '#fe3b1f';

export const TYPOGRAPHY_SCOPE_IDS = [
  'intro.infoLabel',
  'intro.title.zh',
  'intro.title.en',
  'intro.titleText.zh',
  'intro.titleText.en',
  'intro.preface.zh',
  'intro.preface.en',
  'intro.manifesto.alphabet.zh',
  'intro.manifesto.alphabet.en',
  'intro.manifesto.noclipping.zh',
  'intro.manifesto.noclipping.en',
  'intro.manifesto.dimension.zh',
  'intro.manifesto.dimension.en',
  'intro.manifesto.paradox.zh',
  'intro.manifesto.paradox.en',
  'intro.manifesto.noise.zh',
  'intro.manifesto.noise.en',
  'intro.footer',
  'intro.hint.zh',
  'intro.hint.en',
] as const;

export type TypographyScopeId = (typeof TYPOGRAPHY_SCOPE_IDS)[number];
export type TypographyTextAlign = 'left' | 'center' | 'right' | 'justify';
export type TypographyVerticalAlignMode = 'normal' | 'baseline' | 'optical';

export type TypographyScopeSettings = {
  enabled: boolean;
  fontFamily?: string;
  fontSizePx?: number;
  lineHeight?: number;
  fontWeight?: string | number;
  letterSpacingEm?: number;
  wordSpacingEm?: number;
  textAlign?: TypographyTextAlign;
  verticalAlignMode?: TypographyVerticalAlignMode;
  hangingPunctuation?: boolean;
  marginTopEm?: number;
  marginBottomEm?: number;
  textIndentEm?: number;
  scaleX?: number;
  scaleY?: number;
  rotateDeg?: number;
  fontStyle?: 'normal' | 'italic';
  fontFeatureSettings?: string;
  zhEnSpacingEm?: number;
  punctuationHangingEm?: number;
  baselineShiftEm?: number;
  opacity?: number;
  textColor?: string;
  strokeColor?: string;
  strokeWidthPx?: number;
  inverseBlend?: boolean;
};

export type TypographyPreset = {
  version: 5;
  updatedAt: string;
  activeScopeId: TypographyScopeId;
  globalEnabled: boolean;
  scopes: Record<TypographyScopeId, TypographyScopeSettings>;
};

export type TypographyParseResult = {
  preset: TypographyPreset;
  ok: boolean;
  message: string;
  source: 'default' | 'localStorage' | 'project' | 'import';
};

export const TYPOGRAPHY_SCOPE_LABELS: Record<TypographyScopeId, string> = {
  'intro.infoLabel': 'info 字',
  'intro.title.zh': '标题 · 中文',
  'intro.title.en': '标题 · English',
  'intro.titleText.zh': '标题文本 · 中文',
  'intro.titleText.en': '标题文本 · English',
  'intro.preface.zh': '前言 · 中文',
  'intro.preface.en': '前言 · English',
  'intro.manifesto.alphabet.zh': 'Alphabet 宣言 · 中文',
  'intro.manifesto.alphabet.en': 'Alphabet 宣言 · English',
  'intro.manifesto.noclipping.zh': 'Noclipping 宣言 · 中文',
  'intro.manifesto.noclipping.en': 'Noclipping 宣言 · English',
  'intro.manifesto.dimension.zh': 'Dimension 宣言 · 中文',
  'intro.manifesto.dimension.en': 'Dimension 宣言 · English',
  'intro.manifesto.paradox.zh': 'Paradox 宣言 · 中文',
  'intro.manifesto.paradox.en': 'Paradox 宣言 · English',
  'intro.manifesto.noise.zh': 'Noise 宣言 · 中文',
  'intro.manifesto.noise.en': 'Noise 宣言 · English',
  'intro.footer': '版权信息',
  'intro.hint.zh': '底部提示 · 中文',
  'intro.hint.en': '底部提示 · English',
};

export const TYPOGRAPHY_SCOPE_GROUPS: Array<{ label: string; ids: TypographyScopeId[] }> = [
  {
    label: 'Intro 固定文本',
    ids: [
      'intro.infoLabel',
      'intro.title.zh',
      'intro.title.en',
      'intro.titleText.zh',
      'intro.titleText.en',
      'intro.preface.zh',
      'intro.preface.en',
      'intro.footer',
      'intro.hint.zh',
      'intro.hint.en',
    ],
  },
  {
    label: '五个章节宣言',
    ids: [
      'intro.manifesto.alphabet.zh',
      'intro.manifesto.alphabet.en',
      'intro.manifesto.noclipping.zh',
      'intro.manifesto.noclipping.en',
      'intro.manifesto.dimension.zh',
      'intro.manifesto.dimension.en',
      'intro.manifesto.paradox.zh',
      'intro.manifesto.paradox.en',
      'intro.manifesto.noise.zh',
      'intro.manifesto.noise.en',
    ],
  },
];

export const TYPOGRAPHY_FONT_OPTIONS = [
  { value: '"AkzidenzGrotesk", "FZFWZhuZGDSHJW", "Helvetica Neue", Arial, sans-serif', label: 'Akzidenz + 筑紫' },
  { value: '"FZFWZhuZGDSHJW", "AkzidenzGrotesk", serif', label: '筑紫优先' },
  { value: '"AkzidenzGrotesk", "Helvetica Neue", Arial, sans-serif', label: 'Akzidenz' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', label: 'Monospace' },
  { value: 'inherit', label: '继承' },
] as const;

export const TYPOGRAPHY_COLOR_OPTIONS = [
  { value: '#000000', label: '黑' },
  { value: '#888580', label: '灰' },
  { value: TYPOGRAPHY_RED, label: '红' },
] as const;

const BASE_FONT = TYPOGRAPHY_FONT_OPTIONS[0].value;
const ZH_FONT = TYPOGRAPHY_FONT_OPTIONS[1].value;
const WHITE_STROKE = '#ffffff';

function scopeDefaults(overrides: Partial<TypographyScopeSettings>): TypographyScopeSettings {
  return {
    enabled: true,
    fontFamily: BASE_FONT,
    fontSizePx: 16,
    lineHeight: 1.35,
    fontWeight: 500,
    letterSpacingEm: 0,
    wordSpacingEm: 0,
    textAlign: 'center',
    verticalAlignMode: 'normal',
    hangingPunctuation: false,
    marginTopEm: 0,
    marginBottomEm: 0,
    textIndentEm: 0,
    scaleX: 1,
    scaleY: 1,
    rotateDeg: 0,
    fontStyle: 'normal',
    fontFeatureSettings: '',
    zhEnSpacingEm: 0,
    punctuationHangingEm: 0,
    baselineShiftEm: 0,
    opacity: 1,
    textColor: '#000000',
    strokeColor: 'transparent',
    strokeWidthPx: 0,
    inverseBlend: false,
    ...overrides,
  };
}

function stroked(overrides: Partial<TypographyScopeSettings>): TypographyScopeSettings {
  return scopeDefaults({
    ...overrides,
    strokeColor: overrides.strokeColor && overrides.strokeColor !== 'transparent' ? overrides.strokeColor : WHITE_STROKE,
    strokeWidthPx: overrides.strokeWidthPx && overrides.strokeWidthPx > 0 ? overrides.strokeWidthPx : 4,
  });
}

function zh(overrides: Partial<TypographyScopeSettings>): TypographyScopeSettings {
  return scopeDefaults({
    fontFamily: ZH_FONT,
    fontWeight: 400,
    ...overrides,
  });
}

function manifestoZh(): TypographyScopeSettings {
  return stroked(zh({
    fontSizePx: 16,
    lineHeight: 1.6,
    textAlign: 'justify',
    hangingPunctuation: true,
  }));
}

function manifestoEn(): TypographyScopeSettings {
  return stroked({
    fontSizePx: 16,
    lineHeight: 1.6,
    textAlign: 'justify',
  });
}

export const DEFAULT_TYPOGRAPHY_PRESET: TypographyPreset = {
  version: 5,
  updatedAt: '1970-01-01T00:00:00.000Z',
  activeScopeId: 'intro.title.zh',
  globalEnabled: true,
  scopes: {
    'intro.infoLabel': stroked({
      fontSizePx: 16,
      lineHeight: 1.25,
      textAlign: 'left',
    }),
    'intro.title.zh': stroked(zh({
      fontSizePx: 16,
      lineHeight: 1.25,
      textAlign: 'center',
    })),
    'intro.title.en': stroked({
      fontSizePx: 16,
      lineHeight: 1.25,
      textAlign: 'center',
    }),
    'intro.titleText.zh': stroked(zh({
      fontSizePx: 16,
      lineHeight: 1.35,
      textAlign: 'center',
    })),
    'intro.titleText.en': stroked({
      fontSizePx: 16,
      lineHeight: 1.35,
      textAlign: 'center',
    }),
    'intro.preface.zh': stroked(zh({
      fontSizePx: 16,
      lineHeight: 1.55,
      textAlign: 'justify',
      hangingPunctuation: true,
    })),
    'intro.preface.en': stroked({
      fontSizePx: 16,
      lineHeight: 1.55,
      textAlign: 'justify',
    }),
    'intro.manifesto.alphabet.zh': manifestoZh(),
    'intro.manifesto.alphabet.en': manifestoEn(),
    'intro.manifesto.noclipping.zh': manifestoZh(),
    'intro.manifesto.noclipping.en': manifestoEn(),
    'intro.manifesto.dimension.zh': manifestoZh(),
    'intro.manifesto.dimension.en': manifestoEn(),
    'intro.manifesto.paradox.zh': manifestoZh(),
    'intro.manifesto.paradox.en': manifestoEn(),
    'intro.manifesto.noise.zh': manifestoZh(),
    'intro.manifesto.noise.en': manifestoEn(),
    'intro.footer': stroked({
      fontSizePx: 11,
      lineHeight: 1.2,
      fontWeight: 500,
      textAlign: 'left',
    }),
    'intro.hint.zh': stroked(zh({
      fontSizePx: 16,
      lineHeight: 1.25,
      textAlign: 'center',
    })),
    'intro.hint.en': stroked({
      fontSizePx: 16,
      lineHeight: 1.25,
      textAlign: 'center',
    }),
  },
};

const LIMITS = {
  fontSizePx: [4, 400],
  lineHeight: [0.5, 4],
  letterSpacingEm: [-0.3, 1],
  wordSpacingEm: [-0.5, 2],
  marginTopEm: [-5, 5],
  marginBottomEm: [-5, 5],
  textIndentEm: [-5, 8],
  scaleX: [0.2, 3],
  scaleY: [0.2, 3],
  rotateDeg: [-180, 180],
  zhEnSpacingEm: [-0.5, 1],
  punctuationHangingEm: [-1, 1],
  baselineShiftEm: [-2, 2],
  opacity: [0, 1],
  strokeWidthPx: [0, 24],
} as const;

export function createTypographyPreset(overrides?: Partial<TypographyPreset>): TypographyPreset {
  return normalizeTypographyPreset({
    ...DEFAULT_TYPOGRAPHY_PRESET,
    updatedAt: new Date().toISOString(),
    ...overrides,
    scopes: {
      ...DEFAULT_TYPOGRAPHY_PRESET.scopes,
      ...(overrides?.scopes ?? {}),
    },
  });
}

export function parseTypographyPreset(
  raw: string,
  source: TypographyParseResult['source'] = 'import',
): TypographyParseResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return failParse('JSON 不是对象', source);
    }
    if (parsed.version !== 5) {
      return failParse('配置版本不匹配，已回退默认配置', source);
    }
    return {
      preset: normalizeTypographyPreset(parsed),
      ok: true,
      message: source === 'localStorage' ? '已从 localStorage 加载' : source === 'project' ? '已从项目 preset 加载' : '导入配置已应用，尚未保存',
      source,
    };
  } catch {
    return failParse('JSON 解析失败，已回退默认配置', source);
  }
}

export function readStoredTypographyPreset(raw: string | null): TypographyParseResult {
  if (!raw) {
    return {
      preset: DEFAULT_TYPOGRAPHY_PRESET,
      ok: true,
      message: '未找到保存配置，使用默认排版',
      source: 'default',
    };
  }
  return parseTypographyPreset(raw, 'localStorage');
}

export function normalizeTypographyPreset(input: unknown): TypographyPreset {
  const record = isRecord(input) ? input : {};
  const rawScopes = isRecord(record.scopes) ? record.scopes : {};
  const activeScopeId = isTypographyScopeId(record.activeScopeId) ? record.activeScopeId : 'intro.title.zh';

  return {
    version: 5,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
    activeScopeId,
    globalEnabled: typeof record.globalEnabled === 'boolean' ? record.globalEnabled : true,
    scopes: Object.fromEntries(TYPOGRAPHY_SCOPE_IDS.map((scopeId) => [
      scopeId,
      normalizeScopeSettings(rawScopes[scopeId], DEFAULT_TYPOGRAPHY_PRESET.scopes[scopeId]),
    ])) as Record<TypographyScopeId, TypographyScopeSettings>,
  };
}

export function updateTypographyScope(
  preset: TypographyPreset,
  scopeId: TypographyScopeId,
  patch: Partial<TypographyScopeSettings>,
): TypographyPreset {
  return {
    ...preset,
    updatedAt: new Date().toISOString(),
    scopes: {
      ...preset.scopes,
      [scopeId]: normalizeScopeSettings({
        ...preset.scopes[scopeId],
        ...patch,
      }, preset.scopes[scopeId]),
    },
  };
}

export function generateTypographyCSS(preset: TypographyPreset): string {
  if (!preset.globalEnabled) return '';

  const parts = ['/* Mirror Typography Runtime · Intro scopes */'];
  for (const scopeId of TYPOGRAPHY_SCOPE_IDS) {
    const settings = preset.scopes[scopeId];
    if (!settings.enabled) continue;
    const lines = buildScopeRules(settings);
    if (lines.length === 0) continue;
    parts.push(`[data-typo-scope="${scopeId}"] {`);
    parts.push(lines.join('\n'));
    parts.push('}');
  }
  parts.push('');
  return parts.join('\n');
}

function buildScopeRules(settings: TypographyScopeSettings): string[] {
  const lines: string[] = [];
  if (settings.fontFamily) lines.push(`  font-family: ${settings.fontFamily} !important;`);
  if (settings.fontSizePx !== undefined) lines.push(`  font-size: ${settings.fontSizePx}px !important;`);
  if (settings.lineHeight !== undefined) lines.push(`  line-height: ${settings.lineHeight} !important;`);
  if (settings.fontWeight !== undefined) lines.push(`  font-weight: ${settings.fontWeight} !important;`);
  if (settings.fontStyle) lines.push(`  font-style: ${settings.fontStyle} !important;`);
  if (settings.letterSpacingEm !== undefined) lines.push(`  letter-spacing: ${settings.letterSpacingEm}em !important;`);
  if (settings.inverseBlend) {
    lines.push('  color: #ffffff !important;');
    lines.push('  -webkit-text-fill-color: #ffffff !important;');
    lines.push('  mix-blend-mode: difference !important;');
    lines.push('  filter: none !important;');
    lines.push('  text-shadow: none !important;');
    lines.push('  -webkit-text-stroke: 0 transparent !important;');
    lines.push('  background: transparent !important;');
  } else if (settings.textColor) {
    lines.push(`  color: ${settings.textColor} !important;`);
  }
  if (!settings.inverseBlend && settings.strokeWidthPx !== undefined && settings.strokeWidthPx > 0 && settings.strokeColor && settings.strokeColor !== 'transparent') {
    lines.push('  text-shadow: none !important;');
    lines.push(`  -webkit-text-stroke: ${settings.strokeWidthPx}px ${settings.strokeColor} !important;`);
    lines.push('  paint-order: stroke fill !important;');
    lines.push('  overflow: visible !important;');
  }

  const wordSpacing = (settings.wordSpacingEm ?? 0) + (settings.zhEnSpacingEm ?? 0);
  if (wordSpacing !== 0) lines.push(`  word-spacing: ${wordSpacing}em !important;`);

  if (settings.textAlign) {
    lines.push(`  text-align: ${settings.textAlign} !important;`);
    lines.push(`  text-align-last: ${settings.textAlign === 'justify' ? 'left' : settings.textAlign} !important;`);
  }
  if (settings.hangingPunctuation) lines.push('  hanging-punctuation: allow-end first !important;');
  if (settings.marginTopEm !== undefined) lines.push(`  margin-top: ${settings.marginTopEm}em !important;`);
  if (settings.marginBottomEm !== undefined) lines.push(`  margin-bottom: ${settings.marginBottomEm}em !important;`);
  if (settings.textIndentEm) lines.push(`  text-indent: ${settings.textIndentEm}em !important;`);
  if (settings.fontFeatureSettings?.trim()) lines.push(`  font-feature-settings: ${settings.fontFeatureSettings.trim()} !important;`);
  if (settings.opacity !== undefined) lines.push(`  opacity: ${settings.opacity} !important;`);
  if (settings.punctuationHangingEm) lines.push(`  margin-inline-start: ${settings.punctuationHangingEm}em !important;`);

  const transform = buildTransform(settings);
  if (transform) {
    lines.push(`  transform: ${transform} !important;`);
    lines.push('  transform-origin: center center !important;');
  }
  if (settings.verticalAlignMode === 'baseline') lines.push('  vertical-align: baseline !important;');
  if (settings.verticalAlignMode === 'optical') lines.push('  text-rendering: geometricPrecision !important;');

  return lines;
}

function buildTransform(settings: TypographyScopeSettings): string {
  const transforms: string[] = [];
  if (settings.baselineShiftEm) transforms.push(`translateY(${settings.baselineShiftEm}em)`);
  if (settings.scaleX !== undefined && settings.scaleX !== 1) transforms.push(`scaleX(${settings.scaleX})`);
  if (settings.scaleY !== undefined && settings.scaleY !== 1) transforms.push(`scaleY(${settings.scaleY})`);
  if (settings.rotateDeg) transforms.push(`rotate(${settings.rotateDeg}deg)`);
  return transforms.join(' ');
}

function normalizeScopeSettings(input: unknown, fallback: TypographyScopeSettings): TypographyScopeSettings {
  const record = isRecord(input) ? input : {};
  const normalized: TypographyScopeSettings = {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : fallback.enabled,
    fontFamily: typeof record.fontFamily === 'string' ? record.fontFamily : fallback.fontFamily,
    fontSizePx: clampNumber(record.fontSizePx, fallback.fontSizePx, LIMITS.fontSizePx),
    lineHeight: clampNumber(record.lineHeight, fallback.lineHeight, LIMITS.lineHeight),
    fontWeight: typeof record.fontWeight === 'string' || typeof record.fontWeight === 'number' ? record.fontWeight : fallback.fontWeight,
    letterSpacingEm: clampNumber(record.letterSpacingEm, fallback.letterSpacingEm, LIMITS.letterSpacingEm),
    wordSpacingEm: clampNumber(record.wordSpacingEm, fallback.wordSpacingEm, LIMITS.wordSpacingEm),
    textAlign: isTextAlign(record.textAlign) ? record.textAlign : fallback.textAlign,
    verticalAlignMode: isVerticalAlignMode(record.verticalAlignMode) ? record.verticalAlignMode : fallback.verticalAlignMode,
    hangingPunctuation: typeof record.hangingPunctuation === 'boolean' ? record.hangingPunctuation : fallback.hangingPunctuation,
    marginTopEm: clampNumber(record.marginTopEm, fallback.marginTopEm, LIMITS.marginTopEm),
    marginBottomEm: clampNumber(record.marginBottomEm, fallback.marginBottomEm, LIMITS.marginBottomEm),
    textIndentEm: clampNumber(record.textIndentEm, fallback.textIndentEm, LIMITS.textIndentEm),
    scaleX: clampNumber(record.scaleX, fallback.scaleX, LIMITS.scaleX),
    scaleY: clampNumber(record.scaleY, fallback.scaleY, LIMITS.scaleY),
    rotateDeg: clampNumber(record.rotateDeg, fallback.rotateDeg, LIMITS.rotateDeg),
    fontStyle: record.fontStyle === 'italic' ? 'italic' : 'normal',
    fontFeatureSettings: typeof record.fontFeatureSettings === 'string' ? record.fontFeatureSettings : fallback.fontFeatureSettings,
    zhEnSpacingEm: clampNumber(record.zhEnSpacingEm, fallback.zhEnSpacingEm, LIMITS.zhEnSpacingEm),
    punctuationHangingEm: clampNumber(record.punctuationHangingEm, fallback.punctuationHangingEm, LIMITS.punctuationHangingEm),
    baselineShiftEm: clampNumber(record.baselineShiftEm, fallback.baselineShiftEm, LIMITS.baselineShiftEm),
    opacity: clampNumber(record.opacity, fallback.opacity, LIMITS.opacity),
    textColor: typeof record.textColor === 'string' ? record.textColor : fallback.textColor,
    strokeColor: typeof record.strokeColor === 'string' ? record.strokeColor : fallback.strokeColor,
    strokeWidthPx: clampNumber(record.strokeWidthPx, fallback.strokeWidthPx, LIMITS.strokeWidthPx),
    inverseBlend: typeof record.inverseBlend === 'boolean' ? record.inverseBlend : fallback.inverseBlend,
  };
  if (normalized.inverseBlend) {
    normalized.strokeColor = 'transparent';
    normalized.strokeWidthPx = 0;
  }
  return normalized;
}

function failParse(message: string, source: TypographyParseResult['source']): TypographyParseResult {
  return {
    preset: DEFAULT_TYPOGRAPHY_PRESET,
    ok: false,
    message,
    source,
  };
}

function clampNumber(value: unknown, fallback: number | undefined, limits: readonly [number, number]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(limits[0], Math.min(limits[1], value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTypographyScopeId(value: unknown): value is TypographyScopeId {
  return typeof value === 'string' && (TYPOGRAPHY_SCOPE_IDS as readonly string[]).includes(value);
}

function isTextAlign(value: unknown): value is TypographyTextAlign {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify';
}

function isVerticalAlignMode(value: unknown): value is TypographyVerticalAlignMode {
  return value === 'normal' || value === 'baseline' || value === 'optical';
}
