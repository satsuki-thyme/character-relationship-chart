# Character Relationship Chart 第6段階変更明細

実施日: 2026-10-01 JST（2026-09-30 UTC）。対象: `Dropbox\www\studio\character-relationship-chart`。名称・拡張ID `local.character-relationship-chart`・コマンド・0.1.0・データversion 1を維持。

## 完了判定と反映状況

**実装・自動検証済み／表示データのネイティブ直接保存は実機確認待ち。第7段階は未着手・移行保留。** 第5段階は2026-09-28 JSTの利用者報告で完了済みのまま維持する。今回ネイティブ表示保存の実機結果は受け取っていない。

最新IDAD、プロジェクト指示、README、MGMT、工程表・設計・開発・データ仕様、TESTING、Stage5受入・完了明細と現在の82ソースを確認。第5段階完了版27対象中25対象がバイト一致し、残るMGMT／工程表の違いはユーザー更新だった。未反映のStage5実装はなく、再適用していない。`.git` を確認し、HEADは `e215aee59bc38acfbe17276722b8fdda78a271bc`。取得時の `.gitignore`・MGMT・工程表の未コミット差分、未追跡 `prompt/STAGE6_PROMPT.md` を保護した。

作業用ソースへ直接更新して検証した。Dropbox接続には既存ファイルの比較付き上書き機能がないため、Dropbox既存ソースを変更していない。削除・改名による置換はしていない。取得時の差分と82ソースSHA-256を守る反映用ZIPを提供する。利用者の反映後に現在ソースと配布物を照合する必要がある。開発バックアップ・commit/push・公開・デプロイは行っていない。

## 利用者から見た変化

「表示データをダウンロード」で現在の配置・倍率・表示位置・描画領域サイズ・配置方式・詳細欄・図だけ表示をUTF-8 JSONに出力する。設定本体は別に保存／ダウンロードし、両方を選んで復元する。`cast.jsonc` に `cast.jsonc.view.json`、`cast.json` に `cast.json.view.json`。検索・選択・フォーム未反映入力は表示ファイルに入らない。人物ID変更・削除に配置キーが追従し、変更された本体の固定座標を優先する。

対応環境では「表示データを直接保存用に開く」で既存の対応ファイルを明示選択し、「表示データを保存」で更新する。「表示データの新規保存先を選ぶ」は明示選択された新規／既存の空ファイルだけを受け付ける。中身のある選択先は書込前に拒否し、既存読込経路へ案内する。設定ハンドルから隣の表示ファイルを探索しない。APIで新規作成か既存ゼロバイトかは識別できず、空ファイルとして扱う。pickerが作った空ファイルは失敗後に自動削除しない。

設定と表示の保存先・生バイト基準・未保存・停止状態は別に管理する。表示のみの再読込は設定・版・保存先・フォームを保ち、表示の未保存変更だけ確認する。本体切替は同名でも旧表示と両保存先をリセットする。同名の別作品をファイル名／人物ID以上で自動識別する形式は追加しないため、利用者が意図した組を選ぶ。

第5段階の権限要求、全バイト比較、確定前の再比較、write／close、保存後の再読込照合を表示にも使う。競合・権限・書込失敗で設定・図・配置・入力を保ち、表示ダウンロードで退避できる。close・読戻し・abort等で結果不明ならその保存先だけを停止し自動再送しない。保存中は二重保存／ファイル切替を止め、新しい編集は未保存として残す。ダウンロード開始だけでは保存済みにしない。

原子的な比較付き保存のAPIはなく、exclusiveは他アプリに対する完全なOS排他ではない。最後の比較とcloseの間の更新を完全に防げず、検出した保存後不一致も既に失われたデータの回復を保証しない。設定と表示の二ファイル取引もない。保存操作中に他アプリ・同期機能から同じファイルを書き換えない。公式根拠はWeb READMEへ記載した。

## 実装と維持範囲

既存coreの `normalizeState` / `encodeState` / `parseState` と共有UIを再利用。`viewCapture` と `captureView` はメモリー受渡しのみで、VS Codeの `viewStorage` 自動保存をWebで有効にしない。初期描画を未保存にせず、共有可変参照を持たない。`web/file-access.js` は文字限度だけ一般化し、Stage5の書込保護を共用する。

core・src・Schema・サンプル・package.json／lockfile・本番依存はバイト一致。VS Code保存・Undo・競合のホストは変更していない。共通UIの保存経路は従来を維持し模擬API／DOM回帰を行った。新しい本番依存なし。検証用jsdom／Playwright／Chromium／日本語フォントはプロジェクト外。Web Undo/Redo・自動保存・常時永続化・ハンドル再起動復元・Web SVG・再編・assignment・英語化は実装していない。既存英語Web READMEの変更点追記だけ行った。

## 検証結果

| 項目 | 結果 |
| --- | --- |
| check | 19本番JavaScript成功 |
| npm test | 116成功、失敗・スキップ0 |
| npm run test:web | 19成功、失敗・スキップ0 |
| 共有UI＋Web DOM | 31成功（12＋19） |
| 既存Chromium試験 | 基本8＋設定保存5操作群成功。保存APIは模擬ハンドル |
| 表示Chromium試験 | 7操作群成功。実ドラッグ・倍率・詳細出力、ID変更、組の復元、独立保存・新規空／既存非空、競合／拒否／write／close／照合不一致と入力保持、非対応環境、390px |
| ネイティブ表示API | 実ハンドルの読込・同一性・permission、拒否時の実ファイル／配置／退避を確認。OS open/save pickerはAbortError、readwriteはdenied。**直接保存成功は未確認** |
| 通信／オフライン | file URL＋offline。通常操作中HTTP(S)要求・ページエラー0。CSPの意図的拒否は別記録 |
| build／package | 必須コマンド成功。Web9ファイル、VSIX53ファイル。実行コード・資産をソースと照合しVSCEのREADMEリンク変換だけ許容 |
| 配布物展開後 | Webオフライン起動・両実ダウンロード・組の再読込と設定バイト一致、要求／エラー0。VSIX同梱coreの解析・編集・表示往復、6人物／8経路 |
| 反映補助 | Linux／PowerShell7.4.19で確認のみ・反映・再実行と、変更・新規衝突・payload破損・リンク・.git不足の拒否を確認。Windows5.1／選択ダイアログ未確認 |

実行ログ: `verification/stage6/`。Linux Node24.19.0、npm11.9.0、jsdom26.1.0、Chromium Headless153.0.8010.0。コンテナー起動用no-sandbox・no-zygote・single-process・SwiftShader等を使用しWebセキュリティは維持。公式Chrome151の起動はProcessSingleton socketの環境制限で失敗。日本語フォントを検証環境に追加して画面を確認した。アプリへ外部フォント／要求は追加していない。

未確認: 実PCでの表示データの正常書込・再読込／競合停止と実内容確認、新規保存先OS UI、Windows/macOS／他ブラウザ、VSIX実インストール・Extension Host・実Undo、Windows反映補助。模擬試験の成功をこれらへ読み替えない。

## 更新ファイル

取得時からの更新:

- `.vscodeignore`
- `CHANGELOG.md`
- `TESTING.md`
- `MGMT.md`
- `README.md`
- `test/web-browser-check.js`
- `test/web-dom-check.js`
- `test/web-host.test.js`
- `docs/DATA_FORMAT.md`
- `docs/RELEASE.md`
- `docs/DEVELOPMENT.md`
- `docs/architecture.md`
- `docs/PROCESS_CHART.md`
- `web/README-ja.md`
- `web/main.js`
- `web/index.html`
- `web/file-access.js`
- `web/host.js`
- `web/README.md`
- `web/style.css`
- `media/main.js`

新規ソース・文書:

- `docs/STAGE6_ACCEPTANCE.md`
- `docs/STAGE7_PROMPT.md`
- `test/web-view.test.js`
- `test/web-view-browser-check.js`
- `test/web-view-native-check.js`
- `change-details/character-relationship-chart-stage6-implementation-2026-10-01-ja.md`


`.gitignore` と `prompt/STAGE6_PROMPT.md` は取得時からバイト不変。MGMTのユーザー変更とassignment、工程表の過去記録・ソース反映記録は保持して第6段階を追記した。過去の検証／配布物は変更していない。

## 成果物

- `dist/character-relationship-chart-web-stage6.zip`: 59,604 bytes、SHA-256 `9c5015b493a8fa94c3f3a5d7842f70d69d60585339991d0b75f0dd4af2a865fc`。
- `dist/character-relationship-chart-stage6.vsix`: 427,104 bytes、SHA-256 `91f4296cd5c2bf24440af6f66f1d83336b33c37a86ca19c827f65af3772e8fb8`。

- 完全ソース `character-relationship-chart-stage6-source.zip`。`.git`・node_modules・バックアップ・生成配布物・検証用依存を含めない。
- 反映用 `character-relationship-chart-stage6-update-windows.zip`。`.git` がある対象を選び、まず確認のみ、次に適用。取得時82ソースと変更後SHA-256を守り、新しい差分で停止する。既存変更を強制上書きしない。複数ファイル全体の原子性はなく、途中失敗時は反映済み一覧を表示する。
- 全成果物のSHA-256一覧。パッケージ自身のハッシュは別一覧に置き、自己参照を避ける。

## 工程表と次の指示

現在地は第5段階完了・第6段階実装／自動検証済み、実機確認と既存ソース反映待ち。まず `docs/STAGE6_ACCEPTANCE.md` の表示保存・復元・競合保護を確認する。第6段階の完了を記録した後に第7段階へ進める。第7段階は高性能モデル／高推論を推奨。自己完結した次回実行指示は `docs/STAGE7_PROMPT.md` に作成したが、今回は第7段階へ着手していない。IDADに沿って、保存済み基準を履歴で巻き戻さないUndo/Redoを最小構成で設計し、常時下書き永続化の採用は別途必要性と利用者の選択を確認する。

## 検証記録更新の追記（2026-10-01 JST）

保存済み成果物と原ログを照合し、根拠ログ表、実機報告欄、管理表・工程表を更新した。実行コードと依存は変更していない。上記成果物のハッシュと反映補助のpayload47件の試験は初回の記録として保持する。回収した初回配布パッケージは最終payload49ファイルであり、その後の記録更新版の件数・成果物照合は [検証記録更新明細](character-relationship-chart-stage6-verification-2026-10-01-ja.md) に記録する。空のネイティブログ2件は成功根拠に使わない。ネイティブ表示保存成功とDropboxへの反映は未確認／未完了のままで、第7段階には進んでいない。
