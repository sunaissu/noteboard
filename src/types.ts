import type { ComponentType } from 'react';

export type Tool = 'select' | 'pan' | 'line' | 'rectangle' | 'text' | 'arrow' | 'eraser';

export type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';

export interface ToolDefinition {
    id: Tool;
    label: string;
    icon: ComponentType<any>;
}

export interface ToolSlot {
    position: number;
    toolId: Tool;
}

export interface ToolbarConfig {
    slots: ToolSlot[];
    position?: ToolbarPosition;
    onToolSelect?: (tool: Tool) => void;
    activeTool?: Tool;
}

export interface NoteboardProps {
    slots?: ToolSlot[];
    toolbarPosition?: ToolbarPosition;
    onToolSelect?: (tool: Tool) => void;
    activeTool?: Tool;
}
