# 第6段階の不具合修正・中断後の反映完了

2026-10-01 JST。対象は `Dropbox\www\studio\character-relationship-chart`。

第6段階は**不具合修正・自動検証済み、修正版の実機再確認待ち**。第1〜5段階の完了は維持し、第7段階は未着手のまま。

## 中断後に確認したこと

前の実行は、既存16ファイルを同じディレクトリの `backup-2026-10-01-01` 名へ改名し、更新版を元の名前へ保存するところまで完了していた。現在の16ファイルは、回収した前回の完成内容と全件一致する。バックアップ16個も、前回取得した更新前データのDropbox内容ハッシュと全件一致する。

今回、現在のソースと前回作業用フォルダを照合し、未追加だった回帰テスト2本、修正版Web ZIP・VSIX・ハッシュ一覧、根拠ログを保存した。旧第6段階パッケージや第5段階実装は再適用していない。既存16ファイルの更新を重ねて実行せず、今回の追加前には同名ファイルの不存在を確認した。

最新の `sources.md`、IDAD、プロジェクト指示を読み、Dropboxの対応リポジトリが `satsuki-thyme/character-relationship-chart` であることを確認した。Git HEADは `e215aee59bc38acfbe17276722b8fdda78a271bc` / main。Git情報・利用者の差分は読取り対象として保持し、今回commit/pushは実施していない。

## 各不具合の原因と修正

| 不具合 | 確認できた原因 | 修正した挙動 |
| --- | --- | --- |
| 保存後に全人物の配置が戻らない | 表示データに手動移動した人物の座標だけが入り、未移動人物は開き直し時に自動配置が再計算される | 保存時に、描画済みの全人物の座標を元設定の座標署名とともに記録する。ライブのドラッグ上書きと保存スナップショットは分け、固定座標の変更・人物ID変更・別設定の読込も既存規則に従う |
| 続けて人物を動かすと背景パンになる | pointer capture喪失や画面離脱時にドラッグ状態が残る経路を再現した | 終了・取消・capture喪失・window側の終了・blur・pagehide・非表示でドラッグを解放する。人物ドラッグと背景パンを排他的に扱い、別ポインターで進行中の操作を置換しない |

実装変更の中心は `media/main.js`。既存のcore・Schema・src・保存ホスト・manifest・lockfileを維持する。全人物座標は現行表示データ形式で保存できるため、外部データ形式やアプリ版数を変えていない。

配置保存不足とcapture喪失後の残留は前回の原コード／修正版の比較試験で確認済み。通常の連続ドラッグで起きる利用者のWindows現象そのものを、Linux Chromiumで同じ条件まで厳密に再現できたとは扱わない。そのため実機での連続操作とページ復帰の再確認を残す。

参考仕様: [MDNのlostpointercapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/lostpointercapture_event)。

## 更新済みファイルと保全したバックアップ

次の改名・更新は前の実行で済んでおり、今回内容を再照合した。新しいバックアップを重ねて作っていない。

| 更新対象（ルートからの相対パス） | 同じディレクトリの改名バックアップ |
| --- | --- |
| `TESTING.md` | `TESTING.backup-2026-10-01-01.md` |
| `.vscodeignore` | `.vscodeignore.backup-2026-10-01-01` |
| `README.md` | `README.backup-2026-10-01-01.md` |
| `CHANGELOG.md` | `CHANGELOG.backup-2026-10-01-01.md` |
| `MGMT.md` | `MGMT.backup-2026-10-01-01.md` |
| `media/main.js` | `media/main.backup-2026-10-01-01.js` |
| `test/web-dom-check.js` | `test/web-dom-check.backup-2026-10-01-01.js` |
| `test/web-save-browser-check.js` | `test/web-save-browser-check.backup-2026-10-01-01.js` |
| `docs/DATA_FORMAT.md` | `docs/DATA_FORMAT.backup-2026-10-01-01.md` |
| `docs/STAGE6_ACCEPTANCE.md` | `docs/STAGE6_ACCEPTANCE.backup-2026-10-01-01.md` |
| `docs/architecture.md` | `docs/architecture.backup-2026-10-01-01.md` |
| `docs/PROCESS_CHART.md` | `docs/PROCESS_CHART.backup-2026-10-01-01.md` |
| `docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` | `docs/STAGE6_PHYSICAL_DEVICE_CHECK.backup-2026-10-01-01.md` |
| `docs/DEVELOPMENT.md` | `docs/DEVELOPMENT.backup-2026-10-01-01.md` |
| `web/README.md` | `web/README.backup-2026-10-01-01.md` |
| `web/README-ja.md` | `web/README-ja.backup-2026-10-01-01.md` |

`docs/STAGE6_PHYSICAL_DEVICE_CHECK.md` の初回の実機報告と未完了チェックを保持する。同ファイル末尾には修正後の必須3項目がある。`TESTING.md`、`MGMT.md`、`docs/PROCESS_CHART.md`、`docs/STAGE6_ACCEPTANCE.md` は実機再確認待ちの判定で揃っている。

## 今回追加したファイルと実際の反映先

ルート: `Dropbox\www\studio\character-relationship-chart`。

| 保存先 | 追加内容 |
| --- | --- |
| `test/stage6-regression-dom-check.js` | 前回完成版から回収した5件のDOM回帰試験 |
| `test/stage6-regression-browser-check.js` | 前回完成版から回収した実Chromiumの3操作群 |
| `dist/character-relationship-chart-web-stage6-fixes-2026-10-01.zip` | Web配布物、9ファイル |
| `dist/character-relationship-chart-stage6-fixes-2026-10-01.vsix` | VS Code配布物、53ファイル |
| `dist/character-relationship-chart-stage6-fixes-2026-10-01-SHA256SUMS.txt` | 上記配布物のSHA-256 |
| `verification/stage6-fixes/` | 新規フォルダ。前回の採用済み根拠15ファイルと再開時のログ・照合資料・画像10ファイル、計25ファイル |
| `change-details/character-relationship-chart-stage6-fixes-2026-10-01-ja.md` | 本記録 |

本記録に先立つ追加30ファイルについて、保存完了応答の名前・保存先・サイズを確認し、保存後のDropbox内容ハッシュを全件照合した。更新済み16ファイルとバックアップ16個も再照合し、計62対象で内容一致を確認した。取得失敗や保存結果不明を完了として数えていない。

HTTPSサイト `https://satsuki.c/crc/index.html` の公開更新は今回実施していない。配布物を作成・保存したことと、サイトへ反映したことは別である。

## 検証結果

再開時は、現在のDropboxソースを新しい作業ディレクトリへ復元し、回収した新規テストを加えて検証した。本番依存はlockfileに従って導入し、jsdom等の検証用依存はプロジェクト外に置いた。

| 検証 | 結果 | 根拠（`verification/stage6-fixes/` からの相対パス） |
| --- | --- | --- |
| 依存導入 | `npm ci --ignore-scripts` 成功、lockfileを維持 | 再開時に実行 |
| 構文 | `npm run check` 成功、19本番JS | `recovery-check.log` |
| 通常試験 | `npm test` 成功。同一の通常試験をTAPで再実行し116件成功、失敗・取消・スキップ0を確認 | `recovery-tests.tap` |
| 共有UI・Web・新規DOM | 36件成功（12＋19＋5）、失敗・取消・スキップ0。Web19件は別に加算しない | `recovery-dom.log` |
| 実Chromium | 3操作群成功。実ダウンロードJSONと全座標の一致、auto/circle、倍率・パン・詳細/focus、連続ドラッグ、capture解放、タブ／ページ復帰、VS Code共有UI／実アダプター＋模擬拡張の保存復元 | `recovery-browser.json` |
| ビルド・パッケージ | `npm run build:web` と `npm run package` 成功 | `recovery-build-web.log`、`recovery-package.log` |
| 配布物照合 | 今回生成したWeb9ファイルとVSIX53ファイルの展開後の全内容が、前回検証済み配布物とバイト一致。不要なテスト・バックアップをVSIXから除外 | `recovery-artifact-contents.json` |
| 保存先照合 | 更新版16個・元バックアップ16個・追加30個でDropbox内容ハッシュ一致 | `recovery-source-inventory.json` と保存後の照合結果 |

実行環境はLinux、Node.js v24.19.0、jsdom26.1.0、Playwright／Chromium Headless153.0.8010.0。Webセキュリティを無効にする引数は使っていない。画面キャプチャの `recovery-roundtrip-auto.png` と `recovery-roundtrip-circle.png` は実機報告の比較画像とは別の自動試験画像。

前回の通常116件、`npm run test:web` 19件、DOM36件、既存Chromium20操作群、原コードとの比較、配布物を展開した確認の原ログは、採用済み根拠として回収・照合した。再開時に既存Chromium20操作群やネイティブAPIの全試験を改めて実行したとは扱わない。

## 配布物のハッシュ

| 配布物 | SHA-256 |
| --- | --- |
| `character-relationship-chart-web-stage6-fixes-2026-10-01.zip` | `732371c62fe7d43678208d8cc4c8a0f0da4d66fb04d8c3ca3a745da4fb08c33c` |
| `character-relationship-chart-stage6-fixes-2026-10-01.vsix` | `39d3bdfba1c49d98429acc6ed11146e040617c4464fbca9f33d92fa8835df164` |

ZIPやVSIXの外側の作成時刻等は再生成で変わることがある。前回配布物との一致は展開後のファイル集合と全バイトで確認した。アプリ版数は現行manifestの0.1.0を維持する。

## 未実施・未確認

- 利用者のWindows 11 26H2 / Chrome154.0.8037.59で、修正版を使った必須3項目の再確認。
- 今回のネイティブ表示データ書込成功。前回の自動環境では実ハンドル読込と拒否時の保持を確認し、OS pickerはAbortError、書込権限はdeniedだった。利用者からの初回確認2・3のokは別の実機結果として引き継ぐ。
- 実VSIXインストール、実Extension Host、実Undo、他OS／他ブラウザ。
- HTTPSサイトへの公開反映、Git commit/push。

初回確認1〜5のok、確認6のファイル名の勘違いの解決を引き継ぐ。ネイティブの故障・権限等を全て再試験することは要求しない。

## 次の工程と実機再確認

現在地は第6段階の修正後再確認待ち。次は利用者の実機による以下3項目の確認。結果照合と記録整理は標準モデル／通常推論で対応できる。再発がある場合は保存状態と操作履歴の原因調査が必要なので高性能モデル／高推論を推奨する。

1. **配置の復元**: 修正版Web ZIPを展開して使う。HTTPSで確認するなら中身を既存サイトへ反映し、Ctrl+F5で読み直す。人物を2人動かし、倍率・背景位置・詳細欄を変更。設定と表示データを保存して同じ組を開き直し、動かしていない人物も含めて配置・倍率・表示状態が戻るか確認する。circleまたは図だけ表示でも一度確認する。
2. **直接保存後の復元**: 初回に成功した表示データの直接保存先で配置を少し変更し、「表示データを保存」。その実ファイルを開き直し、配置が戻るか確認する。
3. **連続ドラッグと復帰**: 背景クリックを挟まずA→B→Cを動かす。背景パン後、別タブからの復帰後、別ページから戻った後も人物だけが動くか確認する。

設定と表示の対応名は `人物.jsonc` と `人物.jsonc.view.json` の組。旧表示データに記録されていなかった人物位置は復旧できないため、目的の配置を修正版で作って保存する。

VS Codeの共有UIは、可能なら今回のVSIXで連続ドラッグと配置保存・開き直しを確認する。同じ0.1.0の再配布なので、実際に今回のVSIXをインストールし、開いていた図を読み直して確認する。

次回の実行用プロンプト:

```text
Dropbox\www\studio\character-relationship-chart の第6段階修正版について、次の実機再確認結果を既存の自動検証と照合し、完了判定と関係資料の更新をしてください。

使用配布物: character-relationship-chart-web-stage6-fixes-2026-10-01.zip
環境: ［OS、ブラウザ版数、起動方法］
配置の復元: ［ok／失敗操作］
直接保存後の復元: ［ok／失敗操作］
連続ドラッグ・背景パン・タブ／ページ復帰: ［ok／失敗操作］
VS Code確認: ［実施結果／未実施］

最新のIDAD、プロジェクト指示、sources.md、README、MGMT、docs/PROCESS_CHART.md、docs/STAGE6_ACCEPTANCE.md、docs/STAGE6_PHYSICAL_DEVICE_CHECK.md、TESTING.md、change-details/character-relationship-chart-stage6-fixes-2026-10-01-ja.md を参照してください。

報告済みの初回確認1〜5と対応ファイル名の解決を引き継ぎ、今回の3必須項目を確認してください。全て合格なら、第6段階の完了日・根拠・未確認範囲を記録し、MGMT・工程表・受入・検証記録の判定をそろえてください。再発があれば完了扱いにせず、保存データと操作手順から原因を調査してください。未読のファイルを推測で更新せず、取得後の外部変更を照合し、既存ファイルは必ず改名バックアップしてから同名へ更新してください。
第7段階の実装には着手しないでください。
```

今回の3項目が利用者の環境で合格し、自動試験との照合が済むまでは第7段階へ進まない。

## 戻す必要が生じた場合

既存16ファイルの更新前データは上表の改名バックアップにある。復元時も、現在の更新版を別の未使用バックアップ名へ改名して保全し、名前の衝突がないことを確認してから元データを元の名前へ戻す。今回、復元や削除は実施していない。

新規の検証フォルダ・追加ファイルを取り消す場合は、変更範囲を確認してから別途指示する。Dropboxの削除操作を実行する場合にはその時点で明示確認を得る。

