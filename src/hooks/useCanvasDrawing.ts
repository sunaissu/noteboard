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
import type { NoteboardElement, Point, Bounds, TextElement, RectangleElement } from '../elements/types';
import { isLinearElement, isShapeElement, isLockedElement } from '../elements/types';
import type { Tool } from '../types';
import type { NoteboardViewport } from '../session';
import { createElement, generateId } from '../elements/createElement';
import { duplicateElement } from '../elements/mutateElement';
import { hitTestElement, getElementsInBounds } from '../elements/hitTest';
import { getElementBounds, rotatePoint } from '../elements/bounds';
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
    expandSelectionToGroups, isDrawingTool,
} from './canvasUtils';
import type { Handle, HandlePosition, InteractionMode } from './canvasUtils';

// ─── Re-export for external callers ──────────────────────────
export type { Handle, HandlePosition, InteractionMode };

// ─── Local type guard ─────────────────────────────────────────
function isTextElement(el: NoteboardElement): el is TextElement {
    return el.type === 'text';
}

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
    onImageInsertRequest?: (x: number, y: number) => void;
    /** Seed elements on first mount (from DB load). Uncontrolled — ignored after mount. */
    initialElements?: NoteboardElement[];
    /** Seed viewport on first mount (from a saved NoteboardSession). */
    initialViewport?: NoteboardViewport;
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
    primaryColor = SELECTION_COLOR, primaryOverlay = MARQUEE_FILL, isDark,
    initialElements, initialViewport, externalElements, onElementsChange,
    onViewportChange,
    snapEnabled = false, showGrid = false, onImageInsertRequest,
}: UseCanvasDrawingOptions) {

    // ─── 1. STATE & REFS ────────────────────────────────────────

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [elements, setElementsRaw] = useState<NoteboardElement[]>(
        () => externalElements ?? initialElements ?? [],
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [textEdit, setTextEdit] = useState<TextEditState>({
        x: 0, y: 0, active: false, editingId: null, initialText: '',
    });

    // Controlled / external elements sync (WebSocket, etc.)
    const externalElementsRef = useRef(externalElements);
    useEffect(() => {
        if (externalElements && externalElements !== externalElementsRef.current) {
            externalElementsRef.current = externalElements;
            setElementsRaw(externalElements);
        }
    }, [externalElements]);

    const onElementsChangeRef = useRef(onElementsChange);
    onElementsChangeRef.current = onElementsChange;

    const onViewportChangeRef = useRef(onViewportChange);
    onViewportChangeRef.current = onViewportChange;

    const setElements = useCallback(
        (updater: NoteboardElement[] | ((prev: NoteboardElement[]) => NoteboardElement[])) => {
            setElementsRaw((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                onElementsChangeRef.current?.(next);
                return next;
            });
        },
        [],
    );

    // Pan & zoom
    const [panOffset, setPanOffset] = useState<Point>(
        initialViewport ? { x: initialViewport.panX, y: initialViewport.panY } : { x: 0, y: 0 },
    );
    const [zoom, setZoom] = useState(initialViewport?.zoom ?? 1);

    // Fire onViewportChange whenever pan or zoom changes
    useEffect(() => {
        onViewportChangeRef.current?.({ panX: panOffset.x, panY: panOffset.y, zoom });
    }, [panOffset, zoom]);

    const panStartRef = useRef<Point>({ x: 0, y: 0 });
    const panOffsetStartRef = useRef<Point>({ x: 0, y: 0 });

    // Interaction flags
    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const isSelectingRef = useRef(false);
    const isDraggingRef = useRef(false);
    const isErasingRef = useRef(false);
    const currentElementRef = useRef<NoteboardElement | null>(null);
    const startPointRef = useRef<Point>({ x: 0, y: 0 });
    const dragLastRef = useRef<Point>({ x: 0, y: 0 });
    const selectionRectRef = useRef<{ start: Point; end: Point } | null>(null);
    // Set to true by the canvas React onPointerUp; the global window fallback
    // checks this to avoid double-processing the same event.
    const pointerUpHandledRef = useRef(false);

    // History, clipboard, always-fresh elements ref
    const history = useHistory();
    const elementsRef = useRef(elements);
    elementsRef.current = elements;
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
        switch (activeTool) {
            case 'pan':    canvas.style.cursor = 'grab'; break;
            case 'text':   canvas.style.cursor = 'text'; break;
            case 'eraser': canvas.style.cursor = 'crosshair'; break;
            case 'select': canvas.style.cursor = 'default'; break;
            case 'line':
            case 'arrow':  canvas.style.cursor = 'cell'; break;
            default:       canvas.style.cursor = 'crosshair'; break;
        }
    }, [activeTool]);

    // ── Connector snap helpers ────────────────────────────────────
    // Returns anchor points for a shape (4 edges + 4 corners + center)
    const SNAP_RADIUS = 20; // canvas-space pixels
    const getShapeAnchors = useCallback((el: NoteboardElement): Array<{x: number; y: number}> => {
        if (el.isDeleted || isLinearElement(el)) return [];
        const x1 = Math.min(el.x, el.x + el.width);
        const y1 = Math.min(el.y, el.y + el.height);
        const x2 = Math.max(el.x, el.x + el.width);
        const y2 = Math.max(el.y, el.y + el.height);
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        return [
            { x: cx, y: y1 }, // top
            { x: cx, y: y2 }, // bottom
            { x: x1, y: cy }, // left
            { x: x2, y: cy }, // right
            { x: x1, y: y1 }, // top-left
            { x: x2, y: y1 }, // top-right
            { x: x1, y: y2 }, // bottom-left
            { x: x2, y: y2 }, // bottom-right
            { x: cx, y: cy }, // center
        ];
    }, []);

    const snapRef = useRef<{x: number; y: number} | null>(null); // current snapped anchor (for repaint)

    const findSnapPoint = useCallback((cp: {x: number; y: number}, excludeId?: string): {x: number; y: number} | null => {
        const radius = SNAP_RADIUS / zoom;
        let best: {x: number; y: number} | null = null;
        let bestDist = radius;
        for (const el of elementsRef.current) {
            if (el.id === excludeId) continue;
            for (const anchor of getShapeAnchors(el)) {
                const d = Math.hypot(cp.x - anchor.x, cp.y - anchor.y);
                if (d < bestDist) { bestDist = d; best = anchor; }
            }
        }
        return best;
    }, [zoom, getShapeAnchors]);

    // ─── 3. REPAINT ─────────────────────────────────────────────

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
            renderElement(ctx, el, excludeText);
        }

        // ── Selection overlay ──
        if (selectedIds.size > 0) {
            const selectedEls = allElements.filter((e) => e && selectedIds.has(e.id) && !e.isDeleted);
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
                const combinedBounds = getSelectionBounds(allElements, selectedIds);
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
                    const selBounds = getSelectionBounds(allElements, selectedIds);
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
            ctx.arc(snap.x, snap.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }, [elements, width, height, panOffset, selectedIds, zoom, textEdit, canvasBg, showGrid, isDark, primaryColor, primaryOverlay]);

    useEffect(() => { repaint(); }, [repaint]);

    // ─── 4. KEYBOARD SHORTCUTS ──────────────────────────────────

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (textEdit.active) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const isCtrl = e.ctrlKey || e.metaKey;

            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return prev.map((el) => selectedIds.has(el.id) ? { ...el, isDeleted: true } : el); });
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
            if (isCtrl && e.key === 'c' && selectedIds.size > 0) {
                e.preventDefault();
                clipboardRef.current = elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted);
                return;
            }
            if (isCtrl && e.key === 'v' && clipboardRef.current.length > 0) {
                e.preventDefault();
                const idMap = new Map<string, string>();
                const pasted = clipboardRef.current.map((el) => {
                    const newId = generateId(); idMap.set(el.id, newId);
                    return { ...el, id: newId, x: el.x + 20, y: el.y + 20, groupId: el.groupId ? `paste_${el.groupId}_${Date.now()}` : undefined };
                });
                const groupMap = new Map<string, string>();
                for (const el of pasted) {
                    if (el.groupId) {
                        const origGroup = clipboardRef.current.find((c) => idMap.get(c.id) === el.id)?.groupId;
                        if (origGroup) {
                            if (!groupMap.has(origGroup)) groupMap.set(origGroup, generateId());
                            el.groupId = groupMap.get(origGroup);
                        }
                    }
                }
                setElements((prev) => { history.record(prev); return [...prev, ...pasted]; });
                setSelectedIds(new Set(pasted.map((el) => el.id)));
                clipboardRef.current = clipboardRef.current.map((el) => ({ ...el, x: el.x + 20, y: el.y + 20 }));
                return;
            }
            if (isCtrl && e.key === 'd' && selectedIds.size > 0) {
                e.preventDefault();
                const groupMap = new Map<string, string>();
                const duplicated = elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted).map((el) => {
                    const dup = duplicateElement(el);
                    if (el.groupId) { if (!groupMap.has(el.groupId)) groupMap.set(el.groupId, generateId()); dup.groupId = groupMap.get(el.groupId); }
                    return dup;
                });
                setElements((prev) => { history.record(prev); return [...prev, ...duplicated]; });
                setSelectedIds(new Set(duplicated.map((el) => el.id)));
                return;
            }
            if (isCtrl && e.key === 'a') {
                e.preventDefault();
                setSelectedIds(new Set(elements.filter((el) => !el.isDeleted).map((el) => el.id)));
                return;
            }
            if (e.key === ']' && selectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return isCtrl ? bringToFront(prev, selectedIds) : moveForward(prev, selectedIds); });
                return;
            }
            if (e.key === '[' && selectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return isCtrl ? sendToBack(prev, selectedIds) : moveBackward(prev, selectedIds); });
                return;
            }
            if (isCtrl && e.key === 'g' && !e.shiftKey && selectedIds.size > 1) {
                e.preventDefault();
                const groupId = generateId();
                setElements((prev) => { history.record(prev); return prev.map((el) => selectedIds.has(el.id) ? { ...el, groupId } : el); });
                return;
            }
            if (isCtrl && e.key === 'G' && e.shiftKey && selectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) => { history.record(prev); return prev.map((el) => selectedIds.has(el.id) ? { ...el, groupId: undefined } : el); });
                return;
            }
            // ── Nudge selected elements with arrow keys ────────────────────
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0) {
                e.preventDefault();
                const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                setElements((prev) => { history.record(prev); return prev.map((el) => selectedIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el); });
                return;
            }

            // ── Escape: deselect + cancel text edit ───────────────────────
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
                return;
            }

            // ── Ctrl+0: fit all elements ──────────────────────────────────
            if (isCtrl && e.key === '0') {
                e.preventDefault();
                const active = elementsRef.current.filter((el) => !el.isDeleted);
                if (active.length === 0) { setZoom(1); setPanOffset({ x: 0, y: 0 }); return; }
                let bx1 = Infinity, bx2 = -Infinity, by1 = Infinity, by2 = -Infinity;
                for (const el of active) { bx1 = Math.min(bx1, el.x); bx2 = Math.max(bx2, el.x + el.width); by1 = Math.min(by1, el.y); by2 = Math.max(by2, el.y + el.height); }
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
                for (const el of sel) { bx1 = Math.min(bx1, el.x); bx2 = Math.max(bx2, el.x + el.width); by1 = Math.min(by1, el.y); by2 = Math.max(by2, el.y + el.height); }
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
    }, [selectedIds, textEdit.active, elements, history, width, height]);

    // ─── 5. IMAGE PASTE ─────────────────────────────────────────

    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            if (textEdit.active) return;
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (!file) continue;
                    const reader = new FileReader();
                    reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const img = new Image();
                        img.onload = () => {
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
    }, [textEdit.active, width, height, panOffset, zoom, history]);

    // ─── 6. POINTER DOWN ────────────────────────────────────────

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.setPointerCapture(e.pointerId);
            const cp = toCanvas(e.clientX, e.clientY);
            const sp = toScreen(e.clientX, e.clientY);

            // ── SELECT ──
            if (activeTool === 'select') {
                if (selectedIds.size > 0) {
                    const selectedEls = elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted);
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
                        const b = getSelectionBounds(elements, selectedIds);
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
                                for (const id of selectedIds) {
                                    const el = elements.find((e) => e.id === id);
                                    if (el) angles.set(id, el.angle);
                                }
                                rotationStartElementAnglesRef.current = angles;
                                resizeStartElementsRef.current = elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted);
                            } else {
                                history.record(elements);
                                interactionModeRef.current = 'resize';
                                activeHandleRef.current = handle;
                                resizeStartBoundsRef.current = selBounds!;
                                resizeStartElementsRef.current = elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted);
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
                history.record(elements);
                isErasingRef.current = true;
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted) continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
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
                    if (el.isDeleted || el.type !== 'text') continue;
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
            drawingRef.current = true;
            startPointRef.current = cp;

            let el: NoteboardElement;
            if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'pen') {
                const initPoint: any = { x: 0, y: 0 };
                if (activeTool === 'pen') initPoint.pressure = e.pressure ?? 0.5;
                el = createElement(activeTool === 'pen' ? 'pen' : activeTool, {
                    x: cp.x, y: cp.y, points: [initPoint], ...(strokeColor ? { strokeColor } : {}),
                } as any);
            } else {
                el = createElement(activeTool as NoteboardElement['type'], {
                    x: cp.x, y: cp.y, width: 0, height: 0, ...(strokeColor ? { strokeColor } : {}),
                } as any);
            }
            currentElementRef.current = el;
            setSelectedIds(new Set());
        },
        [activeTool, elements, panOffset, selectedIds, strokeColor, zoom, toCanvas, toScreen],
    );

    // ─── 7. POINTER MOVE ────────────────────────────────────────

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;

            // ── Cursor management (idle select mode only) ──────────────────
            // Update the canvas cursor to reflect the handle currently under the pointer.
            // This must run before any early-returns so it stays responsive.
            if (
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
                const selectedEls = elementsRef.current.filter((el) => selectedIds.has(el.id) && !el.isDeleted);
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
                    const b = getSelectionBounds(elementsRef.current, selectedIds);
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
                    if (el.isDeleted) continue;
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
                setElements((prev) => prev.map((el) => (!el.isDeleted && hitTestElement(cp, el, HIT_TEST_THRESHOLD)) ? { ...el, isDeleted: true } : el));
                return;
            }

            // Rotation
            if (interactionModeRef.current === 'rotate') {
                const cp = toCanvas(e.clientX, e.clientY);
                const center = rotationCenterRef.current;
                let deltaAngle = Math.atan2(cp.y - center.y, cp.x - center.x) - rotationStartAngleRef.current;
                if (e.shiftKey) deltaAngle = Math.round(deltaAngle / ROTATION_SNAP_ANGLE) * ROTATION_SNAP_ANGLE;
                setElements((prev) => prev.map((el) => {
                    if (!selectedIds.has(el.id)) return el;
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
                            setElements((prev) => prev.map((el) => {
                                if (el.id !== original.id) return el;
                                const newPts = [...pts];
                                if (pos === 'nw') {
                                    const lastWorld = { x: original.x + pts[pts.length - 1].x, y: original.y + pts[pts.length - 1].y };
                                    newPts[0] = { x: 0, y: 0 };
                                    for (let i = 1; i < newPts.length; i++) newPts[i] = { x: original.x + pts[i].x - cp.x, y: original.y + pts[i].y - cp.y };
                                    return { ...el, x: cp.x, y: cp.y, points: newPts, width: lastWorld.x - cp.x, height: lastWorld.y - cp.y } as NoteboardElement;
                                } else {
                                    newPts[newPts.length - 1] = { x: cp.x - original.x, y: cp.y - original.y };
                                    return { ...el, points: newPts, width: cp.x - original.x, height: cp.y - original.y } as NoteboardElement;
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
                    if (!selectedIds.has(el.id)) return el;
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
                setElements((prev) => prev.map((el) => selectedIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el));
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
            if (!drawingRef.current || !currentElementRef.current) return;
            const cp = toCanvas(e.clientX, e.clientY);
            const start = startPointRef.current;
            const el = currentElementRef.current;

            if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || el.type === 'triangle'
                || el.type === 'frame' || el.type === 'star') {
                const rawCp = snapEnabled ? snapToGrid(cp) : cp;
                currentElementRef.current = { ...el, width: rawCp.x - start.x, height: rawCp.y - start.y };
            } else if (el.type === 'line' || el.type === 'arrow') {
                const rawCp = snapEnabled ? snapToGrid(cp) : cp;
                // Connector snap: snap the free endpoint to nearby shape anchors
                const snapped = findSnapPoint(rawCp, currentElementRef.current?.id);
                snapRef.current = snapped;
                const endPt = snapped ?? rawCp;
                currentElementRef.current = { ...el, points: [{ x: 0, y: 0 }, { x: endPt.x - start.x, y: endPt.y - start.y }], width: endPt.x - start.x, height: endPt.y - start.y } as NoteboardElement;
            } else if (el.type === 'pen' && isLinearElement(el)) {
                const newPoint: any = { x: cp.x - start.x, y: cp.y - start.y, pressure: e.pressure ?? 0.5 };
                const allPts = [...el.points, newPoint];
                const xs = allPts.map((p: any) => p.x), ys = allPts.map((p: any) => p.y);
                currentElementRef.current = { ...el, points: allPts, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } as NoteboardElement;
            }
            repaint();
        },
        [activeTool, snapEnabled, zoom, repaint, panOffset, selectedIds, toCanvas, toScreen, findSnapPoint],
    );

    // ─── 8. POINTER UP ──────────────────────────────────────────

    const onPointerUp = useCallback(() => {
        pointerUpHandledRef.current = true; // Tell window fallback this event was handled
        if (interactionModeRef.current === 'rotate') { interactionModeRef.current = 'none'; activeHandleRef.current = null; return; }
        if (interactionModeRef.current === 'resize') { interactionModeRef.current = 'none'; activeHandleRef.current = null; resizeStartBoundsRef.current = null; resizeStartElementsRef.current = []; return; }
        if (isErasingRef.current) { isErasingRef.current = false; return; }
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
        if (isPanningRef.current) { isPanningRef.current = false; return; }
        if (!drawingRef.current) return;
        drawingRef.current = false;
        snapRef.current = null; // clear connector snap highlight
        const finishedElement = currentElementRef.current;
        currentElementRef.current = null;
        if (finishedElement) {
            let finalEl = { ...finishedElement };
            if (finalEl.width === 0 && finalEl.height === 0) {
                if (finalEl.type === 'rectangle' || finalEl.type === 'ellipse' || finalEl.type === 'diamond' || finalEl.type === 'star') {
                    finalEl.width = 100; finalEl.height = 100;
                } else if (finalEl.type === 'text') {
                    finalEl.width = 20; finalEl.height = 20;
                }
                
                if (finalEl.width !== 0) {
                    finalEl.x = finalEl.x - finalEl.width / 2;
                    finalEl.y = finalEl.y - finalEl.height / 2;
                }
            }
            setElements((prev) => { history.record(prev); return [...prev, finalEl]; });
        }
    }, [elements, repaint, history]);

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
                return;
            }
            if (isErasingRef.current) { isErasingRef.current = false; return; }
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

            if (isPanningRef.current) { isPanningRef.current = false; return; }

            // Finish any in-progress drawing
            if (drawingRef.current) {
                drawingRef.current = false;
                const finishedElement = currentElementRef.current;
                currentElementRef.current = null;
                if (finishedElement) {
                    let finalEl = { ...finishedElement };
                    if (finalEl.width === 0 && finalEl.height === 0) {
                        if (finalEl.type === 'rectangle' || finalEl.type === 'ellipse' || finalEl.type === 'diamond' || finalEl.type === 'star') {
                            finalEl.width = 100; finalEl.height = 100;
                        } else if (finalEl.type === 'text') {
                            finalEl.width = 20; finalEl.height = 20;
                        }
                        if (finalEl.width !== 0) {
                            finalEl.x = finalEl.x - finalEl.width / 2;
                            finalEl.y = finalEl.y - finalEl.height / 2;
                        }
                    }
                    setElements((prev) => { history.record(prev); return [...prev, finalEl]; });
                }
            }
        };

        window.addEventListener('pointerup', onWindowPointerUp);
        return () => window.removeEventListener('pointerup', onWindowPointerUp);
    }, [repaint, history, setElements]);

    // ─── 9. WHEEL (pan & zoom) ──────────────────────────────────

    const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const cursorX = e.clientX - rect.left, cursorY = e.clientY - rect.top;
            const zoomFactor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
            setZoom((prevZoom) => {
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * zoomFactor));
                setPanOffset((prevPan) => ({ x: cursorX - (cursorX - prevPan.x) * (newZoom / prevZoom), y: cursorY - (cursorY - prevPan.y) * (newZoom / prevZoom) }));
                return newZoom;
            });
            return;
        }
        const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
        setPanOffset((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
    }, []);

    // ─── 10. TEXT COMMIT ────────────────────────────────────────

    const commitText = useCallback((text: string) => {
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

        const editingEl = textEdit.editingId ? elementsRef.current.find((e) => e.id === textEdit.editingId) : null;
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
        const cp = toCanvas(e.clientX, e.clientY);
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (el.isDeleted) continue;
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
    }, [elements, panOffset, zoom, toCanvas]);

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
        for (const el of active) { bx1 = Math.min(bx1, el.x); bx2 = Math.max(bx2, el.x + el.width); by1 = Math.min(by1, el.y); by2 = Math.max(by2, el.y + el.height); }
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
        if (canvas) canvas.style.cursor = 'default';
        // Clear any stale marquee rectangle so it doesn't linger when pointer
        // exits the canvas mid-drag (the global pointerup handler will commit it)
        if (!isSelectingRef.current && selectionRectRef.current) {
            selectionRectRef.current = null;
            repaint();
        }
    }, [repaint]);

    return {
        canvasRef, elements, setElements,
        selectedIds, setSelectedIds,
        textEdit, commitText,
        panOffset, setPanOffset, zoom, setZoom,
        history,
        zoomIn, zoomOut, zoomReset, fitAll,
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onWheel, onDoubleClick },
    };
}
