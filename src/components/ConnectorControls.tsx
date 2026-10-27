import React,{useRef,useState} from 'react';
import type {NoteboardElement,Point} from '../elements/types';
import {useNoteboardTheme} from '../ThemeContext';

export function ConnectorControls({element,pan,zoom,onChange,size,viewportInsets={}}:{element:NoteboardElement;pan:Point;zoom:number;onChange:(points:Point[])=>void;size?:{width:number;height:number};viewportInsets?:Partial<Record<'top'|'right'|'bottom'|'left',number>>}) {
    const theme=useNoteboardTheme(),drag=useRef<{index:number;start:Point;points:Point[]}|null>(null),[preview,setPreview]=useState<Point[]|null>(null);
    if((element.type!=='line'&&element.type!=='arrow')||element.angle||element.locked||element.hidden)return null;
    const pts=preview??element.points;
    const point=(p:Point)=>({x:(element.x+p.x)*zoom+pan.x,y:(element.y+p.y)*zoom+pan.y});
    const safeLeft=viewportInsets.left??12,safeTop=viewportInsets.top??12;
    const safeRight=size?size.width-(viewportInsets.right??12):Infinity,safeBottom=size?size.height-(viewportInsets.bottom??12):Infinity;
    const bendPoint=(points:Point[],index:number)=>element.routing==='orthogonal'?{x:(points[index].x+points[index+1].x)/2,y:(points[index].y+points[index+1].y)/2}:points[index];
    const indexes=Array.from({length:Math.max(0,Math.min(element.points.length-2,63))},(_,index)=>index+1).filter(index=>element.routing!=='orthogonal'||index<element.points.length-2);
    const committedPositions=indexes.length?indexes.map(index=>point(bendPoint(element.points,index))):element.points.length>=2?[point({x:(element.points[0].x+element.points[element.points.length-1].x)/2,y:(element.points[0].y+element.points[element.points.length-1].y)/2})]:[];
    // Keep the parent stable throughout a drag so pointer capture is not lost.
    const dock=!!size&&committedPositions.some(pos=>pos.x-22<safeLeft||pos.x+22>safeRight||pos.y-22<safeTop||pos.y+22>safeBottom);
    const controlStyle=(pos:Point):React.CSSProperties=>({position:dock?'relative':'absolute',left:dock?undefined:size?Math.max(safeLeft,Math.min(pos.x-22,safeRight-44)):pos.x-22,top:dock?undefined:size?Math.max(safeTop,Math.min(pos.y-22,safeBottom-44)):pos.y-22,width:44,height:44,flexShrink:0});
    const buttons:React.ReactNode[]=[];
    const shifted=(points:Point[],index:number,dx:number,dy:number)=>{
        const copy=points.map(p=>({...p}));
        if(element.routing==='orthogonal'){const vertical=points[index].x===points[index+1].x;if(vertical){copy[index].x+=dx;copy[index+1].x+=dx;}else{copy[index].y+=dy;copy[index+1].y+=dy;}}
        else{copy[index].x+=dx;copy[index].y+=dy;}return copy;
    };
    for(let i=1;i<Math.min(pts.length-1,64);i++){
        if(element.routing==='orthogonal'&&i>=pts.length-2)continue;
        const pos=point(bendPoint(pts,i));
        buttons.push(<button type="button" key={i} aria-label={`Connector bend ${i}`} title={`Drag bend ${i} or focus and use arrow keys`} style={{...controlStyle(pos),border:0,background:dock?theme.panelBg:'transparent',color:theme.buttonActiveColor,cursor:'move',touchAction:'none',zIndex:920}}
            onKeyDown={e=>{if(e.key.startsWith('Arrow')){e.preventDefault();e.stopPropagation();const step=(e.shiftKey?1:10)/zoom;onChange(shifted(element.points,i,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));}}}
            onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={index:i,start:{x:e.clientX,y:e.clientY},points:element.points};}}
            onPointerMove={e=>{const d=drag.current;if(d)setPreview(shifted(d.points,d.index,(e.clientX-d.start.x)/zoom,(e.clientY-d.start.y)/zoom));}}
            onPointerUp={e=>{const d=drag.current;if(d)onChange(shifted(d.points,d.index,(e.clientX-d.start.x)/zoom,(e.clientY-d.start.y)/zoom));drag.current=null;setPreview(null);}}
            onPointerCancel={()=>{drag.current=null;setPreview(null);}}><span aria-hidden="true" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:16,height:18,border:'2px solid currentColor',borderRadius:3,background:theme.panelBg,fontSize:11}}>{i}</span></button>);
    }
    if(!buttons.length&&pts.length>=2){const a=pts[0],b=pts[pts.length-1],pos=point({x:(a.x+b.x)/2,y:(a.y+b.y)/2});buttons.push(<button key="add" type="button" aria-label="Add connector bend" title="Add an editable bend" style={{...controlStyle(pos),borderRadius:22,zIndex:920}} onClick={()=>{
        if(element.routing==='orthogonal'){const dx=b.x-a.x,dy=b.y-a.y;onChange([a,{x:a.x+dx/3,y:a.y},{x:a.x+dx/3,y:a.y+dy/2-40},{x:a.x+dx*2/3,y:a.y+dy/2-40},{x:a.x+dx*2/3,y:b.y},b]);}
        else onChange([a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2-40},b]);
    }}>+</button>);}
    return <>{preview&&<svg aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:919}}><polyline points={preview.map(p=>{const v=point(p);return `${v.x},${v.y}`;}).join(' ')} fill="none" stroke={theme.buttonActiveColor} strokeWidth={2} strokeDasharray="4 4"/></svg>}{dock?<div role="group" aria-label="Connector bend controls" data-scroll-axis="horizontal" style={{position:'absolute',left:safeLeft,top:safeTop,maxWidth:Math.max(44,safeRight-safeLeft),display:'flex',gap:4,overflowX:'auto',overscrollBehavior:'contain',zIndex:920}}>{buttons}</div>:buttons}</>;
}
