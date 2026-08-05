import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import type { NoteboardElement } from './elements/types';
import type { NoteboardViewport } from './session';
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
}

export interface YjsNoteboardBinding {
    elements: NoteboardElement[];
    onElementsChange: (elements: NoteboardElement[]) => void;
    onViewportChange: (viewport: NoteboardViewport) => void;
    viewport: NoteboardViewport;
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
        const value = elementStore.get(id);
        if (!value || included.has(id)) return;
        result.push(value.toJSON() as unknown as NoteboardElement);
        included.add(id);
    };

    orderStore.toArray().forEach(append);
    elementStore.forEach((_value, id) => append(id));
    return result;
};

const writeElement = (target: Y.Map<unknown>, element: NoteboardElement) => {
    const next = element as unknown as Record<string, unknown>;
    Array.from(target.keys()).forEach((key) => {
        if (!(key in next)) target.delete(key);
    });
    Object.entries(next).forEach(([key, value]) => {
        if (!valuesEqual(target.get(key), value)) target.set(key, value);
    });
};

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
    const [viewport, setViewport] = useState<NoteboardViewport>(readViewport);

    useEffect(() => {
        const refresh = () => setElements(readElements(stores.elements, stores.order));
        stores.elements.observeDeep(refresh);
        stores.order.observe(refresh);

        const initialElements = options.initialElements;
        if (stores.elements.size === 0 && initialElements?.length) {
            document.transact(() => {
                initialElements.forEach((element) => {
                    const value = new Y.Map<unknown>();
                    writeElement(value, element);
                    stores.elements.set(element.id, value);
                });
                stores.order.insert(0, initialElements.map((element) => element.id));
            }, localOrigin);
        } else {
            refresh();
        }

        return () => {
            stores.elements.unobserveDeep(refresh);
            stores.order.unobserve(refresh);
        };
    }, [document, localOrigin, options.initialElements, stores]);

    useEffect(() => {
        const refresh = () => setViewport(readViewport());
        stores.viewport.observe(refresh);

        if (stores.viewport.size === 0 && options.initialViewport) {
            document.transact(() => {
                stores.viewport.set('panX', options.initialViewport!.panX);
                stores.viewport.set('panY', options.initialViewport!.panY);
                stores.viewport.set('zoom', options.initialViewport!.zoom);
            }, localOrigin);
        } else {
            refresh();
        }

        return () => stores.viewport.unobserve(refresh);
    }, [document, localOrigin, options.initialViewport, readViewport, stores.viewport]);

    const onElementsChange = useCallback((nextElements: NoteboardElement[]) => {
        document.transact(() => {
            const nextIds = new Set(nextElements.map((element) => element.id));
            Array.from(stores.elements.keys()).forEach((id) => {
                if (!nextIds.has(id)) stores.elements.delete(id);
            });

            nextElements.forEach((element) => {
                let value = stores.elements.get(element.id);
                if (!value) {
                    value = new Y.Map<unknown>();
                    stores.elements.set(element.id, value);
                }
                writeElement(value, element);
            });

            const currentOrder = stores.order.toArray();
            const nextOrder = nextElements.map((element) => element.id);
            if (!valuesEqual(currentOrder, nextOrder)) {
                if (stores.order.length) stores.order.delete(0, stores.order.length);
                if (nextOrder.length) stores.order.insert(0, nextOrder);
            }
        }, localOrigin);
    }, [document, localOrigin, stores]);

    const onViewportChange = useCallback((nextViewport: NoteboardViewport) => {
        const normalizedViewport = {
            panX: Number.isFinite(nextViewport.panX) ? nextViewport.panX : 0,
            panY: Number.isFinite(nextViewport.panY) ? nextViewport.panY : 0,
            zoom: Number.isFinite(nextViewport.zoom)
                ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextViewport.zoom))
                : 1,
        };
        document.transact(() => {
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
    }, [document, localOrigin, stores.viewport]);

    return { elements, onElementsChange, onViewportChange, viewport };
}
