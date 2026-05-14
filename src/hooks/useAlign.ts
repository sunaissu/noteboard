/**
 * useAlign — pure math functions for aligning and distributing elements.
 * No React dependencies; accepts and returns updated element arrays.
 */
import type { NoteboardElement } from '../elements/types';
import { getElementBounds } from '../elements/bounds';


function getBounds(el: NoteboardElement) {
    const b = getElementBounds(el);
    return { x1: b[0], y1: b[1], x2: b[2], y2: b[3], cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2 };
}

// ─── Align ───────────────────────────────────────────────────

export function alignLeft(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 2) return elements;
    const minX = Math.min(...sel.map(e => getBounds(e).x1));
    return elements.map(e => {
        if (!ids.has(e.id)) return e;
        const b = getBounds(e);
        return { ...e, x: e.x + (minX - b.x1) };
    });
}

export function alignRight(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 2) return elements;
    const maxX = Math.max(...sel.map(e => getBounds(e).x2));
    return elements.map(e => {
        if (!ids.has(e.id)) return e;
        const b = getBounds(e);
        return { ...e, x: e.x + (maxX - b.x2) };
    });
}

export function alignTop(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 2) return elements;
    const minY = Math.min(...sel.map(e => getBounds(e).y1));
    return elements.map(e => {
        if (!ids.has(e.id)) return e;
        const b = getBounds(e);
        return { ...e, y: e.y + (minY - b.y1) };
    });
}

export function alignBottom(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 2) return elements;
    const maxY = Math.max(...sel.map(e => getBounds(e).y2));
    return elements.map(e => {
        if (!ids.has(e.id)) return e;
        const b = getBounds(e);
        return { ...e, y: e.y + (maxY - b.y2) };
    });
}

export function alignCenterH(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 2) return elements;
    const minX = Math.min(...sel.map(e => getBounds(e).x1));
    const maxX = Math.max(...sel.map(e => getBounds(e).x2));
    const midX = (minX + maxX) / 2;
    return elements.map(e => {
        if (!ids.has(e.id)) return e;
        const b = getBounds(e);
        return { ...e, x: e.x + (midX - b.cx) };
    });
}

export function alignCenterV(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 2) return elements;
    const minY = Math.min(...sel.map(e => getBounds(e).y1));
    const maxY = Math.max(...sel.map(e => getBounds(e).y2));
    const midY = (minY + maxY) / 2;
    return elements.map(e => {
        if (!ids.has(e.id)) return e;
        const b = getBounds(e);
        return { ...e, y: e.y + (midY - b.cy) };
    });
}

// ─── Distribute ───────────────────────────────────────────────

export function distributeH(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 3) return elements;
    const sorted = [...sel].sort((a, b) => getBounds(a).cx - getBounds(b).cx);
    const minX = getBounds(sorted[0]).x1;
    const maxX = getBounds(sorted[sorted.length - 1]).x2;
    const totalW = sorted.reduce((s, e) => s + (getBounds(e).x2 - getBounds(e).x1), 0);
    const gap = (maxX - minX - totalW) / (sorted.length - 1);
    let cursor = minX;
    const newXMap = new Map<string, number>();
    for (const e of sorted) {
        const b = getBounds(e);
        newXMap.set(e.id, e.x + (cursor - b.x1));
        cursor += b.x2 - b.x1 + gap;
    }
    return elements.map(e => ids.has(e.id) && newXMap.has(e.id) ? { ...e, x: newXMap.get(e.id)! } : e);
}

export function distributeV(elements: NoteboardElement[], ids: Set<string>): NoteboardElement[] {
    const sel = elements.filter(e => ids.has(e.id) && !e.isDeleted);
    if (sel.length < 3) return elements;
    const sorted = [...sel].sort((a, b) => getBounds(a).cy - getBounds(b).cy);
    const minY = getBounds(sorted[0]).y1;
    const maxY = getBounds(sorted[sorted.length - 1]).y2;
    const totalH = sorted.reduce((s, e) => s + (getBounds(e).y2 - getBounds(e).y1), 0);
    const gap = (maxY - minY - totalH) / (sorted.length - 1);
    let cursor = minY;
    const newYMap = new Map<string, number>();
    for (const e of sorted) {
        const b = getBounds(e);
        newYMap.set(e.id, e.y + (cursor - b.y1));
        cursor += b.y2 - b.y1 + gap;
    }
    return elements.map(e => ids.has(e.id) && newYMap.has(e.id) ? { ...e, y: newYMap.get(e.id)! } : e);
}
