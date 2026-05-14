/**
 * useGrid — grid drawing and snap-to-grid utilities.
 * Pure canvas helpers; no React state.
 */
import type { Point } from '../elements/types';
import { GRID_SIZE, SNAP_THRESHOLD } from '../constants';

// ─── Grid drawing ─────────────────────────────────────────────

export function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    panX: number,
    panY: number,
    zoom: number,
    color: string,
    gridSize: number = GRID_SIZE,
): void {
    const step = gridSize * zoom;
    if (step < 4) return; // too dense to see

    // Compute the first grid line in screen space
    const startX = ((panX % step) + step) % step;
    const startY = ((panY % step) + step) % step;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.beginPath();

    for (let x = startX; x <= width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    for (let y = startY; y <= height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.stroke();
    ctx.restore();
}

// ─── Snap ────────────────────────────────────────────────────

/**
 * Snaps a canvas-space point to the nearest grid intersection.
 * Returns the original point if snap is disabled or too far.
 */
export function snapToGrid(
    point: Point,
    gridSize: number = GRID_SIZE,
    threshold: number = SNAP_THRESHOLD,
): Point {
    const snappedX = Math.round(point.x / gridSize) * gridSize;
    const snappedY = Math.round(point.y / gridSize) * gridSize;
    const dx = Math.abs(point.x - snappedX);
    const dy = Math.abs(point.y - snappedY);
    return {
        x: dx <= threshold ? snappedX : point.x,
        y: dy <= threshold ? snappedY : point.y,
    };
}
