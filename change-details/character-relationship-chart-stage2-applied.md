# Web版転用・第2段階の反映記録

実施日: 2026-09-24 UTC  
対象: `/www/studio/character-relationship-chart`  
状態: ソースとVSIXの反映・内容照合を完了。本書は照合後に作成した。

## 実装内容

- `packages/core` にJSONCの解析・編集、描画計算、表示データの検証・シリアライズを分離。実際のVS Code拡張と共有UIがこのコアを使用する。
- VS Codeのファイル操作、文書の版と競合管理、旧保存状態の移行、Webviewの通信は既存アダプターに残す。従来のモジュールパスにはCommonJSの互換入口を置いた。
- ノードのクリックとEnter/Spaceでは従来どおり詳細を開く。ドラッグでは詳細を開かず、既存の選択も変えない。位置の保存・再読込を維持し、`pointercancel` では選択を変更しない。
- 全エッジ線の上に専用のラベル層を置き、ラベルと背景がすべてのエッジ線・矢印より前に描画されるよう変更。SVG出力も同じ順にし、ラベルのクリック、選択強調、検索、キーボード操作を維持した。
- 表示データの200,000文字上限を移行時にも適用し、既存ファイルが上限を超える場合は旧保存状態を削除しない。SVG出力で重複していた名前空間宣言も修正した。
- 設計書、開発・配布手順、README、変更履歴、検証記録を更新。作業中に更新された `MGMT.md` の変数対応・英語化などの記載を保持し、第2段階の完了行だけを追加した。

データ形式、拡張ID・表示名・版数、本番依存とlockfileは維持した。独立Web版の起動・ファイル保存は後続段階の対象。関連する設計は [architecture.md](../docs/architecture.md)、詳しい検証範囲は [TESTING.md](../TESTING.md) を参照。

## 検証結果

環境: Linux、Node.js v24.19.0、npm 11.9.0、検証専用のjsdom 26.1.0。

| 検証 | 結果 |
| --- | --- |
| `npm run check` | 本番JavaScript15ファイルで成功 |
| `npm test` | 66件成功、失敗・スキップなし |
| DOM回帰検証 | 12件成功、失敗・スキップなし |
| 共通コアの独立性 | 実jsonc-parserを含め、Node組込み・process・Buffer・DOM・VS Code APIのないVMで解析・編集・表示状態・描画計算を実行 |
| コードの移動 | 解析・編集・描画計算の実装と、正規化・エンコードの既存関数が第1段階と一致 |
| プレビュー | 2ページ・13アセットのHTTP取得、共有コアの内容、standalone画面のアダプター分離を確認 |
| `npm run package` | 成功。53ファイル、422,390バイト |
| VSIXの中身 | 実行コードが検証したソースと一致。コア・依存・LICENSEを含み、テスト・管理文書・変更記録・バックアップを除外 |
| VSIX展開後の実行 | 実サンプルの解析・編集・表示状態の往復・8本の経路計算、Webviewの参照先を確認 |
| Dropboxの保存内容 | 更新33ファイルと維持22ファイル、計55ファイルのサイズ・Dropbox content hashが期待値と一致 |
| 作業用ファイル | 対象9ディレクトリを確認し、今回の一時ファイルの残存なし |

実ブラウザエンジンとデスクトップ版VS Codeがないため、見た目・実ポインター入力・CSPの実適用・VSIX実インストール・Extension Host・Undo・OS別動作は未確認。DOM検証では画面寸法、ポインターキャプチャ、一部描画タイミングを模擬している。実機での確認手順は `TESTING.md` に記載した。

## 配布物

[character-relationship-chart-stage2.vsix](../dist/character-relationship-chart-stage2.vsix)

- 拡張ID: `local.character-relationship-chart`
- 表示名: `Character Relationship Chart`
- バージョン: `0.1.0`
- サイズ: `422390` bytes
- SHA-256: `c9216e831f1c87dee31378c6724bfcf6634c1740a8c8b53ba27e36d0fcf25215`

## 反映したファイル

既存23ファイルを更新し、新規10ファイル（共通コア8・テスト1・VSIX1）を追加した。本記録の保存先は `change-details/character-relationship-chart-stage2-applied.md`。表はDropboxが返した正式なパスと保存後のファイルID。全行の処理状態は `success`、内容照合済み。

| 操作 | 正式なパス | 保存後のファイルID | 状態 |
| --- | --- | --- | --- |
| 追加 | `/www/studio/character-relationship-chart/packages/core/README-ja.md` | `id:pdXqx4wRBdMAAAAAAAKVKQ` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/README.md` | `id:pdXqx4wRBdMAAAAAAAKVKA` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/config.js` | `id:pdXqx4wRBdMAAAAAAAKVKg` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/edit.js` | `id:pdXqx4wRBdMAAAAAAAKVKw` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/graph.js` | `id:pdXqx4wRBdMAAAAAAAKVLA` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/index.js` | `id:pdXqx4wRBdMAAAAAAAKVLQ` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/package.json` | `id:pdXqx4wRBdMAAAAAAAKVLg` | success |
| 追加 | `/www/studio/character-relationship-chart/packages/core/view-state.js` | `id:pdXqx4wRBdMAAAAAAAKVLw` | success |
| 追加 | `/www/studio/character-relationship-chart/dist/character-relationship-chart-stage2.vsix` | `id:pdXqx4wRBdMAAAAAAAKVMA` | success |
| 追加 | `/www/studio/character-relationship-chart/test/core.test.js` | `id:pdXqx4wRBdMAAAAAAAKVMQ` | success |
| 更新 | `/www/studio/character-relationship-chart/.vscodeignore` | `id:pdXqx4wRBdMAAAAAAAKVMg` | success |
| 更新 | `/www/studio/character-relationship-chart/CHANGELOG.md` | `id:pdXqx4wRBdMAAAAAAAKVMw` | success |
| 更新 | `/www/studio/character-relationship-chart/README.md` | `id:pdXqx4wRBdMAAAAAAAKVNA` | success |
| 更新 | `/www/studio/character-relationship-chart/TESTING.md` | `id:pdXqx4wRBdMAAAAAAAKVNQ` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/DATA_FORMAT.md` | `id:pdXqx4wRBdMAAAAAAAKVNg` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/DEVELOPMENT.md` | `id:pdXqx4wRBdMAAAAAAAKVNw` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/RELEASE.md` | `id:pdXqx4wRBdMAAAAAAAKVOA` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/architecture.md` | `id:pdXqx4wRBdMAAAAAAAKVOQ` | success |
| 更新 | `/www/studio/character-relationship-chart/media/graph.js` | `id:pdXqx4wRBdMAAAAAAAKVOg` | success |
| 更新 | `/www/studio/character-relationship-chart/media/main.js` | `id:pdXqx4wRBdMAAAAAAAKVOw` | success |
| 更新 | `/www/studio/character-relationship-chart/media/style.css` | `id:pdXqx4wRBdMAAAAAAAKVPA` | success |
| 更新 | `/www/studio/character-relationship-chart/media/ui.html` | `id:pdXqx4wRBdMAAAAAAAKVPQ` | success |
| 更新 | `/www/studio/character-relationship-chart/package.json` | `id:pdXqx4wRBdMAAAAAAAKVPg` | success |
| 更新 | `/www/studio/character-relationship-chart/src/config.js` | `id:pdXqx4wRBdMAAAAAAAKVPw` | success |
| 更新 | `/www/studio/character-relationship-chart/src/edit.js` | `id:pdXqx4wRBdMAAAAAAAKVQA` | success |
| 更新 | `/www/studio/character-relationship-chart/src/extension.js` | `id:pdXqx4wRBdMAAAAAAAKVQQ` | success |
| 更新 | `/www/studio/character-relationship-chart/src/storage.js` | `id:pdXqx4wRBdMAAAAAAAKVQg` | success |
| 更新 | `/www/studio/character-relationship-chart/src/webview.js` | `id:pdXqx4wRBdMAAAAAAAKVQw` | success |
| 更新 | `/www/studio/character-relationship-chart/test/host.test.js` | `id:pdXqx4wRBdMAAAAAAAKVRA` | success |
| 更新 | `/www/studio/character-relationship-chart/test/preview.js` | `id:pdXqx4wRBdMAAAAAAAKVRQ` | success |
| 更新 | `/www/studio/character-relationship-chart/test/storage.test.js` | `id:pdXqx4wRBdMAAAAAAAKVRg` | success |
| 更新 | `/www/studio/character-relationship-chart/test/ui-dom-check.js` | `id:pdXqx4wRBdMAAAAAAAKVRw` | success |
| 更新 | `/www/studio/character-relationship-chart/MGMT.md` | `id:pdXqx4wRBdMAAAAAAAKVSA` | success |

追加したフォルダー:

| パス | フォルダーID | 状態 |
| --- | --- | --- |
| `/www/studio/character-relationship-chart/packages` | `id:pdXqx4wRBdMAAAAAAAKVJQ` | success |
| `/www/studio/character-relationship-chart/packages/core` | `id:pdXqx4wRBdMAAAAAAAKVJg` | success |

転送サービスの一時エラーで不一致となった一時ファイルは、正しい内容の再送・照合後に削除した。取得に失敗した転送も再送済み。正式ファイルの差し替え前には旧内容と一時保存内容を再照合し、保存後も全対象のハッシュを確認した。

`.git` が存在するため、プロジェクト内にバックアップは作成していない。commit・push・公開は行っていない。

## 元に戻す方法

既存23ファイルの差し替えにはDropboxの復元可能な削除を使用した。元に戻す場合は、同名の現行ファイルを退避し、更新前のファイルをDropboxの「削除済みファイル」から復元する。保存期間と操作方法は [Dropbox公式の復元手順](https://help.dropbox.com/delete-restore/recover-deleted-files-folders) を参照。

今回追加した10ファイルと本記録を削除し、新規フォルダーが空なら削除することで追加分を取り除ける。削除の代行は別途指示を受けて実行する。既存の第1段階のVSIX・記録は引き続き保存されている。
