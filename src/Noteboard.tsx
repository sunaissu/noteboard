import { ConnectorControls } from './components/ConnectorControls';
import { BoardWorkspace } from './components/BoardWorkspace';
import { CollaborationTools } from './components/CollaborationTools';
import { emptyWorkspace, normalizeWorkspace } from './boardWorkflows';
import { connectorRouteWarnings } from './elements/connectorRouting';
import { useTextDraftQueue } from './hooks/useTextDraftQueue';
import { writeBoardClipboard,readBoardClipboard } from './boardClipboard';
import { ImportDialog } from './components/ImportDialog';
import { ExportDialog } from './components/ExportDialog';
import { useTouchNavigation } from './hooks/useTouchNavigation';
import { getNoteboardScrollbarProps } from './scrollbar';
import { CommandPalette, LayersPanel } from './components/WorkspaceDialog';
import { useKeyboardCanvas } from './hooks/useKeyboardCanvas';
import { KeyboardOverlay } from './components/KeyboardOverlay';
import { createConnectedSibling, frameSelection, pickToolStyle, expandFrameSelection } from './editingActions';
import { exportBoardImage, renderBoardImage } from './exportImage';
import { BoardNavigator } from './components/BoardNavigator';
import { combineBounds, getElementBounds } from './elements/bounds';
import { hitTestElement } from './elements/hitTest';
import { moveTextPosition } from './textEdit';
import React, { useState, useCallback, useRef, useEffect, useMemo, useImperativeHandle, useId, forwardRef } from 'react';
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
import { DEFAULT_SLOTS, TOOL_REGISTRY } from './toolRegistry';
import { ThemeContext, LIGHT_THEME, DARK_THEME, applyNoteboardBrandColors, useResolvedNoteboardTheme } from './ThemeContext';
import type { NoteboardThemeMode } from './ThemeContext';
import type { NoteboardProps, NoteboardRef, Tool, ShapeVariant } from './types';
import { MAX_BOARD_IMPORT_BYTES, deserializeBoard, serializeBoard } from './session';
import { generateId, createImageElement, createElement } from './elements/createElement';
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
    const previousScroll = { top: textarea.scrollTop, left: textarea.scrollLeft };
    if (textarea.dataset?.editLeft !== undefined) {
        textarea.style.left = textarea.dataset.editLeft + 'px';
        textarea.style.top = textarea.dataset.editTop + 'px';
        textarea.style.transform = textarea.dataset.editTransform ?? '';
        textarea.style.width = textarea.dataset.editWidth || 'auto';
        textarea.style.background = 'transparent';
        textarea.style.overflow = 'hidden';
    }
    textarea.style.height = '0px';
    textarea.style.height = textarea.scrollHeight + 2 + 'px';
    if(textarea.dataset?.shapeText!=='true'){textarea.style.width = 'auto';textarea.style.width = Math.max(textarea.scrollWidth + 2, 2) + 'px';}
    const board = textarea.closest?.('.noteboard-canvas');
    if (!board || !textarea.dataset.editBounds) return;
    const bounds = board.getBoundingClientRect(), rect = textarea.getBoundingClientRect();
    const [left, top, right, bottom] = textarea.dataset.editBounds.split(',').map(Number);
    const width = Math.max(44, bounds.width - left - right), height = Math.max(44, bounds.height - top - bottom);
    if (rect.left < bounds.left + left || rect.right > bounds.right - right || rect.top < bounds.top + top || rect.bottom > bounds.bottom - bottom) {
        const editorWidth = Math.min(width, Math.max(120, rect.width));
        const editorHeight = Math.min(height, Math.max(44, textarea.scrollHeight + 2));
        textarea.style.transform = 'none';
        textarea.style.width = editorWidth + 'px';
        textarea.style.height = editorHeight + 'px';
        textarea.style.left = Math.max(left, Math.min(rect.left - bounds.left, bounds.width - right - editorWidth)) + 'px';
        textarea.style.top = Math.max(top, Math.min(rect.top - bounds.top, bounds.height - bottom - editorHeight)) + 'px';
        textarea.style.overflow = 'auto';
        textarea.style.background = textarea.dataset.editBackground ?? '';
        textarea.dataset.editingContained = 'true';
        textarea.scrollTop = previousScroll.top;
        textarea.scrollLeft = previousScroll.left;
    } else {
        delete textarea.dataset.editingContained;
    }
}

export const Noteboard = forwardRef<NoteboardRef, NoteboardProps>((
    {
        slots = DEFAULT_SLOTS, defaultTouchDrawing = false,
        workspace, onWorkspaceChange, workspaceStorage, contentAdapter, awareness, comments, workshop, versions, textDraftStorage,
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
        scrollbar,
        onThemeChange,
        readOnly: controlledReadOnly,
        defaultReadOnly = false,
        onViewportChange,
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
    const keyboardHelpId=useId();
    const textDraftQueue=useTextDraftQueue(textDraftStorage,boardId??'default-board');
    const [clipboardMessage,setClipboardMessage]=useState('');
    const deniedDocuments=useRef(new Set<string>());
    const [permissionRevision,setPermissionRevision]=useState(0);
    const sanitizeElements=useCallback((items:import('./elements/types').NoteboardElement[])=>{const denied=new Set([...deniedDocuments.current,...(contentAdapter?.deniedDocumentIds??[])]);if(!denied.size)return items;let changed=false;const result=items.map(el=>{if(!el.documentCard||!denied.has(el.documentCard.documentId)||(!el.documentCard.fallback&&el.documentCard.title==='Document unavailable'&&(!('text'in el)||el.text==='Document unavailable')))return el;changed=true;return {...el,documentCard:{...el.documentCard,title:'Document unavailable',fallback:'',stale:true},...('text'in el?{text:'Document unavailable'}:{})};});return changed?result:items;},[contentAdapter?.deniedDocumentIds,permissionRevision]);
    const [pendingBoardImport,setPendingBoardImport]=useState<ReturnType<typeof deserializeBoard>|null>(null);
    const [localWorkspace,setLocalWorkspace]=useState(()=>emptyWorkspace(boardId??'default-board'));
    const [workspaceError,setWorkspaceError]=useState('');
    const [workspaceRetry,setWorkspaceRetry]=useState(0);
    const [presentation,setPresentation]=useState<{views:import('./boardWorkflows').BoardViewpoint[];index:number}|null>(null);
    const [workspaceReady,setWorkspaceReady]=useState(!workspaceStorage);
    useEffect(()=>{let active=true;const id=boardId??'default-board';setLocalWorkspace(emptyWorkspace(id));setWorkspaceError('');setWorkspaceReady(!workspaceStorage||!!workspace);
        if(workspaceStorage&&!workspace)Promise.resolve().then(()=>workspaceStorage.load(id)).then(value=>{if(active){setLocalWorkspace(value?normalizeWorkspace(value,id):emptyWorkspace(id));setWorkspaceReady(true);}}).catch(err=>{if(active)setWorkspaceError('Workspace load failed: '+String(err));});
        return()=>{active=false;};
    },[boardId,workspaceStorage,workspaceRetry]);
    const [internalTool, setInternalTool] = useState<Tool>('select');
    const [internalReadOnly] = useState(defaultReadOnly);
    const isReadOnly = controlledReadOnly ?? internalReadOnly;
    const readOnlyRef = useRef(isReadOnly);
    readOnlyRef.current = isReadOnly;
    const importGeneration = useRef(0);
    useEffect(()=>{setPendingBoardImport(null);importGeneration.current++;},[boardId,isReadOnly]);
    useEffect(() => () => { importGeneration.current++; }, []);
    const [touchDrawing,setTouchDrawing] = useState(defaultTouchDrawing);
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
    const [toolStyles, setToolStyles] = useState<Partial<Record<Tool, Partial<import('./elements/types').NoteboardElement>>>>({});
    const activeDefaults = useMemo(() => toolStyles[currentTool] ?? {}, [toolStyles,currentTool]);
    const [propertiesFocus, setPropertiesFocus] = useState(0);
    const [focusMode, setFocusMode] = useState(false);
    const [workspacePanel, setWorkspacePanel] = useState<'commands'|'layers'|'export'|'workspace'|'collaboration'|null>(null);
    const focusCanvas = () => containerRef.current?.focus({preventScroll:true});

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
            if (e.defaultPrevented || (e.target as HTMLElement)?.closest('button,[contenteditable="true"],[role="dialog"]') || !isFocused || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === '?') setShortcutOpen((v) => !v);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isFocused]);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented || (e.target as HTMLElement)?.closest('button,[contenteditable="true"],[role="dialog"]') || !isFocused || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const shape = SHAPE_KEYS[e.key.toLowerCase()];
            if (shape) {
                handleShapeSelect(shape);
                return;
            }

            if (e.key === 'g' || e.key === 'G') {
                setShowGrid((v) => !v);
                setSnapEnabled((v) => !v);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleShapeSelect, isFocused]);

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

    // A short landscape board has room beside the canvas, but not for a tall
    // inspector above a toolbar. Portrait phones use a horizontal inspector.
    if (size.height < 420 && size.width >= 480) {
        resolvedPropertiesPosition = toolbarPosition === 'left' ? 'right' : 'left';
    } else if (size.width < 600 && (resolvedPropertiesPosition === 'left' || resolvedPropertiesPosition === 'right')) {
        resolvedPropertiesPosition = toolbarPosition === 'top' ? 'bottom' : 'top';
    }

    const useCanvasDrawingResult = useCanvasDrawing({
        sanitizeElements,
        activeTool: currentTool,
        toolDefaults: activeDefaults,
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
        setTextEdit, cancelPointerInteraction, commitText, recoveredText, clearRecoveredText,
        panOffset,
        setPanOffset,
        zoom,
        setZoom,
        elements,
        setElements, getCurrentElements,
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
                    ...toolStyles.image, type:'image',
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
    }, [maxImageBytes, maxImagePixels, toolStyles.image, zoom, panOffset, size, setElements, history, controlledTool, onToolSelect]);

    pasteImageRef.current = handleImageFile;
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) handleImageFile(file);
    };

    const focusElements = useCallback((ids: string[]) => {
        const selected = new Set(ids);
        const targets = getCurrentElements().filter(element => selected.has(element.id) && !element.isDeleted && !element.hidden);
        if (!targets.length) return;
        const bounds = targets.map(getElementBounds);
        const [left, top, right, bottom] = combineBounds(bounds);
        const scale = Math.max(MIN_ZOOM, Math.min(2, (size.width - 80) / Math.max(1, right - left), (size.height - 80) / Math.max(1, bottom - top)));
        setSelectedIds(new Set(ids)); setZoom(scale);
        setPanOffset({ x: size.width / 2 - (left + right) / 2 * scale, y: size.height / 2 - (top + bottom) / 2 * scale });
    }, [elements, size, setSelectedIds, setZoom, setPanOffset]);
    useImperativeHandle(ref, () => ({
        navigateToObject(id){if(!getCurrentElements().some(el=>el.id===id&&!el.isDeleted&&!el.hidden))return false;focusElements([id]);return true;},
        focusElements,
        getElements() {
            return getCurrentElements();
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
        getViewport() { return { panX: panOffset.x, panY: panOffset.y, zoom }; },
        getSession() {
            return serializeBoard(
                getCurrentElements(),
                { panX: panOffset.x, panY: panOffset.y, zoom },
                {
                    threadId: threadId ?? 'default-thread',
                    boardId: boardId ?? 'default-board',
                },
            );
        },
        exportImage(format = 'png', options) {
            return renderBoardImage(getCurrentElements(), format, { background: resolvedTheme.canvasBg, ...options });
        },
        exportImageAsync(format = 'png', options) {
            return exportBoardImage(getCurrentElements(), format, { background: resolvedTheme.canvasBg, ...options });
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
                setPendingBoardImport(snapshot);
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
        () => elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted && !el.hidden),
        [elements, selectedIds],
    );

    const toolProperties = currentTool !== 'select' && currentTool !== 'pan' && currentTool !== 'eraser';
    const propertiesElements = useMemo(() => toolProperties ? [createElement(currentTool as import('./elements/types').NoteboardElement['type'], { ...(resolvedTheme.strokeColor ? {strokeColor:resolvedTheme.strokeColor} : {}), ...activeDefaults, id:'tool-defaults' })] : selectedElements, [toolProperties,currentTool,activeDefaults,selectedElements,resolvedTheme.strokeColor]);
    const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
    const [timerSize, setTimerSize] = useState({ width: 0, height: 0 });
    const [toolbarHeight, setToolbarHeight] = useState(0);
    const [toolbarWidth,setToolbarWidth]=useState(0),[pickerHeight,setPickerHeight]=useState(0),[pickerWidth,setPickerWidth]=useState(0);
    useEffect(()=>{const picker=containerRef.current?.querySelector<HTMLElement>('[data-noteboard-shapes]');if(!picker){setPickerHeight(0);setPickerWidth(0);return;}const measure=()=>{setPickerHeight(picker.offsetHeight);setPickerWidth(picker.offsetWidth);};measure();const observer=new ResizeObserver(measure);observer.observe(picker);return()=>observer.disconnect();},[currentTool,isReadOnly,focusMode]);
    useEffect(() => {
        const panel = containerRef.current?.querySelector<HTMLElement>('[aria-label="Object properties"]');
        if (!panel || isReadOnly || !propertiesElements.length) { setPanelSize({ width: 0, height: 0 }); return; }
        const measure = () => setPanelSize(previous => previous.width === panel.offsetWidth && previous.height === panel.offsetHeight ? previous : { width: panel.offsetWidth, height: panel.offsetHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(panel);
        return () => observer.disconnect();
    }, [isReadOnly, propertiesElements.length, resolvedPropertiesPosition, focusMode]);
    useEffect(() => {
        const toolbar = containerRef.current?.querySelector<HTMLElement>('[data-noteboard-toolbar]');
        if (!toolbar) { setToolbarHeight(0); setToolbarWidth(0); return; }
        const measure = () => {setToolbarHeight(toolbar.offsetHeight);setToolbarWidth(toolbar.offsetWidth);};
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(toolbar);
        return () => observer.disconnect();
    }, [isReadOnly, toolbarPosition, focusMode]);
    const toolbarOffset = toolbarPosition === resolvedPropertiesPosition && propertiesElements.length && !isReadOnly
        ? 24 + (toolbarPosition === 'top' || toolbarPosition === 'bottom' ? panelSize.height : panelSize.width) : 12;
    const zoomBottom = Math.max(12,
        !isReadOnly && toolbarPosition === 'bottom' ? toolbarOffset + toolbarHeight + 12 + (pickerHeight ? pickerHeight + 8 : 0) : 0,
        !isReadOnly && propertiesElements.length && resolvedPropertiesPosition === 'bottom' ? panelSize.height + 24 : 0);
    const propertiesVisible = !isReadOnly && !focusMode && propertiesElements.length > 0;
    const controlsRight = propertiesVisible && resolvedPropertiesPosition === 'right' ? panelSize.width + 24 : 12;
    const toolbarInsets = {
        top: propertiesVisible && resolvedPropertiesPosition === 'top' ? panelSize.height + 24 : 12,
        right: propertiesVisible && resolvedPropertiesPosition === 'right' ? panelSize.width + 24 : 12,
        bottom: propertiesVisible && resolvedPropertiesPosition === 'bottom' ? panelSize.height + 24 : 12,
        left: propertiesVisible && resolvedPropertiesPosition === 'left' ? panelSize.width + 24 : 12,
    };
    if (toolbarPosition === 'left' || toolbarPosition === 'right') {
        toolbarInsets.bottom = Math.max(toolbarInsets.bottom, zoomBottom + 64);
        if (toolbarPosition === 'right') toolbarInsets.top = Math.max(toolbarInsets.top, 68);
    } else if (toolbarPosition === 'top') {
        toolbarInsets.right = Math.max(toolbarInsets.right, controlsRight + 56);
        toolbarInsets.bottom = Math.max(toolbarInsets.bottom, zoomBottom + 64);
    }
    const canvasInsets = focusMode ? { top: 68, right: 12, bottom: 12, left: 12 } : { ...toolbarInsets };
    if (!focusMode) {
        if (toolbarPosition === 'top' || toolbarPosition === 'bottom') {
            canvasInsets.right = Math.max(canvasInsets.right, controlsRight + 56);
        } else {
            canvasInsets.top = Math.max(canvasInsets.top, 68);
        }
        canvasInsets.bottom = Math.max(12, zoomBottom + 52);
        if (!isReadOnly) {
            const horizontal = toolbarPosition === 'top' || toolbarPosition === 'bottom';
            const strip = horizontal ? toolbarHeight : toolbarWidth;
            const picker = horizontal ? pickerHeight : pickerWidth;
            canvasInsets[toolbarPosition] = Math.max(canvasInsets[toolbarPosition], toolbarOffset + strip + 12 + (picker ? picker + 8 : 0));
        }
    }
    const overlayInsets = { ...canvasInsets, right: canvasInsets.right + (timerSize.width ? timerSize.width + 12 : 0) };

    const editingElement = React.useMemo(
        () => textEdit.editingId ? elements.find((el) => el.id === textEdit.editingId) : null,
        [elements, textEdit.editingId],
    );

    const handleUpdateElements = useCallback(
        (updates: Record<string, any>) => {
            if (readOnlyRef.current) return;
            if (toolProperties) { setToolStyles(previous => ({ ...previous, [currentTool]: { ...previous[currentTool], ...pickToolStyle(updates) } })); return; }
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
        [history, selectedIds, setElements, toolProperties, currentTool],
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
        if (textEdit.active && textInputRef.current) resizeTextInput(textInputRef.current);
    }, [textEdit.active, size.width, size.height, zoom, panOffset.x, panOffset.y, overlayInsets.left, overlayInsets.top, overlayInsets.right, overlayInsets.bottom]);

    useEffect(() => {
        if (isReadOnly && textInputRef.current) commitText(textInputRef.current.value);
    }, [isReadOnly, commitText]);

    const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation(); // Prevent canvas keyboard shortcuts from firing
        if(e.key==='Escape'&&(e.ctrlKey||e.metaKey)){
            e.preventDefault();const result=textDraftQueue.cancel(e.currentTarget.value);
            if(result!==null){commitText(result,true,e.currentTarget.value);textDraftQueue.finish(true);}else{setTextEdit({x:0,y:0,active:false,editingId:null,initialText:''});textDraftQueue.finish(false);}
            requestAnimationFrame(focusCanvas);return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            const restored = e.shiftKey ? history.redo(elements) : history.undo(elements);
            if (restored) setElements(restored);
            return;
        }
        if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
            e.preventDefault();
            commitText(e.currentTarget.value);
            textDraftQueue.finish(!readOnlyRef.current&&(!textEdit.editingId||getCurrentElements().some(el=>el.id===textEdit.editingId&&!el.isDeleted&&!el.locked&&'text'in el&&el.text===e.currentTarget.value)));
            requestAnimationFrame(focusCanvas);
        }
    };

    const handleTextBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        // Guard: ignore blur if textarea just mounted (avoids premature dismissal)
        if (!textMountedRef.current) return;
        commitText(e.currentTarget.value);
        textDraftQueue.finish(!readOnlyRef.current&&(!textEdit.editingId||getCurrentElements().some(el=>el.id===textEdit.editingId&&!el.isDeleted&&!el.locked&&'text'in el&&el.text===e.currentTarget.value)));
    };

    const mutate = (change: (els: typeof elements) => typeof elements, record = true) => {
        if (readOnlyRef.current) return false;
        const previous=getCurrentElements(),next=change(previous);if(next===previous)return true;
        const accepted=setElements(next);if(accepted&&record)history.record(previous);return accepted;
    };
    const quickConnect = (direction: 'left'|'right'|'up'|'down') => {
        const source = selectedElements.length === 1 ? selectedElements[0] : null;
        if (!source || isReadOnly) return;
        const result = createConnectedSibling(source,direction,activeShape);
        if (!result) return;
        if(!mutate(els => [...els,result.connector,result.node]))return; setSelectedIds(new Set([result.node.id])); handleToolSelect('select');
    };
    const keyboard = useKeyboardCanvas({ container:containerRef,elements,selectedIds,select:setSelectedIds,tool:currentTool,setTool:handleToolSelect,defaults:{strokeColor:resolvedTheme.strokeColor,...activeDefaults},mutate,insertImage:point=>{imageInsertPosRef.current=point;fileInputRef.current?.click();},
        startText:(point,element) => { if (readOnlyRef.current || element?.locked) return; setTextEdit({x:point.x,y:point.y,active:true,editingId:element?.id ?? null,initialText:element && 'text' in element ? element.text ?? '' : ''}); },
        zoom,pan:panOffset,size,setPan:setPanOffset,snap:snapEnabled,readOnly:isReadOnly,properties:() => {setFocusMode(false);setPropertiesFocus(n=>n+1);},commands:()=>setWorkspacePanel('commands'),layers:()=>setWorkspacePanel('layers'),zoomIn,zoomOut,fit:fitAll,focusSelection:()=>focusElements([...selectedIds]),quickConnect });

    const touch = useTouchNavigation({pan:panOffset,zoom,setPan:setPanOffset,setZoom,canvas:canvasRef,cancel:cancelPointerInteraction,drawWithTouch:touchDrawing&&!isReadOnly,onTap:client=>{const bounds=canvasRef.current?.getBoundingClientRect();if(!bounds)return;const point={x:(client.x-bounds.left-panOffset.x)/zoom,y:(client.y-bounds.top-panOffset.y)/zoom};if(currentTool==='select'){const hit=[...getCurrentElements()].reverse().find(el=>!el.isDeleted&&!el.hidden&&!el.locked&&hitTestElement(point,el,8/zoom));setSelectedIds(new Set(hit?[hit.id]:[]));}else if(currentTool==='text'&&!isReadOnly)setTextEdit({x:point.x,y:point.y,active:true,editingId:null,initialText:''});}});
    const closeWorkspace = () => { setWorkspacePanel(null); requestAnimationFrame(focusCanvas); };
    const makeFrame = () => { const frame=frameSelection(elements,selectedIds);if(frame&&!isReadOnly){if(!mutate(els=>[frame,...els]))return;setSelectedIds(new Set([frame.id]));handleToolSelect('select');} };
    const toggleFocusMode = () => {setPropertiesFocus(0);setFocusMode(value=>!value);requestAnimationFrame(focusCanvas);};
    const commands = [
        {id:'focus-mode',label:focusMode?'Exit focus mode':'Enter focus mode',run:toggleFocusMode},
        {id:'external-copy',label:'Copy selection to system clipboard',disabled:!selectedIds.size,run:()=>{writeBoardClipboard(elements,selectedIds).then(()=>setClipboardMessage('Selection copied.'),err=>setClipboardMessage('Clipboard: '+String(err)));}},
        {id:'external-paste',label:'Paste board objects from system clipboard',disabled:isReadOnly,run:()=>{readBoardClipboard({x:-panOffset.x/zoom+40,y:-panOffset.y/zoom+40}).then(items=>{if(!readOnlyRef.current)mutate(els=>[...els,...items]);},err=>setClipboardMessage('Clipboard: '+String(err)));}},
        {id:'workspace',label:'Board workspace: views, library, diagrams, objects, styles, versions',run:()=>setWorkspacePanel('workspace')},
        {id:'collaboration',label:'Collaboration: comments, presence, presentation, voting, timer',run:()=>setWorkspacePanel('collaboration')},
        ...Object.values(TOOL_REGISTRY).map(tool=>({id:tool.id,label:'Tool: '+tool.label,disabled:isReadOnly&&tool.id!=='select'&&tool.id!=='pan',run:()=>handleToolSelect(tool.id)})),
        {id:'keyboard',label:keyboard.enabled?'Turn off Keyboard Canvas':'Turn on Keyboard Canvas',hint:'Ctrl/⌘ Shift '+String.fromCharCode(96),run:keyboard.toggle},
        {id:'layers',label:'Layers and frames',run:()=>setWorkspacePanel('layers')},
        {id:'properties',label:'Focus properties',hint:'P in Keyboard Canvas',run:()=>{setFocusMode(false);setPropertiesFocus(n=>n+1);}},
        {id:'fit',label:'Fit board',run:fitAll},{id:'focus',label:'Fit selection',disabled:!selectedIds.size,run:()=>focusElements([...selectedIds])},
        {id:'frame-selection',label:'Frame selection',disabled:isReadOnly||!selectedIds.size,run:makeFrame},
        ...(['left','right','up','down'] as const).map(direction=>({id:'connect-'+direction,label:'Create connected shape '+direction,disabled:isReadOnly||selectedElements.length!==1||!isShapeElement(selectedElements[0])||selectedElements[0].locked,run:()=>quickConnect(direction)})),
        {id:'undo',label:'Undo',disabled:isReadOnly||!history.canUndo(),run:()=>setElements(prev=>history.undo(prev)??prev)},
        {id:'redo',label:'Redo',disabled:isReadOnly||!history.canRedo(),run:()=>setElements(prev=>history.redo(prev)??prev)},
        {id:'align-left',label:'Align left',disabled:isReadOnly||selectedIds.size<2,run:handleAlignLeft},
        {id:'distribute',label:'Distribute horizontally',disabled:isReadOnly||selectedIds.size<3,run:handleDistributeH},
        {id:'export',label:'Export preview: SVG, PDF or image',run:()=>setWorkspacePanel('export')},
    ];

    return (
        <ThemeContext.Provider value={resolvedTheme}>
            <div
                {...getNoteboardScrollbarProps(scrollbar)}
                ref={containerRef}
                className="noteboard-canvas"
                role={keyboard.enabled ? 'application' : 'region'}
                aria-label="Noteboard canvas"
                aria-describedby={keyboardHelpId}
                aria-roledescription={keyboard.enabled ? 'Keyboard canvas editor' : 'Whiteboard'}
                onKeyDownCapture={keyboard.onKeyDown}
                data-focus-mode={focusMode}
                data-theme={resolvedThemeMode}
                data-theme-mode={themeMode}
                tabIndex={0}
                onFocus={() => setIsFocused(true)}
                onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsFocused(false); }}
                style={{
                    ...getNoteboardScrollbarProps(scrollbar).style,
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    overscrollBehavior: 'contain',
                    outline: isFocused ? `2px solid ${resolvedTheme.primaryColor ?? resolvedTheme.buttonActiveColor}` : 'none',
                    outlineOffset: '-2px',
                    background: resolvedTheme.canvasBg,
                    colorScheme: resolvedThemeMode,
                    color: resolvedTheme.panelTextColor,
                    transition: 'background 0.3s ease',
                }}
            >
                <style>{`
.noteboard-canvas,.noteboard-canvas *,.sunaissu-noteboard-scrollbar { scrollbar-width:var(--noteboard-scrollbar-width,auto);scrollbar-color:var(--noteboard-scrollbar-color,auto); }
@supports not (scrollbar-color:red blue) {
  .noteboard-canvas[data-noteboard-scrollbar=custom],.noteboard-canvas[data-noteboard-scrollbar=custom] *,.sunaissu-noteboard-scrollbar[data-noteboard-scrollbar=custom] { scrollbar-width:auto; }
  .noteboard-canvas[data-noteboard-scrollbar=custom]::-webkit-scrollbar,.noteboard-canvas[data-noteboard-scrollbar=custom] *::-webkit-scrollbar,.sunaissu-noteboard-scrollbar[data-noteboard-scrollbar=custom]::-webkit-scrollbar { width:var(--noteboard-scrollbar-size);height:var(--noteboard-scrollbar-size); }
  .noteboard-canvas[data-noteboard-scrollbar=custom]::-webkit-scrollbar-thumb,.noteboard-canvas[data-noteboard-scrollbar=custom] *::-webkit-scrollbar-thumb,.sunaissu-noteboard-scrollbar[data-noteboard-scrollbar=custom]::-webkit-scrollbar-thumb { background:var(--noteboard-scrollbar-thumb);border-radius:999px; }
  .noteboard-canvas[data-noteboard-scrollbar=custom]::-webkit-scrollbar-track,.noteboard-canvas[data-noteboard-scrollbar=custom] *::-webkit-scrollbar-track,.sunaissu-noteboard-scrollbar[data-noteboard-scrollbar=custom]::-webkit-scrollbar-track { background:var(--noteboard-scrollbar-track); }
}
@supports not (scrollbar-width:none) {
  .noteboard-canvas[data-noteboard-scrollbar=hidden]::-webkit-scrollbar,.noteboard-canvas[data-noteboard-scrollbar=hidden] *::-webkit-scrollbar,.sunaissu-noteboard-scrollbar[data-noteboard-scrollbar=hidden]::-webkit-scrollbar { display:none;width:0;height:0; }
}
.noteboard-canvas button:focus-visible,.noteboard-canvas input:focus-visible,.noteboard-canvas select:focus-visible,.noteboard-canvas textarea:focus-visible { outline:2px solid currentColor !important;outline-offset:2px !important; }
.noteboard-canvas label:focus-within { outline:2px solid currentColor;outline-offset:2px; }
@media (pointer:coarse) { .noteboard-canvas label[title="Custom color"] { width:44px !important;height:44px !important; } .noteboard-canvas button { min-height:44px;min-width:44px; } .noteboard-canvas select,.noteboard-canvas textarea,.noteboard-canvas input:not([type=checkbox]):not([type=color]):not([type=range]) { min-height:44px;font-size:16px !important; } .noteboard-canvas input[type=color] { min-width:44px;min-height:44px; } }
@media (prefers-reduced-motion:reduce) { .noteboard-canvas * { transition:none !important;animation:none !important; } }
@media (pointer:coarse) { .noteboard-canvas input[type=range] { min-height:44px; } .noteboard-canvas label:has(input[type=checkbox]) { display:inline-flex;align-items:center;gap:6px;min-height:44px; } }
                `}</style>
                <canvas
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: textEdit.active ? 'none' : 'auto',
                        touchAction: 'none',
                        cursor: isReadOnly ? 'grab' : undefined,
                    }}
                    onPointerDownCapture={() => containerRef.current?.focus({ preventScroll: true })}
                    onPointerDown={event => { if (!touch.down(event)) handlers.onPointerDown(event); }}
                    onPointerMove={event => { if (!touch.move(event)) handlers.onPointerMove(event); }}
                    onPointerUp={event => { if (!touch.up(event)) handlers.onPointerUp(); }}
                    onPointerCancel={touch.clear}
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

                {!isReadOnly && !focusMode && !keyboard.enabled && !presentation && currentTool === 'select' && selectedElements.length === 1 && !textEdit.active && <ConnectorControls element={selectedElements[0]} pan={panOffset} zoom={zoom} size={size} viewportInsets={overlayInsets} onChange={points=>mutate(els=>els.map(el=>el.id===selectedElements[0].id?{...el,points,manualRoute:true} as typeof el:el))} />}
                {!isReadOnly && !focusMode && !keyboard.enabled && !presentation && currentTool === 'select' && selectedElements.length === 1 && isShapeElement(selectedElements[0]) && !selectedElements[0].locked && !selectedElements[0].hidden && !textEdit.active && (() => {
                    const [l,t,r,b] = getElementBounds(selectedElements[0]);
                    const controls = (['left','right','up','down'] as const).map(direction => ({
                        direction,
                        x: (direction === 'left' ? l : direction === 'right' ? r : (l+r)/2)*zoom+panOffset.x+(direction === 'left' ? -28 : direction === 'right' ? 28 : 0),
                        y: (direction === 'up' ? t : direction === 'down' ? b : (t+b)/2)*zoom+panOffset.y+(direction === 'up' ? -28 : direction === 'down' ? 28 : 0),
                    }));
                    const dock = controls.some(({x,y}) => x-22 < overlayInsets.left || x+22 > size.width-overlayInsets.right || y-22 < overlayInsets.top || y+22 > size.height-overlayInsets.bottom);
                    const buttons = controls.map(({direction,x,y}) => <button key={direction} type="button" aria-label={'Connect shape '+direction} title={'Create connected shape '+direction} onClick={()=>quickConnect(direction)} style={{position:dock?'relative':'absolute',left:dock?undefined:x-22,top:dock?undefined:y-22,width:44,height:44,flexShrink:0,borderRadius:22,zIndex:920,border:resolvedTheme.panelBorder,background:resolvedTheme.panelBg,color:resolvedTheme.panelTextColor}}>{{left:'←',right:'→',up:'↑',down:'↓'}[direction]}</button>);
                    return dock ? <div role="group" aria-label="Connect selected shape" data-scroll-axis="horizontal" style={{position:'absolute',left:overlayInsets.left,top:overlayInsets.top,maxWidth:Math.max(44,size.width-overlayInsets.left-overlayInsets.right),display:'flex',gap:4,overflowX:'auto',overscrollBehavior:'contain',zIndex:920}}>{buttons}</div> : buttons;
                })()}
                {keyboard.enabled && <KeyboardOverlay hideHelp={!!presentation} cursor={keyboard.cursor} anchor={keyboard.anchor} draft={keyboard.draft} operation={keyboard.operation} pan={panOffset} zoom={zoom} size={size} bottom={focusMode ? 12 : zoomBottom} viewportInsets={overlayInsets} />}
                <span id={keyboardHelpId} style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}}>Ctrl or Command, Shift and Backquote toggles Keyboard Canvas. In that mode, arrows move the cursor, Space starts and finishes drawing, Tab selects objects, Enter edits text, P opens properties, and Escape exits. Press Ctrl or Command K for commands.</span>
                <div role="status" aria-live="polite" aria-atomic="true" style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}}>{keyboard.message}</div>
                {textEdit.active && (() => {
                    const isShapeEdit = !!(editingElement && isShapeElement(editingElement));
                    const eany = (editingElement ?? (currentTool==='text'?activeDefaults:{})) as any;

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
                        fixedWidth = Math.max(2,(Math.abs(editingElement!.width)-16)*zoom+6)+'px';
                        leftPos = Math.min(editingElement!.x,editingElement!.x+editingElement!.width)*zoom+panOffset.x+8*zoom-3;
                        transformStr = 'translateY(-50%)';
                    } else {leftPos = (editingElement?.x??textEdit.x)*zoom+panOffset.x-3;topPos-=2;}

                    return (
                        <textarea
                            key={`edit-${textEdit.x}-${textEdit.y}`}
                            ref={textInputRef}
                            rows={1}
                            data-shape-text={isShapeEdit}
                            data-edit-left={leftPos}
                            data-edit-top={topPos}
                            data-edit-transform={`${transformStr} rotate(${editingElement?.angle ?? 0}rad)`}
                            data-edit-width={fixedWidth ?? ''}
                            data-edit-bounds={[overlayInsets.left,overlayInsets.top,overlayInsets.right,overlayInsets.bottom].join(',')}
                            data-edit-background={resolvedTheme.panelBg}
                            aria-label="Edit object text"
                            autoFocus
                            defaultValue={textEdit.initialText}
                            style={{
                                position: 'absolute',
                                left: leftPos,
                                top: topPos,
                                transform: `${transformStr} rotate(${editingElement?.angle ?? 0}rad)`,
                                transformOrigin: isShapeEdit?'50% 50%':`${(editingElement?.width??0)*zoom/2+3}px ${(editingElement?.height??0)*zoom/2+2}px`,
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
                                zIndex: 1004,
                                color: eany?.strokeColor ?? resolvedTheme.textInputColor,
                                lineHeight: lhMultiplier,
                                whiteSpace: isShapeEdit?'pre-wrap':'pre',
                                caretColor: resolvedTheme.primaryColor ?? SELECTION_COLOR,
                                boxShadow: 'none',
                                boxSizing: 'border-box',
                                wordBreak: isShapeEdit?'break-word':'keep-all',
                                textAlign: elTextAlign as any,
                            }}
                            onKeyDown={handleTextKeyDown}
                            onBlur={handleTextBlur}
                            onCompositionStart={() => { textComposingRef.current = true; }}
                            onCompositionEnd={e => { textComposingRef.current = false; textDraftQueue.track(textEdit.editingId??'new',textBaseRef.current,e.currentTarget.value); commitText(e.currentTarget.value, false, textBaseRef.current); textBaseRef.current = e.currentTarget.value; }}
                            onInput={(e) => {
                                const ta = e.currentTarget;
                                if (!(e.nativeEvent as InputEvent).isComposing) { textDraftQueue.track(textEdit.editingId??'new',textBaseRef.current,ta.value); commitText(ta.value, false, textBaseRef.current); textBaseRef.current = ta.value; }
                                resizeTextInput(ta);
                            }}
                        />
                    );
                })()}



                {recoveredText !== null && <div role="alert" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 'min(360px, calc(100% - 32px))', maxHeight:'calc(100% - 32px)',boxSizing:'border-box',overflow:'auto',overscrollBehavior:'contain',zIndex: 2000, padding: 14, borderRadius: 10, background: resolvedTheme.panelBg, color: resolvedTheme.panelTextColor, boxShadow: resolvedTheme.toolbarShadow }}>
                    <strong>Your text is safe here.</strong><p>Editing ended because the object was removed, locked, or your edit permission changed. Copy your text before dismissing.</p>
                    <textarea readOnly aria-label="Recovered text" value={recoveredText} style={{ width: '100%', boxSizing: 'border-box', minHeight: 80 }} />
                    <button type="button" onClick={clearRecoveredText}>Dismiss</button>
                </div>}
                {!isReadOnly && !focusMode && (
                    <Toolbar
                        slots={slots}
                        position={toolbarPosition}
                        edgeOffset={toolbarOffset}
                        viewportInsets={toolbarInsets}
                        activeTool={currentTool}
                        onToolSelect={handleToolSelect}
                        activeShape={activeShape}
                        onUndo={() => setElements((prev) => { const r = history.undo(prev); if (r) { return r; } return prev; })}
                        onRedo={() => setElements((prev) => { const r = history.redo(prev); if (r) { return r; } return prev; })}
                        canUndo={history.canUndo()}
                        canRedo={history.canRedo()}
                    />
                )}

                {!isReadOnly && !focusMode && (
                    <ShapePicker
                        edgeOffset={toolbarOffset+(toolbarPosition==='top'||toolbarPosition==='bottom'?toolbarHeight:toolbarWidth)+8}
                        viewportInsets={toolbarInsets}
                        activeShape={activeShape}
                        activeTool={currentTool}
                        onSelectShape={handleShapeSelect}
                        toolbarPosition={toolbarPosition}
                    />
                )}

                {!focusMode && <SettingsPanel
                    right={controlsRight}
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
                    <div style={{display:'grid',gap:8,padding:'12px 0'}}>
                        <label><input type="checkbox" checked={touchDrawing} onChange={e=>setTouchDrawing(e.target.checked)}/> Draw with one finger (two fingers navigate)</label>
                        <button type="button" aria-pressed={keyboard.enabled} onClick={keyboard.toggle}>Keyboard Canvas · Ctrl/⌘ Shift `</button>
                        <button type="button" onClick={toggleFocusMode}>Focus mode</button>
                        <button type="button" onClick={() => setWorkspacePanel('layers')}>Layers and frames</button>
                        <button type="button" onClick={() => setWorkspacePanel('workspace')}>Board workspace</button>
                        <button type="button" onClick={() => setWorkspacePanel('collaboration')}>Collaboration and workshop</button>
                        {clipboardMessage&&<p role="status">{clipboardMessage}</p>}
                        {textDraftQueue.error&&<p role="alert">{textDraftQueue.error}<button type="button" onClick={textDraftQueue.retry}>Retry text draft save</button></p>}
                        {textDraftQueue.drafts.map(draft=><div key={draft.id}><p>Recovered text: {draft.after.slice(0,120)}</p><button type="button" disabled={isReadOnly} onClick={()=>{setTextEdit({x:-panOffset.x/zoom+40,y:-panOffset.y/zoom+40,active:true,editingId:null,initialText:draft.after});}}>Open recovered text as new object</button><button type="button" onClick={()=>textDraftQueue.discard(draft.id)}>Discard text draft</button></div>)}
                        <button type="button" onClick={() => setWorkspacePanel('commands')}>Commands · Ctrl/⌘ K</button>
                        <button type="button" onClick={() => setWorkspacePanel('export')}>Export preview</button>
                    </div>
                    <BoardNavigator onWorkspace={()=>setWorkspacePanel('workspace')} elements={elements} viewport={{ panX: panOffset.x, panY: panOffset.y, zoom }} size={size} onFocus={focusElements} onViewport={viewport => { setZoom(viewport.zoom); setPanOffset({ x: viewport.panX, y: viewport.panY }); }} />
                </SettingsPanel>}

                {!isReadOnly && !focusMode && (
                    <PropertiesPanel
                        selectedElements={propertiesElements}
                        toolName={toolProperties ? TOOL_REGISTRY[currentTool]?.label : undefined}
                        focusRequest={propertiesFocus}
                        onReturnToCanvas={focusCanvas}
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
                        compact={size.width < 600}
                    />
                )}

                {!focusMode && <ZoomHUD
                    bottom={zoomBottom}
                    right={controlsRight}
                    zoom={zoom}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onReset={zoomReset}
                    onFitAll={fitAll}
                />}

                {focusMode&&<button type="button" onClick={toggleFocusMode} style={{position:'absolute',right:12,top:12,zIndex:1003,minHeight:44,padding:'8px 12px',background:resolvedTheme.panelBg,color:resolvedTheme.panelTextColor,border:resolvedTheme.panelBorder,borderRadius:8}}>Exit focus mode</button>}
                {workspacePanel === 'export' && <ExportDialog elements={elements} selected={selectedIds} onClose={closeWorkspace} />}
                {presentation&&<div role="group" aria-label="Presentation controls" data-scroll-axis="horizontal" onFocusCapture={event=>{const target=event.target as HTMLElement,strip=event.currentTarget;const item=target.getBoundingClientRect(),bounds=strip.getBoundingClientRect();if(item.left<bounds.left)strip.scrollLeft-=bounds.left-item.left;else if(item.right>bounds.right)strip.scrollLeft+=item.right-bounds.right;}} style={{position:'absolute',left:overlayInsets.left,top:overlayInsets.top,zIndex:1002,display:'flex',alignItems:'center',gap:4,background:resolvedTheme.panelBg,color:resolvedTheme.panelTextColor,borderRadius:8,maxWidth:Math.max(44,size.width-overlayInsets.left-overlayInsets.right),maxHeight:Math.max(44,size.height-overlayInsets.top-overlayInsets.bottom),overflow:'auto',overscrollBehavior:'contain',boxSizing:'border-box'}}>{[-1,1].map(delta=><button key={delta} type="button" style={{minHeight:44,flexShrink:0}} disabled={presentation.index+delta<0||presentation.index+delta>=presentation.views.length} onClick={()=>{const index=presentation.index+delta,view=presentation.views[index].viewport;setPresentation({...presentation,index});setZoom(view.zoom);setPanOffset({x:view.panX,y:view.panY});}}>{delta<0?'Previous view':'Next view'}</button>)}<span title={presentation.views[presentation.index].name} style={{flexShrink:1,minWidth:0,maxWidth:180,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{presentation.views[presentation.index].name}</span><button type="button" style={{minHeight:44,flexShrink:0}} onClick={()=>setPresentation(null)}>End presentation</button></div>}
                {clipboardMessage&&<div role="status" style={{position:'absolute',left:12,right:12,top:12,maxHeight:'calc(100% - 24px)',overflow:'auto',overflowWrap:'anywhere',zIndex:1500,padding:8,background:resolvedTheme.panelBg,color:resolvedTheme.panelTextColor}}>{clipboardMessage}<button type="button" onClick={()=>setClipboardMessage('')}>Dismiss</button></div>}
                {pendingBoardImport&&<ImportDialog elements={pendingBoardImport.elements} currentCount={elements.length} readOnly={isReadOnly} onClose={()=>setPendingBoardImport(null)} onApply={merge=>{if(readOnlyRef.current)return;const incoming=merge?duplicateElements(pendingBoardImport.elements.filter(el=>!el.isDeleted),40):pendingBoardImport.elements;if(getCurrentElements().length+incoming.length>10000&&merge)throw new Error('Board object limit exceeded');if(!mutate(current=>merge?[...current,...incoming]:incoming))throw new Error('The host rejected this import');if(!merge){setZoom(pendingBoardImport.viewport.zoom);setPanOffset({x:pendingBoardImport.viewport.panX,y:pendingBoardImport.viewport.panY});}setPendingBoardImport(null);}}/>}
                {workspaceError&&<div role="alert" style={{position:'absolute',bottom:100,left:12,right:12,maxHeight:'calc(100% - 124px)',overflow:'auto',overflowWrap:'anywhere',zIndex:50,background:resolvedTheme.panelBg,padding:8}}>{workspaceError}<button type="button" onClick={()=>setWorkspaceRetry(n=>n+1)}>Retry workspace load</button></div>}
                {workspacePanel === 'workspace' && <BoardWorkspace onDocumentAccess={(id,allowed)=>{if(allowed)deniedDocuments.current.delete(id);else deniedDocuments.current.add(id);setPermissionRevision(n=>n+1);}} onPresent={views=>{setPresentation({views,index:0});setZoom(views[0].viewport.zoom);setPanOffset({x:views[0].viewport.panX,y:views[0].viewport.panY});}} key={boardId??'default-board'} boardId={boardId??'default-board'} elements={elements} selected={selectedIds} readOnly={isReadOnly||!workspaceReady} viewport={{panX:panOffset.x,panY:panOffset.y,zoom}} onViewport={v=>{setZoom(v.zoom);setPanOffset({x:v.panX,y:v.panY});}} onSelect={ids=>setSelectedIds(new Set(ids))} onFocus={focusElements} mutate={mutate} state={workspace??localWorkspace} onStateChange={state=>{setLocalWorkspace(state);onWorkspaceChange?.(state);}} storage={workspaceStorage} content={contentAdapter} versions={versions} onClose={closeWorkspace}/>}
                <CollaborationTools awareness={awareness} comments={comments} workshop={workshop} elements={elements} selected={selectedIds} editingId={textEdit.active?textEdit.editingId:null} viewport={{panX:panOffset.x,panY:panOffset.y,zoom}} onViewport={v=>{setZoom(v.zoom);setPanOffset({x:v.panX,y:v.panY});}} container={containerRef} viewportInsets={canvasInsets} onTimerSizeChange={setTimerSize} open={workspacePanel==='collaboration'} onClose={closeWorkspace}/>
                {connectorRouteWarnings(elements,selectedIds).length>0&&<div role="status" style={{position:'absolute',left:12,top:'45%',maxWidth:250,padding:8,background:resolvedTheme.panelBg,color:resolvedTheme.panelTextColor,zIndex:30}}>No clear automatic route. Move an obstacle or edit the connector bends.</div>}
                {workspacePanel === 'commands' && <CommandPalette commands={commands} onClose={closeWorkspace}/>}
                {workspacePanel === 'layers' && <LayersPanel elements={elements} selected={selectedIds} readOnly={isReadOnly} onChange={mutate} onFrame={makeFrame} onClose={closeWorkspace} onSelect={id=>{handleToolSelect('select');setSelectedIds(new Set([id]));if(!elements.find(el=>el.id===id)?.hidden)focusElements([id]);}}/>}
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
                            .filter((element) => selectedIds.has(element.id) && !element.isDeleted && !element.hidden && !isLockedElement(element))
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
                                const copyIds=expandFrameSelection(elements,editableSelectedIds);
                                const dupes = duplicateElements(
                                    elements.filter((el) => copyIds.has(el.id) && !el.locked && !el.isDeleted && !el.hidden),
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
                                        .filter((el) => !el.isDeleted && !el.hidden && !isLockedElement(el))
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
