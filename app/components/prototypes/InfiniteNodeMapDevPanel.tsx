import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import styles from './InfiniteNodeMapPrototype.module.css';
import {
  DEFAULT_PROTOTYPE_SETTINGS,
  SETTING_RANGES,
  type PrototypeSettings,
} from './infiniteNodeMapSettings';

type Field = keyof PrototypeSettings;
type PanelDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  panelX: number;
  panelY: number;
};

const GROUPS: { title: string; fields: Field[]; open?: boolean }[] = [
  { title: '网格', fields: [
    'pentagonRadius',
    'chapterEdgeOffset',
    'pentagonRotation',
    'showPentagonGuide',
    'globalScale',
    'maxVisibleRadius',
  ], open: true },
  { title: '黑点', fields: ['nodeDotSizeMM', 'nodeDotOpacity'] },
  { title: '章节图', fields: ['chapterScale', 'safetyPadding', 'titleOpacity'] },
  { title: '文本显示', fields: [
    'textDifferenceEnabled',
    'prefaceTextWidthMM',
    'alphabetManifestoWidthMM',
    'noclippingManifestoWidthMM',
    'dimensionManifestoWidthMM',
    'paradoxManifestoWidthMM',
    'noiseManifestoWidthMM',
  ] },
  { title: '章节位置', fields: [
    'chapterUpOffsetX',
    'chapterUpOffsetY',
    'chapterTopRightOffsetX',
    'chapterTopRightOffsetY',
    'chapterBottomRightOffsetX',
    'chapterBottomRightOffsetY',
    'chapterBottomLeftOffsetX',
    'chapterBottomLeftOffsetY',
    'chapterTopLeftOffsetX',
    'chapterTopLeftOffsetY',
  ] },
  { title: '章节微调', fields: [
    'alphabetOffsetX',
    'alphabetOffsetY',
    'noclippingOffsetX',
    'noclippingOffsetY',
    'dimensionOffsetX',
    'dimensionOffsetY',
    'paradoxOffsetX',
    'paradoxOffsetY',
    'noiseOffsetX',
    'noiseOffsetY',
  ] },
  { title: '文字大小', fields: [
    'uiTextSize',
    'introTitleTextSize',
    'modeHintTextSize',
    'introInfoTextSize',
    'introPrefaceTextSize',
    'introCopyrightTextSize',
    'introTitleDetailTextSize',
    'chapterManifestoTextSize',
    'topHudTextSize',
  ] },
  { title: '文字位置', fields: [
    'introTitleOffsetX',
    'introTitleOffsetY',
    'modeHintOffsetX',
    'modeHintOffsetY',
    'introInfoOffsetX',
    'introInfoOffsetY',
    'introPrefaceOffsetX',
    'introPrefaceOffsetY',
    'introCopyrightOffsetX',
    'introCopyrightOffsetY',
    'introTitleDetailOffsetX',
    'introTitleDetailOffsetY',
    'introTitleDetailChineseOffsetX',
    'introTitleDetailChineseOffsetY',
    'introTitleDetailEnglishOffsetX',
    'introTitleDetailEnglishOffsetY',
    'chapterManifestoOffsetX',
    'chapterManifestoOffsetY',
    'topHudOffsetX',
    'topHudOffsetY',
  ] },
  { title: '章节宣言', fields: [
    'alphabetManifestoOffsetX',
    'alphabetManifestoOffsetY',
    'noclippingManifestoOffsetX',
    'noclippingManifestoOffsetY',
    'dimensionManifestoOffsetX',
    'dimensionManifestoOffsetY',
    'paradoxManifestoOffsetX',
    'paradoxManifestoOffsetY',
    'noiseManifestoOffsetX',
    'noiseManifestoOffsetY',
  ] },
  { title: '文本内容', fields: [
    'prefaceZh',
    'prefaceEn',
    'alphabetManifestoZh',
    'alphabetManifestoEn',
    'noclippingManifestoZh',
    'noclippingManifestoEn',
    'dimensionManifestoZh',
    'dimensionManifestoEn',
    'paradoxManifestoZh',
    'paradoxManifestoEn',
    'noiseManifestoZh',
    'noiseManifestoEn',
  ] },
  { title: '镜子', fields: ['showMirror', 'mirrorScale', 'mirrorOpacityMin', 'mirrorOpacityMax'] },
  { title: '闪烁', fields: ['flickerEnabled', 'flickerSpeed', 'flickerNoiseAmount', 'flickerRandomness'] },
  { title: '鼠标位移', fields: ['parallaxEnabled', 'parallaxRange', 'parallaxEase'] },
  { title: '惯性', fields: ['inertiaEnabled', 'inertiaFriction', 'inertiaVelocityScale'] },
  { title: '缩放', fields: ['minZoom', 'maxZoom', 'zoomSensitivity'] },
  { title: 'D12导航', fields: ['d12Scale', 'd12LineWidth'] },
  { title: '光标', fields: [
    'hideSystemCursor',
    'cursorMinSize',
    'cursorMaxSize',
    'cursorSizeScale',
    'cursorEase',
  ] },
  { title: 'Noclipping', fields: [
    'noclipNormalFallSpeed',
    'noclipHoverFallSpeed',
    'noclipHoverEaseTime',
    'noclipRecoveryTime',
    'noclipAdTriggerDistance',
    'noclipAdDuration',
    'noclipAdEnterTime',
    'noclipAdExitTime',
    'noclipAdsEnabled',
    'noclipMusicEnabled',
    'noclipNormalVolume',
    'noclipHoverVolume',
    'noclipAdVolume',
    'noclipVolumeFadeTime',
    'noclipImageDensity',
    'noclipImageMinScale',
    'noclipImageMaxScale',
    'noclipImageSpeedVariance',
  ] },
  { title: '暂停', fields: ['pauseBlur'] },
];

const FIELD_LABELS: Record<Field, string> = {
  nodeSpacingX: '横距',
  nodeSpacingY: '纵距',
  pentagonRadius: '五边半径',
  chapterEdgeOffset: '边距偏移',
  pentagonRotation: '五边旋转',
  showPentagonGuide: '五边参考',
  globalScale: '全局比例',
  maxVisibleRadius: '可见半径',
  nodeDotSizeMM: '黑点大小',
  nodeDotOpacity: '黑点透明',
  chapterScale: '章节比例',
  safetyPadding: '安全距离',
  titleOpacity: '章节透明',
  textDifferenceEnabled: '差值反色',
  prefaceTextWidthMM: '前言栏宽',
  alphabetManifestoWidthMM: 'Alphabet栏宽',
  noclippingManifestoWidthMM: 'Noclip栏宽',
  dimensionManifestoWidthMM: 'Dimension栏宽',
  paradoxManifestoWidthMM: 'Paradox栏宽',
  noiseManifestoWidthMM: 'Noise栏宽',
  prefaceZh: '前言中文',
  prefaceEn: '前言英文',
  alphabetManifestoZh: 'Alphabet中文',
  alphabetManifestoEn: 'Alphabet英文',
  noclippingManifestoZh: 'Noclip中文',
  noclippingManifestoEn: 'Noclip英文',
  dimensionManifestoZh: 'Dimension中文',
  dimensionManifestoEn: 'Dimension英文',
  paradoxManifestoZh: 'Paradox中文',
  paradoxManifestoEn: 'Paradox英文',
  noiseManifestoZh: 'Noise中文',
  noiseManifestoEn: 'Noise英文',
  uiTextSize: '通用字号',
  introTitleTextSize: '标题字号',
  introTitleOffsetX: '标题横移',
  introTitleOffsetY: '标题纵移',
  modeHintTextSize: '提示字号',
  modeHintOffsetX: '提示横移',
  modeHintOffsetY: '提示纵移',
  introInfoTextSize: 'info字号',
  introInfoOffsetX: 'info横移',
  introInfoOffsetY: 'info纵移',
  introPrefaceTextSize: '前言字号',
  introPrefaceOffsetX: '前言横移',
  introPrefaceOffsetY: '前言纵移',
  introCopyrightTextSize: '版权字号',
  introCopyrightOffsetX: '版权横移',
  introCopyrightOffsetY: '版权纵移',
  introTitleDetailTextSize: '引文字号',
  introTitleDetailOffsetX: '引文横移',
  introTitleDetailOffsetY: '引文纵移',
  introTitleDetailChineseOffsetX: '引文中横',
  introTitleDetailChineseOffsetY: '引文中纵',
  introTitleDetailEnglishOffsetX: '引文英横',
  introTitleDetailEnglishOffsetY: '引文英纵',
  chapterManifestoTextSize: '宣言字号',
  chapterManifestoOffsetX: '宣言横移',
  chapterManifestoOffsetY: '宣言纵移',
  alphabetManifestoOffsetX: 'Alphabet宣言横',
  alphabetManifestoOffsetY: 'Alphabet宣言纵',
  noclippingManifestoOffsetX: 'Noclip宣言横',
  noclippingManifestoOffsetY: 'Noclip宣言纵',
  dimensionManifestoOffsetX: 'Dimension宣言横',
  dimensionManifestoOffsetY: 'Dimension宣言纵',
  paradoxManifestoOffsetX: 'Paradox宣言横',
  paradoxManifestoOffsetY: 'Paradox宣言纵',
  noiseManifestoOffsetX: 'Noise宣言横',
  noiseManifestoOffsetY: 'Noise宣言纵',
  topHudTextSize: '状态字号',
  topHudOffsetX: '状态横移',
  topHudOffsetY: '状态纵移',
  chapterUpOffsetX: '上横移',
  chapterUpOffsetY: '上纵移',
  chapterTopRightOffsetX: '右上横移',
  chapterTopRightOffsetY: '右上纵移',
  chapterBottomRightOffsetX: '右下横移',
  chapterBottomRightOffsetY: '右下纵移',
  chapterBottomLeftOffsetX: '左下横移',
  chapterBottomLeftOffsetY: '左下纵移',
  chapterTopLeftOffsetX: '左上横移',
  chapterTopLeftOffsetY: '左上纵移',
  alphabetOffsetX: 'Alphabet横移',
  alphabetOffsetY: 'Alphabet纵移',
  noclippingOffsetX: 'Noclipping横移',
  noclippingOffsetY: 'Noclipping纵移',
  dimensionOffsetX: 'Dimension横移',
  dimensionOffsetY: 'Dimension纵移',
  paradoxOffsetX: 'Paradox横移',
  paradoxOffsetY: 'Paradox纵移',
  noiseOffsetX: 'Noise横移',
  noiseOffsetY: 'Noise纵移',
  showMirror: '显示镜子',
  mirrorScale: '镜子比例',
  mirrorOpacityMin: '最低透明',
  mirrorOpacityMax: '最高透明',
  flickerEnabled: '启用闪烁',
  flickerSpeed: '闪烁速度',
  flickerNoiseAmount: '噪声强度',
  flickerRandomness: '随机幅度',
  parallaxEnabled: '启用位移',
  parallaxRange: '位移幅度',
  parallaxEase: '位移缓动',
  inertiaEnabled: '启用惯性',
  inertiaFriction: '惯性摩擦',
  inertiaVelocityScale: '惯性速度',
  minZoom: '最小缩放',
  maxZoom: '最大缩放',
  zoomSensitivity: '缩放灵敏',
  pauseBlur: '暂停模糊',
  d12Scale: 'D12大小',
  d12LineWidth: 'D12线宽',
  hideSystemCursor: '隐藏系统',
  cursorMinSize: '最小尺寸',
  cursorMaxSize: '最大尺寸',
  cursorSizeScale: '尺寸比例',
  cursorEase: '光标缓动',
  noclipNormalFallSpeed: '正常下坠速度',
  noclipHoverFallSpeed: '滞空下坠速度',
  noclipHoverEaseTime: '滞空缓动时间',
  noclipRecoveryTime: '恢复时间',
  noclipAdTriggerDistance: '广告触发距离',
  noclipAdDuration: '广告播放时长',
  noclipAdEnterTime: '广告滑入时间',
  noclipAdExitTime: '广告滑出时间',
  noclipAdsEnabled: '启用广告',
  noclipMusicEnabled: '启用背景音乐',
  noclipNormalVolume: '正常音量',
  noclipHoverVolume: '滞空音量',
  noclipAdVolume: '广告音量',
  noclipVolumeFadeTime: '音量渐变时间',
  noclipImageDensity: '图像密度',
  noclipImageMinScale: '图像最小缩放',
  noclipImageMaxScale: '图像最大缩放',
  noclipImageSpeedVariance: '图像速度差异',
};

export default function InfiniteNodeMapDevPanel({
  settings,
  showDots,
  showChapters,
  onChange,
  onShowDotsChange,
  onShowChaptersChange,
  onResetExploration,
  onReset,
  onOpenTypography,
  onPanelPointerEnter,
  onPanelPointerLeave,
}: {
  settings: PrototypeSettings;
  showDots: boolean;
  showChapters: boolean;
  onChange: (patch: Partial<PrototypeSettings>) => void;
  onShowDotsChange: (value: boolean) => void;
  onShowChaptersChange: (value: boolean) => void;
  onResetExploration: () => void;
  onReset: () => void;
  onOpenTypography?: () => void;
  onPanelPointerEnter?: () => void;
  onPanelPointerLeave?: () => void;
}) {
  const [panelPosition, setPanelPosition] = useState({ x: 18, y: 18 });
  const dragRef = useRef<PanelDrag | null>(null);

  const stopDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <aside
      className={styles.devPanel}
      data-dev-panel="true"
      style={{
        transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)`,
      }}
      onPointerEnter={onPanelPointerEnter}
      onPointerLeave={onPanelPointerLeave}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        className={styles.devPanelHeader}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            panelX: panelPosition.x,
            panelY: panelPosition.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;

          const nextX = drag.panelX + event.clientX - drag.startX;
          const nextY = drag.panelY + event.clientY - drag.startY;
          setPanelPosition({
            x: Math.max(0, Math.min(window.innerWidth - 80, nextX)),
            y: Math.max(0, Math.min(window.innerHeight - 40, nextY)),
          });
        }}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <span>开发者面板</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {onOpenTypography && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onOpenTypography}
            >
              排版
            </button>
          )}
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onReset}
          >
            恢复默认
          </button>
        </span>
      </div>

      <details className={styles.devGroup} open>
        <summary className={styles.devSummary}>显示</summary>
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={showDots}
            onChange={(event) => onShowDotsChange(event.currentTarget.checked)}
          />
          <span>显示黑点</span>
        </label>
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={settings.showMirror}
            onChange={(event) => onChange({ showMirror: event.currentTarget.checked })}
          />
          <span>显示镜子</span>
        </label>
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={showChapters}
            onChange={(event) => onShowChaptersChange(event.currentTarget.checked)}
          />
          <span>显示章节</span>
        </label>
        <button type="button" className={styles.devActionButton} onClick={onResetExploration}>
          重置探索
        </button>
      </details>

      {GROUPS.map((group) => (
        <details key={group.title} className={styles.devGroup} open={group.open}>
          <summary className={styles.devSummary}>{group.title}</summary>
          {group.fields.map((field) => (
            <SettingControl
              key={field}
              field={field}
              value={settings[field]}
              onChange={onChange}
            />
          ))}
        </details>
      ))}
    </aside>
  );
}

function SettingControl({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: PrototypeSettings[Field];
  onChange: (patch: Partial<PrototypeSettings>) => void;
}) {
  const defaultValue = DEFAULT_PROTOTYPE_SETTINGS[field];

  if (typeof defaultValue === 'boolean') {
    return (
      <label className={styles.devToggle}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange({ [field]: event.currentTarget.checked })}
        />
        <span>{FIELD_LABELS[field]}</span>
      </label>
    );
  }

  if (typeof defaultValue === 'string') {
    return (
      <label className={styles.devText}>
        <span>{FIELD_LABELS[field]}</span>
        <textarea
          value={typeof value === 'string' ? value : defaultValue}
          onChange={(event) => onChange({ [field]: event.currentTarget.value })}
        />
      </label>
    );
  }

  const range = SETTING_RANGES[field];
  if (!range) return null;
  const numericValue = typeof value === 'number' ? value : Number(defaultValue);

  return (
    <label className={styles.devRange}>
      <span>{FIELD_LABELS[field]}</span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={numericValue}
        onChange={(event) => onChange({ [field]: Number(event.currentTarget.value) })}
      />
      <input
        type="number"
        min={range.min}
        max={range.max}
        step={range.step}
        value={numericValue}
        onChange={(event) => onChange({ [field]: Number(event.currentTarget.value) })}
      />
    </label>
  );
}
