import type { ExcalidrawElement, Point } from './elements/types';
import { isLinearElement } from './elements/types';
import {
    getLinearElementAbsolutePoints,
    getArrowheadPoints,
    getLineAngle,
} from './elements/renderUtils';

// ─── Canvas Clear ────────────────────────────────────────────

export function clearCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
) {
    ctx.clearRect(0, 0, width, height);
}

// ─── Element Rendering ───────────────────────────────────────

export function renderElement(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement,
) {
    if (element.isDeleted) return;

    ctx.save();
    ctx.globalAlpha = element.opacity / 100;

    // Rotation around center
    if (element.angle !== 0) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(element.angle);
        ctx.translate(-cx, -cy);
    }

    // Stroke style
    ctx.strokeStyle = element.strokeColor;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (element.strokeStyle === 'dashed') {
        ctx.setLineDash([8, 4]);
    } else if (element.strokeStyle === 'dotted') {
        ctx.setLineDash([2, 4]);
    } else {
        ctx.setLineDash([]);
    }

    switch (element.type) {
        case 'rectangle':
            renderRectangle(ctx, element);
            break;
        case 'line':
        case 'draw':
        case 'pen':
            renderLine(ctx, element);
            break;
        case 'arrow':
            renderArrow(ctx, element);
            break;
        case 'text':
            renderText(ctx, element);
            break;
    }

    ctx.restore();
}

// ─── Rectangle ───────────────────────────────────────────────

function renderRectangle(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement,
) {
    const { x, y, width, height, backgroundColor } = element;

    if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, width, height);
    }

    ctx.strokeRect(x, y, width, height);
}

// ─── Line / Draw ─────────────────────────────────────────────

function renderLine(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement & { points: Point[] },
) {
    const pts = getLinearElementAbsolutePoints(element);
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
}

// ─── Arrow ───────────────────────────────────────────────────

function renderArrow(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement & { points: Point[]; endArrowhead: unknown },
) {
    const pts = getLinearElementAbsolutePoints(element);
    if (pts.length < 2) return;

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    // Draw arrowhead at the end
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const angle = getLineAngle(prev, last);
    const [left, tip, right] = getArrowheadPoints(last, angle, 14, 10);

    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
}

// ─── Text ────────────────────────────────────────────────────

function renderText(
    ctx: CanvasRenderingContext2D,
    element: ExcalidrawElement & { text: string; fontSize: number; fontFamily: string; textAlign: string },
) {
    ctx.fillStyle = element.strokeColor;
    ctx.font = `${element.fontSize}px ${element.fontFamily}`;
    ctx.textAlign = element.textAlign as CanvasTextAlign;
    ctx.textBaseline = 'top';

    const lines = element.text.split('\n');
    const lineHeight = element.fontSize * 1.25;

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], element.x, element.y + i * lineHeight);
    }
}

// ─── Render All Elements ─────────────────────────────────────

export function renderElements(
    ctx: CanvasRenderingContext2D,
    elements: readonly ExcalidrawElement[],
    width: number,
    height: number,
) {
    clearCanvas(ctx, width, height);
    for (const el of elements) {
        if (!el) continue;
        renderElement(ctx, el);
    }
}
