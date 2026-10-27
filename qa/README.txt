Local package browser review

Run from the noteboard directory after installing dependencies in all three packages and noteboard/playground.

1. Start the local fixture:
   node playground/node_modules/vite/bin/vite.js tests/browser --config tests/browser/vite.config.mjs --host 127.0.0.1 --port 5191
2. In another terminal run:
   node qa/review.cjs
3. Stop the local server when finished.

The runner uses installed Google Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe. It writes disposable screenshots to the ignored qa/artifacts directory and closes its browser even when an assertion fails. It uses in-memory Yjs documents; no account or production service is connected.

Coverage includes all four property positions, local/peer typing, caret movement, source composition, undo isolation, clean exports, object search, context menus, image admission, text draft recovery, document tools, calculator variables/format/memory, and 390-pixel light/dark layouts.

Document coverage also includes visible insertion controls, caret-relative insertion, table row/column changes and alignment, local undo/redo, hostile HTML commands/drop, and composition guards.

For the actual document-editor playground, start it on port 5174 and run node qa/format-review.cjs. This checks typography isolation and visual/preview parity, task markers, writing-pane scrolling, and mobile light/dark layouts.

Grouped toolbars and slash commands: with the fixture on port 5191 and document playground on 5174, run node qa/commands-review.cjs. Screenshots use grouped-*.png and slash-menu-*.png.

Completion regressions: with the fixture on port 5191, run node qa/completion-review.cjs. This verifies calculator history replay including Ans, significant figures, calculus formatting, read-only preview search/outline, and source composition guards.

Feature additions: start calculator, document-editor and noteboard playgrounds on ports 5173, 5174 and 5175, then run node qa/features-review.cjs. This covers equation solving, uploaded-image insertion/undo, template insertion, JSON preview/merge, permissions, PNG export and responsive layouts. Screenshots use noteboard-playground-*.png.

Delayed-upload regressions: with the fixture on 5191, run node qa/upload-review.cjs. This checks visual/source insertion anchors, plain captions, undo and late completions after cancellation, document changes, read-only or unmount. The fixture deliberately ignores AbortSignal to check the editor guard.

Interaction review: start the fixture on 5191 and the document playground on 5174, then run node qa/interaction-review.cjs. Real Chrome wheel input verifies canvas pan/zoom without page scrolling, horizontal property strips, vertical inspector boundaries and normal scrolling outside the board. It also checks compact properties, category keyboard behavior, mobile positioning, direct editor controls and panel focus restoration. Screenshots use properties-compact-* and editor-direct-*.

Keyboard Canvas review (16 October 2026)
Start the same fixture on port 5180, then run node qa/keyboard-canvas-review.cjs and node qa/canvas-refinement-review.cjs. Set BOARD_BROWSER=firefox or BOARD_BROWSER=webkit to repeat both suites in those engines. Install them with node node_modules/@playwright/test/cli.js install firefox webkit. The main suite accepts BOARD_REVIEW_URL and CHROME_PATH overrides.

The main suite checks drawing, defaults, same-point rejection, keyboard text/focus/move/undo, frames, layers, PNG/SVG/PDF downloads, SVG decoding, host-provided board state, read-only mode and responsive layouts. It seeds a legacy browser draft and verifies that reload uses the host's initial content without restoring or overwriting that draft. Chrome additionally dispatches touch input for pan and pinch. The refinement suite checks pointer-drawn frames, coherent copies, bend dragging and keyboard editing, numeric endpoints, focus escape, typing isolation, and ordinary editing/undo with browser storage unavailable. No whole-board autosave or restore UI is expected; the host app owns persistence. These are local browser-engine checks, not physical-device or screen-reader certification.

With the Noteboard playground on 5175, run node qa/host-persistence-review.cjs. It checks desktop and mobile loads with a legacy saved draft, verifies no snapshot storage reads or writes after edits, and exercises explicit JSON restore/export and fresh page loads.

Run node qa/appearance-review.cjs against the same playground for theme modes, color schemes, custom scrollbar colors, transparent tracks, hidden scrollbars with keyboard scrolling, nested panels, and native reset. Repeat with BOARD_BROWSER=webkit to check the WebKit scrollbar fallback. Desktop and 390-pixel screenshots are saved under qa/artifacts/appearance-*.

Workspace completion suites (16 October 2026)
With the fixture on 5180, run node qa/workspace-review.cjs and node qa/workspace-edge-review.cjs. Repeat with BOARD_BROWSER=firefox and BOARD_BROWSER=webkit. They cover persistent views/catalogs/bookmarks, import/layout previews, styles, links/ports/crop, text intent recovery, comments/voting/timer, presenter following/disconnect, late permissions, document revocation through undo, versions, vector multipage PDF and responsive dialogs. Chrome also checks the system clipboard.
Run node qa/performance-review.cjs for preset 1k/10k-object, 100k-point stroke, export and heap budgets. The report is written to qa/artifacts/performance-review.json with machine/browser details. This is a local developer-build benchmark, not a mobile guarantee.

Theme and screen-size review
With the fixture on 5180, run node qa/theme-responsive-review.cjs. Repeat with BOARD_BROWSER=firefox and BOARD_BROWSER=webkit. Keep the source unchanged while each suite runs; Vite hot reload can reset dialog state mid-interaction.
The matrix covers light/dark at 320x568, 390x844, 844x390, 768x1024, 1024x768, 1440x900 and 2560x1440. It checks workspace tabs and previews, image controls, comments, timer, long presentation names, layers, imports, all export formats, custom PDF fields, commands, shortcuts, drawing controls and properties. Narrow contexts use touch capability. Explicit themes run against the opposite OS preference; a separate check changes the system theme live.
Assertions cover bounds, horizontal overflow, enabled dialog control text contrast, and native control color schemes. JSON reports and screenshots are saved under qa/artifacts. Authored drawing colors and export paper colors are preserved; the app theme does not recolor document content. Browser emulation does not cover physical touch hardware, mobile browser chrome, virtual keyboards or screen readers.

Usability and scrolling review
Run node qa/usability-review.cjs against the fixture on 5180, then repeat with BOARD_BROWSER=firefox and BOARD_BROWSER=webkit. It checks both themes at eight viewport sizes, including 568x320 landscape and 640x450 reduced-height layouts. It verifies hit-test reachability of focused controls, vertical phone properties, arrange/lock actions, persistent Close/navigation/search/preview/export controls, PageDown scrolling, modal focus wrapping, Escape and focus restoration. Screenshots use usability-*.png. Long content still scrolls vertically; the dialog header, navigation and primary preview/export actions remain outside that scroll area.

Cross-project product review loop
Run node qa/product-review-loop.cjs with the fixture on 5180. Repeat with BOARD_BROWSER=firefox and BOARD_BROWSER=webkit. This covers live variable dependencies/errors and Ans/history preservation, contextual replacement review/cancel/apply/undo/stale invalidation/literal markup, mobile match navigation, and local Focus mode entry/exit/properties/focus restoration. Both themes run at 320x568, 390x844, 844x390 and 1440x900.

Mobile toolbar and overlay regressions (17 October 2026)
Keep the fixture on 5180 and Noteboard playground on 5175, then run node qa/toolbar-responsive-review.cjs. Repeat with BOARD_BROWSER=webkit. The full matrix covers eight viewport sizes, both themes, all four toolbar edges, independent property positions, shape pickers, settings, library previews, rotation, and presentation/timer combinations. It checks clipping, overlap, 44px controls, keyboard focus, actual touch taps and wheel scrolling without moving the canvas or host page. Flags --quick, --cross-only and --floating-only select smaller groups.
Run node qa/overlay-responsive-review.cjs for Chromium checks at 320x568, 390x844, 568x320 and 844x390. These exercise context menus, keyboard help, long object text, text recovery prompts, quick connections, bend editing and simultaneous timer/drawing/help overlays. Run node qa/canvas-refinement-review.cjs after changes to connector controls.
Run node qa/presentation-handles-review.cjs to verify presentation hides editing handles and keyboard help, keeps cursor/draft visuals, and restores the controls afterward.
Reports and screenshots are written under ignored qa/artifacts. Keep product sources unchanged during a run: Vite reloads can reset active dialogs. These suites use browser emulation; physical phones, native virtual keyboards and assistive technology still need device testing.
