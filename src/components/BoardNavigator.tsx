import React, { useMemo, useRef, useState } from 'react';
import type { NoteboardElement } from '../elements/types';
import type { NoteboardViewport } from '../session';
import { combineBounds, getElementBounds } from '../elements/bounds';
import { useNoteboardTheme } from '../ThemeContext';

interface Props {
    elements: NoteboardElement[];
    viewport: NoteboardViewport;
    size: { width: number; height: number };
    onFocus: (ids: string[]) => void;
    onViewport: (viewport: NoteboardViewport) => void;
    onWorkspace?:()=>void;
}
export function BoardNavigator({ elements, viewport, size, onFocus, onViewport, onWorkspace }: Props) {
    const theme = useNoteboardTheme();
    const [query, setQuery] = useState('');
    const [bookmarks, setBookmarks] = useState<{ name: string; viewport: NoteboardViewport }[]>([]);
    const [name, setName] = useState('');
    const svg = useRef<SVGSVGElement>(null);
    const active = useMemo(() => elements.filter(element => !element.isDeleted && !element.hidden), [elements]);
    const bounds = useMemo(() => active.map(element => getElementBounds(element)), [active]);
    const box = useMemo(() => {
        if (!bounds.length) return [0, 0, 400, 300];
        const [left, top, right, bottom] = combineBounds(bounds);
        return [left - 30, top - 30, right + 30, bottom + 30];
    }, [bounds]);
    const label = (element: NoteboardElement) => ('text' in element && element.text ? element.text : 'label' in element && element.label ? element.label : element.type).toString();
    const matches = active.filter(element => (label(element) + ' ' + element.type + ' ' + element.id).toLowerCase().includes(query.toLowerCase()));
    const control: React.CSSProperties = { padding: '7px 9px', border: theme.panelBorder, borderRadius: 7, background: theme.buttonHoverBg, color: theme.panelTextColor, font: 'inherit', width: '100%', boxSizing: 'border-box' };
    return <details style={{ marginBottom: 16, color: theme.panelTextColor, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Navigate board · {active.length} objects</summary>
        <button type="button" title="Click the overview to navigate" aria-label="Navigate using board overview" style={{ ...control, padding: 0, margin: '8px 0', cursor: 'crosshair' }} onClick={event => {
            const matrix = svg.current?.getScreenCTM();
            if (!matrix || !event.detail) { onFocus(active.map(element => element.id)); return; }
            const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
            onViewport({ ...viewport, panX: size.width / 2 - point.x * viewport.zoom, panY: size.height / 2 - point.y * viewport.zoom });
        }}><svg ref={svg} width="100%" height="120" viewBox={`${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}`} aria-hidden="true">
            {active.map((element, index) => <rect key={element.id} x={bounds[index][0]} y={bounds[index][1]} width={Math.max(2, bounds[index][2] - bounds[index][0])} height={Math.max(2, bounds[index][3] - bounds[index][1])} fill={element.strokeColor} opacity={.5} />)}
            <rect x={-viewport.panX / viewport.zoom} y={-viewport.panY / viewport.zoom} width={size.width / viewport.zoom} height={size.height / viewport.zoom} fill="none" stroke={theme.buttonActiveColor} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg></button>
        <input aria-label="Search board objects" placeholder="Find text or object…" value={query} onChange={event => setQuery(event.target.value)} style={control} />
        <div role="list" aria-label="Board objects" style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 4, margin: '8px 0' }}>
            {matches.slice(0, 200).map(element => <div role="listitem" key={element.id}><button type="button" style={{ ...control, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label(element)} onClick={() => onFocus([element.id])}>{element.locked ? '🔒 ' : ''}{label(element)}</button></div>)}
            {!matches.length && <span>No matching objects</span>}
            {matches.length > 200 && <small>Showing 200 matches. Refine your search.</small>}
        </div>
        {onWorkspace?<button type="button" style={control} onClick={onWorkspace}>Manage saved viewpoints and selections</button>:<>
        <input aria-label="Viewpoint name" placeholder="Name this viewpoint" value={name} onChange={event => setName(event.target.value)} style={control} />
        <button type="button" disabled={!name.trim() || bookmarks.length >= 20} style={{ ...control, margin: '6px 0', cursor: 'pointer' }} onClick={() => { setBookmarks(previous => [...previous, { name: name.trim(), viewport: { ...viewport } }]); setName(''); }}>Save viewpoint for this session</button>
        {bookmarks.map((bookmark, index) => <div key={index} style={{ display: 'flex', gap: 4, marginBottom: 4 }}><button type="button" style={control} onClick={() => onViewport(bookmark.viewport)}>{bookmark.name}</button><button type="button" aria-label={`Remove ${bookmark.name} viewpoint`} style={{ ...control, width: 30 }} onClick={() => setBookmarks(previous => previous.filter((_, item) => item !== index))}>×</button></div>)}
        </>}
    </details>;
}
