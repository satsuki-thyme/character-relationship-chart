# 第6段階・VS Code直接保存後の再表示による配置変化の追加修正

記録日: 2026-10-01（Asia/Tokyo）。対象: `Dropbox\www\studio\character-relationship-chart\`。現在地は **修正済み・実機再確認待ち**。第1〜5段階の完了を維持し、第7段階は未着手。

今回の実装・自動検証・修正版配布物作成とDropboxへのソース／配布物反映を実施した。Windowsの修正版インストールと実Extension Hostによる確認は未実施なので、第6段階を完了にしない。Git commit/push、HTTPSサイトへの公開更新は行っていない。

## 調査の起点と履歴

最新版の `ai/etc/sources.md`、`ai/development-and-operations-model/idad-v1.md`、`ai/ChatGPT/project/character-relationship-chart/instructions-crc.md`、対象のREADME・MGMT・工程表・受入・TESTING・開発／設計資料、manifest・lockfile・現行ソース・関連テストを確認した。前回記録 `character-relationship-chart-stage6-fixes-2026-10-01-ja.md` の修正は既に現行ファイルに含まれ、そのまま出発点にした。旧実装や改名バックアップは再適用していない。

正本は `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md`。チェックボックスは実施済みであり、本文の結果を採用した。

| 前回の実機報告 | Web | VS Code |
| --- | --- | --- |
| 配置の復元 | ok | ok |
| 直接保存後の復元 | ok | ng: 図の表示が変わった |
| 連続ドラッグ・復帰 | ok | ok |

比較画像 `docs/images/stage6-physical-extension-host-1.png`、`stage6-physical-extension-host-2.png` を目視し、人物同士の位置関係の変化を確認した。単なる図全体の平行移動とは区別した。旧名 `docs/STAGE6-PHYSICAL-DEVICE-CHECK.md` は今回のDropbox現行docs一覧に存在しなかった。古い記録にある未受領／未反映等はその時点の履歴として扱う。

現行83ファイルと公開文書用画像4ファイルを取得してハッシュを照合した。Git HEAD/ref/indexを読み、HEADは `e215aee59bc38acfbe17276722b8fdda78a271bc`、main。indexの追跡81ファイルのうち取得した66ファイルを比較し23ファイルに差を確認した。未取得15ファイル、HEAD全treeとの差、staged状態は未確認。完全な `git status` を取得したとは扱わず、今回取得したユーザーの現在の原文を保護した。

## 再現と原因

本番 `media/main.js`、`media/vscode-host.js`、`src/extension.js`、`src/storage.js`、共通配置／表示処理を追跡した。保存処理自体は前回修正で全人物の座標を記録していた。一方、画面の `state.positions` は手動で動かした人物の上書き座標で、動かしていない人物の実描画座標は `positioned` にだけ存在した。

VS Code拡張の登録済み `onDidChangeViewState` コールバックはパネル再表示時に設定を再送する。本体の保存通知や表示データファイルを開く操作でも同じグラフの更新が届く。修正前の共通UIは同じグラフでも毎回 `G.layout(graph, state.layout, state.positions)` を実行し、手動配置以外の人物を再計算していた。その後の保存で変化後の配置が表示データへ記録される。

| 確認対象 | 今回の根拠と区別 |
| --- | --- |
| 保存ファイル | 修正前でも試験6人物全員の座標を保存。JSONと保存直前の描画座標は一致 |
| 保存直後の画面 | 保存だけでは描画座標を変更しない。画面の上書き座標は移動した2人物分 |
| ホストの再表示／設定更新 | 修正前は未移動4人物が変化。修正後は全6人物が完全一致 |
| 表示データファイルを開く | 本番拡張の操作とパネル再表示を実行し、同一設定通知による変化を修正前に再現 |
| 再保存・閉じて開き直し | 再表示後の保存JSON、再生成したパネルと復元座標を照合。修正後は元の全座標を維持 |
| 「配置を再読込」 | 明示的な表示読込は保存した全座標を復元。修正後も既存の読込処理を維持 |
| 倍率・画面サイズ | SVGの人物座標とカメラ変換を別に比較。修正前の失敗時もカメラ／倍率は同じで人物座標だけが変化 |

原コードの実Chromium再現例: 未移動人物kaiは `(170.82064032372477, 118.00832879843414)` から `(174.95453506677927, 135.50495898903281)`、elnaは `(-34.83538088121683, 134.13184916227746)` から `(-31.129412815102956, 155.5192626236749)` に変化。カメラは両方 `translate(459.2490762172316 453.6990656641422) scale(1.62)`。取得した原 `main.js` と同じハッシュのコードに新規試験を適用し、DOM4件中2件とブラウザ3操作群中2群がこの座標差で失敗した。修正版で同じ試験が全て成功した。

これは本番UI／アダプター／拡張を使い、VS Code APIとファイルシステムを模擬した再現である。利用者のWindows操作列を実Extension Hostで再現したとまでは扱わない。

## 変更内容と維持条件

`media/main.js` の設定受信で、前後の正規化済みグラフと有効レイアウトを比較する。同じグラフ／同じレイアウトの通知では `positioned` を維持し、再描画と状態通知を続ける。初回、グラフ変更、レイアウト変更では従来どおり配置を計算する。保存完了時に全人物を常時固定する方式にはしていない。

人物IDの変更・削除、固定座標の変更、未移動人物への設定変更、自動／円形配置と配置リセット、明示的な表示読込は従来規則に追従する。コメントだけを変えた本体の保存／文書版更新でも、正規化されたグラフが同じなら配置を維持する。未反映フォームを設定通知で消さない。

本体と `<本体ファイル名>.view.json` の分離、表示version1、識別子、拡張0.1.0、manifest／lockfile、共通core／schema／src／VS Codeホストは取得時と同一。未保存入力、独立した本体／表示保存、外部変更・競合・書込失敗時の保持は既存試験を通過した。製品の利用者データ保存に自動バックアップを追加していない。

新規回帰試験:

- `test/stage6-vscode-redisplay-dom-check.js`: 実UI・実アダプター・実拡張と模擬VS Code。保存JSON、登録されたパネル状態通知、同一設定通知、表示ファイルを開く、再保存、パネル再作成、表示再読込を全人物の座標で検証。設定変更・固定座標・ID変更／削除・未反映入力・リセットも確認。
- `test/stage6-vscode-redisplay-browser-check.js`: 実Chromiumのポインター操作と本番処理を使い、同じ失敗経路の描画と保存内容、連続ドラッグ、リセット／円形を検証。原コード比較用 `CRC_SHARED_UI_MAIN` を備える。

`.vscodeignore` には番号付きStage6実行プロンプトと新たな実機比較画像の除外を追加した。管理／工程／受入／検証／設計／README／CHANGELOGを現状へ更新し、初回と前回の実機報告は原文のまま履歴として残した。実機報告の更新前全文が更新後ファイルの先頭にそのまま保持されることも確認した。

## 実行した検証

| 実行 | 結果 |
| --- | --- |
| `npm ci --ignore-scripts` | 現行lockfileで依存を準備。manifest／lockfileの変更なし |
| `npm run check` と新規2テストの構文確認 | 本番19JS＋新規2JS成功 |
| `npm test` | 116件成功、失敗・取消・スキップ0 |
| 共有UI／Web／Stage6／新規DOM | 40件成功（12＋19＋5＋4）。Web19件を重複加算しない |
| 修正前の新規DOM | 4件中2件が配置差で失敗、2件成功 |
| 修正前の新規実Chromium | 3操作群中2群が配置差で失敗、1群成功 |
| 修正後の新規実Chromium | 3操作群成功 |
| 既存のWeb実Chromium | 表示データ7＋設定保存5＋前回回帰3＝15操作群成功。配置復元・直接保存・連続ドラッグ、競合・障害保持を含む |
| `npm run build:web` | 成功、静的配布9ファイル |
| `npm run package -- --out dist/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.vsix` | 成功、VSIX53ファイル |
| 配布物内容・展開後確認 | ソース対応・不要ファイル除外・ハッシュ一致。展開VSIXのcore解析／表示往復、展開Web ZIPの実Chromiumオフライン表示6人物とHTTP(S)要求／ページエラー0を確認 |

Linux／Node.js v24.19.0／jsdom26.1.0／Playwright／Chromium153.0.8010.0。検証用依存と日本語フォントはプロジェクト外に置き、配布しない。標準Playwrightブラウザ取得が不完全ZIPで失敗したため、検証用Headless153を用いた。single-process環境のcontext終了でブラウザが停止するため、前回回帰試験だけcontext破棄を最終browser.closeへ遅らせる検証用ラッパーで実行した。元のassertionは全て維持し、最初の環境起因の失敗ログも証跡に含める。元の既存テスト自体は変更していない。Webセキュリティは無効化していない。

**未確認:** 修正版の実Extension Host、WindowsへのVSIXインストール／実機再確認、実Undo、今回のOS picker・ネイティブ表示書込成功。Webの直接保存成功は模擬ハンドルでの今回の自動確認と、利用者の前回実機okを区別する。利用者の前回報告を今回の実機成功へ置き換えない。

詳細ログとキャプチャは `verification/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.zip`。25証跡ファイルとmanifestを収録し、原コード／新規試験、失敗→成功、環境制約、配布内容監査と展開確認を残した。

## 配布物と対応するソース

| 対象ルートからの相対パス | SHA-256 |
| --- | --- |
| `dist/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.vsix` | `e0ead4c9bf2ce8c4ed1f726c01f37bc93c061de556b337670ded900dfc15d226` |
| `dist/character-relationship-chart-web-stage6-vscode-redisplay-fix-2026-10-01.zip` | `244760a4767a46e8bbaa4f6ffe4ebc670590359055cea214f33eca8a32cb1539` |
| `verification/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.zip` | `a226d44fbe0d7cb7e1c52bb261516e752d8bfb6a56c135104aeab253e96b15a9` |
| `media/main.js`（導入判別用） | `1bad960562dc60ce8d5ca1b413bfda83f0ceaec6d9e460e07cd563cdd68ad3a9` |

VSIXの本番コードは現行ソースとバイト一致。READMEだけは公式vsceが相対リンクをGitHubのblob/HEAD等へ書き換えるため、その既知変換だけを正規化して照合した。Gitへpushしていないため、VSIX READMEのGitHubリンク先が今回版を示すとは限らない。今回の修正記録と同梱された実コード／ハッシュを参照する。VSIX manifestのpublisher `local`、ID `character-relationship-chart`、version `0.1.0` を確認した。

Web ZIP全9ファイルは生成物と一致し、app.jsに今回の再計算条件が含まれる。本番依存jsonc-parser3.3.1を含むVSIXの対応も監査した。バックアップ、テスト、検証ログ、変更記録、実機画像、実行用プロンプト、検証用フォントは配布物に含めない。両配布物のハッシュ一覧は `dist/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01-SHA256SUMS.txt`。

## Dropboxへの実反映とバックアップ

更新先は `/www/studio/character-relationship-chart/`。実ファイルの移動／書込完了応答を受領した。既存11ファイルは完成した更新版を準備後、更新直前の原文・版・既存バックアップを照合し、未使用の同ディレクトリ名へ元ファイルそのものを改名した。改名成功と元のcontent_hash保持を確認してから元のパスへ更新版を書いた。コピーをバックアップとして代用していない。

| 更新した元パス | 今回の改名バックアップ（同じディレクトリ） |
| --- | --- |
| `MGMT.md` | `MGMT.backup-2026-10-01-02.md` |
| `docs/PROCESS_CHART.md` | `docs/PROCESS_CHART.backup-2026-10-01-02.md` |
| `docs/STAGE6_ACCEPTANCE.md` | `docs/STAGE6_ACCEPTANCE.backup-2026-10-01-02.md` |
| `TESTING.md` | `TESTING.backup-2026-10-01-02.md` |
| `docs/DEVELOPMENT.md` | `docs/DEVELOPMENT.backup-2026-10-01-02.md` |
| `docs/architecture.md` | `docs/architecture.backup-2026-10-01-02.md` |
| `README.md` | `README.backup-2026-10-01-02.md` |
| `CHANGELOG.md` | `CHANGELOG.backup-2026-10-01-02.md` |
| `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` | `docs/STAGE6_PHYSICAL_DEVICE_CHECK.backup-2026-10-01-03.md` |
| `media/main.js` | `media/main.backup-2026-10-01-02.js` |
| `.vscodeignore` | `.vscodeignore.backup-2026-10-01-02` |

新規追加はテスト2本、dist配布物3本、verification証跡ZIP1本、本記録と反映記録JSONの計8本。従って今回の反映対象は既存更新11＋新規8＝19ファイル、保全バックアップ11ファイル。以前のバックアップはそのまま保持した。

本記録作成前に更新11＋新規6の計17ファイルとバックアップ11ファイルについて、保存先のDropbox content_hashを再取得し、生成物／保全対象と28件全て一致を確認した。本記録と反映記録JSONも新規追加後に同じハッシュ確認を行い、最終完了報告はそれらの成功後に行う。反映のファイルID・正規パス・保存完了応答・content_hashは同じchange-detailsの `character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01-dropbox-receipt.json` に記録する。受領票自身のハッシュは自己参照を避け、保存後に別途照合する。

改名・書込・照合の失敗は発生しなかった。作業用コピーや配布物生成のみで反映済みと判断していない。Dropbox更新完了とWindows実機の合格判定は別である。

復旧が必要な場合も現行版を直接上書きしない。現行版を新たな未使用バックアップ名へ改名・保全してから必要な原版を戻し、内容を照合する。今回は復旧／バックアップ再適用を行っていない。

## 同じ0.1.0の修正版を確実に導入する

1. 配布VSIXのSHA-256を上記一覧と照合する。
2. VS Code拡張画面の「…」→「VSIXからのインストール」で **今回のファイル名** を指定する。CLIの場合は対象ルートから次を実行できる。

   ```powershell
   code --install-extension ".\dist\character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01.vsix" --force
   ```

3. 開いていた図を閉じ、「Developer: Reload Window」を実行する。版数0.1.0だけでは新旧を区別できない。通常のWindows版のインストール先では次で導入済みmain.jsを確認する。

   ```powershell
   Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Directory -Filter 'local.character-relationship-chart*' |
     ForEach-Object {
       $crcMainPath = Join-Path $_.FullName 'media\main.js'
       if (Test-Path $crcMainPath) { Get-FileHash $crcMainPath -Algorithm SHA256 }
     }
   ```

   `1bad960562dc60ce8d5ca1b413bfda83f0ceaec6d9e460e07cd563cdd68ad3a9` と一致することを確認する。複数の拡張ディレクトリが出た場合は現在使用しているものを確認する。portable／カスタム拡張ディレクトリでは実際の導入先を使う。

参考: [VS Code公式CLI](https://code.visualstudio.com/docs/configure/command-line)、[公式Webviewの可視状態通知](https://code.visualstudio.com/api/extension-guides/webview#visibility-and-moving)。

## 利用者の次の短い確認

試験用の本体と対応する `<本体ファイル名>.view.json` を使う。今回版で自動配置から2人物を動かし、全人物の相対位置を基準にする。

1. 「表示データを保存」→表示データファイルを開く→図パネルを別タブへ切り替えて戻る。動かしていない人物も変わらない。
2. 再表示後にもう一度保存→図を閉じて本体から開き直す→「配置を再読込」。どちらも保存前の全人物の配置を維持する。
3. A→B→Cの連続ドラッグ、円形配置／配置リセットが動作する。結果を `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` 末尾の今回欄へ追記する。VS Code版数、今回VSIX名／導入ハッシュ、okか失敗操作を含める。

画面サイズや倍率による図全体の位置補正と、人物同士の位置関係の変化を区別する。以前の表示データに記録されていない失われた座標は復元できないため、今回版で目的の配置を作って保存する。Webの報告済み3項目を全てやり直す必要はない。前回の報告本文や比較画像は上書きしない。

次回依頼の例（通常の高性能モデル。再発調査が必要なら高推論）:

> Dropboxのcharacter-relationship-chartの最新版資料、今回の追加修正記録とSTAGE6_PHYSICAL_DEVICE_CHECK.md末尾のWindows実機結果を確認してください。今回VSIX／導入main.jsのハッシュを照合し、直接保存後の再表示・開き直し・再読込と既存配置操作の結果に基づき第6段階の受入を判定してください。合格した場合だけ管理・工程・受入・検証資料を第6段階完了へ更新し、既存ファイルは更新直前に原版を改名バックアップとして保全してDropboxへ反映し変更記録を残してください。不合格や未確認ならその状態を維持してください。Git commit/push、HTTPS公開更新、第7段階の実装は行わないでください。
