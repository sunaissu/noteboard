/**
 * Pure utility functions extracted from useCanvasDrawing.
 * These have no React dependencies and can be tested in isolation.
 */
import type { NoteboardElement, Point, Bounds } from '../elements/types';
import { getElementBounds, rotatePoint } from '../elements/bounds';
import {
    HANDLE_SIZE,
    ROTATION_HANDLE_OFFSET,
} from '../constants';

// ─── Type definitions shared between canvas hook files ────────

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type InteractionMode = 'none' | 'resize' | 'rotate';

export interface Handle {
    position: HandlePosition | 'rotate';
    x: number;
    y: number;
}

// ─── Selection bounds ────────────────────────────────────────

export function getSelectionBounds(
    elements: NoteboardElement[],
    ids: Set<string>,
): Bounds | null {
    const selected = elements.filter((el) => ids.has(el.id) && !el.isDeleted);
    if (selected.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of selected) {
        const b = getElementBounds(el);
        if (b[0] < minX) minX = b[0];
        if (b[1] < minY) minY = b[1];
        if (b[2] > maxX) maxX = b[2];
        if (b[3] > maxY) maxY = b[3];
    }
    return [minX, minY, maxX, maxY];
}

// ─── Resize/rotation handles ─────────────────────────────────

export function getHandles(bounds: Bounds, angle: number = 0, cx?: number, cy?: number): Handle[] {
    const [x1, y1, x2, y2] = bounds;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const centerX = cx ?? mx;
    const centerY = cy ?? my;

    const raw: { position: HandlePosition | 'rotate'; lx: number; ly: number }[] = [
        { position: 'nw', lx: x1, ly: y1 },
        { position: 'n',  lx: mx, ly: y1 },
        { position: 'ne', lx: x2, ly: y1 },
        { position: 'e',  lx: x2, ly: my },
        { position: 'se', lx: x2, ly: y2 },
        { position: 's',  lx: mx, ly: y2 },
        { position: 'sw', lx: x1, ly: y2 },
        { position: 'w',  lx: x1, ly: my },
        { position: 'rotate', lx: mx, ly: y1 - ROTATION_HANDLE_OFFSET },
    ];

    if (angle === 0) {
        return raw.map((h) => ({ position: h.position, x: h.lx, y: h.ly }));
    }
    return raw.map((h) => {
        const rotated = rotatePoint(h.lx, h.ly, centerX, centerY, angle);
        return { position: h.position, x: rotated.x, y: rotated.y };
    });
}

export function hitTestHandle(point: Point, handle: Handle, zoom: number): boolean {
    const size = (HANDLE_SIZE + 4) / zoom;
    return (
        Math.abs(point.x - handle.x) <= size / 2 &&
        Math.abs(point.y - handle.y) <= size / 2
    );
}

export function getCursorForHandle(handle: Handle): string {
    switch (handle.position) {
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        case 'n':  case 's':  return 'ns-resize';
        case 'e':  case 'w':  return 'ew-resize';
        case 'rotate':        return 'grab';
        default:              return 'default';
    }
}

// ─── Z-ordering ──────────────────────────────────────────────

export function bringToFront(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    return [...elements.filter((el) => !ids.has(el.id)), ...elements.filter((el) => ids.has(el.id))];
}

export function sendToBack(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    return [...elements.filter((el) => ids.has(el.id)), ...elements.filter((el) => !ids.has(el.id))];
}

export function moveForward(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const result = [...elements];
    for (let i = result.length - 2; i >= 0; i--) {
        if (ids.has(result[i].id) && !ids.has(result[i + 1].id)) {
            [result[i], result[i + 1]] = [result[i + 1], result[i]];
        }
    }
    return result;
}

export function moveBackward(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const result = [...elements];
    for (let i = 1; i < result.length; i++) {
        if (ids.has(result[i].id) && !ids.has(result[i - 1].id)) {
            [result[i - 1], result[i]] = [result[i], result[i - 1]];
        }
    }
    return result;
}

// ─── Grouping ────────────────────────────────────────────────

export function expandSelectionToGroups(elements: NoteboardElement[], ids: Set<string>): Set<string> {
    const expanded = new Set(ids);
    for (const id of ids) {
        const el = elements.find((e) => e.id === id);
        if (el?.groupId) {
            for (const m of elements.filter((e) => e.groupId === el.groupId && !e.isDeleted)) {
                expanded.add(m.id);
            }
        }
    }
    return expanded;
}

// ─── Tool classification ────────────────────────────────────────────

export type DrawTool = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'line' | 'arrow' | 'pen' | 'sticky-note' | 'star' | 'callout';

export function isDrawingTool(tool: string): tool is DrawTool {
    return ['rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow', 'pen', 'sticky-note', 'star', 'callout'].includes(tool);
}

export interface KeyboardShortcutLike {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}

/** Whether a keyboard shortcut can mutate the element collection. */
export function isElementMutationShortcut(event: KeyboardShortcutLike): boolean {
    const isCtrl = !!(event.ctrlKey || event.metaKey);
    const key = event.key.toLowerCase();

    if (event.key === 'Backspace' || event.key === 'Delete') return true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '[', ']'].includes(event.key)) return true;
    return isCtrl && ['z', 'y', 'v', 'd', 'g'].includes(key);
}

/** Minimum intentional creation movement, measured in CSS pixels. */
export const MIN_CREATION_DISTANCE = 5;

/**
 * Decide whether a draft has enough visible geometry and raw pointer travel to
 * persist. `rawDistance` is in canvas units and prevents snapping from turning
 * a tiny hand jitter into a much larger committed element.
 */
export function shouldCommitDrawnElement(
    element: NoteboardElement,
    zoom: number,
    rawDistance = Math.hypot(element.width, element.height),
): boolean {
    if (element.type === 'pen' || element.type === 'draw') {
        const first = element.points[0];
        return !!first && element.points.some((point) => point.x !== first.x || point.y !== first.y);
    }

    if (rawDistance * zoom < MIN_CREATION_DISTANCE) return false;

    if (element.type === 'line' || element.type === 'arrow') {
        return Math.hypot(element.width, element.height) * zoom >= MIN_CREATION_DISTANCE;
    }

    return (
        Math.abs(element.width) * zoom >= MIN_CREATION_DISTANCE &&
        Math.abs(element.height) * zoom >= MIN_CREATION_DISTANCE
    );
}
