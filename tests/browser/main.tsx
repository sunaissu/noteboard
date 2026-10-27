import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Y from 'yjs';
import * as boardApi from '../../src/index';
import { Noteboard, createElement } from '../../src/index';
import { useYjsNoteboard } from '../../src/yjs';
import { DocumentEditor } from '../../../document-editor/src/DocumentEditor';
import type { DocumentImageUpload } from '../../../document-editor/src/imageUpload';
import { RichTextEditor } from '../../../document-editor/src/RichTextEditor';
import { useYjsDocument } from '../../../document-editor/src/yjs';
import { Calculator } from '../../../calculator/src/Calculator';
import '../../../document-editor/styles.css';
import '../../../calculator/styles.css';
(window as any).boardApi = boardApi;
const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'board';
const position = (params.get('position') || 'left') as any;
const theme = (params.get('theme') || 'light') as any;
const document = new Y.Doc();
const fixtures = [createElement('rectangle', { id: 'label', x: 250, y: 180, width: 200, height: 100, text: 'Hello team', backgroundColor: '#dbeafe' }), createElement('arrow', { id: 'arrow', x: 470, y: 230, width: 150, height: 0, points: [{x:0,y:0},{x:150,y:0}] }), createElement('star', {id:'star',x:650,y:180,width:100,height:100}), createElement('pen',{id:'pen',x:260,y:400,width:100,height:60,points:[{x:0,y:0,pressure:.1},{x:50,y:60,pressure:.8},{x:100,y:0,pressure:.3}]})];
const workspaceRoom=boardApi.createLocalBoardRoom();
const workspaceSession=workspaceRoom.connect({sessionId:'review',userId:'review',name:'Reviewer',color:'#7c3aed'},true);
const workspaceStorage=boardApi.createBrowserWorkspaceStorage('review');
const textDraftStorage=boardApi.createBrowserTextDrafts('review');
const savedRevisions:{id:string;name:string;createdAt:string;elements:boardApi.NoteboardElement[]}[]=[];
const workspaceVersions:boardApi.BoardVersionsAdapter={currentRevision:()=>JSON.stringify((window as any).board?.getElements()),list:async()=>savedRevisions,load:async id=>structuredClone(savedRevisions.find(r=>r.id===id)!.elements),save:async(name,elements)=>{savedRevisions.push({id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),elements:structuredClone(elements)});},restore:async(id,expected)=>{if(workspaceVersions.currentRevision()!==expected)throw new Error('Revision changed');return structuredClone(savedRevisions.find(r=>r.id===id)!.elements);}};
const workspaceContent:boardApi.BoardContentAdapter={resolveDocument:async reference=>(window as any).denyDocument?null:{...reference,title:'Allowed document',revision:'2',fallback:'An allowed excerpt'},openCalculation:async value=>({...value,result:'42'}),pickMedia:async()=>new Promise(resolve=>{(window as any).finishMedia=resolve;})};

function Board() {
 const binding = useYjsNoteboard(document, { initialElements: fixtures });
 const ref = useRef<any>(null);
 const [workspaceReadOnly,setWorkspaceReadOnly]=useState(false);
 useEffect(()=>{(window as any).workspaceFixture={room:workspaceRoom,session:workspaceSession,setReadOnly:setWorkspaceReadOnly};});
 useEffect(()=>{if(params.has('workspace'))workspaceRoom.syncElements(binding.elements);},[binding.elements]);
 useEffect(() => { Object.defineProperty(window, 'board', { configurable:true, get: () => ref.current }); (window as any).boardBinding = binding; (window as any).ydoc = document; });
 return <div style={{ height: 'calc(100vh - 72px)', position:'relative', margin:12, border:'1px solid #cbd5e1', borderRadius:12, overflow:'hidden' }}><Noteboard ref={ref} {...(params.has('workspace')?{workspaceStorage,textDraftStorage,contentAdapter:workspaceContent,versions:workspaceVersions,awareness:workspaceSession.awareness,comments:workspaceSession.comments,workshop:workspaceSession.workshop}: {})} {...(params.has('local')?{initialElements:fixtures}:binding)} maxImagePixels={params.has('maxPixels') ? Number(params.get('maxPixels')) : undefined} maxImageBytes={params.has('maxBytes') ? Number(params.get('maxBytes')) : undefined} theme={theme} readOnly={params.has('readonly')||workspaceReadOnly} toolbarPosition={(params.get('toolbar') || (position === 'bottom' ? 'top' : 'bottom')) as any} propertiesPosition={position} /></div>;
}
function Doc() {
 const ref = useRef<any>(null);
 const binding = useYjsDocument(document, { initialValue: '# Project notes\n\nA useful paragraph about plans.\n\n## Tasks\n\n- [ ] Review the release\n\n## Code\n\n```js\nconst answer = 42;\n```' });
 useEffect(() => { (window as any).documentBinding = binding; (window as any).documentEditor = ref.current; (window as any).ydoc = document; });
 return <div style={{ height:'calc(100vh - 72px)',margin:12,borderRadius:12,overflow:'hidden',border:'1px solid #cbd5e1' }}><DocumentEditor ref={ref} {...binding} readOnly={params.has('readonly')} theme={theme} /></div>;
}
function PlainDoc() {
 const [value,setValue]=useState('# Local note\n\nBefore.\n\nAfter.');
 return <div style={{height:'calc(100vh - 72px)',margin:12}}><DocumentEditor value={value} onChange={setValue} theme={theme} /></div>;
}
function RichTest() {
 const [value,setValue]=useState('Safe text');const ref=useRef<any>(null);
 useEffect(()=>{Object.defineProperty(window,'rich',{configurable:true,get:()=>ref.current});});
 return <RichTextEditor ref={ref} content={value} onChange={setValue}/>;
}
const delayedUpload: DocumentImageUpload = (_file, { signal }) => new Promise(resolve => {
 (window as any).uploadSignal = signal;
 // Deliberately ignore abort to exercise the editor's late-result guard.
 (window as any).finishUpload = () => resolve({ url: '/uploaded.png', alt: 'Uploaded picture', caption: 'Literal *caption*' });
});
function UploadDoc() {
 const [value, setValue] = useState('Before.\n\nAfter.');
 const [readOnly, setReadOnly] = useState(false), [mounted, setMounted] = useState(true);
 useEffect(() => { (window as any).uploadFixture = { value, setValue, setReadOnly, setMounted }; });
 return mounted ? <DocumentEditor value={value} onChange={setValue} onUploadImage={delayedUpload} readOnly={readOnly} defaultMode={params.has('source') ? 'markdown' : 'visual'} /> : <p>Unmounted</p>;
}
function App() { return <><header style={{fontFamily:'system-ui',padding:'8px 16px'}}>Package review · {mode} · {theme}</header>{mode === 'upload' ? <UploadDoc /> : mode === 'calculator' ? <div style={{maxWidth:480,margin:'12px auto'}}><Calculator theme={theme} showThemeSwitcher defaultMode="engineering" /></div> : mode === 'rich' ? <RichTest /> : mode === 'document' ? (params.has('local') ? <PlainDoc /> : <Doc />) : <Board />}</>; }
createRoot(window.document.getElementById('root')!).render(<App />);
