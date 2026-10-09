# 指定第7段階VSIXの導入とWindowリロードに関する報告（2026-10-09 JST）

## 実施環境

- 実機試験日時:
  - 2026-10-09
- OS:
  - エディション	Windows 11 Pro
  - バージョン	26H2
  - インストール日	‎2024-‎11-‎22
  - OS ビルド	26300.9550
  - エクスペリエンス	Windows 機能エクスペリエンス パック 1000.26100.372.0
- ブラウザ:
  - Google Chrome バージョン 154.0.8037.98（公式ビルド） （64 ビット）
- VS Code詳細版数:
  - Version: 1.141.0 (user setup)
  - Commit: 2a59476c9bfcb90b3ddc372c36762471b7dfad1c
  - Date: 2026-10-06T10:15:52+02:00
  - Electron: 43.7.7
  - ElectronBuildId: 15553055
  - Chromium: 150.0.7871.250
  - Node.js: 24.21.0
  - V8: 15.0.245.31-electron.0
  - @github/copilot: 1.0.92-4.unstable.r37397886721.gad270aa
  - @github/copilot-sdk: 1.0.17.37397886721.gad270aa
  - OS: Windows_NT x64 10.0.26300
- 導入済みファイルのハッシュ:
  - 579cc161bba31b70202923a625c0c876d6f1ba48dbff4ec9ee0a3095425f0acc  dist/character-relationship-chart-web-stage7-2026-10-04.zip
  - e0f6f677ceaefdc24259e4253d679936307e1fbe8ee39544e06ef8e6b795ef5c  dist/character-relationship-chart-stage7-2026-10-04.vsix
  - 51c8408519ceddebf60be9ec116ae23e78317ed2847dc6c566896639869a20ca  verification/character-relationship-chart-stage7-2026-10-04.zip

## 指定第7段階VSIXの導入

VS Codeに指定第7段階VSIXを導入し、拡張機能の画面にて次の表示を確認した。

``` text
第7段階は実装・自動検証済み、利用者の最終確認待ちです（2026-10-04 JST）。 「取り消し」「やり直し」は設定本文と配置・倍率・表示状態をまとめて戻します。人物IDの参照・コメントも往復し、新しい編集でRedoを破棄します。未反映入力がある間と保存中は履歴操作を止め、入力を保持します。保存先・確認済み保存内容・競合停止は巻き戻しません。履歴は最大100操作／概算16MiBで、設定または表示データの正常な読込とページ終了で消えます。常時下書き保存は未採用です。確認手順・下書き設計と選択 を参照してください。
```

## Windowリロード

やった。
