// ─── Primitives ──────────────────────────────────────────────

export interface Point {
    x: number;
    y: number;
}

/** Point with optional pen pressure (0–1) for variable-width strokes */
export interface PressurePoint extends Point {
    pressure?: number;
}

/** Axis-aligned bounding box: [minX, minY, maxX, maxY] */
export type Bounds = [number, number, number, number];

export type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'none';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrowhead = 'arrow' | 'dot' | 'bar' | 'triangle' | null;
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';
export type RoutingMode = 'straight' | 'curve' | 'orthogonal';

export interface DropShadow {
    blur: number;
    offsetX: number;
    offsetY: number;
    color: string;
    spread?: number;
}

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

    // Grouping
    groupId?: string;

    // Interaction lock — element cannot be selected, moved, or edited when true
    locked?: boolean;

    // Visual effects
    dropShadow?: DropShadow;
    blendMode?: BlendMode;
}

// ─── Concrete Element Types ──────────────────────────────────

export interface ShapeTextFields {
    /** Optional inline text displayed inside the shape */
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    highlightColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline' | 'line-through';
}

export interface RectangleElement extends NoteboardElementBase, ShapeTextFields {
    type: 'rectangle';
    /** Border radius for rounded corners (0 = sharp) */
    borderRadius: number;
}

export interface EllipseElement extends NoteboardElementBase, ShapeTextFields {
    type: 'ellipse';
}

export interface DiamondElement extends NoteboardElementBase, ShapeTextFields {
    type: 'diamond';
}

export interface TriangleElement extends NoteboardElementBase, ShapeTextFields {
    type: 'triangle';
}

export interface LineElement extends NoteboardElementBase {
    type: 'line';
    /** Points are RELATIVE to (x, y) */
    points: Point[];
    /** Curve / routing mode */
    curveType: 'straight' | 'curve';
    routing?: RoutingMode;
    startArrowhead?: Arrowhead;
    endArrowhead?: Arrowhead;
    /** Optional midpoint label */
    label?: string;
    labelFontSize?: number;
    labelFontFamily?: string;
}

export interface ArrowElement extends NoteboardElementBase {
    type: 'arrow';
    points: Point[];
    startArrowhead: Arrowhead;
    endArrowhead: Arrowhead;
    /** Curve / routing mode */
    curveType: 'straight' | 'curve';
    routing?: RoutingMode;
    /** Optional midpoint label */
    label?: string;
    labelFontSize?: number;
    labelFontFamily?: string;
}

export interface TextElement extends NoteboardElementBase {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
    baseline: number;
    lineHeight?: number;
    highlightColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline' | 'line-through';
}

export interface DrawElement extends NoteboardElementBase {
    type: 'draw';
    /** Freehand points, RELATIVE to (x, y) */
    points: Point[];
}

export interface PenElement extends NoteboardElementBase {
    type: 'pen';
    /** Smooth pen stroke points with optional pressure, RELATIVE to (x, y) */
    points: PressurePoint[];
    /** When true, renders with multiply blend mode (highlighter effect) */
    highlighter?: boolean;
    /** Catmull-Rom tension 0–1 (0 = angular, 1 = smooth). Default 0.5 */
    tension?: number;
}

export interface ImageElement extends NoteboardElementBase {
    type: 'image';
    /** Base64 data URL of the image */
    dataUrl: string;
}

// ─── Phase 2 Element Types ────────────────────────────────────

/** Sticky-note: a colored card with auto-sizing text */
export interface StickyNoteElement extends NoteboardElementBase, ShapeTextFields {
    type: 'sticky-note';
    /** Hue key for note color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple' */
    noteColor: string;
}

/** Frame: a named container; children move with the frame */
export interface FrameElement extends NoteboardElementBase {
    type: 'frame';
    name: string;
    frameColor: string;
    showLabel: boolean;
    childIds?: string[];
}

/** Star / polygon: supports regular polygon (isStar=false) or star shapes */
export interface StarElement extends NoteboardElementBase, ShapeTextFields {
    type: 'star';
    sides: number;        // 3–12
    isStar: boolean;      // true = star, false = regular polygon
    innerRadius: number;  // 0–1 ratio (inner/outer radius, for star only)
}

/** Callout / speech bubble with a tail */
export interface CalloutElement extends NoteboardElementBase, ShapeTextFields {
    type: 'callout';
    tailDirection: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

// ─── Union ────────────────────────────────────────────────

export type NoteboardElement =
    | RectangleElement
    | EllipseElement
    | DiamondElement
    | TriangleElement
    | LineElement
    | ArrowElement
    | TextElement
    | DrawElement
    | PenElement
    | ImageElement
    | FrameElement
    | StarElement
    | StickyNoteElement
    | CalloutElement;

// ─── Helper guards ───────────────────────────────────────────

export function isLinearElement(
    el: NoteboardElement,
): el is LineElement | ArrowElement | DrawElement | PenElement {
    return el.type === 'line' || el.type === 'arrow' || el.type === 'draw' || el.type === 'pen';
}

export function isShapeElement(
    el: NoteboardElement,
): el is RectangleElement | EllipseElement | DiamondElement | TriangleElement | StarElement | StickyNoteElement | CalloutElement {
    return el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || el.type === 'triangle'
        || el.type === 'star' || el.type === 'sticky-note' || el.type === 'callout';
}

export function isTextElement(
    el: NoteboardElement,
): el is TextElement {
    return el.type === 'text';
}

export function isImageElement(
    el: NoteboardElement,
): el is ImageElement {
    return el.type === 'image';
}


/** Check if a shape element has inline text content */
export function hasShapeText(
    el: NoteboardElement,
): boolean {
    return isShapeElement(el) && !!(el as RectangleElement).text;
}

/** Check if an element is locked (cannot be interacted with) */
export function isLockedElement(el: NoteboardElement): boolean {
    return el.locked === true;
}
