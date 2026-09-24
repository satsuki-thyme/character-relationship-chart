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
  - localStorage / IndexedDB
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

第1段階では既存の `src/`・`media/` 配置のまま、UIとVS Codeの入出力境界を分離した。以下の表はその段階の記録。現在の構成は後述の第2段階を参照。

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

## 後続段階

Webでの編集・保存・Undo・競合、ブラウザ保存領域、SVG保存は別途設計・実装する。`packages/ui`・各adapter・`apps/` への全面移動、公開、英語化も今後の課題として扱う。
