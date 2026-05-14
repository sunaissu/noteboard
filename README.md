# @sunaissu/noteboard

A highly customizable, responsive React whiteboard canvas for drawing, diagramming, and real-time collaboration.

![Noteboard Preview](./preview.png) *(Add a screenshot here!)*

## 🚀 Features

- **Rich Toolset**: Draw shapes (rectangles, ellipses, diamonds, triangles, stars), lines, auto-connecting arrows, text, and freehand (pen).
- **Advanced Elements**: Built-in support for Tables, Sticky Notes, Callouts, and Image insertion.
- **Smart Grouping & Locking**: Group shapes together, lock elements in place, and adjust z-order (bring forward/send backward).
- **Responsive Panels**: Built-in, fully configurable toolbar and properties panel for adjusting color, stroke size, opacity, and typography.
- **Snap-to-Grid & Alignment Guides**: Built-in smart alignment tools and customizable grid snapping for precise layouts.
- **Board Management**: Export the canvas as PNG/JPEG, import/export state as JSON, toggle grid visibility, and clear canvas with confirmation.
- **High-Performance Text Editing**: Optimized text rendering with perfect synchronization between edit and presentation modes.
- **Dark Mode Support**: Comes with default light/dark themes and allows full custom theme overrides.
- **Multiplayer Ready**: Completely server-agnostic. Works seamlessly with WebSockets or CRDTs via controlled `elements` and `onElementsChange` props.

## 📦 Installation

```bash
npm install @sunaissu/noteboard @phosphor-icons/react
# or
yarn add @sunaissu/noteboard @phosphor-icons/react
# or
pnpm add @sunaissu/noteboard @phosphor-icons/react
```

*Note: `@phosphor-icons/react` is required as a peer dependency for the toolbar icons.*

## 💻 Quick Start

```tsx
import React, { useState } from 'react';
import { Noteboard } from '@sunaissu/noteboard';
import type { NoteboardElement } from '@sunaissu/noteboard';

export default function App() {
  const [elements, setElements] = useState<NoteboardElement[]>([]);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <Noteboard 
        elements={elements} 
        onElementsChange={setElements} 
        theme="dark" 
      />
    </div>
  );
}
```

## 🛠 Props API

The `Noteboard` component accepts several props for deep customization:

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `'light' \| 'dark' \| NoteboardTheme` | `'dark'` | Sets the active theme. You can pass a custom theme object to override colors. |
| `initialElements` | `NoteboardElement[]` | `[]` | Used to seed the board on the first mount. Uncontrolled. |
| `elements` | `NoteboardElement[]` | `undefined` | Fully controlled elements array. Use this alongside `onElementsChange` for real-time collaboration. |
| `onElementsChange` | `(elements: NoteboardElement[]) => void` | `undefined` | Fires after every local draw, edit, move, or delete action. |
| `toolbarPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Position of the main toolbar. |
| `propertiesPosition`| `'top' \| 'bottom' \| 'left' \| 'right'` | `'left'` | Position of the element properties panel. |
| `slots` | `ToolSlot[]` | `DEFAULT_SLOTS` | Customizes which tools appear in the toolbar. |
| `onSave` | `(session: NoteboardSession) => void` | `undefined` | If provided, a "Save" button appears in the settings menu, returning a serialized snapshot. |
| `threadId` | `string` | `undefined` | Used internally to identify the room or thread. |
| `boardId` | `string` | `undefined` | Used internally to identify the board instance. |

## 🤝 Multiplayer & Collaboration

Noteboard is designed to be completely server-agnostic. To build a real-time multiplayer board, simply use the controlled `elements` prop and broadcast updates using `onElementsChange`.

```tsx
import { Noteboard } from '@sunaissu/noteboard';
import { useEffect, useState } from 'react';
import { useWebSocket } from './your-websocket-hook';

export function MultiplayerBoard() {
    const { elements, sendUpdate } = useWebSocket('wss://your-server.com/room');
    
    // elements comes directly from the server state
    return (
        <Noteboard 
            elements={elements} 
            onElementsChange={(newElements) => {
                // Broadcast local changes to the server
                sendUpdate(newElements);
            }} 
        />
    );
}
```

## 📜 License

MIT License. See `LICENSE` for details.
