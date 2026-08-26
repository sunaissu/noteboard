/**
 * PropertiesPanel — public entry point.
 *
 * This file is intentionally thin. Each section lives in its own file:
 *   primitives.tsx       — ColorRow, ChoiceRow, SliderRow, ToggleRow, constants
 *   PanelHeader.tsx      — lock, z-order, group/ungroup buttons
 *   AppearanceSection.tsx — stroke, fill, opacity, blend mode, corner radius
 *   ShadowSection.tsx    — drop shadow toggle + controls
 *   LineSection.tsx      — routing, arrowheads, midpoint label
 *   TextSection.tsx      — font size/family, alignment, line height, highlight
 *   PenSection.tsx       — highlighter mode, smoothing tension
 */
import React, { useState } from 'react';
import {
    PaletteIcon, PaintBucketIcon, LineSegmentIcon, CircleHalfIcon,
    TextAaIcon, TextAlignLeftIcon, TextAlignCenterIcon, TextAlignRightIcon,
} from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement } from '../../elements/types';
import { isShapeElement, isLinearElement, hasShapeText } from '../../elements/types';
import type { PropertiesPosition } from '../../types';
import { COLOR_SWATCHES_LIGHT, COLOR_SWATCHES_DARK, iconBtnStyle } from './primitives';
import { CaretDownIcon } from '@phosphor-icons/react';

import { PanelHeader } from './PanelHeader';
import { AppearanceSection } from './AppearanceSection';
import { ShadowSection } from './ShadowSection';
import { LineSection } from './LineSection';
import { TextSection } from './TextSection';
import { PenSection } from './PenSection';
import { StarSection } from './StarSection';

export interface PropertiesPanelProps {
    selectedElements: NoteboardElement[];
    onUpdateElements: (updates: Partial<NoteboardElement>) => void;
    onBringForward?: () => void;
    onSendBackward?: () => void;
    onBringToFront?: () => void;
    onSendToBack?: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    onToggleLock?: () => void;
    onAlignLeft?: () => void;
    onAlignCenterH?: () => void;
    onAlignRight?: () => void;
    onAlignTop?: () => void;
    onAlignCenterV?: () => void;
    onAlignBottom?: () => void;
    onDistributeH?: () => void;
    onDistributeV?: () => void;
    isDark: boolean;
    position?: PropertiesPosition;
}

function getPanelPosition(pos: PropertiesPosition): React.CSSProperties {
    switch (pos) {
        case 'top':    return { top: 12, left: '50%', transform: 'translateX(-50%)' };
        case 'bottom': return { bottom: 12, left: '50%', transform: 'translateX(-50%)' };
        case 'left':   return { top: 12, left: 12 };
        case 'right':  return { top: 12, right: 12 };
    }
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedElements,
    onUpdateElements,
    onBringForward, onSendBackward, onBringToFront, onSendToBack,
    onGroup, onUngroup, onToggleLock,
    onAlignLeft, onAlignCenterH, onAlignRight,
    onAlignTop, onAlignCenterV, onAlignBottom,
    onDistributeH, onDistributeV,
    isDark,
    position = 'left',
}) => {
    const theme = useNoteboardTheme();
    const hasSelection = selectedElements.length > 0;
    const isHorizontal = position === 'top' || position === 'bottom';

    const hasShapes = selectedElements.some((el) => isShapeElement(el));
    const hasLinear = selectedElements.some((el) => isLinearElement(el));
    const hasText = selectedElements.some((el) => el.type === 'text');
    const hasShapesWithText = selectedElements.some((el) => hasShapeText(el));
    const hasArrows = selectedElements.some((el) => el.type === 'arrow');
    const hasLines = selectedElements.some((el) => el.type === 'line');
    const hasPen = selectedElements.some((el) => el.type === 'pen');
    const hasStars = selectedElements.some((el) => el.type === 'star');
    const isMultiSelect = selectedElements.length > 1;
    const isLocked = selectedElements.some((el) => el.locked);

    const showFill = hasShapes;
    const showStrokeWidth = hasShapes || hasLinear;
    // Show text section only for standalone text elements or shapes that actually
    // contain text (i.e. the user has typed something into the shape).
    // Do NOT show it for every shape element — that was flooding the panel.
    const showTextProps = hasText || hasShapesWithText;
    const showLineProps = hasLines || hasArrows;

    const first = selectedElements[0];
    const strokeColor = first?.strokeColor ?? theme.strokeColor;
    const backgroundColor = first?.backgroundColor ?? 'transparent';
    const strokeWidth = first?.strokeWidth ?? 2;
    const opacity = first?.opacity ?? 100;
    const textEl = selectedElements.find((el) => el.type === 'text' || hasShapeText(el));
    const textAlign = textEl ? ((textEl as any).textAlign ?? 'left') : 'left';

    const swatches = isDark ? COLOR_SWATCHES_DARK : COLOR_SWATCHES_LIGHT;
    const posStyle = getPanelPosition(position);
    const baseTransform = posStyle.transform ?? '';
    // For side panels (left/right) there is no base transform — scale only
    const combinedTransform = baseTransform
        ? `${baseTransform} ${hasSelection ? '' : 'scale(0.97)'}`
        : (hasSelection ? 'scale(1)' : 'scale(0.97)');

    const ibs = (active = false) => iconBtnStyle(theme, active);

    // ── Whole-panel collapse state ──────────────────────────────
    const [panelCollapsed, setPanelCollapsed] = useState(false);

    // ── Compact horizontal layout (top / bottom) ──────────────────────────────
    if (isHorizontal) {
        const CompactColorGrid = ({ label, icon, value, colors, onChange }: {
            label: string; icon: React.ReactNode; value: string;
            colors: string[]; onChange: (c: string) => void;
        }) => (
            <div style={{ padding: '0 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    {icon}
                    <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 16px)', gap: 3 }}>
                    {colors.map((c) => (
                        <button key={c} onClick={() => onChange(c)} title={c} style={{
                            width: 16, height: 16, borderRadius: 3, padding: 0, cursor: 'pointer',
                            border: value === c ? `2px solid ${theme.buttonActiveColor}` : `1px solid ${theme.panelMutedColor}33`,
                            background: c === 'transparent'
                                ? `repeating-conic-gradient(${theme.panelMutedColor}33 0% 25%, transparent 0% 50%) 50% / 6px 6px`
                                : c,
                        }} />
                    ))}
                    <label title="Custom color" style={{ width: 16, height: 16, borderRadius: 3, border: `1px dashed ${theme.panelMutedColor}88`, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                        <input type="color" value={value === 'transparent' ? '#ffffff' : value}
                            onChange={(e) => onChange(e.target.value)}
                            style={{ position: 'absolute', top: -4, left: -4, width: 24, height: 24, border: 'none', cursor: 'pointer', opacity: 0 }} />
                        <span style={{ display: 'block', width: '100%', height: '100%', background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', borderRadius: 2 }} />
                    </label>
                </div>
            </div>
        );

        return (
            <div onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute', ...posStyle, transform: combinedTransform,
                    zIndex: 1000, background: theme.panelBg, borderRadius: 10, boxShadow: theme.toolbarShadow,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    pointerEvents: hasSelection ? 'auto' : 'none',
                    opacity: hasSelection ? 1 : 0,
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                    maxWidth: '90vw', maxHeight: '60vh', overflowX: 'auto', overflowY: 'auto',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'stretch', padding: '8px 4px', flexWrap: 'wrap', gap: '6px 0' }}>
                    <CompactColorGrid label="Stroke" icon={<PaletteIcon size={12} weight="bold" style={{ color: theme.panelMutedColor }} />}
                        value={strokeColor} colors={swatches} onChange={(c) => onUpdateElements({ strokeColor: c })} />
                    {showFill && (
                        <CompactColorGrid label="Fill" icon={<PaintBucketIcon size={12} weight="bold" style={{ color: theme.panelMutedColor }} />}
                            value={backgroundColor} colors={['transparent', ...swatches]} onChange={(c) => onUpdateElements({ backgroundColor: c })} />
                    )}
                    {showStrokeWidth && (
                        <div style={{ padding: '0 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <LineSegmentIcon size={12} weight="bold" style={{ color: theme.panelMutedColor }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Width</span>
                            </div>
                            <div style={{ display: 'flex', gap: 2 }}>
                                {[{ value: '1', label: 'S' }, { value: '2', label: 'M' }, { value: '4', label: 'L' }, { value: '6', label: 'XL' }].map((opt) => (
                                    <button key={opt.value} onClick={() => onUpdateElements({ strokeWidth: Number(opt.value) })}
                                        style={{ padding: '3px 6px', fontSize: 10, fontWeight: 500, borderRadius: 4, border: 'none', cursor: 'pointer',
                                            background: String(strokeWidth) === opt.value ? theme.buttonActiveBg : 'transparent',
                                            color: String(strokeWidth) === opt.value ? theme.buttonActiveColor : theme.panelMutedColor,
                                            transition: 'background 0.15s, color 0.15s' }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div style={{ padding: '0 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <CircleHalfIcon size={12} weight="bold" style={{ color: theme.panelMutedColor }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opacity</span>
                            <span style={{ fontSize: 10, color: theme.panelMutedColor, marginLeft: 'auto' }}>{opacity}%</span>
                        </div>
                        <input type="range" min={10} max={100} step={5} value={opacity}
                            onChange={(e) => onUpdateElements({ opacity: Number(e.target.value) })}
                            style={{ width: 80, accentColor: theme.buttonActiveColor, cursor: 'pointer' }} />
                    </div>
                    {showTextProps && (
                        <div style={{ padding: '0 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <TextAaIcon size={12} weight="bold" style={{ color: theme.panelMutedColor }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Align</span>
                            </div>
                            <div style={{ display: 'flex', gap: 2 }}>
                                {[{ value: 'left', icon: TextAlignLeftIcon }, { value: 'center', icon: TextAlignCenterIcon }, { value: 'right', icon: TextAlignRightIcon }].map((opt) => {
                                    const Icon = opt.icon;
                                    return (
                                        <button key={opt.value} onClick={() => onUpdateElements({ textAlign: opt.value } as any)}
                                            style={{ ...ibs(textAlign === opt.value), width: 24, height: 24, borderRadius: 4 }}>
                                            <Icon size={12} weight="bold" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
            style={{
                position: 'absolute', ...posStyle, transform: combinedTransform,
                width: 226, zIndex: 1000, background: theme.panelBg, borderRadius: 12,
                boxShadow: theme.toolbarShadow, fontFamily: "'Inter', system-ui, sans-serif",
                pointerEvents: hasSelection ? 'auto' : 'none',
                opacity: hasSelection ? 1 : 0,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                // Use 100% (canvas container) not 100vh (viewport) so panel never overflows the canvas
                maxHeight: panelCollapsed ? 'none' : 'calc(100% - 24px)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
        >
            {/* Panel title bar with collapse toggle */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px 4px',
                borderBottom: panelCollapsed ? 'none' : theme.panelBorder,
                flexShrink: 0,
            }}>
                <button
                    onClick={() => setPanelCollapsed((v) => !v)}
                    title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        padding: '2px 0', borderRadius: 4,
                    }}
                >
                    <CaretDownIcon
                        size={11}
                        weight="bold"
                        style={{
                            color: theme.panelMutedColor,
                            transform: panelCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.18s ease',
                            flexShrink: 0,
                        }}
                    />
                    <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: theme.panelMutedColor,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        userSelect: 'none',
                    }}>
                        Properties
                        <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>({selectedElements.length})</span>
                    </span>
                </button>
            </div>

            {!panelCollapsed && (
                <>
                    <PanelHeader
                isLocked={isLocked}
                isMultiSelect={isMultiSelect}
                onToggleLock={onToggleLock}
                onBringToFront={onBringToFront}
                onBringForward={onBringForward}
                onSendBackward={onSendBackward}
                onSendToBack={onSendToBack}
                onGroup={onGroup}
                onUngroup={onUngroup}
            />

                    {/* Scrollable body */}
                    <div style={{
                        padding: '12px 14px 14px', overflowY: 'auto', flex: 1,
                        scrollbarWidth: 'thin', scrollbarColor: `${theme.panelMutedColor}44 transparent`,
                    }}>
                        <AppearanceSection
                            selectedElements={selectedElements}
                            isDark={isDark}
                            onUpdate={onUpdateElements}
                            onAlignLeft={onAlignLeft}
                            onAlignCenterH={onAlignCenterH}
                            onAlignRight={onAlignRight}
                            onAlignTop={onAlignTop}
                            onAlignCenterV={onAlignCenterV}
                            onAlignBottom={onAlignBottom}
                            onDistributeH={onDistributeH}
                            onDistributeV={onDistributeV}
                        />
                        <ShadowSection selectedElements={selectedElements} onUpdate={onUpdateElements} />
                        {showLineProps && <LineSection selectedElements={selectedElements} onUpdate={onUpdateElements} />}
                        {showTextProps && <TextSection selectedElements={selectedElements} onUpdate={onUpdateElements} />}
                        {hasPen && <PenSection selectedElements={selectedElements} onUpdate={onUpdateElements} />}
                        {hasStars && <StarSection selectedElements={selectedElements} onUpdate={onUpdateElements} />}
                    </div>
                </>
            )}
        </div>
    );
};
