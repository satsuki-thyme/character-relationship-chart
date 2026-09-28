# 開発ガイド

## 起動・検証

Node.js 22以降、npm、デスクトップ版VS Code 1.85以降を使います。クローン／ZIP展開先の `package.json` があるディレクトリで実行します。

```sh
npm ci
npm run check
npm test
npm run package
```

VS Code版はJavaScriptを直接実行し、`npm run package` は公式 `@vscode/vsce` 4.0.0で `character-relationship-chart.vsix` を生成します。実行時依存は `jsonc-parser` 3.3.1のみでVSIXに同梱します。Web版は `npm run build:web` で `dist/web/` へ生成します。開発用のesbuild 0.28.2を追加し、既存の依存の版数は維持しています。

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
| `web/` | Webの読込・メモリー編集・明示保存・ダウンロード・起動。通常読込はFileReader、直接保存はfile-access.jsのハンドル・生バイト比較 |
| `scripts/build-web.js` | HTMLの組込み・ブラウザ用バンドル・配布ファイルの生成 |

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

## Web版への転用・第4段階（当時の記録）

契約・起動順・現在の構成・次の段階は [architecture.md](architecture.md) を正本とします。`packages/core/` と既存UIを使うWeb版で、共通GUI編集と設定ダウンロードに対応しました。元ファイルへの直接上書き・表示データ保存・独自Undo・外部競合管理・永続保存・全面的なパッケージ分割は行っていません。

`npm test` は計80件です。従来の66件にWebホスト14件を加え、読込・検証・順序制御・解放に加えて、共通編集・参照追従・コメント保持・再読込・ダウンロード生成失敗・入力保護を確認します。共通コアと、模擬VS Codeの保存・競合・編集・SVG出力の検証を維持しています。

Web版は `editConfig` を共通coreへ委譲します。`persistEdits: false` で共有エディターの案内を切り替え、ダウンロードは保持中の文字列から生成します。詳しい契約と入力保護は設計書を参照してください。依存・lockfileは第3段階から変更していません。

Web版の作成と操作は次のとおりです。

```sh
npm run build:web
# dist/web/index.html をブラウザで開く
```

ビルドは [esbuildのJavaScript API](https://esbuild.github.io/api/#build) を使います。jsonc-parserのUMD入口は内部のrequireを静的に解決できないため、`mainFields: ['module', 'main']` で公開ESM入口を選びます。共有HTMLと実コードを束ね、配布物から直接起動して検証します。

jsdomを下記の方法で用意した環境では `npm run test:web` で配布物を一時ディレクトリへ生成して10件のDOM検証を行えます。`node --test test/ui-dom-check.js test/web-dom-check.js` ではVS Code版12件と合わせて22件です。別フォルダーに導入した場合は、その `node_modules` を `NODE_PATH` に指定します。

実ブラウザの検証は、プロジェクト外にPlaywrightと対応するChromiumを用意して `node test/web-browser-check.js` を実行します。必要な場合だけ `CRC_BROWSER_EXECUTABLE`、JSON配列の `CRC_BROWSER_ARGS`、画像出力先の `CRC_CAPTURE_DIR` を指定します。この検証はオフラインのfile URLから起動し、ポインター操作、GUI編集・ID変更、ファイル生成失敗、実際のダウンロードと再読込、狭い編集画面、CSPを確認します。これらの検証用依存はVSIX・Web配布物に含めません。

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

## 第5段階の開発・検証

直接保存は `web/file-access.js` と `web/host.js` に閉じ込めた。`npm run check` は新ファイルを含む19ファイル、`npm test` は96件。通常のWeb読込・GUI・ダウンロードを維持し、共有coreとVS Codeの保存処理は変更していない。本番依存、lockfile、名称・識別子・版数も維持する。

```sh
npm run check
npm test
npm run test:web
node --test test/ui-dom-check.js test/web-dom-check.js
npm run build:web
node test/web-browser-check.js
node test/web-save-browser-check.js
node test/web-native-file-check.js
npm run package
```

DOM試験はjsdom 26.1.0を外部に用意し、必要に応じて `NODE_PATH` を指定する。Web13件と共有UI12件、計25件。ブラウザ試験もPlaywrightを検証用に用意し、既存の `CRC_BROWSER_EXECUTABLE` / `CRC_BROWSER_ARGS` を使用する。`CRC_CAPTURE_DIR` は任意の画像保存先。実行時依存へは追加しない。

`web-save.test.js` は生バイト競合、保存途中の外部変更、権限・読込・write・close・abort・読戻し失敗、結果不明時の停止、保存中の追加編集／二重保存／切替、取消・解放・不正UTF-8を検証する。`web-save-browser-check.js` は実ブラウザのGUIを模擬ハンドルへ接続するため、OSファイル選択やネイティブ書込成功の証明にはならない。`web-native-file-check.js` はテスト用一時ファイルのネイティブAPI読込・書込を試す。選択の代わりにCDPドラッグから得たネイティブハンドルをテスト内だけで渡し、成功・拒否を区別して出力する。今回の環境では拒否となり、元ファイルと編集中内容の保持を確認した。

利用者の通常保存・再読込・外部変更時の保存停止の報告を自動試験と照合し、第5段階を完了とした。実機環境の詳細と個別試験の未確認範囲は [STAGE5_ACCEPTANCE.md](STAGE5_ACCEPTANCE.md) に残す。完了記録を含む配布物は `stage5-completed` 名で再生成する。第6段階開始前に、対象ソースが第5段階の成果物に一致しているか確認し、利用者の差分を保護する。
