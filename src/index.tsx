export { Noteboard } from './Noteboard';
export { Toolbar } from './components/Toolbar';
export { useToolbarShortcuts } from './hooks/useToolbarShortcuts';
export { useCanvasDrawing } from './hooks/useCanvasDrawing';
export { TOOL_REGISTRY, DEFAULT_SLOTS, ALL_TOOLS } from './toolRegistry';
export { renderElements, renderElement, clearCanvas } from './renderer';
export * from './elements';
export type {
    Tool,
    ToolDefinition,
    ToolSlot,
    ToolbarConfig,
    ToolbarPosition,
    NoteboardProps,
} from './types';
