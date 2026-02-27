import React from 'react';
import { useNoteboardTheme } from '../ThemeContext';
import { TOOL_REGISTRY, SHAPE_VARIANTS } from '../toolRegistry';
import type { Tool, ShapeVariant, ToolbarPosition } from '../types';

export interface ShapePickerProps {
    activeShape: ShapeVariant;
    activeTool: Tool;
    onSelectShape: (shape: ShapeVariant) => void;
    toolbarPosition: ToolbarPosition;
}

const isShapeTool = (tool: Tool): tool is ShapeVariant =>
    SHAPE_VARIANTS.includes(tool);

// Letter key → shape variant
export const SHAPE_KEYS: Record<string, ShapeVariant> = {
    r: 'rectangle',
    o: 'ellipse',
    d: 'diamond',
    t: 'triangle',
};

// Reverse lookup: shape → key letter
const SHAPE_KEY_LABELS: Record<string, string> = {};
for (const [key, shape] of Object.entries(SHAPE_KEYS)) {
    SHAPE_KEY_LABELS[shape] = key.toUpperCase();
}

/** Position the picker adjacent to the toolbar based on its position. */
const getPickerStyle = (pos: ToolbarPosition): React.CSSProperties => {
    const base: React.CSSProperties = {
        position: 'absolute',
        zIndex: 1001,
        display: 'flex',
        pointerEvents: 'auto',
    };

    switch (pos) {
        case 'bottom':
            return {
                ...base,
                bottom: 62,
                left: '50%',
                transform: 'translateX(-50%)',
                flexDirection: 'row',
            };
        case 'top':
            return {
                ...base,
                top: 62,
                left: '50%',
                transform: 'translateX(-50%)',
                flexDirection: 'row',
            };
        case 'left':
            return {
                ...base,
                left: 62,
                top: '50%',
                transform: 'translateY(-50%)',
                flexDirection: 'column',
            };
        case 'right':
            return {
                ...base,
                right: 62,
                top: '50%',
                transform: 'translateY(-50%)',
                flexDirection: 'column',
            };
    }
};

export const ShapePicker: React.FC<ShapePickerProps> = ({
    activeShape,
    activeTool,
    onSelectShape,
    toolbarPosition,
}) => {
    const theme = useNoteboardTheme();

    // Only show when a shape tool is currently active
    if (!isShapeTool(activeTool)) return null;

    return (
        <div
            style={{
                ...getPickerStyle(toolbarPosition),
                gap: 2,
                padding: 4,
                borderRadius: 10,
                background: theme.toolbarBg,
                boxShadow: theme.toolbarShadow,
                transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}
        >
            {(SHAPE_VARIANTS as ShapeVariant[]).map((shape) => {
                const def = TOOL_REGISTRY[shape];
                if (!def) return null;
                const isActive = activeShape === shape;
                const Icon = def.icon;
                const keyLabel = SHAPE_KEY_LABELS[shape];

                return (
                    <button
                        key={shape}
                        onClick={() => onSelectShape(shape)}
                        title={`${def.label} (${keyLabel})`}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 36,
                            height: 36,
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'background 0.15s, color 0.15s',
                            background: isActive ? theme.buttonActiveBg : 'transparent',
                            color: isActive ? theme.buttonActiveColor : theme.buttonDefaultColor,
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = theme.buttonHoverBg;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                        {/* Shortcut key badge */}
                        <span
                            style={{
                                position: 'absolute',
                                bottom: 2,
                                right: 2,
                                fontSize: 9,
                                lineHeight: 1,
                                color: theme.badgeColor,
                                fontFamily: 'system-ui, sans-serif',
                                pointerEvents: 'none',
                            }}
                        >
                            {keyLabel}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
