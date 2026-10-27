import type { NoteboardElement } from './elements/types';
import { combineBounds, getElementBounds } from './elements/bounds';
import { renderElement } from './renderer';
import { getCachedImage } from './renderer/utils';

export interface BoardImageOptions {
    background?: string;
    padding?: number;
    scale?: number;
    /** Omit to export every visible object. */
    selectedIds?: string[];
    /** Maximum image-loading wait for asynchronous exports; default 15 seconds. */
    imageTimeoutMs?: number;
}

/** Render content on a dedicated canvas, independent of selection, grid and viewport. */
export function renderBoardImage(elements: NoteboardElement[], format: 'png' | 'jpeg' = 'png', options: BoardImageOptions = {}): string {
    const selected = options.selectedIds && new Set(options.selectedIds);
    const active = elements.filter(element => !element.isDeleted && !element.hidden && (!selected || selected.has(element.id)));
    const padding = options.padding ?? 24, scale = options.scale ?? 1;
    if (!Number.isFinite(padding) || padding < 0 || !Number.isFinite(scale) || scale <= 0) throw new Error('Export padding and scale must be finite positive values');
    const bounds = active.map(element => {
        const bounds = getElementBounds(element);
        const margin = padding + element.strokeWidth / 2 + (element.dropShadow?.blur ?? 0) + Math.max(Math.abs(element.dropShadow?.offsetX ?? 0), Math.abs(element.dropShadow?.offsetY ?? 0));
        return [bounds[0] - margin, bounds[1] - margin, bounds[2] + margin, bounds[3] + margin];
    });
    const [left, top, right, bottom] = combineBounds(bounds);
    const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
    if (![left, top, width, height].every(Number.isFinite)) throw new Error('Export bounds must be finite');
    const actualScale = Math.min(scale, 8192 / Math.max(width, height), Math.sqrt(16_000_000 / Math.max(1, width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * actualScale)); canvas.height = Math.max(1, Math.ceil(height * actualScale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas export is unavailable');
    const background = options.background && options.background !== 'transparent' ? options.background : format === 'jpeg' ? '#ffffff' : undefined;
    if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.scale(actualScale, actualScale); context.translate(-left, -top);
    for (const element of active) {
        if (element.type === 'image' && getCachedImage(element.dataUrl, element.id).status !== 'loaded') throw new Error('An image is not ready. Use exportImageAsync to wait for images.');
        renderElement(context, element);
    }
    return canvas.toDataURL('image/' + format);
}

export async function exportBoardImage(elements: NoteboardElement[], format: 'png' | 'jpeg' = 'png', options: BoardImageOptions = {}): Promise<string> {
    const timeout = options.imageTimeoutMs ?? 15_000;
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120_000) throw new Error('Image timeout must be greater than zero and at most 120000 milliseconds');
    const selected = options.selectedIds && new Set(options.selectedIds);
    await Promise.all(elements.filter(element => !element.isDeleted && !element.hidden && element.type === 'image' && (!selected || selected.has(element.id))).map(element => new Promise<void>((resolve, reject) => {
        if (element.type !== 'image') return resolve();
        let unsubscribe = () => {};
        const timer = setTimeout(() => { unsubscribe(); reject(new Error('Image loading timed out during export')); }, timeout);
        const settled = () => {
            clearTimeout(timer);
            unsubscribe();
            if (getCachedImage(element.dataUrl, element.id).status === 'loaded') resolve();
            else reject(new Error('An image could not be loaded for export'));
        };
        const request = getCachedImage(element.dataUrl, element.id, settled);
        unsubscribe = request.unsubscribe;
        if (request.status !== 'loading') settled();
    })));
    return renderBoardImage(elements, format, options);
}
