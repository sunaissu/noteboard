import { useEffect } from 'react';
import type { Tool, ToolSlot } from '../types';

export function useToolbarShortcuts(
    slots: ToolSlot[],
    onToolSelect?: (tool: Tool) => void,
) {
    useEffect(() => {
        if (!onToolSelect) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const keyToPosition: Record<string, number> = {
                '1': 1, '2': 2, '3': 3,
                '4': 4, '5': 5, '6': 6,
                '7': 7, '8': 8, '9': 9,
                '0': 10,
            };

            const position = keyToPosition[e.key];
            if (position === undefined) return;

            const slot = slots.find((s) => s.position === position);
            if (slot) {
                e.preventDefault();
                onToolSelect(slot.toolId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slots, onToolSelect]);
}
