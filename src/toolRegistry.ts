import {
    CursorIcon,
    HandIcon,
    LineSegmentIcon,
    RectangleIcon,
    CircleIcon,
    DiamondIcon,
    TriangleIcon,
    TextTIcon,
    ArrowUpRightIcon,
    EraserIcon,
    PenIcon,
} from '@phosphor-icons/react';
import type { Tool, ToolDefinition, ToolSlot } from './types';

export const TOOL_REGISTRY: Record<Tool, ToolDefinition> = {
    select: { id: 'select', label: 'Select', icon: CursorIcon },
    pan: { id: 'pan', label: 'Pan', icon: HandIcon },
    rectangle: { id: 'rectangle', label: 'Rectangle', icon: RectangleIcon },
    ellipse: { id: 'ellipse', label: 'Ellipse', icon: CircleIcon },
    diamond: { id: 'diamond', label: 'Diamond', icon: DiamondIcon },
    triangle: { id: 'triangle', label: 'Triangle', icon: TriangleIcon },
    line: { id: 'line', label: 'Line', icon: LineSegmentIcon },
    arrow: { id: 'arrow', label: 'Arrow', icon: ArrowUpRightIcon },
    pen: { id: 'pen', label: 'Pen', icon: PenIcon },
    text: { id: 'text', label: 'Text', icon: TextTIcon },
    eraser: { id: 'eraser', label: 'Eraser', icon: EraserIcon },
};

export const SHAPE_VARIANTS: Tool[] = ['rectangle', 'ellipse', 'diamond', 'triangle'];

export const DEFAULT_SLOTS: ToolSlot[] = [
    { position: 1, toolId: 'select' },
    { position: 2, toolId: 'pan' },
    { position: 3, toolId: 'rectangle' },
    { position: 4, toolId: 'line' },
    { position: 5, toolId: 'arrow' },
    { position: 6, toolId: 'pen' },
    { position: 7, toolId: 'text' },
    { position: 8, toolId: 'eraser' },
];

export const ALL_TOOLS: Tool[] = [
    'select', 'pan', 'rectangle', 'ellipse', 'diamond', 'triangle',
    'line', 'text', 'arrow', 'eraser', 'pen',
];
