# Architecture

`Character Relationship Chart` は、VS Code 拡張機能と Web アプリで共通の中枢機能・UI を利用する構成とする。

```text
character-relationship-chart/
├─ packages/
│  ├─ core/              # データ解析・検証・内部モデルなどの中枢機能
│  ├─ ui/                # 相関図の表示・編集UI
│  ├─ vscode-adapter/    # VS Code 固有処理
│  └─ web-adapter/       # Web 固有処理
│
├─ apps/
│  ├─ vscode-extension/  # VS Code 拡張機能
│  └─ web/               # Web アプリ
│
├─ examples/
├─ docs/
└─ package.json
```

## 役割

- `core`
  - JSONC の解析
  - スキーマ・設定の検証
  - characters / groups / edges の内部モデル化
  - 表示用データの生成
  - VS Code やブラウザ固有 API には依存しない

- `ui`
  - キャラクター、グループ、エッジの表示
  - 拡大縮小、ドラッグ、GUI 編集など
  - VS Code Webview と Web アプリで共有する

- `vscode-adapter`
  - VS Code コマンド、コンテキストメニュー
  - `workspace.fs`
  - Webview
  - `.view.json` の読み書き
  - ファイル変更監視

- `web-adapter`
  - ファイル選択・ドラッグ＆ドロップ
  - ローカル下書き保存（採否未決定、現行はメモリーのみ）
  - ブラウザでの読み込み・保存

## 基本方針

`.jsonc` のデータ形式は VS Code 拡張機能専用にはせず、`Character Relationship Chart` 全体の共通形式とする。

```text
                ┌─ VS Code 拡張機能
core ── ui ─────┤
                └─ Web アプリ
```

環境依存処理が増えた場合のみ `vscode-adapter` / `web-adapter` に切り出す。

特に `core` は **VS Code やブラウザの存在を知らない** 状態を保つ。

## 第1段階の記録（2026-09-23）

第1段階では既存の `src/`・`media/` 配置のまま、UIとVS Codeの入出力境界を分離した。以下の表はその段階の記録。現在の構成は後述の第2〜第6段階を参照。

| 区分 | 第1段階のファイル | 責務 |
| --- | --- | --- |
| 共有UI | `media/ui.html`、`main.js`、`editor.js`、`style.css` | 画面構造、描画、操作、入力保持。VS Code API・メッセージ通信には直接触れない |
| 配置・経路計算 | `media/graph.js` | 既存の環境非依存処理。変更なし |
| VS Code側のUIアダプター | `media/vscode-host.js` | 共通操作を既存メッセージに変換。受信通知の振り分け、編集結果の対応付け、旧Webview状態の消去 |
| VS Codeでの起動・テーマ | `media/vscode-bootstrap.js`、`vscode-theme.css` | APIを一度取得してUIへホストを注入、VS Code色を共通テーマ変数へ対応付け |
| VS Codeのホスト側 | `src/extension.js`、`storage.js`、`webview.js` | コマンド、編集・Undo、ファイル入出力、監視、競合検知、CSP・URI変換。HTML本体は共有UIを組み込む |

### UIとホストの契約

ホストは以下の操作を提供する。`RelationsUi(host)` を、画面のHTMLと共有スクリプトを読み込んだ後に文書ごとに一度だけ呼ぶ。UIが購読を設定した後、`ready()` で初期データを要求する。UI内部からホストの種類を判定しない。

| 操作 | 内容 |
| --- | --- |
| `onConfig(callback)` | `{config?, graph?, documentVersion, issues, fileName?, dirty?}` を通知。版は同じ文書内で増加する整数。構文・検証エラーではconfig/graphを省略し、直前の有効な図と入力を残す |
| `onView(callback)` | `{viewState, fileName?}` を通知。初期読込・再読込・人物ID変更後の配置を復元 |
| `onStorage(callback)` | `{status, message?, fileName?, exists?}` を通知。statusは `pending` / `saved` / `error` |
| `editConfig(operation, baseVersion)` | Promiseで `{ok, config?, documentVersion?, index?, message?}` を返す。操作形式は既存の `src/edit.js` と同じ。失敗またはPromise拒否時に入力を残す |
| `updateView(state)` | 現在の配置・倍率・表示状態をホストへ渡す。保存の延期、直列化、競合防止はホストの責務 |
| `saveView()` / `reloadView()` | 表示データの即時保存要求／保存済みデータの再読込要求 |
| `openSource()` / `openView()` | ホスト側で本体／表示データを開く |
| `exportSvg(svg)` | UIが生成したSVGをホスト側で保存 |
| `ready()` | 初期通知を要求。購読完了前には呼ばない |

購読は解除用の関数を返す。VS Codeアダプターは `pagehide` / `dispose()` で購読を解除し、未完了の編集要求を拒否する。要求のID・`postMessage`・`message` イベント・`setState` はアダプター内に閉じ込める。生のVS Code APIをグローバルやUIへ渡さない。

受信時に通知の種類と外形を検査する。データの詳細な検証は既存の解析・編集・保存処理が引き続き担当する。編集の応答待ちに新しい設定通知が届いた場合は、新しい版を優先する。保存結果が不明なときに自動再送しない。

### 保持する挙動と次の段階

- `.jsonc` とその末尾に `.view.json` を付ける保存形式、人物ID、複数所属、線の形を維持する。
- JSONC編集、ファイル保存、Undo用のVS Code編集、外部変更検知、バックアップを自動作成しない挙動は既存ホスト側に残す。
- HTMLは固定の共有テンプレート。利用者の文字列は既存の `textContent` 等で描画する。CSPとローカル資産の制限はVS Code側で維持する。
- `style.css` は共通の `--theme-*` 変数と従来の既定色を使う。VS Code変数との対応は `vscode-theme.css` のみに置く。
- 第1段階の次工程は解析・編集・表示データ検証の共通化とした。その実施結果を以下に記す。テスト用ホストをWeb製品版とは扱わない。

検証方法と今回の範囲は [DEVELOPMENT.md](DEVELOPMENT.md) と [../TESTING.md](../TESTING.md) を参照。
## 第2段階の実装（2026-09-24）

既存設計の次工程に沿って、環境に依存しない実処理を `packages/core/` へ集約した。最終構成のうち、現時点で切り出したパッケージは `core`。UIとVS Codeのアダプターは第1段階の境界を保ち、既存ディレクトリで動作する。

| 現在の配置 | 責務 |
| --- | --- |
| `packages/core/config.js` | JSONCの解析・検証と表示用モデル生成 |
| `packages/core/edit.js` | コメント・整形を保持するJSONC編集、ID変更・削除時の参照追従 |
| `packages/core/view-state.js` | 表示データの検証、文字列からの読込、JSON文字列への変換 |
| `packages/core/graph.js` | 配置・線の経路・領域計算。通常のscriptとCommonJSに対応 |
| `packages/core/index.js` | 共通コアの公開入口。契約は [core/README-ja.md](../packages/core/README-ja.md) |
| `src/storage.js` | VS Codeのファイル入出力、書込順序、競合・未保存変更の保護、移行 |
| `src/extension.js` | 共通コアを呼び、VS Codeの文書・診断・Undo・コマンド・監視へ接続 |
| `src/config.js`、`src/edit.js`、`media/graph.js` | 既存CommonJS利用側の互換入口。実装の複製を持たない |

coreにはVS Code、DOM、Node.js組み込みモジュール、ファイル・ネットワーク・ブラウザ保存APIへの依存を持たせない。既存の `jsonc-parser` だけを使い、ホストが文字列・通常のデータを渡す。`.jsonc`、`.view.json`、外部キー、上限、診断位置、既存GUI編集の意味を維持する。保存・競合・Undoは引き続きホストの責務。

Webviewは共有の `packages/core/graph.js` を直接読み込む。資産URIと `localResourceRoots` は `media/` と `packages/core/` を対象にし、nonceを使うCSPを維持する。ほかのcore APIはCommonJSの入口を持つ。Web向けのバンドル・ファイル操作・保存・競合・Undoの実装は次の段階に残す。

### 同時に行ったUI修正

- ノードはクリックまたはEnter／Spaceで詳細を開く。3 CSSピクセルを超える移動はドラッグとして扱い、既存の詳細表示・選択を変えず位置だけ保存する。pointercancelでは詳細を開かない。
- SVG内の順序は関係線、全ラベル、人物枠。ラベルとその背景を全関係線・矢印より前へ置く。再描画・検索・選択でも同期し、SVG保存でもこの順序を保つ。
- ラベルをクリックした場合も対象の関係を選択する。関係のキーボード操作は従来の操作点を維持し、ラベルで重複させない。

## 第3段階の実装（2026-09-24）

第3段階は読取専用の最小Web版に範囲を限定した。共通コアと共有UIを実際に使い、ファイルの読込から表示まで成立させる。保存・編集・Undo・競合管理・本格的なディレクトリ再編は対象外。

| 配置 | 責務 |
| --- | --- |
| `web/host.js` | FileReaderによる利用者が選んだファイルの読込。共通コアのJSONC・表示データ検証、通知、読込要求の順序制御 |
| `web/main.js` | Web起動、ファイル選択・ドロップ、同梱サンプル、ページ終了時の解放 |
| `web/index.html`、`web/style.css` | 読込操作、読取専用の案内、Webの画面枠とCSP |
| `scripts/build-web.js` | 共有HTMLを組み込み、esbuildで実コア・jsonc-parser・共有UIをブラウザ用に束ねる。ライセンス・説明書・サンプルもコピー |
| `dist/web/` | 生成した静的配布物。`index.html` を直接開ける。生成物としてGit管理から除外 |

`web/` とビルドスクリプトだけを追加し、既存の `src/`・`media/`・`packages/core/` を維持する。コアの解析や描画をWeb用に再実装しない。`jsonc-parser` 3.3.1の公開ESM入口をバンドラーで選び、CommonJSコアの読込を解決する。実行時にNode.js・モジュールローダー・CDN・サーバーを必要としない。Web側はGUIエディターとVS Codeアダプターを読み込まない。

### ホスト契約の追加

`host.capabilities` の `edit`・`viewStorage`・`openSource`・`exportSvg` は、省略するとすべて有効。既存VS Codeホストは従来の契約で動く。Webホストはすべてfalseとし、対応する操作・購読・保存呼出しを共有UIで止める。利用できない操作は画面に表示しない。Webホスト自身にも編集・保存・SVG出力メソッドを持たせない。

`onView` の通知に任意の `reset: true` を追加。別の設定ファイルを開いたとき、共有UIが前の選択・検索・ドラッグ・配置・カメラをリセットする。同じ設定の表示データだけを読み込む場合はリセットしない。通常のVS Code通知はこのフラグを付けず、従来どおり処理する。

### 読取専用の挙動

- UTF-8のJSONC / JSONを1つと、任意でその完全なファイル名に `.view.json` を付けた表示データを受け付ける。同じフォルダーのファイルを自動探索しない。
- ファイルサイズで読込前の割当てを制限し、文字数・型・参照の制約は共通コアで検証する。両ファイルの検証が済んでから一緒に表示へ反映する。不正な入力・読込失敗では直前の有効な図を保つ。
- 読込の完了順が逆転しても最後に要求したものだけを反映する。これは画面の読込順序の制御であり、保存競合管理ではない。
- 検索・詳細・拡大縮小・ドラッグ・配置切替・図だけ表示を共有する。配置変更は画面のメモリー上だけ。元のファイル、localStorage、IndexedDB等へ書き込まない。
- 外部リソース・通信を使わず、CSPでも接続を禁止する。サンプルはビルド時に同梱する。

## 第4段階の実装（2026-09-24）

第3段階を拡張し、共通GUIによる人物・グループ・関係・全体設定の編集と、設定ファイルのダウンロードに対応した。既存の `packages/core/edit.js` をそのまま使用し、Web専用のJSONC編集処理は追加していない。コア5実装ファイルとVS Code側アダプター、データ形式、依存・版数は維持した。

- `web/host.js` は読み込んだJSONC文字列と有効な解析結果をページ内に保持する。`editConfig(operation, baseVersion)` は共通コアの編集・検証が成功した後だけ文字列と図を更新する。ID変更、複数所属、人物削除時の関係削除は既存コアと同じ。失敗では版・有効な設定・GUI入力を保持する。
- Webは `capabilities.edit: true` と `persistEdits: false` を宣言する。`persistEdits` は編集の適用時にファイルへ保存するかを表し、省略時は従来のVS Code動作を維持する。共有エディターはWebで「反映」と案内し、VS Codeでは従来の「保存して反映」とする。`viewStorage`・`openSource`・`exportSvg` は引き続きfalse。
- Webの `downloadConfig()` は保持中の文字列をUTF-8のBlobにして、ブラウザのダウンロード機能へ渡す。元の `.jsonc` / `.json` の名前を基本とし、元ファイル・表示データ・ブラウザ保存領域へは書き込まない。URLは遅延解放する。開始に成功しても利用者の保存完了は判定できないため、編集済みフラグは解除しない。生成失敗では文字列・図・フォームを変更せず再試行できる。
- `onConfig` に任意の `rename` を追加し、Webで人物IDを変えた場合も共有UIが一時配置と選択を引き継ぐ。VS Codeの既存の配置通知は変更しない。別ファイルへの切替時は `onConfig.reset: true` も通知し、明示的に破棄を承認した古いフォームを新しい設定へ切り替える。
- `RelationsUi(host)` は `hasPendingEdits()` を返す。Webは未反映の入力または編集済みの設定があれば、検証済みの別設定を適用する直前に破棄確認を行う。取消・読込失敗では入力を保持する。ページ終了・再読込は `beforeunload` で注意を促すが、ブラウザによって表示されない場合があるため永続保存の代わりにはならない。
- 読込失敗は有効なメモリー文書の版を更新せず、その文書のGUI編集を継続できる。表示データだけの読込もJSONC文字列・編集状態を変えない。成功したGUI編集は古い未完了の読込要求を無効にする。これは同一ページ内の順序制御であり、外部ファイルの競合管理ではない。
- `web/main.js` は共有の `media/editor.js` を追加で読み込み、ダウンロードボタンと離脱・切替確認だけを接続する。390px幅で編集一覧のボタンが入力欄へはみ出さないよう、WebのCSSで折り返す。

ダウンロードは反映済み設定の全内容を出力し、未反映フォームを暗黙に適用しない。コメント・改行・インデントは既存coreの範囲で保持するが、追加・削除した箇所の近傍はjsonc-parserが整形することがある。ファイル全体をJSON.stringifyで作り直さない。

## 後続段階

第1〜6段階は完了。第7段階のUndo/Redoを実装・自動検証し、利用者の最終確認待ち。ブラウザ保存領域は設計のみで採否未決定、SVG保存は第8段階で扱う。`packages/ui`・各adapter・`apps/` への全面移動、公開、英語化も今後の課題として扱う。

## 第5段階の実装（2026-09-28 JST、完了）

既存構成を維持して、設定本体の直接保存だけを追加した。core・VS Codeホスト・データ形式・本番依存は変更していない。

| 配置・API | 責務 |
| --- | --- |
| `web/file-access.js` | 能力判定、ハンドルからのUTF-8読込、読込時の生バイト列、権限要求、比較・ステージング・確定・再読込 |
| `web/host.js` | `openHandle(handle)`、`saveConfig()`、基準文字列／バイト列、保存中・保存停止状態、設定版と編集済み状態 |
| `web/main.js` | 利用者操作でのpicker起動、保存とダウンロードの案内、離脱保護。ハンドルを次回起動へ永続化しない |
| `onSaveState(callback)` / `getSaveState()` | Web固有の `{available, saving, blocked}`。共有UIのホスト契約へは追加しない |

`persistEdits: false` は継続する。「反映」そのものは保存ではない。Web向けの案内だけを `media/editor.js` で更新した。VS Code向けの文言・処理は維持する。

直接保存用に開いた設定が検証を通り、既存の破棄確認も承認されたときだけ、ハンドルと同じ読込結果のバイト列を保持する。通常のファイル入力・ドロップ・サンプルで設定を切り替えるとハンドルを解放する。失敗・取消・表示データだけの読込では元の保存先と基準を維持する。直接保存経路は不正UTF-8の非可逆な置換を拒否し、BOMを含む文字列をcoreへ渡す。

保存手順は、ボタン操作中の `requestPermission({mode:'readwrite'})` → 元バイト列比較 → `createWritable({keepExistingData:false, mode:'exclusive'})` → 再比較 → 反映済み文字列のUTF-8バイト列をwrite → 確定直前の再比較 → close → 新しいgetFileの生バイト列と保存対象の照合。比較対象は時刻やサイズだけでなく全バイト列とする。競合・確定前の失敗ではstreamをabortし、元の基準や編集内容を採用し直さない。closeの失敗、保存後の不一致／読込失敗、abort失敗では保存結果が不明なため直接保存を停止する。自動再送・自動マージはない。

成功した保存内容だけが次の基準となる。保存中に新たなGUI反映があれば、その新しい文字列と保存済みスナップショットを比較してdirtyを維持する。保存は文書版を増加させず、graph/view/resetなしの同じ版の通知でフォーム・配置を保つ。未反映フォームは保存対象外。設定切替と二重保存は保存中に拒否し、古い未完了読込も無効化する。ページ解放時は可能な範囲で確定前のstreamを中断する。

制約: 標準APIに原子的な比較付き置換はなく、exclusiveは外部アプリへのOS全体の排他保証ではない。最後の比較からcloseまでの競合窓、および検証後の変更までは防げない。完全な共同編集・同期制御を実装したとは扱わない。第5段階の最小競合保護として、検出できた変更では確定しない。公式資料はWeb READMEにリンクした。

ネイティブAPIによる実ファイル読込と権限拒否時の保持は自動環境で確認済み。別途、利用者の実機で通常保存・再読込、外部変更時の警告・保存停止を確認した。OS・ブラウザ版数や各失敗ケースの個別実機結果は未提示のまま記録する。第5段階は完了。第5段階完了時点では第6段階は未着手だった。現在の第6段階は次節を参照。詳細は `PROCESS_CHART.md` と `STAGE5_ACCEPTANCE.md`。

## 第6段階の実装（2026-10-01 JST、当時は実機確認待ち）

共有UIの現在状態を `updateView(state, {initialize})` へ渡し、Webホストが `normalizeState` / `encodeState` で独立したコピーを保持する。`viewCapture: true` はメモリー捕捉だけを有効にし、従来の `viewStorage` 自動保存操作を有効にしない。VS Code側は従来どおり `viewStorage` 経路を使う。`captureView()` は出力直前に実寸を含むカメラを捕捉する。初期fit／読込後の補正・不要ID除去は初期基準へ一度だけ採用し、開いただけで未保存にしない。

| 責務 | 契約・状態 |
| --- | --- |
| 共有UI | `positions`、`camera`、`layout` / `configLayout`、`ui`。検索・選択は出力対象外。ID変更・削除と固定座標優先は既存規則 |
| Web表示捕捉 | `updateView`、`getViewState`、`hasViewEdits`。正規化JSONの比較基準 `originalView` とメモリー状態。共有可変参照なし |
| Web表示出力 | `downloadView`、`openViewHandle`、`saveView`、`saveViewAs`、`onViewSaveState` / `getViewSaveState`。設定の保存APIは維持 |
| 表示直接保存 | `viewTarget` は選択済みハンドル・生バイト基準・停止状態。設定側の `target` / `originalText` と混ぜない |

通常読込で表示データだけを差し替える場合は設定の版・保存先・未反映フォームを保持し、表示の未保存変更だけ確認して表示保存先を解除する。設定を切り替えると、同名でも旧表示状態と両保存先をリセットする。設定と表示データの組は両方を検証した後に一括して採用し、古い非同期読込や編集中の新しい状態を上書きしない。対応名は本体名に `.view.json` を追加する。ファイル名・ID以上の作品識別子は形式に追加しないため、同名の別作品は利用者が正しい組を選ぶ。

新規保存は利用者のクリック中に `showSaveFilePicker` を呼び、明示選択された対応名のゼロバイトファイルのみ採用する。新規か既存空ファイルかはAPIの返り値から識別できない。非空は書込前に拒否し、既存表示読込経路へ案内する。設定本体と同一ハンドル／`isSameEntry` の保存先も拒否する。設定ハンドルから親ディレクトリ・隣のファイルを探索しない。

読込限度を表示データ用にして第5段階の `writeOriginal` を共用する。生バイト基準は正常読込／成功した照合結果だけで更新する。競合・権限・write失敗で設定・図・入力を保持し、結果不明はその表示保存先のみ停止する。保存中は二重保存とファイル切替を止め、新しい表示操作／設定反映が生じた場合はスナップショットとの差を未保存として残す。フォームを暗黙に反映しない。ダウンロードはdirtyを解除しない。

原子的な比較付き保存はAPIにない。exclusiveストリームでも外部アプリとの完全排他にはならず、最後の比較からcloseまでの競合窓が残る。設定と表示の二ファイル取引もない。自動保存・常時永続化・ハンドル復元は実装しない。公式仕様・制限はWeb README、検証範囲はTESTING、実機受入は `STAGE6_ACCEPTANCE.md`。

## 第6段階の不具合修正（2026-10-01 JST）

`media/main.js` の保存境界で全 `positioned` 座標と本体ノードの署名をスナップショット化する。操作中の手動移動位置と出力用の完全な配置を分け、設定更新時の従来の配置計算を維持する。読込済みの有効な座標は既存coreの固定点として復元する。ホスト契約・形式・VS Code自動保存の時機は変更しない。設定ID変更により表示スナップショットにも変更が生じるため、設定だけの保存は表示側の未保存を解除しない。

人物移動と背景パンは単一の `drag` 状態を共有し、別ポインターによる置換を拒否する。終了処理をpointerup・pointercancel・lostpointercapture・window blur・pagehide・document hiddenから共用する。中断時は移動した座標を保持するが、人物選択や詳細表示を起動しない。新しい設定・表示通知は古い状態を保存先へ送信せずに現在の操作を終了する。背景開始処理は人物／関係のヒット対象を除外する。これは共有UIの責務であり、両環境へ適用する。

参考: [W3C Pointer Events Level 3](https://www.w3.org/TR/pointerevents3/#implicit-release-of-pointer-capture)。検証・実機判定は `TESTING.md` と実機報告書を参照する。


## VS Codeの同一設定再表示とライブ配置（2026-10-01 JST）

全人物の座標を持つ保存スナップショットと、手動移動だけを持つライブ上書きは引き続き分離する。VS Codeのpanel状態変更や本体保存では、同じ正規化graphが `onConfig` に再通知される。共有UIは前のgraphと次のgraphの内容、および採用する表示layoutを比較し、両方同じ場合は `positioned` をそのまま再描画する。保存成功通知を配置変更の指示として扱わない。

graphまたは採用layoutが変わった場合は、人物IDの追従・不要ID除去・固定座標署名・本体layout優先を既存どおり適用し、`G.layout` を実行する。明示的な `onView` による表示データ再読込も既存どおり配置を計算する。layout選択とresetは上書きを消して再計算する。全人物をライブで常時固定する方式には変更しない。ホスト契約・データ形式・保存・競合処理に変更はない。


## 第7段階の履歴契約（2026-10-04 JST）

第6段階は2026-10-02 JSTに受入完了。その後の本実行でWebのメモリー履歴を追加した。`web/history.js` は前後の不変文字列 `{text, view}` のスタックだけを管理する。`web/host.js` が既存coreで編集・解析し、共有UIへ図とフォームの同じ文書版を通知する。

| 対象 | 単位・扱い |
| --- | --- |
| JSONC本文と正規化表示データ | 反映／削除1回、人物・背景ドラッグ1回、配置・倍率・fit・reset・ui変更1回。ID変更／削除のpositions参照とUIの同期配置捕捉を同じ履歴へ含める |
| フォーム | 履歴外。未反映・応答待ち中は `canTravel` で拒否。文字欄のUndoはブラウザに任せ、暗黙の反映／破棄なし |
| 保存先・生バイト基準・確認済み保存文字列 | 履歴外。現在の設定／表示を各保存済み基準と比較しdirtyを再計算。ダウンロードは基準を更新しない |
| 競合／結果不明・保存中 | 履歴外。停止はUndo/Redoで解除しない。どちらか保存中は両履歴操作を拒否する。新規編集は可能で、保存されたスナップショット以後の変更をdirtyとして残す |
| 検索・選択 | 出力／履歴外。現行設定に存在しない選択は詳細で未選択相当になる。古い作品の選択・検索は設定読込時に消す |

`undo()` / `redo()` はserialと文書版を増やす。読込応答とフォームの古い版は現状を上書きできない。`onView({deferLayout:true})` の直後に `onConfig({restoreView:true})` を同期通知し、旧設定で一度配置してしまうことを避ける。共有UIは復元時だけ配置を強制再計算し、同一VS Code設定の再通知では従来どおり現配置を保持する。VS Codeホスト・WorkspaceEdit・保存競合処理に履歴は追加しない。

正常な設定読込・表示だけの読込で履歴を区切る。表示読込は設定の版・保存先・未反映フォームを保持し、表示保存先だけ更新／解除する。失敗・取消は履歴を保持する。作品名が同じでも旧履歴を混ぜない。新規反映／表示変更はRedoを破棄し、同値捕捉・失敗した編集・保存・ダウンロードは破棄しない。

`captureView()` は出力直前の実寸捕捉を `record:false` で行い、`finishInteraction()` は実行中のドラッグだけを確定する。画面サイズ補正は編集と数えない。双方に画面寸法があるカメラは `(x-width/2, y-height/2)` を絶対誤差1e-7以内で比較し、倍率と他の項目は正規化後に完全比較する。保存される座標やファイルの生バイト比較は丸めない。

上限は100操作か前後文字列のUTF-16概算16MiB。超過する古い履歴を除外しlimitedを通知する。単独で上限を超える操作は履歴に残らない。現在の図・設定・保存基準は保持する。disposeで解放、再起動後の復元なし。ローカル下書き保存は [設計・選択](STAGE7_DRAFT_DESIGN.md) のみ。外部通信、本番依存、形式、識別子、manifest 0.1.0は変更しない。

ブラウザの保存APIには原子的な比較付き確定がない。履歴を導入しても最終比較とcloseの間の外部変更を完全排除できるようにはならない。

## 第8段階のSVG出力契約（2026-10-10 JST）

- 共有 `media/main.js` が図全体を生成し、既存の `host.exportSvg(svg)` へ渡す。Webは `capabilities.exportSvg: true`、戻り値 `{ok, fileName?, message?}`。VS Codeの既存メッセージとvoid戻り値は維持し、保存成功を推測しない。
- `RelationsUi(host, {onExportResult})` の任意コールバックでWeb側の開始/失敗表示を行う。未反映Webフォームと設定エラー・空図では停止。シリアライズ失敗も捕捉し入力を保持する。
- `web/host.js` は既存Blob出力にMIME引数を追加し、SVGには `image/svg+xml;charset=utf-8` を使う。設定・表示データのJSON MIMEは維持。画像出力はview捕捉・JSONC変更・保存先書込・履歴追加・dirty解除・競合解除をしない。
- SVGはグラフ全領域、線→ラベル→人物の順序、計算済みテーマ色を保持。長いタイトルの実測幅を領域へ含め、選択線の太さは通常値へ戻す。生成用の一時SVGは成功・失敗とも除去する。外部CSS/画像/フォントを参照せず、文字列はtextContent経由。
- Webの既存共有出力ボタンを画像欄へ移動。VS Codeは従来の「⋯ → SVG保存」。上部操作欄をスクロール可能にし、追加操作メニューをEscで閉じるとsummaryへフォーカスを戻す。
