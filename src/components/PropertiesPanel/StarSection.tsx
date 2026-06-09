import React from 'react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, StarElement } from '../../elements/types';
import { Divider, CollapsibleSection, SliderRow } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

export function StarSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const starEl = selectedElements.find((el) => el.type === 'star') as StarElement | undefined;
    const sides = starEl?.sides ?? 5;
    const isStar = starEl?.isStar ?? true;
    const innerRadius = starEl?.innerRadius ?? 0.4;

    const ibStyle = (active = false): React.CSSProperties => ({
        flex: 1, padding: '5px 0', fontSize: 12, fontWeight: active ? 700 : 400,
        borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'background 0.15s',
        background: active ? theme.buttonActiveBg : theme.buttonHoverBg,
        color: active ? theme.buttonActiveColor : theme.panelTextColor,
    });

    return (
        <>
            <Divider theme={theme} />
            <CollapsibleSection label="Shape" theme={theme}>

            {/* Star vs Polygon toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <button style={ibStyle(!isStar)} onClick={() => onUpdate({ isStar: false } as any)}>Polygon</button>
                <button style={ibStyle(isStar)}  onClick={() => onUpdate({ isStar: true } as any)}>Star</button>
            </div>

            {/* Sides slider */}
            <SliderRow
                label="Sides"
                value={sides} min={3} max={12} step={1}
                onChange={(v) => onUpdate({ sides: v } as any)}
                theme={theme}
            />

            {/* Inner radius (star only) */}
            {isStar && (
                <SliderRow
                    label="Inner Radius"
                    value={Math.round(innerRadius * 100)} min={10} max={90} step={5}
                    unit="%"
                    onChange={(v) => onUpdate({ innerRadius: v / 100 } as any)}
                    theme={theme}
                />
            )}
            </CollapsibleSection>
        </>
    );
}
