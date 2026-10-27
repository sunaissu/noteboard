import type { CSSProperties } from 'react';

export interface NoteboardScrollbarOptions {
    /** CSS color for the draggable thumb. Omit both colors for browser styling. */
    thumbColor?: string;
    /** CSS color for the track. Defaults to transparent when a thumb color is set. */
    trackColor?: string;
    /** `none` hides the scrollbar without disabling scrolling. */
    width?: 'auto' | 'thin' | 'none';
}

/** Use with .sunaissu-noteboard-scrollbar on a host-owned scroll container. */
export function getNoteboardScrollbarStyle(options: NoteboardScrollbarOptions = {}): CSSProperties {
    const thumb = options.thumbColor?.trim();
    const track = options.trackColor?.trim();
    return {
        '--noteboard-scrollbar-width': options.width ?? 'auto',
        '--noteboard-scrollbar-color': thumb || track
            ? `${thumb || 'currentColor'} ${track || 'transparent'}`
            : 'auto',
        '--noteboard-scrollbar-thumb': thumb || 'currentColor',
        '--noteboard-scrollbar-track': track || 'transparent',
        '--noteboard-scrollbar-size': options.width === 'thin' ? '8px' : '12px',
    } as CSSProperties;
}

/** Spread onto a host-owned scroll container alongside a rendered Noteboard. */
export function getNoteboardScrollbarProps(options: NoteboardScrollbarOptions = {}) {
    const mode = options.width === 'none' ? 'hidden'
        : options.thumbColor?.trim() || options.trackColor?.trim() ? 'custom' : 'native';
    return {
        className: 'sunaissu-noteboard-scrollbar',
        'data-noteboard-scrollbar': mode,
        style: getNoteboardScrollbarStyle(options),
    };
}
