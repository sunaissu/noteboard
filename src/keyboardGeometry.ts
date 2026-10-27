import type { NoteboardElement, Point } from './elements/types';
import { getElementBounds } from './elements/bounds';

/** Fast cursor travel stops at the first visible object's bounds it crosses. */
export function moveKeyboardCursor(from: Point, delta: Point, elements: NoteboardElement[], stopAtObjects = false): Point {
    let fraction = 1;
    if (stopAtObjects) for (const element of elements) {
        if (element.isDeleted || element.hidden) continue;
        const [left, top, right, bottom] = getElementBounds(element);
        if (from.x >= left && from.x <= right && from.y >= top && from.y <= bottom) continue;
        let near = 0, far = 1;
        for (const [origin, direction, min, max] of [[from.x, delta.x, left, right], [from.y, delta.y, top, bottom]]) {
            if (!direction) { if (origin < min || origin > max) far = -1; continue; }
            const a = (min - origin) / direction, b = (max - origin) / direction;
            near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        }
        if (near > 0 && near <= far) fraction = Math.min(fraction, near);
    }
    return { x: Math.max(-1e9, Math.min(1e9, from.x + delta.x * fraction)), y: Math.max(-1e9, Math.min(1e9, from.y + delta.y * fraction)) };
}

export function nextKeyboardElement(elements: NoteboardElement[], currentId: string | undefined, backwards = false) {
    const visible = elements.filter(element => !element.isDeleted && !element.hidden);
    const index = visible.findIndex(element => element.id === currentId);
    return visible.length ? visible[(index < 0 ? backwards ? visible.length - 1 : 0 : (index + (backwards ? -1 : 1) + visible.length) % visible.length)] : undefined;
}
