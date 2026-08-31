import { useRef, useCallback } from 'react';
import type { NoteboardElement } from '../elements/types';

const MAX_HISTORY = 50;

export interface HistoryAPI {
    /**
     * Record a snapshot BEFORE a mutation.
     * Call with the current elements right before you change them.
     */
    record: (elementsBefore: NoteboardElement[]) => void;
    /**
     * Undo: saves current state to redo stack, pops and returns the previous
     * state from the undo stack. Pass the current elements so they can be
     * saved for redo.
     */
    undo: (currentElements: NoteboardElement[]) => NoteboardElement[] | null;
    /**
     * Redo: saves current state to undo stack, pops and returns the next
     * state from the redo stack.
     */
    redo: (currentElements: NoteboardElement[]) => NoteboardElement[] | null;
    /** Whether undo is available. */
    canUndo: () => boolean;
    /** Whether redo is available. */
    canRedo: () => boolean;
}

/**
 * Snapshot-based undo/redo history.
 *
 * Design:
 *   - record(before) is called with the state BEFORE a mutation.
 *   - undo(current) saves `current` for redo, returns the popped state.
 *   - redo(current) saves `current` for undo, returns the popped state.
 *
 * This ensures a single Ctrl+Z always restores the previous state.
 */
export function useHistory(): HistoryAPI {
    const undoStackRef = useRef<NoteboardElement[][]>([]);
    const redoStackRef = useRef<NoteboardElement[][]>([]);

    const clone = (els: NoteboardElement[]): NoteboardElement[] => {
        if (typeof structuredClone === 'function') return structuredClone(els);
        return JSON.parse(JSON.stringify(els)) as NoteboardElement[];
    };

    const record = useCallback((elementsBefore: NoteboardElement[]) => {
        undoStackRef.current.push(clone(elementsBefore));
        if (undoStackRef.current.length > MAX_HISTORY) {
            undoStackRef.current.shift();
        }
        // Any new action clears the redo stack
        redoStackRef.current = [];
    }, []);

    const undo = useCallback((currentElements: NoteboardElement[]): NoteboardElement[] | null => {
        if (undoStackRef.current.length === 0) return null;
        // Save current state so we can redo back to it
        redoStackRef.current.push(clone(currentElements));
        // Pop and return the previous state
        return clone(undoStackRef.current.pop()!);
    }, []);

    const redo = useCallback((currentElements: NoteboardElement[]): NoteboardElement[] | null => {
        if (redoStackRef.current.length === 0) return null;
        // Save current state so we can undo back to it
        undoStackRef.current.push(clone(currentElements));
        // Pop and return the next state
        return clone(redoStackRef.current.pop()!);
    }, []);

    const canUndo = useCallback(() => undoStackRef.current.length > 0, []);
    const canRedo = useCallback(() => redoStackRef.current.length > 0, []);

    return { record, undo, redo, canUndo, canRedo };
}
