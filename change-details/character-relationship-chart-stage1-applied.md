# Stage 1: Dropbox writeback

Completed and verified at 2026-09-23T23:00:11.273Z.

Project: `/www/studio/character-relationship-chart`.

The UI / VS Code boundary implementation has been applied directly to the project. The 22 source and documentation files below comprise 14 replacements and 8 additions. The stage 1 VSIX is also saved in `dist/`. All 23 payload files match the intended bytes by Dropbox content hash and size; 23 other pre-existing project files match the original source snapshot. No upload staging files remain.

`MGMT.md` changed while this writeback was in progress. Its latest contents were obtained again, verified against the remote content hash, and retained with only the stage 1 completion line inserted. The separate `docs/language-relationship.md` was left untouched.

No commit, push, or marketplace publication was performed. No backup copies were created in this Git-managed project.

## Implementation and validation

- Shared UI: `media/ui.html`, `main.js`, `editor.js`, and `style.css` depend on a host interface.
- VS Code integration: `media/vscode-host.js`, `vscode-bootstrap.js`, `vscode-theme.css`, and `src/webview.js` own API acquisition, messaging, theme mapping, CSP, and resource URIs.
- Existing extension commands, file storage, edit operations, JSONC data format, graph calculations, and runtime dependencies are preserved.
- Before writeback: `npm run check` passed; `npm test` passed 61 tests; the separate jsdom check passed 7 tests; `npm run package` succeeded.
- Writeback validation used content hashes and sizes. Tests were not rerun merely for the upload; tested runtime bytes and the VSIX were preserved.
- Desktop VS Code installation, real Extension Host / Undo, and real browser visual verification remain untested. See `TESTING.md` for the exact scope and manual checks.

## Applied files

Every row below has a successful Dropbox move result and a matching final content hash.

| Action | Dropbox path | File ID | Status |
| --- | --- | --- | --- |
| Replace | `/www/studio/character-relationship-chart/.vscodeignore` | `id:pdXqx4wRBdMAAAAAAAKUbA` | success; verified |
| Replace | `/www/studio/character-relationship-chart/CHANGELOG.md` | `id:pdXqx4wRBdMAAAAAAAKUbQ` | success; verified |
| Replace | `/www/studio/character-relationship-chart/MGMT.md` | `id:pdXqx4wRBdMAAAAAAAKUgw` | success; verified |
| Replace | `/www/studio/character-relationship-chart/README.md` | `id:pdXqx4wRBdMAAAAAAAKUbw` | success; verified |
| Replace | `/www/studio/character-relationship-chart/TESTING.md` | `id:pdXqx4wRBdMAAAAAAAKUcA` | success; verified |
| Replace | `/www/studio/character-relationship-chart/docs/DEVELOPMENT.md` | `id:pdXqx4wRBdMAAAAAAAKUcQ` | success; verified |
| Replace | `/www/studio/character-relationship-chart/docs/RELEASE.md` | `id:pdXqx4wRBdMAAAAAAAKUcg` | success; verified |
| Replace | `/www/studio/character-relationship-chart/docs/architecture.md` | `id:pdXqx4wRBdMAAAAAAAKUcw` | success; verified |
| Replace | `/www/studio/character-relationship-chart/media/editor.js` | `id:pdXqx4wRBdMAAAAAAAKUdA` | success; verified |
| Replace | `/www/studio/character-relationship-chart/media/main.js` | `id:pdXqx4wRBdMAAAAAAAKUdQ` | success; verified |
| Replace | `/www/studio/character-relationship-chart/media/style.css` | `id:pdXqx4wRBdMAAAAAAAKUdg` | success; verified |
| Add | `/www/studio/character-relationship-chart/media/ui.html` | `id:pdXqx4wRBdMAAAAAAAKUdw` | success; verified |
| Add | `/www/studio/character-relationship-chart/media/vscode-bootstrap.js` | `id:pdXqx4wRBdMAAAAAAAKUeA` | success; verified |
| Add | `/www/studio/character-relationship-chart/media/vscode-host.js` | `id:pdXqx4wRBdMAAAAAAAKUeQ` | success; verified |
| Add | `/www/studio/character-relationship-chart/media/vscode-theme.css` | `id:pdXqx4wRBdMAAAAAAAKUeg` | success; verified |
| Replace | `/www/studio/character-relationship-chart/package.json` | `id:pdXqx4wRBdMAAAAAAAKUew` | success; verified |
| Replace | `/www/studio/character-relationship-chart/src/webview.js` | `id:pdXqx4wRBdMAAAAAAAKUfA` | success; verified |
| Replace | `/www/studio/character-relationship-chart/test/extension.test.js` | `id:pdXqx4wRBdMAAAAAAAKUfQ` | success; verified |
| Add | `/www/studio/character-relationship-chart/test/helpers/vscode-harness.js` | `id:pdXqx4wRBdMAAAAAAAKUfg` | success; verified |
| Add | `/www/studio/character-relationship-chart/test/host.test.js` | `id:pdXqx4wRBdMAAAAAAAKUfw` | success; verified |
| Add | `/www/studio/character-relationship-chart/test/preview.js` | `id:pdXqx4wRBdMAAAAAAAKUgA` | success; verified |
| Add | `/www/studio/character-relationship-chart/test/ui-dom-check.js` | `id:pdXqx4wRBdMAAAAAAAKUgQ` | success; verified |
| Add | `/www/studio/character-relationship-chart/dist/character-relationship-chart-stage1.vsix` | `id:pdXqx4wRBdMAAAAAAAKUgg` | success; verified |

The required `test/helpers` directory was created during the initial upload attempt. This report is saved separately as `/www/studio/character-relationship-chart/dist/character-relationship-chart-stage1-applied.md`.

## VSIX

- File: `/www/studio/character-relationship-chart/dist/character-relationship-chart-stage1.vsix`
- Size: 419545 bytes
- SHA-256: `914928be84f58a6c9ac79e2827c2adb973ae13d1bb8ec9b70b870dd967e70c1c`
- Extension ID: `local.character-relationship-chart`; version: `0.1.0`.

The earlier source ZIP is a snapshot from before direct writeback. The current Dropbox tree additionally preserves subsequent user edits in `MGMT.md` and updates the writeback reference in `TESTING.md`.

## Reverting the writeback

Existing paths were replaced by recoverable deletion followed by moving the verified replacement into the same path. To revert a replacement, move the current file aside and restore its prior file from [Dropbox Deleted files](https://help.dropbox.com/delete-restore/recover-deleted-files-folders). The original file IDs are listed below. The preserved pre-writeback `MGMT.md` is the latest user-edited version from immediately before replacement.

| Original path | Original file ID |
| --- | --- |
| `/www/studio/character-relationship-chart/.vscodeignore` | `id:pdXqx4wRBdMAAAAAAAKSHQ` |
| `/www/studio/character-relationship-chart/CHANGELOG.md` | `id:pdXqx4wRBdMAAAAAAAKScw` |
| `/www/studio/character-relationship-chart/MGMT.md` | `id:pdXqx4wRBdMAAAAAAAKTpw` |
| `/www/studio/character-relationship-chart/README.md` | `id:pdXqx4wRBdMAAAAAAAKSbQ` |
| `/www/studio/character-relationship-chart/TESTING.md` | `id:pdXqx4wRBdMAAAAAAAKScg` |
| `/www/studio/character-relationship-chart/docs/DEVELOPMENT.md` | `id:pdXqx4wRBdMAAAAAAAKSbg` |
| `/www/studio/character-relationship-chart/docs/RELEASE.md` | `id:pdXqx4wRBdMAAAAAAAKScA` |
| `/www/studio/character-relationship-chart/docs/architecture.md` | `id:pdXqx4wRBdMAAAAAAAKT-Q` |
| `/www/studio/character-relationship-chart/media/editor.js` | `id:pdXqx4wRBdMAAAAAAAKRow` |
| `/www/studio/character-relationship-chart/media/main.js` | `id:pdXqx4wRBdMAAAAAAAKRtg` |
| `/www/studio/character-relationship-chart/media/style.css` | `id:pdXqx4wRBdMAAAAAAAKRog` |
| `/www/studio/character-relationship-chart/package.json` | `id:pdXqx4wRBdMAAAAAAAKSZg` |
| `/www/studio/character-relationship-chart/src/webview.js` | `id:pdXqx4wRBdMAAAAAAAKSag` |
| `/www/studio/character-relationship-chart/test/extension.test.js` | `id:pdXqx4wRBdMAAAAAAAKSLA` |

The eight added source files, the new VSIX, and this report can be removed on an explicit request. The pre-existing distribution files were retained.
