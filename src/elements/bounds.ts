import type { Bounds, Point, ExcalidrawElement } from './types';
import { isLinearElement } from './types';

// ─── Point-set Bounds ────────────────────────────────────────

/** Compute the AABB enclosing a set of points. */
export function getPointsBounds(points: readonly Point[]): Bounds {
    if (points.length === 0) return [0, 0, 0, 0];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }

    return [minX, minY, maxX, maxY];
}

// ─── Rotation helpers ────────────────────────────────────────

/** Rotate point (px, py) around center (cx, cy) by `angle` radians. */
export function rotatePoint(
    px: number,
    py: number,
    cx: number,
    cy: number,
    angle: number,
): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = px - cx;
    const dy = py - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
    };
}

/** Compute the AABB of an already-known box after rotation. */
export function getRotatedBounds(
    bounds: Bounds,
    angle: number,
    cx: number,
    cy: number,
): Bounds {
    if (angle === 0) return bounds;

    const [x1, y1, x2, y2] = bounds;
    const corners: Point[] = [
        rotatePoint(x1, y1, cx, cy, angle),
        rotatePoint(x2, y1, cx, cy, angle),
        rotatePoint(x2, y2, cx, cy, angle),
        rotatePoint(x1, y2, cx, cy, angle),
    ];
    return getPointsBounds(corners);
}

// ─── Element Bounds ──────────────────────────────────────────

/**
 * Get the axis-aligned bounding box for any element.
 * For linear elements the bounds are derived from their point arrays.
 * For all elements, rotation is taken into account.
 */
export function getElementBounds(element: ExcalidrawElement): Bounds {
    const { x, y, width, height, angle } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;

    if (isLinearElement(element)) {
        // Convert relative points → absolute, then compute bounds
        const abs: Point[] = element.points.map((p) => ({
            x: x + p.x,
            y: y + p.y,
        }));

        if (abs.length === 0) {
            return getRotatedBounds([x, y, x, y], angle, cx, cy);
        }

        const rawBounds = getPointsBounds(abs);
        return angle !== 0
            ? getRotatedBounds(rawBounds, angle, cx, cy)
            : rawBounds;
    }

    // Rectangle, text, etc.
    const x1 = Math.min(x, x + width);
    const y1 = Math.min(y, y + height);
    const x2 = Math.max(x, x + width);
    const y2 = Math.max(y, y + height);
    return getRotatedBounds([x1, y1, x2, y2], angle, cx, cy);
}

// ─── Spatial Queries ─────────────────────────────────────────

/** Check whether two AABBs overlap. */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** Check whether a point is inside an AABB. */
export function pointInBounds(point: Point, bounds: Bounds): boolean {
    return (
        point.x >= bounds[0] &&
        point.x <= bounds[2] &&
        point.y >= bounds[1] &&
        point.y <= bounds[3]
    );
}
