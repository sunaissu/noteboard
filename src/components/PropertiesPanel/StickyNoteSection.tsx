import React from 'react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, StickyNoteElement } from '../../elements/types';
import { Divider, CollapsibleSection } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

const NOTE_COLORS: { key: string; bg: string; label: string }[] = [
    { key: 'yellow', bg: '#ffd60a', label: 'Yellow' },
    { key: 'pink',   bg: '#ff9eb1', label: 'Pink' },
    { key: 'blue',   bg: '#74c0fc', label: 'Blue' },
    { key: 'green',  bg: '#8ee99a', label: 'Green' },
    { key: 'purple', bg: '#c77dff', label: 'Purple' },
];

export function StickyNoteSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const stickyEl = selectedElements.find((el) => el.type === 'sticky-note') as StickyNoteElement | undefined;
    const noteColor = stickyEl?.noteColor ?? 'yellow';

    return (
        <>
            <Divider theme={theme} />
            <CollapsibleSection label="Note Color" theme={theme}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {NOTE_COLORS.map((c) => (
                    <button
                        key={c.key}
                        title={c.label}
                        onClick={() => onUpdate({ noteColor: c.key } as any)}
                        style={{
                            width: 28, height: 28, borderRadius: 6, padding: 0, cursor: 'pointer',
                            background: c.bg,
                            border: noteColor === c.key
                                ? `3px solid ${theme.buttonActiveColor}`
                                : `2px solid ${theme.panelMutedColor}44`,
                            transition: 'border 0.15s',
                        }}
                    />
                ))}
                </div>
            </CollapsibleSection>
        </>
    );
}
