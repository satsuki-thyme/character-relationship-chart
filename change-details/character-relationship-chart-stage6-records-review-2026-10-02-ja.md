# 第6段階の実機報告・自動検証記録の照合と文書更新

記録日: 2026-10-02（Asia/Tokyo）。対象: `Dropbox\www\studio\character-relationship-chart`。

## 判定

**第6段階は「実機操作は合格報告済み・検証対象の確認待ち」。完了は保留。**

現行 `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` の本文で、VS Code追加3項目はすべて `ok`。前回Web3項目の `ok` と初回確認1〜5の成功、確認6のファイル名の勘違い解決も引き継いだ。チェックボックスだけで判定せず、前回VS Codeの直接保存後の `ng` と、追加修正後の `ok` を分けた。

残る必須確認は1点。既存の受入条件にある「新VSIXを導入済みと確認」を裏付ける結果が未記載である。同じ0.1.0の再配布なので、報告欄に案内されたVSIX名・期待ハッシュを導入確認結果には使わない。配布物と現行ソースが一致しても、利用者のインストール先との一致を証明したことにはならない。

必要な回答: **追加3項目は `character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.vsix` を再インストールし、開いていた図を閉じてVS Codeを再起動した後に試した結果か。** その条件で実施済みなら、その旨の確認でよく、3操作の再試験は不要。試験時の導入済み `media/main.js` の一致情報でも対象を確認できる。現在測ったハッシュを過去の試験時の実測値にはしない。

第1〜5段階の完了判定は維持。第7段階は未着手・第6段階完了記録待ち。今回の記録日を、未記載の実機試験日や第6段階完了日として扱わない。

## 参照資料と実機結果

着手時に `ai/etc/sources.md`、`ai/development-and-operations-model/idad-v1.md`、`ai/ChatGPT/project/character-relationship-chart/instructions-crc.md` を読んだ。中断後の再開でも3資料のrevisionが同じことを確認した。反映先は指定Dropboxフォルダー。索引にあるGitHub対応先へは操作しない。

README、MGMT、工程表、受入資料、実機報告書、TESTING、前回追加修正記録を現行内容で照合。原ログ・配布物・対応する実行ソース・回帰テストを必要範囲で取得した。

| 実機報告の段階 | Web版 | VS Code版 | 扱い |
| --- | --- | --- | --- |
| 初回確認 | 1〜5がok、6の対応名の勘違いは解決 | — | 主要保存・競合停止／保持・退避の既存報告を引き継ぐ |
| 前回修正版 | 配置復元／直接保存後の復元／連続ドラッグがok | 配置復元ok、直接保存後の復元ng、連続ドラッグok | ngと比較画像を履歴として保持 |
| 追加修正後 | 前回3項目のokを引き継ぐ | 保存直後・再表示、再保存・開き直し・配置再読込、連続ドラッグ・円形・リセットの3項目がok | 操作結果を受領。実際の導入対象との対応は確認待ち |

環境欄はWindows 11 26H2／Chrome 154.0.8037.59／HTTPS。追加VS Code試験の詳細版数・実施日は未記載。これは利用者のWindows実機報告であり、今回AIがWindowsや実Extension Hostで再実行した結果ではない。

## 今回行った照合と、過去の試験結果

今回はアプリの試験コマンド、DOM試験、ブラウザ試験、Extension Host試験を**再実行していない**。以下は保存済み原ログの読取りと照合である。

根拠の主ファイル: `verification/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.zip`。manifest記載25証跡のサイズとSHA-256がすべて一致した。

| 原ログ（証跡ZIP内） | 照合した結果 | 検証環境・限界 |
| --- | --- | --- |
| `check.log`、`unit.log` | 本番19JSの構文検査記録、通常116件成功、失敗・取消・スキップ0 | Node.js。VS Codeの保存等は模擬APIを含む |
| `dom.tap` | 40件成功（12＋19＋5＋4）、失敗・取消・スキップ0 | jsdom。Web19件や新規4件を二重加算しない |
| `redisplay-before.tap` | 修正前4件中2失敗 | 過去の失敗比較を保持 |
| `vscode-redisplay-browser-before.json`／`-final.json` | 修正前3群中2失敗、修正後3群成功 | 本番UI・アダプター・拡張＋模擬VS Code API／ファイルシステム。実Extension Hostではない |
| `stage6-browser-final.json` | 配置・連続ドラッグ等の3操作群成功 | 実Chromiumの描画・ポインター。VS Code側は模擬API |
| `web-view-browser.json`、`web-save-browser.json` | 表示保存7＋設定保存5操作群成功 | 保存成功・競合・障害は模擬ハンドル／注入条件を含む |
| `artifact-audit.json`、`artifact-smoke.json` | 配布物の監査一覧と展開後動作の記録 | 今回は再実行せず、実物のハッシュを監査一覧と照合 |

関連する実Chromium結果は合計18操作群（3＋3＋7＋5）。記録上の環境はLinux／Node.js v24.19.0／jsdom26.1.0／Chromium153.0.8010.0。初期の環境起因の失敗と、context終了を遅らせた検証用ラッパーの使用は既存記録の制限として保持する。

別途 `verification/stage6-fixes/web-view-native-check-final.json` を読んだ。実ファイル読込・拒否時の内容保持は記録されているが、OS pickerはAbortError、書込権限はdenied。自動環境のネイティブ表示書込成功は未確認のまま残し、利用者のWeb実機okと混同しない。

## 現行ソース・配布物との対応

下記は今回実物を取得して計算したSHA-256。前回追加修正記録と一致した。

| 対象 | SHA-256 |
| --- | --- |
| 修正版VSIX `dist/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.vsix` | `e0ead4c9bf2ce8c4ed1f726c01f37bc93c061de556b337670ded900dfc15d226` |
| 修正版Web ZIP `dist/character-relationship-chart-web-stage6-vscode-redisplay-fix-2026-10-01.zip` | `244760a4767a46e8bbaa4f6ffe4ebc670590359055cea214f33eca8a32cb1539` |
| 追加修正証跡ZIP | `a226d44fbe0d7cb7e1c52bb261516e752d8bfb6a56c135104aeab253e96b15a9` |
| 現行 `media/main.js` | `1bad960562dc60ce8d5ca1b413bfda83f0ceaec6d9e460e07cd563cdd68ad3a9` |

- VSIXの53ファイルのうち監査一覧51項目、Web ZIPの9項目について過去の監査SHA-256と一致。VSIX manifestはpublisher `local`、ID `character-relationship-chart`、version `0.1.0`。
- 現行ソース19対象がVSIX内の対応物とバイト一致: `package.json`、`media/` の `editor.js`・`graph.js`・`main.js`・`style.css`・`ui.html`・`vscode-bootstrap.js`・`vscode-host.js`・`vscode-theme.css`、`src/` の5JS、`packages/core/` の5JS。
- 新規回帰テスト2本 `test/stage6-vscode-redisplay-dom-check.js` と `test/stage6-vscode-redisplay-browser-check.js` は証跡ZIP内ソースとバイト一致。
- Webの現行HTMLに共有UIテンプレートを挿入した内容と、共有CSS・Web CSSが修正版ZIPに一致。前回Web ZIPとの実差分は `app.js` の同一graph／layoutでの再配置抑制だけだった。
- 再開後、取得済みソース25対象・回帰テスト2本・修正版配布物2本・証跡ZIPの計30対象についてDropboxの内容ハッシュとサイズを再照合し、中断前から不変と確認した。

全リポジトリの網羅比較、Webバンドルの再ビルド照合、利用者環境のインストール済み拡張のハッシュ測定は実施していない。配布物内の旧管理文書は作成時点の記録であり、今回の文書更新を取り込むためだけの再生成は行わない。

## 未確認情報と影響

| 未確認／未記載 | 完了判定への影響 |
| --- | --- |
| 追加3項目を実施したVSIXの実導入対象 | **完了を妨げる残件**。新VSIX導入・再起動後の試験である旨を確認する |
| VS Code詳細版数、正確な実機試験日 | 補足情報として未記載を保持。新たな必須試験にはしない |
| 追加確認3の「可能なら」の倍率・詳細欄・図だけ表示 | 必須の連続ドラッグ・円形・リセットのokと区別。個別実施を推測しない |
| 実Undo、個別の権限拒否・故障条件、別OS | 今回の最小完了条件を追加しない。既存の自動試験と実機報告の範囲を維持 |
| 最新Web ZIPを使った新たなWindows実機試験 | 未実施として扱う。ユーザー指定どおり前回Web3項目を引き継ぎ、再試験を追加の必須条件にしない |

## 更新内容とバックアップ

既存6文書を更新。判定・現在地をそろえ、実機報告書の「未実施」を結果受領済みへ整理し、実施日が不明なことを明記した。過去のng・比較画像・検証履歴・第1〜5段階の完了・assignmentは保持した。READMEも現在の待機理由に合わせた。

作業用コピーとDropboxの両方で、完成した更新内容を先に準備し、元ファイルの内容／版と既存バックアップを確認。元ファイルそのものを以下の同一ディレクトリ名へ改名し、原文の内容ハッシュを確認してから元のパスへ新規作成した。コピーによるバックアップや直接上書きはしていない。

| 更新ファイル | 改名バックアップ（同じディレクトリ） | Dropbox反映 |
| --- | --- | --- |
| `MGMT.md` | `MGMT.backup-2026-10-02-01.md` | 反映・照合済み。その後の利用者によるリンク変更も保持 |
| `docs/PROCESS_CHART.md` | `docs/PROCESS_CHART.backup-2026-10-02-01.md` | 反映・照合済み |
| `docs/STAGE6_ACCEPTANCE.md` | `docs/STAGE6_ACCEPTANCE.backup-2026-10-02-01.md` | 反映・照合済み |
| `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` | `docs/STAGE6_PHYSICAL_DEVICE_CHECK.backup-2026-10-02-01.md` | 反映・照合済み |
| `TESTING.md` | `TESTING.backup-2026-10-02-01.md` | 反映・照合済み |
| `README.md` | `README.backup-2026-10-02-01.md` | 反映・照合済み |

実際の反映先は `/www/studio/character-relationship-chart/`。6バックアップのID・内容ハッシュ・サイズが取得時の元ファイルと一致することを確認し、6更新版の保存完了と内容を確認した。

中断後の再開時、`MGMT.md` のリンクだけが `\prompt\STAGE6_PROMPT.md` から `/docs/STAGE6_*.md` に変わっていた。これは反映後の外部編集として保持し、古い作業用コピーを再アップロードしていない。第6段階の判定・第1〜5段階・assignmentは変わっていなかった。現在のMGMTはこのリンク編集を含む4069バイト版である。

実機報告書とREADMEの最初の保存直後照合では一致判定が成立しなかった。READMEでは読取側の一時的な `NOT_FOUND` 応答を確認した。更新版もバックアップも削除・再アップロードせずに再取得し、最終的に期待するサイズ・内容ハッシュの一致を確認した。実機報告書は全文とmetadataも確認した。改名失敗、データ喪失、復旧操作は発生していない。

新規追加は本明細と `character-relationship-chart-stage6-records-review-2026-10-02-dropbox-receipt.json`。受領票に保存先・ファイルID・サイズ・内容ハッシュ・中断後の照合を記録する。両ファイルは新規保存後に独立照合し、その成功を確認して最終報告する。受領票自身のハッシュは循環参照を避け本文へ埋め込まない。

元へ戻す必要がある場合も、現行版を新しい未使用バックアップ名へ改名して保全し、元の名前が空いていることを確認してから必要な原版を戻す。今回は復旧・過去バックアップ再適用を行っていない。

## 維持した範囲と次の工程

ソース、データ形式、識別子、版数、依存関係を変更せず、配布物を再生成しなかった。edgeの枠線を握ってドラッグする課題を含む `MGMT.md` のassignmentは保留のまま。Git commit/push、サイト公開、Marketplace公開、第7段階の実装は行っていない。

次は検証対象の1点確認と第6段階完了記録。推奨は標準モデル／通常推論。利用者の確認を記録し、現行資料に新しい不合格・矛盾がないことを確認できれば、操作をやり直さず完了記録をそろえる。

`docs/STAGE7_PROMPT.md` は読取のみ行った。第7段階の目的はWeb Undo/Redoと復旧性、推奨は高性能／高推論。開始条件は第6段階の完了記録と次の明示的な実行指示である。既存プロンプトに残る開発時の「バックアップ作成を行わない」という旧記述は現行の改名バックアップ規則と矛盾するため、実行用として渡す際に訂正が必要。今回は第6段階が未完了なので、同ファイルの更新や第7段階への着手はしていない。
