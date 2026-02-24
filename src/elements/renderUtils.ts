import type { Point, ExcalidrawElement } from './types';
import { isLinearElement } from './types';

// ─── Absolute Coordinates ────────────────────────────────────

/**
 * Get the absolute coordinate extents of an element, handling
 * negative width/height gracefully.
 * Returns [x1, y1, x2, y2] where (x1,y1) is always the top-left.
 */
export function getElementAbsoluteCoords(
    element: ExcalidrawElement,
): [number, number, number, number] {
    const { x, y, width, height } = element;

    if (isLinearElement(element) && element.points.length > 0) {
        let minX = 0;
        let minY = 0;
        let maxX = 0;
        let maxY = 0;

        for (const p of element.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }

        return [x + minX, y + minY, x + maxX, y + maxY];
    }

    return [
        Math.min(x, x + width),
        Math.min(y, y + height),
        Math.max(x, x + width),
        Math.max(y, y + height),
    ];
}

// ─── Center Point ────────────────────────────────────────────

/** Get the center of an element. */
export function getCenterPoint(element: ExcalidrawElement): Point {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    return {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
    };
}

// ─── Line / Arrow Absolute Points ────────────────────────────

/**
 * Convert the relative points of a linear element to absolute
 * screen-space coordinates.
 */
export function getLinearElementAbsolutePoints(
    element: ExcalidrawElement & { points: Point[] },
): Point[] {
    return element.points.map((p) => ({
        x: element.x + p.x,
        y: element.y + p.y,
    }));
}

// ─── Arrowhead Geometry  ─────────────────────────────────────

/**
 * Compute the three vertices of an arrowhead triangle at `tip`,
 * pointing away from the line at `angle`.
 * Returns [left, tip, right].
 */
export function getArrowheadPoints(
    tip: Point,
    angle: number,
    length: number = 15,
    width: number = 10,
): [Point, Point, Point] {
    const halfWidth = width / 2;

    // Left barb
    const left: Point = {
        x: tip.x - length * Math.cos(angle) - halfWidth * Math.sin(angle),
        y: tip.y - length * Math.sin(angle) + halfWidth * Math.cos(angle),
    };

    // Right barb
    const right: Point = {
        x: tip.x - length * Math.cos(angle) + halfWidth * Math.sin(angle),
        y: tip.y - length * Math.sin(angle) - halfWidth * Math.cos(angle),
    };

    return [left, tip, right];
}

/**
 * Compute the angle of a line segment from `from` to `to` (in radians).
 * Useful for determining arrowhead orientation.
 */
export function getLineAngle(from: Point, to: Point): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
}
