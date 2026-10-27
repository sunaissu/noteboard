import {useEffect,useRef,useState} from 'react';
import type {NoteboardElement} from '../elements/types';
import {exportBoardImage} from '../exportImage';
import {exportBoardSvg,exportBoardPdf,exportSelection} from '../exportDocument';
import {WorkspaceDialog} from './WorkspaceDialog';
import {useNoteboardTheme} from '../ThemeContext';

export function ExportDialog({elements,selected,onClose}:{elements:NoteboardElement[];selected:Set<string>;onClose:()=>void}) {
    const theme=useNoteboardTheme();
    const [scope,setScope]=useState(selected.size?'selection':'all'),[format,setFormat]=useState('png');
    const [paper,setPaper]=useState('content'),[paginate,setPaginate]=useState(false),[scale,setScale]=useState(1),[pdfMode,setPdfMode]=useState<'vector'|'raster'>('vector'),[paperWidth,setPaperWidth]=useState(612),[paperHeight,setPaperHeight]=useState(792);
    const [background,setBackground]=useState('#ffffff'),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
    const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
    const ids=scope==='all'?undefined:scope==='selection'?[...selected]:[scope];
    const signature=JSON.stringify(ids);
    useEffect(()=>{let alive=true;setPreview('');setError('');exportBoardImage(elements,'png',{background,selectedIds:exportSelection(elements,ids)}).then(url=>{if(alive)setPreview(url);},err=>{if(alive)setError(String(err.message||err));});return()=>{alive=false;};},[elements,signature,background]);
    const download=async()=>{
        setBusy(true);setError('');
        try {
            const options={background,selectedIds:exportSelection(elements,ids)};
            let url:string,objectUrl=false;
            if(format==='svg'){url=URL.createObjectURL(new Blob([await exportBoardSvg(elements,options)],{type:'image/svg+xml'}));objectUrl=true;}
            else if(format==='pdf'){url=URL.createObjectURL(await exportBoardPdf(elements,{...options,paper:paper==='custom'?{width:paperWidth,height:paperHeight}:paper as 'content'|'a4'|'letter',paginate,scale,mode:pdfMode}));objectUrl=true;}
            else url=await exportBoardImage(elements,format as 'png'|'jpeg',{...options,scale:2});
            if(!mounted.current){if(objectUrl)URL.revokeObjectURL(url);return;}
            const link=document.createElement('a');link.href=url;link.download=`noteboard.${format==='jpeg'?'jpg':format}`;link.click();
            if(objectUrl)setTimeout(()=>URL.revokeObjectURL(url),60_000);
        }catch(err){if(mounted.current)setError(err instanceof Error?err.message:String(err));}
        finally{if(mounted.current)setBusy(false);}
    };
    return <WorkspaceDialog title="Export board" onClose={onClose} actions={<button type="button" disabled={busy||!preview} onClick={download} style={{minHeight:44,marginTop:12}}>{busy?'Preparing…':'Download '+format.toUpperCase()}</button>}>
        <style>{`
.noteboard-workspace-dialog[aria-label="Export board"] label { display:flex;flex-wrap:wrap;align-items:center;gap:6px; }
.noteboard-workspace-dialog[aria-label="Export board"] fieldset { display:grid;gap:12px;margin-top:12px; }
        `}</style>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
            <label>Content <select aria-label="Export content" value={scope} onChange={e=>setScope(e.target.value)} style={{minHeight:44,maxWidth:220}}><option value="all">Whole board</option><option value="selection" disabled={!selected.size}>Selection</option>{elements.filter(el=>el.type==='frame'&&!el.isDeleted&&!el.hidden).map(el=><option key={el.id} value={el.id}>{el.displayName||('name'in el?el.name:'Frame')}</option>)}</select></label>
            <label>Format <select aria-label="Export format" value={format} onChange={e=>setFormat(e.target.value)} style={{minHeight:44}}>{['png','jpeg','svg','pdf'].map(value=><option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
            <label>Background <select aria-label="Export background" value={background} onChange={e=>setBackground(e.target.value)} style={{minHeight:44}}><option value="#ffffff">White</option><option value="transparent" disabled={format==='pdf'||format==='jpeg'}>Transparent</option></select></label>
        </div>
        {format==='pdf'&&<fieldset><legend>PDF pages</legend><label>Paper <select aria-label="PDF paper" value={paper} onChange={e=>setPaper(e.target.value)}><option value="content">Fit content</option><option value="a4">A4</option><option value="letter">Letter</option><option value="custom">Custom points</option></select></label>{paper==='custom'&&<><label>Width <input aria-label="Paper width" type="number" value={paperWidth} onChange={e=>setPaperWidth(Number(e.target.value))}/></label><label>Height <input aria-label="Paper height" type="number" value={paperHeight} onChange={e=>setPaperHeight(Number(e.target.value))}/></label></>}<label>Scale <input aria-label="PDF scale" type="number" min="0.1" max="10" step="0.1" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label><label><input type="checkbox" checked={paginate} onChange={e=>setPaginate(e.target.checked)}/>Tile across pages</label><label>Rendering <select aria-label="PDF rendering" value={pdfMode} onChange={e=>setPdfMode(e.target.value as typeof pdfMode)}><option value="vector">Vector shapes and text</option><option value="raster">Image (all fonts and effects)</option></select></label></fieldset>}
        <p>{format==='pdf'?'Vector mode keeps text selectable. Use image mode for exact font and shadow appearance; custom fonts can also be embedded by the host.':format==='svg'?'Vector shapes and text; inserted images stay embedded.':'Image size is limited to 16 megapixels for reliable downloads.'}</p>
        {preview&&<img src={preview} alt="Export preview" style={{display:'block',width:'100%',height:240,objectFit:'contain',border:theme.panelBorder,background:theme.buttonHoverBg}}/>}
        {error&&<p role="alert">{error}</p>}
    </WorkspaceDialog>;
}
