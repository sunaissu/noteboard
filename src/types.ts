import type { ComponentType } from 'react';
import type { NoteboardTheme } from './ThemeContext';
import type { NoteboardElement } from './elements/types';
import type { NoteboardSession, NoteboardViewport } from './session';

export type Tool = 'select' | 'pan' | 'line' | 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'text' | 'arrow' | 'eraser' | 'pen' | 'image' | 'frame' | 'star' | 'sticky-note' | 'callout';

export type ShapeVariant = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'frame' | 'star';

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

export interface NoteboardRef {
    /** Returns the live elements array at the time of the call */
    getElements(): NoteboardElement[];
    /**
     * Returns a DB-ready snapshot of the current board state.
     * Falls back to 'default-thread' / 'default-board' if those props were not supplied.
     */
    getSession(): NoteboardSession;
    /**
     * Exports the canvas as a data URL.
     * @param format - 'png' (default) or 'jpeg'
     */
    exportImage(format?: 'png' | 'jpeg'): string;
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

    // ── Persistence & multiplayer ──────────────────────────────

    /**
     * Seed elements on first mount (e.g. loaded from your DB).
     * Ignored after initial render — use `elements` for fully controlled mode.
     */
    initialElements?: NoteboardElement[];
    /**
     * Seed viewport (pan/zoom) on first mount, e.g. from a saved NoteboardSession.
     */
    initialViewport?: NoteboardViewport;
    /**
     * Fully controlled elements. When this prop changes the board updates to match.
     * Use this to push remote changes from a WebSocket or other sync source.
     */
    elements?: NoteboardElement[];
    /**
     * Fires after every draw, edit, move or delete action.
     * Use this to broadcast changes via WebSocket or debounce-save to your DB.
     */
    onElementsChange?: (elements: NoteboardElement[]) => void;
    /**
     * Fires when the user clicks the Save button (only shown when this prop is provided).
     * Receives a fully serialized NoteboardSession ready to store in a DB.
     */
    onSave?: (session: NoteboardSession) => void;
    /**
     * Identifies the room / thread this board belongs to.
     * Stored in the NoteboardSession returned by onSave and ref.getSession().
     */
    threadId?: string;
    /**
     * Unique ID for this board instance.
     * Stored in the NoteboardSession returned by onSave and ref.getSession().
     */
    boardId?: string;
}
