import { rotatePoint } from './bounds';
import { getCalloutGeometry } from './calloutGeometry';
import type { ElementBinding, NoteboardElement, Point } from './types';
import { isShapeElement } from './types';

/** Default connector attraction distance, expressed in canvas-space pixels. */
export const CONNECTOR_SNAP_DISTANCE = 20;

export interface ConnectorSnapResult {
    /** Resolved world-space point on the target's visible outline. */
    point: Point;
    /** Persistent target id and normalized, unrotated attachment point. */
    binding: ElementBinding;
    /** World/canvas-space distance from the pointer to `point`. */
    distance: number;
}

type ElementLookup = readonly NoteboardElement[] | ReadonlyMap<string, NoteboardElement>;

const EPSILON = 1e-9;
const TAU = Math.PI * 2;

const isFinitePoint = (point: Point | null | undefined): point is Point =>
    !!point && Number.isFinite(point.x) && Number.isFinite(point.y);

const pointsEqual = (left: Point, right: Point) =>
    Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON;

const getCenter = (element: NoteboardElement): Point => ({
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
});

const getBox = (element: NoteboardElement) => {
    const x1 = Math.min(element.x, element.x + element.width);
    const y1 = Math.min(element.y, element.y + element.height);
    const x2 = Math.max(element.x, element.x + element.width);
    const y2 = Math.max(element.y, element.y + element.height);
    return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
};

const toUnrotatedPoint = (element: NoteboardElement, point: Point): Point => {
    const angle = Number.isFinite(element.angle) ? element.angle : 0;
    if (angle === 0) return point;
    const center = getCenter(element);
    return rotatePoint(point.x, point.y, center.x, center.y, -angle);
};

const toWorldPoint = (element: NoteboardElement, point: Point): Point => {
    const angle = Number.isFinite(element.angle) ? element.angle : 0;
    if (angle === 0) return point;
    const center = getCenter(element);
    return rotatePoint(point.x, point.y, center.x, center.y, angle);
};

const closestPointOnSegment = (point: Point, start: Point, end: Point): Point => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= EPSILON) return { ...start };
    const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const t = Math.max(0, Math.min(1, projection));
    return { x: start.x + dx * t, y: start.y + dy * t };
};

const closestOf = (point: Point, candidates: readonly Point[]): Point | null => {
    let closest: Point | null = null;
    let closestDistanceSquared = Infinity;
    for (const candidate of candidates) {
        if (!isFinitePoint(candidate)) continue;
        const dx = candidate.x - point.x;
        const dy = candidate.y - point.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < closestDistanceSquared) {
            closest = candidate;
            closestDistanceSquared = distanceSquared;
        }
    }
    return closest;
};

const closestPointOnPolygon = (point: Point, vertices: readonly Point[]): Point | null => {
    if (vertices.length === 0) return null;
    if (vertices.length === 1) return { ...vertices[0] };
    const candidates: Point[] = [];
    for (let index = 0; index < vertices.length; index++) {
        candidates.push(closestPointOnSegment(
            point,
            vertices[index],
            vertices[(index + 1) % vertices.length],
        ));
    }
    return closestOf(point, candidates);
};

const normalizeAngle = (angle: number) => {
    const normalized = angle % TAU;
    return normalized < 0 ? normalized + TAU : normalized;
};

const closestPointOnArc = (
    point: Point,
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
): Point => {
    if (radius <= EPSILON) return { ...center };
    const pointAngle = normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x));
    const start = normalizeAngle(startAngle);
    let end = normalizeAngle(endAngle);
    if (end <= start) end += TAU;
    let candidateAngle = pointAngle;
    if (candidateAngle < start) candidateAngle += TAU;
    if (candidateAngle <= end) {
        return {
            x: center.x + Math.cos(candidateAngle) * radius,
            y: center.y + Math.sin(candidateAngle) * radius,
        };
    }
    return closestOf(point, [
        {
            x: center.x + Math.cos(start) * radius,
            y: center.y + Math.sin(start) * radius,
        },
        {
            x: center.x + Math.cos(end) * radius,
            y: center.y + Math.sin(end) * radius,
        },
    ])!;
};

const closestPointOnRoundedRectangle = (
    point: Point,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    requestedRadius: number,
): Point => {
    const width = x2 - x1;
    const height = y2 - y1;
    if (width <= EPSILON && height <= EPSILON) return { x: x1, y: y1 };
    if (width <= EPSILON) return closestPointOnSegment(point, { x: x1, y: y1 }, { x: x1, y: y2 });
    if (height <= EPSILON) return closestPointOnSegment(point, { x: x1, y: y1 }, { x: x2, y: y1 });

    const radius = Math.max(0, Math.min(requestedRadius, width / 2, height / 2));
    if (radius <= EPSILON) {
        return closestPointOnPolygon(point, [
            { x: x1, y: y1 }, { x: x2, y: y1 },
            { x: x2, y: y2 }, { x: x1, y: y2 },
        ])!;
    }

    const candidates = [
        closestPointOnSegment(point, { x: x1 + radius, y: y1 }, { x: x2 - radius, y: y1 }),
        closestPointOnSegment(point, { x: x2, y: y1 + radius }, { x: x2, y: y2 - radius }),
        closestPointOnSegment(point, { x: x2 - radius, y: y2 }, { x: x1 + radius, y: y2 }),
        closestPointOnSegment(point, { x: x1, y: y2 - radius }, { x: x1, y: y1 + radius }),
        closestPointOnArc(point, { x: x2 - radius, y: y1 + radius }, radius, -Math.PI / 2, 0),
        closestPointOnArc(point, { x: x2 - radius, y: y2 - radius }, radius, 0, Math.PI / 2),
        closestPointOnArc(point, { x: x1 + radius, y: y2 - radius }, radius, Math.PI / 2, Math.PI),
        closestPointOnArc(point, { x: x1 + radius, y: y1 + radius }, radius, Math.PI, Math.PI * 1.5),
    ];
    return closestOf(point, candidates)!;
};

const ellipseDistanceSquared = (
    angle: number,
    point: Point,
    center: Point,
    radiusX: number,
    radiusY: number,
) => {
    const dx = center.x + radiusX * Math.cos(angle) - point.x;
    const dy = center.y + radiusY * Math.sin(angle) - point.y;
    return dx * dx + dy * dy;
};

/**
 * Finds the Euclidean-nearest ellipse point. A coarse pass locates the correct
 * basin, then golden-section refinement avoids the radial-projection error that
 * is especially visible on narrow ellipses.
 */
const closestPointOnEllipse = (
    point: Point,
    center: Point,
    radiusX: number,
    radiusY: number,
): Point => {
    if (radiusX <= EPSILON && radiusY <= EPSILON) return { ...center };
    if (radiusX <= EPSILON) {
        return closestPointOnSegment(
            point,
            { x: center.x, y: center.y - radiusY },
            { x: center.x, y: center.y + radiusY },
        );
    }
    if (radiusY <= EPSILON) {
        return closestPointOnSegment(
            point,
            { x: center.x - radiusX, y: center.y },
            { x: center.x + radiusX, y: center.y },
        );
    }

    const sampleCount = 72;
    const sampleStep = TAU / sampleCount;
    let bestAngle = 0;
    let bestDistanceSquared = Infinity;
    for (let index = 0; index < sampleCount; index++) {
        const angle = index * sampleStep;
        const distanceSquared = ellipseDistanceSquared(angle, point, center, radiusX, radiusY);
        if (distanceSquared < bestDistanceSquared) {
            bestAngle = angle;
            bestDistanceSquared = distanceSquared;
        }
    }

    let low = bestAngle - sampleStep;
    let high = bestAngle + sampleStep;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let left = high - (high - low) * ratio;
    let right = low + (high - low) * ratio;
    let leftDistance = ellipseDistanceSquared(left, point, center, radiusX, radiusY);
    let rightDistance = ellipseDistanceSquared(right, point, center, radiusX, radiusY);
    for (let iteration = 0; iteration < 32; iteration++) {
        if (leftDistance <= rightDistance) {
            high = right;
            right = left;
            rightDistance = leftDistance;
            left = high - (high - low) * ratio;
            leftDistance = ellipseDistanceSquared(left, point, center, radiusX, radiusY);
        } else {
            low = left;
            left = right;
            leftDistance = rightDistance;
            right = low + (high - low) * ratio;
            rightDistance = ellipseDistanceSquared(right, point, center, radiusX, radiusY);
        }
    }
    const angle = (low + high) / 2;
    return {
        x: center.x + radiusX * Math.cos(angle),
        y: center.y + radiusY * Math.sin(angle),
    };
};

const buildStarPoints = (element: NoteboardElement): Point[] => {
    if (element.type !== 'star') return [];
    const center = getCenter(element);
    const outerRadius = Math.min(Math.abs(element.width), Math.abs(element.height)) / 2;
    const sides = Math.max(3, Math.floor(element.sides ?? 5));
    const isStar = element.isStar ?? true;
    const innerRadius = Number.isFinite(element.innerRadius) ? element.innerRadius : 0.4;
    const count = isStar ? sides * 2 : sides;
    const points: Point[] = [];
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * TAU - Math.PI / 2;
        const radius = isStar && index % 2 === 1 ? outerRadius * innerRadius : outerRadius;
        points.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
        });
    }
    return points;
};

const closestUnrotatedOutlinePoint = (element: NoteboardElement, point: Point): Point | null => {
    if (!isShapeElement(element)) return null;
    const box = getBox(element);
    const center = getCenter(element);

    switch (element.type) {
        case 'rectangle':
            return closestPointOnRoundedRectangle(
                point,
                box.x1,
                box.y1,
                box.x2,
                box.y2,
                element.borderRadius ?? 0,
            );
        case 'ellipse':
            return closestPointOnEllipse(point, center, box.width / 2, box.height / 2);
        case 'diamond':
            return closestPointOnPolygon(point, [
                { x: center.x, y: box.y1 },
                { x: box.x2, y: center.y },
                { x: center.x, y: box.y2 },
                { x: box.x1, y: center.y },
            ]);
        case 'triangle':
            return closestPointOnPolygon(point, [
                { x: center.x, y: box.y1 },
                { x: box.x2, y: box.y2 },
                { x: box.x1, y: box.y2 },
            ]);
        case 'star':
            return closestPointOnPolygon(point, buildStarPoints(element));
        case 'sticky-note': {
            const fold = Math.min(16, box.width * 0.12, box.height * 0.12);
            return closestPointOnPolygon(point, [
                { x: box.x1, y: box.y1 },
                { x: box.x2 - fold, y: box.y1 },
                { x: box.x2, y: box.y1 + fold },
                { x: box.x2, y: box.y2 },
                { x: box.x1, y: box.y2 },
            ]);
        }
        case 'callout': {
            const { body, tail } = getCalloutGeometry(element);
            const bodyPoint = closestPointOnRoundedRectangle(
                point,
                body.x,
                body.y,
                body.x + body.width,
                body.y + body.height,
                body.radius,
            );
            const tailPoint = closestPointOnPolygon(point, tail);
            return closestOf(point, tailPoint ? [bodyPoint, tailPoint] : [bodyPoint]);
        }
    }
};

/** Returns the nearest world-space point on a shape's rendered outline. */
export function getClosestPointOnShapeOutline(
    element: NoteboardElement,
    point: Point,
): Point | null {
    if (element.isDeleted || !isShapeElement(element) || !isFinitePoint(point)) return null;
    if (![element.x, element.y, element.width, element.height].every(Number.isFinite)) return null;
    const unrotatedPoint = toUnrotatedPoint(element, point);
    const outlinePoint = closestUnrotatedOutlinePoint(element, unrotatedPoint);
    return outlinePoint ? toWorldPoint(element, outlinePoint) : null;
}

const fixedPointFor = (element: NoteboardElement, worldPoint: Point): Point => {
    const localPoint = toUnrotatedPoint(element, worldPoint);
    return {
        x: Math.abs(element.width) > EPSILON
            ? (localPoint.x - element.x) / element.width
            : 0.5,
        y: Math.abs(element.height) > EPSILON
            ? (localPoint.y - element.y) / element.height
            : 0.5,
    };
};

const pointFromFixedPoint = (element: NoteboardElement, fixedPoint: Point): Point => {
    return {
        x: element.x + fixedPoint.x * element.width,
        y: element.y + fixedPoint.y * element.height,
    };
};

const getElement = (lookup: ElementLookup, id: string): NoteboardElement | undefined => {
    const mapLookup = lookup as ReadonlyMap<string, NoteboardElement>;
    if (typeof mapLookup.get === 'function') return mapLookup.get(id);
    return (lookup as readonly NoteboardElement[]).find((element) => element.id === id);
};

/**
 * Finds the closest bindable outline within `maxDistance`. The distance is in
 * canvas coordinates; callers that want a constant screen-space radius should
 * divide that radius by the current zoom.
 */
export function findBinding(
    point: Point,
    elements: readonly NoteboardElement[],
    maxDistance: number = CONNECTOR_SNAP_DISTANCE,
    excludeId?: string,
): ConnectorSnapResult | null {
    if (!isFinitePoint(point) || !Number.isFinite(maxDistance) || maxDistance < 0) return null;
    let best: ConnectorSnapResult | null = null;

    // Later elements are visually on top and win exact-distance ties.
    for (let index = elements.length - 1; index >= 0; index--) {
        const element = elements[index];
        if (!element || element.id === excludeId || element.isDeleted || !isShapeElement(element)) continue;
        const outlinePoint = getClosestPointOnShapeOutline(element, point);
        if (!outlinePoint) continue;
        const distance = Math.hypot(point.x - outlinePoint.x, point.y - outlinePoint.y);
        if (distance > maxDistance || (best && distance >= best.distance)) continue;
        best = {
            point: outlinePoint,
            distance,
            binding: {
                elementId: element.id,
                fixedPoint: fixedPointFor(element, outlinePoint),
            },
        };
    }
    return best;
}

/** Resolves a stored binding against the target's current size and rotation. */
export function resolveBinding(
    binding: ElementBinding | null | undefined,
    elements: ElementLookup,
): Point | null {
    if (!binding || typeof binding.elementId !== 'string' || !isFinitePoint(binding.fixedPoint)) return null;
    const target = getElement(elements, binding.elementId);
    if (!target || target.isDeleted || !isShapeElement(target)) return null;
    if (![target.x, target.y, target.width, target.height].every(Number.isFinite)) return null;
    const hint = pointFromFixedPoint(target, binding.fixedPoint);
    const outlinePoint = closestUnrotatedOutlinePoint(target, hint);
    return outlinePoint ? toWorldPoint(target, outlinePoint) : null;
}

const getRenderedLinearPoints = (
    element: Extract<NoteboardElement, { type: 'line' | 'arrow' }>,
): Point[] => {
    const points = element.points.map((point) => ({ x: element.x + point.x, y: element.y + point.y }));
    const angle = Number.isFinite(element.angle) ? element.angle : 0;
    if (angle === 0) return points;
    const center = getCenter(element);
    return points.map((point) => rotatePoint(point.x, point.y, center.x, center.y, angle));
};

const updateBoundElement = (
    element: NoteboardElement,
    lookup: ReadonlyMap<string, NoteboardElement>,
): NoteboardElement => {
    if (element.type !== 'line' && element.type !== 'arrow') return element;
    const startBinding = element.startBinding ?? null;
    const endBinding = element.endBinding ?? null;
    if (!startBinding && !endBinding) return element;

    const resolvedStart = startBinding ? resolveBinding(startBinding, lookup) : null;
    const resolvedEnd = endBinding ? resolveBinding(endBinding, lookup) : null;
    const nextStartBinding = startBinding && resolvedStart ? startBinding : null;
    const nextEndBinding = endBinding && resolvedEnd ? endBinding : null;
    const bindingChanged = nextStartBinding !== startBinding || nextEndBinding !== endBinding;

    if (element.points.length === 0) {
        if (!bindingChanged) return element;
        return { ...element, startBinding: nextStartBinding, endBinding: nextEndBinding };
    }

    const renderedPoints = getRenderedLinearPoints(element);
    if (renderedPoints.length === 1) {
        const currentPoint = renderedPoints[0];
        if (resolvedStart && resolvedEnd && !pointsEqual(resolvedStart, resolvedEnd)) {
            return {
                ...element,
                x: resolvedStart.x,
                y: resolvedStart.y,
                width: resolvedEnd.x - resolvedStart.x,
                height: resolvedEnd.y - resolvedStart.y,
                angle: 0,
                points: [
                    { x: 0, y: 0 },
                    { x: resolvedEnd.x - resolvedStart.x, y: resolvedEnd.y - resolvedStart.y },
                ],
                startBinding: nextStartBinding,
                endBinding: nextEndBinding,
            };
        }
        const desiredPoint = resolvedStart ?? resolvedEnd ?? currentPoint;
        const geometryChanged = !pointsEqual(currentPoint, desiredPoint);
        if (!geometryChanged && !bindingChanged) return element;
        return {
            ...element,
            ...(geometryChanged ? {
                x: desiredPoint.x,
                y: desiredPoint.y,
                width: 0,
                height: 0,
                angle: 0,
                points: [{ x: 0, y: 0 }],
            } : {}),
            startBinding: nextStartBinding,
            endBinding: nextEndBinding,
        };
    }

    const lastIndex = renderedPoints.length - 1;
    const currentStart = renderedPoints[0];
    const currentEnd = renderedPoints[lastIndex];
    const desiredStart = resolvedStart ?? currentStart;
    const desiredEnd = resolvedEnd ?? currentEnd;
    const geometryChanged =
        (resolvedStart !== null && !pointsEqual(currentStart, desiredStart)) ||
        (resolvedEnd !== null && !pointsEqual(currentEnd, desiredEnd));

    if (!geometryChanged) {
        if (!bindingChanged) return element;
        return { ...element, startBinding: nextStartBinding, endBinding: nextEndBinding };
    }

    renderedPoints[0] = desiredStart;
    renderedPoints[lastIndex] = desiredEnd;
    const origin = renderedPoints[0];
    const nextPoints = renderedPoints.map((point) => ({
        x: point.x - origin.x,
        y: point.y - origin.y,
    }));
    const end = renderedPoints[lastIndex];
    return {
        ...element,
        x: origin.x,
        y: origin.y,
        width: end.x - origin.x,
        height: end.y - origin.y,
        angle: 0,
        points: nextPoints,
        startBinding: nextStartBinding,
        endBinding: nextEndBinding,
    };
};

/**
 * Re-resolves all bound line/arrow endpoints after shape mutations. Orphaned
 * references are cleared. The original array and element identities are kept
 * when no binding or endpoint actually changes.
 */
export function updateBoundElements(elements: NoteboardElement[]): NoteboardElement[] {
    const lookup = new Map(elements.map((element) => [element.id, element]));
    let updated: NoteboardElement[] | null = null;
    for (let index = 0; index < elements.length; index++) {
        const current = elements[index];
        const next = updateBoundElement(current, lookup);
        if (next === current) continue;
        if (!updated) updated = elements.slice();
        updated[index] = next;
    }
    return updated ?? elements;
}
