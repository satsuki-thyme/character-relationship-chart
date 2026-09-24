# Web版転用・第3段階の反映記録

[English](character-relationship-chart-stage3-applied.md)

実施日: 2026-09-24 UTC  
対象: `/www/studio/character-relationship-chart`  
状態: ソースと配布物の反映・照合を完了。照合時刻は 2026-09-24T09:41:18.136Z。本書は照合後に作成した。

## 実装内容

既存の共有UIと共通コアを使う読取専用の最小Web版を実装した。[Web版ZIP](../dist/character-relationship-chart-web-stage3.zip) をすべて展開し、同梱ファイルをまとめたまま `index.html` を開くと、サンプルが表示される。配布版の利用にVS Code、Node.js、Webサーバー、インターネット接続は不要。

- UTF-8のJSONC/JSONを選択またはドロップして読み込む。対応する `<設定ファイル名>.view.json` は同時にも後からも読み込める。利用者が明示的に選んだファイルだけを読み込む。
- 検索、詳細表示、レイアウト切替、ノード・キャンバスのドラッグ、ズーム、図だけ表示を利用できる。クリックで詳細を開き、ドラッグでは開かない。エッジラベルはすべての線と矢印より前面に表示する。
- 位置とカメラの変更はページ内の一時状態とし、再読込するとサンプルへ戻る。別の設定を開くと選択・検索・配置をリセットし、対応する表示データがあれば位置とカメラを復元する。
- 不正入力や読込失敗では直前の有効な図を維持する。設定と表示データを一括検証し、入力数、名前、バイト数、共通コアの文字数上限を確認する。古い読込要求の遅延応答は反映しない。
- Webホストが読取専用の提供機能を宣言し、共有UIはその機能に応じて操作部品と編集処理の初期化を制御する。従来のVS Codeホストは既存の提供機能を維持する。WebバンドルにVS CodeアダプターやGUI編集処理は含めない。

Web版の保存・編集・Undo・競合管理・ファイル監視・ブラウザへの永続保存・本格的なディレクトリ再編は対象外。SVGのダウンロードも提供しない。ファイル内容をサーバーへ送信せず、外部リソースを読み込まず、CSPでも接続を禁止する。既存VS Code版の保存と編集は既存アダプターに維持している。

起動と読込の `web/`、オフライン配布を生成する `scripts/build-web.js` を追加した。既存の `media/ui.html`、UI、描画計算、解析・検証を共有し、jsonc-parserの公開ESM入口を利用する。esbuild 0.28.2は開発依存のみ追加。既存依存の版数、本番jsonc-parser 3.3.1、データ形式、拡張ID・表示名・版数は維持し、共通コアの5実装ファイルは第2段階とバイト単位で一致する。

設計、開発・配布手順、README、ライセンス、変更履歴、検証記録を更新した。`MGMT.md` は別タスクの変数記法対応など既存の記載を保持し、第3段階の完了行だけを追加した。詳細は [設計書](../docs/architecture.md)、[Web版の使い方](../web/README-ja.md)、[検証記録](../TESTING.md) を参照。

## 検証結果

環境: Linux、Node.js 24.19.0、npm 11.9.0。jsdom 26.1.0、Playwright、Chromium、目視確認用の日本語フォントはアプリ外の検証専用依存。

| 検証 | 結果 |
| --- | --- |
| JavaScript構文 | 実行・ビルド用18ファイルで成功 |
| 通常テスト | 73件成功、失敗・スキップなし |
| DOM回帰検証 | VS Code UI 12件＋Web実配布物6件、計18件成功、失敗・スキップなし |
| 実ブラウザ | Chromium Headless 153.0.8010.0で6操作群が成功。file URLでのオフライン起動、実ポインターのクリック・ドラッグ、検索・詳細・ズーム、FileReaderと表示データ、不正入力からの復帰、ドロップ、persisted pagehideイベント後の読込、390px幅・図だけ表示、再読込・CSPを確認 |
| 目視 | 1280×800と390×780で日本語とレイアウトを確認 |
| 通信・保存 | 通常操作中のHTTP(S)要求0件、ブラウザ永続保存なし。CSPでインラインスクリプトと接続が拒否されることを実際の違反イベントで確認。Webセキュリティを無効化していない |
| Web配布物 | ZIP内9ファイルが生成物と一致。別の場所に展開してオフライン起動し、6ノード・8エッジを表示 |
| VSIX | 53ファイル。実行コードが検証したソースと一致。コア・実行依存・ライセンスを含み、Web専用ファイル・ビルドツール・テスト・管理記録を除外。展開後のコアの解析・8本の経路計算が成功 |
| Dropbox | 更新・追加26ファイルと維持40ファイルの計66ファイルで、サイズとcontent hashが期待値に一致 |
| 一時ファイル | 対象9ディレクトリの一覧を完了まで確認し、今回の一時アップロードファイルの残存なし |

デスクトップ版VS Codeの実インストール、実際のExtension Host・Undoは未検証。VS Code側は既存の模擬API・DOM回帰検証まで。Windows・macOS・Firefox・Safariも未検証。ページのキャッシュ復帰はイベント発火による確認であり、実際の履歴移動によるBFCache復帰試験ではない。詳細と再実行手順は [TESTING.md](../TESTING.md) と [開発ガイド](../docs/DEVELOPMENT.md) に記載した。

## 配布物

| 配布物 | バイト数 | SHA-256 |
| --- | ---: | --- |
| [character-relationship-chart-web-stage3.zip](../dist/character-relationship-chart-web-stage3.zip) | 41987 | `3eef71bcfed97559d1c38e4e2c2f4b089e32e0c5af6532352b1bf5250180adf5` |
| [character-relationship-chart-stage3.vsix](../dist/character-relationship-chart-stage3.vsix) | 423927 | `16007fb105a97f2296d228016be24bfbf1c62f0d8af5ba09b71538adfc444704` |

拡張IDは `local.character-relationship-chart`、表示名は `Character Relationship Chart`、版数は `0.1.0` を維持。

## 反映したファイル

既存14ファイルを更新し、新規12ファイル（ソース・文書・テスト・ビルド10、配布物2）を追加した。以下はDropboxの移動成功後に返された正式なパスとIDで、全行を別途ハッシュ照合した。本記録の英語版と日本語版は `change-details/` に追加する報告用ファイル。

| 操作 | 正式なDropboxパス | ファイルID | 状態 |
| --- | --- | --- | --- |
| 追加 | `/www/studio/character-relationship-chart/dist/character-relationship-chart-stage3.vsix` | `id:pdXqx4wRBdMAAAAAAAKVnA` | success |
| 追加 | `/www/studio/character-relationship-chart/dist/character-relationship-chart-web-stage3.zip` | `id:pdXqx4wRBdMAAAAAAAKVnQ` | success |
| 追加 | `/www/studio/character-relationship-chart/scripts/build-web.js` | `id:pdXqx4wRBdMAAAAAAAKVng` | success |
| 追加 | `/www/studio/character-relationship-chart/test/web-browser-check.js` | `id:pdXqx4wRBdMAAAAAAAKVnw` | success |
| 追加 | `/www/studio/character-relationship-chart/test/web-dom-check.js` | `id:pdXqx4wRBdMAAAAAAAKVoA` | success |
| 追加 | `/www/studio/character-relationship-chart/test/web-host.test.js` | `id:pdXqx4wRBdMAAAAAAAKVoQ` | success |
| 追加 | `/www/studio/character-relationship-chart/web/README-ja.md` | `id:pdXqx4wRBdMAAAAAAAKVog` | success |
| 追加 | `/www/studio/character-relationship-chart/web/README.md` | `id:pdXqx4wRBdMAAAAAAAKVow` | success |
| 追加 | `/www/studio/character-relationship-chart/web/host.js` | `id:pdXqx4wRBdMAAAAAAAKVpA` | success |
| 追加 | `/www/studio/character-relationship-chart/web/index.html` | `id:pdXqx4wRBdMAAAAAAAKVpQ` | success |
| 追加 | `/www/studio/character-relationship-chart/web/main.js` | `id:pdXqx4wRBdMAAAAAAAKVpg` | success |
| 追加 | `/www/studio/character-relationship-chart/web/style.css` | `id:pdXqx4wRBdMAAAAAAAKVpw` | success |
| 更新 | `/www/studio/character-relationship-chart/.vscodeignore` | `id:pdXqx4wRBdMAAAAAAAKVqA` | success |
| 更新 | `/www/studio/character-relationship-chart/CHANGELOG.md` | `id:pdXqx4wRBdMAAAAAAAKVqQ` | success |
| 更新 | `/www/studio/character-relationship-chart/README.md` | `id:pdXqx4wRBdMAAAAAAAKVqg` | success |
| 更新 | `/www/studio/character-relationship-chart/TESTING.md` | `id:pdXqx4wRBdMAAAAAAAKVqw` | success |
| 更新 | `/www/studio/character-relationship-chart/THIRD_PARTY_NOTICES.md` | `id:pdXqx4wRBdMAAAAAAAKVrA` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/DEVELOPMENT.md` | `id:pdXqx4wRBdMAAAAAAAKVrQ` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/RELEASE.md` | `id:pdXqx4wRBdMAAAAAAAKVrg` | success |
| 更新 | `/www/studio/character-relationship-chart/docs/architecture.md` | `id:pdXqx4wRBdMAAAAAAAKVrw` | success |
| 更新 | `/www/studio/character-relationship-chart/media/main.js` | `id:pdXqx4wRBdMAAAAAAAKVsA` | success |
| 更新 | `/www/studio/character-relationship-chart/package-lock.json` | `id:pdXqx4wRBdMAAAAAAAKVsQ` | success |
| 更新 | `/www/studio/character-relationship-chart/package.json` | `id:pdXqx4wRBdMAAAAAAAKVsg` | success |
| 更新 | `/www/studio/character-relationship-chart/packages/core/README-ja.md` | `id:pdXqx4wRBdMAAAAAAAKVsw` | success |
| 更新 | `/www/studio/character-relationship-chart/packages/core/README.md` | `id:pdXqx4wRBdMAAAAAAAKVtA` | success |
| 更新 | `/www/studio/character-relationship-chart/MGMT.md` | `id:pdXqx4wRBdMAAAAAAAKVtQ` | success |

新規フォルダー:

| 正式なDropboxパス | フォルダーID | 状態 |
| --- | --- | --- |
| `/www/studio/character-relationship-chart/web` | `id:pdXqx4wRBdMAAAAAAAKVmg` | success |
| `/www/studio/character-relationship-chart/scripts` | `id:pdXqx4wRBdMAAAAAAAKVmw` | success |

一意な一時パスに転送して内容を照合し、既存ファイルは差し替え直前に旧内容を再確認した。保存後にソース・配布物の計66ファイルを再照合した。プロジェクトには `.git` があるため、プロジェクト内にバックアップは作成していない。commit・push・公開は行っていない。第1・第2段階の配布物と記録も保持した。

## 元に戻す方法

既存14ファイルの差し替えにはDropboxの復元可能な削除を使用した。元に戻す場合は、同名の現行ファイルを退避し、アカウントの保存期間内にDropboxの「削除済みファイル」から旧ファイルを復元する。[Dropbox公式の復元手順](https://help.dropbox.com/delete-restore/recover-deleted-files-folders) を参照。この差し替え方式では、新旧ファイルのIDや版履歴が連続することを前提としない。

追加分は、上表の新規12ファイルと本記録2言語分を削除し、`web/` と `scripts/` が空なら削除することで取り除ける。削除の代行は別途明示的な指示を受けて行う。今回、復元やロールバックは行っていない。第1・第2段階の既存ファイルは別途指示がない限り保持する。
