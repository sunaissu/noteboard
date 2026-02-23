import React from 'react';
import type { Tool, ToolSlot, ToolbarPosition } from '../types';
import { TOOL_REGISTRY } from '../toolRegistry';

export interface ToolbarProps {
    slots: ToolSlot[];
    position?: ToolbarPosition;
    activeTool?: Tool;
    onToolSelect?: (tool: Tool) => void;
}

const positionToKey = (pos: number): string => (pos === 10 ? '0' : String(pos));

export const Toolbar: React.FC<ToolbarProps> = ({
    slots,
    position = 'bottom',
    activeTool,
    onToolSelect,
}) => {
    const isVertical = position === 'left' || position === 'right';

    const sortedSlots = [...slots].sort((a, b) => a.position - b.position);

    return (
        <div style={wrapperStyle(position)}>
            <div style={toolbarContainerStyle(isVertical)}>
                {sortedSlots.map((slot) => {
                    const def = TOOL_REGISTRY[slot.toolId];
                    if (!def) return null;

                    const isActive = activeTool === slot.toolId;
                    const Icon = def.icon;

                    return (
                        <button
                            key={slot.position}
                            onClick={() => onToolSelect?.(slot.toolId)}
                            title={`${def.label} (${positionToKey(slot.position)})`}
                            style={buttonStyle(isActive)}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    Object.assign(e.currentTarget.style, hoverBg);
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    Object.assign(e.currentTarget.style, defaultBg);
                                }
                            }}
                        >
                            <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                            <span style={badgeStyle}>{positionToKey(slot.position)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const wrapperStyle = (position: ToolbarPosition): React.CSSProperties => {
    const base: React.CSSProperties = {
        position: 'absolute',
        display: 'flex',
        zIndex: 1000,
        pointerEvents: 'none',
    };

    switch (position) {
        case 'top':
            return { ...base, top: 12, left: 0, right: 0, justifyContent: 'center' };
        case 'bottom':
            return { ...base, bottom: 12, left: 0, right: 0, justifyContent: 'center' };
        case 'left':
            return { ...base, left: 12, top: 0, bottom: 0, alignItems: 'center' };
        case 'right':
            return { ...base, right: 12, top: 0, bottom: 0, alignItems: 'center' };
    }
};

const toolbarContainerStyle = (vertical: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    gap: 2,
    padding: 4,
    borderRadius: 10,
    background: '#ffffff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
    pointerEvents: 'auto',
});

const buttonStyle = (isActive: boolean): React.CSSProperties => ({
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
    background: isActive ? '#e8e0ff' : 'transparent',
    color: isActive ? '#6c47ff' : '#444',
});

const hoverBg = { background: '#f2f2f2' };
const defaultBg = { background: 'transparent' };

const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 2,
    right: 2,
    fontSize: 9,
    lineHeight: 1,
    color: '#999',
    fontFamily: 'system-ui, sans-serif',
    pointerEvents: 'none',
};
