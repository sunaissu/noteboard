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
import { serializeBoard } from './session';
import { generateId, createImageElement } from './elements/createElement';
import { duplicateElement } from './elements/mutateElement';
import {
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FAMILY,
    MIN_ZOOM,
    MAX_ZOOM,
    SELECTION_COLOR,
 } from './constants';
import { isShapeElement } from './elements/types';


export const Noteboard = forwardRef<NoteboardRef, NoteboardProps>((
    {
        slots = DEFAULT_SLOTS,
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
        elements: externalElements,
        onElementsChange,
        onSave,
        boardId,
        threadId,
    },
    ref,
) => {
    const [internalTool, setInternalTool] = useState<Tool>('select');

    // ─── Read-only / View mode ────────────────────────────
    const [internalReadOnly] = useState(defaultReadOnly);
    const isReadOnly = controlledReadOnly ?? internalReadOnly;

    // ─── Shortcut modal & context menu state ────────────────────
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
    const imageInsertPosRef = useRef<{ x: number; y: number } | null>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });

    // ─── Theme state ─────────────────────────────────────────
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

    useToolbarShortcuts(slots, handleToolSelect);

    // ─── ? key → shortcut modal ──────────────────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === '?') setShortcutOpen((v) => !v);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // ─── Shape keyboard shortcuts (R, O, D, T) + G for grid ─────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
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
    }, [handleShapeSelect]);

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

    // Prevent browser zoom when cursor is inside the board
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
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
        width: size.width,
        height: size.height,
        canvasBg: resolvedTheme.canvasBg,
        strokeColor: resolvedTheme.strokeColor,
        primaryColor: resolvedTheme.primaryColor,
        primaryOverlay: resolvedTheme.primaryOverlay,
        isDark,
        snapEnabled,
        showGrid,
        initialElements,
        initialViewport,
        externalElements,
        onElementsChange,
        onViewportChange,
        onImageInsertRequest: useCallback((x: number, y: number) => {
            imageInsertPosRef.current = { x, y };
            fileInputRef.current?.click();
        }, []),
    });

    const {
        canvasRef,
        handlers,
        textEdit,
        commitText,
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

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const pos = imageInsertPosRef.current ?? { x: size.width / 2, y: size.height / 2 };
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (!dataUrl) return;

            const img = new Image();
            img.onload = () => {
                const el = createImageElement({
                    x: pos.x,
                    y: pos.y,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
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
    }, [size, setElements, history, controlledTool, onToolSelect]);

    // ─── Imperative ref handle ────────────────────────────────
    useImperativeHandle(ref, () => ({
        getElements() {
            return elements;
        },
        setElements(newElements) {
            setElements(newElements);
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
        exportImage(format: 'png' | 'jpeg' = 'png') {
            const canvas = canvasRef.current;
            if (!canvas) return '';
            return canvas.toDataURL(`image/${format}`);
        },
    }), [elements, setElements, setPanOffset, setZoom, panOffset, zoom, threadId, boardId]);

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

    const handleExportImage = useCallback((format: 'png' | 'jpeg' = 'png') => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ctx = exportCanvas.getContext('2d');
        if (ctx) {
            if (format === 'jpeg' || resolvedTheme.canvasBg !== 'transparent') {
                ctx.fillStyle = resolvedTheme.canvasBg === 'transparent' ? '#ffffff' : resolvedTheme.canvasBg;
                ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            }
            ctx.drawImage(canvas, 0, 0);
            
            const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const url = exportCanvas.toDataURL(mimeType);
            const link = document.createElement('a');
            link.download = `noteboard-export-${new Date().toISOString().slice(0, 10)}.${format}`;
            link.href = url;
            link.click();
        }
    }, [resolvedTheme.canvasBg]);

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
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const session = JSON.parse(event.target?.result as string);
                if (session && Array.isArray(session.elements)) {
                    setElements(session.elements);
                    if (session.viewport) {
                        setPanOffset({ x: session.viewport.panX, y: session.viewport.panY });
                        setZoom(session.viewport.zoom);
                    }
                    history.record(session.elements);
                }
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

    // ─── Properties panel support ─────────────────────────────
    const selectedElements = React.useMemo(
        () => elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted),
        [elements, selectedIds],
    );

    // Look up the element being edited (for shape text editing font resolution)
    const editingElement = React.useMemo(
        () => textEdit.editingId ? elements.find((el) => el.id === textEdit.editingId) : null,
        [elements, textEdit.editingId],
    );

    const handleUpdateElements = useCallback(
        (updates: Record<string, any>) => {
            setElements((prev) =>
                prev.map((el) =>
                    selectedIds.has(el.id) ? { ...el, ...updates } : el,
                ),
            );
        },
        [selectedIds, setElements],
    );

    // ─── Align callbacks (wired to AppearanceSection) ─────────
    const makeAlignCallback = useCallback((fn: (els: typeof elements, ids: Set<string>) => typeof elements) => () => {
        setElements((prev) => { history.record(prev); return fn(prev, selectedIds); });
    }, [selectedIds, setElements, history]);

    const handleAlignLeft    = makeAlignCallback(alignLeft);
    const handleAlignRight   = makeAlignCallback(alignRight);
    const handleAlignTop     = makeAlignCallback(alignTop);
    const handleAlignBottom  = makeAlignCallback(alignBottom);
    const handleAlignCenterH = makeAlignCallback(alignCenterH);
    const handleAlignCenterV = makeAlignCallback(alignCenterV);
    const handleDistributeH  = makeAlignCallback(distributeH);
    const handleDistributeV  = makeAlignCallback(distributeV);

    // ─── Z-ordering & grouping callbacks for PropertiesPanel ──
    const handleBringForward = useCallback(() => {
        setElements((prev) => {
            history.record(prev);
            const result = [...prev];
            for (let i = result.length - 2; i >= 0; i--) {
                if (selectedIds.has(result[i].id) && !selectedIds.has(result[i + 1].id)) {
                    [result[i], result[i + 1]] = [result[i + 1], result[i]];
                }
            }
            return result;
        });
    }, [selectedIds, setElements, history]);

    const handleSendBackward = useCallback(() => {
        setElements((prev) => {
            history.record(prev);
            const result = [...prev];
            for (let i = 1; i < result.length; i++) {
                if (selectedIds.has(result[i].id) && !selectedIds.has(result[i - 1].id)) {
                    [result[i - 1], result[i]] = [result[i], result[i - 1]];
                }
            }
            return result;
        });
    }, [selectedIds, setElements, history]);

    const handleBringToFront = useCallback(() => {
        setElements((prev) => {
            history.record(prev);
            const rest = prev.filter((el) => !selectedIds.has(el.id));
            const sel = prev.filter((el) => selectedIds.has(el.id));
            return [...rest, ...sel];
        });
    }, [selectedIds, setElements, history]);

    const handleSendToBack = useCallback(() => {
        setElements((prev) => {
            history.record(prev);
            const sel = prev.filter((el) => selectedIds.has(el.id));
            const rest = prev.filter((el) => !selectedIds.has(el.id));
            return [...sel, ...rest];
        });
    }, [selectedIds, setElements, history]);

    const handleGroup = useCallback(() => {
        if (selectedIds.size < 2) return;
        const groupId = generateId();
        setElements((prev) => {
            history.record(prev);
            return prev.map((el) => selectedIds.has(el.id) ? { ...el, groupId } : el);
        });
    }, [selectedIds, setElements, history]);

    const handleUngroup = useCallback(() => {
        setElements((prev) => {
            history.record(prev);
            return prev.map((el) => selectedIds.has(el.id) ? { ...el, groupId: undefined } : el);
        });
    }, [selectedIds, setElements, history]);

    const handleToggleLock = useCallback(() => {
        setElements((prev) => {
            history.record(prev);
            return prev.map((el) =>
                selectedIds.has(el.id) ? { ...el, locked: !el.locked } : el,
            );
        });
    }, [selectedIds, setElements, history]);

    // Focus text input when it appears and auto-size for existing content
    const textMountedRef = useRef(false);
    useEffect(() => {
        if (textEdit.active && textInputRef.current) {
            textMountedRef.current = false;
            const ta = textInputRef.current;
            // Auto-size to fit existing multi-line content
            ta.style.height = '0px';
            ta.style.height = ta.scrollHeight + 2 + 'px';
            ta.style.width = 'auto';
            ta.style.width = Math.max(ta.scrollWidth + 2, 2) + 'px';
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

    const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation(); // Prevent canvas keyboard shortcuts from firing
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
                        cursor: isReadOnly ? 'default' : undefined,
                    }}
                    onPointerDown={isReadOnly ? undefined : handlers.onPointerDown}
                    onPointerMove={isReadOnly ? undefined : handlers.onPointerMove}
                    onPointerUp={isReadOnly ? undefined : handlers.onPointerUp}
                    onPointerLeave={isReadOnly ? undefined : handlers.onPointerLeave}
                    onWheel={handlers.onWheel}
                    onDoubleClick={isReadOnly ? undefined : handlers.onDoubleClick}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isReadOnly) setContextMenu({ x: e.clientX, y: e.clientY });
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

                    const screenX = textEdit.x * zoom + panOffset.x;
                    const screenY = textEdit.y * zoom + panOffset.y;
                    
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
                            key={textEdit.editingId ?? `new-${textEdit.x}-${textEdit.y}`}
                            ref={textInputRef}
                            rows={1}
                            autoFocus
                            defaultValue={textEdit.initialText}
                            style={{
                                position: 'absolute',
                                left: leftPos,
                                top: topPos,
                                transform: transformStr || undefined,
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
                            onInput={(e) => {
                                const ta = e.currentTarget;
                                ta.style.height = '0px';
                                ta.style.height = ta.scrollHeight + 2 + 'px';
                                ta.style.width = 'auto';
                                ta.style.width = Math.max(ta.scrollWidth + 2, 2) + 'px';
                            }}
                        />
                    );
                })()}



                {!isReadOnly && (
                    <Toolbar
                        slots={slots}
                        position={toolbarPosition}
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
                />

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
                    const hasSelection = selectedIds.size > 0;
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
                                const groupMap = new Map<string, string>();
                                const dupes = elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted).map((el) => {
                                    const base = duplicateElement(el);
                                    if (el.groupId) {
                                        if (!groupMap.has(el.groupId)) groupMap.set(el.groupId, generateId());
                                        return { ...base, groupId: groupMap.get(el.groupId) };
                                    }
                                    return base;
                                });
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
                                const ids = new Set(elements.filter((el) => !el.isDeleted).map((el) => el.id));
                                setSelectedIds(ids);
                            },
                        },
                        {
                            label: 'Delete',
                            icon: '🗑️',
                            danger: true,
                            disabled: !hasSelection,
                            onClick: () => {
                                setElements((prev) => { history.record(prev); return prev.map((el) => selectedIds.has(el.id) ? { ...el, isDeleted: true } : el); });
                                setSelectedIds(new Set());
                            },
                        },
                    ];
                    const containerRect = containerRef.current?.getBoundingClientRect();
                    const localX = contextMenu.x - (containerRect?.left ?? 0);
                    const localY = contextMenu.y - (containerRect?.top ?? 0);
                    return (
                        <ContextMenu
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
