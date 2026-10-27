import type {
  NoteboardElement,
  Point,
  ImageElement,
  ElementBinding,
} from "./elements/types";
import { createElement } from "./elements/createElement";
import { isShapeElement } from "./elements/types";
import { updateBoundElements } from "./elements/connectorBinding";

export interface ObjectLink {
  kind: "url" | "object" | "reference";
  target: string;
}
export interface ConnectionPort {
  id: string;
  name: string;
  point: Point;
  accepts: ("line" | "arrow")[];
}
export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DocumentCard {
  documentId: string;
  revision: string;
  title: string;
  fallback: string;
  stale?: boolean;
}
export interface CalculationCard {
  version: number;
  expression: string;
  variables: Record<string, number>;
  result: string;
}
export interface BoardMediaAsset {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}
export interface BoardContentAdapter {
  /** Permission revocations from the host. Blocked excerpts are also excluded from undo and exports. */
  deniedDocumentIds?: readonly string[];
  navigate?(link: ObjectLink): void | Promise<void>;
  resolveDocument?(
    reference: DocumentCard,
    signal: AbortSignal,
  ): Promise<DocumentCard | null>;
  openCalculation?(
    calculation: CalculationCard,
    signal: AbortSignal,
  ): Promise<CalculationCard | null>;
  pickMedia?(signal: AbortSignal): Promise<BoardMediaAsset | null>;
  resolveMedia?(
    assetId: string,
    signal: AbortSignal,
  ): Promise<BoardMediaAsset | null>;
}
export function validateObjectLink(link: unknown): ObjectLink {
  const l = link as ObjectLink;
  if (
    !l ||
    !["url", "object", "reference"].includes(l.kind) ||
    typeof l.target !== "string" ||
    !l.target.trim() ||
    l.target.length > 4096
  )
    throw new Error("Invalid object link");
  if (l.kind === "url") {
    let url: URL;
    try {
      url = new URL(l.target);
    } catch {
      throw new Error("Enter a complete https, http or mailto URL");
    }
    if (!["https:", "http:", "mailto:"].includes(url.protocol))
      throw new Error("Unsupported link scheme");
  }
  return { kind: l.kind, target: l.target };
}
export function validateElementMetadata(value: Record<string, unknown>) {
  if (value.link !== undefined) validateObjectLink(value.link);
  if (value.ports !== undefined) {
    if (!Array.isArray(value.ports) || value.ports.length > 32)
      throw new Error("Use at most 32 ports");
    const ids = new Set();
    for (const port of value.ports as ConnectionPort[]) {
      if (
        !port ||
        typeof port.id !== "string" ||
        !port.id ||
        port.id.length > 256 ||
        typeof port.name !== "string" ||
        port.name.length > 256 ||
        ids.has(port.id) ||
        !port.point ||
        ![port.point.x, port.point.y].every(
          (n) => Number.isFinite(n) && n >= 0 && n <= 1,
        ) ||
        !Array.isArray(port.accepts) ||
        !port.accepts.length ||
        !port.accepts.every((t) => t === "line" || t === "arrow")
      )
        throw new Error("Invalid connection port");
      ids.add(port.id);
    }
  }
  if (value.crop !== undefined) {
    const c = value.crop as ImageCrop;
    if (
      !c ||
      ![c.x, c.y, c.width, c.height].every(
        (n) => Number.isFinite(n) && n >= 0 && n <= 1,
      ) ||
      c.width <= 0 ||
      c.height <= 0 ||
      c.x + c.width > 1.000001 ||
      c.y + c.height > 1.000001
    )
      throw new Error("Crop must be inside the source image");
  }
  if (
    value.mask !== undefined &&
    !["rectangle", "ellipse"].includes(value.mask as string)
  )
    throw new Error("Invalid image mask");
  if (
    value.assetId !== undefined &&
    (typeof value.assetId !== "string" ||
      !value.assetId ||
      value.assetId.length > 256)
  )
    throw new Error("Invalid asset reference");
  if (value.documentCard !== undefined) {
    const d = value.documentCard as DocumentCard;
    if (
      !d ||
      !["documentId", "revision", "title", "fallback"].every(
        (k) =>
          typeof d[k as keyof DocumentCard] === "string" &&
          String(d[k as keyof DocumentCard]).length <= 10000,
      ) ||
      !d.documentId
    )
      throw new Error("Invalid document reference");
  }
  if (value.calculation !== undefined) {
    const c = value.calculation as CalculationCard;
    if (
      !c ||
      !Number.isInteger(c.version) ||
      c.version < 1 ||
      typeof c.expression !== "string" ||
      c.expression.length > 10000 ||
      typeof c.result !== "string" ||
      c.result.length > 10000 ||
      !c.variables ||
      typeof c.variables !== "object" ||
      Object.keys(c.variables).length > 100 ||
      !Object.entries(c.variables).every(
        ([key, v]) => /^[a-zA-Z][\w]{0,63}$/.test(key) && Number.isFinite(v),
      )
    )
      throw new Error("Invalid calculation definition");
  }
}
export function setImageCrop(
  image: ImageElement,
  crop?: ImageCrop,
  mask: "rectangle" | "ellipse" = "rectangle",
): ImageElement {
  validateElementMetadata({ crop, mask });
  return { ...image, crop, mask };
}
export function bindConnectionPort(
  elements: NoteboardElement[],
  connectorId: string,
  endpoint: "start" | "end",
  targetId: string,
  portId: string,
): NoteboardElement[] {
  const connector = elements.find((el) => el.id === connectorId),
    target = elements.find((el) => el.id === targetId),
    port = target?.ports?.find((p) => p.id === portId);
  if (
    !connector ||
    (connector.type !== "line" && connector.type !== "arrow") ||
    connector.locked ||
    connector.isDeleted ||
    !target ||
    !isShapeElement(target) ||
    target.hidden ||
    target.isDeleted ||
    !port ||
    !port.accepts.includes(connector.type)
  )
    throw new Error("This port does not accept the connection");
  const binding: ElementBinding = {
    elementId: targetId,
    portId,
    fixedPoint: { ...port.point },
  };
  return updateBoundElements(
    elements.map((el) =>
      el.id === connectorId
        ? { ...connector, [endpoint + "Binding"]: binding }
        : el,
    ),
  );
}
export function createDocumentCard(
  reference: DocumentCard,
  point: Point,
): NoteboardElement {
  validateElementMetadata({ documentCard: reference });
  return createElement("rectangle", {
    ...point,
    width: 280,
    height: 180,
    fillStyle: "solid",
    backgroundColor: "#e0f2fe",
    documentCard: reference,
    text: reference.title + "\n" + reference.fallback,
  });
}
export function createCalculationCard(
  calculation: CalculationCard,
  point: Point,
): NoteboardElement {
  validateElementMetadata({ calculation });
  return createElement("rectangle", {
    ...point,
    width: 280,
    height: 140,
    fillStyle: "solid",
    backgroundColor: "#ede9fe",
    calculation,
    text: calculation.expression + "\n= " + calculation.result,
  });
}

/** Remove resolved bytes before persistence; retain one asset reference per image. */
export function referenceMedia(
  elements: NoteboardElement[],
): NoteboardElement[] {
  return elements.map((el) =>
    el.type === "image" && el.assetId ? { ...el, dataUrl: "" } : el,
  );
}
/** Resolve before mounting or exporting a host document; a denied result clears every saved excerpt. */
export async function resolveDocumentCards(
  elements: NoteboardElement[],
  adapter: BoardContentAdapter,
  signal: AbortSignal,
): Promise<NoteboardElement[]> {
  if (!adapter.resolveDocument)
    throw new Error("Document resolver is unavailable");
  const cache = new Map<string, Promise<DocumentCard | null>>();
  for (const el of elements)
    if (el.documentCard && !cache.has(el.documentCard.documentId))
      cache.set(
        el.documentCard.documentId,
        adapter.resolveDocument(el.documentCard, signal),
      );
  const resolved = new Map<string, DocumentCard | null>();
  for (const [id, promise] of cache) {
    const card = await promise;
    if (signal.aborted) throw new Error("Document resolution cancelled");
    if (card) {
      validateElementMetadata({ documentCard: card });
      if (card.documentId !== id)
        throw new Error("Document resolver returned a different document");
    }
    resolved.set(id, card);
  }
  return elements.map((el) => {
    if (!el.documentCard) return el;
    const card = resolved.get(el.documentCard.documentId);
    return {
      ...el,
      documentCard: card ?? {
        ...el.documentCard,
        title: "Document unavailable",
        fallback: "",
        stale: true,
      },
      ...("text" in el
        ? {
            text: card
              ? card.title + "\n" + card.fallback
              : "Document unavailable",
          }
        : {}),
    };
  });
}
export async function resolveBoardMedia(
  elements: NoteboardElement[],
  adapter: BoardContentAdapter,
  signal: AbortSignal,
): Promise<NoteboardElement[]> {
  const cache = new Map<string, Promise<BoardMediaAsset | null>>();
  for (const el of elements)
    if (el.type === "image" && el.assetId && !cache.has(el.assetId)) {
      if (!adapter.resolveMedia)
        throw new Error("Media resolver is unavailable");
      cache.set(el.assetId, adapter.resolveMedia(el.assetId, signal));
    }
  const resolved = new Map<string, BoardMediaAsset | null>();
  for (const [id, promise] of cache) {
    const asset = await promise;
    if (signal.aborted) throw new Error("Media resolution cancelled");
    if (
      asset &&
      (!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(asset.dataUrl) ||
        asset.dataUrl.length > 8 * 1024 * 1024)
    )
      throw new Error(
        "Media resolver must return a bounded embedded raster image",
      );
    resolved.set(id, asset);
  }
  return elements.map((el) =>
    el.type === "image" && el.assetId
      ? { ...el, dataUrl: resolved.get(el.assetId)?.dataUrl ?? "" }
      : el,
  );
}
