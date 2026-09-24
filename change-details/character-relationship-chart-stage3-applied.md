# Stage 3 implementation and Dropbox application record

[日本語](character-relationship-chart-stage3-applied-ja.md)

Date: 2026-09-24 UTC  
Project: `/www/studio/character-relationship-chart`  
Status: Source and distribution updates completed and verified. This record was prepared after verification at 2026-09-24T09:41:18.136Z.

## Delivered behavior

The minimal read-only Web viewer uses the existing shared UI and core. Extract the entire [Web ZIP](../dist/character-relationship-chart-web-stage3.zip), keep its files together, and open `index.html`. The built viewer starts with the sample and runs offline without VS Code, Node.js, or a Web server.

- Choose or drop one UTF-8 JSONC/JSON file and optionally its matching `<source filename>.view.json`. The display file may also be loaded afterward. The browser reads only files explicitly selected or dropped by the user.
- Search, details, layout selection, node/canvas dragging, zoom, and chart-only display are available. Clicking opens details; dragging a node does not. All edge labels remain above all edge lines and arrows.
- Position and camera changes remain in page memory. Reloading starts again with the sample. Selecting another source clears the previous selection, search and layout; matching display data restores saved positions and camera.
- Invalid input or read failure keeps the previous valid chart visible. Source and optional display data are validated together before application. File count, names, byte size and shared-core character limits are checked. Late responses from superseded reads are ignored.
- The Web host exposes read-only capabilities. Shared UI controls and editor initialization follow host capabilities; existing VS Code hosts retain their default capabilities and behavior. The Web bundle excludes the VS Code adapter and GUI editor.

Saving, editing, Undo, conflict management, file watching, browser persistence and full directory restructuring were outside this stage. The Web viewer also has no SVG download. It sends no file content to a server and loads no external resources; its CSP blocks connections. Existing VS Code persistence and editing remain in their existing adapters.

Added `web/` for the Web entry point and file reader, and `scripts/build-web.js` for the offline distribution. The build shares `media/ui.html`, UI code, graph logic and parsing/validation; it selects jsonc-parser's published ESM entry. esbuild 0.28.2 is a development-only dependency. Existing dependency versions, production jsonc-parser 3.3.1, data formats, extension ID, display name and version are unchanged. The five shared-core implementation files are byte-identical to Stage 2.

Updated architecture, development/release instructions, README, licenses, changelog and test records. `MGMT.md` preserves the user's existing tasks, including the separate variable-syntax task, and adds only the Stage 3 completion line. See [architecture](../docs/architecture.md), [Web usage](../web/README.md) and [testing](../TESTING.md).

## Verification

Environment: Linux, Node.js 24.19.0, npm 11.9.0. jsdom 26.1.0, Playwright, Chromium and the Japanese font used for visual inspection are QA-only dependencies outside the application.

| Check | Result |
| --- | --- |
| JavaScript syntax | 18 runtime/build files passed |
| Native tests | 73 passed; no failures or skips |
| DOM regression | 18 passed: 12 VS Code UI tests and 6 built-Web tests; no failures or skips |
| Real browser | Chromium Headless 153.0.8010.0 passed six workflow groups covering offline file-URL startup, real pointer click/drag, search/details/zoom, FileReader inputs and sidecars, invalid-input recovery, drop, a simulated persisted pagehide event, 390px display/focus mode, refresh reset and CSP |
| Visual inspection | Japanese text and layout checked at 1280×800 and 390×780 |
| Network and storage | Normal application interactions issued zero HTTP(S) requests; no browser persistence. Actual CSP violation events verified rejection of inline scripts and connections; Web security was not disabled |
| Web distribution | Nine ZIP entries matched the generated files. A separate extraction started offline and displayed six nodes and eight edges |
| VSIX | 53 entries; runtime sources matched tested files. Included core, runtime dependency and licenses; excluded Web-only files, build tools, tests and management records. Extracted core parsing and eight-edge routing passed |
| Dropbox | 26 updated/added files plus 40 unchanged source files: all 66 sizes and content hashes matched expectations |
| Temporary files | Nine touched directories fully listed; no temporary upload files from this stage remained |

Desktop VS Code installation, the actual Extension Host and Undo were not tested. VS Code coverage uses the existing mocked API and DOM regression tests. Windows, macOS, Firefox and Safari were not tested. The persisted-page transition check dispatches the browser event; it is not an end-to-end back/forward-cache navigation test. Details and repeatable commands are in [TESTING.md](../TESTING.md) and [DEVELOPMENT.md](../docs/DEVELOPMENT.md).

## Distributions

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [character-relationship-chart-web-stage3.zip](../dist/character-relationship-chart-web-stage3.zip) | 41987 | `3eef71bcfed97559d1c38e4e2c2f4b089e32e0c5af6532352b1bf5250180adf5` |
| [character-relationship-chart-stage3.vsix](../dist/character-relationship-chart-stage3.vsix) | 423927 | `16007fb105a97f2296d228016be24bfbf1c62f0d8af5ba09b71538adfc444704` |

The extension remains `local.character-relationship-chart`, display name `Character Relationship Chart`, version `0.1.0`.

## Applied files

Fourteen existing files were updated and twelve files were added: ten source/document/test/build files and two distributions. The following paths and IDs are the values returned after successful Dropbox moves; all entries were independently hash-verified. This record and its Japanese translation are additional reporting files in `change-details/`.

| Operation | Final Dropbox path | File ID | Status |
| --- | --- | --- | --- |
| Add | `/www/studio/character-relationship-chart/dist/character-relationship-chart-stage3.vsix` | `id:pdXqx4wRBdMAAAAAAAKVnA` | success |
| Add | `/www/studio/character-relationship-chart/dist/character-relationship-chart-web-stage3.zip` | `id:pdXqx4wRBdMAAAAAAAKVnQ` | success |
| Add | `/www/studio/character-relationship-chart/scripts/build-web.js` | `id:pdXqx4wRBdMAAAAAAAKVng` | success |
| Add | `/www/studio/character-relationship-chart/test/web-browser-check.js` | `id:pdXqx4wRBdMAAAAAAAKVnw` | success |
| Add | `/www/studio/character-relationship-chart/test/web-dom-check.js` | `id:pdXqx4wRBdMAAAAAAAKVoA` | success |
| Add | `/www/studio/character-relationship-chart/test/web-host.test.js` | `id:pdXqx4wRBdMAAAAAAAKVoQ` | success |
| Add | `/www/studio/character-relationship-chart/web/README-ja.md` | `id:pdXqx4wRBdMAAAAAAAKVog` | success |
| Add | `/www/studio/character-relationship-chart/web/README.md` | `id:pdXqx4wRBdMAAAAAAAKVow` | success |
| Add | `/www/studio/character-relationship-chart/web/host.js` | `id:pdXqx4wRBdMAAAAAAAKVpA` | success |
| Add | `/www/studio/character-relationship-chart/web/index.html` | `id:pdXqx4wRBdMAAAAAAAKVpQ` | success |
| Add | `/www/studio/character-relationship-chart/web/main.js` | `id:pdXqx4wRBdMAAAAAAAKVpg` | success |
| Add | `/www/studio/character-relationship-chart/web/style.css` | `id:pdXqx4wRBdMAAAAAAAKVpw` | success |
| Update | `/www/studio/character-relationship-chart/.vscodeignore` | `id:pdXqx4wRBdMAAAAAAAKVqA` | success |
| Update | `/www/studio/character-relationship-chart/CHANGELOG.md` | `id:pdXqx4wRBdMAAAAAAAKVqQ` | success |
| Update | `/www/studio/character-relationship-chart/README.md` | `id:pdXqx4wRBdMAAAAAAAKVqg` | success |
| Update | `/www/studio/character-relationship-chart/TESTING.md` | `id:pdXqx4wRBdMAAAAAAAKVqw` | success |
| Update | `/www/studio/character-relationship-chart/THIRD_PARTY_NOTICES.md` | `id:pdXqx4wRBdMAAAAAAAKVrA` | success |
| Update | `/www/studio/character-relationship-chart/docs/DEVELOPMENT.md` | `id:pdXqx4wRBdMAAAAAAAKVrQ` | success |
| Update | `/www/studio/character-relationship-chart/docs/RELEASE.md` | `id:pdXqx4wRBdMAAAAAAAKVrg` | success |
| Update | `/www/studio/character-relationship-chart/docs/architecture.md` | `id:pdXqx4wRBdMAAAAAAAKVrw` | success |
| Update | `/www/studio/character-relationship-chart/media/main.js` | `id:pdXqx4wRBdMAAAAAAAKVsA` | success |
| Update | `/www/studio/character-relationship-chart/package-lock.json` | `id:pdXqx4wRBdMAAAAAAAKVsQ` | success |
| Update | `/www/studio/character-relationship-chart/package.json` | `id:pdXqx4wRBdMAAAAAAAKVsg` | success |
| Update | `/www/studio/character-relationship-chart/packages/core/README-ja.md` | `id:pdXqx4wRBdMAAAAAAAKVsw` | success |
| Update | `/www/studio/character-relationship-chart/packages/core/README.md` | `id:pdXqx4wRBdMAAAAAAAKVtA` | success |
| Update | `/www/studio/character-relationship-chart/MGMT.md` | `id:pdXqx4wRBdMAAAAAAAKVtQ` | success |

New folders:

| Final Dropbox path | Folder ID | Status |
| --- | --- | --- |
| `/www/studio/character-relationship-chart/web` | `id:pdXqx4wRBdMAAAAAAAKVmg` | success |
| `/www/studio/character-relationship-chart/scripts` | `id:pdXqx4wRBdMAAAAAAAKVmw` | success |

All uploads were first verified at unique temporary paths. Existing content was rechecked immediately before replacement; all 66 final source/distribution files were checked afterward. No project backup folder was created because the project already contains `.git`. No commit, push or publication was performed. Previous-stage distributions and records were retained.

## Reverting this stage

The fourteen replaced originals were removed using recoverable Dropbox deletion. To restore them, move aside the current files at the same paths, then restore the originals through Dropbox Deleted files, subject to the account's retention period. See [Dropbox's recovery instructions](https://help.dropbox.com/delete-restore/recover-deleted-files-folders). This replacement workflow does not assume that the new files share the old file IDs or version histories.

To remove additions, delete the twelve added files listed above and these two report files, then remove `web/` and `scripts/` only if empty. Such removal can be performed upon a separate explicit instruction; no rollback has been performed. Existing Stage 1 and Stage 2 files should be retained unless separately requested otherwise.
