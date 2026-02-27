import React from 'react';
import { useNoteboardTheme } from '../ThemeContext';
import type { NoteboardTheme } from '../ThemeContext';
import type { ExcalidrawElement } from '../elements/types';
import { isShapeElement, isLinearElement } from '../elements/types';
import { Palette, PaintBucket, LineSegment, CircleHalf, TextAa } from '@phosphor-icons/react';

// ─── Color presets ───────────────────────────────────────────

const COLOR_SWATCHES_LIGHT = [
    '#1e1e1e', '#e03131', '#e8590c', '#fcc419',
    '#40c057', '#228be6', '#7950f2', '#be4bdb',
    '#868e96', '#ffffff',
];

const COLOR_SWATCHES_DARK = [
    '#e0e0e0', '#ff6b6b', '#ff922b', '#ffd43b',
    '#69db7c', '#4dabf7', '#9775fa', '#da77f2',
    '#adb5bd', '#1e1e1e',
];

// ─── Shared sub-components ───────────────────────────────────

function SectionLabel({ children, theme }: { children: React.ReactNode; theme: NoteboardTheme }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 600,
                color: theme.panelMutedColor,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
            }}
        >
            {children}
        </div>
    );
}

function ColorRow({
    label,
    icon,
    value,
    swatches,
    onChange,
    theme,
}: {
    label: string;
    icon: React.ReactNode;
    value: string;
    swatches: string[];
    onChange: (color: string) => void;
    theme: NoteboardTheme;
}) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {icon}
                <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {swatches.map((c) => (
                    <button
                        key={c}
                        onClick={() => onChange(c)}
                        title={c}
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            border: value === c
                                ? `2px solid ${theme.buttonActiveColor}`
                                : `1px solid ${theme.panelMutedColor}44`,
                            background: c === 'transparent'
                                ? `repeating-conic-gradient(${theme.panelMutedColor}33 0% 25%, transparent 0% 50%) 50% / 8px 8px`
                                : c,
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                        }}
                    />
                ))}
                {/* Custom color picker */}
                <label
                    title="Custom color"
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `1px dashed ${theme.panelMutedColor}88`,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        flexShrink: 0,
                    }}
                >
                    <input
                        type="color"
                        value={value === 'transparent' ? '#ffffff' : value}
                        onChange={(e) => onChange(e.target.value)}
                        style={{
                            position: 'absolute',
                            top: -4,
                            left: -4,
                            width: 28,
                            height: 28,
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0,
                        }}
                    />
                    <span
                        style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                            borderRadius: 3,
                        }}
                    />
                </label>
            </div>
        </div>
    );
}

function ChoiceRow<T extends string>({
    label,
    icon,
    options,
    value,
    onChange,
    theme,
}: {
    label: string;
    icon: React.ReactNode;
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
    theme: NoteboardTheme;
}) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {icon}
                <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        style={{
                            flex: 1,
                            padding: '4px 0',
                            fontSize: 11,
                            fontWeight: 500,
                            borderRadius: 5,
                            border: 'none',
                            cursor: 'pointer',
                            background: value === opt.value ? theme.buttonActiveBg : 'transparent',
                            color: value === opt.value ? theme.buttonActiveColor : theme.panelMutedColor,
                            transition: 'background 0.15s, color 0.15s',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────

import type { PropertiesPosition } from '../types';

export interface PropertiesPanelProps {
    selectedElements: ExcalidrawElement[];
    onUpdateElements: (updates: Partial<ExcalidrawElement>) => void;
    isDark: boolean;
    position?: PropertiesPosition;
}

function getPanelPosition(pos: PropertiesPosition): React.CSSProperties {
    switch (pos) {
        case 'top':
            return { top: 12, left: '50%', transform: 'translateX(-50%)' };
        case 'bottom':
            return { bottom: 12, left: '50%', transform: 'translateX(-50%)' };
        case 'left':
            return { top: '50%', left: 12, transform: 'translateY(-50%)' };
        case 'right':
            return { top: '50%', right: 12, transform: 'translateY(-50%)' };
    }
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedElements,
    onUpdateElements,
    isDark,
    position = 'top',
}) => {
    const theme = useNoteboardTheme();
    const hasSelection = selectedElements.length > 0;
    const isHorizontal = position === 'top' || position === 'bottom';

    // Determine what types are in the selection
    const hasShapes = selectedElements.some((el) => isShapeElement(el));
    const hasLinear = selectedElements.some((el) => isLinearElement(el));
    const hasText = selectedElements.some((el) => el.type === 'text');

    const showFill = hasShapes;
    const showStrokeWidth = hasShapes || hasLinear;
    const showStrokeStyle = hasShapes || hasLinear;
    const showFontSize = hasText;

    const first = selectedElements[0];
    const strokeColor = first?.strokeColor ?? theme.strokeColor;
    const backgroundColor = first?.backgroundColor ?? 'transparent';
    const strokeWidth = first?.strokeWidth ?? 2;
    const strokeStyle = (first?.strokeStyle ?? 'solid') as 'solid' | 'dashed' | 'dotted';
    const opacity = first?.opacity ?? 100;
    const fontSize = hasText && first?.type === 'text' ? (first as any).fontSize ?? 14 : 14;

    const swatches = isDark ? COLOR_SWATCHES_DARK : COLOR_SWATCHES_LIGHT;
    const posStyle = getPanelPosition(position);

    // Merge CSS transforms (translateX for centering + scale for animation)
    const baseTransform = posStyle.transform ?? '';
    const scaleTransform = hasSelection ? 'scale(1)' : 'scale(0.97)';
    const combinedTransform = baseTransform
        ? `${baseTransform} ${scaleTransform}`
        : scaleTransform;

    // ── Compact color grid for horizontal mode ──────────────────
    const CompactColorGrid = ({
        label,
        icon,
        value,
        colors,
        onChange,
    }: {
        label: string;
        icon: React.ReactNode;
        value: string;
        colors: string[];
        onChange: (c: string) => void;
    }) => (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                {icon}
                <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 16px)', gap: 3 }}>
                {colors.map((c) => (
                    <button
                        key={c}
                        onClick={() => onChange(c)}
                        title={c}
                        style={{
                            width: 16, height: 16, borderRadius: 3, padding: 0,
                            border: value === c ? `2px solid ${theme.buttonActiveColor}` : `1px solid ${theme.panelMutedColor}33`,
                            background: c === 'transparent'
                                ? `repeating-conic-gradient(${theme.panelMutedColor}33 0% 25%, transparent 0% 50%) 50% / 6px 6px`
                                : c,
                            cursor: 'pointer',
                        }}
                    />
                ))}
                {/* Custom color picker */}
                <label
                    title="Custom color"
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        border: `1px dashed ${theme.panelMutedColor}88`,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        flexShrink: 0,
                    }}
                >
                    <input
                        type="color"
                        value={value === 'transparent' ? '#ffffff' : value}
                        onChange={(e) => onChange(e.target.value)}
                        style={{
                            position: 'absolute',
                            top: -4,
                            left: -4,
                            width: 24,
                            height: 24,
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0,
                        }}
                    />
                    <span
                        style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                            borderRadius: 2,
                        }}
                    />
                </label>
            </div>
        </div>
    );

    // ── Horizontal section wrapper ──────────────────────────────
    const HSection = ({ children, last }: { children: React.ReactNode; last?: boolean }) => (
        <div style={{
            padding: '0 10px',
            borderRight: last ? 'none' : theme.panelBorder,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
        }}>
            {children}
        </div>
    );

    // ── HORIZONTAL RENDER (top / bottom) ────────────────────────
    if (isHorizontal) {
        return (
            <div
                style={{
                    position: 'absolute',
                    ...posStyle,
                    transform: combinedTransform,
                    zIndex: 1000,
                    background: theme.panelBg,
                    borderRadius: 10,
                    boxShadow: theme.toolbarShadow,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    pointerEvents: hasSelection ? 'auto' : 'none',
                    opacity: hasSelection ? 1 : 0,
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'stretch', padding: '8px 4px' }}>
                    {/* Stroke */}
                    <HSection>
                        <CompactColorGrid
                            label="Stroke"
                            icon={<Palette size={12} weight="bold" style={{ color: theme.panelMutedColor }} />}
                            value={strokeColor}
                            colors={swatches}
                            onChange={(c) => onUpdateElements({ strokeColor: c })}
                        />
                    </HSection>

                    {/* Fill */}
                    {showFill && (
                        <HSection>
                            <CompactColorGrid
                                label="Fill"
                                icon={<PaintBucket size={12} weight="bold" style={{ color: theme.panelMutedColor }} />}
                                value={backgroundColor}
                                colors={['transparent', ...swatches]}
                                onChange={(c) => onUpdateElements({ backgroundColor: c })}
                            />
                        </HSection>
                    )}

                    {/* Width */}
                    {showStrokeWidth && (
                        <HSection>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <LineSegment size={12} weight="bold" style={{ color: theme.panelMutedColor }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Width</span>
                            </div>
                            <div style={{ display: 'flex', gap: 2 }}>
                                {[
                                    { value: '1', label: 'S' },
                                    { value: '2', label: 'M' },
                                    { value: '4', label: 'L' },
                                    { value: '6', label: 'XL' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onUpdateElements({ strokeWidth: Number(opt.value) })}
                                        style={{
                                            padding: '3px 6px', fontSize: 10, fontWeight: 500, borderRadius: 4,
                                            border: 'none', cursor: 'pointer',
                                            background: String(strokeWidth) === opt.value ? theme.buttonActiveBg : 'transparent',
                                            color: String(strokeWidth) === opt.value ? theme.buttonActiveColor : theme.panelMutedColor,
                                            transition: 'background 0.15s, color 0.15s',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </HSection>
                    )}

                    {/* Style */}
                    {showStrokeStyle && (
                        <HSection>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <LineSegment size={12} weight="bold" style={{ color: theme.panelMutedColor, transform: 'rotate(90deg)' }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Style</span>
                            </div>
                            <div style={{ display: 'flex', gap: 2 }}>
                                {[
                                    { value: 'solid', label: '━━' },
                                    { value: 'dashed', label: '╌ ╌' },
                                    { value: 'dotted', label: '···' },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onUpdateElements({ strokeStyle: opt.value as any })}
                                        style={{
                                            padding: '3px 6px', fontSize: 10, fontWeight: 500, borderRadius: 4,
                                            border: 'none', cursor: 'pointer',
                                            background: strokeStyle === opt.value ? theme.buttonActiveBg : 'transparent',
                                            color: strokeStyle === opt.value ? theme.buttonActiveColor : theme.panelMutedColor,
                                            transition: 'background 0.15s, color 0.15s',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </HSection>
                    )}

                    {/* Opacity */}
                    <HSection last>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <CircleHalf size={12} weight="bold" style={{ color: theme.panelMutedColor }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: theme.panelMutedColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opacity</span>
                            <span style={{ fontSize: 10, color: theme.panelMutedColor, marginLeft: 'auto' }}>{opacity}%</span>
                        </div>
                        <input
                            type="range" min={10} max={100} step={5} value={opacity}
                            onChange={(e) => onUpdateElements({ opacity: Number(e.target.value) })}
                            style={{ width: 80, accentColor: theme.buttonActiveColor, cursor: 'pointer' }}
                        />
                    </HSection>
                </div>
            </div>
        );
    }

    // ── VERTICAL RENDER (left / right) ──────────────────────────
    return (
        <div
            style={{
                position: 'absolute',
                ...posStyle,
                transform: combinedTransform,
                width: 220,
                zIndex: 1000,
                background: theme.panelBg,
                borderRadius: 12,
                boxShadow: theme.toolbarShadow,
                fontFamily: "'Inter', system-ui, sans-serif",
                pointerEvents: hasSelection ? 'auto' : 'none',
                opacity: hasSelection ? 1 : 0,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div style={{ padding: '10px 14px 6px', borderBottom: theme.panelBorder }}>
                <span style={{
                    fontSize: 11, fontWeight: 600, color: theme.panelMutedColor,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                    Properties
                    <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>
                        ({selectedElements.length})
                    </span>
                </span>
            </div>

            {/* Controls */}
            <div style={{ padding: '12px 14px 14px' }}>
                <ColorRow
                    label="Stroke"
                    icon={<Palette size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                    value={strokeColor}
                    swatches={swatches}
                    onChange={(c) => onUpdateElements({ strokeColor: c })}
                    theme={theme}
                />

                {showFill && (
                    <ColorRow
                        label="Fill"
                        icon={<PaintBucket size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                        value={backgroundColor}
                        swatches={['transparent', ...swatches]}
                        onChange={(c) => onUpdateElements({ backgroundColor: c })}
                        theme={theme}
                    />
                )}

                {showStrokeWidth && (
                    <ChoiceRow
                        label="Width"
                        icon={<LineSegment size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                        options={[
                            { value: '1', label: 'S' },
                            { value: '2', label: 'M' },
                            { value: '4', label: 'L' },
                            { value: '6', label: 'XL' },
                        ]}
                        value={String(strokeWidth)}
                        onChange={(v) => onUpdateElements({ strokeWidth: Number(v) })}
                        theme={theme}
                    />
                )}

                {showStrokeStyle && (
                    <ChoiceRow
                        label="Style"
                        icon={<LineSegment size={14} weight="bold" style={{ color: theme.panelMutedColor, transform: 'rotate(90deg)' }} />}
                        options={[
                            { value: 'solid', label: '━━' },
                            { value: 'dashed', label: '╌ ╌' },
                            { value: 'dotted', label: '···' },
                        ]}
                        value={strokeStyle}
                        onChange={(v) => onUpdateElements({ strokeStyle: v as any })}
                        theme={theme}
                    />
                )}

                <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <CircleHalf size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                        <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>
                            Opacity
                        </span>
                        <span style={{ fontSize: 11, color: theme.panelMutedColor, marginLeft: 'auto' }}>
                            {opacity}%
                        </span>
                    </div>
                    <input
                        type="range" min={10} max={100} step={5} value={opacity}
                        onChange={(e) => onUpdateElements({ opacity: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: theme.buttonActiveColor, cursor: 'pointer' }}
                    />
                </div>

                {showFontSize && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <TextAa size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                            <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>
                                Font Size
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button
                                onClick={() => onUpdateElements({ fontSize: Math.max(8, fontSize - 2) } as any)}
                                style={{
                                    width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: theme.buttonHoverBg, color: theme.panelTextColor,
                                    fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >−</button>
                            <input
                                type="number" min={8} max={120} value={fontSize}
                                onChange={(e) => onUpdateElements({ fontSize: Number(e.target.value) } as any)}
                                style={{
                                    width: 48, height: 28, borderRadius: 6, border: theme.panelBorder,
                                    background: 'transparent', color: theme.panelTextColor,
                                    textAlign: 'center', fontSize: 12, fontWeight: 500, outline: 'none',
                                }}
                            />
                            <button
                                onClick={() => onUpdateElements({ fontSize: Math.min(120, fontSize + 2) } as any)}
                                style={{
                                    width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: theme.buttonHoverBg, color: theme.panelTextColor,
                                    fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >+</button>
                            <span style={{ fontSize: 11, color: theme.panelMutedColor }}>px</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
