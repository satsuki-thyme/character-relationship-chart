# management

Character Relationship Chart

## task

- [ ] Webアプリへの転用
  - アーキテクチャの参照
    - [配布構成を比較](https://chatgpt.com/share/6ab3751e-7c68-83ee-9a05-e8794a676477)
    - `Dropbox\www\studio\character-relationship-chart\docs\architecture.md`
  - [x] [作業計画をChatGPTに作ってもらう](https://chatgpt.com/g/g-p-6ab378df8c348191b8bb829564f075b9/c/6ab41e5c-d35c-83e8-b37d-c9c734dd42b5)
  - [ ] 作業計画に従って作業指示を出していく 
    - [x] 第1段階: UIとVS Code固有処理の境界を分離（2026-09-23、検証範囲は `TESTING.md`）
    - [x] 第2段階: 共通コアを分離し、ドラッグ時の詳細表示とエッジラベルの描画順を修正（2026-09-24、検証範囲は `TESTING.md`）
    - [x] 第3段階: 読取専用の最小Web版を実装・検証（2026-09-24、保存・編集・Undo・競合・本格再編は対象外、検証範囲は `TESTING.md`）
    - [x] 第4段階: Web版に共通GUI編集と設定ダウンロードを追加・検証（2026-09-24、直接上書き・表示データ保存・Undo・競合・本格再編は対象外、検証範囲は `TESTING.md`）
    - [x] 第5段階: 元設定への直接保存と競合保護を実装・検証（2026-09-28 JST）。自動試験と利用者の実機での通常保存・再読込・外部変更時の保存停止を確認して完了。未確認範囲は `docs/STAGE5_ACCEPTANCE.md`。第6段階の現在地は次項。
    - [ ] 第6段階: 前回修正版のWeb3項目とVS Codeの配置復元・連続ドラッグはok。VS Codeの直接保存後の復元ngを追加修正（2026-10-01 JST）。修正済み・実機再確認待ち。`docs/STAGE6_ACCEPTANCE.md` を確認して完了判定する。
      - 検証記録の更新: 原ログ・ソース・配布物を照合し、`TESTING.md` に根拠と検証範囲、`docs/STAGE6_ACCEPTANCE.md` に未受領の実機報告欄を追記。詳細は `change-details/character-relationship-chart-stage6-verification-2026-10-01-ja.md`。反映用成果物の更新であり、Dropboxへの反映完了とは区別する。
      - 今回の修正: `change-details/character-relationship-chart-stage6-fixes-2026-10-01-ja.md`。現在のソースとユーザー差分を保護し、旧実装は再適用しない。前回の実機結果は `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` に保持。今回の追加修正は `change-details/character-relationship-chart-stage6-vscode-redisplay-fix-2026-10-01-ja.md`、次は同報告書末尾のVS Code追加再確認のみ。
    - [ ] 第7段階: 未着手・第6段階の完了待ち。推奨は高性能モデル／高推論、実行指示は `docs/STAGE7_PROMPT.md`。
    - [x] プロジェクトを、IDADを参照して進めるよう書き直す内容をChatGPTに作ってもらう
    - [x] ChatGPTに行程表（`Dropbox\www\studio\character-relationship-chart\docs\PROCESS_CHART.md`）を出してもらう
    - [n] [第6段階](\prompt\STAGE6_PROMPT.md)

## assignment

- [ ] edge の枠線を握ってドラッグできるようにする
- [ ] 設定ファイルで変数が使えるようにする
  - JSONの文字列として特殊な記法 `var(<string>)` とすることで変数の定義と利用ができる
  - 同じ変数に複数回の定義はできない
- [ ] サンプル設定ファイルの作り替え
  - インラインから改行ありのものへ
- [ ] 編集画面の変更
  - 関係の関係リストをキャラクター名でフィルタできるようにする（インクリメンタルサーチ）
- [ ] 英語化
  - ドキュメント類
  - 相関図、編集画面のGUI
  - コードのなかのコメントなど
  - キャプチャ画像
- [ ] VS Codeマーケットプレイス
  - 登録方法の調査
  - 登録
