# Changelog

All notable changes to `@sunaissu/noteboard` will be documented here.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.0.0] — 2026-08-26

### Changed

- **Outline connector snapping** — Lines and arrows now snap both endpoints to the actual rendered outline of rectangles, ellipses, diamonds, triangles, stars, sticky notes, and callouts, including rotated shapes.
- **Self-contained icon runtime** — Toolbar and panel icons are bundled into Noteboard, so consumers no longer need to install `@phosphor-icons/react` separately and the CommonJS entry remains compatible with Node 18.

### Removed

- **Frame authoring (breaking)** — Removed Frame from the public authoring-tool types, tool registry, keyboard shortcuts, and properties UI. Existing serialized frame elements remain supported for rendering and persistence compatibility.

### Fixed

- **Persistent connections** — Snapped endpoint bindings are serialized and follow their target as it moves, resizes, or rotates. Repositioning a connector endpoint can attach or detach it cleanly, and deleting a target clears the stale binding.
- **Binding-aware duplication** — Copying or duplicating connectors and their targets remaps endpoint bindings to the duplicated targets instead of reconnecting the copies to the originals.
- **Callout interaction geometry** — Callout tails now participate in hit testing, marquee bounds, rotation, and connector snapping using the same geometry as the renderer.
- **Read-only interaction guards** — Read-only boards ignore keyboard, clipboard, and in-progress text mutations while retaining navigation and view shortcuts.
- **Controlled canvas crash** — Host callbacks now run outside React state updater functions, preventing synchronous Yjs/parent updates from causing render-phase client errors.
- **Advanced tool crashes** — Sticky Note and Callout creation, sizing, rendering, and hit testing are fully dispatched, and their renderers keep the canvas state stack balanced.

---

## [1.3.0] — 2026-08-03

### Added

- **`ref.setViewport()`** — Host applications can now imperatively pan and zoom a board. Invalid coordinates fall back safely and zoom is clamped to the supported range.
- **Package scripts for playground development** — `npm run playground` and `npm run playground:build` now work from the package root.
- **Optional Yjs adapter** — `@sunaissu/noteboard/yjs` maps controlled board elements, z-order, and viewport state to conflict-free Yjs collections.
- **Controlled viewport** — `viewport` can now be driven alongside `onViewportChange`, including through the Yjs adapter for synchronized pan and zoom.
- **Viewport validation** — Controlled and collaborative viewport values are finite and zoom is clamped before reaching the renderer.

### Changed

- **Functional playground zoom presets** — The 50%, 100%, 150%, and 200% buttons now drive the public viewport API instead of acting as placeholders.
- **Lean published package** — Build-tool transitive dependencies are no longer declared as runtime dependencies.
- **React compatibility** — Package declarations and the playground are built against React 18 while retaining support for React 18 and newer.
- **Controlled element initialization** — An initial `elements` prop now hydrates the board immediately instead of waiting for a later reference change.

---

## [1.2.1] — 2026-06-09

### Added

- **"View only" badge** — When `readOnly={true}`, a frosted-glass pill badge appears at the top-center of the canvas with an eye icon and "View only" label. The badge adapts to the current theme (dark/light), is non-interactive (`pointerEvents: none`), and sits above all canvas content.

### Changed

- **Read-only is now prop-only** — The Read-only toggle has been removed from the ☰ settings panel. `readOnly` is intended to be controlled by the host application, not toggled from inside the board. The "View only" badge above communicates the state to end users instead.

---


## [1.2.0] — 2026-06-09


### Added

- **Connector snapping** — While drawing a `line` or `arrow`, the free endpoint snaps to 9 anchor points on nearby shapes (4 edges, 4 corners, center) when within 20 canvas-space pixels. A purple ring highlights the active snap target; the highlight is cleared on pointer up.
- **Undo / Redo toolbar buttons** — ↩ / ↪ buttons now appear as a leading group in the toolbar strip. They are dimmed (opacity 0.4) when no history is available and activate on click. Wired to the existing `useHistory` hook.
- **Right-click context menu** — Right-clicking the canvas opens a styled context menu with: Copy, Paste, Duplicate, Bring Forward, Send Backward, Bring to Front, Send to Back, Select All, and Delete. Closes on outside click or `Escape`.
- **Keyboard shortcut cheatsheet** — Press `?` at any time (or the `?` button in ☰ → Keyboard Shortcuts) to open a two-column modal listing all shortcuts by category. Closes on `Escape` or backdrop click.
- **`onViewportChange` prop** — `NoteboardProps` now accepts `onViewportChange?: (viewport: NoteboardViewport) => void`. Fires via a `useEffect` whenever pan or zoom changes.
- **`ref.setElements()`** — `NoteboardRef` gains `setElements(elements: NoteboardElement[]): void` for imperative board state replacement.
- **Per-tool cursor shapes** — `line`/`arrow` tools now show a `cell` cursor (cross + plus, hinting connection intent); shape tools use `crosshair`; `text` uses `text`; `pan` uses `grab`/`grabbing`.
- **Focus ring** — The canvas container shows a `2px solid #7c5cff` outline when it has keyboard focus, improving accessibility.

### Changed

- **Playground** — Zoom percentage is now displayed live via `onViewportChange`. A collapsible 🎨 Theme section exposes color pickers for canvas background, stroke color, and panel color with instant live preview.

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
