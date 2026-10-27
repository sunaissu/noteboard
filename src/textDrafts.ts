import { textEdit, moveTextPosition } from "./textEdit";
export interface TextDraftIntent {
  id: string;
  boardId: string;
  elementId: string;
  revision: string;
  before: string;
  after: string;
  updatedAt: number;
}
export interface TextDraftStorage {
  load(boardId: string): Promise<TextDraftIntent[]> | TextDraftIntent[];
  save(draft: TextDraftIntent): Promise<void> | void;
  remove(id: string): Promise<void> | void;
}
export function createBrowserTextDrafts(accountId: string): TextDraftStorage {
  const key = "noteboard:text-intents:" + accountId;
  const read = (): TextDraftIntent[] => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    if (raw.length > 4 * 1024 * 1024)
      throw new Error("Text recovery queue is too large");
    const values = JSON.parse(raw);
    if (
      !Array.isArray(values) ||
      values.length > 200 ||
      !values.every(
        (v) =>
          v &&
          ["id", "boardId", "elementId", "revision", "before", "after"].every(
            (k) => typeof v[k] === "string",
          ) &&
          v.before.length <= 1000000 &&
          v.after.length <= 1000000 &&
          Number.isFinite(v.updatedAt),
      )
    )
      throw new Error("Invalid text recovery queue");
    return values;
  };
  return {
    load: (boardId) => read().filter((d) => d.boardId === boardId),
    save: (draft) => {
      const all = read().filter((d) => d.id !== draft.id);
      all.push(draft);
      const raw = JSON.stringify(all);
      if (raw.length > 4 * 1024 * 1024 || all.length > 200)
        throw new Error("Text recovery queue is full");
      localStorage.setItem(key, raw);
    },
    remove: (id) =>
      localStorage.setItem(
        key,
        JSON.stringify(read().filter((d) => d.id !== id)),
      ),
  };
}
/** Reverse one local intent only when peer edits do not overlap its inserted range. */
export function cancelTextIntent(
  intent: Pick<TextDraftIntent, "before" | "after">,
  current: string,
): { text: string; conflict: boolean } {
  const local = textEdit(intent.before, intent.after),
    peer = textEdit(intent.after, current),
    end = local.start + local.insert.length;
  if (current !== intent.after && peer.start < end && peer.end > local.start)
    return { text: current, conflict: true };
  const start = moveTextPosition(local.start, intent.after, current, "after"),
    stop = moveTextPosition(end, intent.after, current, "before");
  if (current.slice(start, stop) !== local.insert)
    return { text: current, conflict: true };
  return {
    text:
      current.slice(0, start) +
      intent.before.slice(local.start, local.end) +
      current.slice(stop),
    conflict: false,
  };
}
