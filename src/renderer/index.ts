import type { NoteboardElement, ImageElement, RectangleElement, LineElement, ArrowElement, FrameElement, StarElement } from '../elements/types';
import { isShapeElement } from '../elements/types';
import { applyDropShadow, clearDropShadow, getCachedImage } from './utils';
import { renderRectangle, renderEllipse, renderDiamond, renderTriangle, renderShapeText } from './renderShapes';
import { renderLine, renderArrow, renderPen, renderLineMidLabel } from './renderLinear';
import { renderFrame, renderStar } from './renderNew';

// ─── Canvas clear ─────────────────────────────────────────────
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.clearRect(0, 0, width, height);
}

// ─── Standalone text ──────────────────────────────────────────────
function renderText(
    ctx: CanvasRenderingContext2D,
    element: NoteboardElement & { text: string; fontSize: number; fontFamily: string; textAlign: string; lineHeight?: number; highlightColor?: string; fontWeight?: string; fontStyle?: string; textDecoration?: string },
) {
    const lhMultiplier = element.lineHeight ?? 1.25;
    const lineHeight = element.fontSize * lhMultiplier;
    const lines = element.text.split('\n');

    if (element.highlightColor) {
        const totalH = lines.length * lineHeight;
        const maxW = lines.reduce((max, line) => Math.max(max, line.length * element.fontSize * 0.6), 0);
        ctx.fillStyle = element.highlightColor;
        ctx.fillRect(element.x - 2, element.y - 2, maxW + 4, totalH + 4);
    }

    const fw = element.fontWeight === 'bold' ? 'bold' : 'normal';
    const fi = element.fontStyle === 'italic' ? 'italic' : 'normal';
    ctx.fillStyle = element.strokeColor;
    ctx.font = `${fi} ${fw} ${element.fontSize}px ${element.fontFamily}`;
    ctx.textAlign = element.textAlign as CanvasTextAlign;
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
        const lineY = element.y + i * lineHeight;
        const textX = element.textAlign === 'center' ? element.x + element.width / 2
            : element.textAlign === 'right' ? element.x + element.width
            : element.x;

        ctx.fillText(lines[i], textX, lineY);
        if (element.textDecoration === 'underline' || element.textDecoration === 'line-through') {
            const lw = ctx.measureText(lines[i]).width;
            const ly = element.textDecoration === 'underline' ? lineY + element.fontSize + 1 : lineY + element.fontSize * 0.55;
            const lx = element.textAlign === 'center' ? textX - lw / 2 : element.textAlign === 'right' ? textX - lw : textX;
            ctx.save();
            ctx.strokeStyle = element.strokeColor;
            ctx.lineWidth = Math.max(1, element.fontSize * 0.07);
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw, ly); ctx.stroke();
            ctx.restore();
        }
    }
}

// ─── Image ────────────────────────────────────────────────────
function renderImage(ctx: CanvasRenderingContext2D, element: ImageElement) {
    const { x, y, width, height, dataUrl, id } = element;
    if (!dataUrl) return;
    const img = getCachedImage(dataUrl, id);
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x, y, width, height);
    } else {
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#ccc'; ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = '#999'; ctx.font = '12px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Loading...', x + width / 2, y + height / 2);
    }
}

// ─── Main Switch ──────────────────────────────────────────────
export function renderElement(ctx: CanvasRenderingContext2D, element: NoteboardElement, excludeText = false) {
    if (element.isDeleted) return;

    ctx.save();
    ctx.globalAlpha = element.opacity / 100;
    if (element.blendMode && element.blendMode !== 'normal') ctx.globalCompositeOperation = element.blendMode as GlobalCompositeOperation;
    if (element.angle !== 0) {
        const cx = element.x + element.width / 2, cy = element.y + element.height / 2;
        ctx.translate(cx, cy); ctx.rotate(element.angle); ctx.translate(-cx, -cy);
    }

    ctx.strokeStyle = element.strokeColor;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (element.strokeStyle === 'dashed') ctx.setLineDash([8, 4]);
    else if (element.strokeStyle === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);

    if (element.dropShadow) applyDropShadow(ctx, element.dropShadow);

    switch (element.type) {
        case 'rectangle': renderRectangle(ctx, element); break;
        case 'ellipse':   renderEllipse(ctx, element); break;
        case 'diamond':   renderDiamond(ctx, element); break;
        case 'triangle':  renderTriangle(ctx, element); break;
        case 'line':
        case 'draw':      renderLine(ctx, element); break;
        case 'pen':       renderPen(ctx, element); break;
        case 'arrow':     renderArrow(ctx, element); break;
        case 'text':      
            if (!excludeText) { clearDropShadow(ctx); renderText(ctx, element as any); }
            break;
        case 'image':     renderImage(ctx, element as ImageElement); break;
        case 'frame':     renderFrame(ctx, element as FrameElement); break;
        case 'star':      renderStar(ctx, element as StarElement); break;
    }

    clearDropShadow(ctx);

    // Inline text for shapes
    if (!excludeText && isShapeElement(element)) {
        const shapeEl = element as RectangleElement;
        if (shapeEl.text) {
            renderShapeText(ctx, element, shapeEl.text, shapeEl.fontSize ?? 14, shapeEl.fontFamily ?? 'Inter, sans-serif', shapeEl.textAlign ?? 'center', shapeEl.lineHeight ?? 1.3, shapeEl.highlightColor, (shapeEl as any).fontWeight, (shapeEl as any).fontStyle, (shapeEl as any).textDecoration);
        }
    }

    // Midpoint label for line/arrow
    if (element.type === 'line' || element.type === 'arrow') {
        const linearEl = element as LineElement | ArrowElement;
        if (linearEl.label) renderLineMidLabel(ctx, linearEl);
    }

    ctx.restore();
}

// ─── Batch render ─────────────────────────────────────────────
export function renderElements(ctx: CanvasRenderingContext2D, elements: readonly NoteboardElement[], width: number, height: number) {
    clearCanvas(ctx, width, height);
    for (const el of elements) { if (!el) continue; renderElement(ctx, el); }
}
