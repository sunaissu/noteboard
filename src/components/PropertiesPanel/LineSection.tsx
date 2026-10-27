import React from 'react';
import { ArrowLineRightIcon, ArrowBendUpRightIcon, TagIcon } from '@phosphor-icons/react';
import { useNoteboardTheme } from '../../ThemeContext';
import type { NoteboardElement, LineElement, ArrowElement } from '../../elements/types';
import { Divider, CollapsibleSection, ChoiceRow } from './primitives';

interface Props {
    selectedElements: NoteboardElement[];
    onUpdate: (updates: Partial<NoteboardElement>) => void;
}

export function LineSection({ selectedElements, onUpdate }: Props) {
    const theme = useNoteboardTheme();
    const hasArrows = selectedElements.some((el) => el.type === 'arrow');
    const hasLines = selectedElements.some((el) => el.type === 'line');
    const first = selectedElements[0];

    const lineArrowEl = selectedElements.find(
        (el) => el.type === 'line' || el.type === 'arrow',
    ) as (LineElement | ArrowElement) | undefined;

    const routing = (lineArrowEl as LineElement | undefined)?.routing ?? 'straight';
    const endArrowhead = hasArrows && first?.type === 'arrow'
        ? ((first as ArrowElement).endArrowhead ?? 'arrow')
        : (hasLines && first?.type === 'line' ? (first as LineElement).endArrowhead ?? null : 'arrow');
    const startArrowhead = hasArrows && first?.type === 'arrow'
        ? ((first as ArrowElement).startArrowhead ?? null)
        : (hasLines && first?.type === 'line' ? (first as LineElement).startArrowhead ?? null : null);
    const lineLabel = lineArrowEl?.label ?? '';
    const lineLabelFontSize = lineArrowEl?.labelFontSize ?? 12;
    const editEndpoint=(end:boolean,axis:'x'|'y',value:number)=>{
        if(!lineArrowEl||!Number.isFinite(value)||Math.abs(value)>1e9||lineArrowEl.points.length<2)return;
        const world=lineArrowEl.points.map(p=>({x:p.x+lineArrowEl.x,y:p.y+lineArrowEl.y}));
        world[end?world.length-1:0][axis]=value;
        const a=world[0],b=world[world.length-1];
        onUpdate({...(routing==='orthogonal'?{manualRoute:false}:{}),x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y,points:world.map(p=>({x:p.x-a.x,y:p.y-a.y})),...(end?{endBinding:null}:{startBinding:null})} as Partial<NoteboardElement>);
    };

    const selectStyle: React.CSSProperties = {
        width: '100%', fontSize: 12, borderRadius: 6, padding: '4px 6px',
        border: theme.panelBorder, background: theme.panelBg, color: theme.panelTextColor,
        cursor: 'pointer', outline: 'none',
    };

    return (
        <>
            <Divider theme={theme} />
            <CollapsibleSection label="Line / Arrow" theme={theme}>

            <ChoiceRow
                label="Routing"
                icon={<ArrowBendUpRightIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />}
                options={[
                    { value: 'straight', label: 'Straight' },
                    { value: 'curve', label: 'Curve' },
                    { value: 'orthogonal', label: 'Elbow' },
                ]}
                value={routing as string}
                onChange={(v) => onUpdate({ manualRoute: false, routing: v, curveType: v === 'curve' ? 'curve' : 'straight' } as any)}
                theme={theme}
            />

            {routing === 'orthogonal' && <button type="button" onClick={()=>onUpdate({manualRoute:false})} style={{minHeight:44,marginBottom:12}}>Reset automatic route</button>}
            {selectedElements.length===1&&lineArrowEl&&lineArrowEl.id!=='tool-defaults'&&!lineArrowEl.angle&&lineArrowEl.points.length>=2&&<div style={{marginBottom:12}}>
                <p style={{fontSize:12}}>Endpoint coordinates. Editing detaches that endpoint and resets elbow routing.</p>
                {[false,true].map(end=>{const p=lineArrowEl.points[end?lineArrowEl.points.length-1:0];return <div key={String(end)} style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:6}}>{(['x','y'] as const).map(axis=><label key={axis} style={{fontSize:12}}>{end?'End':'Start'} {axis}<input aria-label={`${end?'End':'Start'} ${axis}`} type="number" value={lineArrowEl[axis]+p[axis]} onChange={e=>{if(e.target.value!=='')editEndpoint(end,axis,Number(e.target.value));}} style={{width:72,minHeight:32,display:'block'}}/></label>)}</div>;})}
            </div>}            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <ArrowLineRightIcon size={14} weight="bold" style={{ color: theme.panelMutedColor, transform: 'scaleX(-1)' }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Start</span>
                </div>
                <select aria-label="Start arrowhead" value={String(startArrowhead ?? '')}
                    onChange={(e) => onUpdate({ startArrowhead: (e.target.value || null) as any })}
                    style={selectStyle}>
                    <option value="">None</option>
                    <option value="arrow">Arrow</option>
                    <option value="triangle">Triangle</option>
                    <option value="dot">Dot</option>
                    <option value="bar">Bar</option>
                </select>
            </div>            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <ArrowLineRightIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>End</span>
                </div>
                <select aria-label="End arrowhead" value={String(endArrowhead ?? '')}
                    onChange={(e) => onUpdate({ endArrowhead: (e.target.value || null) as any })}
                    style={selectStyle}>
                    <option value="">None</option>
                    <option value="arrow">Arrow</option>
                    <option value="triangle">Triangle</option>
                    <option value="dot">Dot</option>
                    <option value="bar">Bar</option>
                </select>
            </div>            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <TagIcon size={14} weight="bold" style={{ color: theme.panelMutedColor }} />
                    <span style={{ fontSize: 12, color: theme.panelTextColor, fontWeight: 500 }}>Label</span>
                </div>
                <input
                    aria-label="Connector label" type="text" value={lineLabel} placeholder="Midpoint label…"
                    onChange={(e) => onUpdate({ label: e.target.value } as any)}
                    style={{
                        width: '100%', fontSize: 12, borderRadius: 6, padding: '4px 8px',
                        border: theme.panelBorder, background: 'transparent', color: theme.panelTextColor,
                        outline: 'none', boxSizing: 'border-box',
                    }}
                />
                {lineLabel && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: theme.panelMutedColor }}>Label size</span>
                        <input aria-label="Connector label size" type="number" min={8} max={32} value={lineLabelFontSize}
                            onChange={(e) => onUpdate({ labelFontSize: Number(e.target.value) } as any)}
                            style={{ width: 44, fontSize: 11, borderRadius: 4, border: theme.panelBorder, background: 'transparent', color: theme.panelTextColor, textAlign: 'center', outline: 'none', padding: '2px' }} />
                        <span style={{ fontSize: 11, color: theme.panelMutedColor }}>px</span>
                    </div>
                )}
            </div>
            </CollapsibleSection>
        </>
    );
}
