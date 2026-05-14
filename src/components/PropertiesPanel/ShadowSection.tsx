import { CircleIcon } from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, DropShadow } from '../../elements/types';
import { SectionLabel, Divider, ToggleRow, SliderRow } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

export function ShadowSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const first = selectedElements[0];

    const shadow = first?.dropShadow;
    const hasShadow = !!shadow;
    const shadowBlur = shadow?.blur ?? 8;
    const shadowOffsetX = shadow?.offsetX ?? 4;
    const shadowOffsetY = shadow?.offsetY ?? 4;
    const shadowColor = shadow?.color ?? 'rgba(0,0,0,0.3)';

    const updateShadow = (updates: Partial<DropShadow>) => {
        const current = first?.dropShadow ?? { blur: 8, offsetX: 4, offsetY: 4, color: 'rgba(0,0,0,0.3)' };
        onUpdate({ dropShadow: { ...current, ...updates } } as any);
    };

    return (
        <>
            <Divider theme={theme} />
            <SectionLabel theme={theme}>Drop Shadow</SectionLabel>

            <ToggleRow
                label="Enable Shadow"
                icon={<CircleIcon size={14} weight="fill" style={{ color: theme.panelMutedColor }} />}
                checked={hasShadow}
                onChange={(v) => {
                    if (v) onUpdate({ dropShadow: { blur: 8, offsetX: 4, offsetY: 4, color: 'rgba(0,0,0,0.3)' } } as any);
                    else onUpdate({ dropShadow: undefined } as any);
                }}
                theme={theme}
            />

            {hasShadow && (
                <>
                    <SliderRow label="Blur" value={shadowBlur} min={0} max={40} step={1} unit="px"
                        onChange={(v) => updateShadow({ blur: v })} theme={theme} />
                    <SliderRow label="X Offset" value={shadowOffsetX} min={-20} max={20} step={1} unit="px"
                        onChange={(v) => updateShadow({ offsetX: v })} theme={theme} />
                    <SliderRow label="Y Offset" value={shadowOffsetY} min={-20} max={20} step={1} unit="px"
                        onChange={(v) => updateShadow({ offsetY: v })} theme={theme} />
                    <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Shadow Color</span>
                        <div style={{ marginTop: 6 }}>
                            <input
                                type="color"
                                value={shadowColor.startsWith('rgba') ? '#000000' : shadowColor}
                                onChange={(e) => updateShadow({ color: e.target.value })}
                                style={{ width: '100%', height: 28, borderRadius: 6, border: theme.panelBorder, cursor: 'pointer', padding: 2 }}
                            />
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
