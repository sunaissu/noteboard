# @sunaissu/noteboard

<p><img src="assets/brand/sunaissu.svg" alt="Sunaissu" width="104"></p>

> A highly customizable, responsive React whiteboard canvas for drawing, diagramming, and real-time collaboration.

[![npm version](https://img.shields.io/npm/v/@sunaissu/noteboard)](https://www.npmjs.com/package/@sunaissu/noteboard)
[![license](https://img.shields.io/npm/l/@sunaissu/noteboard)](./LICENSE)

---


## Workspace and host integrations

Settings > Board workspace contains Views, Library, Diagram, Objects, Styles, and Versions. The workspace is separate from board elements and undo history. Saved views and selection bookmarks are scoped to boardId. Templates and symbols normalize their origin, detach external connectors, and remap internal IDs on insertion. Library insertions, layouts, recognition replacements, style application, and restores each form one undo step.

Use the Diagram tab to preview flow or mind-map layout, import CSV columns id,label,target, recognize a selected pen stroke, or navigate an accessible relationship list. CSV accepts quoted fields and at most 500 nodes. Layout handles cycles and disconnected components and keeps locked objects fixed. Low-confidence strokes remain unchanged. Apply preview is blocked if the board changed since the preview was generated.

The Objects tab provides safe URL/object/reference links, named connection ports, non-destructive image crop/masks, and host-backed document, calculation, and media controls. Ports have stable IDs and accepted line/arrow types; deleting a port detaches its connections. ref.navigateToObject(id) returns false for a missing, deleted, or hidden object. Links open only through the explicit Open link action. Styles saves style-only presets and reports skipped fields; presets cannot replace IDs, geometry, or content.

### Persistent workspace and text recovery

Memoize storage adapters. The browser adapters are local examples; hosts can implement the same interfaces with their own storage.

```tsx
import { useMemo } from 'react';
import {
  Noteboard, createBrowserWorkspaceStorage, createBrowserTextDrafts,
} from '@sunaissu/noteboard';

function Workspace({ accountId, boardId }) {
  const workspaceStorage = useMemo(
    () => createBrowserWorkspaceStorage(accountId), [accountId],
  );
  const textDraftStorage = useMemo(
    () => createBrowserTextDrafts(accountId), [accountId],
  );
  return <Noteboard key={boardId} boardId={boardId}
    workspaceStorage={workspaceStorage} textDraftStorage={textDraftStorage} />;
}
```

Alternatively pass workspace and onWorkspaceChange for controlled state. normalizeWorkspace validates a board-scoped version-1 workspace and migrates the version-0 catalog envelope to version 1. Unsupported versions and mismatched boards fail visibly. Collections are limited to 200 entries and 16 MiB total. Do not change an account while retaining another account's adapter or component instance.

TextDraftStorage exposes load(boardId), save(intent), and remove(id). Each intent includes boardId, elementId, a local revision token, before/after text, and a timestamp. Saves run in order. Drafts remain until explicitly discarded or acknowledged by the host through remove; blur is not proof of durable host storage. Settings exposes retained drafts and save retry. Ctrl/Command+Escape cancels local text edits while retaining disjoint peer changes. Overlapping edits are left intact with a recovery notice. Normal Escape or Ctrl/Command+Enter commits. The local revision token is not an authoritative server revision; a host using durable revisions should reconcile it when acknowledging saves.

### Collaboration adapters

Pass awareness, comments, workshop, and versions independently. These interfaces carry host state; they are not a synchronization or authentication service.

- BoardAwarenessAdapter supplies self identity, getPeers, subscribe, and publish. Cursor/selection/editing presence is throttled, sessions expire after 15 seconds, laser samples expire after 1.5 seconds, and unmount publishes null. A local laser works without an adapter. Presence never enters board history or session exports.
- BoardCommentsAdapter supplies getThreads, subscribe, canComment, canResolve, and dispatch. Threads support anchored messages, replies, resolve/reopen, and fallback world positions when objects disappear. The host must update fallbackPoint as anchored objects move and enforce author/moderator permissions.
- BoardWorkshopAdapter supplies a server timestamp, revision, timer, and the current user's votes. dispatch must atomically check expectedRevision, authenticate the caller, enforce per-user limits across sessions, and deduplicate requestId. Before reveal, send only the current user's counts, never private totals. Timer display advances from a monotonic local clock using the most recent server timestamp.
- BoardVersionsAdapter supplies list, load, currentRevision, restore, and optional save. Restore must atomically compare expectedRevision on the host. The UI previews object differences and blocks changed local content. Read-only users can compare but cannot restore.

createLocalBoardRoom provides an in-memory implementation for examples and tests, including voting enforcement, moderator controls, comments, expiry, and disconnect. Connect each local session, call syncElements after board changes, and disconnect when the session ends. It has no network or durable persistence. The playground uses it and browser storage so the controls can be tried locally.

To present, save and order viewpoints, then Start presentation. Previous/Next controls remain on the canvas. Share my camera broadcasts the presenter viewport; viewers must explicitly Follow a presenter. Local camera movement stops following. Reconnect does not opt anyone in.

### Documents, calculations and media

BoardContentAdapter supplies optional navigate, resolveDocument, openCalculation, pickMedia, and resolveMedia callbacks. Async callbacks receive AbortSignal; late insertion after read-only or unmount is discarded. The host handles authentication, authorization and source navigation.

Document cards store an allowed fallback excerpt, source ID and revision. resolveDocument returns null when access is denied. Refresh then removes the excerpt, and the board filters it from subsequent undo and export. Update contentAdapter.deniedDocumentIds when the host receives permission revocations; this also protects read-only boards. Before hydrating or exporting outside the component, call resolveDocumentCards against the current user's permissions. Do not store restricted excerpts in a public board snapshot. An offline client can display only a fallback the host has authorized it to retain.

Calculation cards store a versioned expression, variables and readable result. openCalculation reopens or recalculates using the host's calculator engine; the board never evaluates arbitrary JavaScript. Unsupported versions remain readable and are not edited. The playground uses the sibling calculator's expression engine.

Media objects can carry assetId. referenceMedia(elements) removes resolved image bytes for host persistence. resolveBoardMedia fetches each unique asset once, returns embedded raster data for rendering/portable export, and clears unavailable assets. Missing images fail export visibly. Persist references when storage deduplication matters; use resolved elements for portable JSON, SVG and image exports. The package does not fetch arbitrary remote URLs. Hosts should cache asset resolution and refresh it when permissions or URLs change.

### Export and clipboard

```ts
const pdf = await exportBoardPdf(elements, {
  paper: 'a4', paginate: true, scale: 1, margin: 24, mode: 'vector',
});
const custom = await exportBoardPdf(elements, {
  paper: { width: 720, height: 540 }, mode: 'raster',
});
```

The PDF libraries load on demand. Vector conversion uses the board-generated SVG through [svg2pdf.js](https://github.com/yWorks/svg2pdf.js); custom fonts can be registered through [jsPDF](https://parallax.github.io/jsPDF/docs/jsPDF.html). Image mode is available when PDF vector font/effect support differs from the canvas.

Commands > Copy selection to system clipboard writes versioned board data, plain text, and SVG where the browser supports those formats. Commands > Paste board objects validates and remaps internal relationships. Browsers without custom clipboard formats receive a versioned text envelope. Normal paste still accepts raster images. Permission failures appear in Settings. JSON import now previews counts, bounds, images and limits, with explicit merge/replace/cancel actions.

### Migration and review

The new optional element fields are link, ports, binding.portId, crop, mask, assetId, documentCard and calculation. Old JSON without them still loads. Coordinate, image, crop, link, port and payload validation runs during import. Updated clients must be used together when these fields affect shared boards. Back up authoritative state and workspace catalogs before rollout; retain the previous backup for a coordinated rollback rather than reconnecting older clients to a changed live schema. Yjs text migration still requires migrateNoteboardText as described below.

Local suites cover Chrome, Firefox and Playwright WebKit, keyboard/touch workflows, host failure simulation and performance fixtures. See `qa/README.txt` in the repository for instructions. Physical-device, screen-reader and production-provider checks remain release gates; local adapters do not certify a deployed service.

## Keyboard Canvas and board tools

Select a drawing tool to open its defaults immediately. Defaults apply to new objects of that tool type; select an existing object to change its properties. Tool defaults last for the current board mount.

Open Settings for Keyboard Canvas, Layers and frames, Board workspace, Collaboration and workshop, Commands, Export preview, and finger drawing. Ctrl+K, or Command+K on Mac, opens the command palette while the canvas has focus. It searches tools and actions, including frames and connected shapes.

### Keyboard Canvas

Toggle this mode with Ctrl+Shift+Backquote, or Command+Shift+Backquote on Mac. The Settings button provides an alternative if the OS, browser, or keyboard layout reserves that shortcut. A visible cursor and live status announcements identify the current action.

| Key | Action in Keyboard Canvas |
| --- | --- |
| Arrow keys | Move the virtual cursor by 10 screen pixels. |
| Shift + arrows | Move by 1 screen pixel. |
| Alt + arrows | Move by up to 80 screen pixels, stopping at the next visible object's bounds when no drawing is in progress. |
| Ctrl/Command + arrows | Pan the view. |
| Space | Set a drawing start point, then finish at the cursor. Shapes require width and height; repeating Space at the same point creates nothing. With Select, select the object under the cursor. With Image, open the file picker. |
| Shift + Space | Toggle the object under the cursor in the selection. |
| Tab / Shift + Tab | Select the next/previous visible object, wrapping at the ends. Deleted and hidden objects are skipped. Locked objects remain discoverable. |
| A | Toggle additive selection, so Tab adds objects to the selection. |
| Enter | Edit a selected shape's text or a text object. For other object types, open properties. |
| Ctrl/Command + Enter | Finish text editing and return focus to the canvas. |
| M / Shift + S | Move / resize the selection with arrows. Enter finishes the operation; one undo restores the whole keyboard operation. Resize applies to area objects. Connector endpoints have numeric controls in properties; bend handles accept arrow keys. |
| P / L | Focus properties / open layers. Escape in these controls returns to the canvas. |
| Ctrl/Command + Alt + arrows | Add a connected shape in that direction. The command palette provides the same actions. |
| F / Shift + F | Fit the whole board / selection. |
| + / - | Zoom in / out. |
| Escape | Cancel an unfinished drawing, finish move/resize mode, or leave Keyboard Canvas. |
| F6 | Leave Keyboard Canvas so Tab can reach controls. Some browsers also move focus to browser controls. |

Tool-slot keys 1-9, copy/paste, duplicate, delete and undo/redo remain available. Shortcuts do not run while typing in inputs, composing text, or using a dialog. Press ? for help. Normal Tab navigation resumes when Keyboard Canvas is off.

### Layers, frames and connections

Layers lists frontmost objects first. Search, rename, hide, lock, reorder with buttons or dragging, and frame a selection. Hidden objects remain in JSON but do not render, export, or intercept canvas input. Visibility is an editing convenience, not an access-control boundary.

Use Frame selection or draw a Frame through the command palette. A drawn frame captures fully enclosed, visible, unlocked non-frame objects. Moving a frame carries its children; explicitly moved or locked children retain their own positions. Copying or duplicating a frame includes its editable contents and remaps their relationships. Deleting a frame leaves its contents on the board. Frame membership is explicit and does not change when a child crosses the frame border.

Selected shapes have four quick-connect buttons. These create a styled sibling and a bound arrow in one undo step. Elbow connectors reroute around visible shapes with 12 canvas units of clearance. Routing uses a bounded search; enclosed endpoints or very dense layouts can fall back to a plain elbow. A selected connector that still crosses an obstacle shows a fallback warning. Use bend handles or move an obstacle when needed. Manual bends remain editable by pointer or keyboard. Reset automatic route restores automatic routing. Editing endpoint coordinates detaches that endpoint and resets elbow routing.

### Touch and display sizes

One finger pans by default; a light tap with Select selects an object. Two fingers pan and pinch to zoom. A stylus draws with the active tool. Enable Draw with one finger in Settings, or pass defaultTouchDrawing, to draw with touch. Adding a second finger cancels an unfinished stroke before navigating. Stylus pressure is preserved, and touch input is ignored while the stylus is down.

Side properties become a compact horizontal panel below 600 CSS pixels. Dialogs scroll within the board; coarse-pointer controls use larger targets. Focus outlines and reduced-motion styles are included. The host must give Noteboard a usable height and should include a mobile viewport meta tag.

### Saving and restoring boards

The host app owns board persistence and recovery. Noteboard does not save board snapshots to browser storage, load a previous board, or show a recovery prompt. The playground starts with its sample board on each page load.

```tsx
import { useState } from 'react';
import { Noteboard, type NoteboardSession } from '@sunaissu/noteboard';

function Board({ session, save }: {
  session: NoteboardSession;
  save: (snapshot: NoteboardSession) => void;
}) {
  const [elements, setElements] = useState(session.elements);
  const [viewport, setViewport] = useState(session.viewport);
  return <Noteboard boardId={session.boardId} threadId={session.threadId}
    elements={elements} onElementsChange={setElements}
    viewport={viewport} onViewportChange={setViewport} onSave={save} />;
}
```

Load and validate saved data in the app with deserializeBoard before mounting. Remount this example with a board/account-specific key when switching boards. For autosave, persist changes from the controlled state in the app; the app also owns save status, retries, unsaved-change warnings, and any restore choice. onSave supplies the current session when the user chooses Save under Settings > Save Board. ref.getSession() and serializeBoard remain available for custom save flows.

The earlier recovery prop, createBrowserRecovery helper, and BoardRecoveryStorage type have been removed. Old noteboard:draft: entries are ignored. Optional workspace catalogs and text-intent adapters remain separate host integrations; they do not restore the whole board.

### Export preview

Settings > Export preview supports the whole board, current selection, or a frame with its contents. Choose PNG, JPEG, SVG, or PDF, inspect the preview, and download. Hidden and deleted objects are excluded. PNG/SVG support transparent backgrounds; JPEG/PDF use white when transparent is selected.

SVG uses the shared renderer's vector paths and text with embedded raster images. Fonts must be available in the viewer. PDF offers vector shapes and selectable text, A4/Letter/custom paper dimensions in points, scale, and tiling across up to 100 pages. Image mode preserves font and effect appearance. Vector mode uses jsPDF fonts; hosts can register embedded fonts with configurePdf for non-Latin text. Image output is capped at 16 megapixels and 8192 pixels per side. Exports wait for images and report loading failures.

```ts
import { exportBoardSvg, exportBoardPdf } from '@sunaissu/noteboard';

const svg = await exportBoardSvg(elements, { selectedIds: [frameId] });
const pdfBlob = await exportBoardPdf(elements, { background: '#ffffff' });
```

Compatibility: displayName, hidden and manualRoute are optional element fields. Existing JSON loads with the previous defaults. Older clients may ignore visibility and manual routing, so shared boards using these fields should use updated clients together. The existing Yjs text migration requirements still apply.

The automated reviews run on Windows in Chrome, Firefox and Playwright WebKit. They cover keyboard workflows, export decoding, host-owned board state and responsive phone/tablet dimensions. Chrome also exercises touch pan/pinch through browser input events. This does not certify physical iPhone, iPad, Android, macOS or Linux behavior, OS-reserved shortcuts, or screen-reader combinations. Run the host app on those devices before release.

## 🚀 Features

- **Rich Toolset** — Draw shapes (rectangles, ellipses, diamonds, triangles, stars/polygons), lines, auto-connecting arrows, text, freehand pen, and images.
- **Advanced Elements** — Built-in support for Sticky Notes and Callouts.
- **Persistent Connector Snapping** — Line and arrow endpoints snap anywhere along the visible outline of nearby shapes. Attachments follow the shape when it moves, resizes, or rotates and persist in saved or collaborative boards.
- **Smart Grouping & Locking** — Group shapes, lock elements in place, and control z-order.
- **Collapsible Properties Panel** — The entire panel can be collapsed to a thin header bar. Individual property sections (Appearance, Drop Shadow, Text, Line/Arrow, Pen, Shape) also collapse independently via chevron toggles.
- **Snap-to-Grid & Alignment Guides** — Dot-grid overlay, snap-to-grid, and smart alignment tools for precise layouts.
- **Undo / Redo Toolbar Buttons** — ↩ / ↪ buttons surface the full undo/redo history directly in the toolbar strip.
- **Right-Click Context Menu** — Copy, Paste, Duplicate, Bring Forward / Send Backward, Bring to Front / Send to Back, Select All, and Delete — all accessible via right-click anywhere on the canvas.
- **Keyboard Shortcut Cheatsheet** — Press `?` (or the `?` button in the ☰ menu) to open a modal listing every keyboard shortcut organized by category.
- **Board Management** — Export as PNG/JPEG, import/export state as JSON, toggle grid visibility, and clear the canvas with a confirmation prompt.
- **Theme Support** — Automatic system detection, explicit light/dark modes, and semantic color overrides.
- **Focus Ring** — The canvas shows a visible purple focus ring when it receives keyboard focus, aiding accessibility.
- **Read-Only Mode** — Lock the board to view-only with a single prop or toggle.
- **Multiplayer Ready** — Completely server-agnostic. Integrates with WebSockets or CRDTs via controlled `elements` + `onElementsChange` props.
- **Lightweight Previews** — `NoteboardPreview` renders a static, zero-interaction board thumbnail using the same rendering engine.

---

## 📦 Installation

```bash
npm install @sunaissu/noteboard
# or
yarn add @sunaissu/noteboard
# or
pnpm add @sunaissu/noteboard
```

---

## 💻 Quick Start

```tsx
import React, { useState } from 'react';
import { Noteboard } from '@sunaissu/noteboard';
import type { NoteboardElement } from '@sunaissu/noteboard';

export default function App() {
  const [elements, setElements] = useState<NoteboardElement[]>([]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Noteboard
        elements={elements}
        onElementsChange={setElements}
        defaultTheme="system"
        brandColors={{ primary: '#7c5cff', secondary: '#22a06b' }}
      />
    </div>
  );
}
```

---

## 🛠 Props API

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `'system' \| 'light' \| 'dark' \| NoteboardTheme` | `undefined` | Controlled theme mode. A full `NoteboardTheme` object remains supported as a legacy override. |
| `defaultTheme` | `'system' \| 'light' \| 'dark'` | `'system'` | Initial mode when `theme` is uncontrolled. |
| `brandColors` | `{ primary?: string; secondary?: string }` | `undefined` | Adapts active tools, focus, selection, badges, and supporting accents to the host app while preserving every theme mode. |
| `scrollbar` | `NoteboardScrollbarOptions` | `undefined` | Optional thumb/track colors and `width: 'auto' \| 'thin' \| 'none'` for scrollable board panels. Omit for native scrollbars. |
| `themeOverrides` | `Partial<NoteboardTheme>` | `undefined` | Change individual colors without disabling mode switching. |
| `onThemeChange` | `(theme: NoteboardThemeMode) => void` | `undefined` | Fires when Automatic, Light, or Dark is selected in board settings. Use it with a controlled `theme`. |
| `initialElements` | `NoteboardElement[]` | `[]` | Seed elements on first mount. Uncontrolled — ignored after mount. |
| `initialViewport` | `NoteboardViewport` | `undefined` | Seed pan & zoom on first mount (e.g. from a saved `NoteboardSession`). |
| `viewport` | `NoteboardViewport` | `undefined` | Fully controlled pan and zoom state. Use with `onViewportChange` for persistence or collaboration. |
| `elements` | `NoteboardElement[]` | `undefined` | Fully controlled elements array. Use alongside `onElementsChange` for real-time collaboration. |
| `onElementsChange` | `(elements: NoteboardElement[], previous?: NoteboardElement[]) => void` | `undefined` | Fires after every local draw, edit, move, or delete. Forward both arguments when wrapping a collaborative binding. |
| `onViewportChange` | `(viewport: NoteboardViewport) => void` | `undefined` | Fires whenever the user pans or zooms. Use to persist or broadcast the viewport. |
| `readOnly` | `boolean` | `undefined` | Controlled read-only mode — hides the toolbar, disables all editing interactions. |
| `defaultTouchDrawing` | `boolean` | `false` | Enable one-finger drawing initially. Two fingers still navigate. |
| `defaultReadOnly` | `boolean` | `false` | Initial read-only state (uncontrolled). |
| `onReadOnlyChange` | `(readOnly: boolean) => void` | `undefined` | Deprecated compatibility prop. Control `readOnly` from the host application. |
| `toolbarPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Position of the main toolbar. |
| `propertiesPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'left'` | Position of the properties panel. |
| `slots` | `ToolSlot[]` | `DEFAULT_SLOTS` | Customize which tools appear in the toolbar and their order. |
| `activeTool` | `Tool` | `undefined` | Controlled active tool. |
| `onToolSelect` | `(tool: Tool) => void` | `undefined` | Fires when the user switches tools. |
| `onSave` | `(session: NoteboardSession) => void` | `undefined` | Adds a Save button to the ☰ menu. Called with a full serialized snapshot. |
| `threadId` | `string` | `undefined` | Identifies the room/thread (used with collaboration integrations). |
| `boardId` | `string` | `undefined` | Identifies the board instance. |

---

## 🔧 Imperative API (`ref`)

Pass a `ref` to access the board imperatively:

```tsx
import { useRef } from 'react';
import { Noteboard } from '@sunaissu/noteboard';
import type { NoteboardRef } from '@sunaissu/noteboard';

function App() {
  const ref = useRef<NoteboardRef>(null);

  return (
    <>
      <Noteboard ref={ref} />
      <button onClick={() => console.log(ref.current?.getElements())}>Log elements</button>
      <button onClick={() => ref.current?.setElements([])}>Clear board</button>
      <button onClick={() => {
        const url = ref.current?.exportImage('png');
        window.open(url);
      }}>Export PNG</button>
    </>
  );
}
```

| Method | Signature | Description |
|---|---|---|
| `getElements()` | `() => NoteboardElement[]` | Returns the current live elements array. |
| `setElements()` | `(elements: NoteboardElement[]) => void` | Replaces elements through history and honors read-only mode. |
| `setViewport()` | `(viewport: NoteboardViewport) => void` | Imperatively pans and zooms the board. Zoom is clamped to the supported range. |
| `getSession()` | `() => NoteboardSession` | Returns a full DB-ready board snapshot. |
| `exportImage()` | `(format?: 'png' \| 'jpeg', options?: BoardImageOptions) => string` | Renders board content as a data URL; images must already be loaded. |
| `exportImageAsync()` | `(format?: 'png' \| 'jpeg', options?: BoardImageOptions) => Promise<string>` | Waits for images, then exports board content. |
| `focusElements()` | `(ids: string[]) => void` | Selects matching objects and fits them into view. |

---

## 🧪 Playground

The Vite playground imports Noteboard directly from `src` and exercises toolbar placement, themes, read-only mode, viewport presets, and export APIs:

```bash
npm install
npm --prefix playground install
npm run playground
```

Use `npm run playground:build` for a production playground build.

The inspector offers system/light/dark modes, Default/Ocean/Forest/Plum color schemes, and custom primary/secondary colors through the existing `theme` and `brandColors` props. Its scrollbar controls apply to the playground's outer scroller, board panels, the inspector, and the object inspector below the board.

```tsx
const scrollbar = { thumbColor: '#7c5cff', trackColor: 'transparent', width: 'thin' } as const;

<Noteboard theme="dark" brandColors={{ primary: '#7c5cff', secondary: '#22a06b' }}
  scrollbar={scrollbar} />;
```

Set `width: 'none'` to hide scrollbars while keeping wheel, touch, and keyboard scrolling. Clear `scrollbar` to return to native styling. Native appearance depends on the browser and operating system.

Fallback compatibility: Playwright's WebKit 27.2 build on Windows did not reliably repaint when switching from native to custom scrollbar colors after mount. Initial custom colors rendered correctly. Chrome passed live changes.

For a host-owned scroll container alongside Noteboard, import `getNoteboardScrollbarProps` and spread its result onto that container. It supplies the class, mode attribute, and CSS variables used by the scoped styles rendered with Noteboard. Merge its `className` and `style` if the container has its own. `getNoteboardScrollbarStyle` is available when composing those styles manually; keep the class and mode attribute for browsers that need the WebKit fallback. These helpers do not change the page scrollbar or board persistence.

---

## 📡 Viewport Sync (`onViewportChange`)

Use `onViewportChange` to track pan & zoom externally — useful for persisting the viewport or syncing it across clients:

```tsx
import { useState } from 'react';
import { Noteboard } from '@sunaissu/noteboard';
import type { NoteboardViewport } from '@sunaissu/noteboard';

function App() {
  const [viewport, setViewport] = useState<NoteboardViewport>({ panX: 0, panY: 0, zoom: 1 });

  return (
    <>
      <p>Zoom: {Math.round(viewport.zoom * 100)}%</p>
      <Noteboard onViewportChange={setViewport} />
    </>
  );
}
```

---

## 🤝 Multiplayer & Collaboration

Noteboard is server-agnostic. For concurrent editing, install Yjs and connect the optional adapter to any Yjs provider:

```tsx
import * as Y from 'yjs';
import { Noteboard } from '@sunaissu/noteboard';
import { useYjsNoteboard } from '@sunaissu/noteboard/yjs';

const document = new Y.Doc();

export function MultiplayerBoard() {
  const binding = useYjsNoteboard(document);
  return (
    <Noteboard
      elements={binding.elements}
      onElementsChange={binding.onElementsChange}
      history={binding.history}
      viewport={binding.viewport}
      onViewportChange={binding.onViewportChange}
    />
  );
}
```

Attach `document` to a provider such as Hocuspocus or `y-websocket`. The adapter stores elements in independent `Y.Map` values and labels in `Y.Text`. Pass `binding.history` to scope undo to the current editor. Navigation stays local by default; set `shareViewport: true` only for shared navigation. Z-order remains a separate `Y.Array`. The adapter applies local insertion, deletion and move changes without replacing untouched order entries. A stale append preserves peer ordering, and undo tracks local changes. Simultaneous moves of the same object follow Yjs conflict ordering. Authentication, persistence, and transport belong to the host.

Connector `startBinding` and `endBinding` metadata is part of each line or arrow element, so the adapter and normal JSON session serialization preserve snapped connections automatically.

---

## 🖼️ Lightweight Previews

Use `NoteboardPreview` to render a read-only, static snapshot without mounting the full interactive canvas:

```tsx
import { NoteboardPreview } from '@sunaissu/noteboard';
import type { NoteboardElement } from '@sunaissu/noteboard';

export function DashboardCard({ elements }: { elements: NoteboardElement[] }) {
  return (
    <div className="card">
      <h3>My Board</h3>
      <NoteboardPreview
        elements={elements}
        height={120}
        style={{ borderRadius: '6px', border: '1px solid #ddd' }}
      />
    </div>
  );
}
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |
| `Ctrl + C` | Copy selected |
| `Ctrl + V` | Paste |
| `Ctrl + D` | Duplicate selected |
| `Ctrl + A` | Select all |
| `Ctrl + G` | Group selected |
| `Ctrl + Shift + G` | Ungroup |
| `Delete` | Delete selected |
| `Escape` | Deselect / finish text edit |
| `]` / `[` | Bring forward / send backward |
| `Ctrl + ]` / `Ctrl + [` | Bring to front / send to back |
| `Ctrl + Scroll` | Zoom in / out |
| `Scroll` | Pan canvas |
| `G` | Toggle grid & snap |
| `?` | Open keyboard shortcut cheatsheet |

> Press `?` inside the board at any time to see the full cheatsheet modal.

---

## 📋 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a full list of changes across versions.

---

## 📜 License

MIT License. See [LICENSE](./LICENSE) for details.

## 3.0.0 release candidate collaboration migration

This working tree changes the shared text schema. Before updating an existing collaborative deployment, back up the Yjs document, disconnect old clients, run `migrateNoteboardText(document)` from `@sunaissu/noteboard/yjs` on the authoritative document, persist it, and reconnect only updated clients. Do not let disconnected old clients independently migrate or overwrite the same labels. Plain JSON board snapshots still contain ordinary text strings.

The adapter initializes content only once per mounted binding. For a provider-backed document, seed initial content on the server after loading persisted state; mounting clients should not independently seed an empty document before synchronization.

## Editable templates and playground

`createBoardTemplate` returns fresh editable objects for `flowchart`, `planning`, and `brainstorm`. Each call generates new object/group IDs and internal connector bindings. Insert through the ref to record one undo action:

```tsx
import { createBoardTemplate } from '@sunaissu/noteboard';

const board = boardRef.current;
if (board) {
  const added = createBoardTemplate('planning', { x: 100, y: 80 });
  board.setElements([...board.getElements(), ...added]);
  board.focusElements(added.map(element => element.id));
}
```

The playground now shares the calculator/editor page design: a responsive canvas and inspector, theme/brand controls, template insertion, fit/reset, PNG and session JSON exports, and a JSON preview with merge/replace choices. Merge assigns new IDs and remaps connections; import and reset can be undone. Read-only mode disables changes. Changes stay in memory until exported. Saved custom template catalogs and template version migration remain planned.

## Navigation, exports, and image limits

Settings includes an object search, board overview, and up to 20 viewpoints retained for the mounted session. `ref.current.focusElements(ids)` selects objects and fits them in view.

`exportImage(format, options)` renders board content independently of the viewport, grid, and selection overlays. Use `exportImageAsync` when images may still be loading. Both accept `selectedIds`, `padding`, `scale`, and `background`; PNG can be transparent, while JPEG gets an opaque background. Output is capped at 8192 pixels per edge and 16 million pixels overall.

Uploads and pasted images accept PNG, JPEG, GIF, and WebP. `maxImageBytes` defaults to 5 MiB and can lower that limit; `maxImagePixels` defaults to 16 million decoded pixels. The host must also enforce its storage limits. Imports, text edits, and imperative element replacements participate in history.

## Development checks

Run `npm test`, `npm run playground:build`, and `npm pack --dry-run --json` before release. The GitHub Actions workflow tests the package on Node 18, 22 and 24, builds the playground on Node 22/24, and audits both dependency trees. Browser checks are documented in `qa/README.txt` in the repository.

## Properties layout and scrolling

Top and bottom properties use category tabs and a horizontally scrollable row of controls, capped at 220 CSS pixels. Side panels retain the vertically scrollable inspector. Arrow keys, Home and End switch categories; Tab reaches their controls. Wheel input over horizontal properties moves the control strip. Toolbar and zoom placement follow the measured panel size, including collapse and narrow layouts.

Wheel gestures over the canvas pan the board; Shift pans horizontally, and Ctrl/Command zooms around the cursor. Inspectors and text inputs scroll locally. Reaching an inspector edge does not scroll the surrounding page, and wheel input outside the board keeps normal page scrolling. Native wheel cancellation prevents browser scrolling alongside React canvas updates. Line/page wheel units are normalized. Touch and stylus controls are described in Keyboard Canvas and board tools above.

## Review safeguards

Snapshot images accept only PNG, JPEG, GIF and WebP base64 data URLs, with valid base64 syntax and an 8 MiB URL-text limit. Rendering rejects decoded images above 16 million pixels. Upload limits can lower the 5 MiB byte and 16 million pixel ceilings. The pixel check runs after browser decoding; hosts handling untrusted files should enforce media limits before serving them.

Asynchronous image exports reject after 15 seconds if an image has not loaded. Set `imageTimeoutMs` in export options to a positive value up to 120000 milliseconds. A timeout removes that export's image listener, so a late load does not complete the failed export.

The Yjs adapter validates peer records before rendering. Invalid records and records whose IDs disagree with their map keys stay in the shared document but are excluded from the view until repaired. The view is limited to 10000 valid objects. These checks do not authorize peer writes or limit the size of incoming Yjs updates: enforce permissions, document/update quotas and persistence limits in the host. Direct controlled element props are trusted application input; validate external snapshots with `deserializeBoard`.

Rough strokes cap interpolation work independently of coordinate distance, with a shared budget per polyline. Shape-label wrapping measures words once instead of repeatedly measuring a growing line. These bounds prevent the reproduced amplification cases; they are not a general large-board performance guarantee.

### Host storage admission

Use `acceptElementsChange(next, previous)` to enforce a host's serialized storage
budget before a local change reaches the board state or `onElementsChange`.
Return false and show a host error when the change is too large. Keep this
callback synchronous and pure apart from reporting that error. Remote controlled
props still come from the host's already validated authoritative state.

`maxImageBytes` limits each uploaded file; it does not limit the total board.
For a 1 MiB backend limit, reserve space for session metadata when checking
`new TextEncoder().encode(JSON.stringify({ elements: next, viewport })).length`.

Use `ref.current.getViewport()` to read `{ panX, panY, zoom }` for presence overlays. It returns a fresh navigation object without cloning board elements; `getSession()` still returns the full export snapshot. Host applications should keep each participant's viewport local unless following is explicitly requested.

## Focus mode

Choose Focus mode in Settings or Enter focus mode in the command palette to hide toolbars, properties, quick-connect and connector-bend buttons, and zoom controls. Drawing, panning and keyboard commands remain available. Exit focus mode stays visible at the top right. In Keyboard Canvas, P restores the properties panel. This is a local view preference for the mounted board; it does not change elements, selection, saved content or shared state.

## Public documentation and discovery

The deployed playground includes `/guide.html` with installation, use cases and
host responsibilities, plus `/product.txt` as a plain-text reference. Set
`SITE_ORIGIN` to the final HTTPS origin without a trailing slash when running
`npm run playground:build`. Publish `playground/dist`. Without an origin, the
generated pages request no indexing. Install both root and playground dependencies
for a clean build; keep the repository source alongside the playground.

The playground reflects this source checkout, which may be newer than npm. The
package retains its existing name and dist-tag; discovery changes do not publish
a release or rename imports.
