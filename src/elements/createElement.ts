import type {
    NoteboardElementBase,
    RectangleElement,
    LineElement,
    ArrowElement,
    TextElement,
    DrawElement,
    PenElement,
    ExcalidrawElement,
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
        roughness: 1,
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
    } as RectangleElement;
}

export function createLineElement(
    overrides: Partial<LineElement> = {},
): LineElement {
    return {
        ...baseDefaults(overrides),
        type: 'line',
        points: overrides.points ?? [],
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

// ─── Generic Dispatcher ──────────────────────────────────────

export function createElement(
    type: ExcalidrawElement['type'],
    overrides: Partial<ExcalidrawElement> = {},
): ExcalidrawElement {
    switch (type) {
        case 'rectangle':
            return createRectangleElement(overrides as Partial<RectangleElement>);
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
        default:
            throw new Error(`Unknown element type: ${type}`);
    }
}
