# Stage 4 application record

[日本語](character-relationship-chart-stage4-applied-ja.md)

Target: `Dropbox/www/studio/character-relationship-chart`.
Implementation and first verification: 2026-09-24 UTC. Completion of interrupted delivery: 2026-09-27 JST.

## Result and scope

The Web edition now uses the existing shared GUI and `packages/core/edit.js` to edit characters, groups, relations and overall settings. Applied settings can be downloaded as UTF-8 JSONC/JSON using the original filename. Edits remain in page memory until the user downloads them; the source file is not overwritten.

Multiple group membership, node/group ID reference updates and dependent relation removal retain the VS Code semantics. Unchanged comments and formatting are preserved within the existing core's limits. Edits near inserted or deleted array elements can be reformatted. Invalid edits and failed download generation preserve the last valid document and GUI values. Opening another valid document asks before discarding pending/applied edits. Download initiation does not prove the user saved the file, so the edited flag remains set.

Stage 3 reading, search, details, dragging, zoom and layout controls remain available. Core implementation, VS Code adapters, data format, manifest version, extension ID and dependencies are unchanged. Narrow-screen CSS is limited to the Web editor.

Excluded: direct overwrite, view-data output, browser persistence, external-file conflicts, Web Undo/Redo, directory reorganization, deployment/Marketplace, variables and other management tasks.

## Files applied

The following 21 existing files were updated relative to stage 3. Two distribution files were added under `dist/`; this record and its Japanese counterpart were added under `change-details/`.

| Path | Change |
| --- | --- |
| `web/host.js` | Shared-core edits, in-memory document and UTF-8 download |
| `web/main.js` | Shared editor startup, download and discard confirmation |
| `web/index.html` | Download controls and usage guidance |
| `web/style.css` | Narrow editor layout |
| `media/main.js` | Host capabilities, pending edits and ID-change view retention |
| `media/editor.js` | Apply wording, input retention and replacement handling |
| `media/ui.html` | Shared editor guidance |
| `test/web-host.test.js` | Host edits, validation, sequencing and downloads |
| `test/web-dom-check.js` | GUI operations, failures and file round trip |
| `test/web-browser-check.js` | Browser editing, download and reimport |
| `README.md` | Web editing and download overview |
| `CHANGELOG.md` | Stage 4 change record |
| `TESTING.md` | Test scope, results and final artifact checksums |
| `MGMT.md` | Stage 4 completion entry |
| `docs/architecture.md` | Stage 4 host/UI contract and deferred scope |
| `docs/DEVELOPMENT.md` | Implementation and test commands |
| `docs/RELEASE.md` | Distribution instructions |
| `packages/core/README.md` | English core reuse documentation |
| `packages/core/README-ja.md` | Japanese core reuse documentation |
| `web/README.md` | English Web instructions |
| `web/README-ja.md` | Japanese Web instructions |

During resumption, all 64 source/document files and both distributions were inspected using Dropbox content hashes. Subsequent user edits to root README credits and the MGMT task list were read and preserved. The final VSIX was rebuilt with those README credits; its other 52 archive entries are byte-identical to the initially verified stage 4 VSIX. MGMT was not overwritten during completion. No Git commit, push, release or publication was performed in this delivery.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed for 18 runtime/build files during resumption |
| `npm test` | 80 passed; no failures or skips; includes existing VS Code regression tests |
| DOM tests | 22 passed: VS Code UI 12 and Web distribution 10 |
| Web rebuild | All 9 archive entries byte-identical to the saved Web ZIP |
| VSIX packaging | `npm run package` passed; 53 entries; only README credits changed from the initial stage 4 build |
| Real browser | Prior stage 4 verification recorded in `TESTING.md`: Chromium 153, 8 operation groups including actual GUI editing, UTF-8 download and byte-identical reexport after reimport |
| Offline/security | Prior browser run: no ordinary HTTP(S) requests; CSP checks passed; no browser persistence or direct filesystem writes |

Native/DOM checks and artifact correspondence were rerun during completion. The prior real-browser run was not rerun; it is identified as earlier evidence, not a new run. The executable code is unchanged. Desktop VS Code installation, real Extension Host/Undo, Windows/macOS and Firefox/Safari remain unverified. Cached-page behavior was tested with a synthetic persisted pagehide event, not an actual BFCache navigation.

## Final distributions

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `dist/character-relationship-chart-web-stage4.zip` | 49853 | `6757a5422c8ff57c951e136c938425060f10101d8158ce950baa0527742222d1` |
| `dist/character-relationship-chart-stage4.vsix` | 424926 | `759a7b88001058f044a30f6ec5b6a5c23713f884b1692b0f80a0c77577860693` |

The initial stage 4 VSIX had SHA-256 `2fd3c2f2160ac634937cf8a2fce7a2b8c42701d1845caa2fe7ae8ba992ff335f` (424877 bytes). It was superseded only to include the user's updated README credits. The earlier evidence in `TESTING.md` is retained, with a separate final-verification entry.

## Use and recovery

Extract the Web ZIP completely and open `index.html`. Open a configuration, choose **編集**, edit and **反映**, close the editor, then choose **設定をダウンロード**. Reopen the downloaded file to check the result. Layout changes are temporary; `.view.json` download is outside stage 4.

For runtime rollback, use the existing stage 3 Web ZIP or VSIX in `dist/`. For source rollback, restore only the 21 affected files from a known stage 3 revision or Dropbox recovery, retaining later unrelated edits. Do not reset the entire repository. Dropbox provides [deleted-file recovery](https://help.dropbox.com/delete-restore/recover-deleted-files-folders) and [version history](https://help.dropbox.com/delete-restore/recover-older-versions), subject to the account's retention period. Additional files can be removed after a separate explicit request. No automatic backup files were created in the Git-managed project.

## Next step

Stage 4 is complete. First try editing, downloading and reopening a personal test file on the target computer. Then, in standard reasoning mode, request planning only: “Review the current README, MGMT, architecture and IDAD. Create `docs/PROCESS_CHART.md` with remaining stages, dependencies, completion criteria, recommended modes and an execution prompt for each stage. Preserve completed stages and do not begin the next implementation.” Verify that view saving, overwrite and Undo remain separate decisions.
