import type { CSSProperties, MouseEvent } from 'react';
import { useNoteboardTheme } from '../ThemeContext';

interface ZoomHUDProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    onFitAll: () => void;
}

export function ZoomHUD({ zoom, onZoomIn, onZoomOut, onReset, onFitAll }: ZoomHUDProps) {
    const theme = useNoteboardTheme();
    const pct = Math.round(zoom * 100);

    const btn: CSSProperties = {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: theme.panelTextColor,
        fontSize: 14,
        fontWeight: 700,
        width: 26,
        height: 26,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.15s',
        flexShrink: 0,
    };

    const hoverStyle = (e: MouseEvent<HTMLButtonElement>, enter: boolean) => {
        (e.currentTarget as HTMLButtonElement).style.background = enter
            ? theme.buttonHoverBg
            : 'none';
    };

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 56,
                right: 12,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: theme.panelBg,
                border: theme.panelBorder,
                borderRadius: 8,
                boxShadow: theme.toolbarShadow,
                padding: '2px 4px',
                fontFamily: "'Inter', system-ui, sans-serif",
                userSelect: 'none',
                pointerEvents: 'auto',
            }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button style={btn} onClick={onZoomOut} title="Zoom out (Ctrl+−)"
                onMouseEnter={e => hoverStyle(e, true)} onMouseLeave={e => hoverStyle(e, false)}>−</button>

            <button
                onClick={onReset}
                title="Reset zoom to 100%"
                onMouseEnter={e => hoverStyle(e, true)}
                onMouseLeave={e => hoverStyle(e, false)}
                style={{
                    ...btn,
                    width: 'auto',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '0 6px',
                    color: theme.panelMutedColor,
                    letterSpacing: '0.02em',
                }}
            >
                {pct}%
            </button>

            <button style={btn} onClick={onZoomIn} title="Zoom in (Ctrl++)"
                onMouseEnter={e => hoverStyle(e, true)} onMouseLeave={e => hoverStyle(e, false)}>+</button>

            <div style={{ width: 1, height: 16, background: theme.panelBorder, margin: '0 2px' }} />

            <button
                style={{ ...btn, fontSize: 11, width: 'auto', padding: '0 4px' }}
                onClick={onFitAll}
                title="Fit all elements (Ctrl+0)"
                onMouseEnter={e => hoverStyle(e, true)}
                onMouseLeave={e => hoverStyle(e, false)}
            >
                ⊡
            </button>
        </div>
    );
}
