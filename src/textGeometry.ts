import type { NoteboardElement, TextElement } from "./elements/types";
let context: CanvasRenderingContext2D | null = null;
/** Shared standalone-text measurement after content or typography changes. */
export function measureTextElement(element: TextElement): TextElement {
  if (typeof document === "undefined") return element;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return element;
  context.font = `${element.fontStyle ?? "normal"} ${element.fontWeight ?? "normal"} ${element.fontSize}px ${element.fontFamily}`;
  const lines = element.text.split("\n");
  let width = 1;
  for (const line of lines)
    width = Math.max(width, context.measureText(line).width);
  return {
    ...element,
    width,
    height:
      Math.max(1, lines.length) *
      element.fontSize *
      (element.lineHeight ?? 1.25),
  };
}
export function refreshTextGeometry(
  previous: NoteboardElement[],
  next: NoteboardElement[],
): NoteboardElement[] {
  const before = new Map(previous.map((el) => [el.id, el]));
  const fields = [
    "text",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "fontStyle",
    "lineHeight",
  ] as const;
  let changed = false;
  const result = next.map((el) => {
    if (el.type !== "text") return el;
    const old = before.get(el.id);
    if (
      !old ||
      old.type !== "text" ||
      fields.some((key) => el[key] !== old[key])
    ) {
      const measured = measureTextElement(el);
      if (measured.width !== el.width || measured.height !== el.height) {
        changed = true;
        return measured;
      }
    }
    return el;
  });
  return changed ? result : next;
}

export function wrapShapeText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  const space = measure(" ");
  for (const paragraph of text.split("\n")) {
    let line = "",
      width = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const wordWidth = measure(word);
      if (wordWidth > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
          width = 0;
        }
        for (const char of word) {
          const cw = measure(char);
          if (line && width + cw > maxWidth) {
            lines.push(line);
            line = "";
            width = 0;
          }
          line += char;
          width += cw;
        }
        continue;
      }
      if (line && width + space + wordWidth > maxWidth) {
        lines.push(line);
        line = word;
        width = wordWidth;
      } else {
        width += (line ? space : 0) + wordWidth;
        line += (line ? " " : "") + word;
      }
    }
    lines.push(line);
  }
  return lines;
}
