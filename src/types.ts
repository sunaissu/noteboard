import type { ComponentType } from 'react';
import type { NoteboardTheme } from './ThemeContext';

export type Tool = 'select' | 'pan' | 'line' | 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'text' | 'arrow' | 'eraser' | 'pen';

export type ShapeVariant = 'rectangle' | 'ellipse' | 'diamond' | 'triangle';

export type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';

export type PropertiesPosition = 'top' | 'bottom' | 'left' | 'right';

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
    /** Where the properties panel appears (default: 'top-right') */
    propertiesPosition?: PropertiesPosition;
    onToolSelect?: (tool: Tool) => void;
    activeTool?: Tool;
    /** Pass 'light', 'dark', or a custom NoteboardTheme object */
    theme?: 'light' | 'dark' | NoteboardTheme;
    /** Default theme when uncontrolled (default: 'dark') */
    defaultTheme?: 'light' | 'dark';
}
