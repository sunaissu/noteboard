import { useRef, useCallback, useEffect, useState } from 'react';
import type { ExcalidrawElement, Point, Bounds, TextElement } from '../elements/types';
import { isLinearElement } from '../elements/types';
import type { Tool } from '../types';
import { createElement } from '../elements/createElement';
import { hitTestElement, getElementsInBounds } from '../elements/hitTest';
import { getElementBounds } from '../elements/bounds';
import { renderElement } from '../renderer';
import {
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FAMILY,
    DEFAULT_LINE_HEIGHT,
    SELECTION_COLOR,
    HIT_TEST_THRESHOLD,
    SELECTION_PAD,
    SELECTION_DASH,
    MARQUEE_DASH,
    MARQUEE_FILL,
    MIN_ZOOM,
    MAX_ZOOM,
    ZOOM_STEP,
    ARROWHEAD_LENGTH,
    ARROWHEAD_WIDTH,
} from '../constants';

// ─── Type Guards ─────────────────────────────────────────────

function isTextElement(el: ExcalidrawElement): el is TextElement {
    return el.type === 'text';
}

interface UseCanvasDrawingOptions {
    activeTool: Tool;
    width: number;
    height: number;
}

export interface TextEditState {
    x: number;
    y: number;
    active: boolean;
    editingId: string | null; // null = new text, string = editing existing element
    initialText: string;
}

export function useCanvasDrawing({ activeTool, width, height }: UseCanvasDrawingOptions) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [elements, setElements] = useState<ExcalidrawElement[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [textEdit, setTextEdit] = useState<TextEditState>({ x: 0, y: 0, active: false, editingId: null, initialText: '' });

    // Pan & zoom state
    const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const panStartRef = useRef<Point>({ x: 0, y: 0 });
    const panOffsetStartRef = useRef<Point>({ x: 0, y: 0 });

    // Drawing / interaction state
    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const isSelectingRef = useRef(false);
    const isDraggingRef = useRef(false);
    const isErasingRef = useRef(false);
    const currentElementRef = useRef<ExcalidrawElement | null>(null);
    const startPointRef = useRef<Point>({ x: 0, y: 0 });
    const dragLastRef = useRef<Point>({ x: 0, y: 0 });

    // Selection marquee corners (canvas coordinates)
    const selectionRectRef = useRef<{ start: Point; end: Point } | null>(null);

    // ─── Repaint ──────────────────────────────────────────────

    const repaint = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Scale canvas buffer for high-DPI screens
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        const allElements = currentElementRef.current
            ? [...elements, currentElementRef.current]
            : elements;

        // Draw all elements (skip the one being actively edited in the textarea)
        for (const el of allElements) {
            if (!el || el.isDeleted) continue;
            if (textEdit.active && textEdit.editingId === el.id) continue;
            renderElement(ctx, el);
        }

        // Draw selection highlight for each selected element
        if (selectedIds.size > 0) {
            ctx.save();
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.lineWidth = 1;
            ctx.setLineDash(SELECTION_DASH);
            for (const id of selectedIds) {
                const sel = allElements.find((e) => e && e.id === id && !e.isDeleted);
                if (sel) {
                    const bounds = getElementBounds(sel);
                    ctx.strokeRect(
                        bounds[0] - SELECTION_PAD,
                        bounds[1] - SELECTION_PAD,
                        bounds[2] - bounds[0] + SELECTION_PAD * 2,
                        bounds[3] - bounds[1] + SELECTION_PAD * 2,
                    );
                }
            }
            ctx.restore();
        }

        // Draw selection marquee rectangle
        const sr = selectionRectRef.current;
        if (sr) {
            ctx.save();
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.fillStyle = MARQUEE_FILL;
            ctx.lineWidth = 1;
            ctx.setLineDash(MARQUEE_DASH);
            const sx = Math.min(sr.start.x, sr.end.x);
            const sy = Math.min(sr.start.y, sr.end.y);
            const sw = Math.abs(sr.end.x - sr.start.x);
            const sh = Math.abs(sr.end.y - sr.start.y);
            ctx.fillRect(sx, sy, sw, sh);
            ctx.strokeRect(sx, sy, sw, sh);
            ctx.restore();
        }

        ctx.restore();
    }, [elements, width, height, panOffset, selectedIds, zoom, textEdit]);

    useEffect(() => {
        repaint();
    }, [repaint]);

    // ─── Keyboard: Delete / Backspace ─────────────────────────

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Don't handle if user is typing in the text input
            if (textEdit.active) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.size > 0) {
                e.preventDefault();
                setElements((prev) =>
                    prev.map((el) =>
                        selectedIds.has(el.id) ? { ...el, isDeleted: true } : el,
                    ),
                );
                setSelectedIds(new Set());
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedIds, textEdit.active]);

    // ─── Tool helpers ─────────────────────────────────────────

    const isDrawingTool = (tool: Tool): boolean =>
        tool === 'rectangle' || tool === 'line' || tool === 'arrow' || tool === 'pen';

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
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }, []);

    // ─── Pointer Down ─────────────────────────────────────────

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.setPointerCapture(e.pointerId);

            const cp = toCanvas(e.clientX, e.clientY);
            const sp = toScreen(e.clientX, e.clientY);

            // ── SELECT ──
            if (activeTool === 'select') {
                // First check if we clicked on an already-selected element → start drag
                if (selectedIds.size > 0) {
                    for (let i = elements.length - 1; i >= 0; i--) {
                        const el = elements[i];
                        if (el.isDeleted) continue;
                        if (selectedIds.has(el.id) && hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                            isDraggingRef.current = true;
                            dragLastRef.current = cp;
                            return;
                        }
                    }
                }

                // Otherwise check if we clicked on any element → single select it
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted) continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        setSelectedIds(new Set([el.id]));
                        isDraggingRef.current = true;
                        dragLastRef.current = cp;
                        return;
                    }
                }

                // Nothing hit → begin marquee selection
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

            // ── ERASER (continuous while held) ──
            if (activeTool === 'eraser') {
                isErasingRef.current = true;
                // Erase first hit immediately
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted) continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        setElements((prev) =>
                            prev.map((e) => (e.id === el.id ? { ...e, isDeleted: true } : e)),
                        );
                        setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(el.id);
                            return next;
                        });
                        break;
                    }
                }
                return;
            }

            // ── TEXT ──
            if (activeTool === 'text') {
                // Check if clicking on an existing text element to edit it
                for (let i = elements.length - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.isDeleted || el.type !== 'text') continue;
                    if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                        setSelectedIds(new Set());
                        setTextEdit({
                            x: el.x,
                            y: el.y,
                            active: true,
                            editingId: el.id,
                            initialText: isTextElement(el) ? el.text : '',
                        });
                        return;
                    }
                }
                // No existing text hit — create new
                setSelectedIds(new Set());
                setTextEdit({ x: cp.x, y: cp.y, active: true, editingId: null, initialText: '' });
                return;
            }

            // ── DRAWING TOOLS ──
            if (!isDrawingTool(activeTool)) return;

            drawingRef.current = true;
            startPointRef.current = cp;

            let el: ExcalidrawElement;

            if (activeTool === 'line' || activeTool === 'arrow' || activeTool === 'pen') {
                el = createElement(
                    activeTool === 'pen' ? 'pen' : activeTool,
                    {
                        x: cp.x,
                        y: cp.y,
                        points: [{ x: 0, y: 0 }],
                    } as any,
                );
            } else if (activeTool === 'rectangle') {
                el = createElement('rectangle', {
                    x: cp.x,
                    y: cp.y,
                    width: 0,
                    height: 0,
                });
            } else {
                return;
            }

            currentElementRef.current = el;
            setSelectedIds(new Set());
        },
        [activeTool, elements, panOffset, selectedIds, zoom, toCanvas, toScreen],
    );

    // ─── Pointer Move ─────────────────────────────────────────

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            // Erasing while pointer held
            if (isErasingRef.current) {
                const cp = toCanvas(e.clientX, e.clientY);
                setElements((prev) =>
                    prev.map((el) => {
                        if (el.isDeleted) return el;
                        if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                            return { ...el, isDeleted: true };
                        }
                        return el;
                    }),
                );
                return;
            }

            // Dragging selected elements
            if (isDraggingRef.current && selectedIds.size > 0) {
                const cp = toCanvas(e.clientX, e.clientY);
                const dx = cp.x - dragLastRef.current.x;
                const dy = cp.y - dragLastRef.current.y;
                dragLastRef.current = cp;

                setElements((prev) =>
                    prev.map((el) => {
                        if (!selectedIds.has(el.id)) return el;
                        return { ...el, x: el.x + dx, y: el.y + dy };
                    }),
                );
                return;
            }

            // Selection marquee
            if (isSelectingRef.current) {
                const cp = toCanvas(e.clientX, e.clientY);
                selectionRectRef.current = {
                    start: startPointRef.current,
                    end: cp,
                };
                repaint();
                return;
            }

            // Pan
            if (isPanningRef.current) {
                const sp = toScreen(e.clientX, e.clientY);
                setPanOffset({
                    x: panOffsetStartRef.current.x + (sp.x - panStartRef.current.x),
                    y: panOffsetStartRef.current.y + (sp.y - panStartRef.current.y),
                });
                return;
            }

            // Drawing
            if (!drawingRef.current || !currentElementRef.current) return;

            const cp = toCanvas(e.clientX, e.clientY);
            const start = startPointRef.current;
            const el = currentElementRef.current;

            if (el.type === 'rectangle') {
                currentElementRef.current = {
                    ...el,
                    width: cp.x - start.x,
                    height: cp.y - start.y,
                };
            } else if (el.type === 'line' || el.type === 'arrow') {
                currentElementRef.current = {
                    ...el,
                    points: [
                        { x: 0, y: 0 },
                        { x: cp.x - start.x, y: cp.y - start.y },
                    ],
                    width: cp.x - start.x,
                    height: cp.y - start.y,
                } as ExcalidrawElement;
            } else if (el.type === 'pen' && isLinearElement(el)) {
                const prevPoints = el.points;
                currentElementRef.current = {
                    ...el,
                    points: [...prevPoints, { x: cp.x - start.x, y: cp.y - start.y }],
                    width: Math.max(el.width, cp.x - start.x),
                    height: Math.max(el.height, cp.y - start.y),
                };
            }

            repaint();
        },
        [repaint, panOffset, selectedIds, toCanvas, toScreen],
    );

    // ─── Pointer Up ───────────────────────────────────────────

    const onPointerUp = useCallback(() => {
        // End erasing
        if (isErasingRef.current) {
            isErasingRef.current = false;
            return;
        }

        // End drag
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            return;
        }

        // End selection marquee
        if (isSelectingRef.current) {
            isSelectingRef.current = false;
            const sr = selectionRectRef.current;
            selectionRectRef.current = null;

            if (sr) {
                const bounds: Bounds = [
                    Math.min(sr.start.x, sr.end.x),
                    Math.min(sr.start.y, sr.end.y),
                    Math.max(sr.start.x, sr.end.x),
                    Math.max(sr.start.y, sr.end.y),
                ];
                const selected = getElementsInBounds(elements, bounds);
                setSelectedIds(new Set(selected.map((el) => el.id)));
            }
            repaint();
            return;
        }

        // End panning
        if (isPanningRef.current) {
            isPanningRef.current = false;
            return;
        }

        // End drawing
        if (!drawingRef.current) return;
        drawingRef.current = false;

        const finishedElement = currentElementRef.current;
        currentElementRef.current = null;

        if (finishedElement) {
            setElements((prev) => [...prev, finishedElement]);
        }
    }, [elements, repaint]);

    // ─── Wheel: scroll to pan ─────────────────────────────────

    const onWheel = useCallback(
        (e: React.WheelEvent<HTMLCanvasElement>) => {
            e.preventDefault();

            // Ctrl+scroll → zoom toward cursor
            if (e.ctrlKey || e.metaKey) {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const cursorX = e.clientX - rect.left;
                const cursorY = e.clientY - rect.top;

                const zoomFactor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
                setZoom((prevZoom) => {
                    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * zoomFactor));
                    // Adjust pan so zoom is centered on cursor
                    setPanOffset((prevPan) => ({
                        x: cursorX - (cursorX - prevPan.x) * (newZoom / prevZoom),
                        y: cursorY - (cursorY - prevPan.y) * (newZoom / prevZoom),
                    }));
                    return newZoom;
                });
                return;
            }

            // Shift+scroll → horizontal pan
            const dx = e.shiftKey ? e.deltaY : e.deltaX;
            const dy = e.shiftKey ? 0 : e.deltaY;
            setPanOffset((prev) => ({
                x: prev.x - dx,
                y: prev.y - dy,
            }));
        },
        [],
    );

    // ─── Text commit ──────────────────────────────────────────

    const commitText = useCallback(
        (text: string) => {
            // Trim trailing empty lines
            const trimmed = text.replace(/\n+$/, '');

            if (!trimmed.trim()) {
                // If editing an existing element and cleared the text, delete it
                if (textEdit.editingId) {
                    setElements((prev) =>
                        prev.map((e) =>
                            e.id === textEdit.editingId ? { ...e, isDeleted: true } : e,
                        ),
                    );
                }
                setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
                return;
            }

            // Measure text accurately using an offscreen canvas
            const fontSize = DEFAULT_FONT_SIZE;
            const fontFamily = DEFAULT_FONT_FAMILY;
            const lineHeight = fontSize * DEFAULT_LINE_HEIGHT;
            const lines = trimmed.split('\n');
            let maxWidth = 0;

            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.font = `${fontSize}px ${fontFamily}`;
                    for (const line of lines) {
                        const m = ctx.measureText(line);
                        if (m.width > maxWidth) maxWidth = m.width;
                    }
                }
            }

            // Fallback if canvas not available
            if (maxWidth === 0) maxWidth = text.length * 10;
            const measuredHeight = Math.max(lineHeight, lines.length * lineHeight);

            if (textEdit.editingId) {
                // Update existing text element
                setElements((prev) =>
                    prev.map((e) =>
                        e.id === textEdit.editingId
                            ? { ...e, text: trimmed, width: maxWidth, height: measuredHeight } as any
                            : e,
                    ),
                );
            } else {
                // Create new text element
                const el = createElement('text', {
                    x: textEdit.x,
                    y: textEdit.y,
                    text: trimmed,
                    fontSize,
                    fontFamily,
                    width: maxWidth,
                    height: measuredHeight,
                } as any);
                setElements((prev) => [...prev, el]);
            }
            setTextEdit({ x: 0, y: 0, active: false, editingId: null, initialText: '' });
        },
        [textEdit],
    );

    // ─── Double-click: edit text elements ────────────────

    const onDoubleClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const cp = toCanvas(e.clientX, e.clientY);
            for (let i = elements.length - 1; i >= 0; i--) {
                const el = elements[i];
                if (el.isDeleted || el.type !== 'text') continue;
                if (hitTestElement(cp, el, HIT_TEST_THRESHOLD)) {
                    setSelectedIds(new Set());
                    setTextEdit({
                        x: el.x,
                        y: el.y,
                        active: true,
                        editingId: el.id,
                        initialText: isTextElement(el) ? el.text : '',
                    });
                    return;
                }
            }
        },
        [elements, panOffset, zoom, toCanvas],
    );

    return {
        canvasRef,
        elements,
        setElements,
        selectedIds,
        setSelectedIds,
        textEdit,
        commitText,
        panOffset,
        zoom,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onWheel,
            onDoubleClick,
        },
    };
}
