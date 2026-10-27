import type { NoteboardElement, Point } from './elements/types';
import { isShapeElement } from './elements/types';
import { createElement, createFrameElement } from './elements/createElement';
import { combineBounds, getElementBounds } from './elements/bounds';
import { getClosestPointOnShapeOutline, findBinding } from './elements/connectorBinding';

export const objectLabel = (el: NoteboardElement) => el.displayName || ('name' in el ? el.name : '') || ('text' in el ? el.text?.slice(0, 60) : '') || el.type;
const styleFields = new Set(['strokeColor','backgroundColor','fillStyle','strokeWidth','strokeStyle','opacity','roughness','dropShadow','blendMode','fontSize','fontFamily','textAlign','lineHeight','fontWeight','fontStyle','textDecoration','highlightColor','borderRadius','routing','curveType','startArrowhead','endArrowhead','label','labelFontSize','labelFontFamily','highlighter','tension','sides','isStar','innerRadius','noteColor','tailDirection','frameColor','showLabel']);
export function pickToolStyle(updates: Partial<NoteboardElement>): Partial<NoteboardElement> {
    const result: Record<string, unknown> = {};
    for (const [key,value] of Object.entries(updates)) if (styleFields.has(key)) result[key] = value;
    return result as Partial<NoteboardElement>;
}

export function frameSelection(elements: NoteboardElement[], ids: Set<string>) {
    const selected = elements.filter(el => ids.has(el.id) && !el.isDeleted && !el.hidden && !el.locked && el.type !== 'frame');
    if (!selected.length) return null;
    const [l,t,r,b] = combineBounds(selected.map(getElementBounds));
    return createFrameElement({ x: l-24, y: t-40, width: r-l+48, height: b-t+64, childIds: selected.map(el => el.id) });
}

export function expandFrameSelection(elements:readonly NoteboardElement[],ids:Iterable<string>):Set<string>{
    const result=new Set(ids),queue=[...result],lookup=new Map(elements.map(el=>[el.id,el]));
    for(let i=0;i<queue.length;i++){const el=lookup.get(queue[i]);if(el?.type==='frame')for(const id of el.childIds??[])if(!result.has(id)){result.add(id);queue.push(id);}}
    return result;
}

/** Carry unchanged children when a frame is translated. Explicit child edits win. */
export function moveFrameChildren(previous: NoteboardElement[], candidate: NoteboardElement[]): NoteboardElement[] {
    const before = new Map(previous.map(el => [el.id,el]));
    const shifts = new Map<string, Point>();
    for (const frame of candidate) {
        if (frame.type !== 'frame' || frame.isDeleted) continue;
        const old = before.get(frame.id);
        if (!old || old.locked || (old.x === frame.x && old.y === frame.y)) continue;
        const queue=[...(frame.childIds??[])],visited=new Set([frame.id]);
        for(let i=0;i<queue.length;i++){
            const id=queue[i];if(visited.has(id))continue;visited.add(id);
            const child=before.get(id);if(!child||child.locked||child.isDeleted)continue;
            if(!shifts.has(id))shifts.set(id,{x:frame.x-old.x,y:frame.y-old.y});
            if(child.type==='frame')queue.push(...(child.childIds??[]));
        }
    }
    if (!shifts.size) return candidate;
    return candidate.map(el => {
        const old = before.get(el.id), delta = shifts.get(el.id);
        return old && delta && !el.locked && !el.isDeleted && old.x === el.x && old.y === el.y ? { ...el, x: el.x+delta.x, y: el.y+delta.y } : el;
    });
}

/** A newly drawn frame captures fully enclosed, editable objects. */
export function populateNewFrames(previous:NoteboardElement[],candidate:NoteboardElement[]):NoteboardElement[]{
    const known=new Set(previous.map(el=>el.id));let changed=false;
    const frames:NoteboardElement[]=[],rest:NoteboardElement[]=[];
    for(const el of candidate){
        if(el.type!=='frame'||known.has(el.id)||el.childIds?.length){rest.push(el);continue;}
        const [l,t,r,b]=getElementBounds(el);
        const childIds=candidate.filter(child=>{if(child.type==='frame'||child.isDeleted||child.hidden||child.locked)return false;const box=getElementBounds(child);return box[0]>=l&&box[1]>=t&&box[2]<=r&&box[3]<=b;}).map(child=>child.id);
        frames.push({...el,childIds});changed=true;
    }return changed?[...frames,...rest]:candidate;
}

export function createConnectedSibling(source: NoteboardElement, direction: 'left'|'right'|'up'|'down', shape: 'rectangle'|'ellipse'|'diamond'|'triangle'|'star' = 'rectangle') {
    if (!isShapeElement(source) || source.locked || source.isDeleted || source.hidden) return null;
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const node = createElement(shape, { ...pickToolStyle(source), x: source.x+dx*(Math.abs(source.width)+100), y: source.y+dy*(Math.abs(source.height)+100), width: Math.abs(source.width), height: Math.abs(source.height) });
    const center = { x: source.x+source.width/2, y: source.y+source.height/2 };
    const other = { x: node.x+node.width/2, y: node.y+node.height/2 };
    const start = getClosestPointOnShapeOutline(source, other)!, end = getClosestPointOnShapeOutline(node, center)!;
    const connector = createElement('arrow', { x:start.x,y:start.y,width:end.x-start.x,height:end.y-start.y,strokeColor:source.strokeColor,
        points:[{x:0,y:0},{x:end.x-start.x,y:end.y-start.y}],
        startBinding:findBinding(start,[source],1)?.binding, endBinding:findBinding(end,[node],1)?.binding });
    return { node, connector };
}
