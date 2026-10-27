import React from 'react';
import { useNoteboardTheme } from '../ThemeContext';
import { TOOL_REGISTRY, SHAPE_VARIANTS } from '../toolRegistry';
import type { Tool, ShapeVariant, ToolbarPosition } from '../types';

export interface ShapePickerProps {
    edgeOffset?: number;
    /** Board-relative bounds for the other edges; edgeOffset controls the chosen edge. */
    viewportInsets?: Partial<Record<ToolbarPosition, number>>;
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
    s: 'star',
};

// Reverse lookup: shape → key letter
const SHAPE_KEY_LABELS: Record<string, string> = {};
for (const [key, shape] of Object.entries(SHAPE_KEYS)) {
    SHAPE_KEY_LABELS[shape] = key.toUpperCase();
}

/** Position the picker adjacent to the toolbar based on its position. */
const getPickerStyle = (
    pos: ToolbarPosition,
    offset = 72,
    viewportInsets: Partial<Record<ToolbarPosition, number>> = {},
): React.CSSProperties => {
    const base: React.CSSProperties = {
        position: 'absolute',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        top: Math.max(12, viewportInsets.top ?? 12),
        right: Math.max(12, viewportInsets.right ?? 12),
        bottom: Math.max(12, viewportInsets.bottom ?? 12),
        left: Math.max(12, viewportInsets.left ?? 12),
        minWidth: 0,
        minHeight: 0,
        pointerEvents: 'none',
    };

    switch (pos) {
        case 'bottom':
            return {
                ...base,
                bottom: Math.max(12, offset),
                alignItems: 'center',
                justifyContent: 'flex-end',
            };
        case 'top':
            return {
                ...base,
                top: Math.max(12, offset),
                alignItems: 'center',
                justifyContent: 'flex-start',
            };
        case 'left':
            return {
                ...base,
                left: Math.max(12, offset),
                alignItems: 'flex-start',
                justifyContent: 'center',
            };
        case 'right':
            return {
                ...base,
                right: Math.max(12, offset),
                alignItems: 'flex-end',
                justifyContent: 'center',
            };
    }
};

export const ShapePicker: React.FC<ShapePickerProps> = ({
    activeShape,
    activeTool,
    onSelectShape,
    toolbarPosition, edgeOffset, viewportInsets,
}) => {
    const theme = useNoteboardTheme();
    const isVertical = toolbarPosition === 'left' || toolbarPosition === 'right';

    if (!isShapeTool(activeTool)) return null;

    return (
        <div style={getPickerStyle(toolbarPosition, edgeOffset, viewportInsets)}>
            <div data-noteboard-shapes
            data-scroll-axis={isVertical ? 'vertical' : 'horizontal'}
            style={{
                display: 'flex',
                flexDirection: isVertical ? 'column' : 'row',
                width: 'max-content',
                maxWidth: '100%',
                maxHeight: '100%',
                minWidth: 0,
                minHeight: 0,
                boxSizing: 'border-box',
                flex: '0 1 auto',
                flexWrap: 'nowrap',
                overflow: 'auto',
                scrollPadding: 4,
                overscrollBehavior: 'contain',
                pointerEvents: 'auto',
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
                    <button type="button"
                        key={shape}
                        onClick={() => onSelectShape(shape)}
                        aria-label={def.label} aria-pressed={activeTool===def.id} title={keyLabel ? `${def.label} (${keyLabel})` : def.label}
                        style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 44,
                            height: 44,
                            flex: '0 0 auto',
                            padding: 0,
                            touchAction: 'manipulation',
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
                        {keyLabel && (
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
                        )}
                    </button>
                );
            })}
            </div>
        </div>
    );
};
