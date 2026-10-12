import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Noteboard, NoteboardPreview, createBoardTemplate, deserializeBoard, duplicateElements,
  MAX_BOARD_ELEMENTS, MAX_BOARD_IMPORT_BYTES, getElementBounds,
  type BoardTemplate, type NoteboardElement, type NoteboardRef,
  type NoteboardThemeMode, type NoteboardViewport, type ToolbarPosition, type Tool,
} from '@sunaissu/noteboard';

const positions: ToolbarPosition[] = ['top', 'bottom', 'left', 'right'];
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
  const [elements, setElements] = useState<NoteboardElement[]>(() => createBoardTemplate('flowchart'));
  const [viewport, setViewport] = useState<NoteboardViewport>({ panX: 0, panY: 0, zoom: 1 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [position, setPosition] = useState<ToolbarPosition>('bottom');
  const [propertiesPosition, setPropertiesPosition] = useState<ToolbarPosition>('left');
  const [readOnly, setReadOnly] = useState(false);
  const [theme, setTheme] = useState<NoteboardThemeMode>('system');
  const [primary, setPrimary] = useState('#7c5cff'), [secondary, setSecondary] = useState('#22a06b');
  const [template, setTemplate] = useState<BoardTemplate>('flowchart');
  const [status, setStatus] = useState(''), [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; elements: NoteboardElement[]; viewport: NoteboardViewport } | null>(null);
  const importGeneration = useRef(0), permission = useRef(readOnly);
  permission.current = readOnly;
  const live = useMemo(() => elements.filter(element => !element.isDeleted), [elements]);
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

  return <main className="playground-shell">
    <header className="playground-header"><div>
      <span className="eyebrow">@sunaissu/noteboard</span>
      <h1>Room for your next idea.</h1>
      <p>Sketch a flow, map out a plan, or make space for a new thought. Start with a template and make it yours.</p>
    </div><div className="package-badge"><span />Local package playground</div></header>
    <section className="playground-grid">
      <div className="board-stage" ref={stage}><Noteboard ref={board} elements={elements} onElementsChange={setElements}
        viewport={viewport} onViewportChange={setViewport} activeTool={activeTool} onToolSelect={setActiveTool}
        toolbarPosition={position} propertiesPosition={propertiesPosition} readOnly={readOnly}
        theme={theme} onThemeChange={setTheme} brandColors={{ primary, secondary }} boardId="playground" threadId="local" /></div>
      <aside className="inspector" aria-label="Playground controls">
        <div className="inspector-heading"><span>Playground controls</span><small>{readOnly ? 'Read-only' : 'Editable'}</small></div>
        <fieldset className="control-group"><legend>Color theme</legend><div className="mode-grid three-columns">
          {(['system', 'light', 'dark'] as const).map(candidate => <button type="button" key={candidate} aria-pressed={theme === candidate} className={theme === candidate ? 'is-active' : ''} onClick={() => setTheme(candidate)}>{candidate === 'system' ? 'auto' : candidate}</button>)}
        </div><div className="brand-color-grid"><label>Primary<input type="color" value={primary} onChange={event => setPrimary(event.target.value)} /></label><label>Secondary<input type="color" value={secondary} onChange={event => setSecondary(event.target.value)} /></label></div></fieldset>
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
        <p className="playground-status" role="status">{status || 'Your changes stay in this session. Export JSON to keep a copy.'}</p>
      </aside>
    </section>
    <footer className="playground-footer"><span><kbd>?</kbd> Keyboard shortcuts <span aria-hidden="true">·</span> Right-click for object actions</span><span>Drawing with <strong>{activeTool}</strong></span></footer>
    <details className="source-drawer" onToggle={event => setInspectSource(event.currentTarget.open)}><summary>Inspect board objects <span>{live.length} objects</span></summary><pre>{source}</pre></details>
  </main>;
}
