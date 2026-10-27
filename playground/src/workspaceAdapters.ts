import {
  createBrowserWorkspaceStorage,
  createBrowserTextDrafts,
  createLocalBoardRoom,
  deserializeBoard,
} from "@sunaissu/noteboard";
import type {
  BoardVersionsAdapter,
  BoardContentAdapter,
  NoteboardElement,
} from "@sunaissu/noteboard";
import { evaluateExpression } from "@sunaissu/calculator";

export const workspaceStorage =
  createBrowserWorkspaceStorage("local-playground");
export const textDraftStorage = createBrowserTextDrafts("local-playground");
export const room = createLocalBoardRoom();
export const localSession = room.connect(
  {
    sessionId: crypto.randomUUID(),
    userId: "local-user",
    name: "You",
    color: "#7c3aed",
  },
  true,
);

export function playgroundVersions(
  getElements: () => NoteboardElement[],
): BoardVersionsAdapter {
  const key = "noteboard:playground-revisions";
  const read = (): {
    id: string;
    name: string;
    createdAt: string;
    elements: NoteboardElement[];
  }[] => JSON.parse(localStorage.getItem(key) ?? "[]");
  return {
    currentRevision: () => JSON.stringify(getElements()),
    list: async () => read().map(({ elements, ...meta }) => meta),
    load: async (id) => {
      const entry = read().find((r) => r.id === id);
      if (!entry) throw new Error("Revision was removed");
      return deserializeBoard(entry).elements;
    },
    save: async (name, elements) => {
      const entries = read();
      if (entries.length >= 20)
        throw new Error("Local example stores at most 20 revisions");
      entries.push({
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        elements: deserializeBoard({ elements }).elements,
      });
      localStorage.setItem(key, JSON.stringify(entries));
    },
    restore: async (id, expected, signal) => {
      if (signal.aborted) throw new Error("Restore cancelled");
      if (JSON.stringify(getElements()) !== expected)
        throw new Error("Board changed; refresh the restore preview");
      const entry = read().find((r) => r.id === id);
      if (!entry) throw new Error("Revision was removed");
      return deserializeBoard(entry).elements;
    },
  };
}
export const contentAdapter: BoardContentAdapter = {
  navigate: async (link) => {
    if (link.kind === "url")
      window.open(link.target, "_blank", "noopener,noreferrer");
    else throw new Error("This local example has no document navigation route");
  },
  resolveDocument: async (reference) =>
    reference.documentId === "example"
      ? {
          documentId: "example",
          revision: "1",
          title: "Example project brief",
          fallback:
            "A local excerpt supplied by the playground host. Use your document service for authenticated content.",
        }
      : null,
  openCalculation: async (calculation) => {
    if (calculation.version !== 1)
      throw new Error("Unsupported calculation version");
    return {
      ...calculation,
      result: String(
        evaluateExpression(calculation.expression, {
          variables: calculation.variables,
        }),
      ),
    };
  },
  pickMedia: async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(0, 0, 160, 100);
    ctx.fillStyle = "white";
    ctx.font = "18px sans-serif";
    ctx.fillText("Shared asset", 20, 58);
    return {
      id: "example-image",
      name: "Shared example",
      dataUrl: canvas.toDataURL(),
      width: 160,
      height: 100,
    };
  },
  resolveMedia: async (id, signal) =>
    id === "example-image" ? contentAdapter.pickMedia!(signal) : null,
};
