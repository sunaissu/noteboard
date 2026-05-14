import { createContext, useContext } from 'react';

// ─── Theme Token Interface ───────────────────────────────────

export interface NoteboardTheme {
    // Canvas
    canvasBg: string;

    // Element defaults
    strokeColor: string;
    textColor: string;

    // Toolbar
    toolbarBg: string;
    toolbarShadow: string;
    buttonActiveBg: string;
    buttonActiveColor: string;
    buttonHoverBg: string;
    buttonDefaultColor: string;
    badgeColor: string;

    // Settings panel
    panelBg: string;
    panelBorder: string;
    panelTextColor: string;
    panelMutedColor: string;

    // Text input overlay
    textInputColor: string;
}

// ─── Light Theme ─────────────────────────────────────────────

export const LIGHT_THEME: NoteboardTheme = {
    canvasBg: '#ffffff',
    strokeColor: '#1e1e1e',
    textColor: '#1e1e1e',

    toolbarBg: '#ffffff',
    toolbarShadow: '0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
    buttonActiveBg: '#e3f2fd',
    buttonActiveColor: '#1976d2',
    buttonHoverBg: '#f2f2f2',
    buttonDefaultColor: '#444444',
    badgeColor: '#999999',

    panelBg: '#ffffff',
    panelBorder: '1px solid rgba(0,0,0,0.08)',
    panelTextColor: '#1e1e1e',
    panelMutedColor: '#888888',

    textInputColor: '#1e1e1e',
};

// ─── Dark Theme ──────────────────────────────────────────────

export const DARK_THEME: NoteboardTheme = {
    canvasBg: '#1e1e1e',
    strokeColor: '#e0e0e0',
    textColor: '#e0e0e0',

    toolbarBg: '#2a2a2a',
    toolbarShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
    buttonActiveBg: '#0d47a1',
    buttonActiveColor: '#90caf9',
    buttonHoverBg: '#3a3a3a',
    buttonDefaultColor: '#cccccc',
    badgeColor: '#777777',

    panelBg: '#2a2a2a',
    panelBorder: '1px solid rgba(255,255,255,0.08)',
    panelTextColor: '#e0e0e0',
    panelMutedColor: '#999999',

    textInputColor: '#e0e0e0',
};

// ─── React Context ───────────────────────────────────────────

export const ThemeContext = createContext<NoteboardTheme>(LIGHT_THEME);

export function useNoteboardTheme(): NoteboardTheme {
    return useContext(ThemeContext);
}
