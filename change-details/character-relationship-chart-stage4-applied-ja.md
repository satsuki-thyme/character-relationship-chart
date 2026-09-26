# 第4段階の反映記録

[English](character-relationship-chart-stage4-applied.md)

対象: `Dropbox\www\studio\character-relationship-chart`。
実装・初回検証: 2026-09-24 UTC。中断していた反映作業の完了: 2026-09-27 JST。

## 完了した内容と範囲

Web版で、既存の共有GUIと `packages/core/edit.js` を使い、人物・グループ・関係・全体設定を編集できるようにした。反映した内容は元のファイル名を基本とするUTF-8のJSONC / JSONとしてダウンロードできる。編集はページ内のメモリーに保持し、元ファイルへ直接上書きしない。

複数グループ所属、人物・グループID変更時の参照追従、人物削除時の関係削除などはVS Code版と同じ意味を維持する。変更対象外のコメント・整形は既存coreの範囲で保持する。配列への追加・削除の近傍は整形が変わる場合がある。不正編集やダウンロード生成失敗では有効な図と入力を保持する。別の有効な設定へ切り替える際は、未反映入力・編集済み設定の破棄を確認する。ダウンロードの開始だけでは保存完了を判定できないため、編集済み状態は解除しない。

第3段階の読込・検索・詳細・ドラッグ・ズーム・配置切替を維持した。core実装、VS Codeアダプター、データ形式、版数、拡張ID、依存関係は変更していない。狭い画面へのCSS調整はWeb編集画面だけに限定した。

対象外: 元ファイルへの直接上書き、表示データ出力、永続保存、外部変更との競合管理、Web独自Undo/Redo、本格的な再編、公開・Marketplace、変数などの別課題。

## 反映ファイル

第3段階に対して、次の既存21ファイルを更新した。配布物2点を `dist/` に、本書と英語版を `change-details/` に追加した。

| パス | 変更内容 |
| --- | --- |
| `web/host.js` | 共通core編集・メモリー内文書・UTF-8ダウンロード |
| `web/main.js` | 共通エディター起動・ダウンロード・破棄確認 |
| `web/index.html` | ダウンロード操作と案内 |
| `web/style.css` | 狭い画面の編集欄 |
| `media/main.js` | ホスト能力・未反映入力・ID変更時の表示引継ぎ |
| `media/editor.js` | 反映の案内・入力保持・文書切替 |
| `media/ui.html` | 共有編集画面の案内 |
| `test/web-host.test.js` | ホスト編集・検証・順序制御・ダウンロード試験 |
| `test/web-dom-check.js` | GUI操作・失敗・ファイル再読込試験 |
| `test/web-browser-check.js` | 実ブラウザの編集・ダウンロード・再読込試験 |
| `README.md` | Web編集・ダウンロードの概要 |
| `CHANGELOG.md` | 第4段階の変更履歴 |
| `TESTING.md` | 検証範囲・結果・最終成果物のハッシュ |
| `MGMT.md` | 第4段階の完了行 |
| `docs/architecture.md` | 第4段階のホスト・UI契約と後続範囲 |
| `docs/DEVELOPMENT.md` | 実装・検証手順 |
| `docs/RELEASE.md` | 配布手順 |
| `packages/core/README.md` | core再利用の英語説明 |
| `packages/core/README-ja.md` | core再利用の日本語説明 |
| `web/README.md` | Web利用手順の英語説明 |
| `web/README-ja.md` | Web利用手順の日本語説明 |

再開時に、ソース・文書64ファイルと配布物2点をDropboxの内容ハッシュで確認した。その後に更新されていたルートREADMEのクレジットとMGMTの課題追記も読み、保持した。最終VSIXには最新クレジットを取り込んだ。初回の第4段階VSIXに対し、説明書以外の52エントリーはバイト単位で一致する。今回の仕上げではMGMTを上書きしていない。Gitのcommit・push、リリース作成、公開は実施していない。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| `npm run check` | 再開時に18実行・ビルドファイルで成功 |
| `npm test` | 80件成功、失敗・スキップなし。既存VS Code回帰を含む |
| DOMテスト | VS Code UI 12件＋Web配布物10件、計22件成功 |
| Web再生成 | 保存済みZIPの全9エントリーとバイト一致 |
| VSIX作成 | `npm run package` 成功、53エントリー。初回版との差はREADMEのクレジットのみ |
| 実ブラウザ | 初回の `TESTING.md` 記録: Chromium 153、8操作群成功。GUI編集、UTF-8の実ダウンロード、再読込後の再出力バイト一致を確認 |
| オフライン・安全性 | 初回実ブラウザで通常のHTTP(S)要求0件、CSP確認成功。永続保存・直接書込APIの呼出しなし |

今回の再開では通常・DOMテストと配布物の対応を再確認した。実ブラウザは初回の確認記録を参照し、再実行していない。実行コードは同一。デスクトップ版VS Codeへの実インストール、実Extension Host・Undo、Windows・macOS・Firefox・Safariは未確認。キャッシュ復帰はpersisted pagehideイベントによる確認で、実際の履歴移動を使うBFCache試験ではない。

## 最終配布物

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `dist/character-relationship-chart-web-stage4.zip` | 49853 | `6757a5422c8ff57c951e136c938425060f10101d8158ce950baa0527742222d1` |
| `dist/character-relationship-chart-stage4.vsix` | 424926 | `759a7b88001058f044a30f6ec5b6a5c23713f884b1692b0f80a0c77577860693` |

初回の第4段階VSIXは424877バイト、SHA-256は `2fd3c2f2160ac634937cf8a2fce7a2b8c42701d1845caa2fe7ae8ba992ff335f`。ユーザーによるREADMEクレジットの更新を取り込むためだけに差し替えた。`TESTING.md` の過去の検証記録は残し、最終確認の項目を別途追記した。

## 利用と戻し方

Web版ZIPをすべて展開し、`index.html` を開く。設定を開き、**編集 → 反映 → 編集画面を閉じる → 設定をダウンロード**の順で操作する。取得したファイルを再読込して内容を確認できる。配置変更は一時的であり、`.view.json` のダウンロードは今回の対象外。

動作だけを第3段階へ戻す場合は、`dist/` の既存の第3段階Web版ZIPまたはVSIXを使う。ソースを戻す場合は、後からの無関係な編集を保護したうえで、上記21ファイルだけを確認済みの第3段階履歴かDropboxの復元機能から戻す。リポジトリ全体をresetしない。Dropboxの [削除済みファイルの復元](https://help.dropbox.com/delete-restore/recover-deleted-files-folders) と [以前のバージョンの復元](https://help.dropbox.com/delete-restore/recover-older-versions) は、アカウントの保持期間内で利用できる。追加ファイルの削除は、別途明示的な依頼を受けて行える。Git管理下のプロジェクトに自動バックアップファイルは作成していない。

## 次の一手

現在地は第4段階の完了。まず利用するPCでテスト用の設定を編集・ダウンロード・再読込して使い勝手を確認する。続いて標準の推論モードで、次の計画作成を依頼できる。

> 現在のREADME、MGMT、設計書、IDADを確認し、残りの工程・依存関係・完了条件・推奨モード・各工程の実行プロンプトを `docs/PROCESS_CHART.md` にまとめて。完了済みの段階は保持し、今回は計画だけ作成して、次段階の実装は始めないで。

計画の確認では、表示データ保存・直接上書き・Undoを個別の判断事項として残す。
