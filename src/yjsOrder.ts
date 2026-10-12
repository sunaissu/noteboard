import type * as Y from 'yjs';

/** Identify unchanged relative order in O(n log n), with unique element IDs. */
function stableIds(previous: string[], next: string[]): Set<string> {
    const positions = new Map(previous.map((id, index) => [id, index]));
    const ids = next.filter(id => positions.has(id));
    const tails: number[] = [], parents: number[] = [];
    for (let index = 0; index < ids.length; index++) {
        const position = positions.get(ids[index])!;
        let low = 0, high = tails.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (positions.get(ids[tails[middle]])! < position) low = middle + 1;
            else high = middle;
        }
        parents[index] = low ? tails[low - 1] : -1;
        tails[low] = index;
    }
    const stable = new Set<string>();
    for (let index = tails[tails.length - 1] ?? -1; index >= 0; index = parents[index]) stable.add(ids[index]);
    return stable;
}

/** Apply local insert/delete/move intent while retaining untouched peer entries. */
export function updateSharedOrder(order: Y.Array<string>, previous: string[], next: string[], exists: (id: string) => boolean): void {
    const stable = stableIds(previous, next);
    const original = new Set(previous);
    let lastExisting = -1;
    next.forEach((id, index) => { if (original.has(id)) lastExisting = index; });
    const moved = new Set(next.filter(id => !stable.has(id)));
    const current = order.toArray();
    const seen = new Set<string>();
    const remove = current.map(id => {
        const discard = !exists(id) || moved.has(id) || seen.has(id);
        seen.add(id);
        return discard;
    });
    for (let index = current.length - 1; index >= 0; index--) {
        if (remove[index]) { order.delete(index, 1); current.splice(index, 1); }
    }
    // Missing order entries can arise from a peer update or an older document.
    const present = new Set(current);
    for (let index = 0; index < next.length; index++) {
        const id = next[index];
        if (!exists(id) || present.has(id)) continue;
        let position = -1;
        for (let before = index - 1; before >= 0; before--) {
            if (present.has(next[before])) { position = current.indexOf(next[before]) + 1; break; }
        }
        if (position < 0) {
            position = current.length;
            for (let after = index + 1; after < next.length; after++) {
                if (present.has(next[after])) { position = current.indexOf(next[after]); break; }
            }
        }
        // Appending new objects means the current front of the board, even if
        // a peer moved the formerly last object elsewhere in the meantime.
        if (!original.has(id) && index > lastExisting) position = current.length;
        order.insert(position, [id]); current.splice(position, 0, id); present.add(id);
    }
}
