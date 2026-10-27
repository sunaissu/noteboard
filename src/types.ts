import type { BoardImageOptions } from './exportImage';
import type { HistoryAPI } from './hooks/useHistory';
import type { ComponentType } from 'react';
import type { NoteboardBrandColors, NoteboardTheme, NoteboardThemeMode } from './ThemeContext';
import type { NoteboardElement } from './elements/types';
import type { NoteboardSession, NoteboardViewport } from './session';

export type Tool = 'select' | 'pan' | 'line' | 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'text' | 'arrow' | 'eraser' | 'pen' | 'image' | 'star' | 'sticky-note' | 'callout' | 'frame';

export type ShapeVariant = 'rectangle' | 'ellipse' | 'diamond' | 'triangle' | 'star';

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
    /** Select and focus a visible object. Returns false for a stale/deleted/hidden ID. */
    navigateToObject(id:string):boolean;
    /** Returns the live elements array at the time of the call */
    getElements(): NoteboardElement[];
    /** Read navigation without cloning board elements. */
    getViewport(): NoteboardViewport;
    /** Select and frame specific objects without changing their content. */
    focusElements(ids: string[]): void;
    /**
     * Imperatively replace the board elements. Useful for resetting the board
     * or pushing a specific state from outside the component.
     */
    setElements(elements: NoteboardElement[]): void;
    /**
     * Imperatively pan and zoom the board. Values are clamped to the same
     * zoom range used by pointer and HUD controls.
     */
    setViewport(viewport: NoteboardViewport): void;
    /**
     * Returns a DB-ready snapshot of the current board state.
     * Falls back to 'default-thread' / 'default-board' if those props were not supplied.
     */
    getSession(): NoteboardSession;
    /**
     * Exports the canvas as a data URL.
     * @param format - 'png' (default) or 'jpeg'
     */
    exportImage(format?: 'png' | 'jpeg', options?: BoardImageOptions): string;
    exportImageAsync(format?: 'png' | 'jpeg', options?: BoardImageOptions): Promise<string>;
}

export interface NoteboardProps {
    textDraftStorage?: import('./textDrafts').TextDraftStorage;
    workspace?: import('./boardWorkflows').BoardWorkspaceState;
    onWorkspaceChange?: (state: import('./boardWorkflows').BoardWorkspaceState) => void;
    workspaceStorage?: import('./boardWorkflows').BoardWorkspaceStorage;
    contentAdapter?: import('./boardMetadata').BoardContentAdapter;
    awareness?: import('./collaborationWorkflows').BoardAwarenessAdapter;
    comments?: import('./collaborationWorkflows').BoardCommentsAdapter;
    workshop?: import('./collaborationWorkflows').BoardWorkshopAdapter;
    versions?: import('./collaborationWorkflows').BoardVersionsAdapter;
    /** Default false: fingers pan, pens draw. Enable to draw using one finger. */
    defaultTouchDrawing?: boolean;
    /** Use the Yjs binding history for collaborative local-user undo. */
    history?: HistoryAPI;
    /** Admission limit before an uploaded image is decoded. Default and ceiling: 5 MiB. */
    maxImageBytes?: number;
    /** Maximum decoded image pixels. Default and ceiling: 16 million. */
    maxImagePixels?: number;
    slots?: ToolSlot[];
    toolbarPosition?: ToolbarPosition;
    /** Canvas edge where the properties panel appears (default: 'left') */
    propertiesPosition?: PropertiesPosition;
    onToolSelect?: (tool: Tool) => void;
    activeTool?: Tool;
    /** Controlled theme mode, or a legacy custom token object used as overrides. */
    theme?: NoteboardThemeMode | NoteboardTheme;
    /** Default theme when uncontrolled (default: 'system') */
    defaultTheme?: NoteboardThemeMode;
    /** Override individual colors while preserving light/dark/system switching. */
    themeOverrides?: Partial<NoteboardTheme>;
    /** Primary drives active tools/focus; secondary drives badges and supporting accents. */
    brandColors?: NoteboardBrandColors;
    /** Scrollbar appearance for board panels. Omit for native browser styling. */
    scrollbar?: import('./scrollbar').NoteboardScrollbarOptions;
    /** Fires when a theme mode is selected in the board settings. */
    onThemeChange?: (theme: NoteboardThemeMode) => void;

    /**
     * Controlled read-only mode. When true the board is view-only:
     * no drawing, editing, or element manipulation is possible,
     * but pan and zoom still work.
     * Omit this prop to let the component manage the state internally.
     */
    readOnly?: boolean;
    /**
     * Initial read-only value when the component is uncontrolled.
     * Defaults to false (editable).
     */
    defaultReadOnly?: boolean;
    /**
     * @deprecated Noteboard no longer owns a read-only toggle. Control the
     * `readOnly` prop in the host application instead.
     */
    onReadOnlyChange?: (readOnly: boolean) => void;
    /**
     * Fires whenever the user pans or zooms.
     * Use this to persist or broadcast the viewport externally.
     */
    onViewportChange?: (viewport: NoteboardViewport) => void;

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
     * Fully controlled viewport. Use with `onViewportChange` to synchronize
     * pan and zoom through an external store or collaboration provider.
     */
    viewport?: NoteboardViewport;
    /**
     * Fully controlled elements. When this prop changes the board updates to match.
     * Use this to push remote changes from a WebSocket or other sync source.
     */
    elements?: NoteboardElement[];
    /**
     * Fires after every draw, edit, move or delete action.
     * Use this to broadcast changes via WebSocket or debounce-save to your DB.
     */
    onElementsChange?: (elements: NoteboardElement[], previous: NoteboardElement[]) => void;
    /** Optional synchronous host admission before local state or collaboration changes. Return false to retain the previous board. */
    acceptElementsChange?: (elements: NoteboardElement[], previous: NoteboardElement[]) => boolean;
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
