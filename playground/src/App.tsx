import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Noteboard, NoteboardPreview, createBoardTemplate, deserializeBoard, duplicateElements, getNoteboardScrollbarProps,
  MAX_BOARD_ELEMENTS, MAX_BOARD_IMPORT_BYTES, getElementBounds,
  type BoardTemplate, type NoteboardElement, type NoteboardRef,
  type NoteboardThemeMode, type NoteboardViewport, type ToolbarPosition, type Tool, type NoteboardScrollbarOptions,
} from '@sunaissu/noteboard';

import { workspaceStorage,textDraftStorage,room,localSession,playgroundVersions,contentAdapter } from './workspaceAdapters';

const positions: ToolbarPosition[] = ['top', 'bottom', 'left', 'right'];
const colorSchemes = {
  default: { label: 'Default', primary: '#7c5cff', secondary: '#22a06b' },
  ocean: { label: 'Ocean', primary: '#2563eb', secondary: '#06b6d4' },
  forest: { label: 'Forest', primary: '#15803d', secondary: '#ca8a04' },
  plum: { label: 'Plum', primary: '#9333ea', secondary: '#db2777' },
};
function download(url: string, name: string) {
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
}
function PositionControl({ label, value, onChange }: { label: string; value: ToolbarPosition; onChange: (value: ToolbarPosition) => void }) {
  return <fieldset className="control-group"><legend>{label}</legend><div className="mode-grid">
    {positions.map(position => <button type="button" key={position} aria-pressed={value === position} className={value === position ? 'is-active' : ''} onClick={() => onChange(position)}>{position}</button>)}
  </div></fieldset>;
}

export default function App() {
  const board = useRef<NoteboardRef>(null), importInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const versions=useMemo(()=>playgroundVersions(()=>board.current?.getElements()??[]),[]);
  const [elements, setElements] = useState<NoteboardElement[]>(() => createBoardTemplate('flowchart'));
  const [viewport, setViewport] = useState<NoteboardViewport>({ panX: 0, panY: 0, zoom: 1 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [position, setPosition] = useState<ToolbarPosition>('bottom');
  const [propertiesPosition, setPropertiesPosition] = useState<ToolbarPosition>('left');
  const [readOnly, setReadOnly] = useState(false);
  const [theme, setTheme] = useState<NoteboardThemeMode>('system');
  const [primary, setPrimary] = useState('#7c5cff'), [secondary, setSecondary] = useState('#22a06b');
  const [colorScheme, setColorScheme] = useState<keyof typeof colorSchemes | 'custom'>('default');
  const [scrollbarPreset, setScrollbarPreset] = useState<'native' | 'custom' | 'hidden'>('native');
  const [thumbColor, setThumbColor] = useState('#7c5cff'), [trackColor, setTrackColor] = useState('#edf2f7');
  const [transparentTrack, setTransparentTrack] = useState(true), [thinScrollbar, setThinScrollbar] = useState(false);
  const scrollbar: NoteboardScrollbarOptions | undefined = scrollbarPreset === 'hidden'
    ? { width: 'none' }
    : scrollbarPreset === 'custom'
      ? { thumbColor, trackColor: transparentTrack ? 'transparent' : trackColor, width: thinScrollbar ? 'thin' : 'auto' }
      : undefined;
  const [template, setTemplate] = useState<BoardTemplate>('flowchart');
  const [status, setStatus] = useState(''), [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; elements: NoteboardElement[]; viewport: NoteboardViewport } | null>(null);
  const importGeneration = useRef(0), permission = useRef(readOnly);
  permission.current = readOnly;
  const live = useMemo(() => elements.filter(element => !element.isDeleted), [elements]);
  useEffect(()=>room.syncElements(elements),[elements]);
  const [inspectSource, setInspectSource] = useState(false);
  const source = useMemo(() => inspectSource ? JSON.stringify(elements, null, 2) : '', [elements, inspectSource]);
  useEffect(() => {
    const frame = fit(elements);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { importGeneration.current++; setPendingImport(null); }, [readOnly]);
  useEffect(() => () => { importGeneration.current++; }, []);

  function fit(items = board.current?.getElements() || []) {
    return requestAnimationFrame(() => {
      const container = stage.current;
      const visible = items.filter(item => !item.isDeleted);
      if (!container || !visible.length) return;
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const item of visible) {
        const bounds = getElementBounds(item);
        left = Math.min(left, bounds[0]); top = Math.min(top, bounds[1]);
        right = Math.max(right, bounds[2]); bottom = Math.max(bottom, bounds[3]);
      }
      const zoom = Math.max(.1, Math.min(1.25, (container.clientWidth - 64) / Math.max(1, right - left), (container.clientHeight - 120) / Math.max(1, bottom - top)));
      board.current?.setViewport({ zoom, panX: container.clientWidth / 2 - (left + right) / 2 * zoom, panY: container.clientHeight / 2 - (top + bottom) / 2 * zoom });
    });
  }
  const exportPNG = async () => {
    if (!board.current || exporting) return;
    setExporting(true); setStatus('Preparing image…');
    try { download(await board.current.exportImageAsync('png'), 'noteboard.png'); setStatus('PNG exported'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Export failed'); }
    finally { setExporting(false); }
  };
  const exportJSON = () => {
    if (!board.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(board.current.getSession(), null, 2)], { type: 'application/json' }));
    download(url, 'noteboard.json'); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Board snapshot exported');
  };
  const readImport = async (file: File) => {
    const generation = ++importGeneration.current; setPendingImport(null);
    try {
      if (file.size > MAX_BOARD_IMPORT_BYTES) throw new Error('Board files must be at most 16 MiB');
      const parsed = deserializeBoard(JSON.parse(await file.text()));
      if (generation !== importGeneration.current || permission.current) return;
      setPendingImport({ ...parsed, name: file.name }); setStatus('Review the board before importing.');
    } catch (error) { if (generation === importGeneration.current) setStatus(error instanceof Error ? error.message : 'Could not read this board'); }
  };
  const applyImport = (merge: boolean) => {
    if (!pendingImport || permission.current || !board.current) return;
    const previous = board.current.getElements();
    const imported = merge ? duplicateElements(pendingImport.elements.filter(element => !element.isDeleted), 40) : pendingImport.elements;
    const next = merge ? [...previous, ...imported] : imported;
    if (next.length > MAX_BOARD_ELEMENTS) { setStatus('This import would exceed the 10,000-object limit.'); return; }
    board.current.setElements(next);
    if (merge) fit(imported); else board.current.setViewport(pendingImport.viewport);
    setPendingImport(null); setStatus(merge ? 'Board merged. Undo restores the previous board.' : 'Board replaced. Undo restores the previous objects.');
  };
  const insertTemplate = () => {
    if (!board.current || readOnly) return;
    const previous = board.current.getElements();
    const right = previous.filter(element => !element.isDeleted).reduce((edge, element) => Math.max(edge, element.x + Math.abs(element.width)), -80);
    const added = createBoardTemplate(template, { x: right + 80, y: 0 });
    if (previous.length + added.length > MAX_BOARD_ELEMENTS) { setStatus('The board has reached its object limit.'); return; }
    board.current.setElements([...previous, ...added]); fit(added); setStatus('Template inserted. Every object is editable.');
  };

  return <div {...getNoteboardScrollbarProps(scrollbar)} className="noteboard-playground-scroll sunaissu-noteboard-scrollbar" role="region" aria-label="Noteboard playground" tabIndex={0}><main className="playground-shell">
    <header className="playground-header"><div>
      <span className="eyebrow">@sunaissu/noteboard</span>
      <h1>Room for your next idea.</h1>
      <p>Sketch a flow, map out a plan, or make space for a new thought. Start with a template and make it yours.</p>
    </div><div className="package-badge"><span />Local package playground</div></header>
    <section className="playground-grid">
      <div className="board-stage" ref={stage}><Noteboard ref={board} workspaceStorage={workspaceStorage} textDraftStorage={textDraftStorage} contentAdapter={contentAdapter} versions={versions} awareness={localSession.awareness} comments={localSession.comments} workshop={localSession.workshop} elements={elements} onElementsChange={setElements}
        viewport={viewport} onViewportChange={setViewport} activeTool={activeTool} onToolSelect={setActiveTool}
        toolbarPosition={position} propertiesPosition={propertiesPosition} readOnly={readOnly}
        theme={theme} onThemeChange={setTheme} brandColors={{ primary, secondary }} scrollbar={scrollbar} boardId="playground" threadId="local" /></div>
      <aside {...getNoteboardScrollbarProps(scrollbar)} className="inspector sunaissu-noteboard-scrollbar" aria-label="Playground controls" tabIndex={0}>
        <div className="inspector-heading"><span>Playground controls</span><small>{readOnly ? 'Read-only' : 'Editable'}</small></div>
        <fieldset className="control-group"><legend>Color theme</legend><div className="mode-grid three-columns">
          {(['system', 'light', 'dark'] as const).map(candidate => <button type="button" key={candidate} aria-pressed={theme === candidate} className={theme === candidate ? 'is-active' : ''} onClick={() => setTheme(candidate)}>{candidate}</button>)}
        </div>
          <label htmlFor="board-color-scheme">Color scheme</label>
          <select id="board-color-scheme" value={colorScheme} onChange={event => {
            const next = event.target.value as typeof colorScheme; setColorScheme(next);
            if (next !== 'custom') { setPrimary(colorSchemes[next].primary); setSecondary(colorSchemes[next].secondary); }
          }}>{Object.entries(colorSchemes).map(([value, scheme]) => <option key={value} value={value}>{scheme.label}</option>)}<option value="custom">Custom</option></select>
          <div className="brand-color-grid"><label>Primary<input type="color" value={primary} onChange={event => { setPrimary(event.target.value); setColorScheme('custom'); }} /></label><label>Secondary<input type="color" value={secondary} onChange={event => { setSecondary(event.target.value); setColorScheme('custom'); }} /></label></div>
        </fieldset>
        <fieldset className="control-group"><legend>Scrollbar</legend>
          <label htmlFor="board-scrollbar-appearance">Appearance</label>
          <select id="board-scrollbar-appearance" value={scrollbarPreset} onChange={event => setScrollbarPreset(event.target.value as typeof scrollbarPreset)}><option value="native">Native</option><option value="custom">Custom colors</option><option value="hidden">Hidden</option></select>
          {scrollbarPreset === 'custom' && <>
            <div className="brand-color-grid"><label>Thumb color<input type="color" value={thumbColor} onChange={event => setThumbColor(event.target.value)} /></label><label>Track color<input type="color" value={trackColor} disabled={transparentTrack} onChange={event => setTrackColor(event.target.value)} /></label></div>
            <label className="checkbox-control"><input type="checkbox" checked={transparentTrack} onChange={event => setTransparentTrack(event.target.checked)} />Transparent track</label>
            <label className="checkbox-control"><input type="checkbox" checked={thinScrollbar} onChange={event => setThinScrollbar(event.target.checked)} />Thin scrollbar</label>
          </>}
        </fieldset>
        <PositionControl label="Toolbar position" value={position} onChange={setPosition} />
        <PositionControl label="Properties position" value={propertiesPosition} onChange={setPropertiesPosition} />
        <fieldset className="control-group"><legend>Start with a template</legend>
          <select aria-label="Board template" value={template} disabled={readOnly} onChange={event => setTemplate(event.target.value as BoardTemplate)}><option value="flowchart">Flowchart</option><option value="planning">Weekly planning</option><option value="brainstorm">Brainstorm</option></select>
          <button type="button" className="wide-action" disabled={readOnly} onClick={insertTemplate}>Insert template</button>
        </fieldset>
        <fieldset className="control-group"><legend>Board actions</legend>
          <button type="button" className="wide-action" onClick={() => setReadOnly(value => !value)}>{readOnly ? 'Unlock editing' : 'Preview as read-only'}</button>
          <div className="mode-grid"><button type="button" onClick={() => fit()} disabled={!live.length}>Fit board</button><button type="button" onClick={() => board.current?.setViewport({ panX: 0, panY: 0, zoom: 1 })}>Reset view</button></div>
          <div className="mode-grid"><button type="button" disabled={exporting} onClick={() => void exportPNG()}>{exporting ? 'Exporting…' : 'Export PNG'}</button><button type="button" onClick={exportJSON}>Export JSON</button></div>
          <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readImport(file); }} />
          <button type="button" className="wide-action" disabled={readOnly} onClick={() => importInput.current?.click()}>Import JSON</button>
          <button type="button" className="wide-action subtle" disabled={readOnly} onClick={() => { const sample = createBoardTemplate('flowchart'); board.current?.setElements(sample); fit(sample); setStatus('Sample restored. Undo brings your objects back.'); }}>Reset sample</button>
        </fieldset>
        {pendingImport && <section className="import-preview" aria-label="Import preview"><strong>{pendingImport.name}</strong><p>{pendingImport.elements.filter(element => !element.isDeleted).length} visible objects</p><NoteboardPreview elements={pendingImport.elements} height={100} /><div className="mode-grid"><button type="button" onClick={() => applyImport(true)}>Merge objects</button><button type="button" onClick={() => applyImport(false)}>Replace board</button></div><button type="button" className="wide-action subtle" onClick={() => { setPendingImport(null); setStatus('Import cancelled'); }}>Cancel import</button></section>}
        <div className="metrics"><div><strong>{live.length}</strong><span>Objects</span></div><div><strong>{Math.round(viewport.zoom * 100)}%</strong><span>Zoom</span></div></div>
        <p className="playground-status" role="status">{status || 'Export JSON to save a copy. Import JSON to reopen it.'}</p>
      </aside>
    </section>
    <footer className="playground-footer"><span><kbd>?</kbd> Keyboard shortcuts <span aria-hidden="true">·</span> Right-click for object actions</span><span>Drawing with <strong>{activeTool}</strong></span></footer>
    <details className="source-drawer" onToggle={event => setInspectSource(event.currentTarget.open)}><summary>Inspect board objects <span>{live.length} objects</span></summary><pre {...getNoteboardScrollbarProps(scrollbar)} tabIndex={0}>{source}</pre></details>
  </main></div>;
}
