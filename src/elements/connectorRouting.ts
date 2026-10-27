import type {NoteboardElement,Point,Bounds} from './types';
import {isShapeElement} from './types';
import {getElementBounds} from './bounds';

const inside=(p:Point,b:Bounds)=>p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3];
const blocked=(a:Point,b:Point,boxes:Bounds[])=>boxes.some(r=>a.x===b.x
    ?a.x>r[0]&&a.x<r[2]&&Math.max(a.y,b.y)>r[1]&&Math.min(a.y,b.y)<r[3]
    :a.y>r[1]&&a.y<r[3]&&Math.max(a.x,b.x)>r[0]&&Math.min(a.x,b.x)<r[2]);
function simplify(points:Point[]):Point[]{return points.filter((p,i)=>!i||i===points.length-1||!((points[i-1].x===p.x&&p.x===points[i+1].x)||(points[i-1].y===p.y&&p.y===points[i+1].y)));}

/** Bounded rectilinear routing, using all obstacles for candidate validation. */
export function routeOrthogonal(start:Point,end:Point,obstacles:Bounds[]):Point[] {
    const boxes=obstacles.filter(b=>!inside(start,b)&&!inside(end,b));
    const mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
    const candidates=[
        [start,{x:mx,y:start.y},{x:mx,y:end.y},end],
        [start,{x:start.x,y:my},{x:end.x,y:my},end],
        [start,{x:end.x,y:start.y},end],[start,{x:start.x,y:end.y},end],
    ];
    if(boxes.length){const l=Math.min(start.x,end.x,...boxes.map(b=>b[0]))-16,r=Math.max(start.x,end.x,...boxes.map(b=>b[2]))+16,t=Math.min(start.y,end.y,...boxes.map(b=>b[1]))-16,b=Math.max(start.y,end.y,...boxes.map(b=>b[3]))+16;
        candidates.push(...[l,r].map(x=>[start,{x,y:start.y},{x,y:end.y},end]),...[t,b].map(y=>[start,{x:start.x,y},{x:end.x,y},end]));}
    const clear=candidates.filter(path=>path.every((p,i)=>!i||!blocked(path[i-1],p,boxes)));
    if(clear.length){const length=(p:Point[])=>p.reduce((sum,v,i)=>sum+(i?Math.abs(v.x-p[i-1].x)+Math.abs(v.y-p[i-1].y):0),0);clear.sort((a,b)=>length(a)-length(b));return simplify(clear[0]);}
    // Coordinate compression bounds work on dense imported boards. More distant
    // obstacles still block edges, even when they do not contribute grid lanes.
    const lanes=boxes.slice().sort((a,b)=>Math.hypot((a[0]+a[2])/2-mx,(a[1]+a[3])/2-my)-Math.hypot((b[0]+b[2])/2-mx,(b[1]+b[3])/2-my)).slice(0,32);
    const xs=[...new Set([start.x,end.x,...lanes.reduce<number[]>((a,b)=>a.concat(b[0],b[2]),[])])].sort((a,b)=>a-b);
    const ys=[...new Set([start.y,end.y,...lanes.reduce<number[]>((a,b)=>a.concat(b[1],b[3]),[])])].sort((a,b)=>a-b);
    const point=(id:number)=>({x:xs[id%xs.length],y:ys[Math.floor(id/xs.length)]});
    const origin=ys.indexOf(start.y)*xs.length+xs.indexOf(start.x),goal=ys.indexOf(end.y)*xs.length+xs.indexOf(end.x);
    const distance=new Map([[origin,0]]),previous=new Map<number,number>(),open=new Set([origin]);let visits=0;
    while(open.size&&visits++<4500){let current=-1,score=Infinity;for(const id of open){const p=point(id),s=distance.get(id)!+Math.abs(p.x-end.x)+Math.abs(p.y-end.y);if(s<score){score=s;current=id;}}
        if(current===goal){const path=[end];while(current!==origin){current=previous.get(current)!;path.unshift(point(current));}return simplify(path);}
        open.delete(current);const x=current%xs.length,y=Math.floor(current/xs.length),a=point(current);
        const neighbors=[x>0?current-1:-1,x<xs.length-1?current+1:-1,y>0?current-xs.length:-1,y<ys.length-1?current+xs.length:-1];
        for(const id of neighbors){if(id<0)continue;const b=point(id);if(blocked(a,b,boxes))continue;const next=distance.get(current)!+Math.abs(a.x-b.x)+Math.abs(a.y-b.y);if(next<(distance.get(id)??Infinity)){distance.set(id,next);previous.set(id,current);open.add(id);}}
    }
    // Enclosed endpoints or excessive complexity: retain a valid editable elbow.
    return simplify(candidates[0]);
}

export function routeConnectors(elements:NoteboardElement[]):NoteboardElement[]{
    const shapes=elements.filter(el=>!el.isDeleted&&!el.hidden&&isShapeElement(el));
    let changed=false;
    const result=elements.map(el=>{
        if((el.type!=='line'&&el.type!=='arrow')||el.routing!=='orthogonal'||el.manualRoute||el.isDeleted||el.hidden||el.angle||el.points.length<2)return el;
        const first=el.points[0],last=el.points[el.points.length-1],start={x:el.x+first.x,y:el.y+first.y},end={x:el.x+last.x,y:el.y+last.y};
        const boxes=shapes.filter(s=>s.id!==el.startBinding?.elementId&&s.id!==el.endBinding?.elementId).map(s=>{const b=getElementBounds(s);return [b[0]-12,b[1]-12,b[2]+12,b[3]+12] as Bounds;});
        const points=routeOrthogonal(start,end,boxes).map(p=>({x:p.x-el.x,y:p.y-el.y}));
        if(points.length===el.points.length&&points.every((p,i)=>p.x===el.points[i].x&&p.y===el.points[i].y))return el;
        changed=true;return {...el,points};
    });return changed?result:elements;
}

export function connectorRouteWarnings(elements:NoteboardElement[],selected?:Set<string>):string[]{
    const shapes=elements.filter(el=>!el.isDeleted&&!el.hidden&&isShapeElement(el));
    return elements.filter(el=>{
        if((el.type!=='line'&&el.type!=='arrow')||el.routing!=='orthogonal'||el.manualRoute||el.isDeleted||el.hidden||el.angle||(selected&&!selected.has(el.id)))return false;
        const boxes=shapes.filter(s=>s.id!==el.startBinding?.elementId&&s.id!==el.endBinding?.elementId).map(getElementBounds);
        const points=el.points.map(p=>({x:el.x+p.x,y:el.y+p.y}));
        return points.some((p,i)=>boxes.some(box=>inside(p,box))||(i>0&&blocked(points[i-1],p,boxes)));
    }).map(el=>el.id);
}
