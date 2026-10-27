import { useEffect, useRef, useState } from "react";
import type { TextDraftStorage, TextDraftIntent } from "../textDrafts";
import { cancelTextIntent } from "../textDrafts";

export function useTextDraftQueue(
  storage: TextDraftStorage | undefined,
  boardId: string,
) {
  const [drafts, setDrafts] = useState<TextDraftIntent[]>([]),
    [error, setError] = useState("");
  const current = useRef<TextDraftIntent | null>(null),
    operations = useRef<{ before: string; after: string }[]>([]),
    queue = useRef(Promise.resolve());
  const enqueue = (action: () => void | Promise<void>) => {
    queue.current = queue.current
      .then(action)
      .catch((err) => setError("Text recovery: " + String(err)));
  };
  useEffect(() => {
    let active = true;
    current.current = null;
    operations.current = [];
    setDrafts([]);
    if (storage)
      Promise.resolve()
        .then(() => storage.load(boardId))
        .then(
          (values) => {
            if (active) setDrafts(values);
          },
          (err) => {
            if (active) setError(String(err));
          },
        );
    return () => {
      active = false;
    };
  }, [storage, boardId]);
  const track = (elementId: string, before: string, after: string) => {
    operations.current.push({ before, after });
    const previous = current.current;
    const draft: TextDraftIntent = {
      id: previous?.id ?? crypto.randomUUID(),
      boardId,
      elementId,
      revision: previous?.revision ?? String(Date.now()),
      before: previous?.before ?? before,
      after,
      updatedAt: Date.now(),
    };
    current.current = draft;
    if (storage) {
      setDrafts((items) => [...items.filter((d) => d.id !== draft.id), draft]);
      enqueue(() => storage.save(draft));
    }
  };
  const discard = (id: string) => {
    if (storage)
      enqueue(async () => {
        await storage.remove(id);
        setDrafts((items) => items.filter((d) => d.id !== id));
      });
  };
  const finish = (accepted: boolean) => {
    if (!accepted && current.current) setError(previous=>previous||"Text draft retained for recovery.");
    current.current = null;
    operations.current = [];
  };
  const cancel = (text: string) => {
    let result = text;
    for (const intent of [...operations.current].reverse()) {
      const next = cancelTextIntent(intent, result);
      if (next.conflict) {
        setError(
          "A peer changed the same text. Cancel kept the shared text and retained your recovery draft.",
        );
        return null;
      }
      result = next.text;
    }
    return result;
  };
  return {
    drafts,
    error,
    track,
    finish,
    cancel,
    discard,
    retry:()=>{if(storage)enqueue(async()=>{for(const draft of drafts)await storage.save(draft);setError('');});},
    clearError: () => setError(""),
  };
}
