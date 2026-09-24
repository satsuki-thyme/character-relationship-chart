# 開発ガイド

## 起動・検証

Node.js 22以降、npm、デスクトップ版VS Code 1.85以降を使います。クローン／ZIP展開先の `package.json` があるディレクトリで実行します。

```sh
npm ci
npm run check
npm test
npm run package
```

JavaScriptを直接実行する構成なので、TypeScriptやバンドラーによるビルドはありません。`npm run package` は公式 `@vscode/vsce` 4.0.0で `character-relationship-chart.vsix` を生成します。実行時依存は `jsonc-parser` 3.3.1のみでVSIXに同梱します。

VS Codeでプロジェクトフォルダを開いてF5を押すと、`.vscode/launch.json` の「Launch Character Relationship Chart」でExtension Development Hostが開きます。そこでサンプルを作るか `examples/characters.relations.jsonc` を開いて「相関図を表示」を実行します。

## 構成

| パス | 責務・依存 |
| --- | --- |
| `packages/core/config.js` | JSONC解析・検証・表示用データへの正規化。`jsonc-parser` に依存、VS Code非依存 |
| `packages/core/edit.js` | コメントをできるだけ保ったデータ編集。`config.js`、`jsonc-parser` に依存 |
| `packages/core/graph.js` | 配置・線の経路・領域計算。VS Code／DOM非依存、CommonJSとブラウザ双方で読める |
| `media/main.js` | SVG描画、操作、検索、表示状態。`RelationsUi(host)` へ注入した共通ホストとDOMに依存 |
| `media/editor.js` | GUIフォーム、入力保持、編集要求。DOMと共通ホストに依存 |
| `media/style.css`、`media/ui.html` | 環境共通の表示・画面構造。共通テーマ変数と既定色を使用 |
| `media/vscode-host.js` | 共通ホスト契約と既存VS Codeメッセージの変換・購読・編集応答管理 |
| `media/vscode-bootstrap.js`、`media/vscode-theme.css` | VS Code APIの取得・UI起動、テーマ変数の対応付け |
| `src/extension.js` | コマンド、診断、Webviewメッセージ、VS Code編集API、ファイル監視 |
| `packages/core/view-state.js` | 表示データの検証・読込・JSON変換。ホスト非依存 |
| `packages/core/index.js` | 共通コアの公開入口。契約は [core/README-ja.md](../packages/core/README-ja.md) |
| `src/storage.js` | 表示データのファイル入出力・保存順序・競合保護。検証はcoreへ委譲 |
| `src/config.js`、`src/edit.js`、`media/graph.js` | 既存CommonJS呼び出し側の互換入口 |
| `src/webview.js` | 共有HTMLの組込みとCSP・資産URIの生成。Node.jsのcrypto/fs/pathを使う |
| `schema/` | 本体と表示データのJSON Schema |
| `examples/` | 作品固有の情報を含めない公開用サンプル |
| `test/` | Node.js標準テスト。VS Code連携部分は模擬API |

外部CDN、Webサーバー、クラウドDB、環境変数、固定のPCパスは実行時に不要です。テストにある `/work/` などのパスは模擬ファイルシステム用です。

## 識別子

| 用途 | 値 |
| --- | --- |
| 表示名 | `Character Relationship Chart` |
| publisher / name | `local` / `character-relationship-chart` |
| 拡張機能ID | `local.character-relationship-chart` |
| コマンド | `characterRelationshipChart.open`、`characterRelationshipChart.createSample`、`characterRelationshipChart.migrateLegacy` |
| 相関図Webviewの型 | `characterRelationshipChart.preview.v2` |
| 内部移行用Webviewの型 | `characterRelationshipChart.preview` |
| 診断コレクション | `character-relationship-chart` |

初回公開版0.1.0では公開名称に合わせて拡張ID・コマンド・Webview・診断名を変更しました。旧IDのエイリアスは登録しません。manifestのコマンド／メニュー／activationEventsと、`src/extension.js` の登録先を一致させてください。

拡張IDが異なる版は内部保存領域を共有しません。旧版の配置は旧ID側で `.view.json` へ保存してから切り替えます。設定と表示ファイルの仕様は変更していません。キーバインドを変更し、相関図タブを開き直す手順は [README](../README.md#拡張機能の識別子と旧版からの切り替え) にあります。内部保存領域の扱いは [VS CodeのExtensionContext](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext) を参照してください。

`local` は手動VSIX配布用のpublisherです。Marketplace公開には実在するpublisherの登録が必要です。その際もpublisher変更による拡張IDの切り替えを案内してください。現在のVSIX作成・手動インストールにトークンは不要です。

## Web版への転用・第2段階

UIとVS Codeの境界を共通ホストの契約で分離しています。契約・起動順・現在の構成・次の段階は [architecture.md](architecture.md) を正本とします。解析・編集・表示データ検証・描画計算は `packages/core/` に移しました。Web版の提供と残りのパッケージ分割はまだ行っていません。

`npm test` は計66件です。coreの公開入口をホストAPIなしで動かす検証と、表示データのサイズ上限・移行保護の回帰検証を含みます。共通UIにVS Code依存を戻さない検査、Webviewの資産/CSP、通知・編集結果の対応付け、実アダプターと模擬Extension Hostをつないだ保存・競合・SVG出力を含みます。

DOMの追加検査はjsdom 26.1.0を検証時だけ用意して実行できます。manifest/lockfileや実行時依存には追加していません。

```sh
npm install --no-save --package-lock=false --ignore-scripts jsdom@26.1.0
node --test test/ui-dom-check.js
```

12件でUI描画・編集、VS Code APIなしのホスト注入、保存失敗時の入力保持、古い版の拒否、応答と新しい通知の前後関係、不正データ、SVG生成を確認します。クリックとドラッグの区別、ドラッグでの詳細・選択維持、キャンセル、配置保存・再読込、全エッジより前のラベルとSVGの描画順も確認します。画面サイズ・描画タイミング・ダイアログを一部模擬するため、見た目や実機動作の検証とは別です。検証用依存を除いて配布する際は `npm ci` で通常の依存構成に戻します。

ブラウザで操作するためのローカル検証画面も用意しています。

```sh
node test/preview.js
```

- `http://127.0.0.1:8765/vscode`: 本番UI・アダプター・起動処理と、模擬VS Code APIを接続。
- `http://127.0.0.1:8765/standalone`: 同じUIへ検証専用ホストを注入。VS Code API・アダプターは読み込まない。

両画面とも公開サンプルとメモリー上の一時ファイルだけを使います。検証用ボタンで外部変更・不正な設定・保存失敗を発生させられます。ブラウザ版製品や実際のExtension Hostではありません。`Ctrl+C` で終了します。`test/` はVSIXに同梱しません。

## 変更時の注意

本体のデータ仕様を変えたら、Schema・GUI・データ仕様書・サンプルの対応も確認します。保存周辺では外部編集との競合を上書きしないこと、失敗時に未保存内容を残すことを維持してください。実機での確認項目は [TESTING.md](../TESTING.md) にあります。
