import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { applyTextEdit, trackText } from './yjsText';
import { updateSharedOrder } from './yjsOrder';
import type { HistoryAPI } from './hooks/useHistory';
import type { NoteboardElement } from './elements/types';
import type { NoteboardViewport } from './session';
import { MAX_BOARD_ELEMENTS, normalizeImportedElement } from './session';
import { MAX_ZOOM, MIN_ZOOM } from './constants';

export const YJS_NOTEBOARD_ELEMENTS_KEY = 'noteboard-elements';
export const YJS_NOTEBOARD_ORDER_KEY = 'noteboard-order';
export const YJS_NOTEBOARD_VIEWPORT_KEY = 'noteboard-viewport';

export interface YjsNoteboardOptions {
    elementsKey?: string;
    orderKey?: string;
    initialElements?: NoteboardElement[];
    initialViewport?: NoteboardViewport;
    viewportKey?: string;
    /** Opt into shared navigation for follow/presentation mode. Default: local. */
    shareViewport?: boolean;
}

export interface YjsNoteboardBinding {
    elements: NoteboardElement[];
    onElementsChange: (elements: NoteboardElement[], previous?: NoteboardElement[]) => void;
    onViewportChange: (viewport: NoteboardViewport) => void;
    viewport: NoteboardViewport;
    history: HistoryAPI;
}

const valuesEqual = (left: unknown, right: unknown) =>
    left === right || JSON.stringify(left) === JSON.stringify(right);

const readElements = (
    elementStore: Y.Map<Y.Map<unknown>>,
    orderStore: Y.Array<string>,
): NoteboardElement[] => {
    const result: NoteboardElement[] = [];
    const included = new Set<string>();

    const append = (id: string) => {
        if (typeof id !== 'string' || included.has(id) || result.length >= MAX_BOARD_ELEMENTS) return;
        included.add(id);
        const value = elementStore.get(id);
        if (!(value instanceof Y.Map)) return;
        let element: NoteboardElement;
        try {
            element = normalizeImportedElement(value.toJSON(), result.length);
            if (element.id !== id) return;
        } catch {
            // Keep malformed peer records in the shared document, but exclude
            // them from the renderable view until their author repairs them.
            return;
        }
        const text = value.get("text");
        if (text instanceof Y.Text) trackText(text);
        result.push(element);
    };

    orderStore.toArray().forEach(append);
    elementStore.forEach((_value, id) => append(id));
    return result;
};

const writeElement = (target: Y.Map<unknown>, element: NoteboardElement, previous?: NoteboardElement) => {
    const next = element as unknown as Record<string, unknown>;
    const base = (previous ?? {}) as unknown as Record<string, unknown>;
    Object.keys(base).forEach((key) => {
        if (!(key in next)) target.delete(key);
    });
    Object.entries(next).forEach(([key, value]) => {
        if (valuesEqual(base[key], value)) return;
        const current = target.get(key);
        if (key === 'text' && typeof value === 'string') {
            if (current instanceof Y.Text) applyTextEdit(current, typeof base[key] === 'string' ? base[key] as string : current.toString(), value);
            else { const text = new Y.Text(value); target.set(key, text); trackText(text); }
        } else if (!valuesEqual(current, value)) target.set(key, value);
    });
};

/** Run once on the authoritative document before admitting clients from older schemas. */
export function migrateNoteboardText(document: Y.Doc, elementsKey = YJS_NOTEBOARD_ELEMENTS_KEY): void {
    document.transact(() => {
        document.getMap<Y.Map<unknown>>(elementsKey).forEach(element => {
            if (!(element instanceof Y.Map)) return;
            const value = element.get('text');
            if (typeof value === 'string') element.set('text', new Y.Text(value));
            const text = element.get('text');
            if (text instanceof Y.Text) trackText(text);
        });
    }, 'noteboard-text-migration');
}

/**
 * Connects Noteboard's controlled elements API to a Yjs document.
 *
 * The adapter stores each element in its own Y.Map so edits to different
 * elements and fields merge independently. Z-order is stored separately in a
 * Y.Array. Network transport, persistence, authentication and awareness remain
 * the host application's responsibility.
 */
export function useYjsNoteboard(
    document: Y.Doc,
    options: YjsNoteboardOptions = {},
): YjsNoteboardBinding {
    const elementsKey = options.elementsKey ?? YJS_NOTEBOARD_ELEMENTS_KEY;
    const orderKey = options.orderKey ?? YJS_NOTEBOARD_ORDER_KEY;
    const viewportKey = options.viewportKey ?? YJS_NOTEBOARD_VIEWPORT_KEY;
    const stores = useMemo(() => ({
        elements: document.getMap<Y.Map<unknown>>(elementsKey),
        order: document.getArray<string>(orderKey),
        viewport: document.getMap<number>(viewportKey),
    }), [document, elementsKey, orderKey, viewportKey]);
    const localOrigin = useMemo(() => ({ source: 'noteboard' }), [document]);
    const [elements, setElements] = useState<NoteboardElement[]>(() =>
        readElements(stores.elements, stores.order),
    );
    const readViewport = useCallback((): NoteboardViewport => {
        const panX = stores.viewport.get('panX');
        const panY = stores.viewport.get('panY');
        const zoom = stores.viewport.get('zoom');
        return {
            panX: Number.isFinite(panX) ? panX! : 0,
            panY: Number.isFinite(panY) ? panY! : 0,
            zoom: Number.isFinite(zoom)
                ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom!))
                : 1,
        };
    }, [stores.viewport]);
    const [viewport, setViewport] = useState<NoteboardViewport>(() => options.initialViewport ?? { panX: 0, panY: 0, zoom: 1 });
    const seeded = useRef(new WeakSet<Y.Map<Y.Map<unknown>>>());

    useEffect(() => {
        migrateNoteboardText(document, elementsKey);
        const refresh = (transaction?: Y.Transaction) => {
            // Local board mutations are already applied optimistically by
            // onElementsChange. Re-reading them through Yjs creates a fresh
            // array which controlled hosts can deliver after a newer pointer
            // update, making active drags jump back to an older position.
            if (transaction?.origin === localOrigin) return;
            setElements(readElements(stores.elements, stores.order));
        };
        const refreshElements = (
            _events: Y.YEvent<Y.Map<unknown>>[],
            transaction: Y.Transaction,
        ) => refresh(transaction);
        const refreshOrder = (
            _event: Y.YArrayEvent<string>,
            transaction: Y.Transaction,
        ) => refresh(transaction);
        stores.elements.observeDeep(refreshElements);
        stores.order.observe(refreshOrder);

        const initialElements = options.initialElements;
        if (!seeded.current.has(stores.elements) && stores.elements.size === 0 && initialElements?.length) {
            document.transact(() => {
                initialElements.forEach((element) => {
                    const value = new Y.Map<unknown>();
                    stores.elements.set(element.id, value);
                    writeElement(value, element);
                });
                stores.order.insert(0, initialElements.map((element) => element.id));
            }, localOrigin);
            setElements(initialElements);
        } else {
            refresh();
        }

        seeded.current.add(stores.elements);
        return () => {
            stores.elements.unobserveDeep(refreshElements);
            stores.order.unobserve(refreshOrder);
        };
    }, [document, elementsKey, localOrigin, options.initialElements, stores]);

    useEffect(() => {
        if (!options.shareViewport) return;
        const refresh = (transaction?: Y.Transaction) => {
            // As with elements, avoid reflecting an older local viewport echo
            // back into a controlled canvas. Remote viewport transactions are
            // still adopted normally.
            if (transaction?.origin === localOrigin) return;
            setViewport(readViewport());
        };
        const refreshViewport = (
            _event: Y.YMapEvent<number>,
            transaction: Y.Transaction,
        ) => refresh(transaction);
        stores.viewport.observe(refreshViewport);

        if (stores.viewport.size === 0 && options.initialViewport) {
            document.transact(() => {
                stores.viewport.set('panX', options.initialViewport!.panX);
                stores.viewport.set('panY', options.initialViewport!.panY);
                stores.viewport.set('zoom', options.initialViewport!.zoom);
            }, localOrigin);
            setViewport(readViewport());
        } else {
            refresh();
        }

        return () => stores.viewport.unobserve(refreshViewport);
    }, [document, localOrigin, options.initialViewport, options.shareViewport, readViewport, stores.viewport]);

    const onElementsChange = useCallback((nextElements: NoteboardElement[], previous = elements) => {
        const base = new Map(previous.map(element => [element.id, element]));
        document.transact(() => {
            const nextIds = new Set(nextElements.map((element) => element.id));
            Array.from(base.keys()).forEach((id) => {
                if (!nextIds.has(id)) stores.elements.delete(id);
            });

            nextElements.forEach((element) => {
                let value = stores.elements.get(element.id);
                if (value && !(value instanceof Y.Map)) return;
                if (!value && base.has(element.id)) return;
                if (!value) {
                    value = new Y.Map<unknown>();
                    stores.elements.set(element.id, value);
                }
                writeElement(value, element, base.get(element.id));
            });

            const nextOrder = nextElements.map((element) => element.id);
            if (!valuesEqual(previous.map(element => element.id), nextOrder)) {
                updateSharedOrder(stores.order, previous.map(element => element.id), nextOrder, id => stores.elements.has(id));
            }
        }, localOrigin);
        // Preserve local identity when merging did not add a peer change.
        const merged = readElements(stores.elements, stores.order);
        setElements(valuesEqual(merged, nextElements) ? nextElements : merged);
    }, [document, localOrigin, stores, elements]);

    const onViewportChange = useCallback((nextViewport: NoteboardViewport) => {
        const normalizedViewport = {
            panX: Number.isFinite(nextViewport.panX) ? nextViewport.panX : 0,
            panY: Number.isFinite(nextViewport.panY) ? nextViewport.panY : 0,
            zoom: Number.isFinite(nextViewport.zoom)
                ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextViewport.zoom))
                : 1,
        };
        if (options.shareViewport) document.transact(() => {
            if (stores.viewport.get('panX') !== normalizedViewport.panX) {
                stores.viewport.set('panX', normalizedViewport.panX);
            }
            if (stores.viewport.get('panY') !== normalizedViewport.panY) {
                stores.viewport.set('panY', normalizedViewport.panY);
            }
            if (stores.viewport.get('zoom') !== normalizedViewport.zoom) {
                stores.viewport.set('zoom', normalizedViewport.zoom);
            }
        }, localOrigin);
        setViewport(normalizedViewport);
    }, [document, localOrigin, stores.viewport, options.shareViewport]);

    const undoManager = useRef<Y.UndoManager | null>(null);
    useEffect(() => {
        const manager = new Y.UndoManager([stores.elements, stores.order], { trackedOrigins: new Set([localOrigin]), captureTimeout: Infinity });
        undoManager.current = manager;
        return () => { undoManager.current = null; manager.destroy(); };
    }, [stores, localOrigin]);
    const history = useMemo<HistoryAPI>(() => ({
        record: () => undoManager.current?.stopCapturing(),
        undo: () => { undoManager.current?.undo(); return null; },
        redo: () => { undoManager.current?.redo(); return null; },
        canUndo: () => Boolean(undoManager.current?.undoStack.length),
        canRedo: () => Boolean(undoManager.current?.redoStack.length),
    }), []);
    return { elements, onElementsChange, onViewportChange, viewport, history };
}
