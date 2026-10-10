# 第8段階 実装・自動検証記録

記録日: 2026-10-10 JST。対象: `Dropbox\www\studio\character-relationship-chart`。

**現在地: 実装・自動検証済み／実機確認待ち。** 第1〜7段階の完了を維持。第9段階は未着手。

## 変更した挙動

- Webの「画像」欄から **SVGをダウンロード**。UTF-8 SVGで図全体を出力し、`人物.jsonc`なら `人物.svg` を提案する。
- 設定・表示データ・画像の出力を区分。「設定を保存」と明示し、狭い画面では上部操作欄をスクロールできる。Tab/Enterとメニュー内Escのフォーカス復帰を確認。
- 未反映入力、設定エラー、空図でSVGを停止。生成/ダウンロード開始の失敗で図・入力・Undo/Redo・保存基準・競合停止を保持する。
- 既存共有SVG処理を利用。全図・各線種/矢印/自己関係/複数所属、日本語と特殊文字、テーマ色、線→ラベル→人物の順序を保持。長いタイトルの欠け、選択線の太さの混入を両環境で修正。
- VS Codeの保存方式、ID、コマンド、manifest 0.1.0、core/Schema、依存/lockfileは変更なし。下書き常時保存、assignment、第9段階再編、Git commit/push、公開・デプロイは実施していない。

## 検証結果

現行Dropbox100ファイルのcontent hashと第7段階VSIXの実装23ファイルを照合。構文チェック、Node **136件**、DOM **46件**、実Chromium **41操作群**が成功。Web最終ZIPからSVG11操作群を再確認（重複計上なし）。詳細と原ログは `TESTING.md` と `dist/character-relationship-chart-stage8-verification-2026-10-10.zip`。検証ZIPには `verification/stage8/` を収録する。

Webは9ファイル、VSIXは53項目。VSIX50ファイルは現行バイト一致、READMEはvsceのリンク変換だけで本文一致。Webは独立ビルド一致。バックアップや検証専用依存を配布に含めない。Node24.19.0、npm11.9.0、jsdom26.1.0、Playwright1.62.1、Linux Chromium143.0.7499.0で実行。保存ハンドルは模擬API、VS Code回帰も模擬APIと実共有UIの組合せ。Windows/macOS・他ブラウザ・実Extension Host・OSピッカー/直接保存成功は今回未実施。

既存Git履歴は変更していない。Dropbox上の現行ソースを正本として取得し、今回Git HEADや未コミット状態を測定したとは扱わない。

## 配布物SHA-256

```text
1f44380f54c48ede51cba0017896e02a14bd2081205869164c062a52fa135b02  character-relationship-chart-web-stage8-2026-10-10.zip
30d81f962b30076f6da6820865d9de05e4fa9abde3dd6ff2398bc794ce8a8f24  character-relationship-chart-stage8-2026-10-10.vsix
```

WebはZIPを全展開しindex.htmlを開く。VSIXは今回のファイルから導入して **Developer: Reload Window**。同じ0.1.0なので版数だけでは判別できない。

## 更新対象と改名バックアップ

更新対象は既存21ファイル。以下は未使用確認済みの計画名。実際の改名/保存/ハッシュ検証結果は、同じchange-details内の `character-relationship-chart-stage8-dropbox-receipt-2026-10-10.json` を正とする。本書やローカル成果物の生成だけをDropbox更新完了とは扱わない。

| 更新ファイル | 同じディレクトリの退避名 |
| --- | --- |
| `.vscodeignore` | `.vscodeignore.backup-2026-10-10-01` |
| `CHANGELOG.md` | `CHANGELOG.backup-2026-10-10-01.md` |
| `MGMT.md` | `MGMT.backup-2026-10-10-01.md` |
| `README.md` | `README.backup-2026-10-10-01.md` |
| `TESTING.md` | `TESTING.backup-2026-10-10-01.md` |
| `docs/DEVELOPMENT.md` | `docs/DEVELOPMENT.backup-2026-10-10-01.md` |
| `docs/PROCESS_CHART.md` | `docs/PROCESS_CHART.backup-2026-10-10-01.md` |
| `docs/RELEASE.md` | `docs/RELEASE.backup-2026-10-10-01.md` |
| `docs/STAGE8_PROMPT.md` | `docs/STAGE8_PROMPT.backup-2026-10-10-01.md` |
| `docs/architecture.md` | `docs/architecture.backup-2026-10-10-01.md` |
| `media/main.js` | `media/main.backup-2026-10-10-01.js` |
| `test/web-browser-check.js` | `test/web-browser-check.backup-2026-10-10-01.js` |
| `test/web-dom-check.js` | `test/web-dom-check.backup-2026-10-10-01.js` |
| `test/web-host.test.js` | `test/web-host.test.backup-2026-10-10-01.js` |
| `test/web-save-browser-check.js` | `test/web-save-browser-check.backup-2026-10-10-01.js` |
| `web/README-ja.md` | `web/README-ja.backup-2026-10-10-01.md` |
| `web/README.md` | `web/README.backup-2026-10-10-01.md` |
| `web/host.js` | `web/host.backup-2026-10-10-01.js` |
| `web/index.html` | `web/index.backup-2026-10-10-01.html` |
| `web/main.js` | `web/main.backup-2026-10-10-01.js` |
| `web/style.css` | `web/style.backup-2026-10-10-01.css` |

新規: SVGホスト/ブラウザ試験2本、受入条件/実機記入票/受入照合プロンプト/第9段階指示案4本、本変更明細、Web ZIP/VSIX/SHA一覧/検証ZIP。更新は完成内容準備→直前照合→元の改名→原本保持確認→同名書込→ハッシュ確認で行う。改名失敗では中止し、書込失敗時は既存の新ファイルを削除せず安全な場合のみ原名を復旧する。

復旧が必要な場合は、更新後のファイルも別の未使用バックアップ名へ改名して保護し、対応する元バックアップを原名へ戻す。直接上書きや削除はしない。新規ファイルもこの復旧では削除しない。

## 次の操作

`docs/STAGE8_PHYSICAL_DEVICE_CHECK.md` の**4項目**を実機で確認する。操作は `docs/STAGE8_ACCEPTANCE.md`。利用者結果と指定VSIX導入/Windowリロードを確認してから第8段階を正式完了にする。次のAI用指示は `docs/STAGE8_ACCEPTANCE_PROMPT.md`（標準推奨）。正式完了後、第9段階の構成整理は高推論を推奨し、`docs/STAGE9_PROMPT.md`を別途指示する。

SVGは編集用データの代わりにならず、ダウンロード開始だけで完了を判定しない。保存先はブラウザで確認する。フォントは埋め込まないため端末差がある。直接保存の既存の最終比較と確定の競合窓も残り、完全排他を保証しない。
