import type {
    NoteboardElementBase,
    RectangleElement,
    EllipseElement,
    DiamondElement,
    TriangleElement,
    LineElement,
    ArrowElement,
    TextElement,
    DrawElement,
    PenElement,
    ImageElement,
    StickyNoteElement,
    FrameElement,
    StarElement,
    CalloutElement,
    NoteboardElement,
} from './types';
import {
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FAMILY,
    DEFAULT_STROKE_COLOR,
} from '../constants';

// ─── ID Generation ───────────────────────────────────────────

let counter = 0;

export function generateId(): string {
    return `${Date.now().toString(36)}_${(counter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Defaults ────────────────────────────────────────────────

function baseDefaults(overrides: Partial<NoteboardElementBase> = {}): NoteboardElementBase {
    return {
        id: generateId(),
        type: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        angle: 0,
        strokeColor: DEFAULT_STROKE_COLOR,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 100,
        roughness: 0,
        seed: Math.floor(Math.random() * 2_000_000_000),
        isDeleted: false,
        ...overrides,
    };
}

// ─── Per-type Creators ───────────────────────────────────────
// NOTE: `baseDefaults` already spreads `overrides` for base fields.
// Each creator only sets type-specific defaults — no second `...overrides` spread
// to avoid the double-spread bug where overrides could silently overwrite `type`.

export function createRectangleElement(
    overrides: Partial<RectangleElement> = {},
): RectangleElement {
    return {
        ...baseDefaults(overrides),
        type: 'rectangle',
        borderRadius: overrides.borderRadius ?? 0,
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
    } as RectangleElement;
}

export function createEllipseElement(
    overrides: Partial<EllipseElement> = {},
): EllipseElement {
    return {
        ...baseDefaults(overrides),
        type: 'ellipse',
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
    } as EllipseElement;
}

export function createDiamondElement(
    overrides: Partial<DiamondElement> = {},
): DiamondElement {
    return {
        ...baseDefaults(overrides),
        type: 'diamond',
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
    } as DiamondElement;
}

export function createTriangleElement(
    overrides: Partial<TriangleElement> = {},
): TriangleElement {
    return {
        ...baseDefaults(overrides),
        type: 'triangle',
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
    } as TriangleElement;
}

export function createLineElement(
    overrides: Partial<LineElement> = {},
): LineElement {
    return {
        ...baseDefaults(overrides),
        type: 'line',
        points: overrides.points ?? [],
        curveType: overrides.curveType ?? 'straight',
    } as LineElement;
}

export function createArrowElement(
    overrides: Partial<ArrowElement> = {},
): ArrowElement {
    return {
        ...baseDefaults(overrides),
        type: 'arrow',
        points: overrides.points ?? [],
        startArrowhead: overrides.startArrowhead ?? null,
        endArrowhead: overrides.endArrowhead ?? 'arrow',
        curveType: overrides.curveType ?? 'straight',
    } as ArrowElement;
}

export function createTextElement(
    overrides: Partial<TextElement> = {},
): TextElement {
    return {
        ...baseDefaults(overrides),
        type: 'text',
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'left',
        baseline: overrides.baseline ?? 18,
    } as TextElement;
}

export function createDrawElement(
    overrides: Partial<DrawElement> = {},
): DrawElement {
    return {
        ...baseDefaults(overrides),
        type: 'draw',
        points: overrides.points ?? [],
    } as DrawElement;
}

export function createPenElement(
    overrides: Partial<PenElement> = {},
): PenElement {
    return {
        ...baseDefaults(overrides),
        type: 'pen',
        points: overrides.points ?? [],
    } as PenElement;
}
// ─── Image ───────────────────────────────────────────────────

export function createImageElement(
    overrides: Partial<ImageElement> = {},
): ImageElement {
    return {
        ...baseDefaults(overrides),
        type: 'image',
        dataUrl: overrides.dataUrl ?? '',
    } as ImageElement;
}

// ─── Phase 2 Creators ─────────────────────────────────────────────

export function createStickyNoteElement(
    overrides: Partial<StickyNoteElement> = {},
): StickyNoteElement {
    return {
        ...baseDefaults(overrides),
        type: 'sticky-note',
        noteColor: overrides.noteColor ?? 'yellow',
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
        backgroundColor: overrides.backgroundColor ?? '#ffd60a',
        strokeColor: overrides.strokeColor ?? '#a08c00',
        strokeWidth: overrides.strokeWidth ?? 1,
        roughness: overrides.roughness ?? 0,
    } as StickyNoteElement;
}

export function createFrameElement(
    overrides: Partial<FrameElement> = {},
): FrameElement {
    return {
        ...baseDefaults(overrides),
        type: 'frame',
        name: overrides.name ?? 'Frame',
        frameColor: overrides.frameColor ?? '#4A90D9',
        showLabel: overrides.showLabel ?? true,
        childIds: overrides.childIds ?? [],
        backgroundColor: overrides.backgroundColor ?? 'transparent',
        strokeColor: overrides.strokeColor ?? '#4A90D9',
        strokeWidth: overrides.strokeWidth ?? 1,
        roughness: overrides.roughness ?? 0,
    } as FrameElement;
}

export function createStarElement(
    overrides: Partial<StarElement> = {},
): StarElement {
    return {
        ...baseDefaults(overrides),
        type: 'star',
        sides: overrides.sides ?? 5,
        isStar: overrides.isStar ?? true,
        innerRadius: overrides.innerRadius ?? 0.4,
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
    } as StarElement;
}

export function createCalloutElement(
    overrides: Partial<CalloutElement> = {},
): CalloutElement {
    return {
        ...baseDefaults(overrides),
        type: 'callout',
        tailDirection: overrides.tailDirection ?? 'bottom-left',
        text: overrides.text ?? '',
        fontSize: overrides.fontSize ?? DEFAULT_FONT_SIZE,
        fontFamily: overrides.fontFamily ?? DEFAULT_FONT_FAMILY,
        textAlign: overrides.textAlign ?? 'center',
    } as CalloutElement;
}


export function createElement(
    type: NoteboardElement['type'],
    overrides: Partial<NoteboardElement> = {},
): NoteboardElement {
    switch (type) {
        case 'rectangle':
            return createRectangleElement(overrides as Partial<RectangleElement>);
        case 'ellipse':
            return createEllipseElement(overrides as Partial<EllipseElement>);
        case 'diamond':
            return createDiamondElement(overrides as Partial<DiamondElement>);
        case 'triangle':
            return createTriangleElement(overrides as Partial<TriangleElement>);
        case 'line':
            return createLineElement(overrides as Partial<LineElement>);
        case 'arrow':
            return createArrowElement(overrides as Partial<ArrowElement>);
        case 'text':
            return createTextElement(overrides as Partial<TextElement>);
        case 'draw':
            return createDrawElement(overrides as Partial<DrawElement>);
        case 'pen':
            return createPenElement(overrides as Partial<PenElement>);
        case 'image':
            return createImageElement(overrides as Partial<ImageElement>);
        case 'frame':
            return createFrameElement(overrides as Partial<FrameElement>);
        case 'star':
            return createStarElement(overrides as Partial<StarElement>);
        default:
            throw new Error(`Unknown element type: ${type}`);
    }
}
