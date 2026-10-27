import type { NoteboardElement, Point } from "./elements/types";
import type { NoteboardViewport } from "./session";
import { deserializeBoard, MAX_BOARD_IMPORT_BYTES } from "./session";
import { createElement, generateId } from "./elements/createElement";
import { duplicateElements } from "./elements/mutateElement";
import { combineBounds, getElementBounds } from "./elements/bounds";
import { updateBoundElements } from "./elements/connectorBinding";
import { expandFrameSelection, pickToolStyle } from "./editingActions";

export interface BoardViewpoint {
  id: string;
  name: string;
  viewport: NoteboardViewport;
}
export interface SelectionBookmark {
  id: string;
  name: string;
  ids: string[];
}
export interface BoardTemplateEntry {
  id: string;
  name: string;
  version: 1;
  kind: "template" | "symbol";
  elements: NoteboardElement[];
}
export interface BoardStylePreset {
  id: string;
  name: string;
  style: Partial<NoteboardElement>;
}
export interface BoardWorkspaceState {
  version: 1;
  boardId: string;
  viewpoints: BoardViewpoint[];
  bookmarks: SelectionBookmark[];
  library: BoardTemplateEntry[];
  presets: BoardStylePreset[];
}
export interface BoardWorkspaceStorage {
  load(boardId: string): Promise<unknown> | unknown;
  save(boardId: string, state: BoardWorkspaceState): Promise<void> | void;
}
export const emptyWorkspace = (boardId: string): BoardWorkspaceState => ({
  version: 1,
  boardId,
  viewpoints: [],
  bookmarks: [],
  library: [],
  presets: [],
});
export function createBrowserWorkspaceStorage(
  accountId: string,
): BoardWorkspaceStorage {
  const key = (boardId: string) =>
    "noteboard:workspace:" +
    encodeURIComponent(accountId) +
    ":" +
    encodeURIComponent(boardId);
  return {
    load: (boardId) => {
      const raw = localStorage.getItem(key(boardId));
      if (!raw) return null;
      if (raw.length > MAX_BOARD_IMPORT_BYTES)
        throw new Error("Workspace exceeds 16 MiB");
      return normalizeWorkspace(JSON.parse(raw), boardId);
    },
    save: (boardId, state) =>
      localStorage.setItem(
        key(boardId),
        JSON.stringify(normalizeWorkspace(state, boardId)),
      ),
  };
}
const name = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.length > 256)
    throw new Error("Use a name between 1 and 256 characters");
  return value;
};
const boundedJson = (value: unknown) => {
  if (JSON.stringify(value).length > MAX_BOARD_IMPORT_BYTES)
    throw new Error("Workspace exceeds 16 MiB");
};

export function normalizeWorkspace(
  value: unknown,
  boardId: string,
): BoardWorkspaceState {
  boundedJson(value);
  const input = value as BoardWorkspaceState;
  if (!input || input.boardId !== boardId || ![0, 1].includes(input.version))
    throw new Error(
      "Workspace belongs to a different board or an unsupported version",
    );
  const result = emptyWorkspace(boardId);
  for (const key of [
    "viewpoints",
    "bookmarks",
    "library",
    "presets",
  ] as const) {
    if (!Array.isArray(input[key]) || input[key].length > 200)
      throw new Error("Invalid workspace collection");
    const ids = new Set<string>();
    for (const item of input[key]) {
      name(item.id);
      name(item.name);
      if (ids.has(item.id)) throw new Error("Duplicate workspace ID");
      ids.add(item.id);
    }
  }
  result.viewpoints = input.viewpoints.map((v) => ({
    id: v.id,
    name: v.name,
    viewport: deserializeBoard({ elements: [], viewport: v.viewport }).viewport,
  }));
  result.bookmarks = input.bookmarks.map((b) => {
    if (
      !Array.isArray(b.ids) ||
      b.ids.length > 10000 ||
      !b.ids.every((id) => typeof id === "string" && id.length <= 256)
    )
      throw new Error("Invalid bookmark");
    return { ...b, ids: [...new Set(b.ids)] };
  });
  result.library = input.library.map((entry) => {
    if (entry.version !== undefined && entry.version !== 1)
      throw new Error("Unsupported template version");
    return {
      id: entry.id,
      name: entry.name,
      version: 1,
      kind: entry.kind === "symbol" ? "symbol" : "template",
      elements: deserializeBoard({ elements: entry.elements }).elements,
    };
  });
  result.presets = input.presets.map((p) => {
    const style = pickToolStyle(p.style ?? {});
    validatePreset(style);
    return { id: p.id, name: p.name, style };
  });
  return result;
}

export function createLibraryEntry(
  elements: NoteboardElement[],
  ids: Iterable<string>,
  title: string,
  kind: "template" | "symbol" = "symbol",
): BoardTemplateEntry {
  const selected = expandFrameSelection(elements, ids);
  const source = elements.filter(
    (el) => selected.has(el.id) && !el.isDeleted && !el.hidden,
  );
  if (!source.length) throw new Error("Select at least one visible object");
  const [x, y] = combineBounds(source.map(getElementBounds));
  const copies = duplicateElements(source, 0).map((el) => ({
    ...el,
    x: el.x - x,
    y: el.y - y,
    locked: false,
  }));
  return {
    id: generateId(),
    name: name(title),
    version: 1,
    kind,
    elements: deserializeBoard({ elements: copies }).elements,
  };
}
export function insertLibraryEntry(
  entry: BoardTemplateEntry,
  origin: Point,
): NoteboardElement[] {
  if (entry.version !== 1) throw new Error("Unsupported template version");
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y))
    throw new Error("Invalid insertion position");
  return duplicateElements(
    deserializeBoard({ elements: entry.elements }).elements,
    0,
  ).map((el) => ({ ...el, x: el.x + origin.x, y: el.y + origin.y }));
}
export function restoreSelectionBookmark(
  bookmark: SelectionBookmark,
  elements: NoteboardElement[],
) {
  const active = new Map(
    elements.filter((el) => !el.isDeleted).map((el) => [el.id, el]),
  );
  return {
    ids: bookmark.ids.filter((id) => active.has(id)),
    missing: bookmark.ids.filter((id) => !active.has(id)),
    hidden: bookmark.ids.filter((id) => active.get(id)?.hidden),
  };
}
function validatePreset(style: Partial<NoteboardElement>) {
  for (const type of [
    "rectangle",
    "ellipse",
    "diamond",
    "triangle",
    "star",
    "text",
    "sticky-note",
    "callout",
    "frame",
    "line",
    "arrow",
    "pen",
  ] as const)
    deserializeBoard({ elements: [createElement(type, style)] });
}
export function createStylePreset(
  element: NoteboardElement,
  title: string,
): BoardStylePreset {
  const style = pickToolStyle(element);
  delete (style as Record<string, unknown>).label;
  validatePreset(style);
  return { id: generateId(), name: name(title), style };
}
export function applyStylePreset(
  elements: NoteboardElement[],
  ids: Set<string>,
  preset: BoardStylePreset,
) {
  const style = pickToolStyle(preset.style);
  delete (style as Record<string, unknown>).label;
  validatePreset(style);
  const skipped = new Set<string>();
  const next = elements.map((el) => {
    if (!ids.has(el.id) || el.locked || el.isDeleted) return el;
    const supported = new Set(Object.keys(createElement(el.type)));
    const common = new Set(["dropShadow", "blendMode"]);
    const text = new Set([
      "fontSize",
      "fontFamily",
      "textAlign",
      "lineHeight",
      "fontWeight",
      "fontStyle",
      "textDecoration",
      "highlightColor",
    ]);
    const hasText =
      "text" in el ||
      [
        "rectangle",
        "ellipse",
        "diamond",
        "triangle",
        "star",
        "sticky-note",
        "callout",
      ].includes(el.type);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(style)) {
      if (supported.has(key) || common.has(key) || (hasText && text.has(key)))
        patch[key] = value;
      else skipped.add(key);
    }
    return { ...el, ...patch } as NoteboardElement;
  });
  return {
    elements: deserializeBoard({ elements: next }).elements,
    skipped: [...skipped],
  };
}

export interface DiagramRow {
  id: string;
  label: string;
  target?: string;
}
export function parseDiagram(text: string): NoteboardElement[] {
  if (text.length > 200000) throw new Error("Diagram text exceeds 200 KB");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closedQuote = true;
      }
    } else if (c === '"') {
      if (field || closedQuote) throw new Error("Quote must begin a field");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field);
      field = "";
      closedQuote = false;
      if (c !== ",") {
        rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closedQuote) throw new Error("Unexpected text after a quoted field");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed quoted field");
  if (field || row.length || closedQuote) rows.push([...row, field]);
  const header = rows[0]?.map((column) => column.trim().toLowerCase());
  if (
    header?.[0] === "id" && header[1] === "label" &&
    (header.length === 2 || (header.length === 3 && header[2] === "target"))
  ) rows.shift();
  const records = rows.filter((r) => r.some(Boolean));
  if (!records.length || records.length > 500)
    throw new Error("Import between 1 and 500 rows");
  const nodes = new Map<string, NoteboardElement>();
  for (const [id, label, ...extra] of records) {
    if (
      !id ||
      id.length > 256 ||
      !label ||
      label.length > 2000 ||
      extra.length > 1
    )
      throw new Error("Use id,label,target columns");
    if (nodes.has(id)) throw new Error("Duplicate node ID: " + id);
    nodes.set(
      id,
      createElement("rectangle", {
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        text: label,
        fillStyle: "solid",
        backgroundColor: "#ede9fe",
      }),
    );
  }
  const edges: NoteboardElement[] = [];
  for (const [id, , target] of records)
    if (target) {
      if (!nodes.has(target)) throw new Error("Missing target: " + target);
      const source = nodes.get(id)!,
        end = nodes.get(target)!;
      edges.push(
        createElement("arrow", {
          x: 0,
          y: 0,
          width: 100,
          height: 0,
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          routing: "orthogonal",
          startBinding: { elementId: source.id, fixedPoint: { x: 1, y: 0.5 } },
          endBinding: { elementId: end.id, fixedPoint: { x: 0, y: 0.5 } },
        }),
      );
    }
  const elements = [...nodes.values(), ...edges];
  return layoutDiagram(elements, new Set(elements.map((el) => el.id)), "flow");
}

export function layoutDiagram(
  elements: NoteboardElement[],
  ids: Set<string>,
  mode: "flow" | "mind-map",
): NoteboardElement[] {
  const nodes = elements.filter(
    (el) =>
      ids.has(el.id) &&
      !el.locked &&
      !el.hidden &&
      !el.isDeleted &&
      !["line", "arrow", "frame"].includes(el.type),
  );
  if (nodes.length > 500)
    throw new Error("Layout supports up to 500 selected objects");
  if (!nodes.length) return elements;
  const map = new Map(nodes.map((el) => [el.id, el])),
    adj = new Map(nodes.map((el) => [el.id, [] as string[]])),
    incoming = new Set<string>();
  for (const el of elements)
    if (
      (el.type === "line" || el.type === "arrow") &&
      !el.isDeleted &&
      el.startBinding &&
      el.endBinding &&
      map.has(el.startBinding.elementId) &&
      map.has(el.endBinding.elementId)
    ) {
      adj.get(el.startBinding.elementId)!.push(el.endBinding.elementId);
      incoming.add(el.endBinding.elementId);
    }
  const roots = [...nodes.filter((el) => !incoming.has(el.id)), ...nodes],
    depth = new Map<string, number>();
  let componentOffset = 0;
  for (const root of roots) {
    if (depth.has(root.id)) continue;
    const queue = [root.id];
    depth.set(root.id, componentOffset);
    let max = componentOffset;
    for (let i = 0; i < queue.length; i++)
      for (const id of adj.get(queue[i]) ?? [])
        if (!depth.has(id)) {
          const d = depth.get(queue[i])! + 1;
          depth.set(id, d);
          max = Math.max(max, d);
          queue.push(id);
        }
    componentOffset = max + 2;
  }
  const [left, top] = combineBounds(nodes.map(getElementBounds)),
    columns = new Map<number, number>(),
    positions = new Map<string, Point>();
  const cellW =
      nodes.reduce((m, el) => Math.max(m, Math.abs(el.width)), 0) + 100,
    cellH = nodes.reduce((m, el) => Math.max(m, Math.abs(el.height)), 0) + 70;
  nodes.forEach((el) => {
    const d = depth.get(el.id)!,
      index = columns.get(d) ?? 0;
    columns.set(d, index + 1);
    positions.set(
      el.id,
      mode === "flow"
        ? { x: left + d * cellW, y: top + index * cellH }
        : { x: left + index * cellW, y: top + d * cellH },
    );
  });
  return updateBoundElements(
    elements.map((el) =>
      positions.has(el.id) ? { ...el, ...positions.get(el.id)! } : el,
    ),
  );
}

export function relationshipOutline(elements: NoteboardElement[]) {
  const active = elements.filter((el) => !el.isDeleted && !el.hidden),
    byId = new Map(active.map((el) => [el.id, el]));
  const connections = new Map<
    string,
    { id: string; targetId?: string; targetName: string }[]
  >();
  for (const edge of active)
    if (edge.type === "line" || edge.type === "arrow")
      for (const [from, to] of [
        [edge.startBinding?.elementId, edge.endBinding?.elementId],
        [edge.endBinding?.elementId, edge.startBinding?.elementId],
      ]) {
        if (!from) continue;
        const list = connections.get(from) ?? [];
        list.push({
          id: edge.id,
          targetId: to,
          targetName: to
            ? byId.get(to)?.displayName || to
            : "Unattached endpoint",
        });
        connections.set(from, list);
      }
  return active.map((el) => ({
    id: el.id,
    name: el.displayName || ("text" in el ? el.text : "") || el.type,
    connections: connections.get(el.id) ?? [],
  }));
}

export function recognizeStroke(
  element: NoteboardElement,
): { element: NoteboardElement; confidence: number } | null {
  if (
    (element.type !== "pen" && element.type !== "draw") ||
    element.points.length < 4 ||
    element.points.length > 100000
  )
    return null;
  const points = element.points.filter(
      (_, i) => i % Math.max(1, Math.floor(element.points.length / 512)) === 0,
    ),
    first = points[0],
    last = points[points.length - 1];
  const [l, t, r, b] = getElementBounds(element),
    w = r - l,
    h = b - t,
    diagonal = Math.hypot(w, h);
  if (diagonal < 15) return null;
  const endDistance = Math.hypot(last.x - first.x, last.y - first.y),
    length = points.reduce(
      (sum, p, i) =>
        sum +
        (i ? Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0),
      0,
    );
  const style = pickToolStyle(element);
  const make = (
    type: "line" | "rectangle" | "ellipse",
    confidence: number,
  ) => ({
    confidence,
    element: createElement(type, {
      ...style,
      id: element.id,
      x: l,
      y: t,
      width: w,
      height: h,
      angle: element.angle,
      ...(type === "line"
        ? {
            x: element.x + first.x,
            y: element.y + first.y,
            points: [
              { x: 0, y: 0 },
              { x: last.x - first.x, y: last.y - first.y },
            ],
            width: last.x - first.x,
            height: last.y - first.y,
          }
        : {}),
    }),
  });
  if (endDistance / Math.max(1, length) > 0.95)
    return make("line", endDistance / length);
  if (endDistance > diagonal * 0.2 || w < 15 || h < 15 || length > diagonal * 5)
    return null;
  const normalized = points.map((p) => ({
    x: (element.x + p.x - l) / w,
    y: (element.y + p.y - t) / h,
  }));
  const rectError =
    normalized.reduce(
      (s, p) =>
        s +
        Math.min(
          Math.abs(p.x),
          Math.abs(1 - p.x),
          Math.abs(p.y),
          Math.abs(1 - p.y),
        ),
      0,
    ) / points.length;
  const ellipseError =
    normalized.reduce(
      (s, p) => s + Math.abs(Math.hypot((p.x - 0.5) * 2, (p.y - 0.5) * 2) - 1),
      0,
    ) / points.length;
  if (rectError < 0.045)
    return make("rectangle", Math.max(0.8, 1 - rectError * 4));
  if (ellipseError < 0.12) return make("ellipse", 1 - ellipseError);
  return null;
}

export function compareBoardVersions(
  current: NoteboardElement[],
  previous: NoteboardElement[],
) {
  const a = new Map(
      current.filter((el) => !el.isDeleted).map((el) => [el.id, el]),
    ),
    b = new Map(
      previous.filter((el) => !el.isDeleted).map((el) => [el.id, el]),
    );
  return {
    added: [...b.keys()].filter((id) => !a.has(id)),
    removed: [...a.keys()].filter((id) => !b.has(id)),
    changed: [...b.keys()].filter(
      (id) =>
        a.has(id) && JSON.stringify(a.get(id)) !== JSON.stringify(b.get(id)),
    ),
  };
}
