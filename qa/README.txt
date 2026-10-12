Local package browser review

Run from the noteboard directory after installing dependencies in all three packages and noteboard/playground.

1. Start the local fixture:
   node playground/node_modules/vite/bin/vite.js tests/browser --config tests/browser/vite.config.mjs --host 127.0.0.1 --port 5191
2. In another terminal run:
   node qa/review.cjs
3. Stop the local server when finished.

The runner uses installed Google Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe. It writes screenshots to qa/artifacts and closes its browser even when an assertion fails. It uses in-memory Yjs documents; no account or production service is connected.

Coverage includes all four property positions, local/peer typing, caret movement, source composition, undo isolation, clean exports, object search, context menus, image admission, draft recovery, document tools, calculator variables/format/memory, and 390-pixel light/dark layouts.

Document coverage also includes visible insertion controls, caret-relative insertion, table row/column changes and alignment, local undo/redo, hostile HTML commands/drop, and composition guards.

For the actual document-editor playground, start it on port 5174 and run node qa/format-review.cjs. This checks typography isolation and visual/preview parity, task markers, writing-pane scrolling, and mobile light/dark layouts.

Grouped toolbars and slash commands: with the fixture on port 5191 and document playground on 5174, run node qa/commands-review.cjs. Screenshots use grouped-*.png and slash-menu-*.png.

Completion regressions: with the fixture on port 5191, run node qa/completion-review.cjs. This verifies calculator history replay including Ans, significant figures, calculus formatting, read-only preview search/outline, and source composition guards.

Feature additions: start calculator, document-editor and noteboard playgrounds on ports 5173, 5174 and 5175, then run node qa/features-review.cjs. This covers equation solving, uploaded-image insertion/undo, template insertion, JSON preview/merge, permissions, PNG export and responsive layouts. Screenshots use noteboard-playground-*.png.

Delayed-upload regressions: with the fixture on 5191, run node qa/upload-review.cjs. This checks visual/source insertion anchors, plain captions, undo and late completions after cancellation, document changes, read-only or unmount. The fixture deliberately ignores AbortSignal to check the editor guard.

Interaction review: start the fixture on 5191 and the document playground on 5174, then run node qa/interaction-review.cjs. Real Chrome wheel input verifies canvas pan/zoom without page scrolling, horizontal property strips, vertical inspector boundaries and normal scrolling outside the board. It also checks compact properties, category keyboard behavior, mobile positioning, direct editor controls and panel focus restoration. Screenshots use properties-compact-* and editor-direct-*.
