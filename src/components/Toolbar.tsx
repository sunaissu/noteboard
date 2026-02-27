import React from 'react';
import type { Tool, ToolSlot, ToolbarPosition, PropertiesPosition, ShapeVariant } from '../types';
import { TOOL_REGISTRY, SHAPE_VARIANTS } from '../toolRegistry';
import { useNoteboardTheme } from '../ThemeContext';

export interface ToolbarProps {
    slots: ToolSlot[];
    position?: ToolbarPosition;
    propertiesPosition?: PropertiesPosition;
    activeTool?: Tool;
    onToolSelect?: (tool: Tool) => void;
    activeShape?: ShapeVariant;
}

const SHAPE_TOOL_IDS = new Set<string>(SHAPE_VARIANTS);

const positionToKey = (pos: number): string => (pos === 10 ? '0' : String(pos));

export const Toolbar: React.FC<ToolbarProps> = ({
    slots,
    position = 'bottom',
    propertiesPosition,
    activeTool,
    onToolSelect,
    activeShape = 'rectangle',
}) => {
    const theme = useNoteboardTheme();
    const isVertical = position === 'left' || position === 'right';

    const sortedSlots = [...slots].sort((a, b) => a.position - b.position);

    return (
        <div style={wrapperStyle(position, propertiesPosition)}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: isVertical ? 'column' : 'row',
                    gap: 2,
                    padding: 4,
                    borderRadius: 10,
                    background: theme.toolbarBg,
                    boxShadow: theme.toolbarShadow,
                    pointerEvents: 'auto',
                    transition: 'background 0.3s ease, box-shadow 0.3s ease',
                }}
            >
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
                        <button
                            key={slot.position}
                            onClick={() => onToolSelect?.(clickTool)}
                            title={`${def.label} (${positionToKey(slot.position)})`}
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

const wrapperStyle = (position: ToolbarPosition, propsPos?: PropertiesPosition): React.CSSProperties => {
    const base: React.CSSProperties = {
        position: 'absolute',
        display: 'flex',
        zIndex: 1000,
        pointerEvents: 'none',
    };
    // When sharing the same edge with the properties panel, push toolbar
    // inward so the properties panel can sit on the outer edge.
    const sameEdge = propsPos === position;
    const offset = sameEdge ? 60 : 12;

    switch (position) {
        case 'top':
            return { ...base, top: offset, left: 0, right: 0, justifyContent: 'center' };
        case 'bottom':
            return { ...base, bottom: offset, left: 0, right: 0, justifyContent: 'center' };
        case 'left':
            return { ...base, left: offset, top: 0, bottom: 0, alignItems: 'center' };
        case 'right':
            return { ...base, right: offset, top: 0, bottom: 0, alignItems: 'center' };
    }
};
