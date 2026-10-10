# 第8段階 実行用プロンプト（実装時の指示・履歴）

更新日: 2026-10-10 JST。2026-10-10 JSTに利用者が開始を指示し、実装・自動検証を実施。現在は `STAGE8_ACCEPTANCE.md` を参照。以下は着手時の指示として保持する。工程名と前提は[`PROCESS_CHART.md`](PROCESS_CHART.md)を維持する。**この文書は実行許可ではない**。利用者から第8段階の実行指示があった場合に使用する。

## 推奨モデル／モード

標準〜高推論。描画結果とSVG出力、設定・表示の保存フロー、失敗時の入力保護が両環境にまたがるため。

## 実行用プロンプト

`Dropbox\www\studio\character-relationship-chart` の第8段階「Web版でSVG出力と主要出力動線を整える」を実装・検証してください。

最初に `Dropbox\ai\etc\sources.md`、`Dropbox\ai\development-and-operations-model\idad-v1.md`、プロジェクト指示、現行 `README.md`、`MGMT.md`、`docs/PROCESS_CHART.md`、`docs/architecture.md`、`docs/DEVELOPMENT.md`、`TESTING.md`、`docs/STAGE7_ACCEPTANCE.md`、`change-details/character-relationship-chart-stage7-completed-2026-10-09-ja.md`、`package.json`、関連する `packages/core/`、`media/`、`src/`、`web/`、テストと配布設定を確認し、第7段階完了版に基づくことを照合してください。

**目的・範囲**: 既存VS Code版のSVG出力仕様と共通描画処理を確認し、Web版でも相関図全体をSVGとして保存できるようにする。設定本体（`.jsonc`）・表示データ（`<本体ファイル名>.view.json`）・SVG出力の各操作を明確に区別し、狭い画面、キーボード操作、失敗・キャンセル、未反映フォーム、競合停止、既存Undo/Redoの状態保持を確認する。仕様上の未対応や危険な自動保存を推測で追加しない。

**維持条件**: 既存データ形式、人物・グループID・関係・複数所属・コメント、Webオフライン利用、人物情報の外部非送信、明示保存／ダウンロードと競合保護、VS Code版の保存・Undo・SVG・表示再読込を維持する。ローカル下書き常時保存は未採用。新依存や互換性変更が必要なら影響と推奨案を示す。第9段階以降の再編・Git commit/push・公開・デプロイには着手しない。

**実施**: 変更対象・完了条件を確認し、必要な最小実装と回帰テストを一組で行う。既存ファイルを変更する際は更新内容完成→元ファイルの改名バックアップ（同フォルダ、`backup-YYYY-MM-DD-NN`）→同名更新→検証の順を守る。改名や書込が安全にできない場合は元を保全し、置換用成果物と反映手順を渡す。

**検証・記録**: 現行 `package.json` にある構文チェック・該当テスト・Web/VS Codeビルドとパッケージ手順を実行。可能な範囲でブラウザでSVGの内容・範囲・表示の正しさ、編集後・Undo/Redo後・再読込後の出力、失敗時保護、オフライン・狭い画面を確認。模擬APIと実ブラウザと実Extension Hostの結果を分け、未実施を明記。`README.md` と `README-ja.md`（存在する場合）・Web両言語版・`MGMT.md`・`docs/PROCESS_CHART.md`・`TESTING.md`・関連資料・`change-details/` を必要な範囲で整え、Dropboxへ安全に反映できたかを報告する。配布物の中身を現行ソースと照合する。

**完了報告**: 変更した挙動、影響、実行試験／未実施、バックアップ名、反映先、Web配布物とVSIXのリンク、実機確認方法、現在地、次工程と推奨モデル／モード、次の実行用プロンプトを記載する。第8段階の必須受入が未確認なら「実装済み・検証待ち」とする。
