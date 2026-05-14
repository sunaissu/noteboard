import { TextAaIcon, TextAlignLeftIcon, TextAlignCenterIcon, TextAlignRightIcon, HighlighterIcon, WaveTriangleIcon } from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, TextElement } from '../../elements/types';
import { hasShapeText } from '../../elements/types';
import { SectionLabel, Divider, SliderRow, iconBtnStyle, FONT_FAMILIES } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

const HIGHLIGHT_COLORS = [
    '',
    'rgba(255,236,61,0.6)',
    'rgba(133,227,125,0.6)',
    'rgba(100,180,255,0.6)',
    'rgba(255,140,100,0.6)',
    'rgba(220,140,255,0.6)',
];

export function TextSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();

    const textEl = selectedElements.find((el) => el.type === 'text' || hasShapeText(el));
    const fontSize = textEl ? ((textEl as any).fontSize ?? 14) : 14;
    const fontFamily = textEl ? ((textEl as any).fontFamily ?? 'Inter, sans-serif') : 'Inter, sans-serif';
    const textAlign = textEl ? ((textEl as any).textAlign ?? 'left') : 'left';
    const lineHeight = textEl ? ((textEl as any).lineHeight ?? 1.25) : 1.25;
    const highlightColor = textEl ? ((textEl as TextElement).highlightColor ?? '') : '';
    const fontWeight = textEl ? ((textEl as any).fontWeight ?? 'normal') : 'normal';
    const fontStyle = textEl ? ((textEl as any).fontStyle ?? 'normal') : 'normal';
    const textDecoration = textEl ? ((textEl as any).textDecoration ?? 'none') : 'none';

    const ibStyle = (active = false) => ({ ...iconBtnStyle(theme, active), flex: 1, padding: '5px 0' });

    return (
        <>
            <Divider theme={theme} />
            <SectionLabel theme={theme}>Text</SectionLabel>

            {/* Font size stepper */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <TextAaIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Font Size</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => onUpdate({ fontSize: Math.max(8, fontSize - 2) } as any)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: theme.buttonHoverBg, color: theme.panelTextColor, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        −
                    </button>
                    <input type="number" min={8} max={120} value={fontSize}
                        onChange={(e) => onUpdate({ fontSize: Number(e.target.value) } as any)}
                        style={{ width: 48, height: 28, borderRadius: 6, border: theme.panelBorder, background: 'transparent', color: theme.panelTextColor, textAlign: 'center', fontSize: 12, fontWeight: 500, outline: 'none' }} />
                    <button onClick={() => onUpdate({ fontSize: Math.min(120, fontSize + 2) } as any)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: theme.buttonHoverBg, color: theme.panelTextColor, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        +
                    </button>
                    <span style={{ fontSize: 11, color: theme.panelMutedColor }}>px</span>
                </div>
            </div>

            {/* Font family */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <TextAaIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Family</span>
                </div>
                <select value={fontFamily} onChange={(e) => onUpdate({ fontFamily: e.target.value } as any)}
                    style={{ width: '100%', fontSize: 12, borderRadius: 6, padding: '4px 6px', border: theme.panelBorder, background: theme.panelBg, color: theme.panelTextColor, cursor: 'pointer', outline: 'none', fontFamily }}>
                    {FONT_FAMILIES.map((ff) => (
                        <option key={ff.value} value={ff.value} style={{ fontFamily: ff.value }}>{ff.label}</option>
                    ))}
                </select>
            </div>

            {/* Font weight / style / decoration */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Style</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button title="Bold"
                        onClick={() => onUpdate({ fontWeight: fontWeight === 'bold' ? 'normal' : 'bold' } as any)}
                        style={{ ...ibStyle(fontWeight === 'bold'), fontWeight: 700, fontSize: 13 }}>B</button>
                    <button title="Italic"
                        onClick={() => onUpdate({ fontStyle: fontStyle === 'italic' ? 'normal' : 'italic' } as any)}
                        style={{ ...ibStyle(fontStyle === 'italic'), fontStyle: 'italic', fontSize: 13 }}>I</button>
                    <button title="Underline"
                        onClick={() => onUpdate({ textDecoration: textDecoration === 'underline' ? 'none' : 'underline' } as any)}
                        style={{ ...ibStyle(textDecoration === 'underline'), textDecoration: 'underline', fontSize: 13 }}>U</button>
                    <button title="Strikethrough"
                        onClick={() => onUpdate({ textDecoration: textDecoration === 'line-through' ? 'none' : 'line-through' } as any)}
                        style={{ ...ibStyle(textDecoration === 'line-through'), textDecoration: 'line-through', fontSize: 13 }}>S</button>
                </div>
            </div>

            {/* Text alignment */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Align</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {[
                        { value: 'left', icon: TextAlignLeftIcon, title: 'Align Left' },
                        { value: 'center', icon: TextAlignCenterIcon, title: 'Align Center' },
                        { value: 'right', icon: TextAlignRightIcon, title: 'Align Right' },
                    ].map((opt) => {
                        const Icon = opt.icon;
                        return (
                            <button key={opt.value} title={opt.title}
                                onClick={() => onUpdate({ textAlign: opt.value } as any)}
                                style={ibStyle(textAlign === opt.value)}>
                                <Icon size={16} weight="bold" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Line height */}
            <SliderRow
                label="Line Height"
                icon={<WaveTriangleIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                value={lineHeight} min={1} max={3} step={0.05} unit="×"
                onChange={(v) => onUpdate({ lineHeight: v } as any)}
                theme={theme}
            />

            {/* Highlight color */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <HighlighterIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Highlight</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {HIGHLIGHT_COLORS.map((c) => (
                        <button key={c}
                            onClick={() => onUpdate({ highlightColor: c || undefined } as any)}
                            title={c || 'None'}
                            style={{
                                width: 22, height: 22, borderRadius: 4, padding: 0, cursor: 'pointer',
                                border: highlightColor === c ? `2px solid ${theme.buttonActiveColor}` : `1px solid ${theme.panelMutedColor}44`,
                                background: c || 'transparent',
                                backgroundImage: !c ? `repeating-conic-gradient(${theme.panelMutedColor}33 0% 25%, transparent 0% 50%) 50% / 8px 8px` : undefined,
                            }}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}
