/**
 * useCanvasDrawing
 *
 * Primary hook for all canvas interactions. Internally organized into sections:
 *   1. State & refs
 *   2. Repaint (canvas drawing)
 *   3. Keyboard shortcuts
 *   4. Image paste
 *   5. Pointer events (down / move / up)
 *   6. Wheel (pan & zoom)
 *   7. Text commit & double-click
 *
 * Pure logic (handle geometry, z-order, grouping) lives in ./canvasUtils.ts.
 */
import { useRef, useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { NoteboardElement, Point, Bounds, TextElement, RectangleElement } from '../elements/types';
import { isLinearElement, isShapeElement, isLockedElement } from '../elements/types';
import type { Tool } from '../types';
import type { NoteboardViewport } from '../session';
import { createElement, generateId } from '../elements/createElement';
import { duplicateElements } from '../elements/mutateElement';
import { hitTestElement, getElementsInBounds } from '../elements/hitTest';
import { getElementBounds, rotatePoint } from '../elements/bounds';
import {
    CONNECTOR_SNAP_DISTANCE,
    findBinding,
    updateBoundElements,
} from '../elements/connectorBinding';
import type { ConnectorSnapResult } from '../elements/connectorBinding';
import { renderElement } from '../renderer';
import { useHistory } from './useHistory';
import {
    DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, DEFAULT_LINE_HEIGHT,
    SELECTION_COLOR, HIT_TEST_THRESHOLD, SELECTION_PAD,
    MARQUEE_FILL, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP,
    HANDLE_SIZE, HANDLE_FILL,
    ROTATION_SNAP_ANGLE, MULTI_SELECTION_OPACITY,
    GRID_COLOR_LIGHT, GRID_COLOR_DARK, NUDGE_STEP, NUDGE_STEP_LARGE,
} from '../constants';
import { drawGrid, snapToGrid } from './useGrid';
import {
    getSelectionBounds, getHandles, hitTestHandle, getCursorForHandle,
    bringToFront, sendToBack, moveForward, moveBackward,
    expandSelectionToGroups, isDrawingTool, isElementMutationShortcut,
    shouldCommitDrawnElement,
} from './canvasUtils';
import type { Handle, HandlePosition, InteractionMode } from './canvasUtils';

// ─── Re-export for external callers ──────────────────────────
export type { Handle, HandlePosition, InteractionMode };

// ─── Local type guard ─────────────────────────────────────────
function isTextElement(el: NoteboardElement): el is TextElement {
    return el.type === 'text';
}

const normalizeViewport = (viewport?: NoteboardViewport): NoteboardViewport => ({
    panX: Number.isFinite(viewport?.panX) ? viewport!.panX : 0,
    panY: Number.isFinite(viewport?.panY) ? viewport!.panY : 0,
    zoom: Number.isFinite(viewport?.zoom)
        ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport!.zoom))
        : 1,
});

// ─── Public interfaces ────────────────────────────────────────

interface UseCanvasDrawingOptions {
    activeTool: Tool;
    width: number;
    height: number;
    canvasBg?: string;
    strokeColor?: string;
    primaryColor?: string;
    primaryOverlay?: string;
    isDark?: boolean;
    readOnly?: boolean;
    /** Scope global keyboard and paste shortcuts to the active board. */
    keyboardEnabled?: boolean;
    onImageInsertRequest?: (x: number, y: number) => void;
    /** Seed elements on first mount (from DB load). Uncontrolled — ignored after mount. */
    initialElements?: NoteboardElement[];
    /** Seed viewport on first mount (from a saved NoteboardSession). */
    initialViewport?: NoteboardViewport;
    /** Fully controlled viewport for external persistence or collaboration. */
    externalViewport?: NoteboardViewport;
    /**
     * Fully controlled elements.
     * When this array reference changes the internal state is replaced.
     * Use for WebSocket/real-time sync where the server is the source of truth.
     */
    externalElements?: NoteboardElement[];
    /**
     * Called after every local mutation (draw, edit, move or delete action).
     * Wire this to your WebSocket broadcast or DB auto-save.
     */
    onElementsChange?: (elements: NoteboardElement[]) => void;
    /** Called after every pan or zoom. */
    onViewportChange?: (viewport: NoteboardViewport) => void;
    /** Whether snap-to-grid is enabled (controlled externally). */
    snapEnabled?: boolean;
    /** Whether the grid overlay is visible. */
    showGrid?: boolean;
}

export interface TextEditState {
    x: number;
    y: number;
    active: boolean;
    editingId: string | null;
    initialText: string;
}

// ═════════════════════════════════════════════════════════════
// ═══ MAIN HOOK ═══════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════

export function useCanvasDrawing({
    activeTool, width, height, canvasBg, strokeColor,
    primaryColor = SELECTION_COLOR, primaryOverlay = MARQUEE_FILL, isDark, readOnly = false,
    keyboardEnabled = true,
    initialElements, initialViewport, externalElements, externalViewport, onElementsChange,
    onViewportChange,
    snapEnabled = false, showGrid = false, onImageInsertRequest,
}: UseCanvasDrawingOptions) {

    // ─── 1. STATE & REFS ────────────────────────────────────────

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [elements, setElementsRaw] = useState<NoteboardElement[]>(
        () => updateBoundElements(externalElements ?? initialElements ?? []),
    );
    const readOnlyRef = useRef(readOnly);
    readOnlyRef.current = readOnly;
    // Keep a synchronous source of truth for event handlers. Evaluating local
    // updates against this ref lets us notify controlled hosts *outside* a
    // React state updater (important when the host callback updates Yjs/React
    // synchronously).
    const elementsRef = useRef(elements);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [textEdit, setTextEdit] = useState<TextEditState>({
        x: 0, y: 0, active: false, editingId: null, initialText: '',
    });

    // Controlled / external elements sync (WebSocket, etc.)
    const externalElementsRef = useRef(externalElements);
    useEffect(() => {
        if (externalElements && externalElements !== externalElementsRef.current) {
            externalElementsRef.current = externalElements;
            const next = updateBoundElements(externalElements);
            elementsRef.current = next;
            setElementsRaw(next);
        }
    }, [externalElements]);

    const onElementsChangeRef = useRef(onElementsChange);
    onElementsChangeRef.current = onElementsChange;

    const onViewportChangeRef = useRef(onViewportChange);
    onViewportChangeRef.current = onViewportChange;

    const setElements = useCallback(
        (updater: NoteboardElement[] | ((prev: NoteboardElement[]) => NoteboardElement[])) => {
            const previous = elementsRef.current;
            const candidate = typeof updater === 'function' ? updater(previous) : updater;
            const next = updateBoundElements(candidate);
            if (next === previous) return;

            elementsRef.current = next;
            setElementsRaw(next);
            onElementsChangeRef.current?.(next);
        },
        [],
    );

    // Pan & zoom
    const [viewportState, setViewportState] = useState(() => {
        const viewport = normalizeViewport(externalViewport ?? initialViewport);
        return {
            origin: externalViewport ? 'external' as const : 'local' as const,
            panOffset: { x: viewport.panX, y: viewport.panY },
            zoom: viewport.zoom,
        };
    });
    const { origin: viewportChangeOrigin, panOffset, zoom } = viewportState;

    // Controlled viewport props and local pan/zoom gestures share the same
    // React state, but only local changes should be published to the host.
    // Otherwise a delayed controlled value can be emitted back as a new local
    // change and make two viewport snapshots alternate forever.
    const setPanOffset: Dispatch<SetStateAction<Point>> = useCallback((next) => {
        setViewportState((current) => {
            const panOffset = typeof next === 'function' ? next(current.panOffset) : next;
            if (current.panOffset.x === panOffset.x && current.panOffset.y === panOffset.y) {
                return current;
            }
            return { ...current, origin: 'local', panOffset };
        });
    }, []);
    const setZoom: Dispatch<SetStateAction<number>> = useCallback((next) => {
        setViewportState((current) => {
            const zoom = typeof next === 'function' ? next(current.zoom) : next;
            if (current.zoom === zoom) return current;
            return { ...current, origin: 'local', zoom };
        });
    }, []);

    const externalViewportRef = useRef(externalViewport);
    useEffect(() => {
        if (!externalViewport || externalViewport === externalViewportRef.current) return;
        externalViewportRef.current = externalViewport;
        const viewport = normalizeViewport(externalViewport);
        setViewportState((current) => {
            if (
                current.panOffset.x === viewport.panX &&
                current.panOffset.y === viewport.panY &&
                current.zoom === viewport.zoom
            ) {
                return current;
            }
            return {
                origin: 'external',
                panOffset: { x: viewport.panX, y: viewport.panY },
                zoom: viewport.zoom,
            };
        });
    }, [externalViewport]);

    // Fire only for local pan/zoom changes. Externally applied controlled state
    // is already known by the host and must not be reflected back into it.
    useEffect(() => {
        if (viewportChangeOrigin === 'external') return;
        onViewportChangeRef.current?.({ panX: panOffset.x, panY: panOffset.y, zoom });
    }, [panOffset, viewportChangeOrigin, zoom]);

    const panStartRef = useRef<Point>({ x: 0, y: 0 });
    const panOffsetStartRef = useRef<Point>({ x: 0, y: 0 });

    // Interaction flags
    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const isSelectingRef = useRef(false);
    const isDraggingRef = useRef(false);
    const isErasingRef = useRef(false);
    const eraserHistoryRecordedRef = useRef(false);
    const currentElementRef = useRef<NoteboardElement | null>(null);
    // A short click with a line/arrow anchors its tail. The draft remains live
    // until a second click places a sufficiently distant endpoint.
    const pendingLinearRef = useRef(false);
    const startPointRef = useRef<Point>({ x: 0, y: 0 });
    const rawStartPointRef = useRef<Point>({ x: 0, y: 0 });
    const rawEndPointRef = useRef<Point>({ x: 0, y: 0 });
    const dragLastRef = useRef<Point>({ x: 0, y: 0 });
    const selectionRectRef = useRef<{ start: Point; end: Point } | null>(null);
    // Set to true by the canvas React onPointerUp; the global window fallback
    // checks this to avoid double-processing the same event.
    const pointerUpHandledRef = useRef(false);

    // History and clipboard
    const history = useHistory();
    const clipboardRef = useRef<NoteboardElement[]>([]);

    // Resize / rotation
    const interactionModeRef = useRef<InteractionMode>('none');
    const activeHandleRef = useRef<Handle | null>(null);
    const resizeStartBoundsRef = useRef<Bounds | null>(null);
    const resizeStartElementsRef = useRef<NoteboardElement[]>([]);
    const rotationCenterRef = useRef<Point>({ x: 0, y: 0 });
    const rotationStartAngleRef = useRef(0);
    const rotationStartElementAnglesRef = useRef<Map<string, number>>(new Map());

    // ─── 2. COORDINATE HELPERS ──────────────────────────────────

    const toCanvas = useCallback((clientX: number, clientY: number): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left - panOffset.x) / zoom,
            y: (clientY - rect.top - panOffset.y) / zoom,
        };
    }, [panOffset, zoom]);

    const toScreen = useCallback((clientX: number, clientY: number): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }, []);

    // Sync canvas base cursor when tool changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (readOnly) {
            canvas.style.cursor = 'grab';
            return;
        }
        switch (activeTool) {
            case 'pan':    canvas.style.cursor = 'grab'; break;
            case 'text':   canvas.style.cursor = 'text'; break;
            case 'eraser': canvas.style.cursor = 'crosshair'; break;
            case 'select': canvas.style.cursor = 'default'; break;
            case 'line':
            case 'arrow':  canvas.style.cursor = 'cell'; break;
            default:       canvas.style.cursor = 'crosshair'; break;
        }
    }, [activeTool, readOnly]);

    // ── Connector snap helpers ────────────────────────────────────
    const snapRef = useRef<ConnectorSnapResult | null>(null);

    const findSnapTarget = useCallback((point: Point, excludeId?: string) => (
        findBinding(point, elementsRef.current, CONNECTOR_SNAP_DISTANCE / zoom, excludeId)
    ), [zoom]);

    const updateLinearDraftEndpoint = useCallback((point: Point) => {
        const element = currentElementRef.current;
        if (!element || (element.type !== 'line' && element.type !== 'arrow')) return;

        const rawEndpoint = snapEnabled ? snapToGrid(point) : point;
        const endpointSnap = findSnapTarget(rawEndpoint, element.id);
        const endpoint = endpointSnap?.point ?? rawEndpoint;
        const start = startPointRef.current;
        snapRef.current = endpointSnap;
        currentElementRef.current = {
            ...element,
            points: [
                { x: 0, y: 0 },
                { x: endpoint.x - start.x, y: endpoint.y - start.y },
            ],
            width: endpoint.x - start.x,
            height: endpoint.y - start.y,
            endBinding: endpointSnap?.binding ?? null,
        } as NoteboardElement;
    }, [findSnapTarget, snapEnabled]);

    // ─── 3. REPAINT ─────────────────────────────────────────────

    const repaintRef = useRef<() => void>(() => undefined);
    const imageRepaintFrameRef = useRef<number | null>(null);
    const imageRepaintActiveRef = useRef(true);
    const queueImageRepaint = useCallback(() => {
        if (!imageRepaintActiveRef.current) return;
        if (imageRepaintFrameRef.current !== null) return;
        imageRepaintFrameRef.current = window.requestAnimationFrame(() => {
            imageRepaintFrameRef.current = null;
            repaintRef.current();
        });
    }, []);

    const repaint = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        ctx.save();
        ctx.scale(dpr, dpr);

        if (canvasBg) {
            ctx.fillStyle = canvasBg;
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.clearRect(0, 0, width, height);
        }

        // Draw grid before transforms
        if (showGrid) {
            const gridColor = isDark ? GRID_COLOR_DARK : GRID_COLOR_LIGHT;
            drawGrid(ctx, width, height, panOffset.x, panOffset.y, zoom, gridColor);
        }

        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        const allElements = currentElementRef.current
            ? [...elements, currentElementRef.current]
            : elements;

        // Draw all elements — skip standalone text being edited in textarea overlay
        for (const el of allElements) {
            if (!el || el.isDeleted) continue;
            const excludeText = textEdit.active && textEdit.editingId === el.id;
            if (excludeText && el.type === 'text') continue;
            renderElement(ctx, el, excludeText, queueImageRepaint);
        }

        // ── Selection overlay ──
        const editableSelectionIds = new Set(
            allElements
                .filter((element) => element && selectedIds.has(element.id) && !element.isDeleted && !isLockedElement(element))
                .map((element) => element.id),
        );
        if (editableSelectionIds.size > 0) {
            const selectedEls = allElements.filter((e) => e && editableSelectionIds.has(e.id) && !e.isDeleted);
            const singleEl = selectedEls.length === 1 ? selectedEls[0] : null;

            ctx.save();
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 0.5 / zoom;
            ctx.setLineDash([]);

            if (singleEl) {
                let ex1: number, ey1: number, ew: number, eh: number;
                if (isLinearElement(singleEl)) {
                    const bounds = getElementBounds(singleEl);
                    ex1 = bounds[0]; ey1 = bounds[1];
                    ew = bounds[2] - bounds[0]; eh = bounds[3] - bounds[1];
                } else {
                    ex1 = Math.min(singleEl.x, singleEl.x + singleEl.width);
                    ey1 = Math.min(singleEl.y, singleEl.y + singleEl.height);
                    ew = Math.abs(singleEl.width); eh = Math.abs(singleEl.height);
                }
                const ecx = ex1 + ew / 2, ecy = ey1 + eh / 2;
                const skipBoundingRect = singleEl.type === 'line' || singleEl.type === 'arrow';
                if (!skipBoundingRect) {
                    ctx.save();
                    ctx.translate(ecx, ecy);
                    if (!isLinearElement(singleEl)) ctx.rotate(singleEl.angle);
                    ctx.strokeRect(-ew / 2 - SELECTION_PAD, -eh / 2 - SELECTION_PAD, ew + SELECTION_PAD * 2, eh + SELECTION_PAD * 2);
                    ctx.restore();
                }
            } else {
                const combinedBounds = getSelectionBounds(allElements, editableSelectionIds);
                if (combinedBounds) {
                    const [bx1, by1, bx2, by2] = combinedBounds;
                    ctx.strokeRect(bx1 - SELECTION_PAD, by1 - SELECTION_PAD, bx2 - bx1 + SELECTION_PAD * 2, by2 - by1 + SELECTION_PAD * 2);
                }
            }
            ctx.restore();

            // ── Draw handles ──
            const isTextOnly = singleEl && singleEl.type === 'text';
            const isLineOrArrow = singleEl && (singleEl.type === 'line' || singleEl.type === 'arrow');
            const isMulti = selectedEls.length > 1;

            if (!isTextOnly) {
                let handles: Handle[];
                if (isLineOrArrow && singleEl && isLinearElement(singleEl)) {
                    const pts = singleEl.points;
                    handles = pts.length >= 2 ? [
                        { position: 'nw', x: singleEl.x + pts[0].x, y: singleEl.y + pts[0].y },
                        { position: 'se', x: singleEl.x + pts[pts.length - 1].x, y: singleEl.y + pts[pts.length - 1].y },
                    ] : [];
                } else if (singleEl) {
                    let ex1: number, ey1: number, ex2: number, ey2: number;
                    if (isLinearElement(singleEl)) {
                        const b = getElementBounds(singleEl);
                        ex1 = b[0]; ey1 = b[1]; ex2 = b[2]; ey2 = b[3];
                    } else {
                        ex1 = Math.min(singleEl.x, singleEl.x + singleEl.width);
                        ey1 = Math.min(singleEl.y, singleEl.y + singleEl.height);
                        ex2 = Math.max(singleEl.x, singleEl.x + singleEl.width);
                        ey2 = Math.max(singleEl.y, singleEl.y + singleEl.height);
                    }
                    handles = getHandles(
                        [ex1 - SELECTION_PAD, ey1 - SELECTION_PAD, ex2 + SELECTION_PAD, ey2 + SELECTION_PAD],
                        singleEl.angle,
                        (ex1 + ex2) / 2,
                        (ey1 + ey2) / 2
                    );
                } else {
                    const selBounds = getSelectionBounds(allElements, editableSelectionIds);
                    handles = selBounds ? getHandles([
                        selBounds[0] - SELECTION_PAD,
                        selBounds[1] - SELECTION_PAD,
                        selBounds[2] + SELECTION_PAD,
                        selBounds[3] + SELECTION_PAD
                    ]) : [];
                }

                const hs = HANDLE_SIZE / zoom;
                if (isMulti) ctx.globalAlpha = MULTI_SELECTION_OPACITY;

                for (const handle of handles) {
                    ctx.save();
                    if (handle.position === 'rotate') {
                        if (isLineOrArrow) { ctx.restore(); continue; }
                        const nHandle = handles.find((h) => h.position === 'n');
                        if (nHandle) {
                            ctx.beginPath();
                            ctx.strokeStyle = primaryColor; ctx.lineWidth = 1 / zoom; ctx.setLineDash([]);
                            ctx.moveTo(nHandle.x, nHandle.y); ctx.lineTo(handle.x, handle.y); ctx.stroke();
                        }
                        ctx.beginPath();
                        ctx.arc(handle.x, handle.y, hs / 2, 0, Math.PI * 2);
                        ctx.fillStyle = HANDLE_FILL; ctx.fill();
                        ctx.strokeStyle = primaryColor; ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([]); ctx.stroke();
                    } else {
                        ctx.fillStyle = HANDLE_FILL; ctx.strokeStyle = primaryColor;
                        ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([]);
                        if (isLineOrArrow) {
                            ctx.beginPath(); ctx.arc(handle.x, handle.y, hs / 2 + 1 / zoom, 0, Math.PI * 2);
                            ctx.fill(); ctx.stroke();
                        } else {
                            ctx.fillRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
                            ctx.strokeRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
                        }
                    }
                    ctx.restore();
                }

                if (isMulti) ctx.globalAlpha = 1;
            }
        }

        // ── Selection marquee ──
        const sr = selectionRectRef.current;
        if (sr) {
            ctx.save();
            ctx.strokeStyle = primaryColor; ctx.fillStyle = primaryOverlay;
            ctx.lineWidth = 0.5 / zoom; ctx.setLineDash([]);
            const sx = Math.min(sr.start.x, sr.end.x), sy = Math.min(sr.start.y, sr.end.y);
            const sw = Math.abs(sr.end.x - sr.start.x), sh = Math.abs(sr.end.y - sr.start.y);
            ctx.fillRect(sx, sy, sw, sh); ctx.strokeRect(sx, sy, sw, sh);
            ctx.restore();
        }

        // ── Connector snap highlight ──
        const snap = snapRef.current;
        if (snap) {
            ctx.save();
            ctx.strokeStyle = primaryColor;
            ctx.fillStyle = primaryOverlay;
            ctx.lineWidth = 1.5 / zoom;
            const r = 6 / zoom;
            ctx.beginPath();
            ctx.arc(snap.point.x, snap.point.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }, [elements, width, height, panOffset, selectedIds, zoom, textEdit, canvasBg, showGrid, isDark, primaryColor, primaryOverlay, queueImageRepaint]);

    useEffect(() => {
        repaintRef.current = repaint;
        repaint();
        return () => {
            repaintRef.current = () => undefined;
        };
    }, [repaint]);

    useEffect(() => {
        imageRepaintActiveRef.current = true;
        return () => {
            imageRepaintActiveRef.current = false;
            if (imageRepaintFrameRef.current !== null) {
                window.cancelAnimationFrame(imageRepaintFrameRef.current);
                imageRepaintFrameRef.current = null;
            }
        };
    }, []);

    const cancelCurrentDrawing = useCallback(() => {
        const hadDraft = currentElementRef.current !== null;
        drawingRef.current = false;
        pendingLinearRef.current = false;
        currentElementRef.current = null;
        snapRef.current = null;
        if (hadDraft) repaint();
    }, [repaint]);

    const finishCurrentDrawing = useCallback(() => {
        if (readOnlyRef.current) {
            cancelCurrentDrawing();
            return;
        }
        drawingRef.current = false;
        snapRef.current = null;

        const finishedElement = currentElementRef.current;
        if (!finishedElement) {
            pendingLinearRef.current = false;
            repaint();
            return;
        }

        const isLinear = finishedElement.type === 'line' || finishedElement.type === 'arrow';
        const rawDistance = Math.hypot(
            rawEndPointRef.current.x - rawStartPointRef.current.x,
            rawEndPointRef.current.y - rawStartPointRef.current.y,
        );
        const shouldCommit = shouldCommitDrawnElement(finishedElement, zoom, rawDistance);
        if (isLinear && !shouldCommit) {
            // A click (or tiny drag) anchors the first endpoint instead of
            // persisting a zero-length connector.
            pendingLinearRef.current = true;
            repaint();
            return;
        }

        currentElementRef.current = null;
        pendingLinearRef.current = false;
        if (!shouldCommit) {
            repaint();
            return;
        }

        setElements((prev) => {
            history.record(prev);
            return [...prev, finishedElement];
        });
    }, [cancelCurrentDrawing, history, repaint, setElements, zoom]);

    const cancelPointerInteraction = useCallback(() => {
        interactionModeRef.current = 'none';
        activeHandleRef.current = null;
        resizeStartBoundsRef.current = null;
        resizeStartElementsRef.current = [];
        isErasingRef.current = false;
        eraserHistoryRecordedRef.current = false;
        isDraggingRef.current = false;
        isSelectingRef.current = false;
        if (isPanningRef.current && canvasRef.current) canvasRef.current.style.cursor = 'grab';
        isPanningRef.current = false;
        selectionRectRef.current = null;
        pointerUpHandledRef.current = false;
        cancelCurrentDrawing();
        repaint();
    }, [cancelCurrentDrawing, repaint]);

    // A draft belongs to the tool that started it. Switching tools cancels the
    // preview rather than leaving a stale element on canvas.
    useEffect(() => {
        const draft = currentElementRef.current;
        if (draft && draft.type !== activeTool) cancelCurrentDrawing();
    }, [activeTool, cancelCurrentDrawing]);

    useEffect(() => {
        window.addEventListener('blur', cancelPointerInteraction);
        return () => window.removeEventListener('blur', cancelPointerInteraction);
    }, [cancelPointerInteraction]);

    useEffect(() => {
        if (!readOnly) return;
        cancelPointerInteraction();
        setTextEdit((current) => current.active
            ? { x: 0, y: 0, active: false, editingId: null, initialText: '' }
            : current);
    }, [cancelPointerInteraction, readOnly]);

    // ─── 4. KEYBOARD SHORTCUTS ──────────────────────────────────

    useEffect(() => {
        if (!keyboardEnabled) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (textEdit.active) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const isCtrl = e.ctrlKey || e.metaKey;
            if (readOnlyRef.current && isElementMutationShortcut(e)) return;
            const editableSelectedIds = new Set(
                elements
                    .filter((el) => selectedIds.has(el.id) && !isLockedElement(el))
                    .map((el) => el.id),
            );

            if ((e.key === 'Backspace' || e.key === 'Delete') && editableSelectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return prev.map((el) => editableSelectedIds.has(el.id) ? { ...el, isDeleted: true } : el); });
                setSelectedIds(new Set());
                return;
            }
            if (isCtrl && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                setElements((prev) => { const r = history.undo(prev); if (r) { setSelectedIds(new Set()); return r; } return prev; });
                return;
            }
            if ((isCtrl && e.key === 'z' && e.shiftKey) || (isCtrl && e.key === 'y')) {
                e.preventDefault();
                setElements((prev) => { const r = history.redo(prev); if (r) { setSelectedIds(new Set()); return r; } return prev; });
                return;
            }
            if (isCtrl && e.key === 'c' && editableSelectedIds.size > 0) {
                e.preventDefault();
                clipboardRef.current = elements.filter((el) => editableSelectedIds.has(el.id) && !el.isDeleted);
                return;
            }
            if (isCtrl && e.key === 'v' && clipboardRef.current.length > 0) {
                e.preventDefault();
                const pasted = duplicateElements(clipboardRef.current, 20);
                setElements((prev) => { history.record(prev); return [...prev, ...pasted]; });
                setSelectedIds(new Set(pasted.map((el) => el.id)));
                clipboardRef.current = clipboardRef.current.map((el) => ({ ...el, x: el.x + 20, y: el.y + 20 }));
                return;
            }
            if (isCtrl && e.key === 'd' && editableSelectedIds.size > 0) {
                e.preventDefault();
                const duplicated = duplicateElements(
                    elements.filter((el) => editableSelectedIds.has(el.id) && !el.isDeleted),
                );
                setElements((prev) => { history.record(prev); return [...prev, ...duplicated]; });
                setSelectedIds(new Set(duplicated.map((el) => el.id)));
                return;
            }
            if (isCtrl && e.key === 'a') {
                e.preventDefault();
                setSelectedIds(new Set(elements.filter((el) => !el.isDeleted && !isLockedElement(el)).map((el) => el.id)));
                return;
            }
            if (e.key === ']' && editableSelectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return isCtrl ? bringToFront(prev, editableSelectedIds) : moveForward(prev, editableSelectedIds); });
                return;
            }
            if (e.key === '[' && editableSelectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return isCtrl ? sendToBack(prev, editableSelectedIds) : moveBackward(prev, editableSelectedIds); });
                return;
            }
            if (isCtrl && e.key === 'g' && !e.shiftKey && editableSelectedIds.size > 1) {
                e.preventDefault();
                const groupId = generateId();
                setElements((prev) => { history.record(prev); return prev.map((el) => editableSelectedIds.has(el.id) ? { ...el, groupId } : el); });
                return;
            }
            if (isCtrl && e.key === 'G' && e.shiftKey && editableSelectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return prev.map((el) => editableSelectedIds.has(el.id) ? { ...el, groupId: undefined } : el); });
                return;
            }
            // ── Nudge selected elements with arrow keys ────────────────────
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && editableSelectedIds.size > 0) {
                e.preventDefault();
                const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                setElements((prev) => { history.record(prev); return prev.map((el) => editableSelectedIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el); });
                return;
            }

            // ── Escape: deselect + cancel text edit ───────────────────────
            if (e.key === 'Escape') {
                cancelCurrentDrawing();
                setSelectedIds(new Set());
                return;
            }

            // ── Ctrl+0: fit all elements ──────────────────────────────────
            if (isCtrl && e.key === '0') {
                e.preventDefault();
                const active = elementsRef.current.filter((el) => !el.isDeleted);
                if (active.length === 0) { setZoom(1); setPanOffset({ x: 0, y: 0 }); return; }
                let bx1 = Infinity, bx2 = -Infinity, by1 = Infinity, by2 = -Infinity;
                for (const el of active) {
                    const [x1, y1, x2, y2] = getElementBounds(el);
                    bx1 = Math.min(bx1, x1); bx2 = Math.max(bx2, x2);
                    by1 = Math.min(by1, y1); by2 = Math.max(by2, y2);
                }
                const pad = 50;
                const scaleX = (width - pad * 2) / (bx2 - bx1 || 1);
                const scaleY = (height - pad * 2) / (by2 - by1 || 1);
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));
                setZoom(newZoom);
                setPanOffset({ x: pad - bx1 * newZoom, y: pad - by1 * newZoom });
                return;
            }

            // ── Ctrl+Shift+H or Ctrl+Shift+F: fit selection ───────────────
            if (isCtrl && e.shiftKey && (e.key === 'H' || e.key === 'F') && selectedIds.size > 0) {
                e.preventDefault();
                const sel = elementsRef.current.filter((el) => selectedIds.has(el.id) && !el.isDeleted);
                if (sel.length === 0) return;
                let bx1 = Infinity, bx2 = -Infinity, by1 = Infinity, by2 = -Infinity;
                for (const el of sel) {
                    const [x1, y1, x2, y2] = getElementBounds(el);
                    bx1 = Math.min(bx1, x1); bx2 = Math.max(bx2, x2);
                    by1 = Math.min(by1, y1); by2 = Math.max(by2, y2);
                }
                const pad = 50;
                const scaleX = (width - pad * 2) / (bx2 - bx1 || 1);
                const scaleY = (height - pad * 2) / (by2 - by1 || 1);
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));
                setZoom(newZoom);
                setPanOffset({ x: pad - bx1 * newZoom, y: pad - by1 * newZoom });
                return;
            }

        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedIds, textEdit.active, elements, history, width, height, cancelCurrentDrawing, keyboardEnabled]);

    // ─── 5. IMAGE PASTE ─────────────────────────────────────────

    useEffect(() => {
        if (!keyboardEnabled) return;
        const onPaste = (e: ClipboardEvent) => {
            if (readOnlyRef.current || textEdit.active) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (!file) continue;
                    const reader = new FileReader();
                    reader.onload = () => {
                        if (readOnlyRef.current) return;
                        const dataUrl = reader.result as string;
                        const img = new Image();
                        img.onload = () => {
                            if (readOnlyRef.current) return;
                            let w = img.naturalWidth, h = img.naturalHeight;
                            const maxDim = 400;
                            if (w > maxDim || h > maxDim) { const scale = maxDim / Math.max(w, h); w *= scale; h *= scale; }
                            const cx = (width / 2 - panOffset.x) / zoom;
                            const cy = (height / 2 - panOffset.y) / zoom;
                            const imageEl = createElement('image', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, dataUrl } as any);
                            setElements((prev) => { history.record(prev); return [...prev, imageEl]; });
                            setSelectedIds(new Set([imageEl.id]));
                        };
                        img.src = dataUrl;
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [textEdit.active, width, height, panOffset, zoom, history, keyboardEnabled]);

    // ─── 6. POINTER DOWN ────────────────────────────────────────

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            if (!e.isPrimary || e.button !== 0) {
                if (pendingLinearRef.current) cancelCurrentDrawing();
                return;
            }
            canvas.setPointerCapture(e.pointerId);
            const cp = toCanvas(e.clientX, e.clientY);
            const sp = toScreen(e.clientX, e.clientY);

            // View-only boards remain navigable. Treat every primary drag as
            // a pan before any selection or mutation branch can run.
            if (readOnlyRef.current) {
                isPanningRef.current = true;
                panStartRef.current = sp;
                panOffsetStartRef.current = { ...panOffset };
                return;
            }
            const editableSelectedIds = new Set(
                elements
                    .filter((el) => selectedIds.has(el.id) && !isLockedElement(el))
                    .map((el) => el.id),
            );

            // ── SELECT ──
            if (activeTool === 'select') {
                if (editableSelectedIds.size > 0) {
                    const selectedEls = elements.filter((el) => editableSelectedIds.has(el.id) && !el.isDeleted);
                    const singleEl = selectedEls.length === 1 ? selectedEls[0] : null;
                    const isLineOrArrow = singleEl && (singleEl.type === 'line' || singleEl.type === 'arrow');

                    let handles: Handle[];
                    let selBounds: Bounds;
                    if (isLineOrArrow && singleEl && isLinearElement(singleEl)) {
                        const pts = singleEl.points;
                        handles = pts.length >= 2 ? [
                            { position: 'nw', x: singleEl.x + pts[0].x, y: singleEl.y + pts[0].y },
                            { position: 'se', x: singleEl.x + pts[pts.length - 1].x, y: singleEl.y + pts[pts.length - 1].y },
                        ] : [];
                        selBounds = getElementBounds(singleEl);
                    } else if (singleEl) {
                        const ex1 = Math.min(singleEl.x, singleEl.x + singleEl.width);
                        const ey1 = Math.min(singleEl.y, singleEl.y + singleEl.height);
                        const ex2 = Math.max(singleEl.x, singleEl.x + singleEl.width);
                        const ey2 = Math.max(singleEl.y, singleEl.y + singleEl.height);
                        selBounds = [ex1, ey1, ex2, ey2];
                        handles = getHandles(selBounds, singleEl.angle, (ex1 + ex2) / 2, (ey1 + ey2) / 2);
                    } else {
                        const b = getSelectionBounds(elements, editableSelectedIds);
                        if (!b) { handles = []; selBounds = [0, 0, 0, 0]; }
                        else { selBounds = b; handles = getHandles(b); }
                    }

                    for (const handle of handles) {
                        if (hitTestHandle(cp, handle, zoom)) {
                            if (handle.position === 'rotate') {
                                history.record(elements);
                                interactionModeRef.current = 'rotate';
                                activeHandleRef.current = handle;
                                let cx: number, cy: number;
                                if (singleEl) {
                                    const ex1 = Math.min(singleEl.x, singleEl.x + singleEl.width);
                                    const ey1 = Math.min(singleEl.y, singleEl.y + singleEl.height);
                                    cx = ex1 + Math.abs(singleEl.width) / 2;
                                    cy = ey1 + Math.abs(singleEl.height) / 2;
                                } else {
                                    cx = (selBounds[0] + selBounds[2]) / 2;
                                    cy = (selBounds[1] + selBounds[3]) / 2;
                                }
                                rotationCenterRef.current = { x: cx, y: cy };
                                rotationStartAngleRef.current = Math.atan2(cp.y - cy, cp.x - cx);
                                const angles = new Map<string, number>();
                                for (const id of editableSelectedIds) {
                                    const el = elements.find((e) => e.id === id);
                                    if (el) angles.set(id, el.angle);
                                }
                                rotationStartElementAnglesRef.current = angles;
                                resizeStartElementsRef.current = elements.filter((el) => editableSelectedIds.has(el.id) && !el.isDeleted);
                            } else {
                                history.record(elements);
                                interactionModeRef.current = 'resize';
                                activeHandleRef.current = handle;
                                resizeStartBoundsRef.current = selBounds!;
                                resizeStartElementsRef.current = elements.filter((el) => editableSelectedIds.has(el.id) && !el.isDeleted);
                            }
                            return;
                        }
                    }
                }

                // Click on already-selected element → drag
                if (selectedIds.size > 0) {
                    for (let i = elements.length - 1; i >= 0; i--) {
                        const el = elements[i];
                        if (el.isDeleted || isLockedElement(el)) continue;
                        if (selectedIds.has(el.id) && hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                            history.record(elements);
                            isDraggingRef.current = true;
                            dragLastRef.current = cp;
                            return;
                        }
                    }
                }

                // Click new element → select it
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted || isLockedElement(el)) continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        if (e.shiftKey) {
                            setSelectedIds((prev) => {
                                const next = new Set(prev);
                                next.has(el.id) ? next.delete(el.id) : next.add(el.id);
                                return expandSelectionToGroups(elements, next);
                            });
                        } else {
                            setSelectedIds(expandSelectionToGroups(elements, new Set([el.id])));
                            history.record(elements);
                            isDraggingRef.current = true;
                            dragLastRef.current = cp;
                        }
                        return;
                    }
                }

                // Nothing hit → marquee
                isSelectingRef.current = true;
                startPointRef.current = cp;
                selectionRectRef.current = { start: cp, end: cp };
                setSelectedIds(new Set());
                return;
            }

            // ── PAN ──
            if (activeTool === 'pan') {
                isPanningRef.current = true;
                panStartRef.current = sp;
                panOffsetStartRef.current = { ...panOffset };
                return;
            }

            // ── ERASER ──
            if (activeTool === 'eraser') {
                isErasingRef.current = true;
                eraserHistoryRecordedRef.current = false;
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted || isLockedElement(el)) continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        history.record(elements);
                        eraserHistoryRecordedRef.current = true;
                        setElements((prev) => prev.map((e) => e.id === el.id ? { ...e, isDeleted: true } : e));
                        setSelectedIds((prev) => { const next = new Set(prev); next.delete(el.id); return next; });
                        break;
                    }
                }
                return;
            }

            // ── TEXT ──
            if (activeTool === 'text') {
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted || isLockedElement(el) || el.type !== 'text') continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        setSelectedIds(new Set());
                        setTextEdit({ x: el.x, y: el.y, active: true, editingId: el.id, initialText: isTextElement(el) ? el.text : '' });
                        return;
                    }
                }
                setSelectedIds(new Set());
                setTextEdit({ x: cp.x, y: cp.y, active: true, editingId: null, initialText: '' });
                return;
            }

            // ── IMAGE ──
            if (activeTool === 'image') {
                const cp = toCanvas(e.clientX, e.clientY);
                onImageInsertRequest?.(cp.x, cp.y);
                return;
            }

            // ── DRAWING TOOLS ──
            if (!isDrawingTool(activeTool)) return;

            if ((activeTool === 'line' || activeTool === 'arrow') && pendingLinearRef.current) {
                const pending = currentElementRef.current;
                if (pending?.type === activeTool) {
                    drawingRef.current = true;
                    rawEndPointRef.current = cp;
                    updateLinearDraftEndpoint(cp);
                    repaint();
                    return;
                }
                cancelCurrentDrawing();
            }

            drawingRef.current = true;
            rawStartPointRef.current = cp;
            rawEndPointRef.current = cp;

            let drawStart = cp;
            let startSnap: ConnectorSnapResult | null = null;
            if (activeTool === 'line' || activeTool === 'arrow') {
                const rawStart = snapEnabled ? snapToGrid(cp) : cp;
                startSnap = findSnapTarget(rawStart);
                drawStart = startSnap?.point ?? rawStart;
                snapRef.current = startSnap;
            }
            startPointRef.current = drawStart;

            let el: NoteboardElement;
            if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'pen') {
                const initPoint: any = { x: 0, y: 0 };
                if (activeTool === 'pen') initPoint.pressure = e.pressure ?? 0.5;
                el = createElement(activeTool === 'pen' ? 'pen' : activeTool, {
                    x: drawStart.x,
                    y: drawStart.y,
                    points: [initPoint],
                    ...(
                        activeTool === 'line' || activeTool === 'arrow'
                            ? { startBinding: startSnap?.binding ?? null, endBinding: null }
                            : {}
                    ),
                    ...(strokeColor ? { strokeColor } : {}),
                } as any);
            } else {
                el = createElement(activeTool as NoteboardElement['type'], {
                    x: cp.x, y: cp.y, width: 0, height: 0, ...(strokeColor ? { strokeColor } : {}),
                } as any);
            }
            currentElementRef.current = el;
            setSelectedIds(new Set());
        },
        [activeTool, cancelCurrentDrawing, elements, findSnapTarget, panOffset, repaint, selectedIds, snapEnabled, strokeColor, updateLinearDraftEndpoint, zoom, toCanvas, toScreen],
    );

    // ─── 7. POINTER MOVE ────────────────────────────────────────

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;

            // ── Cursor management (idle select mode only) ──────────────────
            // Update the canvas cursor to reflect the handle currently under the pointer.
            // This must run before any early-returns so it stays responsive.
            if (canvas && readOnlyRef.current) {
                canvas.style.cursor = isPanningRef.current ? 'grabbing' : 'grab';
            } else if (
                canvas &&
                activeTool === 'select' &&
                interactionModeRef.current === 'none' &&
                !isDraggingRef.current &&
                !isSelectingRef.current &&
                !isPanningRef.current &&
                !drawingRef.current &&
                selectedIds.size > 0
            ) {
                const cp = toCanvas(e.clientX, e.clientY);
                const selectedEls = elementsRef.current.filter((el) => (
                    selectedIds.has(el.id) && !el.isDeleted && !isLockedElement(el)
                ));
                const editableSelectedIds = new Set(selectedEls.map((el) => el.id));
                const singleEl = selectedEls.length === 1 ? selectedEls[0] : null;
                const isLineOrArrow = singleEl && (singleEl.type === 'line' || singleEl.type === 'arrow');

                let handles: Handle[];
                if (isLineOrArrow && singleEl && isLinearElement(singleEl)) {
                    const pts = singleEl.points;
                    handles = pts.length >= 2 ? [
                        { position: 'nw' as const, x: singleEl.x + pts[0].x, y: singleEl.y + pts[0].y },
                        { position: 'se' as const, x: singleEl.x + pts[pts.length - 1].x, y: singleEl.y + pts[pts.length - 1].y },
                    ] : [];
                } else if (singleEl) {
                    const ex1 = Math.min(singleEl.x, singleEl.x + singleEl.width);
                    const ey1 = Math.min(singleEl.y, singleEl.y + singleEl.height);
                    const ex2 = Math.max(singleEl.x, singleEl.x + singleEl.width);
                    const ey2 = Math.max(singleEl.y, singleEl.y + singleEl.height);
                    handles = getHandles([ex1, ey1, ex2, ey2], singleEl.angle, (ex1 + ex2) / 2, (ey1 + ey2) / 2);
                } else {
                    const b = getSelectionBounds(elementsRef.current, editableSelectedIds);
                    handles = b ? getHandles(b) : [];
                }

                let found = false;
                for (const handle of handles) {
                    if (hitTestHandle(cp, handle, zoom)) {
                        canvas.style.cursor = getCursorForHandle(handle);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // Check if hovering a selected body → move or text cursor
                    let onBody = false;
                    let onText = false;
                    for (const el of selectedEls) {
                        if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                            onBody = true;
                            if (el.type === 'text') onText = true;
                            break;
                        }
                    }
                    canvas.style.cursor = onText ? 'text' : onBody ? 'move' : 'default';
                }
            } else if (
                canvas &&
                activeTool === 'select' &&
                interactionModeRef.current === 'none' &&
                !isDraggingRef.current &&
                !isSelectingRef.current &&
                !isPanningRef.current &&
                !drawingRef.current &&
                selectedIds.size === 0
            ) {
                // No selection — scan all elements to show a preview cursor
                const cp = toCanvas(e.clientX, e.clientY);
                let hoverCursor = 'default';
                for (let i = elementsRef.current.length - 1; i >= 0; i--) {
                    const el = elementsRef.current[i];
                    if (el.isDeleted || isLockedElement(el)) continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        hoverCursor = el.type === 'text' ? 'text' : 'move';
                        break;
                    }
                }
                canvas.style.cursor = hoverCursor;
            } else if (canvas && activeTool !== 'select') {
                // Non-select tools get a custom cursor
                if (activeTool === 'pan') {
                    canvas.style.cursor = isPanningRef.current ? 'grabbing' : 'grab';
                } else if (activeTool === 'text') {
                    canvas.style.cursor = 'text';
                } else if (activeTool === 'line' || activeTool === 'arrow') {
                    canvas.style.cursor = 'cell';
                } else {
                    canvas.style.cursor = 'crosshair';
                }
            } else if (canvas && interactionModeRef.current === 'resize' && activeHandleRef.current) {
                canvas.style.cursor = getCursorForHandle(activeHandleRef.current);
            } else if (canvas && interactionModeRef.current === 'rotate') {
                canvas.style.cursor = 'grabbing';
            }

            // Erasing
            if (isErasingRef.current) {
                const cp = toCanvas(e.clientX, e.clientY);
                const willErase = elementsRef.current.some((element) => (
                    !element.isDeleted
                    && !isLockedElement(element)
                    && hitTestElement(cp, element, HIT_TEST_THRESHOLD)
                ));
                if (willErase && !eraserHistoryRecordedRef.current) {
                    history.record(elementsRef.current);
                    eraserHistoryRecordedRef.current = true;
                }
                if (!willErase) return;
                setElements((prev) => prev.map((el) => (
                    !el.isDeleted
                    && !isLockedElement(el)
                    && hitTestElement(cp, el, HIT_TEST_THRESHOLD)
                ) ? { ...el, isDeleted: true } : el));
                return;
            }

            // Rotation
            if (interactionModeRef.current === 'rotate') {
                const cp = toCanvas(e.clientX, e.clientY);
                const center = rotationCenterRef.current;
                let deltaAngle = Math.atan2(cp.y - center.y, cp.x - center.x) - rotationStartAngleRef.current;
                if (e.shiftKey) deltaAngle = Math.round(deltaAngle / ROTATION_SNAP_ANGLE) * ROTATION_SNAP_ANGLE;
                setElements((prev) => prev.map((el) => {
                    if (!selectedIds.has(el.id) || isLockedElement(el)) return el;
                    return { ...el, angle: (rotationStartElementAnglesRef.current.get(el.id) ?? 0) + deltaAngle };
                }));
                return;
            }

            // Resize
            if (interactionModeRef.current === 'resize' && activeHandleRef.current && resizeStartBoundsRef.current) {
                const cp = toCanvas(e.clientX, e.clientY);
                const pos = activeHandleRef.current.position as HandlePosition;

                if (resizeStartElementsRef.current.length === 1) {
                    const original = resizeStartElementsRef.current[0];

                    // Line / Arrow: move dragged endpoint only
                    if ((original.type === 'line' || original.type === 'arrow') && isLinearElement(original)) {
                        const pts = original.points;
                        if (pts.length >= 2) {
                            const rawEndpoint = snapEnabled ? snapToGrid(cp) : cp;
                            const endpointSnap = findSnapTarget(rawEndpoint, original.id);
                            const endpoint = endpointSnap?.point ?? rawEndpoint;
                            snapRef.current = endpointSnap;
                            setElements((prev) => prev.map((el) => {
                                if (el.id !== original.id) return el;
                                const newPts = [...pts];
                                if (pos === 'nw') {
                                    const lastWorld = { x: original.x + pts[pts.length - 1].x, y: original.y + pts[pts.length - 1].y };
                                    newPts[0] = { x: 0, y: 0 };
                                    for (let i = 1; i < newPts.length; i++) newPts[i] = { x: original.x + pts[i].x - endpoint.x, y: original.y + pts[i].y - endpoint.y };
                                    return {
                                        ...el,
                                        x: endpoint.x,
                                        y: endpoint.y,
                                        points: newPts,
                                        width: lastWorld.x - endpoint.x,
                                        height: lastWorld.y - endpoint.y,
                                        startBinding: endpointSnap?.binding ?? null,
                                    } as NoteboardElement;
                                } else {
                                    newPts[newPts.length - 1] = { x: endpoint.x - original.x, y: endpoint.y - original.y };
                                    return {
                                        ...el,
                                        points: newPts,
                                        width: endpoint.x - original.x,
                                        height: endpoint.y - original.y,
                                        endBinding: endpointSnap?.binding ?? null,
                                    } as NoteboardElement;
                                }
                            }));
                        }
                        return;
                    }

                    // Draw/pen: use actual AABB for scale
                    let ow = Math.abs(original.width), oh = Math.abs(original.height);
                    if ((original.type === 'draw' || original.type === 'pen') && original.points.length > 1) {
                        const xs = original.points.map((p: Point) => p.x);
                        const ys = original.points.map((p: Point) => p.y);
                        ow = Math.max(...xs) - Math.min(...xs);
                        oh = Math.max(...ys) - Math.min(...ys);
                    }
                    if (ow === 0 && oh === 0) return;

                    const ox1 = Math.min(original.x, original.x + original.width);
                    const oy1 = Math.min(original.y, original.y + original.height);
                    const ox2 = Math.max(original.x, original.x + original.width);
                    const oy2 = Math.max(original.y, original.y + original.height);
                    const ocx = (ox1 + ox2) / 2, ocy = (oy1 + oy2) / 2;

                    const localCursor = original.angle !== 0 ? rotatePoint(cp.x, cp.y, ocx, ocy, -original.angle) : cp;
                    let lx1 = ox1, ly1 = oy1, lx2 = ox2, ly2 = oy2;
                    if (pos === 'nw' || pos === 'w' || pos === 'sw') lx1 = localCursor.x;
                    if (pos === 'ne' || pos === 'e' || pos === 'se') lx2 = localCursor.x;
                    if (pos === 'nw' || pos === 'n' || pos === 'ne') ly1 = localCursor.y;
                    if (pos === 'sw' || pos === 's' || pos === 'se') ly2 = localCursor.y;

                    let newW = lx2 - lx1, newH = ly2 - ly1;
                    if (e.shiftKey && (pos === 'nw' || pos === 'ne' || pos === 'sw' || pos === 'se') && ow > 0 && oh > 0) {
                        const aspect = ow / oh;
                        if (Math.abs(newW) / Math.abs(newH) > aspect) newW = Math.sign(newW) * Math.abs(newH) * aspect;
                        else newH = Math.sign(newH) * Math.abs(newW) / aspect;
                        if (pos === 'nw' || pos === 'sw') lx1 = lx2 - newW;
                        if (pos === 'ne' || pos === 'se') lx2 = lx1 + newW;
                        if (pos === 'nw' || pos === 'ne') ly1 = ly2 - newH;
                        if (pos === 'sw' || pos === 'se') ly2 = ly1 + newH;
                    }

                    const anchorLocalX = (pos === 'ne' || pos === 'e' || pos === 'se') ? ox1 : ox2;
                    const anchorLocalY = (pos === 'sw' || pos === 's' || pos === 'se') ? oy1 : oy2;
                    const anchorWorld = original.angle !== 0 ? rotatePoint(anchorLocalX, anchorLocalY, ocx, ocy, original.angle) : { x: anchorLocalX, y: anchorLocalY };
                    const newLocalX = Math.min(lx1, lx2), newLocalY = Math.min(ly1, ly2);
                    const absW = Math.abs(lx2 - lx1), absH = Math.abs(ly2 - ly1);
                    const newCx = newLocalX + absW / 2, newCy = newLocalY + absH / 2;
                    const newAnchorLocalX = (pos === 'ne' || pos === 'e' || pos === 'se') ? newLocalX : newLocalX + absW;
                    const newAnchorLocalY = (pos === 'sw' || pos === 's' || pos === 'se') ? newLocalY : newLocalY + absH;
                    const newAnchorWorld = original.angle !== 0 ? rotatePoint(newAnchorLocalX, newAnchorLocalY, newCx, newCy, original.angle) : { x: newAnchorLocalX, y: newAnchorLocalY };
                    const dx = anchorWorld.x - newAnchorWorld.x, dy = anchorWorld.y - newAnchorWorld.y;

                    setElements((prev) => prev.map((el) => {
                        if (el.id !== original.id) return el;
                        const updates: Record<string, unknown> = {
                            x: newLocalX + dx, y: newLocalY + dy,
                            width: absW * Math.sign(original.width || 1),
                            height: absH * Math.sign(original.height || 1),
                        };
                        if (isLinearElement(original) && ow > 0 && oh > 0) {
                            updates.points = original.points.map((p: Point) => ({ x: p.x * (absW / ow), y: p.y * (absH / oh) }));
                        }
                        return { ...el, ...updates } as NoteboardElement;
                    }));
                    return;
                }

                // Multi-element scale
                const [sx1, sy1, sx2, sy2] = resizeStartBoundsRef.current;
                const startW = sx2 - sx1, startH = sy2 - sy1;
                if (startW === 0 || startH === 0) return;
                let nx1 = sx1, ny1 = sy1, nx2 = sx2, ny2 = sy2;
                if (pos === 'nw' || pos === 'w' || pos === 'sw') nx1 = cp.x;
                if (pos === 'ne' || pos === 'e' || pos === 'se') nx2 = cp.x;
                if (pos === 'nw' || pos === 'n' || pos === 'ne') ny1 = cp.y;
                if (pos === 'sw' || pos === 's' || pos === 'se') ny2 = cp.y;
                let scaleX = (nx2 - nx1) / startW, scaleY = (ny2 - ny1) / startH;
                if (e.shiftKey && (pos === 'nw' || pos === 'ne' || pos === 'sw' || pos === 'se')) {
                    const maxScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
                    scaleX = Math.sign(scaleX) * maxScale; scaleY = Math.sign(scaleY) * maxScale;
                }
                const originX = (pos === 'ne' || pos === 'e' || pos === 'se') ? sx1 : sx2;
                const originY = (pos === 'sw' || pos === 's' || pos === 'se') ? sy1 : sy2;
                setElements((prev) => prev.map((el) => {
                    if (!selectedIds.has(el.id) || isLockedElement(el)) return el;
                    const orig = resizeStartElementsRef.current.find((o) => o.id === el.id);
                    if (!orig) return el;
                    const updates: Record<string, unknown> = {
                        x: originX + (orig.x - originX) * scaleX,
                        y: originY + (orig.y - originY) * scaleY,
                        width: orig.width * scaleX, height: orig.height * scaleY,
                    };
                    if (isLinearElement(orig)) updates.points = orig.points.map((p: Point) => ({ x: p.x * scaleX, y: p.y * scaleY }));
                    return { ...el, ...updates } as NoteboardElement;
                }));
                return;
            }

            // Drag
            if (isDraggingRef.current && selectedIds.size > 0) {
                const cp = toCanvas(e.clientX, e.clientY);
                const dx = cp.x - dragLastRef.current.x, dy = cp.y - dragLastRef.current.y;
                dragLastRef.current = cp;
                setElements((prev) => prev.map((el) => (
                    selectedIds.has(el.id) && !isLockedElement(el)
                        ? { ...el, x: el.x + dx, y: el.y + dy }
                        : el
                )));
                return;
            }

            // Marquee
            if (isSelectingRef.current) {
                const cp = toCanvas(e.clientX, e.clientY);
                selectionRectRef.current = { start: startPointRef.current, end: cp };
                repaint();
                return;
            }

            // Pan
            if (isPanningRef.current) {
                const sp = toScreen(e.clientX, e.clientY);
                setPanOffset({ x: panOffsetStartRef.current.x + (sp.x - panStartRef.current.x), y: panOffsetStartRef.current.y + (sp.y - panStartRef.current.y) });
                return;
            }

            // Drawing
            if ((!drawingRef.current && !pendingLinearRef.current) || !currentElementRef.current) return;
            const cp = toCanvas(e.clientX, e.clientY);
            rawEndPointRef.current = cp;
            const start = startPointRef.current;
            const el = currentElementRef.current;

            if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || el.type === 'triangle'
                || el.type === 'star' || el.type === 'sticky-note' || el.type === 'callout') {
                const rawCp = snapEnabled ? snapToGrid(cp) : cp;
                currentElementRef.current = { ...el, width: rawCp.x - start.x, height: rawCp.y - start.y };
            } else if (el.type === 'line' || el.type === 'arrow') {
                updateLinearDraftEndpoint(cp);
            } else if (el.type === 'pen' && isLinearElement(el)) {
                const newPoint: any = { x: cp.x - start.x, y: cp.y - start.y, pressure: e.pressure ?? 0.5 };
                const allPts = [...el.points, newPoint];
                const xs = allPts.map((p: any) => p.x), ys = allPts.map((p: any) => p.y);
                currentElementRef.current = { ...el, points: allPts, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } as NoteboardElement;
            }
            repaint();
        },
        [activeTool, snapEnabled, zoom, repaint, panOffset, selectedIds, toCanvas, toScreen, findSnapTarget, history, updateLinearDraftEndpoint],
    );

    // ─── 8. POINTER UP ──────────────────────────────────────────

    const onPointerUp = useCallback(() => {
        pointerUpHandledRef.current = true; // Tell window fallback this event was handled
        if (interactionModeRef.current === 'rotate') {
            interactionModeRef.current = 'none';
            activeHandleRef.current = null;
            snapRef.current = null;
            repaint();
            return;
        }
        if (interactionModeRef.current === 'resize') {
            interactionModeRef.current = 'none';
            activeHandleRef.current = null;
            resizeStartBoundsRef.current = null;
            resizeStartElementsRef.current = [];
            snapRef.current = null;
            repaint();
            return;
        }
        if (isErasingRef.current) {
            isErasingRef.current = false;
            eraserHistoryRecordedRef.current = false;
            return;
        }
        if (isDraggingRef.current) { isDraggingRef.current = false; return; }
        if (isSelectingRef.current) {
            isSelectingRef.current = false;
            const sr = selectionRectRef.current;
            selectionRectRef.current = null;
            if (sr) {
                const bounds: Bounds = [Math.min(sr.start.x, sr.end.x), Math.min(sr.start.y, sr.end.y), Math.max(sr.start.x, sr.end.x), Math.max(sr.start.y, sr.end.y)];
                const selected = getElementsInBounds(elements, bounds);
                setSelectedIds(expandSelectionToGroups(elements, new Set(selected.map((el) => el.id))));
            }
            repaint();
            return;
        }
        if (isPanningRef.current) {
            isPanningRef.current = false;
            if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
            return;
        }
        if (!drawingRef.current) return;
        finishCurrentDrawing();
    }, [elements, finishCurrentDrawing, repaint]);

    // ─── Global pointer-up fallback ─────────────────────────────
    // ONLY runs when the canvas React onPointerUp did NOT fire (pointer capture
    // was lost and the release happened outside the canvas). For all normal
    // within-canvas interactions the canvas handler sets pointerUpHandledRef=true
    // and this listener is skipped, so it cannot interfere with dragging.
    useEffect(() => {
        const onWindowPointerUp = () => {
            // Canvas already handled this event — skip
            if (pointerUpHandledRef.current) {
                pointerUpHandledRef.current = false;
                return;
            }
            // Fallback: clean up any interaction that was interrupted (e.g. pointer capture lost)
            if (interactionModeRef.current === 'rotate' || interactionModeRef.current === 'resize') {
                interactionModeRef.current = 'none';
                activeHandleRef.current = null;
                resizeStartBoundsRef.current = null;
                resizeStartElementsRef.current = [];
                snapRef.current = null;
                repaint();
                return;
            }
            if (isErasingRef.current) {
                isErasingRef.current = false;
                eraserHistoryRecordedRef.current = false;
                return;
            }
            if (isDraggingRef.current) { isDraggingRef.current = false; return; }

            // Commit marquee selection even when released outside the canvas
            if (isSelectingRef.current) {
                isSelectingRef.current = false;
                const sr = selectionRectRef.current;
                selectionRectRef.current = null;
                if (sr) {
                    const bounds: Bounds = [
                        Math.min(sr.start.x, sr.end.x), Math.min(sr.start.y, sr.end.y),
                        Math.max(sr.start.x, sr.end.x), Math.max(sr.start.y, sr.end.y),
                    ];
                    const selected = getElementsInBounds(elementsRef.current, bounds);
                    setSelectedIds(expandSelectionToGroups(elementsRef.current, new Set(selected.map((el) => el.id))));
                }
                repaint();
                return;
            }

            if (isPanningRef.current) {
                isPanningRef.current = false;
                if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
                return;
            }

            // Finish any in-progress drawing
            if (drawingRef.current) {
                finishCurrentDrawing();
            }
        };

        window.addEventListener('pointerup', onWindowPointerUp);
        return () => window.removeEventListener('pointerup', onWindowPointerUp);
    }, [finishCurrentDrawing, repaint]);

    // ─── 9. WHEEL (pan & zoom) ──────────────────────────────────

    const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const cursorX = e.clientX - rect.left, cursorY = e.clientY - rect.top;
            const zoomFactor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
            setViewportState((current) => {
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * zoomFactor));
                if (newZoom === current.zoom) return current;
                const zoomRatio = newZoom / current.zoom;
                return {
                    origin: 'local',
                    panOffset: {
                        x: cursorX - (cursorX - current.panOffset.x) * zoomRatio,
                        y: cursorY - (cursorY - current.panOffset.y) * zoomRatio,
                    },
                    zoom: newZoom,
                };
            });
            return;
        }
        const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
        setPanOffset((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
    }, []);

    // ─── 10. TEXT COMMIT ────────────────────────────────────────

    const commitText = useCallback((text: string) => {
        if (readOnlyRef.current) {
            setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
            return;
        }
        const editingEl = textEdit.editingId
            ? elementsRef.current.find((element) => element.id === textEdit.editingId) ?? null
            : null;
        if (editingEl && isLockedElement(editingEl)) {
            setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
            return;
        }
        const trimmed = text.replace(/\n+$/, '');
        if (!trimmed.trim()) {
            if (textEdit.editingId) {
                const editingEl = elementsRef.current.find((e) => e.id === textEdit.editingId);
                if (editingEl && isShapeElement(editingEl)) {
                    setElements((prev) => { history.record(prev); return prev.map((e) => e.id === textEdit.editingId ? { ...e, text: '' } as any : e); });
                } else {
                    setElements((prev) => { history.record(prev); return prev.map((e) => e.id === textEdit.editingId ? { ...e, isDeleted: true } : e); });
                }
            }
            setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
            return;
        }

        let fontSize: number, fontFamily: string;

        if (editingEl && isShapeElement(editingEl)) {
            const shapeEl = editingEl as RectangleElement;
            fontSize = shapeEl.fontSize ?? DEFAULT_FONT_SIZE;
            fontFamily = shapeEl.fontFamily ?? DEFAULT_FONT_FAMILY;
            setElements((prev) => { history.record(prev); return prev.map((e) => e.id === textEdit.editingId ? { ...e, text: trimmed } as any : e); });
            setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
            return;
        }

        if (editingEl && editingEl.type === 'text') {
            fontSize = (editingEl as TextElement).fontSize;
            fontFamily = (editingEl as TextElement).fontFamily;
        } else {
            fontSize = DEFAULT_FONT_SIZE; fontFamily = DEFAULT_FONT_FAMILY;
        }

        const lineHeight = fontSize * DEFAULT_LINE_HEIGHT;
        const lines = trimmed.split('\n');
        let maxWidth = 0;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.font = `${fontSize}px ${fontFamily}`; for (const line of lines) { const m = ctx.measureText(line); if (m.width > maxWidth) maxWidth = m.width; } }
        }
        if (maxWidth === 0) maxWidth = text.length * 10;
        const measuredHeight = Math.max(lineHeight, lines.length * lineHeight);

        if (textEdit.editingId) {
            setElements((prev) => { history.record(prev); return prev.map((e) => e.id === textEdit.editingId ? { ...e, text: trimmed, width: maxWidth, height: measuredHeight } as any : e); });
        } else {
            const el = createElement('text', { x: textEdit.x, y: textEdit.y, text: trimmed, fontSize, fontFamily, width: maxWidth, height: measuredHeight, ...(strokeColor ? { strokeColor } : {}) } as any);
            setElements((prev) => { history.record(prev); return [...prev, el]; });
        }
        setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
    }, [textEdit, history]);

    // ─── 11. DOUBLE-CLICK (text edit) ───────────────────────────

    const onDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if ((activeTool !== 'select' && activeTool !== 'text') || drawingRef.current || pendingLinearRef.current) return;
        const cp = toCanvas(e.clientX, e.clientY);
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.isDeleted || isLockedElement(el)) continue;
            if (el.type === 'text' && hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                setSelectedIds(new Set());
                setTextEdit({ x: el.x, y: el.y, active: true, editingId: el.id, initialText: isTextElement(el) ? el.text : '' });
                return;
            }
            if (isShapeElement(el) && hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                const shapeEl = el as RectangleElement;
                const cx = Math.min(el.x, el.x + el.width) + Math.abs(el.width) / 2;
                const cy = Math.min(el.y, el.y + el.height) + Math.abs(el.height) / 2;
                setSelectedIds(new Set([el.id]));
                setTextEdit({ x: cx, y: cy, active: true, editingId: el.id, initialText: shapeEl.text ?? '' });
                return;
            }
        }
    }, [activeTool, elements, panOffset, zoom, toCanvas]);

    // ── Zoom controls for ZoomHUD ─────────────────────────────
    const zoomIn = useCallback(() => {
        setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
    }, []);

    const zoomReset = useCallback(() => {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
    }, []);

    const fitAll = useCallback(() => {
        const active = elementsRef.current.filter((el) => !el.isDeleted);
        if (active.length === 0) { setZoom(1); setPanOffset({ x: 0, y: 0 }); return; }
        let bx1 = Infinity, bx2 = -Infinity, by1 = Infinity, by2 = -Infinity;
        for (const el of active) {
            const [x1, y1, x2, y2] = getElementBounds(el);
            bx1 = Math.min(bx1, x1); bx2 = Math.max(bx2, x2);
            by1 = Math.min(by1, y1); by2 = Math.max(by2, y2);
        }
        const pad = 50;
        const scaleX = (width - pad * 2) / (bx2 - bx1 || 1);
        const scaleY = (height - pad * 2) / (by2 - by1 || 1);
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));
        setZoom(newZoom);
        setPanOffset({ x: pad - bx1 * newZoom, y: pad - by1 * newZoom });
    }, [width, height]);

    // ─── RETURN ──────────────────────────────────────────────────

    const onPointerLeave = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = readOnlyRef.current || activeTool === 'pan' ? 'grab' : 'default';
        // Clear any stale marquee rectangle so it doesn't linger when pointer
        // exits the canvas mid-drag (the global pointerup handler will commit it)
        if (!isSelectingRef.current && selectionRectRef.current) {
            selectionRectRef.current = null;
            repaint();
        }
    }, [activeTool, repaint]);

    return {
        canvasRef, elements, setElements,
        selectedIds, setSelectedIds,
        textEdit, commitText,
        panOffset, setPanOffset, zoom, setZoom,
        history,
        zoomIn, zoomOut, zoomReset, fitAll,
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancelPointerInteraction, onPointerLeave, onWheel, onDoubleClick },
    };
}
