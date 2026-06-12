'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, PointerEvent } from 'react';
import styles from './InfiniteNodeMapPrototype.module.css';
import {
  DEFAULT_TYPOGRAPHY_PRESET,
  TYPOGRAPHY_COLOR_OPTIONS,
  TYPOGRAPHY_FONT_OPTIONS,
  TYPOGRAPHY_SCOPE_IDS,
  TYPOGRAPHY_SCOPE_GROUPS,
  TYPOGRAPHY_SCOPE_LABELS,
  updateTypographyScope,
  type TypographyPreset,
  type TypographyScopeId,
  type TypographyScopeSettings,
  type TypographyTextAlign,
  type TypographyVerticalAlignMode,
} from './typographyEngineState';

type PanelDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  panelX: number;
  panelY: number;
};

const DEFAULT_PANEL_POSITION = { x: 394, y: 18 };
const DEFAULT_STROKE_COLOR = '#ffffff';

export default function TypographyEnginePanel({
  preset,
  dirty,
  status,
  onPresetChange,
  onSave,
  onReset,
  onExport,
  onImportText,
  onCopy,
  onClose,
  onPanelPointerEnter,
  onPanelPointerLeave,
}: {
  preset: TypographyPreset;
  dirty: boolean;
  status: string;
  onPresetChange: (next: TypographyPreset) => void;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onImportText: (text: string) => void;
  onCopy: () => void;
  onClose: () => void;
  onPanelPointerEnter?: () => void;
  onPanelPointerLeave?: () => void;
}) {
  const [panelPosition, setPanelPosition] = useState(DEFAULT_PANEL_POSITION);
  const dragRef = useRef<PanelDrag | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeScope = preset.scopes[preset.activeScopeId];

  const stopDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
  };

  const setActiveScopeId = (activeScopeId: TypographyScopeId) => {
    onPresetChange({ ...preset, activeScopeId, updatedAt: new Date().toISOString() });
  };

  const patchActiveScope = (patch: Partial<TypographyScopeSettings>) => {
    onPresetChange(updateTypographyScope(preset, preset.activeScopeId, patch));
  };

  const setActiveScopeInverseBlend = (inverseBlend: boolean) => {
    patchActiveScope({
      inverseBlend,
      strokeWidthPx: inverseBlend ? 0 : activeScope.strokeWidthPx,
      strokeColor: inverseBlend ? 'transparent' : activeScope.strokeColor,
    });
  };

  const patchPreset = (patch: Partial<TypographyPreset>) => {
    onPresetChange({
      ...preset,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const resetActiveScope = () => {
    onPresetChange(updateTypographyScope(
      preset,
      preset.activeScopeId,
      DEFAULT_TYPOGRAPHY_PRESET.scopes[preset.activeScopeId],
    ));
  };

  const applyActiveToAll = () => {
    if (!window.confirm('确认把当前范围的排版参数应用到全部 Intro 范围？')) return;
    onPresetChange({
      ...preset,
      updatedAt: new Date().toISOString(),
      scopes: Object.fromEntries(TYPOGRAPHY_SCOPE_IDS.map((scopeId) => [
        scopeId,
        { ...activeScope },
      ])) as TypographyPreset['scopes'],
    });
  };

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    file.text().then(onImportText).catch(() => onImportText('{'));
  };

  return (
    <aside
      className={styles.devPanel}
      data-dev-panel="true"
      style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }}
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
        <span>排版引擎</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onSave}>保存</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>关闭</button>
        </span>
      </div>

      <div className={`${styles.typoStatus}${dirty ? ` ${styles.typoStatusDirty}` : ''}`}>
        <b>{dirty ? '未保存' : '已保存'}</b>
        <span>{status}</span>
        <span>当前作用范围：{TYPOGRAPHY_SCOPE_LABELS[preset.activeScopeId]}</span>
        <span>快捷键：Command + Shift + T 打开 / 关闭</span>
      </div>

      <details className={styles.devGroup} open>
        <summary className={styles.devSummary}>00 选择要调整的文字</summary>
        {TYPOGRAPHY_SCOPE_GROUPS.map((group) => (
          <div key={group.label} className={styles.typoScopeGroup}>
            <div className={styles.typoScopeGroupTitle}>{group.label}</div>
            <div className={styles.typoScopeGrid}>
              {group.ids.map((scopeId) => (
                <button
                  key={scopeId}
                  type="button"
                  className={`${styles.typoScopeChip}${preset.activeScopeId === scopeId ? ` ${styles.typoScopeChipActive}` : ''}`}
                  onClick={() => setActiveScopeId(scopeId)}
                >
                  {TYPOGRAPHY_SCOPE_LABELS[scopeId]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <SelectRow
          label="范围"
          value={preset.activeScopeId}
          options={TYPOGRAPHY_SCOPE_IDS.map((scopeId) => ({
            value: scopeId,
            label: `${scopeId} · ${TYPOGRAPHY_SCOPE_LABELS[scopeId]}`,
          }))}
          onChange={(value) => setActiveScopeId(value as TypographyScopeId)}
        />
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={activeScope.enabled}
            onChange={(event) => patchActiveScope({ enabled: event.currentTarget.checked })}
          />
          <span>启用当前范围</span>
        </label>
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={preset.globalEnabled}
            onChange={(event) => patchPreset({ globalEnabled: event.currentTarget.checked })}
          />
          <span>启用全局覆盖</span>
        </label>
        <div className={styles.typoButtonRow}>
          <button type="button" className={styles.devActionButton} onClick={resetActiveScope}>
            恢复当前范围
          </button>
          <button type="button" className={styles.devActionButton} onClick={applyActiveToAll}>
            应用到全部范围
          </button>
        </div>
      </details>

      <details className={styles.devGroup} open>
        <summary className={styles.devSummary}>01 基础排版</summary>
        <div className={styles.typoColorGrid}>
          <span>颜色</span>
          <div className={styles.typoRadioGroup}>
            {TYPOGRAPHY_COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`${styles.typoColorButton}${activeScope.textColor === color.value ? ` ${styles.typoColorButtonActive}` : ''}`}
                style={{ '--typo-color-swatch': color.value } as CSSProperties}
                onClick={() => patchActiveScope({ inverseBlend: false, textColor: color.value })}
              >
                {color.label}
              </button>
            ))}
          </div>
        </div>
        <SelectRow
          label="字体"
          value={activeScope.fontFamily ?? 'inherit'}
          options={TYPOGRAPHY_FONT_OPTIONS.map((font) => ({ value: font.value, label: font.label }))}
          onChange={(value) => patchActiveScope({ fontFamily: value })}
        />
        <RangeRow label="字号" unit="px" min={4} max={400} step={1}
          value={activeScope.fontSizePx ?? 16} onChange={(value) => patchActiveScope({ fontSizePx: value })} />
        <RangeRow label="行距" min={0.5} max={4} step={0.01}
          value={activeScope.lineHeight ?? 1.35} onChange={(value) => patchActiveScope({ lineHeight: value })} />
        <SelectRow
          label="字重"
          value={String(activeScope.fontWeight ?? 500)}
          options={[
            { value: '300', label: 'Light 300' },
            { value: '400', label: 'Regular 400' },
            { value: '500', label: 'Medium 500' },
            { value: '700', label: 'Bold 700' },
            { value: '900', label: 'Black 900' },
          ]}
          onChange={(value) => patchActiveScope({ fontWeight: Number(value) })}
        />
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={activeScope.fontStyle === 'italic'}
            onChange={(event) => patchActiveScope({ fontStyle: event.currentTarget.checked ? 'italic' : 'normal' })}
          />
          <span>斜体</span>
        </label>
        <RangeRow label="字距" unit="em" min={-0.3} max={1} step={0.001}
          value={activeScope.letterSpacingEm ?? 0} onChange={(value) => patchActiveScope({ letterSpacingEm: value })} />
        <RangeRow label="词距" unit="em" min={-0.5} max={2} step={0.01}
          value={activeScope.wordSpacingEm ?? 0} onChange={(value) => patchActiveScope({ wordSpacingEm: value })} />
        <RangeRow label="白描边" unit="px" min={0} max={24} step={1}
          value={activeScope.strokeWidthPx ?? 0} onChange={(value) => patchActiveScope({
            inverseBlend: value > 0 ? false : activeScope.inverseBlend,
            strokeWidthPx: value,
            strokeColor: value > 0 ? DEFAULT_STROKE_COLOR : 'transparent',
          })} />
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={Boolean(activeScope.inverseBlend)}
            onChange={(event) => setActiveScopeInverseBlend(event.currentTarget.checked)}
          />
          <span>局部反差反色</span>
        </label>
        <div
          aria-label="局部反差反色测试预览"
          style={{
            position: 'relative',
            height: 44,
            overflow: 'hidden',
            background: 'linear-gradient(90deg, #ffffff 0 50%, #000000 50% 100%)',
            border: '1px solid rgba(0,0,0,0.35)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              color: activeScope.inverseBlend ? '#ffffff' : '#000000',
              WebkitTextFillColor: activeScope.inverseBlend ? '#ffffff' : '#000000',
              fontFamily: activeScope.fontFamily ?? 'inherit',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 0,
              lineHeight: 1,
              mixBlendMode: activeScope.inverseBlend ? 'difference' : 'normal',
              textShadow: 'none',
              WebkitTextStroke: '0 transparent',
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap',
            }}
          >
            反色测试 INVERSE TEST
          </span>
        </div>
      </details>

      <details className={styles.devGroup}>
        <summary className={styles.devSummary}>02 对齐</summary>
        <RadioGroup
          label="对齐"
          value={activeScope.textAlign ?? 'left'}
          options={[
            { value: 'left', label: '左对齐' },
            { value: 'center', label: '居中' },
            { value: 'right', label: '右对齐' },
            { value: 'justify', label: '两端' },
          ]}
          onChange={(value) => patchActiveScope({ textAlign: value as TypographyTextAlign })}
        />
        <RangeRow label="上边距" unit="em" min={-5} max={5} step={0.05}
          value={activeScope.marginTopEm ?? 0} onChange={(value) => patchActiveScope({ marginTopEm: value })} />
        <RangeRow label="下边距" unit="em" min={-5} max={5} step={0.05}
          value={activeScope.marginBottomEm ?? 0} onChange={(value) => patchActiveScope({ marginBottomEm: value })} />
        <RangeRow label="首行缩进" unit="em" min={-5} max={8} step={0.05}
          value={activeScope.textIndentEm ?? 0} onChange={(value) => patchActiveScope({ textIndentEm: value })} />
      </details>

      <details className={styles.devGroup}>
        <summary className={styles.devSummary}>03 中文排版</summary>
        <RangeRow label="中英间距" unit="em" min={-0.5} max={1} step={0.01}
          value={activeScope.zhEnSpacingEm ?? 0} onChange={(value) => patchActiveScope({ zhEnSpacingEm: value })} />
        <label className={styles.devToggle}>
          <input
            type="checkbox"
            checked={Boolean(activeScope.hangingPunctuation)}
            onChange={(event) => patchActiveScope({ hangingPunctuation: event.currentTarget.checked })}
          />
          <span>标点悬挂</span>
        </label>
        <RangeRow label="引号悬挂" unit="em" min={-1} max={1} step={0.01}
          value={activeScope.punctuationHangingEm ?? 0} onChange={(value) => patchActiveScope({ punctuationHangingEm: value })} />
        <RangeRow label="基线偏移" unit="em" min={-2} max={2} step={0.01}
          value={activeScope.baselineShiftEm ?? 0} onChange={(value) => patchActiveScope({ baselineShiftEm: value })} />
        <SelectRow
          label="垂直模式"
          value={activeScope.verticalAlignMode ?? 'normal'}
          options={[
            { value: 'normal', label: '正常' },
            { value: 'baseline', label: '基线' },
            { value: 'optical', label: '视觉校正' },
          ]}
          onChange={(value) => patchActiveScope({ verticalAlignMode: value as TypographyVerticalAlignMode })}
        />
        <label className={styles.devText}>
          <span>OpenType 特性</span>
          <input
            className={styles.typoTextInput}
            value={activeScope.fontFeatureSettings ?? ''}
            onChange={(event) => patchActiveScope({ fontFeatureSettings: event.currentTarget.value })}
            placeholder='"palt" 1, "kern" 1'
          />
        </label>
      </details>

      <details className={styles.devGroup}>
        <summary className={styles.devSummary}>04 形变</summary>
        <RangeRow label="scaleX" min={0.2} max={3} step={0.01}
          value={activeScope.scaleX ?? 1} onChange={(value) => patchActiveScope({ scaleX: value })} />
        <RangeRow label="scaleY" min={0.2} max={3} step={0.01}
          value={activeScope.scaleY ?? 1} onChange={(value) => patchActiveScope({ scaleY: value })} />
        <RangeRow label="rotate" unit="deg" min={-180} max={180} step={1}
          value={activeScope.rotateDeg ?? 0} onChange={(value) => patchActiveScope({ rotateDeg: value })} />
        <RangeRow label="opacity" min={0} max={1} step={0.01}
          value={activeScope.opacity ?? 1} onChange={(value) => patchActiveScope({ opacity: value })} />
      </details>

      <details className={styles.devGroup} open>
        <summary className={styles.devSummary}>05 保存 / JSON</summary>
        <div className={styles.typoButtonRow}>
          <button type="button" className={styles.devActionButton} onClick={onSave}>保存</button>
          <button type="button" className={styles.devActionButton} onClick={onReset}>恢复默认</button>
          <button type="button" className={styles.devActionButton} onClick={onExport}>导出配置</button>
          <button type="button" className={styles.devActionButton} onClick={() => fileInputRef.current?.click()}>导入配置</button>
          <button type="button" className={styles.devActionButton} onClick={onCopy}>复制配置</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={importFile}
        />
        <p className={styles.typoNote}>导入后会立即应用，但仍需点击“保存”写入 localStorage。</p>
      </details>
    </aside>
  );
}

function RangeRow({
  label, unit, min, max, step, value, onChange,
}: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.devRange}>
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function SelectRow({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.devRange} style={{ gridTemplateColumns: '76px 1fr' }}>
      <span>{label}</span>
      <select
        className={styles.typoSelect}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function RadioGroup({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.devRange} style={{ gridTemplateColumns: '76px 1fr' }}>
      <span>{label}</span>
      <div className={styles.typoRadioGroup}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.typoRadioBtn}${value === option.value ? ` ${styles.typoRadioBtnActive}` : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
