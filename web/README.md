# Character Relationship Chart — Web editor

[日本語](README-ja.md)

**Stage 8 build, 2026-10-10 JST: SVG output is implemented and automatically verified; user device acceptance is pending.**

Previous-stage record: the Stage 7 implementation and automated verification build was produced on 2026-10-04 JST and adds in-page Undo/Redo. **Stage 7 was formally accepted on 2026-10-09 JST** after the user reported main Web and VS Code checks, installation of the designated Stage 7 VSIX, and a VS Code Window reload. The three distribution/archive SHA-256 values match the Stage 7 implementation record; these are not measured hashes of the installed extension files. Stages 1–6 remain complete. Extract the full ZIP and open `index.html` in a desktop browser supporting JavaScript, FileReader, ResizeObserver, dialog and Blob downloads. Keep the included files together. VS Code, Node.js, a Web server and an Internet connection are not required.

The sample opens on startup. Choose **設定を開く** to read one UTF-8 `.jsonc` or `.json` file, or drop it onto the page. You may select/drop its matching display file at the same time. To load display data later, choose **表示データを開く**. The display filename must be the complete source filename plus `.view.json`, for example `cast.jsonc.view.json` for `cast.jsonc`. Files in sibling folders are never read automatically. Choose the same file again to reload changes made outside the application.

Use **編集** to edit people, groups, relations and general settings with the same GUI as the VS Code extension. **反映** applies the form to the chart and the in-memory JSONC. Close the editor, then choose **設定をダウンロード** to download the applied document as UTF-8 using the original `.jsonc` / `.json` filename. The browser may adjust the name or ask where to save it. Check the browser's download destination; starting a download does not prove that it was saved. Open the downloaded file to continue using that version. Unapplied form input is not silently included in a download.

The shared core preserves existing editing semantics: multiple group memberships, references following person/group ID changes, incident relations removed with a person, and group memberships cleared when a group is deleted. General title/description can be added, changed or cleared. Untouched comments, line endings and indentation are preserved where possible. Inserting/deleting entries can reformat neighboring spans; this is not a whole-document JSON conversion. A `.json` input keeps its extension and the same JSONC-compatible content accepted by the extension.

Search, click a node or edge for details, drag nodes or the canvas, zoom, switch layouts, or choose chart-only display. Dragging a node does not open details. All edge labels remain above the edge lines. Renaming a person also retains its temporary dragged position and selection. Layout changes stay in memory until explicitly saved/downloaded: closing/reloading the page or selecting another source discards unexported changes. Opening a source resets the previous selection, search and layout; a matching display file restores its saved layout.

Invalid data, read errors and invalid edits keep the last valid chart and preserve form input. Source and optional display data are accepted together only when both are valid. Multiple sources, mismatched display filenames and oversized inputs are rejected. Failed downloads retain the in-memory document for retry. A source replacement asks before discarding applied edits or an open form draft. This confirmation remains relevant after a download, because the application cannot verify that the browser saved it. Page closing/reloading requests a browser warning when edits remain, but browsers do not always show it. Confirm direct-save completion or the download destination before leaving.

There is no continuous file watching, localStorage or IndexedDB persistence. Content stays in page memory until explicitly saved or downloaded and is not uploaded. The application includes no external resources, telemetry or network requests. Its Content Security Policy also blocks network connections. Refreshing starts with the sample again.

## SVG image output (Stage 8)

Choose **SVGをダウンロード** in the **画像** group to download the complete applied chart as a UTF-8 SVG image. `人物.jsonc` or `人物.json` suggests `人物.svg`; the browser may adjust the filename. Output includes every person and relation regardless of zoom, pan or search. Search fading, selection rings and selected-edge emphasis are omitted. Current positions, line styles, arrows, text and computed theme colors are included. The export bounds also include long titles. Fonts are not embedded, so another device may display different glyphs.

| Purpose | Control and file |
| --- | --- |
| Edit people, groups and relations later | 設定を保存 (supported environments) / 設定をダウンロード → `.jsonc` / `.json` |
| Restore positions, camera and display options | 表示データを保存 / 表示データをダウンロード → `<source filename>.view.json` |
| Use the chart as an image | SVGをダウンロード → `.svg` |

SVG is not a replacement for editable data. Export never changes config/view saved baselines, destinations, conflict stops or Undo/Redo history. Apply or explicitly discard form input before closing the editor. Unapplied input, configuration errors and empty charts block SVG output. Generation/download-start failures retain the chart and input for retry.

The message confirms only that a download was started. Check the browser's destination: the application cannot confirm completion or cancellation. SVG output does not add direct overwrite or an OS save picker. Tab and Enter operate the output controls; on small screens, scroll the upper controls. Escape closes the additional-operations menu and returns focus to its summary.

## Direct saving in supported environments

Choose **直接保存用に開く** to obtain a handle to the original JSONC/JSON file. After applying GUI edits, close the editor and choose **設定を保存**. The browser may request write permission. The ordinary Open button, drag-and-drop and sample keep the download workflow. **設定を保存** updates the selected original; **設定をダウンロード** exports a copy. Unapplied form input is never implicitly applied, and there is no autosave.

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

## Save and restore display data

Choose **表示データをダウンロード** to export positions, camera translation/zoom, viewport size, layout and detail/chart-only flags as UTF-8 version-1 view JSON using the shared core. Search, selection, source data and unapplied form input are excluded. Save/export the config separately. Keep `cast.jsonc` with `cast.jsonc.view.json`, or `cast.json` with `cast.json.view.json`; the complete source extension is retained. Correct any browser-added filename suffix before importing the pair.

On supported browsers, **表示データを直接保存用に開く** explicitly selects and reads an existing matching sidecar, then **表示データを保存** updates only that file. **表示データの新規保存先を選ぶ** uses `showSaveFilePicker` and accepts only a matching new/empty file. A nonempty selection is refused: open it through the existing-view path first. The API does not identify whether a zero-byte target was just created or already existed. An empty file created by the picker is not automatically deleted after a later failure. No sibling path is discovered from the config handle.

Config and view targets, byte baselines and dirty states are independent. Source replacement resets the previous view/target even for the same name. View-only replacement checks unapplied view changes and keeps the config target and editor draft; ordinary view import removes its direct-save target. Pairing uses complete filenames and person IDs, so intentionally select the correct pair for different folders/works with identical names. Person rename/deletion follows the position keys, and changed fixed config coordinates win.

View writes reuse Stage 5 raw-byte comparisons before commit and byte-exact readback verification. Conflicts/permissions/write failures keep config, view and input available for download. Uncertain close/readback stops that target; there is no automatic resend. A verified snapshot clears only its matching view changes; newer changes remain dirty. A download never clears dirty state. The two files are not saved as one transaction. Compare-and-commit is not atomic; the final comparison/close window cannot exclude external writers. No autosave, handle persistence or browser storage is added. Unsupported browsers retain both downloads and shared editing.

Initial Stage 6 verification: 116 Node tests, 31 DOM tests, 7 real-browser view groups and 13 existing browser groups passed. Handle-double success/fault tests do not certify native disk writing. Native external-file reading and denial protection passed; headless native pickers returned AbortError and write permission was denied. Subsequent user reports completed Stage 6 acceptance on 2026-10-02, including confirmation that the specified fixed VSIX was installed and its Window reloaded before the additional checks. Exact test dates and installed-file hashes were not supplied.

References: [save picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker), [file identity](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/isSameEntry), [File System Access specification](https://wicg.github.io/file-system-access/).

## Stage 6 fixes (2026-10-01 JST)

View snapshots retain every rendered person position, including automatic placement. Version 1, names and keys are unchanged, and older sparse position files remain readable. Positions absent from an old file cannot be recovered: arrange the chart and save it again with this build. Capture loss, tab changes and page exit finish node/canvas gestures without activating a click. After renaming person IDs, save the view file separately as well. Stage 7 retains these behaviors.


## Undo and Redo (Stage 7)

**取り消し** and **やり直し** restore applied JSONC and its view together. One apply/delete, complete drag, layout change, zoom event, fit, reset, details or chart-only toggle is one operation. ID references, memberships, incident relations, comments and position keys round-trip together. Search, selection and unapplied forms are outside history. Wheel events are individual zoom steps.

Outside text controls, use Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y. Text controls keep native text Undo. Unapplied forms and in-flight saves block page history; input is retained until explicitly applied or discarded. New edits discard Redo. Successful source or view-only reads clear both stacks; failed/cancelled reads retain them. View-only reads retain the config and form draft. Identical filenames never carry history into another document.

History stays in page memory, capped at 100 operations and approximately 16 MiB of UTF-16 snapshot strings. Older entries are removed with a notice, including any single oversized operation. Reloading/closing loses history. Saves and downloads retain it. Undo/Redo never writes files and never rewinds selected handles, raw byte baselines, verified saved snapshots or conflict/uncertain-result blocks. Config and view dirty states compare independently with the latest loaded/verified saved content. Redo back to that content clears the corresponding dirty state; download does not. Viewport resize compensation alone is not an edit.

Browser draft persistence is not implemented; the user elected not to adopt it for now on 2026-10-09 JST. The optional design remains as a historical proposal. Save/download config and view separately before leaving. Stage 7 automated verification: 132 Node tests, 46 shared/Web DOM tests and 33 real Chromium 143 operation groups. Simulated handles/VS Code APIs do not certify native disk writes or Extension Host. Native read and permission-denial protection passed; native save success in this automated environment remains unverified.
