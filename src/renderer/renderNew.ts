/**
 * renderNew.ts — Renderers for Phase 2 element types:
 *   renderStickyNote, renderFrame, renderStar, renderCallout
 */
import type { StickyNoteElement, FrameElement, StarElement, CalloutElement } from '../elements/types';
import { getCalloutGeometry } from '../elements/calloutGeometry';

// ─── Compat helper: rounded rect path (polyfills ctx.roundRect) ─────
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const minR = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + minR, y);
    ctx.lineTo(x + w - minR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + minR);
    ctx.lineTo(x + w, y + h - minR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - minR, y + h);
    ctx.lineTo(x + minR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - minR);
    ctx.lineTo(x, y + minR);
    ctx.quadraticCurveTo(x, y, x + minR, y);
    ctx.closePath();
}

// ─── Sticky Note ─────────────────────────────────────────────

const NOTE_PALETTE: Record<string, { bg: string; stroke: string; fold: string }> = {
    yellow: { bg: '#ffd60a', stroke: '#c8a800', fold: '#c8a800' },
    pink:   { bg: '#ff9eb1', stroke: '#cc5577', fold: '#cc5577' },
    blue:   { bg: '#74c0fc', stroke: '#2e86de', fold: '#2e86de' },
    green:  { bg: '#8ee99a', stroke: '#2d9e45', fold: '#2d9e45' },
    purple: { bg: '#c77dff', stroke: '#7b2fff', fold: '#7b2fff' },
};

export function renderStickyNote(ctx: CanvasRenderingContext2D, el: StickyNoteElement) {
    const { x, y, width, height } = el;
    const palette = NOTE_PALETTE[el.noteColor] ?? NOTE_PALETTE.yellow;
    const fold = Math.min(16, Math.abs(width) * 0.12, Math.abs(height) * 0.12);
    const w = Math.abs(width), h = Math.abs(height);
    const x1 = Math.min(x, x + width), y1 = Math.min(y, y + height);

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // Body
    ctx.fillStyle = palette.bg;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + w - fold, y1);
    ctx.lineTo(x1 + w, y1 + fold);
    ctx.lineTo(x1 + w, y1 + h);
    ctx.lineTo(x1, y1 + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = el.strokeWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + w - fold, y1);
    ctx.lineTo(x1 + w, y1 + fold);
    ctx.lineTo(x1 + w, y1 + h);
    ctx.lineTo(x1, y1 + h);
    ctx.closePath();
    ctx.stroke();

    // Fold crease
    ctx.strokeStyle = palette.fold;
    ctx.lineWidth = el.strokeWidth * 0.8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 + w - fold, y1);
    ctx.lineTo(x1 + w - fold, y1 + fold);
    ctx.lineTo(x1 + w, y1 + fold);
    ctx.stroke();
    ctx.restore();
}

// ─── Frame ────────────────────────────────────────────────────

export function renderFrame(ctx: CanvasRenderingContext2D, el: FrameElement) {
    const { x, y, width, height } = el;
    const x1 = Math.min(x, x + width), y1 = Math.min(y, y + height);
    const w = Math.abs(width), h = Math.abs(height);
    const color = el.frameColor ?? '#4A90D9';

    ctx.save();

    // Fill (usually transparent)
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
        ctx.fillStyle = el.backgroundColor;
        ctx.fillRect(x1, y1, w, h);
    }

    // Dashed border
    ctx.strokeStyle = color;
    ctx.lineWidth = el.strokeWidth;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(x1, y1, w, h);
    ctx.setLineDash([]);

    // Frame label
    if (el.showLabel && el.name) {
        const labelFontSize = 11;
        ctx.font = `600 ${labelFontSize}px Inter, sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        ctx.fillText(el.name, x1 + 4, y1 - 3);
    }

    ctx.restore();
}

// ─── Star / Polygon ───────────────────────────────────────────

/** Computes points for a star or regular polygon. All points are world-space. */
function buildStarPoints(cx: number, cy: number, outerR: number, sides: number, isStar: boolean, innerRatio: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const count = isStar ? sides * 2 : sides;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const r = (isStar && i % 2 === 1) ? outerR * innerRatio : outerR;
        pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    return pts;
}

export function renderStar(ctx: CanvasRenderingContext2D, el: StarElement) {
    const { x, y, width, height } = el;
    const cx = x + width / 2, cy = y + height / 2;
    const outerR = Math.min(Math.abs(width), Math.abs(height)) / 2;
    const pts = buildStarPoints(cx, cy, outerR, el.sides ?? 5, el.isStar ?? true, el.innerRadius ?? 0.4);

    ctx.save();

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
        ctx.fillStyle = el.backgroundColor;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        ctx.fill();
    }

    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}

// ─── Callout ─────────────────────────────────────────────────

export function renderCallout(ctx: CanvasRenderingContext2D, el: CalloutElement) {
    const { body, tail } = getCalloutGeometry(el);
    const [tailStart, tailTip, tailEnd] = tail;

    ctx.save();

    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
        ctx.fillStyle = el.backgroundColor;
    } else {
        ctx.fillStyle = '#ffffff';
    }

    roundRectPath(ctx, body.x, body.y, body.width, body.height, body.radius);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(tailStart.x, tailStart.y);
    ctx.lineTo(tailTip.x, tailTip.y);
    ctx.lineTo(tailEnd.x, tailEnd.y);
    ctx.closePath();
    ctx.fill();

    // Stroke body
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.setLineDash([]);
    roundRectPath(ctx, body.x, body.y, body.width, body.height, body.radius);
    ctx.stroke();

    // Stroke tail
    ctx.beginPath();
    ctx.moveTo(tailStart.x, tailStart.y);
    ctx.lineTo(tailTip.x, tailTip.y);
    ctx.lineTo(tailEnd.x, tailEnd.y);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}
