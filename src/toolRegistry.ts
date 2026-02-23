import {
    CursorIcon,
    HandIcon,
    LineSegmentIcon,
    RectangleIcon,
    TextTIcon,
    ArrowUpRightIcon,
    EraserIcon,
} from '@phosphor-icons/react';
import type { Tool, ToolDefinition, ToolSlot } from './types';

export const TOOL_REGISTRY: Record<Tool, ToolDefinition> = {
    select: { id: 'select', label: 'Select', icon: CursorIcon },
    pan: { id: 'pan', label: 'Pan', icon: HandIcon },
    line: { id: 'line', label: 'Line', icon: LineSegmentIcon },
    rectangle: { id: 'rectangle', label: 'Rectangle', icon: RectangleIcon },
    text: { id: 'text', label: 'Text', icon: TextTIcon },
    arrow: { id: 'arrow', label: 'Arrow', icon: ArrowUpRightIcon },
    eraser: { id: 'eraser', label: 'Eraser', icon: EraserIcon },
};

export const DEFAULT_SLOTS: ToolSlot[] = [
    { position: 1, toolId: 'select' },
    { position: 2, toolId: 'pan' },
    { position: 3, toolId: 'line' },
    { position: 4, toolId: 'rectangle' },
    { position: 5, toolId: 'text' },
    { position: 6, toolId: 'arrow' },
    { position: 7, toolId: 'eraser' },
];

export const ALL_TOOLS: Tool[] = [
    'select', 'pan', 'line', 'rectangle', 'text', 'arrow', 'eraser',
];
