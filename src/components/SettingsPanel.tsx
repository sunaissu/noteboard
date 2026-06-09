import React, { useEffect, useRef, useState } from 'react';
import { useNoteboardTheme } from '../ThemeContext';
import { List, X, Moon, Sun, FloppyDisk, DownloadSimple, Trash, GridNine, Export, UploadSimple } from '@phosphor-icons/react';

export interface SettingsPanelProps {
    isDark: boolean;
    onToggleDark: () => void;
    showGrid: boolean;
    onToggleGrid: () => void;
    /** Current read-only state */
    isReadOnly: boolean;
    /** Toggle read-only mode (no-op when the prop is externally controlled) */
    onToggleReadOnly: () => void;
    /** Show the keyboard shortcut cheatsheet */
    onShowShortcuts?: () => void;
    /** When provided, a Save button appears in the panel */
    onSave?: () => void;
    onExportImage?: (format: 'png' | 'jpeg') => void;
    onExportJSON?: () => void;
    onImportJSON?: () => void;
    onClearCanvas?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isDark,
    onToggleDark,
    showGrid,
    onToggleGrid,
    isReadOnly,
    onToggleReadOnly,
    onShowShortcuts,
    onSave,
    onExportImage,
    onExportJSON,
    onImportJSON,
    onClearCanvas,
}) => {
    const theme = useNoteboardTheme();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close on click-outside
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                panelRef.current &&
                !panelRef.current.contains(target) &&
                buttonRef.current &&
                !buttonRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, [open]);

    return (
        <>
            {/* Burger menu button */}
            <button
                ref={buttonRef}
                onClick={() => setOpen((v) => !v)}
                title="Settings"
                style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 1002,
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: theme.toolbarBg,
                    color: theme.buttonDefaultColor,
                    boxShadow: theme.toolbarShadow,
                    transition: 'background 0.15s, color 0.15s',
                    pointerEvents: 'auto',
                }}
            >
                <List size={20} weight="bold" />
            </button>

            {/* Slide-out panel */}
            <div
                ref={panelRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 240,
                    zIndex: 1003,
                    background: theme.panelBg,
                    borderLeft: theme.panelBorder,
                    boxShadow: open
                        ? '-4px 0 24px rgba(0,0,0,0.15)'
                        : 'none',
                    transform: open ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    pointerEvents: open ? 'auto' : 'none',
                    fontFamily: "'Inter', system-ui, sans-serif",
                }}
            >
                {/* Panel header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px 10px',
                        borderBottom: theme.panelBorder,
                    }}
                >
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.panelTextColor,
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                        }}
                    >
                        Menu
                    </span>
                    <button
                        onClick={() => setOpen(false)}
                        title="Close"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: 'transparent',
                            color: theme.panelMutedColor,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = theme.buttonHoverBg;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <X size={16} weight="bold" />
                    </button>
                </div>

                {/* Panel content */}
                <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                    {/* ── View Options ── */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            paddingBottom: 16,
                            borderBottom: theme.panelBorder,
                        }}
                    >
                        {/* Theme toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isDark ? (
                                    <Moon size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                ) : (
                                    <Sun size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                )}
                                <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>
                                    Dark Mode
                                </span>
                            </div>

                            <button
                                onClick={onToggleDark}
                                role="switch"
                                aria-checked={isDark}
                                style={{
                                    position: 'relative', width: 40, height: 22, borderRadius: 11, border: 'none',
                                    cursor: 'pointer', background: isDark ? '#7c5cff' : '#ccc', transition: 'background 0.2s', padding: 0, flexShrink: 0,
                                }}
                            >
                                <span style={{ position: 'absolute', top: 2, left: isDark ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                            </button>
                        </div>

                        {/* Grid toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <GridNine size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>
                                    Show Grid
                                </span>
                            </div>

                            <button
                                onClick={onToggleGrid}
                                role="switch"
                                aria-checked={showGrid}
                                style={{
                                    position: 'relative', width: 40, height: 22, borderRadius: 11, border: 'none',
                                    cursor: 'pointer', background: showGrid ? '#7c5cff' : '#ccc', transition: 'background 0.2s', padding: 0, flexShrink: 0,
                                }}
                            >
                                <span style={{ position: 'absolute', top: 2, left: showGrid ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                            </button>
                        </div>

                        {/* Read-only toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16, lineHeight: 1 }}>{isReadOnly ? '🔒' : '✏️'}</span>
                                <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>
                                    Read-only
                                </span>
                            </div>

                            <button
                                onClick={onToggleReadOnly}
                                role="switch"
                                aria-checked={isReadOnly}
                                style={{
                                    position: 'relative', width: 40, height: 22, borderRadius: 11, border: 'none',
                                    cursor: 'pointer', background: isReadOnly ? '#e03131' : '#ccc', transition: 'background 0.2s', padding: 0, flexShrink: 0,
                                }}
                            >
                                <span style={{ position: 'absolute', top: 2, left: isReadOnly ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                            </button>
                        </div>

                        {/* Keyboard shortcuts */}
                        {onShowShortcuts && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 16, lineHeight: 1 }}>⌨️</span>
                                    <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>
                                        Keyboard Shortcuts
                                    </span>
                                </div>
                                <button
                                    onClick={() => { onShowShortcuts(); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '3px 10px', border: 'none', borderRadius: 7, cursor: 'pointer',
                                        background: theme.buttonHoverBg, color: theme.panelMutedColor,
                                        fontSize: 12, fontWeight: 600, transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.buttonActiveBg; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = theme.buttonHoverBg; }}
                                >
                                    ?
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Actions ── */}
                    <div style={{ paddingTop: 16, borderBottom: theme.panelBorder, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Save Board */}
                        {onSave && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FloppyDisk size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                    <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>Save Board</span>
                                </div>
                                <button
                                    onClick={() => { onSave(); setOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 12px', border: 'none', borderRadius: 7, cursor: 'pointer', background: '#7c5cff', color: '#fff', fontSize: 12, fontWeight: 600, transition: 'opacity 0.15s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                                >
                                    Save
                                </button>
                            </div>
                        )}

                        {/* Export PNG */}
                        {onExportImage && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <DownloadSimple size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                    <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>Export PNG</span>
                                </div>
                                <button
                                    onClick={() => { onExportImage('png'); setOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 12px', border: '1px solid ' + theme.panelBorder.split(' ')[2], borderRadius: 7, cursor: 'pointer', background: 'transparent', color: theme.panelTextColor, fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.buttonHoverBg; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    Export
                                </button>
                            </div>
                        )}
                        
                        {/* Export JPEG */}
                        {onExportImage && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <DownloadSimple size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                    <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>Export JPEG</span>
                                </div>
                                <button
                                    onClick={() => { onExportImage('jpeg'); setOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 12px', border: '1px solid ' + theme.panelBorder.split(' ')[2], borderRadius: 7, cursor: 'pointer', background: 'transparent', color: theme.panelTextColor, fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.buttonHoverBg; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    Export
                                </button>
                            </div>
                        )}

                        {/* Export JSON */}
                        {onExportJSON && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Export size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                    <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>Save to File</span>
                                </div>
                                <button
                                    onClick={() => { onExportJSON(); setOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 12px', border: '1px solid ' + theme.panelBorder.split(' ')[2], borderRadius: 7, cursor: 'pointer', background: 'transparent', color: theme.panelTextColor, fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.buttonHoverBg; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    Save
                                </button>
                            </div>
                        )}

                        {/* Import JSON */}
                        {onImportJSON && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <UploadSimple size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                                    <span style={{ fontSize: 13, color: theme.panelTextColor, fontWeight: 500 }}>Load from File</span>
                                </div>
                                <button
                                    onClick={() => { onImportJSON(); setOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 12px', border: '1px solid ' + theme.panelBorder.split(' ')[2], borderRadius: 7, cursor: 'pointer', background: 'transparent', color: theme.panelTextColor, fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.buttonHoverBg; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    Open
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Clear Canvas ── */}
                    {onClearCanvas && (
                        <div
                            style={{
                                marginTop: 16,
                                paddingTop: 16,
                                borderTop: theme.panelBorder,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Trash size={16} weight="fill" style={{ color: '#ff4d4f' }} />
                                <span
                                    style={{
                                        fontSize: 13,
                                        color: '#ff4d4f',
                                        fontWeight: 500,
                                    }}
                                >
                                    Clear Canvas
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    onClearCanvas();
                                    setOpen(false);
                                }}
                                title="Clear all elements"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '5px 12px',
                                    border: 'none',
                                    borderRadius: 7,
                                    cursor: 'pointer',
                                    background: 'rgba(255, 77, 79, 0.1)',
                                    color: '#ff4d4f',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.2)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 79, 0.1)'; }}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
