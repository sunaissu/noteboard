import React, { useEffect, useRef, useState } from 'react';
import { useNoteboardTheme } from '../ThemeContext';
import { List, X, Moon, Sun } from '@phosphor-icons/react';

export interface SettingsPanelProps {
    isDark: boolean;
    onToggleDark: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isDark,
    onToggleDark,
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
                        Settings
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
                    {/* ── Theme toggle ── */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isDark ? (
                                <Moon size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                            ) : (
                                <Sun size={16} weight="fill" style={{ color: theme.buttonActiveColor }} />
                            )}
                            <span
                                style={{
                                    fontSize: 13,
                                    color: theme.panelTextColor,
                                    fontWeight: 500,
                                }}
                            >
                                Dark Mode
                            </span>
                        </div>

                        {/* Toggle switch */}
                        <button
                            onClick={onToggleDark}
                            role="switch"
                            aria-checked={isDark}
                            style={{
                                position: 'relative',
                                width: 40,
                                height: 22,
                                borderRadius: 11,
                                border: 'none',
                                cursor: 'pointer',
                                background: isDark ? '#7c5cff' : '#ccc',
                                transition: 'background 0.2s',
                                padding: 0,
                                flexShrink: 0,
                            }}
                        >
                            <span
                                style={{
                                    position: 'absolute',
                                    top: 2,
                                    left: isDark ? 20 : 2,
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    background: '#fff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    transition: 'left 0.2s',
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
