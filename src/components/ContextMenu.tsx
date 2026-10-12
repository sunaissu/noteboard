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
    bounds?: { width: number; height: number };
    onClose: () => void;
}

function isSeparator(item: ContextMenuItem): item is ContextMenuSeparator {
    return 'separator' in item;
}

export function ContextMenu({ x, y, items, onClose, bounds }: ContextMenuProps) {
    const theme = useNoteboardTheme();
    const menuRef = useRef<HTMLDivElement>(null);

    // Adjust position so menu stays inside viewport
    const MENU_W = 200;
    const MENU_H = items.length * 34;
    const adjustedX = Math.max(8, Math.min(x, (bounds?.width ?? window.innerWidth) - MENU_W - 8));
    const adjustedY = Math.max(8, Math.min(y, (bounds?.height ?? window.innerHeight) - MENU_H - 8));

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        const handler = (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Tab') { onClose(); return; }
            const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
            if (!buttons.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
        };
        // Delay slightly so the pointerdown that opened the menu doesn't immediately close it
        const tid = setTimeout(() => {
            window.addEventListener('pointerdown', handler);
            window.addEventListener('keydown', keyHandler);
        }, 0);
        return () => {
            clearTimeout(tid);
            if (previousFocus?.isConnected) previousFocus.focus();
            window.removeEventListener('pointerdown', handler);
            window.removeEventListener('keydown', keyHandler);
        };
    }, [onClose]);

    return (
        <div role="menu" aria-label="Board actions"
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
                minWidth: MENU_W, maxHeight: bounds ? Math.max(40, bounds.height - 16) : 'calc(100vh - 16px)', overflowY: 'auto',
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
                    <button type="button" role="menuitem"
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
