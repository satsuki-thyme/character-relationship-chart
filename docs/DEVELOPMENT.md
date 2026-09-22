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
| `src/config.js` | JSONC解析・検証・表示用データへの正規化。`jsonc-parser` に依存、VS Code非依存 |
| `src/edit.js` | コメントをできるだけ保ったデータ編集。`config.js`、`jsonc-parser` に依存 |
| `media/graph.js` | 配置・線の経路・領域計算。VS Code／DOM非依存、CommonJSとブラウザ双方で読める |
| `media/main.js` | SVG描画、操作、検索、表示状態。DOMと `acquireVsCodeApi()` に依存 |
| `media/editor.js` | GUIフォームと編集メッセージ。DOMと渡されたAPIに依存 |
| `media/style.css` | VS Codeテーマと画面幅に対応する表示 |
| `src/extension.js` | コマンド、診断、Webviewメッセージ、VS Code編集API、ファイル監視 |
| `src/storage.js` | 表示データ検証と保存。保存処理には渡されたVS Code APIを使う |
| `src/webview.js` | Webview HTMLとCSPの生成。Node.jsのcryptoとリソースURI変換を使う |
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

## 本体とVS Code連携の将来の分離

公開準備ではファイルの大規模移動や機能削除を行っていません。既に独立している `config.js`・`edit.js`・`graph.js` を共通コアの候補にできます。

次の段階では、画面とホストの境界に `loadConfig`・`saveConfig`・`loadView`・`saveView`・`exportSvg` 相当の入出力インターフェースを設けます。現在のVS Codeメッセージ実装をアダプターとして残し、ブラウザ用のファイル選択／ダウンロード実装を追加する方向です。保存競合、Undo、旧版データ移行の意味が変わるため、別の改修としてテストと配布形態を設計してください。

## 変更時の注意

本体のデータ仕様を変えたら、Schema・GUI・データ仕様書・サンプルの対応も確認します。保存周辺では外部編集との競合を上書きしないこと、失敗時に未保存内容を残すことを維持してください。実機での確認項目は [TESTING.md](../TESTING.md) にあります。
