import type { NoteboardElement, RectangleElement } from '../elements/types';
import { seededRandom, jitterPoint, drawJitteredLine } from './utils';

// ─── Rectangle ───────────────────────────────────────────────
export function renderRectangle(ctx: CanvasRenderingContext2D, element: RectangleElement) {
    const { x, y, width, height, backgroundColor, roughness, seed, borderRadius } = element;
    const r = Math.min(borderRadius ?? 0, Math.abs(width) / 2, Math.abs(height) / 2);

    if (roughness > 0) {
        const rng = seededRandom(seed);
        const x1 = x, y1 = y, x2 = x + width, y2 = y + height;
        if (backgroundColor && backgroundColor !== 'transparent') {
            ctx.fillStyle = backgroundColor;
            ctx.beginPath(); ctx.roundRect(x1, y1, width, height, r); ctx.fill();
        }
        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            const jp1 = jitterPoint(x1 + r, y1, roughness, rng);
            ctx.moveTo(jp1.x, jp1.y);
            drawJitteredLine(ctx, x1 + r, y1, x2 - r, y1, roughness, rng);
            drawJitteredLine(ctx, x2, y1 + r, x2, y2 - r, roughness, rng);
            drawJitteredLine(ctx, x2 - r, y2, x1 + r, y2, roughness, rng);
            drawJitteredLine(ctx, x1, y2 - r, x1, y1 + r, roughness, rng);
            ctx.stroke();
        }
    } else {
        if (backgroundColor && backgroundColor !== 'transparent') {
            ctx.fillStyle = backgroundColor;
            if (r > 0) { ctx.beginPath(); ctx.roundRect(x, y, width, height, r); ctx.fill(); }
            else { ctx.fillRect(x, y, width, height); }
        }
        if (r > 0) { ctx.beginPath(); ctx.roundRect(x, y, width, height, r); ctx.stroke(); }
        else { ctx.strokeRect(x, y, width, height); }
    }
}

// ─── Ellipse ─────────────────────────────────────────────────
export function renderEllipse(ctx: CanvasRenderingContext2D, element: NoteboardElement) {
    const { x, y, width, height, backgroundColor, roughness, seed } = element;
    const cx = x + width / 2, cy = y + height / 2;
    const rx = Math.abs(width / 2), ry = Math.abs(height / 2);
    if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (roughness > 0) {
        const rng = seededRandom(seed);
        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            const steps = 36;
            for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const jp = jitterPoint(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle), roughness, rng);
                if (i === 0) ctx.moveTo(jp.x, jp.y); else ctx.lineTo(jp.x, jp.y);
            }
            ctx.stroke();
        }
    } else {
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
}

// ─── Diamond ─────────────────────────────────────────────────
export function renderDiamond(ctx: CanvasRenderingContext2D, element: NoteboardElement) {
    const { x, y, width, height, backgroundColor, roughness, seed } = element;
    const cx = x + width / 2, cy = y + height / 2;
    const hw = Math.abs(width / 2), hh = Math.abs(height / 2);
    const verts = [{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }];

    if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath(); ctx.fill();
    }
    if (roughness > 0) {
        const rng = seededRandom(seed);
        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            const jp0 = jitterPoint(verts[0].x, verts[0].y, roughness, rng); ctx.moveTo(jp0.x, jp0.y);
            for (let i = 0; i < verts.length; i++) {
                const next = verts[(i + 1) % verts.length];
                drawJitteredLine(ctx, verts[i].x, verts[i].y, next.x, next.y, roughness, rng);
            }
            ctx.stroke();
        }
    } else {
        ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath(); ctx.stroke();
    }
}

// ─── Triangle ────────────────────────────────────────────────
export function renderTriangle(ctx: CanvasRenderingContext2D, element: NoteboardElement) {
    const { x, y, width, height, backgroundColor, roughness, seed } = element;
    const x1 = Math.min(x, x + width), y1 = Math.min(y, y + height);
    const x2 = Math.max(x, x + width), y2 = Math.max(y, y + height);
    const verts = [{ x: (x1 + x2) / 2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];

    if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
        ctx.lineTo(verts[1].x, verts[1].y); ctx.lineTo(verts[2].x, verts[2].y);
        ctx.closePath(); ctx.fill();
    }
    if (roughness > 0) {
        const rng = seededRandom(seed);
        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            const jp0 = jitterPoint(verts[0].x, verts[0].y, roughness, rng); ctx.moveTo(jp0.x, jp0.y);
            for (let i = 0; i < verts.length; i++) {
                const next = verts[(i + 1) % verts.length];
                drawJitteredLine(ctx, verts[i].x, verts[i].y, next.x, next.y, roughness, rng);
            }
            ctx.stroke();
        }
    } else {
        ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
        ctx.lineTo(verts[1].x, verts[1].y); ctx.lineTo(verts[2].x, verts[2].y);
        ctx.closePath(); ctx.stroke();
    }
}

// ─── Shape inline text ────────────────────────────────────────
export function renderShapeText(
    ctx: CanvasRenderingContext2D,
    element: NoteboardElement,
    text: string,
    fontSize: number,
    fontFamily: string,
    textAlign: string,
    lineHeightMultiplier: number = 1.3,
    highlightColor?: string,
    fontWeight?: string,
    fontStyle?: string,
    textDecoration?: string,
) {
    const { x, y, width, height } = element;
    const padding = 8;
    const maxWidth = Math.abs(width) - padding * 2;
    if (maxWidth <= 0) return;

    ctx.save();
    const fw = fontWeight === 'bold' ? 'bold' : 'normal';
    const fi = fontStyle === 'italic' ? 'italic' : 'normal';
    ctx.font = `${fi} ${fw} ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    const lineHeight = fontSize * lineHeightMultiplier;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine); currentLine = word;
        } else { currentLine = testLine; }
    }
    if (currentLine) lines.push(currentLine);

    const totalTextHeight = lines.length * lineHeight;
    const absX = Math.min(x, x + width), absY = Math.min(y, y + height);
    const absW = Math.abs(width), absH = Math.abs(height);
    const startY = absY + (absH - totalTextHeight) / 2;

    if (highlightColor) {
        ctx.fillStyle = highlightColor;
        ctx.fillRect(absX + padding, startY - 2, maxWidth, totalTextHeight + 4);
    }

    ctx.fillStyle = element.strokeColor;
    ctx.textAlign = textAlign as CanvasTextAlign;
    const textX = textAlign === 'center' ? absX + absW / 2
        : textAlign === 'right' ? absX + absW - padding
        : absX + padding;

    for (let i = 0; i < lines.length; i++) {
        const lineY = startY + i * lineHeight;
        if (lineY + lineHeight > absY + absH) break;
        ctx.fillText(lines[i], textX, lineY, maxWidth);
        if (textDecoration === 'underline' || textDecoration === 'line-through') {
            const lw = Math.min(ctx.measureText(lines[i]).width, maxWidth);
            const lx = textAlign === 'center' ? textX - lw / 2 : textAlign === 'right' ? textX - lw : textX;
            const ly = textDecoration === 'underline' ? lineY + fontSize + 1 : lineY + fontSize * 0.55;
            ctx.save();
            ctx.strokeStyle = element.strokeColor;
            ctx.lineWidth = Math.max(1, fontSize * 0.07);
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw, ly); ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
}
