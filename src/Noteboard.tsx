import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Toolbar } from './components/Toolbar';
import { SettingsPanel } from './components/SettingsPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ShapePicker, SHAPE_KEYS } from './components/ShapePicker';
import { useToolbarShortcuts } from './hooks/useToolbarShortcuts';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import { DEFAULT_SLOTS } from './toolRegistry';
import { ThemeContext, LIGHT_THEME, DARK_THEME } from './ThemeContext';
import type { NoteboardTheme } from './ThemeContext';
import type { NoteboardProps, Tool, ShapeVariant } from './types';
import {
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FAMILY,
    SELECTION_COLOR,
} from './constants';

// ─── Cursor helper (standalone to avoid re-creation) ─────────

const cursorForTool = (tool: Tool): string => {
    switch (tool) {
        case 'pan':
            return 'grab';
        case 'text':
            return 'text';
        case 'eraser':
            return 'crosshair';
        case 'select':
            return 'default';
        default:
            return 'crosshair';
    }
};

// ─── Resolve theme prop → NoteboardTheme ─────────────────────

function resolveTheme(
    theme: 'light' | 'dark' | NoteboardTheme | undefined,
    fallback: 'light' | 'dark',
): NoteboardTheme {
    if (!theme) return fallback === 'dark' ? DARK_THEME : LIGHT_THEME;
    if (typeof theme === 'string') return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    return theme;
}

export const Noteboard: React.FC<NoteboardProps> = ({
    slots = DEFAULT_SLOTS,
    toolbarPosition = 'bottom',
    propertiesPosition = 'top',
    onToolSelect,
    activeTool: controlledTool,
    theme: themeProp,
    defaultTheme = 'dark',
}) => {
    const [internalTool, setInternalTool] = useState<Tool>('select');
    const [activeShape, setActiveShape] = useState<ShapeVariant>('rectangle');
    const containerRef = useRef<HTMLDivElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
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

    // ─── Shape keyboard shortcuts (R, O, D, T) ───────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in an input
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const shape = SHAPE_KEYS[e.key.toLowerCase()];
            if (shape) {
                handleShapeSelect(shape);
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

    const { canvasRef, handlers, textEdit, commitText, panOffset, zoom, elements, setElements, selectedIds } = useCanvasDrawing({
        activeTool: currentTool,
        width: size.width,
        height: size.height,
        canvasBg: resolvedTheme.canvasBg,
        strokeColor: resolvedTheme.strokeColor,
    });

    // ─── Properties panel support ─────────────────────────────
    const selectedElements = React.useMemo(
        () => elements.filter((el) => selectedIds.has(el.id) && !el.isDeleted),
        [elements, selectedIds],
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
                        cursor: cursorForTool(currentTool),
                        pointerEvents: textEdit.active ? 'none' : 'auto',
                    }}
                    onPointerDown={handlers.onPointerDown}
                    onPointerMove={handlers.onPointerMove}
                    onPointerUp={handlers.onPointerUp}
                    onWheel={handlers.onWheel}
                    onDoubleClick={handlers.onDoubleClick}
                    onContextMenu={(e) => e.preventDefault()}
                />

                {/* Text input overlay — subtle, inline look */}
                {textEdit.active && (
                    <textarea
                        key={textEdit.editingId ?? `new-${textEdit.x}-${textEdit.y}`}
                        ref={textInputRef}
                        rows={1}
                        autoFocus
                        defaultValue={textEdit.initialText}
                        style={{
                            position: 'absolute',
                            left: textEdit.x * zoom + panOffset.x,
                            top: textEdit.y * zoom + panOffset.y,
                            minWidth: 2,
                            fontSize: DEFAULT_FONT_SIZE * zoom,
                            fontFamily: `'${DEFAULT_FONT_FAMILY.split(',')[0].trim()}', sans-serif`,
                            border: `1px dashed ${SELECTION_COLOR}`,
                            borderRadius: 2,
                            padding: '1px 2px',
                            margin: 0,
                            outline: 'none',
                            background: 'transparent',
                            resize: 'none',
                            overflow: 'hidden',
                            zIndex: 1001,
                            color: resolvedTheme.textInputColor,
                            lineHeight: '1.2',
                            whiteSpace: 'pre',
                            caretColor: SELECTION_COLOR,
                            boxShadow: 'none',
                            boxSizing: 'border-box',
                            wordBreak: 'keep-all',
                        }}
                        onKeyDown={handleTextKeyDown}
                        onBlur={handleTextBlur}
                        onInput={(e) => {
                            // Auto-size the textarea to fit content exactly
                            const ta = e.currentTarget;
                            ta.style.height = '0px';
                            ta.style.height = ta.scrollHeight + 2 + 'px';
                            ta.style.width = 'auto';
                            ta.style.width = Math.max(ta.scrollWidth + 2, 2) + 'px';
                        }}
                    />
                )}

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
                />

                <PropertiesPanel
                    selectedElements={selectedElements}
                    onUpdateElements={handleUpdateElements}
                    isDark={isDark}
                    position={resolvedPropertiesPosition}
                />
            </div>
        </ThemeContext.Provider>
    );
};
