import { createContext, useContext, useSyncExternalStore } from 'react';

export type NoteboardThemeMode = 'light' | 'dark' | 'system';
export type NoteboardResolvedTheme = Exclude<NoteboardThemeMode, 'system'>;

/** Simple brand colors layered on top of the selected light/dark theme. */
export interface NoteboardBrandColors {
    primary?: string;
    secondary?: string;
}

// ─── Theme Token Interface ───────────────────────────────────

export interface NoteboardTheme {
    // Brand colors (optional for backward-compatible custom theme objects)
    primaryColor?: string;
    primarySoft?: string;
    primaryOverlay?: string;
    primaryTextColor?: string;
    secondaryColor?: string;
    secondarySoft?: string;

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
    primaryColor: '#1976d2',
    primarySoft: '#e3f2fd',
    primaryOverlay: 'rgba(25, 118, 210, 0.14)',
    primaryTextColor: '#ffffff',
    secondaryColor: '#7c5cff',
    secondarySoft: 'rgba(124, 92, 255, 0.12)',
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
    primaryColor: '#90caf9',
    primarySoft: '#0d47a1',
    primaryOverlay: 'rgba(144, 202, 249, 0.16)',
    primaryTextColor: '#10202b',
    secondaryColor: '#a78bfa',
    secondarySoft: 'rgba(167, 139, 250, 0.16)',
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

function colorMix(color: string, amount: number): string {
    return `color-mix(in srgb, ${color} ${amount}%, transparent)`;
}

function transparentColor(color: string, alpha: number): string {
    const match = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!match) return colorMix(color, Math.round(alpha * 100));
    const expanded = match[1].length === 3
        ? match[1].split('').map((part) => part + part).join('')
        : match[1];
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function contrastText(color: string, fallback: string): string {
    const match = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (!match) return fallback;
    const expanded = match[1].length === 3
        ? match[1].split('').map((part) => part + part).join('')
        : match[1];
    const channels = [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.179 ? '#10202b' : '#ffffff';
}

/** Converts two brand colors into Noteboard's semantic theme tokens. */
export function applyNoteboardBrandColors(
    theme: NoteboardTheme,
    brandColors?: NoteboardBrandColors,
): NoteboardTheme {
    if (!brandColors?.primary && !brandColors?.secondary) return theme;
    const nextTheme = { ...theme };

    if (brandColors.primary) {
        nextTheme.primaryColor = brandColors.primary;
        nextTheme.primarySoft = colorMix(brandColors.primary, 16);
        nextTheme.primaryOverlay = transparentColor(brandColors.primary, 0.16);
        nextTheme.primaryTextColor = contrastText(brandColors.primary, theme.primaryTextColor ?? theme.panelBg);
        nextTheme.buttonActiveColor = brandColors.primary;
        nextTheme.buttonActiveBg = nextTheme.primarySoft;
    }

    if (brandColors.secondary) {
        nextTheme.secondaryColor = brandColors.secondary;
        nextTheme.secondarySoft = colorMix(brandColors.secondary, 14);
        nextTheme.badgeColor = brandColors.secondary;
    }

    return nextTheme;
}

// ─── React Context ───────────────────────────────────────────

export const ThemeContext = createContext<NoteboardTheme>(LIGHT_THEME);

export function useNoteboardTheme(): NoteboardTheme {
    return useContext(ThemeContext);
}

function getSystemTheme(): NoteboardResolvedTheme {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribeSystemTheme(onStoreChange: () => void): () => void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', onStoreChange);
    return () => media.removeEventListener('change', onStoreChange);
}

/** Resolves `system` and updates live when the operating-system preference changes. */
export function useResolvedNoteboardTheme(mode: NoteboardThemeMode): NoteboardResolvedTheme {
    const systemTheme = useSyncExternalStore(
        subscribeSystemTheme,
        getSystemTheme,
        (): NoteboardResolvedTheme => 'light',
    );

    return mode === 'system' ? systemTheme : mode;
}
