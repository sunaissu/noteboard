import React, { useEffect } from 'react';
import { useNoteboardTheme } from '../ThemeContext';

interface ShortcutModalProps {
    open: boolean;
    onClose: () => void;
}

const SECTIONS = [
    {
        title: 'Navigation',
        shortcuts: [
            { keys: ['Scroll'], desc: 'Pan canvas' },
            { keys: ['Ctrl', 'Scroll'], desc: 'Zoom in / out' },
            { keys: ['Ctrl', '0'], desc: 'Fit all elements' },
            { keys: ['Ctrl', '⇧', 'H'], desc: 'Fit selection' },
        ],
    },
    {
        title: 'Tools',
        shortcuts: [
            { keys: ['1–9'], desc: 'Switch tool by slot' },
            { keys: ['S'], desc: 'Select tool' },
            { keys: ['H'], desc: 'Pan tool' },
            { keys: ['P'], desc: 'Pen tool' },
            { keys: ['T'], desc: 'Text tool' },
            { keys: ['G'], desc: 'Toggle grid / snap' },
        ],
    },
    {
        title: 'Editing',
        shortcuts: [
            { keys: ['Ctrl', 'Z'], desc: 'Undo' },
            { keys: ['Ctrl', '⇧', 'Z'], desc: 'Redo' },
            { keys: ['Ctrl', 'C'], desc: 'Copy' },
            { keys: ['Ctrl', 'V'], desc: 'Paste' },
            { keys: ['Ctrl', 'D'], desc: 'Duplicate' },
            { keys: ['Delete'], desc: 'Delete selected' },
            { keys: ['↑ ↓ ← →'], desc: 'Nudge (+ ⇧ = large step)' },
        ],
    },
    {
        title: 'Selection & Layers',
        shortcuts: [
            { keys: ['Ctrl', 'A'], desc: 'Select all' },
            { keys: ['Escape'], desc: 'Deselect' },
            { keys: ['⇧', 'Click'], desc: 'Add to selection' },
            { keys: [']'], desc: 'Move forward' },
            { keys: ['['], desc: 'Move backward' },
            { keys: ['Ctrl', ']'], desc: 'Bring to front' },
            { keys: ['Ctrl', '['], desc: 'Send to back' },
            { keys: ['Ctrl', 'G'], desc: 'Group' },
            { keys: ['Ctrl', '⇧', 'G'], desc: 'Ungroup' },
        ],
    },
    {
        title: 'Canvas',
        shortcuts: [
            { keys: ['?'], desc: 'Show this cheatsheet' },
            { keys: ['Dbl-click'], desc: 'Edit text / shape label' },
            { keys: ['Escape'], desc: 'Finish text edit' },
        ],
    },
];

export function ShortcutModal({ open, onClose }: ShortcutModalProps) {
    const theme = useNoteboardTheme();

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(2px)',
            }}
            onPointerDown={onClose}
        >
            <div
                style={{
                    background: theme.panelBg,
                    border: theme.panelBorder,
                    borderRadius: 16,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                    padding: '24px 28px',
                    maxWidth: 560,
                    width: '90%',
                    maxHeight: '80%',
                    overflowY: 'auto',
                    fontFamily: "'Inter', system-ui, sans-serif",
                }}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: theme.panelTextColor }}>
                        ⌨️ Keyboard Shortcuts
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 18, color: theme.panelMutedColor, lineHeight: 1,
                            padding: '2px 6px', borderRadius: 6,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Sections */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 28px' }}>
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, color: theme.panelMutedColor,
                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                            }}>
                                {section.title}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {section.shortcuts.map((s) => (
                                    <div key={s.desc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                        <span style={{ fontSize: 12, color: theme.panelTextColor }}>{s.desc}</span>
                                        <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                            {s.keys.map((k) => (
                                                <kbd key={k} style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    padding: '1px 6px', borderRadius: 4, fontSize: 11, fontFamily: 'inherit',
                                                    background: theme.buttonHoverBg, color: theme.panelTextColor,
                                                    border: theme.panelBorder, minWidth: 22,
                                                }}>
                                                    {k}
                                                </kbd>
                                            ))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: theme.panelBorder, fontSize: 11, color: theme.panelMutedColor, textAlign: 'center' }}>
                    Press <kbd style={{ padding: '1px 5px', borderRadius: 4, background: theme.buttonHoverBg, border: theme.panelBorder, fontSize: 11 }}>?</kbd> or <kbd style={{ padding: '1px 5px', borderRadius: 4, background: theme.buttonHoverBg, border: theme.panelBorder, fontSize: 11 }}>Escape</kbd> to close
                </div>
            </div>
        </div>
    );
}
