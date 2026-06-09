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
    if (step < 6) return; // too dense to see

    // Compute first grid intersection in screen space
    const startX = ((panX % step) + step) % step;
    const startY = ((panY % step) + step) % step;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;

    // Dot radius: larger dots at higher zoom so they remain visible
    const r = Math.min(1.5, step * 0.05);

    for (let x = startX; x <= width; x += step) {
        for (let y = startY; y <= height; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

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
