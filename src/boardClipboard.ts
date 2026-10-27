import type { NoteboardElement, Point } from "./elements/types";
import { deserializeBoard, MAX_BOARD_IMPORT_BYTES } from "./session";
import { createLibraryEntry, insertLibraryEntry } from "./boardWorkflows";
import { exportBoardSvg } from "./exportDocument";
export const BOARD_CLIPBOARD_MIME = "application/vnd.noteboard+json";
export function serializeBoardClipboard(
  elements: NoteboardElement[],
  ids: Iterable<string>,
): string {
  return JSON.stringify({
    version: 1,
    elements: createLibraryEntry(elements, ids, "Clipboard").elements,
  });
}
export function parseBoardClipboard(
  text: string,
  origin: Point,
): NoteboardElement[] {
  if (text.length > MAX_BOARD_IMPORT_BYTES)
    throw new Error("Clipboard exceeds 16 MiB");
  const value = JSON.parse(text);
  if (value.version !== 1)
    throw new Error("Unsupported board clipboard version");
  return insertLibraryEntry(
    {
      id: "clipboard",
      name: "Clipboard",
      kind: "symbol",
      version: 1,
      elements: deserializeBoard(value).elements,
    },
    origin,
  );
}
export async function writeBoardClipboard(
  elements: NoteboardElement[],
  ids: Iterable<string>,
): Promise<void> {
  const json = serializeBoardClipboard(elements, ids),
    selected = deserializeBoard(JSON.parse(json)).elements;
  const text = selected
    .map((el) =>
      "text" in el
        ? el.text
        : "label" in el
          ? el.label
          : el.displayName || el.type,
    )
    .filter(Boolean)
    .join("\n");
  const svg = await exportBoardSvg(selected);
  const data: Record<string, Blob> = {
    "text/plain": new Blob([text], { type: "text/plain" }),
  };
  const custom = "web " + BOARD_CLIPBOARD_MIME;
  if (typeof ClipboardItem !== "undefined" && ClipboardItem.supports?.(custom))
    data[custom] = new Blob([json], { type: BOARD_CLIPBOARD_MIME });
  else
    data["text/plain"] = new Blob(["noteboard:v1\n" + json], {
      type: "text/plain",
    });
  if (
    typeof ClipboardItem !== "undefined" &&
    ClipboardItem.supports?.("image/svg+xml")
  )
    data["image/svg+xml"] = new Blob([svg], { type: "image/svg+xml" });
  if (!navigator.clipboard?.write)
    throw new Error("Clipboard writing is unavailable. Use JSON export.");
  await navigator.clipboard.write([new ClipboardItem(data)]);
}
export async function readBoardClipboard(
  origin: Point,
): Promise<NoteboardElement[]> {
  if (!navigator.clipboard?.read)
    throw new Error("Clipboard reading is unavailable. Use JSON import.");
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const custom = "web " + BOARD_CLIPBOARD_MIME;
    if (item.types.includes(custom))
      return parseBoardClipboard(
        await (await item.getType(custom)).text(),
        origin,
      );
    if (item.types.includes("text/plain")) {
      const text = await (await item.getType("text/plain")).text();
      if (text.startsWith("noteboard:v1\n"))
        return parseBoardClipboard(text.slice(13), origin);
    }
  }
  throw new Error(
    "No Noteboard objects in the clipboard. Paste images with the normal paste shortcut.",
  );
}
