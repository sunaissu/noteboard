import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, FrameElement } from '../../elements/types';
import { Divider, CollapsibleSection } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

export function FrameSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const frameEl = selectedElements.find((el) => el.type === 'frame') as FrameElement | undefined;
    const name = frameEl?.name ?? '';
    const showLabel = frameEl?.showLabel ?? true;

    return (
        <>
            <Divider theme={theme} />
            <CollapsibleSection label="Frame" theme={theme}>

            {/* Frame name */}
            <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500, display: 'block', marginBottom: 4 }}>Label</span>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => onUpdate({ name: e.target.value } as any)}
                    placeholder="Frame name…"
                    style={{
                        width: '100%', fontSize: 12, borderRadius: 6, padding: '4px 8px',
                        border: theme.panelBorder, background: 'transparent',
                        color: theme.panelTextColor, outline: 'none', boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Show label toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                    id="frame-show-label"
                    type="checkbox"
                    checked={showLabel}
                    onChange={(e) => onUpdate({ showLabel: e.target.checked } as any)}
                    style={{ cursor: 'pointer', accentColor: theme.buttonActiveColor }}
                />
                <label htmlFor="frame-show-label" style={{ fontSize: 12, color: theme.panelTextColor, cursor: 'pointer' }}>
                    Show label
                </label>
            </div>
            </CollapsibleSection>
        </>
    );
}
