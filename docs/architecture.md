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
