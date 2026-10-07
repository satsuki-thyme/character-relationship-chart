# 第7段階 実装・検証・Dropbox反映記録

記録日: 2026-10-04 JST。対象: `Dropbox\www\studio\character-relationship-chart`。

## 完了判定と現在地

**メモリーUndo/Redoの実装・自動検証・配布物生成・対象Dropboxへの実反映を完了。段階の最終受入は利用者確認と下書き保存の採否待ち。** 第1〜6段階の完了と過去履歴を維持する。第8段階は未着手・移行保留。commit/push、公開・デプロイは行っていない。

開始時にsources、IDAD、プロジェクト指示と現行ファイル、Git HEAD `9257b65ba87ae298421188e7ca79803b74930a62`、未コミット差分、受入・実機資料を確認した。取得時のGit差分は空。第6段階の完了根拠は2026-10-02 JSTのWeb3項目・VS Code追加3項目のokと、指定修正版VSIX導入・Windowリロード後に試験したという利用者確認。試験日・導入先ハッシュの空欄を推測で補っていない。

旧VSIX／Web ZIPのSHA-256は第6段階完了記録と一致し、旧VSIXの実装22対象と着手時ソースも一致した。利用上限中断後も第7段階を継続し、過去の「確認待ち」を現在の第6段階判定へ流用していない。

## 利用者から見た変更

- Webの「取り消し」「やり直し」と、文字入力欄の外でCtrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Yを追加。人物・グループ・関係・全体設定の反映／削除と、配置・倍率・表示状態を戻せる。
- 反映／削除1回、ドラッグ1回、配置・ズーム・fit・reset・ui変更1回が履歴単位。ホイールは各ズーム通知が1操作。人物ID変更／削除の参照と配置、JSONCコメント・BOM・改行も往復する。
- 新しい設定／表示編集でRedoを破棄。正常な設定読込または表示だけの読込で履歴を区切る。失敗・取消は保持。同名別作品へ履歴・配置を混ぜない。
- 未反映／応答待ちのフォームと保存中は履歴操作を拒否し、入力を保持する。文字入力欄ではブラウザの文字編集Undoを維持する。
- ページ内履歴は最大100操作／前後文字列のUTF-16概算16MiB。超過した古い履歴は除外して通知し、単独で上限を超える操作も残らない。現在の設定・図は保持する。

検索・選択・未反映フォームは履歴外。明示選択ハンドル、生バイト基準、確認済み保存スナップショット、競合／結果不明の停止も履歴外とした。Undo/Redoは実ファイルを変更せず、現在の設定／表示と各々の最新保存済み基準を比較してdirtyを計算する。ダウンロード開始は保存済み判定に使わない。保存中の追加編集は未保存として残す。

リサイズ補正や出力直前の捕捉でRedoを破棄しないよう修正した。画面寸法付きカメラの中心差だけ1e-7以内を計算誤差として扱い、保存座標や生バイト比較は丸めない。古い読込応答・古いフォーム版は履歴操作後の状態を上書きできない。

ローカル下書きの常時保存は未実装。再読込・終了で履歴と未保存内容は失われる。必要性、記録範囲、復元／破棄、機微データ、元ファイルとの識別、上限、失敗時保持を [STAGE7_DRAFT_DESIGN.md](../docs/STAGE7_DRAFT_DESIGN.md) に整理した。推奨は当面メモリーのみを採用し、実際に再読込による損失が課題なら明示選択式の下書きを追加すること。選択前には実装しない。

## 維持したもの

JSONC／version 1表示形式、IDと表示名、複数所属・関係参照・描画、既存coreのJSONC編集、coreの環境非依存、VS Code保存・WorkspaceEdit／Undo・競合保護を維持。名称・識別子・manifest 0.1.0、本番依存 `jsonc-parser` 3.3.1、package-lockを変更していない。新しい本番依存、人物データの外部送信、元データの自動バックアップ、ハンドルの再起動後復元は追加していない。Web SVG、本格再編、assignment、英語化は対象外。

ブラウザAPIには原子的な比較付き保存がなく、最終比較とcloseの間の外部更新を完全排除できない。既存の保存前比較・保存後照合・競合停止と、設定／表示の独立保存・ダウンロード退避を維持する。

## 検証

| 分類 | 結果 |
| --- | --- |
| 必須コマンド | `npm run check`、`npm test`、`npm run test:web`、`npm run build:web`、`npm run package` に成功 |
| Node／DOM | 通常132件（履歴新規16件）、共有UI／Web DOM46件（Web19件を含む）成功 |
| 実ブラウザ | Chromium143.0.7499.0で33操作群成功。履歴7、基本8、設定保存5、表示保存7、配置3、VS Code再表示3。最終Web ZIP展開物でも履歴7群を再確認し、重複加算しない |
| オフライン・通信 | file URLで起動／編集／ダウンロード、通常Web操作のHTTP(S)要求ゼロ、永続保存への書込なし。日本語表示・390pxも確認 |
| ネイティブAPI | 実ファイル読込、権限拒否時の元内容・カメラ・退避保持に成功。pickerはAbortError、書込権限denied。直接保存成功は今回未確認 |
| VS Code | 本番共有UI／アダプター／拡張コード＋模擬API／ファイルシステムで保存・配置復元・再表示・ドラッグを確認。実Extension Hostではない |
| 配布物 | Web9項目が独立再ビルドと一致。VSIX53項目を監査し、実装22対象がソースと一致。保護対象16ファイル不変 |

Node24.19.0、npm11.9.0、jsdom26.1.0。検証専用Playwright／Chromium／日本語フォントは配布物へ含めない。詳細と原ログ対応は [TESTING.md](../TESTING.md)、`verification/stage7/`、[証跡ZIP](../verification/character-relationship-chart-stage7-2026-10-04.zip)。

初回の画面寸法によるRedo消失とページ解放後の遅延通知を修正し、失敗ログを証跡ZIPへ保持した。既存ブラウザ試験の同名ファイル読込待機を人物IDの反映待ちへ修正。検証用single-process Chromiumのcontext終了制約は試験ラッパーの後処理で対応した。vsceの初回失敗は子プロセス出力の環境制約として切り分け、正式packageコマンドで生成した。監査で検出したdocs内の旧Web ZIP混入は除外規則を補って再生成し、旧資料自体は保持した。

Windows／macOSや他ブラウザでの今回版の操作、OS選択UI、ネイティブ直接保存成功、指定VSIX導入・実Extension Host／実Undoは利用者確認待ち。過去の第6段階okを今回版の結果へ読み替えていない。

## 成果物

| ファイル（対象ルートからの相対パス） | バイト数 | SHA-256 |
| --- | ---: | --- |
| `dist/character-relationship-chart-web-stage7-2026-10-04.zip` | 63671 | `579cc161bba31b70202923a625c0c876d6f1ba48dbff4ec9ee0a3095425f0acc` |
| `dist/character-relationship-chart-stage7-2026-10-04.vsix` | 430373 | `e0f6f677ceaefdc24259e4253d679936307e1fbe8ee39544e06ef8e6b795ef5c` |
| `verification/character-relationship-chart-stage7-2026-10-04.zip` | 433239 | `51c8408519ceddebf60be9ec116ae23e78317ed2847dc6c566896639869a20ca` |

一覧は [SHA256SUMS](../dist/character-relationship-chart-stage7-2026-10-04-SHA256SUMS.txt)。証跡ZIPには採用した原ログ、途中の失敗、コード／関連試験スナップショット、取得時基準、ソース差分、検証ラッパーを含める。作業用コピーのバックアップや依存実体、単発ダウンロードURLは同梱しない。反映補助スクリプトではなく、既存ファイルへ展開上書きする用途ではない。

## Dropboxへの実反映と原本保全

以下17ファイルは、完成内容の準備→同じフォルダーの既存名確認→直前のバイト基準／ID／rev照合→元ファイル自体の改名→元ID・原文保全の確認→元パスへ更新版の新規作成→保存完了とcontent hash照合を実施した。各処理の成功と保存内容を確認済み。直接上書き・コピーによる原本バックアップは行っていない。

| 更新ファイル | Dropbox上のバックアップ | 結果 |
| --- | --- | --- |
| `.vscodeignore` | `.vscodeignore.backup-2026-10-04-01` | 原文保全・更新版照合済み |
| `CHANGELOG.md` | `CHANGELOG.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `MGMT.md` | `MGMT.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `README.md` | `README.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `TESTING.md` | `TESTING.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `docs/DATA_FORMAT.md` | `docs/DATA_FORMAT.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `docs/DEVELOPMENT.md` | `docs/DEVELOPMENT.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `docs/PROCESS_CHART.md` | `docs/PROCESS_CHART.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `docs/architecture.md` | `docs/architecture.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `media/main.js` | `media/main.backup-2026-10-04-01.js` | 原文保全・更新版照合済み |
| `package.json` | `package.backup-2026-10-04-01.json` | 原文保全・更新版照合済み |
| `test/web-view-browser-check.js` | `test/web-view-browser-check.backup-2026-10-04-01.js` | 原文保全・更新版照合済み |
| `web/README-ja.md` | `web/README-ja.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `web/README.md` | `web/README.backup-2026-10-04-01.md` | 原文保全・更新版照合済み |
| `web/host.js` | `web/host.backup-2026-10-04-01.js` | 原文保全・更新版照合済み |
| `web/index.html` | `web/index.backup-2026-10-04-01.html` | 原文保全・更新版照合済み |
| `web/main.js` | `web/main.backup-2026-10-04-01.js` | 原文保全・更新版照合済み |

中断後の直前照合で `MGMT.md` に外部変更を検出し、改名・更新前に停止した。最新版を取得し、安定したrevと生バイトを確認。変更は第7段階の下への `進行中 ` 1行追加のみであり、その行をそのまま保持して親の進捗行だけ今回実績へ更新した。DropboxのMGMTバックアップにもこの追記を保持している。取得時基準と再取得基準を分けてreceiptに記録する。

新規の実装・試験・確認資料7ファイルも保存・照合済み:

- `docs/STAGE7_ACCEPTANCE.md`
- `docs/STAGE7_ACCEPTANCE_PROMPT.md`
- `docs/STAGE7_DRAFT_DESIGN.md`
- `test/stage7-history-browser-check.js`
- `test/stage7-history-dom-check.js`
- `test/web-history.test.js`
- `web/history.js`

上記24ファイルにWeb ZIP／VSIXの2件、`verification/stage7/` の検証ログ・監査・画像20件、証跡ZIP・SHA256SUMSの2件を加えた48件の保存完了と内容を確認した。この変更明細と最終receiptは別途同じ `change-details/` に追加する。反映後のソース120対象とGitのHEAD／index／main参照3対象、合計123対象も内容一致。Gitの履歴・インデックスは変更していない。

詳細なfile ID、改名前後のrev、SHA-256、Dropbox content hashと保存時刻は [反映receipt](character-relationship-chart-stage7-2026-10-04-dropbox-receipt.json) を参照。ローカル作業の各改名は `verification/stage7/local-backups.json` に分けて記録した。ローカルとDropboxで同名バックアップの版が同じとは限らない（MGMT再統合等）。

元へ戻す必要がある場合は、更新版をさらに未使用名へ改名して保持し、元パスが空でバックアップのハッシュが一致することを確かめてから、表のバックアップ自体を元名へ戻す。新規追加物の削除は別途確認してから行う。何も削除せずに復旧判断できる状態を保った。

## IDADに沿う次工程

次は [STAGE7_ACCEPTANCE.md](../docs/STAGE7_ACCEPTANCE.md) の1〜6を利用者が確認し、下書き採否を回答する。推奨モードは高性能モデル／高推論。次の実行指示は [STAGE7_ACCEPTANCE_PROMPT.md](../docs/STAGE7_ACCEPTANCE_PROMPT.md) に用意した。

主要GUIのUndo/Redoと新規編集によるRedo破棄、人物ID・配置・コメントの往復、設定／表示の独立した未保存判定、保存済み基準と競合停止の維持、未反映フォーム保持、VS Code既存動作を確認する。指定VSIXの導入・Windowリロードも報告する。下書きを採用する場合は第7段階内で追加実装・復元／破棄・元ファイルとの識別確認まで終える。

必須確認と採否がそろった後に第7段階の最終完了を記録する。現時点で第8段階への移行は保留で、SVG出力の実装は開始していない。
