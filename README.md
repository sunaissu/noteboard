# @sunaissu/noteboard

> A highly customizable, responsive React whiteboard canvas for drawing, diagramming, and real-time collaboration.

[![npm version](https://img.shields.io/npm/v/@sunaissu/noteboard)](https://www.npmjs.com/package/@sunaissu/noteboard)
[![license](https://img.shields.io/npm/l/@sunaissu/noteboard)](./LICENSE)

---

## 🚀 Features

- **Rich Toolset** — Draw shapes (rectangles, ellipses, diamonds, triangles, stars/polygons), lines, auto-connecting arrows, text, freehand pen, and images.
- **Advanced Elements** — Built-in support for Sticky Notes, Callouts, and Frames.
- **Connector Snapping** — Arrows and lines snap their endpoints to shape anchor points (edges, corners, center) when drawn near them. A purple ring highlights the snap target.
- **Smart Grouping & Locking** — Group shapes, lock elements in place, and control z-order.
- **Collapsible Properties Panel** — The entire panel can be collapsed to a thin header bar. Individual property sections (Appearance, Drop Shadow, Text, Line/Arrow, Pen, Shape, Frame) also collapse independently via chevron toggles.
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
npm install @sunaissu/noteboard @phosphor-icons/react
# or
yarn add @sunaissu/noteboard @phosphor-icons/react
# or
pnpm add @sunaissu/noteboard @phosphor-icons/react
```

> `@phosphor-icons/react` is a required peer dependency for toolbar and panel icons.

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
| `themeOverrides` | `Partial<NoteboardTheme>` | `undefined` | Change individual colors without disabling mode switching. |
| `onThemeChange` | `(theme: NoteboardThemeMode) => void` | `undefined` | Fires when Automatic, Light, or Dark is selected in board settings. Use it with a controlled `theme`. |
| `initialElements` | `NoteboardElement[]` | `[]` | Seed elements on first mount. Uncontrolled — ignored after mount. |
| `initialViewport` | `NoteboardViewport` | `undefined` | Seed pan & zoom on first mount (e.g. from a saved `NoteboardSession`). |
| `elements` | `NoteboardElement[]` | `undefined` | Fully controlled elements array. Use alongside `onElementsChange` for real-time collaboration. |
| `onElementsChange` | `(elements: NoteboardElement[]) => void` | `undefined` | Fires after every local draw, edit, move, or delete. |
| `onViewportChange` | `(viewport: NoteboardViewport) => void` | `undefined` | Fires whenever the user pans or zooms. Use to persist or broadcast the viewport. |
| `readOnly` | `boolean` | `undefined` | Controlled read-only mode — hides the toolbar, disables all editing interactions. |
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
| `setElements()` | `(elements: NoteboardElement[]) => void` | Imperatively replaces the board elements. |
| `setViewport()` | `(viewport: NoteboardViewport) => void` | Imperatively pans and zooms the board. Zoom is clamped to the supported range. |
| `getSession()` | `() => NoteboardSession` | Returns a full DB-ready board snapshot. |
| `exportImage()` | `(format?: 'png' \| 'jpeg') => string` | Returns the canvas as a data URL. |

---

## 🧪 Playground

The Vite playground imports Noteboard directly from `src` and exercises toolbar placement, themes, read-only mode, viewport presets, and export APIs:

```bash
npm install
npm --prefix playground install
npm run playground
```

Use `npm run playground:build` for a production playground build.

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

Noteboard is server-agnostic. For conflict-free concurrent editing, install Yjs and connect the optional adapter to any Yjs provider:

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
    />
  );
}
```

Attach `document` to a provider such as Hocuspocus or `y-websocket`. The adapter stores elements in independent `Y.Map` values and z-order in a `Y.Array`, allowing concurrent changes to merge without coupling the package to authentication, persistence, or a particular transport.

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
