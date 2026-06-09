# Changelog

All notable changes to `@sunaissu/noteboard` will be documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-05-18

### Added

- **Collapsible properties panel sections** — Every section in the Properties Panel (Appearance, Drop Shadow, Text, Line / Arrow, Pen, Shape, Frame) now has a clickable chevron header that collapses/expands its content. All sections default to open. Collapse state is local to the component and resets when a new element is selected.
- **Whole-panel collapse toggle** — A `▼ PROPERTIES (N)` title bar at the top of the Properties Panel lets users hide the entire panel body, leaving only a thin header strip. Useful when the panel is obscuring content on smaller canvases.
- **Dot-grid pattern** — The grid overlay (toggled via the ☰ menu → Show Grid) now renders as a modern dot-grid (small filled circles at each intersection) instead of full cross-hatch lines. Dots scale proportionally with zoom level.

### Fixed

- **Selection marquee outside canvas** — Releasing the mouse outside the canvas boundary while drawing a marquee selection now correctly commits the selection. Added a global `window` `pointerup` fallback listener with a `pointerUpHandledRef` guard to prevent double-execution on normal within-canvas events.
- **Drag regression caused by global pointer listener** — The global fallback listener introduced for the marquee fix was erroneously running alongside the canvas React handler, clearing interaction refs prematurely and breaking drag-to-move. Fixed by marking events as handled in the canvas `onPointerUp` so the window listener is skipped for all normal interactions.
- **Text section shown for bare shapes** — The Text section in the Properties Panel was appearing for any selected shape element, even shapes with no text content. It now only appears for standalone text elements or shapes that actually contain typed text (`hasShapeText`).
- **Grid not visible** — Grid line colors were set to near-transparent values (`rgba(0,0,0,0.07)` / `rgba(255,255,255,0.06)`), making the grid invisible in both themes. Updated to `0.15` (light) and `0.12` (dark) opacity.
- **Canvas scroll blocking** — The wheel event listener was calling `preventDefault()` on all scroll events over the board container, preventing page scrolling. Fixed to only intercept scroll when `Ctrl` / `Meta` is held (zoom gesture).

### Changed

- **PanelHeader layout** — The duplicate "Properties (N)" title row has been removed from the `PanelHeader` subcomponent (now owned by the panel-level title bar). The z-order buttons (bring forward/back/to-front/to-back), group, ungroup, and lock are consolidated into a single compact action row.

---

## [1.0.0] — 2026-05-13

### Added

- Initial release of `@sunaissu/noteboard`.
- Canvas drawing engine with support for: rectangles, ellipses, diamonds, triangles, stars/polygons, lines, arrows, freehand pen, text, images, frames, sticky notes, callouts.
- Properties Panel with sections for appearance (stroke/fill color, width, style, opacity, blend mode, corner radius), drop shadow, text typography, line/arrow routing & arrowheads, pen highlighter mode, frame labels, shape type toggle.
- Toolbar with configurable position (`top`, `bottom`, `left`, `right`) and custom slot support.
- Snap-to-grid, pan & zoom (mouse wheel, trackpad), undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`).
- Multi-select, group/ungroup (`Ctrl+G` / `Ctrl+Shift+G`), element locking, z-order controls.
- Alignment and distribution tools (align left/center/right/top/middle/bottom, distribute horizontally/vertically).
- Export canvas as PNG or JPEG; import/export board state as JSON.
- Dark mode and fully customizable theme via `NoteboardTheme` object.
- `NoteboardPreview` component for lightweight, zero-interaction static board thumbnails.
- Multiplayer-ready via controlled `elements` + `onElementsChange` props.
