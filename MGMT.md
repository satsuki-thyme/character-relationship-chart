# management

Character Relationship Chart

## task

- [ ] Webアプリへの転用
  - アーキテクチャの参照
    - [配布構成を比較](https://chatgpt.com/share/6ab3751e-7c68-83ee-9a05-e8794a676477)
    - `Dropbox\www\studio\character-relationship-chart\docs\architecture.md`
  - [x] [作業計画をChatGPTに作ってもらう](https://chatgpt.com/g/g-p-6ab378df8c348191b8bb829564f075b9/c/6ab41e5c-d35c-83e8-b37d-c9c734dd42b5)
  - [n] 作業計画に従って作業指示を出していく 
    - [x] 第1段階: UIとVS Code固有処理の境界を分離（2026-09-23、検証範囲は `TESTING.md`）
    - [x] 第2段階: 共通コアを分離し、ドラッグ時の詳細表示とエッジラベルの描画順を修正（2026-09-24、検証範囲は `TESTING.md`）
    - [x] 第3段階: 読取専用の最小Web版を実装・検証（2026-09-24、保存・編集・Undo・競合・本格再編は対象外、検証範囲は `TESTING.md`）
- [ ] 設定ファイルで変数が使えるようにする
  - JSONの文字列として特殊な記法 `var(<string>)` とすることで変数の定義と利用ができる
  - 同じ変数に複数回の定義はできない
- [ ] 英語化
  - ``` markdown
    # language

    - everything except xxx-ja.md: English
      - documents
      - menus
      - commands
      - comment in code
      - and others
    - xxx-ja.md: Japanese
      - all documents have Japanese version like `README-ja.md`.
      - translation from original documents.
    ```
  - [ ] キャプチャ画像を英語化
- [ ] VS Codeマーケットプレイス
  - [ ] 登録方法の調査
  - [ ] 登録
