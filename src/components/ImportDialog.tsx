import { useState } from "react";
import type { NoteboardElement } from "../elements/types";
import { combineBounds, getElementBounds } from "../elements/bounds";
import { MAX_BOARD_ELEMENTS } from "../session";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { NoteboardPreview } from "./NoteboardPreview";
export function ImportDialog({
  elements,
  currentCount,
  readOnly,
  onApply,
  onClose,
}: {
  elements: NoteboardElement[];
  currentCount: number;
  readOnly: boolean;
  onApply: (merge: boolean) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const active = elements.filter((el) => !el.isDeleted),
    bounds = combineBounds(active.map(getElementBounds));
  const images = active.filter((el) => el.type === "image"),
    bytes = images.reduce(
      (sum, el) => sum + (el.type === "image" ? el.dataUrl.length * 0.75 : 0),
      0,
    );
  const apply = (merge: boolean) => {
    try {
      onApply(merge);
    } catch (err) {
      setError(String(err));
    }
  };
  return (
    <WorkspaceDialog title="Import board preview" onClose={onClose}>
      <p>
        {active.length} objects; {elements.length - active.length} deleted
        records.
      </p>
      <p>
        Bounds: {Math.round(bounds[2] - bounds[0])} ×{" "}
        {Math.round(bounds[3] - bounds[1])}. Images: {images.length},
        approximately {Math.ceil(bytes / 1024)} KiB.
      </p>
      <p>
        Board limit: {MAX_BOARD_ELEMENTS.toLocaleString()} objects. Import
        passed structure, image-data and coordinate validation.
      </p>
      {active.some((el) => el.hidden) && (
        <p>Hidden objects remain hidden after import.</p>
      )}
      {images.some(
        (el) => el.type === "image" && el.assetId && !el.dataUrl,
      ) && <p>Some images require the host media resolver.</p>}
      <NoteboardPreview elements={elements} height={220} />
      {error && <p role="alert">{error}</p>}
      <button
        style={{ minHeight: 44, margin: 4 }}
        disabled={readOnly || currentCount + active.length > MAX_BOARD_ELEMENTS}
        onClick={() => apply(true)}
      >
        Merge imported objects
      </button>
      <button
        style={{ minHeight: 44, margin: 4 }}
        disabled={readOnly}
        onClick={() => apply(false)}
      >
        Replace board
      </button>
      <button style={{ minHeight: 44, margin: 4 }} onClick={onClose}>
        Cancel import
      </button>
    </WorkspaceDialog>
  );
}
