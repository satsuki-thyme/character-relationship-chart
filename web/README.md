# Character Relationship Chart — Web editor

[日本語](README-ja.md)

This is the completed Stage 5 Web editor (2026-09-28 JST). Automated checks and user-reported desktop direct saving, reopening and external-change blocking have been verified. Extract the entire distribution ZIP and open `index.html` in a desktop browser with JavaScript, FileReader, ResizeObserver, dialog and Blob-download support. Keep the included files together. VS Code, Node.js, a Web server and an Internet connection are not required to use the built application.

The sample opens on startup. Choose **設定を開く** to read one UTF-8 `.jsonc` or `.json` file, or drop it onto the page. You may select/drop its matching display file at the same time. To load display data later, choose **表示データを開く**. The display filename must be the complete source filename plus `.view.json`, for example `cast.jsonc.view.json` for `cast.jsonc`. Files in sibling folders are never read automatically. Choose the same file again to reload changes made outside the application.

Use **編集** to edit people, groups, relations and general settings with the same GUI as the VS Code extension. **反映** applies the form to the chart and the in-memory JSONC. Close the editor, then choose **設定をダウンロード** to download the applied document as UTF-8 using the original `.jsonc` / `.json` filename. The browser may adjust the name or ask where to save it. Check the browser's download destination; starting a download does not prove that it was saved. Open the downloaded file to continue using that version. Unapplied form input is not silently included in a download.

The shared core preserves existing editing semantics: multiple group memberships, references following person/group ID changes, incident relations removed with a person, and group memberships cleared when a group is deleted. General title/description can be added, changed or cleared. Untouched comments, line endings and indentation are preserved where possible. Inserting/deleting entries can reformat neighboring spans; this is not a whole-document JSON conversion. A `.json` input keeps its extension and the same JSONC-compatible content accepted by the extension.

Search, click a node or edge for details, drag nodes or the canvas, zoom, switch layouts, or choose chart-only display. Dragging a node does not open details. All edge labels remain above the edge lines. Renaming a person also retains its temporary dragged position and selection. Layout changes remain temporary: closing/reloading the page or selecting another source discards them. Opening a source resets the previous selection, search and layout; a matching display file restores its saved layout.

Invalid data, read errors and invalid edits keep the last valid chart and preserve form input. Source and optional display data are accepted together only when both are valid. Multiple sources, mismatched display filenames and oversized inputs are rejected. Failed downloads retain the in-memory document for retry. A source replacement asks before discarding applied edits or an open form draft. This confirmation remains relevant after a download, because the application cannot verify that the browser saved it. Page closing/reloading requests a browser warning when edits remain, but browsers do not always show it. Confirm direct-save completion or the download destination before leaving.

There is no `.view.json` saving/downloading, SVG download, Web Undo/Redo, continuous file watching, localStorage or IndexedDB persistence. Content stays in page memory until explicitly saved or downloaded and is not uploaded. The application includes no external resources, telemetry or network requests. Its Content Security Policy also blocks network connections. Refreshing starts with the sample again.

## Direct saving in supported environments

Choose **直接保存用に開く** to obtain a handle to the original JSONC/JSON file. After applying GUI edits, close the editor and choose **保存**. The browser may request write permission. The ordinary Open button, drag-and-drop and sample keep the download workflow. **保存** updates the selected original; **設定をダウンロード** exports a copy. Unapplied form input is never implicitly applied, and there is no autosave.

The host compares the current original bytes with the last verified baseline before creating the writable stream, after creating it, and immediately before closing it. Any change, including comments, whitespace or BOM, stops the write and preserves the document, chart and draft. Download your edits, inspect the original and reopen it. Nothing is automatically merged or chosen. Permission/read/write failures retain edits. Unknown commit results block further direct saves until reopening; there is no automatic resend.

Only a successful close followed by byte-identical readback advances the baseline. Applied edits become clean only if the current document still matches that snapshot. Concurrent new edits and unapplied drafts remain protected. Downloading does not clear dirty state. Handles and permissions are not restored after a reload.

Direct saving requires a secure context, `showOpenFilePicker`, a writable file handle and user permission. The UI uses feature detection; the download workflow remains available when unsupported or refused. HTTPS/localhost can support the APIs, but hosting is not required for ordinary offline use. Check `file://` permissions in your browser. See [MDN: picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) and [writable stream](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable).

There is no atomic compare-and-commit API. The extra comparisons and requested exclusive stream reduce races but cannot guarantee exclusion of external editors or sync tools after the final comparison. Avoid simultaneous writes during Save. Linux Headless Chromium 153 was tested with simulated success/conflict/failure handles and native read/permission-denial protection. The user subsequently confirmed native direct saving, reopening and external-change warnings with saving disabled. Stage 5 is complete based on these separate results. The user’s OS/browser version was not supplied; this is not a cross-platform certification. Manual inspection of both files after conflict and other unreported desktop checks remain distinguished in TESTING.md.

To build from repository source:

```sh
npm ci
npm run build:web
```

Open `dist/web/index.html`. `web/index.html` is a build template. esbuild is a development dependency only. The build bundles the actual shared core, `jsonc-parser`, shared UI and GUI editor; it includes no VS Code adapter. The existing extension remains in `src/` and `media/`. Dependency versions are unchanged from Stage 3.

The distribution includes the project MIT license, `jsonc-parser`'s MIT license, and the sample JSONC. See the repository's `TESTING.md` for the tested environment and remaining limitations.
