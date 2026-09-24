# 共通コア

[English](README.md)

VS Code拡張と今後のWebホストで共有するデータ処理をまとめた非公開パッケージです。ファイル・ネットワーク・保存先・DOM・VS Codeの操作は行いません。依存はルートプロジェクトで既に導入する `jsonc-parser` 3.3.1のみです。

```js
const core = require('./packages/core'); // プロジェクトルートから利用する場合。
const result = core.parseConfig(text);
if (!result.issues.length) {
  const nodes = core.graph.layout(result.graph, result.graph.layout);
  const routes = core.graph.routes(nodes, result.graph.edges);
}
```

| 公開する名前 | 契約 |
| --- | --- |
| `parseConfig(text)` | JSONCを解析・検証。UTF-16の位置と長さを持つ `issues` を返し、成功時は元の `config` と正規化した `graph` も返す。 |
| `editConfig(text, operation)` | 編集後のJSONC `text`、`config`、必要なら `rename`、編集後の `index` を返す。対象外のコメントと整形を保持し、不正な操作・結果では例外を返す。 |
| `normalizeState(value, legacy = false)` | 表示データを検証してコピー。legacyモードは従来の移行規則を維持する。 |
| `parseState(text)` | 厳密なJSONの表示データを読み、先頭BOM、200,000文字の上限、各項目を検証。不正な入力は例外にする。 |
| `encodeState(value, legacy = false)` | 検証後、2スペースの字下げと末尾改行を持つJSON文字列へ変換。 |
| `LIMITS`、`VIEW_LIMITS` | 従来の設定上限と表示データの文字数上限。 |
| `graph` | 描画計算API: `WIDTH`、`HEIGHT`、`wrap`、`signature`、`layout`、`routes`、`bounds`。 |

データ形式はversion 1のまま、`nodes`・`groups`・`edges` を維持します。項目の制約は [DATA_FORMAT.md](../../docs/DATA_FORMAT.md) を参照してください。ファイル選択・バイト列の読込と保存・文書の版・競合検知・Undo・エラーの表示は各ホストが担当します。

入口はCommonJSです。Webでの利用時は `jsonc-parser` とともにバンドルできますが、この段階ではWebアプリやブラウザ用バンドルを提供しません。`graph.js` は通常のscriptとしても読み込め、現在の共通UIは `globalThis.RelationsGraph` を使います。`media/graph.js`、`src/config.js`、`src/edit.js` は既存のCommonJS呼び出し側のための互換入口です。

ルートの `npm test` は、Node.js組み込みモジュール・`process`・`Buffer`・DOM・VS Code APIを持たないJavaScript実行環境で公開入口を検証します。従来の設定・編集・描画計算・保存の回帰テストも継続します。
