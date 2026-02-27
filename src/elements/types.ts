// ─── Primitives ──────────────────────────────────────────────

export interface Point {
    x: number;
    y: number;
}

/** Axis-aligned bounding box: [minX, minY, maxX, maxY] */
export type Bounds = [number, number, number, number];

export type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'none';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrowhead = 'arrow' | 'dot' | 'bar' | 'triangle' | null;

// ─── Base Element ────────────────────────────────────────────

export interface NoteboardElementBase {
    id: string;
    type: string;

    // Position & dimensions
    x: number;
    y: number;
    width: number;
    height: number;

    // Transform
    angle: number;

    // Style
    strokeColor: string;
    backgroundColor: string;
    fillStyle: FillStyle;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    opacity: number;
    roughness: number;

    // Rendering seed (for rough.js-style deterministic drawing)
    seed: number;

    // Soft-delete flag
    isDeleted: boolean;
}

// ─── Concrete Element Types ──────────────────────────────────

export interface RectangleElement extends NoteboardElementBase {
    type: 'rectangle';
}

export interface EllipseElement extends NoteboardElementBase {
    type: 'ellipse';
}

export interface DiamondElement extends NoteboardElementBase {
    type: 'diamond';
}

export interface TriangleElement extends NoteboardElementBase {
    type: 'triangle';
}

export interface LineElement extends NoteboardElementBase {
    type: 'line';
    /** Points are RELATIVE to (x, y) */
    points: Point[];
}

export interface ArrowElement extends NoteboardElementBase {
    type: 'arrow';
    points: Point[];
    startArrowhead: Arrowhead;
    endArrowhead: Arrowhead;
}

export interface TextElement extends NoteboardElementBase {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
    baseline: number;
}

export interface DrawElement extends NoteboardElementBase {
    type: 'draw';
    /** Freehand points, RELATIVE to (x, y) */
    points: Point[];
}

export interface PenElement extends NoteboardElementBase {
    type: 'pen';
    /** Smooth pen stroke points, RELATIVE to (x, y) */
    points: Point[];
}

// ─── Union ───────────────────────────────────────────────────

export type ExcalidrawElement =
    | RectangleElement
    | EllipseElement
    | DiamondElement
    | TriangleElement
    | LineElement
    | ArrowElement
    | TextElement
    | DrawElement
    | PenElement;

// ─── Helper guards ───────────────────────────────────────────

export function isLinearElement(
    el: ExcalidrawElement,
): el is LineElement | ArrowElement | DrawElement | PenElement {
    return el.type === 'line' || el.type === 'arrow' || el.type === 'draw' || el.type === 'pen';
}

export function isShapeElement(
    el: ExcalidrawElement,
): el is RectangleElement | EllipseElement | DiamondElement | TriangleElement {
    return el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || el.type === 'triangle';
}
