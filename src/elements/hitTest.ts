import type { Point, NoteboardElement } from './types';
import { rotatePoint, getElementBounds } from './bounds';
import { getCalloutGeometry } from './calloutGeometry';

// ─── Geometry Helpers ────────────────────────────────────────

/** Shortest distance from point P to the line segment AB. */
export function distanceToLineSegment(
    p: Point,
    a: Point,
    b: Point,
): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        // Segment is a point
        return Math.hypot(p.x - a.x, p.y - a.y);
    }

    // Parameter t clamped to [0,1]
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
}

// ─── Per-type Hit Tests ──────────────────────────────────────

function hitTestRectangle(
    point: Point,
    element: NoteboardElement,
    threshold: number,
): boolean {
    const { x, y, width, height, angle } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Un-rotate the test point so we can do axis-aligned checks
    const rp = angle !== 0
        ? rotatePoint(point.x, point.y, cx, cy, -angle)
        : point;

    const x1 = Math.min(x, x + width);
    const y1 = Math.min(y, y + height);
    const x2 = Math.max(x, x + width);
    const y2 = Math.max(y, y + height);

    // Check if point is inside (filled) or near edge (stroke)
    const inside =
        rp.x >= x1 - threshold &&
        rp.x <= x2 + threshold &&
        rp.y >= y1 - threshold &&
        rp.y <= y2 + threshold;

    return inside;
}

function hitTestEllipse(
    point: Point,
    element: NoteboardElement,
    threshold: number,
): boolean {
    const { x, y, width, height, angle } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const rp = angle !== 0
        ? rotatePoint(point.x, point.y, cx, cy, -angle)
        : point;

    const rx = Math.abs(width / 2) + threshold;
    const ry = Math.abs(height / 2) + threshold;
    if (rx === 0 || ry === 0) return false;

    const dx = rp.x - cx;
    const dy = rp.y - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

/** Test if point is inside a convex polygon using cross-product winding. */
function pointInPolygon(p: Point, vertices: Point[]): boolean {
    const n = vertices.length;
    let positive = 0;
    let negative = 0;
    for (let i = 0; i < n; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        if (cross > 0) positive++;
        else if (cross < 0) negative++;
        if (positive > 0 && negative > 0) return false;
    }
    return true;
}

function hitTestDiamond(
    point: Point,
    element: NoteboardElement,
    threshold: number,
): boolean {
    const { x, y, width, height, angle } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const rp = angle !== 0
        ? rotatePoint(point.x, point.y, cx, cy, -angle)
        : point;

    const hw = Math.abs(width / 2) + threshold;
    const hh = Math.abs(height / 2) + threshold;

    const verts: Point[] = [
        { x: cx, y: cy - hh },
        { x: cx + hw, y: cy },
        { x: cx, y: cy + hh },
        { x: cx - hw, y: cy },
    ];
    return pointInPolygon(rp, verts);
}

function hitTestTriangle(
    point: Point,
    element: NoteboardElement,
    threshold: number,
): boolean {
    const { x, y, width, height, angle } = element;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const rp = angle !== 0
        ? rotatePoint(point.x, point.y, cx, cy, -angle)
        : point;

    const x1 = Math.min(x, x + width) - threshold;
    const y1 = Math.min(y, y + height) - threshold;
    const x2 = Math.max(x, x + width) + threshold;
    const y2 = Math.max(y, y + height) + threshold;
    const topCx = (x1 + x2) / 2;

    const verts: Point[] = [
        { x: topCx, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
    ];
    return pointInPolygon(rp, verts);
}

function hitTestCallout(
    point: Point,
    element: Extract<NoteboardElement, { type: 'callout' }>,
    threshold: number,
): boolean {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const rp = element.angle !== 0
        ? rotatePoint(point.x, point.y, cx, cy, -element.angle)
        : point;
    const { body, tail } = getCalloutGeometry(element);
    const tolerance = Math.max(0, threshold);

    if (
        rp.x >= body.x - tolerance &&
        rp.x <= body.x + body.width + tolerance &&
        rp.y >= body.y - tolerance &&
        rp.y <= body.y + body.height + tolerance
    ) {
        return true;
    }

    const tailPoints = [...tail];
    if (pointInPolygon(rp, tailPoints)) return true;
    for (let index = 0; index < tailPoints.length; index++) {
        if (distanceToLineSegment(
            rp,
            tailPoints[index],
            tailPoints[(index + 1) % tailPoints.length],
        ) <= tolerance) {
            return true;
        }
    }
    return false;
}

function hitTestLinear(
    point: Point,
    element: NoteboardElement & { points: Point[] },
    threshold: number,
): boolean {
    const { x, y, angle } = element;
    const cx = x + element.width / 2;
    const cy = y + element.height / 2;

    // Un-rotate the test point
    const rp = angle !== 0
        ? rotatePoint(point.x, point.y, cx, cy, -angle)
        : point;

    const pts = element.points;
    if (pts.length < 2) {
        // Single point — check distance to that point
        if (pts.length === 1) {
            return Math.hypot(rp.x - (x + pts[0].x), rp.y - (y + pts[0].y)) <= threshold;
        }
        return false;
    }

    for (let i = 0; i < pts.length - 1; i++) {
        const a: Point = { x: x + pts[i].x, y: y + pts[i].y };
        const b: Point = { x: x + pts[i + 1].x, y: y + pts[i + 1].y };
        if (distanceToLineSegment(rp, a, b) <= threshold) {
            return true;
        }
    }

    return false;
}

function hitTestText(
    point: Point,
    element: NoteboardElement,
    threshold: number,
): boolean {
    // For text we use the bounding box expanded by threshold
    const bounds = getElementBounds(element);
    return (
        point.x >= bounds[0] - threshold &&
        point.x <= bounds[2] + threshold &&
        point.y >= bounds[1] - threshold &&
        point.y <= bounds[3] + threshold
    );
}

// ─── Main Dispatcher ─────────────────────────────────────────

/**
 * Test whether a screen-space `point` hits `element`.
 * `threshold` is the pixel tolerance (typically half of strokeWidth + 4–10px).
 */
export function hitTestElement(
    point: Point,
    element: NoteboardElement,
    threshold: number = 10,
): boolean {
    if (element.isDeleted) return false;

    switch (element.type) {
        case 'rectangle':
            return hitTestRectangle(point, element, threshold);
        case 'ellipse':
            return hitTestEllipse(point, element, threshold);
        case 'diamond':
            return hitTestDiamond(point, element, threshold);
        case 'triangle':
            return hitTestTriangle(point, element, threshold);
        case 'line':
        case 'arrow':
        case 'draw':
        case 'pen':
            return hitTestLinear(
                point,
                element as NoteboardElement & { points: Point[] },
                threshold,
            );
        case 'text':
            return hitTestText(point, element, threshold);
        case 'image':
        case 'sticky-note':
        case 'frame':
            return hitTestRectangle(point, element, threshold);
        case 'callout':
            return hitTestCallout(point, element, threshold);
        case 'star': {
            // Use bounding box hit test for star (polygon internals are complex)
            return hitTestRectangle(point, element, threshold);
        }
        default:
            return false;
    }
}

// ─── Multi-element Selection ─────────────────────────────────

/**
 * Return all elements whose bounding boxes overlap the given
 * selection rectangle (marquee selection).
 */
export function getElementsInBounds(
    elements: readonly NoteboardElement[],
    selectionBounds: [number, number, number, number],
    threshold: number = 0,
): NoteboardElement[] {
    const [sx1, sy1, sx2, sy2] = selectionBounds;
    const normalized: [number, number, number, number] = [
        Math.min(sx1, sx2) - threshold,
        Math.min(sy1, sy2) - threshold,
        Math.max(sx1, sx2) + threshold,
        Math.max(sy1, sy2) + threshold,
    ];

    return elements.filter((el) => {
        if (el.isDeleted) return false;
        const bounds = getElementBounds(el);
        // Check overlap
        return (
            bounds[0] <= normalized[2] &&
            bounds[2] >= normalized[0] &&
            bounds[1] <= normalized[3] &&
            bounds[3] >= normalized[1]
        );
    });
}
