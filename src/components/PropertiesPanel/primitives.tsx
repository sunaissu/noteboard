import React from 'react';
import type { NoteboardTheme } from '../../ThemeContext';

export function SectionLabel({ children, theme }: { children: React.ReactNode; theme: NoteboardTheme }) {
    return (
        <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: theme.panelMutedColor,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 8,
        }}>
            {children}
        </div>
    );
}

export function Divider({ theme }: { theme: NoteboardTheme }) {
    return <div style={{ height: 1, background: `${theme.panelMutedColor}22`, margin: '8px 0 12px' }} />;
}

export function ColorRow({
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
                            width: 20, height: 20, borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0,
                            border: value === c
                                ? `2px solid ${theme.buttonActiveColor}`
                                : `1px solid ${theme.panelMutedColor}44`,
                            background: c === 'transparent'
                                ? `repeating-conic-gradient(${theme.panelMutedColor}33 0% 25%, transparent 0% 50%) 50% / 8px 8px`
                                : c,
                        }}
                    />
                ))}
                <label title="Custom color" style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: `1px dashed ${theme.panelMutedColor}88`,
                    overflow: 'hidden', cursor: 'pointer', position: 'relative', flexShrink: 0,
                }}>
                    <input
                        type="color"
                        value={value === 'transparent' ? '#ffffff' : value}
                        onChange={(e) => onChange(e.target.value)}
                        style={{ position: 'absolute', top: -4, left: -4, width: 28, height: 28, border: 'none', cursor: 'pointer', opacity: 0 }}
                    />
                    <span style={{
                        display: 'block', width: '100%', height: '100%', borderRadius: 3,
                        background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                    }} />
                </label>
            </div>
        </div>
    );
}

export function ChoiceRow<T extends string>({
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
                            flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 500,
                            borderRadius: 5, border: 'none', cursor: 'pointer',
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

export function SliderRow({
    label,
    icon,
    value,
    min,
    max,
    step,
    unit,
    onChange,
    theme,
}: {
    label: string;
    icon?: React.ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (v: number) => void;
    theme: NoteboardTheme;
}) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {icon}
                <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 11, color: theme.panelMutedColor, marginLeft: 'auto' }}>
                    {value}{unit ?? ''}
                </span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{ width: '100%', accentColor: theme.buttonActiveColor, cursor: 'pointer' }}
            />
        </div>
    );
}

export function ToggleRow({
    label,
    icon,
    checked,
    onChange,
    theme,
}: {
    label: string;
    icon?: React.ReactNode;
    checked: boolean;
    onChange: (v: boolean) => void;
    theme: NoteboardTheme;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {icon}
            <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500, flex: 1 }}>{label}</span>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: checked ? theme.buttonActiveBg : `${theme.panelMutedColor}44`,
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
            >
                <span style={{
                    position: 'absolute', top: 2, left: checked ? 18 : 2,
                    width: 16, height: 16, borderRadius: 8,
                    background: checked ? theme.buttonActiveColor : '#fff',
                    transition: 'left 0.2s',
                }} />
            </button>
        </div>
    );
}

export const FONT_FAMILIES = [
    { value: 'Inter, sans-serif', label: 'Inter' },
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Courier New, monospace', label: 'Courier New' },
    { value: 'Comic Sans MS, cursive', label: 'Comic Sans' },
    { value: 'sans-serif', label: 'Sans-serif' },
    { value: 'serif', label: 'Serif' },
    { value: 'monospace', label: 'Monospace' },
];

export const COLOR_SWATCHES_LIGHT = [
    '#1e1e1e', '#e03131', '#e8590c', '#fcc419',
    '#40c057', '#228be6', '#7950f2', '#be4bdb',
    '#868e96', '#ffffff',
];
export const COLOR_SWATCHES_DARK = [
    '#e0e0e0', '#ff6b6b', '#ff922b', '#ffd43b',
    '#69db7c', '#4dabf7', '#9775fa', '#da77f2',
    '#adb5bd', '#1e1e1e',
];

export function iconBtnStyle(theme: NoteboardTheme, active = false): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? theme.buttonActiveBg : 'transparent',
        color: active ? theme.buttonActiveColor : theme.panelMutedColor,
        transition: 'background 0.15s, color 0.15s',
    };
}
