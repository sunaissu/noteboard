import React from 'react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, CalloutElement } from '../../elements/types';
import { Divider, CollapsibleSection } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

type TailDir = CalloutElement['tailDirection'];

const TAIL_OPTIONS: { key: TailDir; label: string }[] = [
    { key: 'bottom-left',  label: '↙' },
    { key: 'bottom-right', label: '↘' },
    { key: 'top-left',     label: '↖' },
    { key: 'top-right',    label: '↗' },
];

export function CalloutSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const calloutEl = selectedElements.find((el) => el.type === 'callout') as CalloutElement | undefined;
    const tailDir = calloutEl?.tailDirection ?? 'bottom-left';

    const btnStyle = (active: boolean): React.CSSProperties => ({
        flex: 1, padding: '6px 0', fontSize: 16, borderRadius: 6,
        border: 'none', cursor: 'pointer', transition: 'background 0.15s',
        background: active ? theme.buttonActiveBg : theme.buttonHoverBg,
        color: active ? theme.buttonActiveColor : theme.panelTextColor,
        fontWeight: active ? 700 : 400,
    });

    return (
        <>
            <Divider theme={theme} />
            <CollapsibleSection label="Tail Direction" theme={theme}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
                {TAIL_OPTIONS.map((opt) => (
                    <button
                        key={opt.key}
                        title={opt.key}
                        style={btnStyle(tailDir === opt.key)}
                        onClick={() => onUpdate({ tailDirection: opt.key } as any)}
                    >
                        {opt.label}
                    </button>
                ))}
                </div>
            </CollapsibleSection>
        </>
    );
}
