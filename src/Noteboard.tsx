import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { useToolbarShortcuts } from './hooks/useToolbarShortcuts';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import { DEFAULT_SLOTS } from './toolRegistry';
import type { NoteboardProps, Tool } from './types';
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

export const Noteboard: React.FC<NoteboardProps> = ({
    slots = DEFAULT_SLOTS,
    toolbarPosition = 'bottom',
    onToolSelect,
    activeTool: controlledTool,
}) => {
    const [internalTool, setInternalTool] = useState<Tool>('select');
    const containerRef = useRef<HTMLDivElement>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);
    const [size, setSize] = useState({ width: 800, height: 600 });

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

    useToolbarShortcuts(slots, handleToolSelect);

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

    const { canvasRef, handlers, textEdit, commitText, panOffset, zoom } = useCanvasDrawing({
        activeTool: currentTool,
        width: size.width,
        height: size.height,
    });

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
        <div
            ref={containerRef}
            tabIndex={0}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                outline: 'none',
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
                        color: '#1e1e1e',
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
            />
        </div>
    );
};
