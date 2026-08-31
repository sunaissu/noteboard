import type { NoteboardElement } from './elements/types';
import { createElement } from './elements/createElement';
import { MAX_ZOOM, MIN_ZOOM } from './constants';

export const MAX_BOARD_IMPORT_BYTES = 16 * 1024 * 1024;
export const MAX_BOARD_ELEMENTS = 10_000;
const MAX_ELEMENT_POINTS = 100_000;
const MAX_ABSOLUTE_COORDINATE = 1_000_000_000;
const MAX_IMAGE_DATA_URL_LENGTH = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1_000_000;
const MAX_STYLE_STRING_LENGTH = 1_024;
const MAX_ELEMENT_SEED = 2_147_483_647;
const ELEMENT_TYPES = new Set<NoteboardElement['type']>([
    'rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow',
    'text', 'draw', 'pen', 'image', 'frame', 'star', 'sticky-note', 'callout',
]);
const FILL_STYLES = new Set(['solid', 'hachure', 'cross-hatch', 'none']);
const STROKE_STYLES = new Set(['solid', 'dashed', 'dotted']);
const BLEND_MODES = new Set(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']);
const TEXT_ALIGNMENTS = new Set(['left', 'center', 'right']);
const FONT_WEIGHTS = new Set(['normal', 'bold']);
const FONT_STYLES = new Set(['normal', 'italic']);
const TEXT_DECORATIONS = new Set(['none', 'underline', 'line-through']);
const CURVE_TYPES = new Set(['straight', 'curve']);
const ROUTING_MODES = new Set(['straight', 'curve', 'orthogonal']);
const ARROWHEADS = new Set<unknown>([null, 'arrow', 'dot', 'bar', 'triangle']);
const CALLOUT_DIRECTIONS = new Set(['bottom-left', 'bottom-right', 'top-left', 'top-right']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isSafeNumber = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
    && Math.abs(value) <= MAX_ABSOLUTE_COORDINATE
);

const isBoundedNumber = (value: unknown, minimum: number, maximum: number): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum
);

const isOptionalString = (value: unknown, maximum = MAX_STYLE_STRING_LENGTH) => (
    value === undefined || (typeof value === 'string' && value.length <= maximum)
);

const isOptionalEnum = (value: unknown, allowed: ReadonlySet<unknown>) => (
    value === undefined || allowed.has(value)
);

const isSafePoint = (value: unknown) => (
    isRecord(value)
    && isSafeNumber(value.x)
    && isSafeNumber(value.y)
    && (value.pressure === undefined
        || (typeof value.pressure === 'number'
            && Number.isFinite(value.pressure)
            && value.pressure >= 0
            && value.pressure <= 1))
);

const isSafeBinding = (value: unknown) => (
    value === undefined
    || value === null
    || (isRecord(value)
        && typeof value.elementId === 'string'
        && value.elementId.length > 0
        && value.elementId.length <= 256
        && isSafePoint(value.fixedPoint))
);

const validateTextStyleFields = (value: Record<string, unknown>, index: number) => {
    if (!isOptionalString(value.text, MAX_TEXT_LENGTH)) {
        throw new TypeError(`Element ${index + 1} has invalid text`);
    }
    if (value.fontSize !== undefined && !isBoundedNumber(value.fontSize, 1, 10_000)) {
        throw new TypeError(`Element ${index + 1} has an invalid font size`);
    }
    if (!isOptionalString(value.fontFamily) || !isOptionalEnum(value.textAlign, TEXT_ALIGNMENTS)) {
        throw new TypeError(`Element ${index + 1} has invalid text styling`);
    }
    if (value.lineHeight !== undefined && !isBoundedNumber(value.lineHeight, 0.1, 100)) {
        throw new TypeError(`Element ${index + 1} has an invalid line height`);
    }
    if (
        !isOptionalString(value.highlightColor)
        || !isOptionalEnum(value.fontWeight, FONT_WEIGHTS)
        || !isOptionalEnum(value.fontStyle, FONT_STYLES)
        || !isOptionalEnum(value.textDecoration, TEXT_DECORATIONS)
    ) {
        throw new TypeError(`Element ${index + 1} has invalid text styling`);
    }
};

const normalizeImportedElement = (value: unknown, index: number): NoteboardElement => {
    if (!isRecord(value)) throw new TypeError(`Element ${index + 1} must be an object`);
    if (typeof value.id !== 'string' || !value.id || value.id.length > 256) {
        throw new TypeError(`Element ${index + 1} has an invalid ID`);
    }
    if (typeof value.type !== 'string' || !ELEMENT_TYPES.has(value.type as NoteboardElement['type'])) {
        throw new TypeError(`Element ${index + 1} has an unsupported type`);
    }
    for (const key of ['x', 'y', 'width', 'height'] as const) {
        if (!isSafeNumber(value[key])) {
            throw new TypeError(`Element ${index + 1} has an invalid ${key}`);
        }
    }
    for (const key of ['angle', 'opacity', 'roughness', 'strokeWidth'] as const) {
        if (value[key] !== undefined && !isSafeNumber(value[key])) {
            throw new TypeError(`Element ${index + 1} has an invalid ${key}`);
        }
    }
    if (
        value.seed !== undefined
        && (!Number.isSafeInteger(value.seed) || !isBoundedNumber(value.seed, -MAX_ELEMENT_SEED, MAX_ELEMENT_SEED))
    ) {
        throw new TypeError(`Element ${index + 1} has an invalid seed`);
    }
    if (
        (value.opacity !== undefined && !isBoundedNumber(value.opacity, 0, 100))
        || (value.roughness !== undefined && !isBoundedNumber(value.roughness, 0, 100))
        || (value.strokeWidth !== undefined && !isBoundedNumber(value.strokeWidth, 0, 10_000))
    ) {
        throw new TypeError(`Element ${index + 1} has invalid rendering values`);
    }
    if (
        !isOptionalString(value.strokeColor)
        || !isOptionalString(value.backgroundColor)
        || !isOptionalEnum(value.fillStyle, FILL_STYLES)
        || !isOptionalEnum(value.strokeStyle, STROKE_STYLES)
        || !isOptionalEnum(value.blendMode, BLEND_MODES)
        || !isOptionalString(value.groupId, 256)
    ) {
        throw new TypeError(`Element ${index + 1} has invalid styling`);
    }
    if (value.dropShadow !== undefined) {
        const shadow = value.dropShadow;
        if (
            !isRecord(shadow)
            || !isBoundedNumber(shadow.blur, 0, 10_000)
            || !isSafeNumber(shadow.offsetX)
            || !isSafeNumber(shadow.offsetY)
            || !isOptionalString(shadow.color)
            || typeof shadow.color !== 'string'
            || (shadow.spread !== undefined && !isSafeNumber(shadow.spread))
        ) {
            throw new TypeError(`Element ${index + 1} has an invalid drop shadow`);
        }
    }
    if (value.isDeleted !== undefined && typeof value.isDeleted !== 'boolean') {
        throw new TypeError(`Element ${index + 1} has an invalid deletion flag`);
    }
    if (value.locked !== undefined && typeof value.locked !== 'boolean') {
        throw new TypeError(`Element ${index + 1} has an invalid lock flag`);
    }

    const type = value.type as NoteboardElement['type'];
    if (type === 'line' || type === 'arrow' || type === 'draw' || type === 'pen') {
        if (
            !Array.isArray(value.points)
            || value.points.length > MAX_ELEMENT_POINTS
            || !value.points.every(isSafePoint)
        ) {
            throw new TypeError(`Element ${index + 1} has invalid drawing points`);
        }
    }
    if (!isSafeBinding(value.startBinding) || !isSafeBinding(value.endBinding)) {
        throw new TypeError(`Element ${index + 1} has an invalid connector binding`);
    }
    if (['rectangle', 'ellipse', 'diamond', 'triangle', 'text', 'sticky-note', 'star', 'callout'].includes(type)) {
        validateTextStyleFields(value, index);
    }
    if (type === 'text' && value.baseline !== undefined && !isSafeNumber(value.baseline)) {
        throw new TypeError(`Element ${index + 1} has an invalid text baseline`);
    }
    if (type === 'rectangle' && value.borderRadius !== undefined && !isBoundedNumber(value.borderRadius, 0, MAX_ABSOLUTE_COORDINATE)) {
        throw new TypeError(`Element ${index + 1} has an invalid border radius`);
    }
    if (type === 'line' || type === 'arrow') {
        if (
            !isOptionalEnum(value.curveType, CURVE_TYPES)
            || !isOptionalEnum(value.routing, ROUTING_MODES)
            || !isOptionalEnum(value.startArrowhead, ARROWHEADS)
            || !isOptionalEnum(value.endArrowhead, ARROWHEADS)
            || !isOptionalString(value.label, MAX_TEXT_LENGTH)
            || !isOptionalString(value.labelFontFamily)
            || (value.labelFontSize !== undefined && !isBoundedNumber(value.labelFontSize, 1, 10_000))
        ) {
            throw new TypeError(`Element ${index + 1} has invalid line styling`);
        }
    }
    if (type === 'pen') {
        if (
            (value.highlighter !== undefined && typeof value.highlighter !== 'boolean')
            || (value.tension !== undefined && !isBoundedNumber(value.tension, 0, 1))
        ) {
            throw new TypeError(`Element ${index + 1} has invalid pen styling`);
        }
    }
    if (type === 'frame') {
        if (
            !isOptionalString(value.name, MAX_TEXT_LENGTH)
            || !isOptionalString(value.frameColor)
            || (value.showLabel !== undefined && typeof value.showLabel !== 'boolean')
            || (value.childIds !== undefined && (
                !Array.isArray(value.childIds)
                || value.childIds.length > MAX_BOARD_ELEMENTS
                || !value.childIds.every((id) => typeof id === 'string' && id.length <= 256)
            ))
        ) {
            throw new TypeError(`Element ${index + 1} has invalid frame data`);
        }
    }
    if (type === 'star') {
        if (
            (value.sides !== undefined && (!Number.isInteger(value.sides) || !isBoundedNumber(value.sides, 3, 12)))
            || (value.isStar !== undefined && typeof value.isStar !== 'boolean')
            || (value.innerRadius !== undefined && !isBoundedNumber(value.innerRadius, 0, 1))
        ) {
            throw new TypeError(`Element ${index + 1} has invalid star geometry`);
        }
    }
    if (type === 'sticky-note' && !isOptionalString(value.noteColor, 64)) {
        throw new TypeError(`Element ${index + 1} has an invalid note color`);
    }
    if (type === 'callout' && !isOptionalEnum(value.tailDirection, CALLOUT_DIRECTIONS)) {
        throw new TypeError(`Element ${index + 1} has an invalid callout direction`);
    }
    if (type === 'image') {
        if (
            typeof value.dataUrl !== 'string'
            || value.dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH
            || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(value.dataUrl)
        ) {
            throw new TypeError(`Element ${index + 1} has invalid image data`);
        }
    }

    // Reapply current defaults so valid legacy snapshots that predate a style
    // field remain renderable, while retaining their serialized values.
    return createElement(type, value as Partial<NoteboardElement>);
};

// ─── Session type ─────────────────────────────────────────────
// Plain JSON — stores directly in any DB (Postgres JSONB, MongoDB,
// Firebase, SQLite, etc.) with no transformation needed.

export interface NoteboardViewport {
    panX: number;
    panY: number;
    zoom: number;
}

export interface NoteboardSession {
    /** Identifies the "room" / thread this board belongs to */
    threadId: string;
    /** Unique ID for this specific board instance */
    boardId: string;
    /** Snapshot version supplied by the host (defaults to 1). */
    version: number;
    /** ISO-8601 timestamp of when this snapshot was taken */
    updatedAt: string;
    /** Full element list — include soft-deleted elements for CRDT-style merge */
    elements: NoteboardElement[];
    /** Viewport so viewers join at the same pan/zoom position */
    viewport: NoteboardViewport;
}

// ─── Serialize ────────────────────────────────────────────────

export interface SerializeMeta {
    threadId: string;
    boardId: string;
    /** If omitted, defaults to 1 */
    version?: number;
}

/**
 * Converts live elements + viewport into a `NoteboardSession` that is
 * safe to `JSON.stringify()` and insert into any database as-is.
 */
export function serializeBoard(
    elements: NoteboardElement[],
    viewport: NoteboardViewport,
    meta: SerializeMeta,
): NoteboardSession {
    return {
        threadId: meta.threadId,
        boardId: meta.boardId,
        version: meta.version ?? 1,
        updatedAt: new Date().toISOString(),
        elements: JSON.parse(JSON.stringify(elements)) as NoteboardElement[],
        viewport: { ...viewport },
    };
}

// ─── Deserialize ──────────────────────────────────────────────

export interface DeserializedBoard {
    elements: NoteboardElement[];
    viewport: NoteboardViewport;
}

/**
 * Unpacks a stored `NoteboardSession` back into the props you need to
 * hydrate a `<Noteboard>` component.
 *
 * @example
 * const { elements, viewport } = deserializeBoard(savedSession);
 * <Noteboard initialElements={elements} initialViewport={viewport} />
 */
export function deserializeBoard(session: unknown): DeserializedBoard {
    const candidate = session;
    if (!isRecord(candidate) || !Array.isArray(candidate.elements)) {
        throw new TypeError('Noteboard snapshot must contain an elements array');
    }
    if (candidate.elements.length > MAX_BOARD_ELEMENTS) {
        throw new TypeError(`Noteboard snapshots may contain at most ${MAX_BOARD_ELEMENTS} elements`);
    }

    const ids = new Set<string>();
    const elements = candidate.elements.map((element, index) => {
        const normalized = normalizeImportedElement(element, index);
        if (ids.has(normalized.id)) throw new TypeError(`Duplicate element ID: ${normalized.id}`);
        ids.add(normalized.id);
        return normalized;
    });
    const viewport = isRecord(candidate.viewport) ? candidate.viewport : {};
    const panX = viewport.panX === undefined ? 0 : viewport.panX;
    const panY = viewport.panY === undefined ? 0 : viewport.panY;
    const zoom = viewport.zoom === undefined ? 1 : viewport.zoom;
    if (!isSafeNumber(panX) || !isSafeNumber(panY) || !isSafeNumber(zoom) || zoom <= 0) {
        throw new TypeError('Noteboard snapshot has an invalid viewport');
    }

    return {
        elements,
        viewport: {
            panX,
            panY,
            zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
        },
    };
}
