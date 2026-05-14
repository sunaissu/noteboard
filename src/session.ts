import type { NoteboardElement } from './elements/types';

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
    /**
     * Monotonically increasing on every save.
     * Use for optimistic concurrency checks in your DB layer.
     */
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
export function deserializeBoard(session: NoteboardSession): DeserializedBoard {
    return {
        elements: session.elements,
        viewport: session.viewport,
    };
}
