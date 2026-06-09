# @sunaissu/noteboard

> A highly customizable, responsive React whiteboard canvas for drawing, diagramming, and real-time collaboration.

[![npm version](https://img.shields.io/npm/v/@sunaissu/noteboard)](https://www.npmjs.com/package/@sunaissu/noteboard)
[![license](https://img.shields.io/npm/l/@sunaissu/noteboard)](./LICENSE)

---

## 🚀 Features

- **Rich Toolset** — Draw shapes (rectangles, ellipses, diamonds, triangles, stars/polygons), lines, auto-connecting arrows, text, freehand pen, and images.
- **Advanced Elements** — Built-in support for Sticky Notes, Callouts, and Frames.
- **Smart Grouping & Locking** — Group shapes, lock elements in place, and control z-order.
- **Collapsible Properties Panel** — The entire panel can be collapsed to a thin header bar. Individual property sections (Appearance, Drop Shadow, Text, Line/Arrow, Pen, Shape, Frame) also collapse independently via chevron toggles.
- **Snap-to-Grid & Alignment Guides** — Dot-grid overlay, snap-to-grid, and smart alignment tools for precise layouts.
- **Board Management** — Export as PNG/JPEG, import/export state as JSON, toggle grid visibility, and clear the canvas with a confirmation prompt.
- **Dark Mode Support** — Default light/dark themes with full custom `NoteboardTheme` override support.
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
        theme="dark"
      />
    </div>
  );
}
```

---

## 🛠 Props API

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `'light' \| 'dark' \| NoteboardTheme` | `'dark'` | Active theme. Pass a custom `NoteboardTheme` object to override individual colors. |
| `initialElements` | `NoteboardElement[]` | `[]` | Seed elements on first mount. Uncontrolled — ignored after mount. |
| `elements` | `NoteboardElement[]` | `undefined` | Fully controlled elements array. Use alongside `onElementsChange` for real-time collaboration. |
| `onElementsChange` | `(elements: NoteboardElement[]) => void` | `undefined` | Fires after every local draw, edit, move, or delete. |
| `toolbarPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Position of the main toolbar. |
| `propertiesPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'left'` | Position of the properties panel. |
| `slots` | `ToolSlot[]` | `DEFAULT_SLOTS` | Customize which tools appear in the toolbar. |
| `onSave` | `(session: NoteboardSession) => void` | `undefined` | Adds a Save button to the settings menu. Returns a serialized snapshot. |
| `threadId` | `string` | `undefined` | Identifies the room or thread (used with collaboration integrations). |
| `boardId` | `string` | `undefined` | Identifies the board instance. |

---

## 🤝 Multiplayer & Collaboration

Noteboard is server-agnostic. To build a real-time multiplayer board, pass the `elements` prop directly from your server state and broadcast updates via `onElementsChange`:

```tsx
import { Noteboard } from '@sunaissu/noteboard';
import { useWebSocket } from './your-websocket-hook';

export function MultiplayerBoard() {
  const { elements, sendUpdate } = useWebSocket('wss://your-server.com/room');

  return (
    <Noteboard
      elements={elements}
      onElementsChange={(newElements) => {
        sendUpdate(newElements); // Broadcast local changes to the server
      }}
    />
  );
}
```

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

## 📋 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a full list of changes across versions.

---

## 📜 License

MIT License. See [LICENSE](./LICENSE) for details.
