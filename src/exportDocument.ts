import type { NoteboardElement } from "./elements/types";
import { combineBounds, getElementBounds } from "./elements/bounds";
import { exportBoardImage, type BoardImageOptions } from "./exportImage";
import { renderElement } from "./renderer";
import { createSvgContext } from "./svgContext";

export interface BoardPdfOptions extends BoardImageOptions {
  paper?: "content" | "a4" | "letter" | { width: number; height: number };
  orientation?: "portrait" | "landscape";
  margin?: number;
  paginate?: boolean;
  mode?: "vector" | "raster";
  /** Register embedded fonts before rendering non-Latin text. Units are points. */
  configurePdf?: (pdf: import("jspdf").jsPDF) => void | Promise<void>;
}

export function pdfPagePlan(
  width: number,
  height: number,
  options: BoardPdfOptions = {},
) {
  const scale = options.scale ?? 1,
    margin = options.margin ?? 24;
  if (
    ![width, height, scale].every((n) => Number.isFinite(n) && n > 0) ||
    !Number.isFinite(margin) ||
    margin < 0
  )
    throw new Error("Invalid PDF dimensions or scale");
  let paper = options.paper ?? "content";
  let w: number, h: number;
  if (paper === "content") {
    w = width * scale + margin * 2;
    h = height * scale + margin * 2;
  } else if (paper === "a4") {
    w = 595.28;
    h = 841.89;
  } else if (paper === "letter") {
    w = 612;
    h = 792;
  } else {
    w = paper.width;
    h = paper.height;
  }
  if (options.orientation === "landscape" && w < h) [w, h] = [h, w];
  if (options.orientation === "portrait" && w > h) [w, h] = [h, w];
  if (![w, h].every((n) => Number.isFinite(n) && n > margin * 2 && n <= 14400))
    throw new Error(
      "Paper must exceed its margins and be at most 14400 points per side",
    );
  const effective = options.paginate
    ? scale
    : Math.min(scale, (w - margin * 2) / width, (h - margin * 2) / height);
  const columns = options.paginate
      ? Math.ceil((width * effective) / (w - margin * 2))
      : 1,
    rows = options.paginate
      ? Math.ceil((height * effective) / (h - margin * 2))
      : 1;
  if (columns * rows > 100)
    throw new Error(
      "PDF export is limited to 100 pages. Reduce the scale or choose larger paper.",
    );
  return { width: w, height: h, margin, scale: effective, columns, rows };
}

/** Vector paths and selectable text, with bounded paper tiling. */
export async function exportBoardPdf(
  elements: NoteboardElement[],
  options: BoardPdfOptions = {},
): Promise<Blob> {
  const markup = await exportBoardSvg(elements, options);
  const svg = new DOMParser().parseFromString(
    markup,
    "image/svg+xml",
  ).documentElement;
  const [left, top, width, height] = svg
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  const plan = pdfPagePlan(width, height, options);
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");
  const pdf = new jsPDF({
    unit: "pt",
    format: [plan.width, plan.height],
    orientation: plan.width > plan.height ? "landscape" : "portrait",
    compress: true,
  });
  if (options.configurePdf) await options.configurePdf(pdf);
  const raster =
    options.mode === "raster"
      ? await exportBoardImage(elements, "png", {
          ...options,
          selectedIds: exportSelection(elements, options.selectedIds),
        })
      : null;
  for (let row = 0; row < plan.rows; row++)
    for (let col = 0; col < plan.columns; col++) {
      if (row || col)
        pdf.addPage(
          [plan.width, plan.height],
          plan.width > plan.height ? "landscape" : "portrait",
        );
      const viewWidth = (plan.width - plan.margin * 2) / plan.scale,
        viewHeight = (plan.height - plan.margin * 2) / plan.scale;
      if (raster) {
        pdf.saveGraphicsState();
        pdf.rect(
          plan.margin,
          plan.margin,
          plan.width - plan.margin * 2,
          plan.height - plan.margin * 2,
        );
        pdf.clip();
        pdf.discardPath();
        pdf.addImage(
          raster,
          "PNG",
          plan.margin - col * viewWidth * plan.scale,
          plan.margin - row * viewHeight * plan.scale,
          width * plan.scale,
          height * plan.scale,
        );
        pdf.restoreGraphicsState();
      } else {
        const page = svg.cloneNode(true) as Element;
        page.setAttribute(
          "viewBox",
          `${left + col * viewWidth} ${top + row * viewHeight} ${viewWidth} ${viewHeight}`,
        );
        page.setAttribute("width", String(plan.width - plan.margin * 2));
        page.setAttribute("height", String(plan.height - plan.margin * 2));
        page.setAttribute("preserveAspectRatio", "none");
        await svg2pdf(page, pdf, {
          x: plan.margin,
          y: plan.margin,
          width: plan.width - plan.margin * 2,
          height: plan.height - plan.margin * 2,
          loadExternalStyleSheets: false,
          loadImages: /^data:image\/(png|jpeg|gif|webp);base64,/i,
        });
      }
    }
  return pdf.output("blob");
}

/** Expand a selected frame to include its visible children. */
export function exportSelection(
  elements: NoteboardElement[],
  ids?: string[],
): string[] | undefined {
  if (!ids) return undefined;
  const selected = new Set(ids),
    lookup = new Map(elements.map((el) => [el.id, el])),
    queue = [...ids];
  for (let i = 0; i < queue.length; i++) {
    const el = lookup.get(queue[i]);
    if (el?.type === "frame")
      for (const id of el.childIds ?? [])
        if (!selected.has(id)) {
          selected.add(id);
          queue.push(id);
        }
  }
  return [...selected];
}

export async function exportBoardSvg(
  elements: NoteboardElement[],
  options: BoardImageOptions = {},
): Promise<string> {
  const selectedIds = exportSelection(elements, options.selectedIds),
    selected = selectedIds && new Set(selectedIds);
  // Validate options and wait for images using the same path as PNG export.
  await exportBoardImage(elements, "png", {
    ...options,
    selectedIds,
    scale: 1,
  });
  const active = elements.filter(
    (el) => !el.isDeleted && !el.hidden && (!selected || selected.has(el.id)),
  );
  const padding = options.padding ?? 24;
  const [l, t, r, b] = combineBounds(
    active.map((el) => {
      const box = getElementBounds(el),
        m =
          padding +
          el.strokeWidth / 2 +
          (el.dropShadow?.blur ?? 0) +
          Math.max(
            Math.abs(el.dropShadow?.offsetX ?? 0),
            Math.abs(el.dropShadow?.offsetY ?? 0),
          );
      return [box[0] - m, box[1] - m, box[2] + m, box[3] + m];
    }),
  );
  const recorder = createSvgContext();
  if (options.background && options.background !== "transparent") {
    recorder.context.fillStyle = options.background;
    recorder.context.fillRect(l, t, Math.max(1, r - l), Math.max(1, b - t));
  }
  for (const el of active) renderElement(recorder.context, el);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, r - l)}" height="${Math.max(1, b - t)}" viewBox="${l} ${t} ${Math.max(1, r - l)} ${Math.max(1, b - t)}" role="img" aria-label="Exported Noteboard">${recorder.markup()}</svg>`;
}
