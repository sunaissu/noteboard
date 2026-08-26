import type { Point, NoteboardElement } from './types';
import { isLinearElement } from './types';
import { generateId } from './createElement';

// ─── Generic Mutation ────────────────────────────────────────

/**
 * Return a shallow copy of `element` with `updates` merged in.
 * This is the low-level immutable helper — all other mutators build on it.
 */
export function mutateElement<T extends NoteboardElement>(
    element: T,
    updates: Partial<T>,
): T {
    return { ...element, ...updates };
}

// ─── Translate ───────────────────────────────────────────────

/** Move an element by (dx, dy). */
export function moveElement<T extends NoteboardElement>(
    element: T,
    dx: number,
    dy: number,
): T {
    return mutateElement(element, {
        x: element.x + dx,
        y: element.y + dy,
    } as Partial<T>);
}

// ─── Resize ──────────────────────────────────────────────────

/**
 * Scale an element by (scaleX, scaleY) relative to an origin point.
 * For linear elements the internal points are also scaled.
 */
export function resizeElement<T extends NoteboardElement>(
    element: T,
    scaleX: number,
    scaleY: number,
    origin: Point = { x: element.x, y: element.y },
): T {
    const newX = origin.x + (element.x - origin.x) * scaleX;
    const newY = origin.y + (element.y - origin.y) * scaleY;
    const newWidth = element.width * scaleX;
    const newHeight = element.height * scaleY;

    // Use Record to avoid union-narrowing issue with Partial<NoteboardElement>
    const base: Record<string, unknown> = {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
    };

    // Scale internal points for linear elements
    if (isLinearElement(element as NoteboardElement)) {
        const linearEl = element as unknown as { points: Point[] };
        base.points = linearEl.points.map((p: Point) => ({
            x: p.x * scaleX,
            y: p.y * scaleY,
        }));
    }

    return mutateElement(element, base as Partial<T>);
}

// ─── Rotate ──────────────────────────────────────────────────

/** Set the rotation angle (radians) of an element. */
export function rotateElement<T extends NoteboardElement>(
    element: T,
    angle: number,
): T {
    return mutateElement(element, { angle } as Partial<T>);
}

// ─── Delete ──────────────────────────────────────────────────

/** Soft-delete an element. */
export function deleteElement<T extends NoteboardElement>(
    element: T,
): T {
    return mutateElement(element, { isDeleted: true } as Partial<T>);
}

/** Restore a soft-deleted element. */
export function restoreElement<T extends NoteboardElement>(
    element: T,
): T {
    return mutateElement(element, { isDeleted: false } as Partial<T>);
}

// ─── Duplicate ───────────────────────────────────────────────

/** Clone an element with a fresh ID and a small positional offset. */
export function duplicateElement<T extends NoteboardElement>(
    element: T,
    offset: number = 10,
): T {
    const duplicate = mutateElement(element, {
        id: generateId(),
        x: element.x + offset,
        y: element.y + offset,
    } as Partial<T>);

    if (duplicate.type !== 'line' && duplicate.type !== 'arrow') return duplicate;
    return {
        ...duplicate,
        startBinding: null,
        endBinding: null,
    } as T;
}

/**
 * Duplicate a coherent set of elements while preserving relationships inside
 * that set. Connector bindings to duplicated targets are remapped to the new
 * IDs; bindings to targets outside the set are cleared so the positional
 * offset is not immediately undone by binding resolution.
 */
export function duplicateElements<T extends NoteboardElement>(
    elements: readonly T[],
    offset: number = 10,
): T[] {
    const idMap = new Map(elements.map((element) => [element.id, generateId()]));
    const groupMap = new Map<string, string>();

    return elements.map((element) => {
        const duplicate = mutateElement(element, {
            id: idMap.get(element.id)!,
            x: element.x + offset,
            y: element.y + offset,
            ...(element.groupId
                ? {
                    groupId: (() => {
                        let duplicateGroupId = groupMap.get(element.groupId!);
                        if (!duplicateGroupId) {
                            duplicateGroupId = generateId();
                            groupMap.set(element.groupId!, duplicateGroupId);
                        }
                        return duplicateGroupId;
                    })(),
                }
                : {}),
        } as Partial<T>);

        if (duplicate.type !== 'line' && duplicate.type !== 'arrow') return duplicate;

        const remapBinding = (binding: typeof duplicate.startBinding) => {
            if (!binding) return null;
            const duplicateTargetId = idMap.get(binding.elementId);
            if (!duplicateTargetId) return null;
            return {
                ...binding,
                elementId: duplicateTargetId,
                fixedPoint: { ...binding.fixedPoint },
            };
        };

        return {
            ...duplicate,
            startBinding: remapBinding(duplicate.startBinding),
            endBinding: remapBinding(duplicate.endBinding),
        } as T;
    });
}
