import React from 'react';
import type { Tool, ToolSlot, ToolbarPosition, PropertiesPosition, ShapeVariant } from '../types';
import { TOOL_REGISTRY, SHAPE_VARIANTS } from '../toolRegistry';
import { useNoteboardTheme } from '../ThemeContext';

export interface ToolbarProps {
    slots: ToolSlot[];
    position?: ToolbarPosition;
    propertiesPosition?: PropertiesPosition;
    /** Distance from the board edge when another panel occupies that edge. */
    edgeOffset?: number;
    /** Board-relative bounds for the other edges; edgeOffset controls the chosen edge. */
    viewportInsets?: Partial<Record<ToolbarPosition, number>>;
    activeTool?: Tool;
    onToolSelect?: (tool: Tool) => void;
    activeShape?: ShapeVariant;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

const SHAPE_TOOL_IDS = new Set<string>(SHAPE_VARIANTS);

const positionToKey = (pos: number): string => (pos === 10 ? '0' : String(pos));

export const Toolbar: React.FC<ToolbarProps> = ({
    slots,
    position = 'bottom',
    propertiesPosition,
    edgeOffset,
    viewportInsets,
    activeTool,
    onToolSelect,
    activeShape = 'rectangle',
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
}) => {
    const theme = useNoteboardTheme();
    const isVertical = position === 'left' || position === 'right';

    const sortedSlots = [...slots].sort((a, b) => a.position - b.position);

    return (
        <div style={wrapperStyle(position, propertiesPosition, edgeOffset, viewportInsets)}>
            <div
                data-noteboard-toolbar
                data-scroll-axis={isVertical ? 'vertical' : 'horizontal'}
                style={{
                    display: 'flex',
                    flexDirection: isVertical ? 'column' : 'row',
                    gap: 2,
                    width: 'max-content',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    boxSizing: 'border-box',
                    flex: '0 1 auto',
                    flexWrap: 'nowrap',
                    justifyContent: 'flex-start',
                    alignContent: 'flex-start',
                    overflow: 'auto',
                    scrollPadding: 4,
                    overscrollBehavior: 'contain',
                    padding: 4,
                    borderRadius: 10,
                    background: theme.toolbarBg,
                    boxShadow: theme.toolbarShadow,
                    pointerEvents: 'auto',
                    transition: 'background 0.3s ease, box-shadow 0.3s ease',
                }}
            >
                {(onUndo || onRedo) && (
                    <>
                        <button type="button"
                            onClick={onUndo}
                            disabled={!canUndo}
                            title="Undo (Ctrl+Z)" aria-label="Undo"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 44, height: 44, flex: '0 0 auto', padding: 0,
                                touchAction: 'manipulation', border: 'none', borderRadius: 8,
                                cursor: canUndo ? 'pointer' : 'not-allowed',
                                background: 'transparent',
                                color: canUndo ? theme.buttonDefaultColor : theme.badgeColor,
                                fontSize: 16, opacity: canUndo ? 1 : 0.4,
                                transition: 'background 0.15s, opacity 0.15s',
                            }}
                            onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.background = theme.buttonHoverBg; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            ↩
                        </button>
                        <button type="button"
                            onClick={onRedo}
                            disabled={!canRedo}
                            title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 44, height: 44, flex: '0 0 auto', padding: 0,
                                touchAction: 'manipulation', border: 'none', borderRadius: 8,
                                cursor: canRedo ? 'pointer' : 'not-allowed',
                                background: 'transparent',
                                color: canRedo ? theme.buttonDefaultColor : theme.badgeColor,
                                fontSize: 16, opacity: canRedo ? 1 : 0.4,
                                transition: 'background 0.15s, opacity 0.15s',
                            }}
                            onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.background = theme.buttonHoverBg; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            ↪
                        </button>
                        <div style={{ width: isVertical ? 20 : 1, height: isVertical ? 1 : 20, flex: '0 0 auto', background: theme.panelBorder.replace('1px solid ', ''), margin: isVertical ? '4px 0' : '0 4px', alignSelf: 'center' }} />
                    </>
                )}
                {sortedSlots.map((slot) => {
                    // For the rectangle slot, show active shape's icon
                    const isShapeSlot = SHAPE_TOOL_IDS.has(slot.toolId);
                    const displayToolId = isShapeSlot ? activeShape : slot.toolId;
                    const def = TOOL_REGISTRY[displayToolId];
                    if (!def) return null;

                    const isActive = isShapeSlot
                        ? SHAPE_TOOL_IDS.has(activeTool ?? '')
                        : activeTool === slot.toolId;
                    const Icon = def.icon;
                    const clickTool = isShapeSlot ? activeShape : slot.toolId;

                    return (
                        <button type="button"
                            key={slot.position} aria-label={def.label} aria-pressed={isActive}
                            onClick={() => onToolSelect?.(clickTool)}
                            title={`${def.label} (${positionToKey(slot.position)})`}
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
                                {positionToKey(slot.position)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const wrapperStyle = (
    position: ToolbarPosition,
    propsPos?: PropertiesPosition,
    edgeOffset?: number,
    viewportInsets: Partial<Record<ToolbarPosition, number>> = {},
): React.CSSProperties => {
    const base: React.CSSProperties = {
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        top: Math.max(12, viewportInsets.top ?? 12),
        right: Math.max(12, viewportInsets.right ?? 12),
        bottom: Math.max(12, viewportInsets.bottom ?? 12),
        left: Math.max(12, viewportInsets.left ?? 12),
        minWidth: 0,
        minHeight: 0,
        zIndex: 1000,
        pointerEvents: 'none',
    };
    // When sharing the same edge with the properties panel, push toolbar
    // inward so the properties panel can sit on the outer edge.
    const sameEdge = propsPos === position;
    const offset = Math.max(12, edgeOffset ?? (sameEdge ? 60 : 12));

    switch (position) {
        case 'top':
            return { ...base, top: offset, alignItems: 'center', justifyContent: 'flex-start' };
        case 'bottom':
            return { ...base, bottom: offset, alignItems: 'center', justifyContent: 'flex-end' };
        case 'left':
            return { ...base, left: offset, alignItems: 'flex-start', justifyContent: 'center' };
        case 'right':
            return { ...base, right: offset, alignItems: 'flex-end', justifyContent: 'center' };
    }
};
