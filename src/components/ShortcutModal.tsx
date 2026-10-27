import {WorkspaceDialog} from './WorkspaceDialog';
interface ShortcutModalProps {open:boolean;onClose:()=>void;}
const SECTIONS = [
    { title:'Keyboard Canvas', shortcuts:[
        {keys:['Ctrl/⌘','⇧','Backquote'],desc:'Toggle Keyboard Canvas (or use Settings)'},
        {keys:['Arrows'],desc:'Move cursor 10 px; Shift: 1 px; Alt: 80 px, stopping at objects'},
        {keys:['Space'],desc:'Start / finish drawing; same point creates nothing'},
        {keys:['Tab / ⇧ Tab'],desc:'Cycle visible objects; A toggles additive selection'},
        {keys:['Enter'],desc:'Edit text; Ctrl/⌘ Enter finishes text'},
        {keys:['M / ⇧ S'],desc:'Move / resize selection with arrows; Enter finishes'},
        {keys:['P / L'],desc:'Properties / layers; Escape returns to canvas'},
        {keys:['Ctrl/⌘','K'],desc:'Search tools and actions'},
        {keys:['Ctrl/⌘','Alt','Arrows'],desc:'Create a connected shape'},
        {keys:['F / ⇧ F'],desc:'Fit board / selection'},
        {keys:['Esc / F6'],desc:'Cancel draft / leave mode; Tab then reaches controls'},
    ]},
    {
        title: 'Navigation',
        shortcuts: [
            { keys: ['Scroll'], desc: 'Pan canvas' },
            { keys: ['Ctrl', 'Scroll'], desc: 'Zoom in / out' },
            { keys: ['Ctrl', '0'], desc: 'Fit all elements' },
            { keys: ['Ctrl', '⇧', 'H'], desc: 'Fit selection' },
        ],
    },
    {
        title: 'Tools',
        shortcuts: [
            { keys: ['1–9'], desc: 'Switch tool by slot' },
            { keys: ['S'], desc: 'Select tool' },
            { keys: ['H'], desc: 'Pan tool' },
            { keys: ['P'], desc: 'Pen tool' },
            { keys: ['T'], desc: 'Text tool' },
            { keys: ['G'], desc: 'Toggle grid / snap' },
        ],
    },
    {
        title: 'Editing',
        shortcuts: [
            { keys: ['Ctrl', 'Z'], desc: 'Undo' },
            { keys: ['Ctrl', '⇧', 'Z'], desc: 'Redo' },
            { keys: ['Ctrl', 'C'], desc: 'Copy' },
            { keys: ['Ctrl', 'V'], desc: 'Paste' },
            { keys: ['Ctrl', 'D'], desc: 'Duplicate' },
            { keys: ['Delete'], desc: 'Delete selected' },
            { keys: ['↑ ↓ ← →'], desc: 'Nudge (+ ⇧ = large step)' },
        ],
    },
    {
        title: 'Selection & Layers',
        shortcuts: [
            { keys: ['Ctrl', 'A'], desc: 'Select all' },
            { keys: ['Escape'], desc: 'Deselect' },
            { keys: ['⇧', 'Click'], desc: 'Add to selection' },
            { keys: [']'], desc: 'Move forward' },
            { keys: ['['], desc: 'Move backward' },
            { keys: ['Ctrl', ']'], desc: 'Bring to front' },
            { keys: ['Ctrl', '['], desc: 'Send to back' },
            { keys: ['Ctrl', 'G'], desc: 'Group' },
            { keys: ['Ctrl', '⇧', 'G'], desc: 'Ungroup' },
        ],
    },
    {
        title: 'Canvas',
        shortcuts: [
            { keys: ['?'], desc: 'Show this cheatsheet' },
            { keys: ['Dbl-click'], desc: 'Edit text / shape label' },
            { keys: ['Escape'], desc: 'Finish text edit' },
        ],
    },
];


export function ShortcutModal({open,onClose}:ShortcutModalProps){if(!open)return null;return <WorkspaceDialog title="Keyboard shortcuts" onClose={onClose}><p>Use Command on Mac wherever Ctrl is shown. On touch screens, one finger pans and two fingers zoom. Enable Finger drawing in Settings to draw with one finger; a stylus draws directly.</p>{SECTIONS.map(section=><section key={section.title}><h3>{section.title}</h3><dl>{section.shortcuts.map(row=><div key={row.desc} style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:10}}><dt style={{fontWeight:600}}>{row.keys.join(' + ')}</dt><dd style={{margin:0}}>{row.desc}</dd></div>)}</dl></section>)}</WorkspaceDialog>;}
