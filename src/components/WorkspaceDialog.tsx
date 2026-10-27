import React, { useEffect, useRef, useState } from 'react';
import { useNoteboardTheme } from '../ThemeContext';
import type { NoteboardElement } from '../elements/types';
import { objectLabel } from '../editingActions';

export function WorkspaceDialog({ title, children, onClose, navigation, actions }: {title:string;children:React.ReactNode;onClose:()=>void;navigation?:React.ReactNode;actions?:React.ReactNode}) {
    const theme = useNoteboardTheme(), root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        root.current?.querySelector<HTMLElement>('input,button,select,textarea,summary')?.focus();
        return () => { if (previous?.isConnected) previous.focus({preventScroll:true}); };
    }, []);
    return <div style={{position:'absolute',inset:0,zIndex:2100,background:'rgba(0,0,0,.25)',display:'flex',alignItems:'center',justifyContent:'center',padding:12,boxSizing:'border-box'}} onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
        <div ref={root} className="noteboard-workspace-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{
            e.stopPropagation();
            if(e.key==='Escape'){e.preventDefault();onClose();}
            if(e.key==='Tab') { const controls=Array.from(root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')).filter(el=>el.tabIndex>=0&&el.getClientRects().length>0);
                const first=controls[0],last=controls[controls.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();} }
        }} style={{'--nb-control-bg':theme.toolbarBg,'--nb-control-text':theme.panelTextColor,'--nb-control-border':theme.panelMutedColor,'--nb-active-bg':theme.buttonActiveBg,'--nb-active-text':theme.buttonActiveColor,'--nb-hover-bg':theme.buttonHoverBg,width:560,minWidth:0,maxWidth:'100%',maxHeight:'100%',display:'flex',flexDirection:'column',containerType:'inline-size',containerName:'noteboard-dialog',overflow:'hidden',overflowWrap:'anywhere',overscrollBehavior:'contain',background:theme.panelBg,color:theme.panelTextColor,border:theme.panelBorder,borderRadius:12,boxSizing:'border-box',font:'14px Arial, sans-serif',boxShadow:theme.toolbarShadow} as React.CSSProperties}>
            <style>{`
.noteboard-workspace-dialog * { box-sizing:border-box; }
.noteboard-workspace-dialog label { min-width:0;max-width:100%; }
.noteboard-workspace-dialog :is(button,input,textarea,select) { box-sizing:border-box;max-width:100%;min-width:0;font:inherit;color:var(--nb-control-text);background-color:var(--nb-control-bg);border:1px solid var(--nb-control-border);border-radius:5px; }
.noteboard-workspace-dialog :is(button,select,input:not([type=checkbox])) { min-height:44px; }
.noteboard-workspace-dialog button { white-space:normal;overflow-wrap:anywhere; }
.noteboard-workspace-dialog button:not(:disabled):hover { background-color:var(--nb-hover-bg); }
.noteboard-workspace-dialog :is([aria-selected=true],[aria-pressed=true]) { background-color:var(--nb-active-bg);color:var(--nb-active-text); }
.noteboard-workspace-dialog :disabled { opacity:.55; }
.noteboard-workspace-dialog fieldset { min-inline-size:0; }
.noteboard-workspace-dialog summary { min-height:44px;align-content:center;cursor:pointer; }
.noteboard-workspace-dialog textarea { resize:vertical; }
.noteboard-workspace-dialog [data-workspace-scroll]:focus-visible { outline:2px solid var(--nb-active-text);outline-offset:-2px; }
.noteboard-workspace-dialog .noteboard-workspace-select { display:none; }
@container noteboard-dialog (max-width:420px) { .noteboard-workspace-dialog .noteboard-workspace-tabs { display:none !important; } .noteboard-workspace-dialog .noteboard-workspace-select { display:block;width:100%; } }
            `}</style>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'10px 16px',flexShrink:0,borderBottom:theme.panelBorder}}><strong>{title}</strong><button type="button" onClick={onClose} style={{minWidth:44,minHeight:44}}>Close</button></div>
            {navigation&&<div style={{padding:'6px 16px',flexShrink:0,borderBottom:theme.panelBorder}}>{navigation}</div>}
            <div data-workspace-scroll role="region" aria-label={title+' content'} tabIndex={0} style={{padding:16,minHeight:0,overflowY:'auto',overscrollBehavior:'contain'}}>{children}</div>
            {actions&&<div style={{padding:'8px 16px',flexShrink:0,borderTop:theme.panelBorder,display:'flex',gap:8,flexWrap:'wrap'}}>{actions}</div>}
        </div>
    </div>;
}

export interface BoardCommand { id:string; label:string; hint?:string; disabled?:boolean; run:()=>void; }
export function CommandPalette({commands,onClose}:{commands:BoardCommand[];onClose:()=>void}) {
    const [query,setQuery]=useState('');
    const filtered=commands.filter(c=>c.label.toLowerCase().includes(query.toLowerCase()));
    return <WorkspaceDialog title="Board commands" onClose={onClose} navigation={
        <input aria-label="Search commands" placeholder="Search tools and actions…" value={query} onChange={e=>setQuery(e.target.value)} style={{boxSizing:'border-box',width:'100%',padding:12,marginBottom:12}}
            onKeyDown={e=>{if(e.key==='Enter'){const command=filtered.find(c=>!c.disabled);if(command){e.preventDefault();onClose();command.run();}}}}/>}>
        <div style={{display:'grid',gap:6}}>{filtered.map(command=><button type="button" key={command.id} disabled={command.disabled} onClick={()=>{onClose();command.run();}}
            style={{minHeight:44,textAlign:'left',padding:10,display:'flex',justifyContent:'space-between',gap:8}}><span>{command.label}</span><small>{command.hint}</small></button>)}</div>
        {!filtered.length&&<p>No matching commands.</p>}
    </WorkspaceDialog>;
}

export function LayersPanel({elements,selected,readOnly,onSelect,onChange,onFrame,onClose}: {
    elements:NoteboardElement[];selected:Set<string>;readOnly:boolean;onSelect:(id:string)=>void;
    onChange:(change:(elements:NoteboardElement[])=>NoteboardElement[])=>void;onFrame:()=>void;onClose:()=>void;
}) {
    const [query,setQuery]=useState(''),dragged=useRef<string|null>(null);
    const active=elements.filter(el=>!el.isDeleted).slice().reverse();
    const update=(id:string,patch:Partial<NoteboardElement>)=>onChange(els=>els.map(el=>el.id===id?{...el,...patch} as NoteboardElement:el));
    const reorder=(id:string,target:string)=>onChange(els=>{const from=els.findIndex(el=>el.id===id),to=els.findIndex(el=>el.id===target);if(from<0||to<0||els[from].locked)return els;const copy=els.slice();const [moving]=copy.splice(from,1);copy.splice(to,0,moving);return copy;});
    return <WorkspaceDialog title="Layers and frames" onClose={onClose} navigation={<input aria-label="Search layers" placeholder="Search objects…" value={query} onChange={e=>setQuery(e.target.value)} style={{boxSizing:'border-box',width:'100%',padding:12}}/>}>
        <p>Frontmost first. Use the arrow buttons or drag a row to reorder.</p>
        <button type="button" disabled={readOnly||!elements.some(el=>selected.has(el.id)&&!el.locked&&!el.hidden&&!el.isDeleted&&el.type!=='frame')} onClick={onFrame} style={{minHeight:44}}>Frame selection</button>
        <div role="list" aria-label="Board layers" style={{display:'grid',gridTemplateColumns:'minmax(0, 1fr)',gap:8,marginTop:12}}>{active.filter(el=>objectLabel(el).toLowerCase().includes(query.toLowerCase())).map((el)=><div role="listitem" key={el.id}
            draggable={!readOnly&&!el.locked} onDragStart={()=>{dragged.current=el.id;}} onDragEnd={()=>{dragged.current=null;}} onDragOver={e=>{if(!readOnly)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!readOnly&&dragged.current)reorder(dragged.current,el.id);dragged.current=null;}}
            style={{border:'1px solid #8886',borderRadius:8,padding:8,background:selected.has(el.id)?'#7c5cff18':undefined}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}><button type="button" onClick={()=>onSelect(el.id)} aria-pressed={selected.has(el.id)} style={{minHeight:44}}>{el.type}{el.hidden?' · hidden':''}</button>
                <input aria-label={`Name ${el.id}`} key={el.displayName} defaultValue={el.displayName||('name'in el?el.name:'')} placeholder={objectLabel(el)} disabled={readOnly||el.locked} maxLength={256}
                    onBlur={e=>{if(!readOnly&&!el.locked&&e.target.value!==(el.displayName||('name'in el?el.name:'')))update(el.id,{displayName:e.target.value,...(el.type==='frame'?{name:e.target.value||'Frame'}:{})});}} style={{minWidth:0,flex:1,minHeight:36}}/>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button type="button" disabled={readOnly||el.locked} onClick={()=>{const ids=new Set([el.id,...(el.type==='frame'?el.childIds??[]:[])]);onChange(els=>els.map(item=>ids.has(item.id)&&!item.locked?{...item,hidden:!el.hidden}:item));}} style={{minHeight:44}}>{el.hidden?'Show':'Hide'}</button>
                <button type="button" disabled={readOnly} onClick={()=>update(el.id,{locked:!el.locked})} style={{minHeight:44}}>{el.locked?'Unlock':'Lock'}</button>
                <button type="button" aria-label={`Move ${objectLabel(el)} forward`} disabled={readOnly||el.locked||active.indexOf(el)===0} onClick={()=>reorder(el.id,active[active.indexOf(el)-1].id)} style={{minWidth:44,minHeight:44}}>↑</button>
                <button type="button" aria-label={`Move ${objectLabel(el)} backward`} disabled={readOnly||el.locked||active.indexOf(el)===active.length-1} onClick={()=>reorder(el.id,active[active.indexOf(el)+1].id)} style={{minWidth:44,minHeight:44}}>↓</button>
            </div>
        </div>)}</div>
        {!active.length&&<p>No objects yet. Choose a drawing tool or insert a template.</p>}
    </WorkspaceDialog>;
}
