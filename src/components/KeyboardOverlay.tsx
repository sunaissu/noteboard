import { useEffect, useRef } from 'react';
import type { NoteboardElement, Point } from '../elements/types';
import { renderElement } from '../renderer';
import { useNoteboardTheme } from '../ThemeContext';

export function KeyboardOverlay({ cursor, anchor, draft, pan, zoom, size, operation, bottom, viewportInsets = {}, hideHelp = false }: {
    cursor: Point; anchor: Point | null; draft: NoteboardElement | null; pan: Point; zoom: number;
    size: { width: number; height: number }; operation: string; bottom: number;
    /** Available board rectangle after reserving space for other floating controls. */
    viewportInsets?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
    hideHelp?: boolean;
}) {
    const preview = useRef<HTMLCanvasElement>(null);
    const theme = useNoteboardTheme();
    useEffect(() => {
        const canvas = preview.current; if (!canvas) return;
        const ratio = window.devicePixelRatio || 1; canvas.width = size.width*ratio; canvas.height = size.height*ratio;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.scale(ratio,ratio); ctx.translate(pan.x,pan.y); ctx.scale(zoom,zoom);
        if (draft) renderElement(ctx, { ...draft, opacity: Math.min(65,draft.opacity) });
    }, [draft,pan,zoom,size]);
    const x = cursor.x*zoom+pan.x, y = cursor.y*zoom+pan.y;
    const insets = {
        top: Math.max(0, viewportInsets.top ?? 12),
        right: Math.max(0, viewportInsets.right ?? 12),
        bottom: Math.max(0, viewportInsets.bottom ?? bottom),
        left: Math.max(0, viewportInsets.left ?? 12),
    };
    const compact = size.height - insets.top - insets.bottom < 92 || size.width - insets.left - insets.right < 180;
    const instructions = <>
        Keyboard Canvas · {operation} · {Math.round(cursor.x)}, {Math.round(cursor.y)}<br/>
        {anchor ? 'Space: finish · Esc: cancel' : 'Tab: objects · Enter: text · P: properties · Esc: exit'}
    </>;
    return <div data-keyboard-canvas="true" style={{ position:'absolute',inset:0,pointerEvents:'none',zIndex:950 }}>
        <canvas ref={preview} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />
        <svg width="100%" height="100%" aria-hidden="true" style={{position:'absolute',inset:0}}>
            {anchor && <circle cx={anchor.x*zoom+pan.x} cy={anchor.y*zoom+pan.y} r="5" fill="#fff" stroke="#111" strokeWidth="2" />}
            <g transform={`translate(${x},${y})`}><circle r="7" fill="none" stroke="white" strokeWidth="5"/><path d="M-16 0H16M0 -16V16" stroke="white" strokeWidth="5"/><circle r="7" fill="none" stroke="#111" strokeWidth="2"/><path d="M-16 0H16M0 -16V16" stroke="#111" strokeWidth="2"/></g>
        </svg>
        {!hideHelp && <div style={{position:'absolute',...insets,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',minWidth:0,minHeight:0}}>
            <div data-keyboard-help role="region" aria-label="Keyboard Canvas help" tabIndex={0}
                onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.closest<HTMLElement>('.noteboard-canvas')?.focus({preventScroll:true});}}}
                style={{width:'max-content',maxWidth:'100%',maxHeight:'100%',minWidth:0,minHeight:0,flex:'0 1 auto',boxSizing:'border-box',overflow:'auto',overscrollBehavior:'contain',overflowWrap:'anywhere',pointerEvents:'auto',padding:compact?'0 8px':'6px 10px',borderRadius:8,background:theme.panelBg,color:theme.panelTextColor,border:theme.panelBorder,boxShadow:theme.toolbarShadow,font:'12px system-ui',textAlign:'center'}}>
                {compact ? <details>
                    <summary aria-label="Keyboard Canvas instructions" style={{minHeight:42,alignContent:'center',cursor:'pointer',touchAction:'manipulation'}}>Keys</summary>
                    <div style={{paddingBottom:6}}>{instructions}</div>
                </details> : instructions}
            </div>
        </div>}
    </div>;
}
