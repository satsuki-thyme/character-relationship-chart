# 第9段階 実行用プロンプト（未実行）

推奨: 高性能・高推論。複数環境の入口・依存・パッケージ対象を同時に整えるため。開始条件は第8段階の正式受入完了と、利用者の第9段階開始指示。

`Dropbox\www\studio\character-relationship-chart` の第9段階「目標アーキテクチャへ構成を整理する」を実装・検証してください。sources.md、IDAD、プロジェクト指示、README、MGMT、docs/PROCESS_CHART.md、docs/architecture.md、docs/DEVELOPMENT.md、docs/STAGE8_ACCEPTANCE.md、TESTING.md、package.json/lockfileと現行ソース・配布設定を確認し、第8段階の正式受入と対象ソースの一致を確かめてください。未完了ならまず残条件を扱い、完了済みの変更を再適用しないでください。

工程名・番号を維持し、packages/ui、packages/vscode-adapter、packages/web-adapter、apps/vscode-extension、apps/webへの責務移動を最小単位に分けて進めてください。必要な間だけ既存入口の互換を維持し、未使用の抽象化や新依存を増やさないでください。データ形式・識別子・JSONCコメント・表示データ・Webオフライン・外部非送信・保存/競合保護・Undo/Redo・SVGを維持してください。ローカル下書き常時保存とassignmentは対象外です。重要な仕様/互換性判断は影響と推奨案を確認してください。

既存ファイルは元そのものの同ディレクトリ改名バックアップ後に同名更新し、元データと差分を保護してください。構文・既存Node/DOM/実ブラウザ試験、両ビルド/配布物の監査とオフライン動作を確認し、実Extension HostやOS別未実施は区別してください。README/Web両言語・管理・工程・設計・検証・配布資料とchange-detailsを整え、Dropboxへの反映可否を実結果で報告してください。安全に反映できなければ置換用成果物を渡してください。Git commit/push、公開、デプロイ、第10段階は今回の範囲外です。

完了時は変更、検証、未確認、バックアップ、反映先、Web/VSIX配布物、必要な実機手順、現在地と次の指示を提示してください。
