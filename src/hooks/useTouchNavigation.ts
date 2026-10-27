import { useRef } from 'react';
import type React from 'react';
import type { Point } from '../elements/types';
import { MAX_ZOOM, MIN_ZOOM } from '../constants';

export function useTouchNavigation({pan,zoom,setPan,setZoom,canvas,cancel,drawWithTouch,onTap}:{
    pan:Point;zoom:number;setPan:(p:Point)=>void;setZoom:(z:number)=>void;canvas:React.RefObject<HTMLCanvasElement|null>;cancel:()=>void;drawWithTouch:boolean;onTap:(point:Point)=>void;
}) {
    const fingers=useRef(new Map<number,Point>()), pen=useRef<number|null>(null);
    const gesture=useRef<{points:Point[];pan:Point;zoom:number}|null>(null);
    const traveled=useRef(false),multiple=useRef(false);
    const current=useRef({pan,zoom});current.current={pan,zoom};
    const reset=()=>{gesture.current={points:Array.from(fingers.current.values()),...current.current};};
    const down=(e:React.PointerEvent<HTMLCanvasElement>)=>{
        if(e.pointerType==='pen'){pen.current=e.pointerId;return false;}
        if(e.pointerType!=='touch')return false;
        if(pen.current!==null){e.preventDefault();return true;}
        if(!fingers.current.size){traveled.current=false;multiple.current=false;}
        fingers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(fingers.current.size>1)multiple.current=true;
        if(fingers.current.size>=2||!drawWithTouch){cancel();canvas.current?.setPointerCapture(e.pointerId);reset();e.preventDefault();return true;}
        return false;
    };
    const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
        if(e.pointerType!=='touch')return false;
        if(pen.current!==null)return true;
        if(!fingers.current.has(e.pointerId))return false;
        fingers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const start=gesture.current;if(!start)return false;
        const points=Array.from(fingers.current.values()),rect=canvas.current?.getBoundingClientRect();if(!rect)return true;
        const center=(ps:Point[])=>({x:(ps[0].x+(ps[1]?.x??ps[0].x))/2-rect.left,y:(ps[0].y+(ps[1]?.y??ps[0].y))/2-rect.top});
        const a=center(start.points),b=center(points);
        if(Math.hypot(a.x-b.x,a.y-b.y)>6)traveled.current=true;
        const distance=(ps:Point[])=>ps.length<2?1:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y));
        const nextZoom=Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,start.zoom*(points.length>=2&&start.points.length>=2?distance(points)/distance(start.points):1)));
        setZoom(nextZoom);setPan({x:b.x-(a.x-start.pan.x)*nextZoom/start.zoom,y:b.y-(a.y-start.pan.y)*nextZoom/start.zoom});e.preventDefault();return true;
    };
    const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{
        if(e.pointerId===pen.current){pen.current=null;return false;}
        if(e.pointerType!=='touch')return false;
        if(gesture.current&&fingers.current.size===1&&!traveled.current&&!multiple.current&&pen.current===null)onTap({x:e.clientX,y:e.clientY});
        const handled=!!gesture.current||pen.current!==null;fingers.current.delete(e.pointerId);
        if(fingers.current.size&&gesture.current)reset();else gesture.current=null;
        return handled;
    };
    const clear=()=>{fingers.current.clear();gesture.current=null;pen.current=null;cancel();};
    return {down,move,up,clear};
}
