import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { NoteboardElement, Point } from '../elements/types';
import { isShapeElement } from '../elements/types';
import { createElement, generateId } from '../elements/createElement';
import { getElementBounds } from '../elements/bounds';
import { hitTestElement } from '../elements/hitTest';
import { findBinding } from '../elements/connectorBinding';
import { populateNewFrames } from '../editingActions';
import { moveKeyboardCursor, nextKeyboardElement } from '../keyboardGeometry';
import { isDrawingTool, shouldCommitDrawnElement } from './canvasUtils';
import { snapToGrid } from './useGrid';
import type { Tool } from '../types';

interface Options {
    container: React.RefObject<HTMLDivElement>;
    elements: NoteboardElement[];
    selectedIds: Set<string>;
    select: (ids: Set<string>) => void;
    tool: Tool;
    setTool: (tool: Tool) => void;
    defaults: Partial<NoteboardElement>;
    mutate: (change: (elements: NoteboardElement[]) => NoteboardElement[], record?:boolean) => boolean;
    startText: (point: Point, element?: NoteboardElement) => void;
    insertImage: (point:Point)=>void;
    zoom: number;
    pan: Point;
    size: { width: number; height: number };
    setPan: (point: Point) => void;
    snap: boolean;
    readOnly: boolean;
    properties: () => void;
    commands: () => void;
    layers: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    fit: () => void;
    focusSelection: () => void;
    quickConnect: (direction: 'left' | 'right' | 'up' | 'down') => void;
}

export function useKeyboardCanvas(o: Options) {
    const [enabled, setEnabled] = useState(false);
    const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
    const cursorRef = useRef(cursor);
    const [anchor, setAnchor] = useState<Point | null>(null);
    const draftIdentity = useRef({id:generateId(),seed:1});
    const [extendSelection,setExtendSelection] = useState(false);
    const [points, setPoints] = useState<Point[]>([]);
    const [operation, setOperation] = useState<'cursor' | 'move' | 'resize'>('cursor');
    const [message, setMessage] = useState('');
    const focusedId = useRef<string>();
    const lastTool = useRef(o.tool);
    const operationRecorded=useRef(false);
    const say = (text: string) => setMessage(text);
    const place = (p: Point) => {
        cursorRef.current = p; setCursor(p);
        // Keep the cursor in a usable central area, away from edge toolbars.
        const sx = p.x * o.zoom + o.pan.x, sy = p.y * o.zoom + o.pan.y;
        const mx = Math.min(280, o.size.width / 3), my = Math.min(140, o.size.height / 3);
        const dx = sx < mx ? mx - sx : sx > o.size.width - mx ? o.size.width - mx - sx : 0;
        const dy = sy < my ? my - sy : sy > o.size.height - my ? o.size.height - my - sy : 0;
        if (dx || dy) o.setPan({ x: o.pan.x + dx, y: o.pan.y + dy });
    };
    const toggle = () => {
        setEnabled(value => !value); setExtendSelection(false); setAnchor(null); setPoints([]); setOperation('cursor');
        if (!enabled) place({ x: (o.size.width / 2 - o.pan.x) / o.zoom, y: (o.size.height / 2 - o.pan.y) / o.zoom });
        say(enabled ? 'Keyboard Canvas off.' : 'Keyboard Canvas on. Arrows move; Space draws; Tab selects; P opens properties. Escape exits.');
        o.container.current?.focus({ preventScroll: true });
    };
    useEffect(() => {
        if (lastTool.current !== o.tool) { setAnchor(null); setPoints([]); setOperation('cursor'); lastTool.current = o.tool; }
    }, [o.tool]);
    useEffect(() => { if (o.readOnly) { setAnchor(null); setPoints([]); setOperation('cursor'); } }, [o.readOnly]);

    const draft = (() => {
        if (!anchor || !isDrawingTool(o.tool)) return null;
        const end = o.snap ? snapToGrid(cursor) : cursor;
        if (o.tool === 'line' || o.tool === 'arrow') {
            const a = findBinding(anchor, o.elements, 12 / o.zoom, undefined, o.tool==='line'?'line':'arrow'), b = findBinding(end, o.elements, 12 / o.zoom, undefined, o.tool==='line'?'line':'arrow');
            const start = a?.point ?? anchor, finish = b?.point ?? end;
            return createElement(o.tool, { ...o.defaults, ...draftIdentity.current, x: start.x, y: start.y, width: finish.x - start.x, height: finish.y - start.y,
                points: [{ x: 0, y: 0 }, { x: finish.x - start.x, y: finish.y - start.y }], startBinding: a?.binding, endBinding: b?.binding });
        }
        if (o.tool === 'pen') return createElement('pen', { ...o.defaults, ...draftIdentity.current, x: anchor.x, y: anchor.y,
            width: end.x - anchor.x, height: end.y - anchor.y, points: [anchor, ...points, end].map(p => ({ x: p.x - anchor.x, y: p.y - anchor.y, pressure: .5 })) });
        return createElement(o.tool, { ...o.defaults, ...draftIdentity.current, x: Math.min(anchor.x, end.x), y: Math.min(anchor.y, end.y), width: Math.abs(end.x - anchor.x), height: Math.abs(end.y - anchor.y) });
    })();

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (e.nativeEvent.isComposing || e.defaultPrevented) return;
        const editing = !!target.closest('input,textarea,select,[contenteditable="true"]');
        const canvasTarget = target === o.container.current || target.tagName === 'CANVAS';
        const consume = () => { e.preventDefault(); e.stopPropagation(); };
        if (!editing && (e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Backquote' || e.key === '`' || e.key === '~')) {
            consume(); if (!e.repeat) toggle(); return;
        }
        if (!editing && canvasTarget && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { consume(); o.commands(); return; }
        if (!enabled || !canvasTarget || editing) return;
        const key = e.key.toLowerCase();
        if (e.key === 'F6') { consume(); setEnabled(false); setAnchor(null); say('Keyboard Canvas off. Tab now moves through controls.'); return; }
        if (e.key === 'Escape') {
            consume();
            if (anchor) { setAnchor(null); setPoints([]); say('Drawing cancelled.'); }
            else if (operation !== 'cursor') { setOperation('cursor'); say('Cursor mode.'); }
            else { setEnabled(false); say('Keyboard Canvas off.'); }
            return;
        }
        if (e.key === 'Tab') {
            consume(); if (anchor) { say('Finish with Space or cancel with Escape before selecting objects.'); return; }
            const next = nextKeyboardElement(o.elements, focusedId.current, e.shiftKey);
            if (!next) { say('No visible objects. Choose a tool to draw.'); return; }
            focusedId.current = next.id;
            const [l,t,r,b] = getElementBounds(next); place({ x: (l+r)/2, y: (t+b)/2 });
            o.select(extendSelection ? new Set([...o.selectedIds, next.id]) : new Set([next.id]));
            o.setTool('select'); setOperation('cursor');
            say(`${next.displayName || ('name' in next ? next.name : '') || next.type}${next.locked ? ', locked' : ''}. ${o.elements.filter(el => !el.isDeleted && !el.hidden).indexOf(next) + 1} of ${o.elements.filter(el => !el.isDeleted && !el.hidden).length}.`);
            return;
        }
        if (e.key.startsWith('Arrow')) {
            consume(); const step = (e.altKey ? 80 : e.shiftKey ? 1 : 10) / o.zoom;
            const delta = { x: e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, y: e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0 };
            if ((e.ctrlKey || e.metaKey) && e.altKey) { if (!o.readOnly && !e.repeat) o.quickConnect(e.key.slice(5).toLowerCase() as 'left'|'right'|'up'|'down'); return; }
            if ((e.ctrlKey || e.metaKey) && operation === 'cursor') { o.setPan({ x: o.pan.x - delta.x * o.zoom, y: o.pan.y - delta.y * o.zoom }); return; }
            if (operation !== 'cursor') {
                if (o.readOnly) return;
                o.mutate(els => els.map(el => !o.selectedIds.has(el.id) || el.isDeleted || el.hidden || el.locked ? el : operation === 'move'
                    ? { ...el, x: el.x + delta.x, y: el.y + delta.y }
                    : 'points' in el ? el : { ...el, width: Math.sign(el.width || 1) * Math.max(5 / o.zoom, Math.abs(el.width) + delta.x), height: Math.sign(el.height || 1) * Math.max(5 / o.zoom, Math.abs(el.height) + delta.y) }),!operationRecorded.current);
                operationRecorded.current=true;
                if (operation === 'move') place({ x: cursorRef.current.x + delta.x, y: cursorRef.current.y + delta.y });
                return;
            }
            const p = moveKeyboardCursor(cursorRef.current, delta, o.elements, e.altKey && !anchor);
            place(p); if (anchor && o.tool === 'pen') setPoints(previous => previous.length < 10000 ? [...previous, p] : previous);
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return; // Keep copy, paste, undo and redo.
        if (key === 'a') { consume();setExtendSelection(value=>!value);say(extendSelection?'Replace selection.':'Add to selection. Tab adds objects; A turns this off.');return; }
        if (key === 'p') { consume(); o.properties(); return; }
        if (key === 'l') { consume(); o.layers(); return; }
        if (key === '+' || key === '=') { consume(); o.zoomIn(); return; }
        if (key === '-') { consume(); o.zoomOut(); return; }
        if (key === 'f') { consume(); e.shiftKey ? o.focusSelection() : o.fit(); return; }
        if (key === 'm' || (key === 's' && e.shiftKey)) {
            consume(); if (o.readOnly) { say('View only.'); return; }
            if (!o.selectedIds.size) { say('Select an object with Tab first.'); return; }
            operationRecorded.current=false;
            const next = key === 'm' ? 'move' : 'resize'; setOperation(operation === next ? 'cursor' : next);
            say(next === 'move' ? 'Move selection with arrows; Shift for precision. Enter finishes.' : 'Resize with arrows; Shift for precision. Lines use endpoint properties. Enter finishes.'); return;
        }
        if (e.key === 'Enter') {
            consume(); if (e.repeat) return;
            if (operation !== 'cursor') { setOperation('cursor'); say('Cursor mode.'); return; }
            const selected = o.elements.find(el => o.selectedIds.has(el.id) && !el.isDeleted && !el.hidden);
            if (o.readOnly || selected?.locked) { say('This object cannot be edited.'); return; }
            if (selected && (selected.type === 'text' || isShapeElement(selected))) o.startText(cursor, selected);
            else if (selected) o.properties();
            else if (o.tool === 'text') o.startText(cursor);
            else say('Tab selects an object. Enter edits its text.');
            return;
        }
        if (e.key === ' ') {
            consume(); if (e.repeat) return;
            if (o.tool === 'select') {
                const hit = [...o.elements].reverse().find(el => !el.isDeleted && !el.hidden && hitTestElement(cursor, el, 8 / o.zoom));
                if (hit) { const ids = e.shiftKey ? new Set(o.selectedIds) : new Set<string>(); if (e.shiftKey && ids.has(hit.id)) ids.delete(hit.id); else ids.add(hit.id); o.select(ids); focusedId.current = hit.id; say(hit.displayName || hit.type); }
                else { o.select(new Set()); say('No object at cursor.'); } return;
            }
            if (o.readOnly) { say('View only.'); return; }
            if (o.tool === 'image') { o.insertImage(cursor); return; }
            if (o.tool === 'text') { o.startText(cursor); return; }
            if (!isDrawingTool(o.tool)) { say('Choose a shape, connector, text or pen tool.'); return; }
            if (!anchor) { draftIdentity.current={id:generateId(),seed:Math.floor(Math.random()*2147483647)};setAnchor(o.snap ? snapToGrid(cursor) : cursor); setPoints([]); say('Start point set. Move and press Space to finish. Escape cancels.'); return; }
            if (!draft || !shouldCommitDrawnElement(draft, o.zoom, Math.hypot(cursor.x-anchor.x,cursor.y-anchor.y))) { say('Move farther before finishing. Shapes need both width and height.'); return; }
            if(!o.mutate(els => populateNewFrames(els,[...els, draft]))){say('The board could not accept this object. Change it or cancel with Escape.');return;} o.select(new Set([draft.id])); focusedId.current = draft.id; setAnchor(null); setPoints([]); say(`${draft.type} created.`);
        }
    };
    return { enabled, toggle, cursor, anchor, draft, operation, message, onKeyDown, announce: say };
}
