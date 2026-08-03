import { useEffect, useRef } from 'react';
import { useNoteboardTheme } from '../ThemeContext';

export interface ContextMenuAction {
    label: string;
    icon?: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

export interface ContextMenuSeparator {
    separator: true;
}

export type ContextMenuItem = ContextMenuAction | ContextMenuSeparator;

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

function isSeparator(item: ContextMenuItem): item is ContextMenuSeparator {
    return 'separator' in item;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const theme = useNoteboardTheme();
    const menuRef = useRef<HTMLDivElement>(null);

    // Adjust position so menu stays inside viewport
    const MENU_W = 200;
    const MENU_H = items.length * 34;
    const adjustedX = x + MENU_W > window.innerWidth ? x - MENU_W : x;
    const adjustedY = y + MENU_H > window.innerHeight ? y - MENU_H : y;

    useEffect(() => {
        const handler = (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        // Delay slightly so the pointerdown that opened the menu doesn't immediately close it
        const tid = setTimeout(() => {
            window.addEventListener('pointerdown', handler);
            window.addEventListener('keydown', keyHandler);
        }, 0);
        return () => {
            clearTimeout(tid);
            window.removeEventListener('pointerdown', handler);
            window.removeEventListener('keydown', keyHandler);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            style={{
                position: 'absolute',
                left: adjustedX,
                top: adjustedY,
                zIndex: 3000,
                background: theme.panelBg,
                border: theme.panelBorder,
                borderRadius: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                padding: '4px 0',
                minWidth: MENU_W,
                fontFamily: "'Inter', system-ui, sans-serif",
                pointerEvents: 'auto',
            }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {items.map((item, idx) => {
                if (isSeparator(item)) {
                    return (
                        <div key={idx} style={{
                            height: 1,
                            background: theme.panelBorder.replace('1px solid ', ''),
                            margin: '4px 0',
                        }} />
                    );
                }
                return (
                    <button
                        key={idx}
                        disabled={item.disabled}
                        onClick={() => { item.onClick(); onClose(); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '6px 14px',
                            border: 'none',
                            background: 'none',
                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                            fontSize: 13,
                            color: item.danger ? '#ff4d4f' : item.disabled ? theme.panelMutedColor : theme.panelTextColor,
                            textAlign: 'left',
                            opacity: item.disabled ? 0.45 : 1,
                            transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) => {
                            if (!item.disabled)
                                e.currentTarget.style.background = item.danger
                                    ? 'rgba(255,77,79,0.1)'
                                    : theme.buttonHoverBg;
                        }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                        {item.icon && <span style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{item.icon}</span>}
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
