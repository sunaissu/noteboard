import type { Point, NoteboardElement, LineElement, ArrowElement, PenElement, PressurePoint } from '../elements/types';
import { getLinearElementAbsolutePoints, getArrowheadPoints, getLineAngle } from '../elements/renderUtils';
import { seededRandom, jitterPoint, drawJitteredLine } from './utils';

// ─── Orthogonal (elbow) routing ──────────────────────────────
function renderOrthogonalLine(ctx: CanvasRenderingContext2D, pts: Point[]) {
    if (pts.length < 2) return;
    const p0 = pts[0], pn = pts[pts.length - 1];
    const midX = (p0.x + pn.x) / 2;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(midX, p0.y);
    ctx.lineTo(midX, pn.y); ctx.lineTo(pn.x, pn.y);
    ctx.stroke();
}

// ─── Curved line (quadratic bezier) ──────────────────────────
function renderCurvedLine(ctx: CanvasRenderingContext2D, pts: Point[]) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
        const cpx = (pts[0].x + pts[1].x) / 2;
        const cpy = (pts[0].y + pts[1].y) / 2 - 30;
        ctx.quadraticCurveTo(cpx, cpy, pts[1].x, pts[1].y);
    } else {
        for (let i = 0; i < pts.length - 1; i++) {
            const mx = (pts[i].x + pts[i + 1].x) / 2;
            const my = (pts[i].y + pts[i + 1].y) / 2;
            if (i === pts.length - 2) ctx.quadraticCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
            else ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
    }
    ctx.stroke();
}

// ─── Line / Draw ─────────────────────────────────────────────
export function renderLine(ctx: CanvasRenderingContext2D, element: NoteboardElement & { points: Point[] }) {
    const pts = getLinearElementAbsolutePoints(element);
    if (pts.length < 2) return;
    const lineEl = element as LineElement;
    const routing = lineEl.routing;
    const curveType = lineEl.curveType ?? 'straight';

    if (routing === 'orthogonal') { renderOrthogonalLine(ctx, pts); return; }
    if (curveType === 'curve') { renderCurvedLine(ctx, pts); return; }
    if (element.roughness > 0) {
        const rng = seededRandom(element.seed);
        for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();
            const jp0 = jitterPoint(pts[0].x, pts[0].y, element.roughness, rng);
            ctx.moveTo(jp0.x, jp0.y);
            for (let i = 0; i < pts.length - 1; i++)
                drawJitteredLine(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, element.roughness, rng);
            ctx.stroke();
        }
    } else {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
    }
}

// ─── Arrowhead ───────────────────────────────────────────────
function renderArrowhead(
    ctx: CanvasRenderingContext2D,
    tip: Point, angle: number,
    arrowhead: string | null,
    strokeColor: string, strokeWidth: number,
) {
    if (!arrowhead) return;
    ctx.save();
    ctx.strokeStyle = strokeColor; ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth; ctx.setLineDash([]);
    const size = Math.max(10, strokeWidth * 4);

    if (arrowhead === 'arrow' || arrowhead === 'triangle') {
        const [left, tipPt, right] = getArrowheadPoints(tip, angle, size + 4, size * 0.7);
        ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(tipPt.x, tipPt.y); ctx.lineTo(right.x, right.y);
        if (arrowhead === 'triangle') { ctx.closePath(); ctx.fill(); } else { ctx.stroke(); }
    } else if (arrowhead === 'dot') {
        ctx.beginPath(); ctx.arc(tip.x, tip.y, size * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (arrowhead === 'bar') {
        const perp = angle + Math.PI / 2, hl = size * 0.5;
        ctx.beginPath();
        ctx.moveTo(tip.x + Math.cos(perp) * hl, tip.y + Math.sin(perp) * hl);
        ctx.lineTo(tip.x - Math.cos(perp) * hl, tip.y - Math.sin(perp) * hl);
        ctx.stroke();
    }
    ctx.restore();
}

// ─── Arrow ───────────────────────────────────────────────────
export function renderArrow(ctx: CanvasRenderingContext2D, element: NoteboardElement & { points: Point[]; endArrowhead: unknown }) {
    const arrowEl = element as ArrowElement;
    const pts = getLinearElementAbsolutePoints(element);
    if (pts.length < 2) return;

    const curveType = arrowEl.curveType ?? 'straight';
    const routing = arrowEl.routing;

    if (routing === 'orthogonal') renderOrthogonalLine(ctx, pts);
    else if (curveType === 'curve') renderCurvedLine(ctx, pts);
    else if (element.roughness > 0) {
        const rng = seededRandom(element.seed);
        ctx.beginPath();
        const jp0 = jitterPoint(pts[0].x, pts[0].y, element.roughness, rng); ctx.moveTo(jp0.x, jp0.y);
        for (let i = 0; i < pts.length - 1; i++)
            drawJitteredLine(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, element.roughness, rng);
        ctx.stroke();
    } else {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
    }

    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    let endAngle: number;
    if (curveType === 'curve' && pts.length === 2) {
        const cpx = (pts[0].x + pts[1].x) / 2, cpy = (pts[0].y + pts[1].y) / 2 - 30;
        endAngle = Math.atan2(last.y - cpy, last.x - cpx);
    } else if (routing === 'orthogonal') {
        endAngle = last.y === prev.y ? Math.atan2(0, last.x - prev.x) : Math.atan2(last.y - prev.y, 0);
    } else { endAngle = getLineAngle(prev, last); }

    const first = pts[0], second = pts[1];
    let startAngle: number;
    if (curveType === 'curve' && pts.length === 2) {
        const cpx = (pts[0].x + pts[1].x) / 2, cpy = (pts[0].y + pts[1].y) / 2 - 30;
        startAngle = Math.atan2(first.y - cpy, first.x - cpx) + Math.PI;
    } else { startAngle = getLineAngle(second, first); }

    renderArrowhead(ctx, last, endAngle, arrowEl.endArrowhead ?? 'arrow', element.strokeColor, element.strokeWidth);
    renderArrowhead(ctx, first, startAngle, arrowEl.startArrowhead ?? null, element.strokeColor, element.strokeWidth);
}

// ─── Midpoint label for line/arrow ───────────────────────────
export function renderLineMidLabel(ctx: CanvasRenderingContext2D, element: LineElement | ArrowElement) {
    if (!element.label) return;
    const pts = getLinearElementAbsolutePoints(element);
    if (pts.length < 2) return;
    const midIdx = Math.floor((pts.length - 1) / 2);
    const p1 = pts[midIdx], p2 = pts[midIdx + 1];
    const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
    const fontSize = element.labelFontSize ?? 12;
    const fontFamily = element.labelFontFamily ?? 'Inter, sans-serif';

    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    const lw = ctx.measureText(element.label).width + 8;
    const lh = fontSize + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = element.strokeColor;
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.roundRect(midX - lw / 2, midY - lh / 2, lw, lh, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = element.strokeColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(element.label, midX, midY);
    ctx.restore();
}

// ─── Catmull-Rom spline ───────────────────────────────────────
function renderCatmullRom(ctx: CanvasRenderingContext2D, pts: Point[], tension: number = 0.5) {
    if (pts.length < 2) return;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
        const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) * tension / 3, cp1y = p1.y + (p2.y - p0.y) * tension / 3;
        const cp2x = p2.x - (p3.x - p1.x) * tension / 3, cp2y = p2.y - (p3.y - p1.y) * tension / 3;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.stroke();
}

// ─── Pen (pressure-sensitive) ────────────────────────────────
export function renderPen(ctx: CanvasRenderingContext2D, element: PenElement) {
    const { x, y, points, strokeWidth, highlighter, tension } = element;
    if (points.length < 2) return;
    if (highlighter) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.4; }

    const hasPressure = points.some((p: PressurePoint) => p.pressure !== undefined && p.pressure > 0);
    const useTension = (tension ?? 0) > 0 && !hasPressure;

    if (useTension) {
        ctx.lineWidth = strokeWidth;
        renderCatmullRom(ctx, points.map((p) => ({ x: x + p.x, y: y + p.y })), tension ?? 0.5);
    } else if (hasPressure) {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i] as PressurePoint, p2 = points[i + 1] as PressurePoint;
            const pressure = ((p1.pressure ?? 0.5) + (p2.pressure ?? 0.5)) / 2;
            ctx.beginPath(); ctx.lineWidth = strokeWidth * (0.3 + pressure * 1.2);
            ctx.moveTo(x + p1.x, y + p1.y); ctx.lineTo(x + p2.x, y + p2.y); ctx.stroke();
        }
    } else {
        ctx.beginPath(); ctx.moveTo(x + points[0].x, y + points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(x + points[i].x, y + points[i].y);
        ctx.stroke();
    }

    if (highlighter) ctx.restore();
}
