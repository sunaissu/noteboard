import React, { useState, useCallback, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { SettingsPanel } from './components/SettingsPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ShapePicker, SHAPE_KEYS } from './components/ShapePicker';
import { ZoomHUD } from './components/ZoomHUD';
import { useToolbarShortcuts } from './hooks/useToolbarShortcuts';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import {
    alignLeft, alignRight, alignTop, alignBottom, alignCenterH, alignCenterV,
    distributeH, distributeV,
} from './hooks/useAlign';
import { DEFAULT_SLOTS } from './toolRegistry';
import { ThemeContext, LIGHT_THEME, DARK_THEME } from './ThemeContext';
import type { NoteboardTheme } from './ThemeContext';
import type { NoteboardProps, NoteboardRef, Tool, ShapeVariant } from './types';
import { serializeBoard } from './session';
import { generateId, createImageElement } from './elements/createElement';
import {
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FAMILY,
    SELECTION_COLOR,
 } from './constants';
import { isShapeElement } from './elements/types';


// ─── Resolve theme prop → NoteboardTheme ─────────────────────

function resolveTheme(
    theme: 'light' | 'dark' | NoteboardTheme | undefined,
    fallback: 'light' | 'dark',
): NoteboardTheme {
    if (!theme) return fallback === 'dark' ? DARK_THEME : LIGHT_THEME;
    if (typeof theme === 'string') return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    return theme;
}

export const Noteboard = forwardRef<NoteboardRef, NoteboardProps>((
    {
        slots = DEFAULT_SLOTS,
        toolbarPosition = 'bottom',
        propertiesPosition = 'left',
        onToolSelect,
        activeTool: controlledTool,
        theme: themeProp,
        defaultTheme = 'dark',
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
    const [activeShape, setActiveShape] = useState<ShapeVariant>('rectangle');
    const [snapEnabled, setSnapEnabled] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInsertPosRef = useRef<{ x: number; y: number } | null>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });

    // ─── Theme state ─────────────────────────────────────────
    const isControlledTheme = themeProp !== undefined;
    const [internalDark, setInternalDark] = useState(defaultTheme === 'dark');

    const resolvedTheme = useMemo(
        () =>
            isControlledTheme
                ? resolveTheme(themeProp, 'light')
                : internalDark
                    ? DARK_THEME
                    : LIGHT_THEME,
        [isControlledTheme, themeProp, internalDark],
    );

    const isDark = useMemo(() => {
        if (isControlledTheme) {
            if (typeof themeProp === 'string') return themeProp === 'dark';
            return themeProp?.canvasBg === DARK_THEME.canvasBg;
        }
        return internalDark;
    }, [isControlledTheme, themeProp, internalDark]);

    const handleToggleDark = useCallback(() => {
        if (!isControlledTheme) {
            setInternalDark((v) => !v);
        }
    }, [isControlledTheme]);

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

    // ─── Shape keyboard shortcuts (R, O, D, T) + G for grid ─────
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
        history,
        zoomIn, zoomOut, zoomReset, fitAll,
    } = useCanvasDrawing({
        activeTool: currentTool,
        width: size.width,
        height: size.height,
        canvasBg: resolvedTheme.canvasBg,
        strokeColor: resolvedTheme.strokeColor,
        isDark,
        snapEnabled,
        showGrid,
        initialElements,
        initialViewport,
        externalElements,
        onElementsChange,
        onImageInsertRequest: useCallback((x: number, y: number) => {
            imageInsertPosRef.current = { x, y };
            fileInputRef.current?.click();
        }, []),
    });

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
    }), [elements, panOffset, zoom, threadId, boardId]);

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
                tabIndex={0}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    outline: 'none',
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
                    }}
                    onPointerDown={handlers.onPointerDown}
                    onPointerMove={handlers.onPointerMove}
                    onPointerUp={handlers.onPointerUp}
                    onPointerLeave={handlers.onPointerLeave}
                    onWheel={handlers.onWheel}
                    onDoubleClick={handlers.onDoubleClick}
                    onContextMenu={(e) => e.preventDefault()}
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
                                border: `1px solid ${SELECTION_COLOR}`,
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
                                caretColor: SELECTION_COLOR,
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



                <Toolbar
                    slots={slots}
                    position={toolbarPosition}
                    activeTool={currentTool}
                    onToolSelect={handleToolSelect}
                    activeShape={activeShape}
                />

                <ShapePicker
                    activeShape={activeShape}
                    activeTool={currentTool}
                    onSelectShape={handleShapeSelect}
                    toolbarPosition={toolbarPosition}
                />

                <SettingsPanel
                    isDark={isDark}
                    onToggleDark={handleToggleDark}
                    showGrid={showGrid}
                    onToggleGrid={() => {
                        setShowGrid((v) => !v);
                        setSnapEnabled((v) => !v);
                    }}
                    onSave={onSave ? handleSave : undefined}
                    onExportImage={handleExportImage}
                    onExportJSON={handleExportJSON}
                    onImportJSON={triggerImportJSON}
                    onClearCanvas={handleClearCanvas}
                />

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

                <ZoomHUD
                    zoom={zoom}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onReset={zoomReset}
                    onFitAll={fitAll}
                />
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
