# Character Relationship Chart — Web viewer

[日本語](README-ja.md)

This is the Stage 3 read-only Web viewer. Extract the entire distribution ZIP and open `index.html` in a desktop browser with JavaScript, FileReader and ResizeObserver support. Keep the included files together. VS Code, Node.js, a Web server and an Internet connection are not required to use the built viewer.

The sample opens on startup. Choose **設定を開く** to read one UTF-8 `.jsonc` or `.json` file, or drop it onto the page. You may select/drop its matching display file at the same time. To load display data later, choose **表示データを開く**. The display filename must be the complete source filename plus `.view.json`, for example `cast.jsonc.view.json` for `cast.jsonc`. Files in sibling folders are never read automatically. Choose the same file again to reload changes made outside the viewer.

Use search, click a node or edge for details, drag nodes or the canvas, zoom, switch layouts, or choose the chart-only view. Dragging a node does not open details. All edge labels remain above the edge lines. Layout changes are temporary: closing/reloading the page, selecting another source, or reopening the sample discards them. Opening a source resets the previous selection, search and layout; a matching display file restores its saved layout.

Invalid data or a read error leaves the last valid chart visible with an error. A new source and its optional display file are accepted together only when both are valid. Multiple source files, mismatched display filenames and oversized inputs are rejected. The core enforces the same data limits as the extension.

This viewer has no editing, saving, SVG download, Undo, file watching, conflict management or browser storage. File content stays in this page's memory and is not uploaded. The viewer includes no external resources, telemetry or network requests. Its Content Security Policy also blocks network connections. Refreshing the page starts with the sample again.

To build from repository source:

```sh
npm ci
npm run build:web
```

Open `dist/web/index.html`. `web/index.html` is a build template, not the distribution. esbuild is a development dependency only. The build bundles the actual shared core, `jsonc-parser` and shared UI; it includes no VS Code adapter or GUI editor. The existing extension remains in `src/` and `media/`.

The distribution includes the project MIT license, `jsonc-parser`'s MIT license, and the sample JSONC. See the repository's `TESTING.md` for the tested environment and remaining limitations.
