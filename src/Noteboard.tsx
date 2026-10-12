import { exportBoardImage, renderBoardImage } from './exportImage';
import { BoardNavigator } from './components/BoardNavigator';
import { combineBounds, getElementBounds } from './elements/bounds';
import { moveTextPosition } from './textEdit';
import React, { useState, useCallback, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { SettingsPanel } from './components/SettingsPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ShapePicker, SHAPE_KEYS } from './components/ShapePicker';
import { ZoomHUD } from './components/ZoomHUD';
import { ShortcutModal } from './components/ShortcutModal';
import { ContextMenu } from './components/ContextMenu';
import type { ContextMenuItem } from './components/ContextMenu';
import { useToolbarShortcuts } from './hooks/useToolbarShortcuts';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import {
    alignLeft, alignRight, alignTop, alignBottom, alignCenterH, alignCenterV,
    distributeH, distributeV,
} from './hooks/useAlign';
import { DEFAULT_SLOTS } from './toolRegistry';
import { ThemeContext, LIGHT_THEME, DARK_THEME, applyNoteboardBrandColors, useResolvedNoteboardTheme } from './ThemeContext';
import type { NoteboardThemeMode } from './ThemeContext';
import type { NoteboardProps, NoteboardRef, Tool, ShapeVariant } from './types';
import { MAX_BOARD_IMPORT_BYTES, deserializeBoard, serializeBoard } from './session';
import { generateId, createImageElement } from './elements/createElement';
import { duplicateElements } from './elements/mutateElement';
import {
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FAMILY,
    MIN_ZOOM,
    MAX_ZOOM,
    SELECTION_COLOR,
 } from './constants';
import { isLockedElement, isShapeElement } from './elements/types';


function resizeTextInput(textarea: HTMLTextAreaElement) {
    textarea.style.height = '0px';
    textarea.style.height = textarea.scrollHeight + 2 + 'px';
    textarea.style.width = 'auto';
    textarea.style.width = Math.max(textarea.scrollWidth + 2, 2) + 'px';
}

export const Noteboard = forwardRef<NoteboardRef, NoteboardProps>((
    {
        slots = DEFAULT_SLOTS,
        maxImageBytes = 5 * 1024 * 1024, maxImagePixels = 16_000_000,
        history: externalHistory,
        toolbarPosition = 'bottom',
        propertiesPosition = 'left',
        onToolSelect,
        activeTool: controlledTool,
        theme: themeProp,
        defaultTheme = 'system',
        themeOverrides,
        brandColors,
        onThemeChange,
        // ── View / Edit mode ──
        readOnly: controlledReadOnly,
        defaultReadOnly = false,
        onViewportChange,
        // ── Persistence & multiplayer ──
        initialElements,
        initialViewport,
        viewport: externalViewport,
        elements: externalElements,
        onElementsChange,
        acceptElementsChange,
        onSave,
        boardId,
        threadId,
    },
    ref,
) => {
    const [internalTool, setInternalTool] = useState<Tool>('select');
    const [internalReadOnly] = useState(defaultReadOnly);
    const isReadOnly = controlledReadOnly ?? internalReadOnly;
    const readOnlyRef = useRef(isReadOnly);
    readOnlyRef.current = isReadOnly;
    const importGeneration = useRef(0);
    useEffect(() => () => { importGeneration.current++; }, []);
    const [shortcutOpen, setShortcutOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    const handleShowShortcuts = useCallback(() => setShortcutOpen(true), []);
    const handleCloseShortcuts = useCallback(() => setShortcutOpen(false), []);
    const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

    const [activeShape, setActiveShape] = useState<ShapeVariant>('rectangle');
    const [snapEnabled, setSnapEnabled] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pasteImageRef = useRef<(file: File) => void>(() => {});
    const imageInsertPosRef = useRef<{ x: number; y: number } | null>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });
    const isControlledThemeMode = typeof themeProp === 'string';
    const legacyThemeOverrides = typeof themeProp === 'object' ? themeProp : undefined;
    const [internalThemeMode, setInternalThemeMode] = useState<NoteboardThemeMode>(defaultTheme);
    const themeMode = isControlledThemeMode ? themeProp : internalThemeMode;
    const resolvedThemeMode = useResolvedNoteboardTheme(themeMode);
    const isDark = resolvedThemeMode === 'dark';

    const resolvedTheme = useMemo(
        () => ({
            ...applyNoteboardBrandColors(
                { ...(isDark ? DARK_THEME : LIGHT_THEME), ...legacyThemeOverrides },
                brandColors,
            ),
            ...themeOverrides,
        }),
        [brandColors, isDark, legacyThemeOverrides, themeOverrides],
    );

    const handleThemeChange = useCallback((nextTheme: NoteboardThemeMode) => {
        if (!isControlledThemeMode) setInternalThemeMode(nextTheme);
        onThemeChange?.(nextTheme);
    }, [isControlledThemeMode, onThemeChange]);

    const currentTool = controlledTool ?? internalTool;

    const handleToolSelect = useCallback(
        (tool: Tool) => {
            if (!controlledTool) {
                setInternalTool(tool);
            }
            onToolSelect?.(tool);
        },
        [controlledTool, onToolSelect],
    );

    const handleShapeSelect = useCallback(
        (shape: ShapeVariant) => {
            setActiveShape(shape);
            // Also switch the tool to this shape
            if (!controlledTool) {
                setInternalTool(shape);
            }
            onToolSelect?.(shape);
        },
        [controlledTool, onToolSelect],
    );

    useToolbarShortcuts(slots, handleToolSelect, isFocused);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isFocused || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === '?') setShortcutOpen((v) => !v);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isFocused]);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isFocused || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
            // Skip if typing in an input
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const shape = SHAPE_KEYS[e.key.toLowerCase()];
            if (shape) {
                handleShapeSelect(shape);
                return;
            }

            // G = toggle grid
            if (e.key === 'g' || e.key === 'G') {
                setShowGrid((v) => !v);
                setSnapEnabled((v) => !v);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleShapeSelect, isFocused]);

    // Track container size
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setSize({ width: Math.floor(width), height: Math.floor(height) });
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // React's delegated wheel listener can be passive. Cancel the browser's
    // default scroll here, before React applies canvas pan/zoom.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.target === canvasRef.current || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                return;
            }
            // Let nested inspectors/textareas scroll, but never chain a wheel
            // gesture from their edges into the host page.
            let target = e.target instanceof Element ? e.target : null;
            while (target && target !== container) {
                if (target instanceof HTMLElement) {
                    const style = getComputedStyle(target);
                    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
                    const dy = e.shiftKey ? 0 : e.deltaY;
                    if (target.dataset.scrollAxis === 'horizontal' && target.scrollWidth > target.clientWidth) {
                        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
                        const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? target.clientWidth : 1;
                        target.scrollLeft += delta * units;
                        e.preventDefault();
                        return;
                    }
                    const canScroll = (position: number, extent: number, delta: number) => delta < 0 ? position > 0 : delta > 0 && position < extent - 1;
                    if ((/(auto|scroll)/.test(style.overflowY) && canScroll(target.scrollTop, target.scrollHeight - target.clientHeight, dy)) ||
                        (/(auto|scroll)/.test(style.overflowX) && canScroll(target.scrollLeft, target.scrollWidth - target.clientWidth, dx))) return;
                }
                target = target.parentElement;
            }
            e.preventDefault();
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // Inject Google Fonts (Inter) — once
    useEffect(() => {
        const id = 'noteboard-google-fonts';
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(link);
    }, []);

    // Properties panel and toolbar must not share the same edge — warn and fall back
    const OPPOSITE_EDGE: Record<string, string> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    let resolvedPropertiesPosition = propertiesPosition;
    if (propertiesPosition === toolbarPosition) {
        resolvedPropertiesPosition = OPPOSITE_EDGE[toolbarPosition] as typeof propertiesPosition;
        console.warn(
            `[Noteboard] "propertiesPosition" and "toolbarPosition" cannot both be "${toolbarPosition}". ` +
            `Falling back to "${resolvedPropertiesPosition}". ` +
            `Please set them to different edges.`,
        );
    }

    const useCanvasDrawingResult = useCanvasDrawing({
        activeTool: currentTool,
        history: externalHistory,
        width: size.width,
        height: size.height,
        canvasBg: resolvedTheme.canvasBg,
        strokeColor: resolvedTheme.strokeColor,
        primaryColor: resolvedTheme.primaryColor,
        primaryOverlay: resolvedTheme.primaryOverlay,
        isDark,
        readOnly: isReadOnly,
        keyboardEnabled: isFocused,
        snapEnabled,
        showGrid,
        initialElements,
        initialViewport,
        externalViewport,
        externalElements,
        onElementsChange,
        acceptElementsChange,
        onViewportChange,
        onImagePaste: file => { imageInsertPosRef.current = null; pasteImageRef.current(file); },
        onImageInsertRequest: useCallback((x: number, y: number) => {
            imageInsertPosRef.current = { x, y };
            fileInputRef.current?.click();
        }, []),
    });

    const {
        canvasRef,
        handlers,
        textEdit,
        commitText, recoveredText, clearRecoveredText,
        panOffset,
        setPanOffset,
        zoom,
        setZoom,
        elements,
        setElements,
        selectedIds,
        setSelectedIds,
        history,
        zoomIn, zoomOut, zoomReset, fitAll,
    } = useCanvasDrawingResult;

    const handleImageFile = useCallback((file: File) => {
        if (readOnlyRef.current) return;
        const byteLimit = Number.isFinite(maxImageBytes) ? Math.min(maxImageBytes, 5 * 1024 * 1024) : 5 * 1024 * 1024;
        const pixelLimit = Number.isFinite(maxImagePixels) ? Math.min(maxImagePixels, 16_000_000) : 16_000_000;
        if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) || file.size <= 0 || file.size > byteLimit) { alert('Choose a PNG, JPEG, GIF, or WebP within the image size limit.'); return; }
        const generation = ++importGeneration.current;

        const pos = imageInsertPosRef.current ?? { x: (size.width / 2 - panOffset.x) / zoom, y: (size.height / 2 - panOffset.y) / zoom };

        const reader = new FileReader();
        reader.onerror = () => alert("The image file could not be read.");
        reader.onload = (ev) => {
            if (readOnlyRef.current || generation !== importGeneration.current) return;
            const dataUrl = ev.target?.result as string;
            if (!dataUrl) return;

            const img = new Image();
            img.onerror = () => alert("The image could not be decoded.");
            img.onload = () => {
                if (readOnlyRef.current || generation !== importGeneration.current) return;
                if (img.naturalWidth <= 0 || img.naturalHeight <= 0 || img.naturalWidth * img.naturalHeight > pixelLimit) { alert("The image exceeds the image pixel limit. Resize it first."); return; }
                const scale = Math.min(1, size.width * .6 / img.naturalWidth, size.height * .6 / img.naturalHeight);
                const el = createImageElement({
                    x: pos.x,
                    y: pos.y,
                    width: img.naturalWidth * scale,
                    height: img.naturalHeight * scale,
                    dataUrl,
                });
                setElements((prev) => {
                    history.record(prev);
                    return [...prev, el];
                });
                if (!controlledTool) setInternalTool('select');
                onToolSelect?.('select');
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);

        // Reset file input so the same file can be uploaded again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [maxImageBytes, maxImagePixels, zoom, panOffset, size, setElements, history, controlledTool, onToolSelect]);

    pasteImageRef.current = handleImageFile;
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) handleImageFile(file);
    };

    const focusElements = useCallback((ids: string[]) => {
        const selected = new Set(ids);
        const targets = elements.filter(element => selected.has(element.id) && !element.isDeleted);
        if (!targets.length) return;
        const bounds = targets.map(getElementBounds);
        const [left, top, right, bottom] = combineBounds(bounds);
        const scale = Math.max(MIN_ZOOM, Math.min(2, (size.width - 80) / Math.max(1, right - left), (size.height - 80) / Math.max(1, bottom - top)));
        setSelectedIds(new Set(ids)); setZoom(scale);
        setPanOffset({ x: size.width / 2 - (left + right) / 2 * scale, y: size.height / 2 - (top + bottom) / 2 * scale });
    }, [elements, size, setSelectedIds, setZoom, setPanOffset]);
    useImperativeHandle(ref, () => ({
        focusElements,
        getElements() {
            return elements;
        },
        setElements(newElements) {
            if (isReadOnly) return;
            setElements((previous) => { history.record(previous); return newElements; });
        },
        setViewport(newViewport) {
            const nextZoom = Number.isFinite(newViewport.zoom)
                ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newViewport.zoom))
                : 1;
            setPanOffset({
                x: Number.isFinite(newViewport.panX) ? newViewport.panX : 0,
                y: Number.isFinite(newViewport.panY) ? newViewport.panY : 0,
            });
            setZoom(nextZoom);
        },
        getSession() {
            return serializeBoard(
                elements,
                { panX: panOffset.x, panY: panOffset.y, zoom },
                {
                    threadId: threadId ?? 'default-thread',
                    boardId: boardId ?? 'default-board',
                },
            );
        },
        exportImage(format = 'png', options) {
            return renderBoardImage(elements, format, { background: resolvedTheme.canvasBg, ...options });
        },
        exportImageAsync(format = 'png', options) {
            return exportBoardImage(elements, format, { background: resolvedTheme.canvasBg, ...options });
        },
    }), [elements, setElements, setPanOffset, setZoom, panOffset, zoom, threadId, boardId, isReadOnly, history, focusElements, resolvedTheme.canvasBg]);

    const handleSave = useCallback(() => {
        if (!onSave) return;
        const session = serializeBoard(
            elements,
            { panX: panOffset.x, panY: panOffset.y, zoom },
            {
                threadId: threadId ?? 'default-thread',
                boardId: boardId ?? 'default-board',
            },
        );
        onSave(session);
    }, [onSave, elements, panOffset, zoom, threadId, boardId]);

    const handleExportImage = useCallback(async (format: 'png' | 'jpeg' = 'png') => {
        try {
            const url = await exportBoardImage(elements, format, { background: resolvedTheme.canvasBg });
            const link = document.createElement('a');
            link.download = `noteboard-export-${new Date().toISOString().slice(0, 10)}.${format}`;
            link.href = url; link.click();
        } catch (error) { alert(error instanceof Error ? error.message : 'Export failed'); }
    }, [elements, resolvedTheme.canvasBg]);

    const handleExportJSON = useCallback(() => {
        const session = serializeBoard(
            elements,
            { panX: panOffset.x, panY: panOffset.y, zoom },
            { threadId: threadId ?? 'default-thread', boardId: boardId ?? 'default-board' }
        );
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.download = `noteboard-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }, [elements, panOffset, zoom, threadId, boardId]);

    const jsonInputRef = useRef<HTMLInputElement>(null);
    const triggerImportJSON = useCallback(() => {
        jsonInputRef.current?.click();
    }, []);

    const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || readOnlyRef.current) return;
        const generation = ++importGeneration.current;
        if (file.size > MAX_BOARD_IMPORT_BYTES) {
            alert('Failed to load Noteboard file. The file is too large.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => alert("The board file could not be read.");
        reader.onload = (event) => {
            if (readOnlyRef.current || generation !== importGeneration.current) return;
            try {
                const snapshot = deserializeBoard(JSON.parse(event.target?.result as string));
                if (!window.confirm(`Replace this board with ${snapshot.elements.length} imported objects? You can undo this action.`)) return;
                setElements((previous) => {
                    history.record(previous);
                    return snapshot.elements;
                });
                setPanOffset({ x: snapshot.viewport.panX, y: snapshot.viewport.panY });
                setZoom(snapshot.viewport.zoom);
            } catch (err) {
                console.error("Failed to parse JSON", err);
                alert("Failed to load Noteboard file. The file might be corrupted.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset so the same file can be selected again
    }, [setElements, setPanOffset, setZoom, history]);

    const handleClearCanvas = useCallback(() => {
        if (window.confirm('Are you sure you want to clear the entire board?')) {
            setElements((prev) => {
                history.record(prev);
                return [];
            });
        }
    }, [setElements, history]);
    const selectedElements = React.useMemo(
        () => elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted),
        [elements, selectedIds],
    );

    const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
    const [toolbarHeight, setToolbarHeight] = useState(0);
    useEffect(() => {
        const panel = containerRef.current?.querySelector<HTMLElement>('[aria-label="Object properties"]');
        if (!panel || isReadOnly || !selectedElements.length) { setPanelSize({ width: 0, height: 0 }); return; }
        const measure = () => setPanelSize(previous => previous.width === panel.offsetWidth && previous.height === panel.offsetHeight ? previous : { width: panel.offsetWidth, height: panel.offsetHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(panel);
        return () => observer.disconnect();
    }, [isReadOnly, selectedElements.length, resolvedPropertiesPosition]);
    useEffect(() => {
        const toolbar = containerRef.current?.querySelector<HTMLElement>('[data-noteboard-toolbar]');
        if (!toolbar) { setToolbarHeight(0); return; }
        const measure = () => setToolbarHeight(toolbar.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(toolbar);
        return () => observer.disconnect();
    }, [isReadOnly, toolbarPosition]);
    const toolbarOffset = toolbarPosition === resolvedPropertiesPosition && selectedElements.length && !isReadOnly
        ? 24 + (toolbarPosition === 'top' || toolbarPosition === 'bottom' ? panelSize.height : panelSize.width) : 12;
    const zoomBottom = Math.max(12,
        !isReadOnly && toolbarPosition === 'bottom' ? toolbarOffset + toolbarHeight + 12 : 0,
        !isReadOnly && selectedElements.length && resolvedPropertiesPosition === 'bottom' ? panelSize.height + 24 : 0);

    // Look up the element being edited (for shape text editing font resolution)
    const editingElement = React.useMemo(
        () => textEdit.editingId ? elements.find((el) => el.id === textEdit.editingId) : null,
        [elements, textEdit.editingId],
    );

    const handleUpdateElements = useCallback(
        (updates: Record<string, any>) => {
            setElements((prev) => {
                const editableIds = new Set(
                    prev
                        .filter((el) => selectedIds.has(el.id) && !isLockedElement(el))
                        .map((el) => el.id),
                );
                if (editableIds.size === 0) return prev;
                history.record(prev);
                return prev.map((el) =>
                    editableIds.has(el.id) ? { ...el, ...updates } : el,
                );
            });
        },
        [history, selectedIds, setElements],
    );
    const makeAlignCallback = useCallback((fn: (els: typeof elements, ids: Set<string>) => typeof elements) => () => {
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size === 0) return prev;
            history.record(prev);
            return fn(prev, editableIds);
        });
    }, [selectedIds, setElements, history]);

    const handleAlignLeft    = makeAlignCallback(alignLeft);
    const handleAlignRight   = makeAlignCallback(alignRight);
    const handleAlignTop     = makeAlignCallback(alignTop);
    const handleAlignBottom  = makeAlignCallback(alignBottom);
    const handleAlignCenterH = makeAlignCallback(alignCenterH);
    const handleAlignCenterV = makeAlignCallback(alignCenterV);
    const handleDistributeH  = makeAlignCallback(distributeH);
    const handleDistributeV  = makeAlignCallback(distributeV);
    const handleBringForward = useCallback(() => {
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size === 0) return prev;
            history.record(prev);
            const result = [...prev];
            for (let i = result.length - 2; i >= 0; i--) {
                if (editableIds.has(result[i].id) && !editableIds.has(result[i + 1].id)) {
                    [result[i], result[i + 1]] = [result[i + 1], result[i]];
                }
            }
            return result;
        });
    }, [selectedIds, setElements, history]);

    const handleSendBackward = useCallback(() => {
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size === 0) return prev;
            history.record(prev);
            const result = [...prev];
            for (let i = 1; i < result.length; i++) {
                if (editableIds.has(result[i].id) && !editableIds.has(result[i - 1].id)) {
                    [result[i - 1], result[i]] = [result[i], result[i - 1]];
                }
            }
            return result;
        });
    }, [selectedIds, setElements, history]);

    const handleBringToFront = useCallback(() => {
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size === 0) return prev;
            history.record(prev);
            const rest = prev.filter((el) => !editableIds.has(el.id));
            const sel = prev.filter((el) => editableIds.has(el.id));
            return [...rest, ...sel];
        });
    }, [selectedIds, setElements, history]);

    const handleSendToBack = useCallback(() => {
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size === 0) return prev;
            history.record(prev);
            const sel = prev.filter((el) => editableIds.has(el.id));
            const rest = prev.filter((el) => !editableIds.has(el.id));
            return [...sel, ...rest];
        });
    }, [selectedIds, setElements, history]);

    const handleGroup = useCallback(() => {
        const groupId = generateId();
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size < 2) return prev;
            history.record(prev);
            return prev.map((el) => editableIds.has(el.id) ? { ...el, groupId } : el);
        });
    }, [selectedIds, setElements, history]);

    const handleUngroup = useCallback(() => {
        setElements((prev) => {
            const editableIds = new Set(
                prev.filter((el) => selectedIds.has(el.id) && !isLockedElement(el)).map((el) => el.id),
            );
            if (editableIds.size === 0) return prev;
            history.record(prev);
            return prev.map((el) => editableIds.has(el.id) ? { ...el, groupId: undefined } : el);
        });
    }, [selectedIds, setElements, history]);

    const handleToggleLock = useCallback(() => {
        setElements((prev) => {
            const shouldLock = prev.some((el) => selectedIds.has(el.id) && !el.locked);
            if (!prev.some((el) => selectedIds.has(el.id))) return prev;
            history.record(prev);
            return prev.map((el) =>
                selectedIds.has(el.id) ? { ...el, locked: shouldLock } : el,
            );
        });
    }, [selectedIds, setElements, history]);

    // Focus text input when it appears and auto-size for existing content
    const textMountedRef = useRef(false);
    const textComposingRef = useRef(false);
    const textBaseRef = useRef('');
    useEffect(() => {
        const textarea = textInputRef.current;
        const element = elements.find(element => element.id === textEdit.editingId);
        if (!textarea || textComposingRef.current || !element || !('text' in element)) return;
        const value = element.text ?? '';
        if (textarea.value !== value) {
            const before = textarea.value;
            const start = moveTextPosition(textarea.selectionStart, before, value);
            const end = moveTextPosition(textarea.selectionEnd, before, value);
            const direction = textarea.selectionDirection;
            textarea.value = value;
            textarea.setSelectionRange(start, end, direction);
        }
        resizeTextInput(textarea);
        textBaseRef.current = value;
    }, [elements, textEdit.editingId]);
    useEffect(() => {
        if (textEdit.active && textInputRef.current) {
            textMountedRef.current = false;
            const ta = textInputRef.current;
            // Auto-size to fit existing multi-line content
            resizeTextInput(ta);
            // Delay focus slightly to avoid immediate blur issues
            requestAnimationFrame(() => {
                if (textInputRef.current) {
                    textInputRef.current.focus();
                    textMountedRef.current = true;
                }
            });
        } else {
            textMountedRef.current = false;
        }
    }, [textEdit.active, textEdit.editingId]);

    useEffect(() => {
        if (isReadOnly && textInputRef.current) commitText(textInputRef.current.value);
    }, [isReadOnly, commitText]);

    const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation(); // Prevent canvas keyboard shortcuts from firing
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            const restored = e.shiftKey ? history.redo(elements) : history.undo(elements);
            if (restored) setElements(restored);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            commitText(e.currentTarget.value);
        }
    };

    const handleTextBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        // Guard: ignore blur if textarea just mounted (avoids premature dismissal)
        if (!textMountedRef.current) return;
        commitText(e.currentTarget.value);
    };

    return (
        <ThemeContext.Provider value={resolvedTheme}>
            <div
                ref={containerRef}
                data-theme={resolvedThemeMode}
                data-theme-mode={themeMode}
                tabIndex={0}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    overscrollBehavior: 'contain',
                    outline: isFocused ? `2px solid ${resolvedTheme.primaryColor ?? resolvedTheme.buttonActiveColor}` : 'none',
                    outlineOffset: '-2px',
                    background: resolvedTheme.canvasBg,
                    transition: 'background 0.3s ease',
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: textEdit.active ? 'none' : 'auto',
                        cursor: isReadOnly ? 'grab' : undefined,
                    }}
                    onPointerDownCapture={() => containerRef.current?.focus({ preventScroll: true })}
                    onPointerDown={handlers.onPointerDown}
                    onPointerMove={handlers.onPointerMove}
                    onPointerUp={handlers.onPointerUp}
                    onPointerCancel={handlers.onPointerCancel}
                    onPointerLeave={handlers.onPointerLeave}
                    onWheel={handlers.onWheel}
                    onDoubleClick={isReadOnly ? undefined : handlers.onDoubleClick}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (isReadOnly) return;
                        const bounds = containerRef.current!.getBoundingClientRect();
                        setContextMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
                    }}
                />

                {textEdit.active && (() => {
                    const isShapeEdit = !!(editingElement && isShapeElement(editingElement));
                    const eany = editingElement as any;

                    const elFontSize = eany?.fontSize ?? DEFAULT_FONT_SIZE;
                    const elFontFamily = eany?.fontFamily ?? DEFAULT_FONT_FAMILY;
                    let elTextAlign = eany?.textAlign ?? (isShapeEdit ? 'center' : 'left');
                    const elFontWeight = eany?.fontWeight ?? 'normal';
                    const elFontStyle = eany?.fontStyle ?? 'normal';
                    const elTextDecoration = eany?.textDecoration ?? 'none';
                    let lhMultiplier = eany?.lineHeight ?? (isShapeEdit ? 1.3 : 1.25);

                    const screenX = (editingElement ? editingElement.x + (isShapeEdit ? editingElement.width / 2 : elTextAlign === 'center' ? editingElement.width / 2 : elTextAlign === 'right' ? editingElement.width : 0) : textEdit.x) * zoom + panOffset.x;
                    const screenY = (editingElement ? editingElement.y + (isShapeEdit ? editingElement.height / 2 : 0) : textEdit.y) * zoom + panOffset.y;

                    let leftPos = screenX;
                    let topPos = screenY;
                    let transformStr = '';
                    let fixedWidth: string | undefined;
                    let fixedHeight: string | undefined;

                    if (isShapeEdit) {
                        const padding = 8 * zoom;
                        const w = Math.abs(editingElement!.width) * zoom;

                        // textEdit.x is cx, textEdit.y is cy (vertically centered)
                        if (elTextAlign === 'center') {
                            transformStr = 'translate(-50%, -50%)';
                        } else if (elTextAlign === 'left') {
                            leftPos = screenX - w/2 + padding - 3;
                            transformStr = 'translateY(-50%)';
                        } else if (elTextAlign === 'right') {
                            leftPos = screenX + w/2 - padding + 3;
                            transformStr = 'translate(-100%, -50%)';
                        }
                    } else {
                        // Standalone text: top-aligned
                        topPos -= 2; // account for top boundary
                        if (elTextAlign === 'center') {
                            transformStr = 'translateX(-50%)';
                        } else if (elTextAlign === 'left') {
                            leftPos -= 3;
                        } else if (elTextAlign === 'right') {
                            leftPos += 3;
                            transformStr = 'translateX(-100%)';
                        }
                    }

                    return (
                        <textarea
                            key={`edit-${textEdit.x}-${textEdit.y}`}
                            ref={textInputRef}
                            rows={1}
                            autoFocus
                            defaultValue={textEdit.initialText}
                            style={{
                                position: 'absolute',
                                left: leftPos,
                                top: topPos,
                                transform: `${transformStr} rotate(${editingElement?.angle ?? 0}rad)`,
                                width: fixedWidth,
                                height: fixedHeight,
                                minWidth: fixedWidth ? undefined : 2,
                                fontSize: elFontSize * zoom,
                                fontFamily: `'${elFontFamily.split(',')[0].trim()}', sans-serif`,
                                fontWeight: elFontWeight,
                                fontStyle: elFontStyle,
                                textDecoration: elTextDecoration,
                                border: `1px solid ${resolvedTheme.primaryColor ?? SELECTION_COLOR}`,
                                borderRadius: 2,
                                padding: '1px 2px',
                                margin: 0,
                                outline: 'none',
                                background: 'transparent',
                                resize: 'none',
                                overflow: 'hidden',
                                zIndex: 1001,
                                color: resolvedTheme.textInputColor,
                                lineHeight: lhMultiplier,
                                whiteSpace: 'pre',
                                caretColor: resolvedTheme.primaryColor ?? SELECTION_COLOR,
                                boxShadow: 'none',
                                boxSizing: 'border-box',
                                wordBreak: 'keep-all',
                                textAlign: elTextAlign as any,
                            }}
                            onKeyDown={handleTextKeyDown}
                            onBlur={handleTextBlur}
                            onCompositionStart={() => { textComposingRef.current = true; }}
                            onCompositionEnd={e => { textComposingRef.current = false; commitText(e.currentTarget.value, false, textBaseRef.current); textBaseRef.current = e.currentTarget.value; }}
                            onInput={(e) => {
                                const ta = e.currentTarget;
                                if (!(e.nativeEvent as InputEvent).isComposing) { commitText(ta.value, false, textBaseRef.current); textBaseRef.current = ta.value; }
                                resizeTextInput(ta);
                            }}
                        />
                    );
                })()}



                {recoveredText !== null && <div role="alert" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 'min(360px, calc(100% - 32px))', zIndex: 2000, padding: 14, borderRadius: 10, background: resolvedTheme.panelBg, color: resolvedTheme.panelTextColor, boxShadow: resolvedTheme.toolbarShadow }}>
                    <strong>Your text is safe here.</strong><p>Editing ended because the object was removed, locked, or your edit permission changed. Copy your text before dismissing.</p>
                    <textarea readOnly aria-label="Recovered text" value={recoveredText} style={{ width: '100%', boxSizing: 'border-box', minHeight: 80 }} />
                    <button type="button" onClick={clearRecoveredText}>Dismiss</button>
                </div>}
                {!isReadOnly && (
                    <Toolbar
                        slots={slots}
                        position={toolbarPosition}
                        edgeOffset={toolbarOffset}
                        activeTool={currentTool}
                        onToolSelect={handleToolSelect}
                        activeShape={activeShape}
                        onUndo={() => setElements((prev) => { const r = history.undo(prev); if (r) { return r; } return prev; })}
                        onRedo={() => setElements((prev) => { const r = history.redo(prev); if (r) { return r; } return prev; })}
                        canUndo={history.canUndo()}
                        canRedo={history.canRedo()}
                    />
                )}

                {!isReadOnly && (
                    <ShapePicker
                        activeShape={activeShape}
                        activeTool={currentTool}
                        onSelectShape={handleShapeSelect}
                        toolbarPosition={toolbarPosition}
                    />
                )}

                <SettingsPanel
                    themeMode={themeMode}
                    resolvedTheme={resolvedThemeMode}
                    onThemeChange={handleThemeChange}
                    showGrid={showGrid}
                    onToggleGrid={() => {
                        setShowGrid((v) => !v);
                        setSnapEnabled((v) => !v);
                    }}
                    onSave={onSave ? handleSave : undefined}
                    onExportImage={handleExportImage}
                    onExportJSON={handleExportJSON}
                    onImportJSON={isReadOnly ? undefined : triggerImportJSON}
                    onClearCanvas={isReadOnly ? undefined : handleClearCanvas}
                    onShowShortcuts={handleShowShortcuts}
                >
                    <BoardNavigator elements={elements} viewport={{ panX: panOffset.x, panY: panOffset.y, zoom }} size={size} onFocus={focusElements} onViewport={viewport => { setZoom(viewport.zoom); setPanOffset({ x: viewport.panX, y: viewport.panY }); }} />
                </SettingsPanel>

                {!isReadOnly && (
                    <PropertiesPanel
                        selectedElements={selectedElements}
                        onUpdateElements={handleUpdateElements}
                        onBringForward={handleBringForward}
                        onSendBackward={handleSendBackward}
                        onBringToFront={handleBringToFront}
                        onSendToBack={handleSendToBack}
                        onGroup={handleGroup}
                        onUngroup={handleUngroup}
                        onToggleLock={handleToggleLock}
                        onAlignLeft={handleAlignLeft}
                        onAlignCenterH={handleAlignCenterH}
                        onAlignRight={handleAlignRight}
                        onAlignTop={handleAlignTop}
                        onAlignCenterV={handleAlignCenterV}
                        onAlignBottom={handleAlignBottom}
                        onDistributeH={handleDistributeH}
                        onDistributeV={handleDistributeV}
                        isDark={isDark}
                        position={resolvedPropertiesPosition}
                    />
                )}

                <ZoomHUD
                    bottom={zoomBottom}
                    zoom={zoom}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onReset={zoomReset}
                    onFitAll={fitAll}
                />

                <ShortcutModal open={shortcutOpen} onClose={handleCloseShortcuts} />

                {isReadOnly && (
                    <div style={{
                        position: 'absolute',
                        top: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 20,
                        background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(8px)',
                        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)',
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: '0.03em',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 900,
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        View only
                    </div>
                )}

                {contextMenu && (() => {
                    const editableSelectedIds = new Set(
                        elements
                            .filter((element) => selectedIds.has(element.id) && !element.isDeleted && !isLockedElement(element))
                            .map((element) => element.id),
                    );
                    const hasSelection = editableSelectedIds.size > 0;
                    const items: ContextMenuItem[] = [
                        {
                            label: 'Copy',
                            icon: '📋',
                            disabled: !hasSelection,
                            onClick: () => { /* clipboard is internal to hook; trigger keyboard copy */ document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true })); },
                        },
                        {
                            label: 'Paste',
                            icon: '📌',
                            onClick: () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true })); },
                        },
                        {
                            label: 'Duplicate',
                            icon: '⎘',
                            disabled: !hasSelection,
                            onClick: () => {
                                const dupes = duplicateElements(
                                    elements.filter((el) => editableSelectedIds.has(el.id) && !el.isDeleted),
                                );
                                setElements((prev) => { history.record(prev); return [...prev, ...dupes]; });
                            },
                        },
                        { separator: true },
                        {
                            label: 'Bring Forward',
                            icon: '⇑',
                            disabled: !hasSelection,
                            onClick: handleBringForward,
                        },
                        {
                            label: 'Send Backward',
                            icon: '⇓',
                            disabled: !hasSelection,
                            onClick: handleSendBackward,
                        },
                        {
                            label: 'Bring to Front',
                            icon: '⏫',
                            disabled: !hasSelection,
                            onClick: handleBringToFront,
                        },
                        {
                            label: 'Send to Back',
                            icon: '⏬',
                            disabled: !hasSelection,
                            onClick: handleSendToBack,
                        },
                        { separator: true },
                        {
                            label: 'Select All',
                            icon: '□',
                            onClick: () => {
                                const ids = new Set(
                                    elements
                                        .filter((el) => !el.isDeleted && !isLockedElement(el))
                                        .map((el) => el.id),
                                );
                                setSelectedIds(ids);
                            },
                        },
                        {
                            label: 'Delete',
                            icon: '🗑️',
                            danger: true,
                            disabled: !hasSelection,
                            onClick: () => {
                                setElements((prev) => {
                                    history.record(prev);
                                    return prev.map((el) => editableSelectedIds.has(el.id) ? { ...el, isDeleted: true } : el);
                                });
                                setSelectedIds(new Set());
                            },
                        },
                    ];
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    const localX = contextMenu.x - (containerRect?.left ?? 0);
                    const localY = contextMenu.y - (containerRect?.top ?? 0);
                    return (
                        <ContextMenu bounds={size}
                            x={localX}
                            y={localY}
                            items={items}
                            onClose={handleCloseContextMenu}
                        />
                    );
                })()}

                <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept="image/*"
                    onChange={handleImageUpload}
                />
                <input
                    type="file"
                    ref={jsonInputRef}
                    hidden
                    accept=".json,application/json"
                    onChange={handleImportJSON}
                />
            </div>
        </ThemeContext.Provider>
    );
});

Noteboard.displayName = 'Noteboard';
