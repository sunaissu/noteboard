import { HighlighterIcon, WaveTriangleIcon } from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, PenElement } from '../../elements/types';
import { Divider, CollapsibleSection, ToggleRow, SliderRow } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

export function PenSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const penEl = selectedElements.find((el) => el.type === 'pen') as PenElement | undefined;
    const isHighlighter = penEl?.highlighter ?? false;
    const tension = penEl?.tension ?? 0;

    return (
        <>
            <Divider theme={theme} />
            <CollapsibleSection label="Pen" theme={theme}>

            <ToggleRow
                label="Highlighter Mode"
                icon={<HighlighterIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                checked={isHighlighter}
                onChange={(v) => onUpdate({ highlighter: v } as any)}
                theme={theme}
            />

            <SliderRow
                label="Smoothing"
                icon={<WaveTriangleIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                value={tension} min={0} max={1} step={0.05} unit=""
                onChange={(v) => onUpdate({ tension: v } as any)}
                theme={theme}
            />
            </CollapsibleSection>
        </>
    );
}
