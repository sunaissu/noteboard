import { createElement, generateId } from './elements/createElement';
import type { NoteboardElement, Point } from './elements/types';

export type BoardTemplate = 'flowchart' | 'planning' | 'brainstorm';

/** Fresh, editable objects on every call, ready for one history-aware insertion. */
export function createBoardTemplate(template: BoardTemplate, origin: Point = { x: 0, y: 0 }): NoteboardElement[] {
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) throw new Error('Template origin must be finite');
    const at = (x: number, y: number) => ({ x: origin.x + x, y: origin.y + y });
    if (template === 'flowchart') {
        const nodes = ['Capture an idea', 'Explore the options', 'Make it happen'].map((text, index) => createElement('rectangle', {
            ...at(index * 280, 100), width: 210, height: 100, text,
            backgroundColor: ['#ede9fe', '#dbeafe', '#dcfce7'][index],
            strokeColor: '#475569', fillStyle: 'solid', borderRadius: 14, fontSize: 18,
        }));
        const arrows = nodes.slice(0, -1).map((node, index) => createElement('arrow', {
            ...at(index * 280 + 210, 150), width: 70, height: 0,
            points: [{ x: 0, y: 0 }, { x: 70, y: 0 }],
            startBinding: { elementId: node.id, fixedPoint: { x: 1, y: .5 } },
            endBinding: { elementId: nodes[index + 1].id, fixedPoint: { x: 0, y: .5 } },
            strokeColor: '#64748b',
        }));
        return [...nodes, ...arrows];
    }
    if (template === 'planning') {
        return ['Ideas', 'In progress', 'Ready to share'].reduce<NoteboardElement[]>((items, text, index) => {
            const groupId = generateId();
            items.push(
                createElement('text', { ...at(index * 270, 30), width: 230, height: 36, text, fontSize: 24, fontWeight: 'bold', strokeColor: '#64748b', groupId }),
                createElement('sticky-note', { ...at(index * 270, 95), width: 225, height: 170, text: ['What could we build?', 'Try a small first step', 'What did we learn?'][index], noteColor: ['yellow', 'blue', 'green'][index], fontSize: 18, groupId }),
            );
            return items;
        }, []);
    }
    if (template === 'brainstorm') {
        return [
            createElement('ellipse', { ...at(270, 140), width: 220, height: 140, text: 'The big idea', fontSize: 24, backgroundColor: '#ede9fe', fillStyle: 'solid', strokeColor: '#7c5cff' }),
            ...['Who is it for?', 'What do they need?', 'What could we try?', 'What might get in the way?'].map((text, index) => createElement('sticky-note', {
                ...at(index % 2 * 550, Math.floor(index / 2) * 230), width: 210, height: 160, text, fontSize: 18, noteColor: 'yellow',
            })),
        ];
    }
    throw new Error('Unknown board template');
}
