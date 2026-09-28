# 第5段階 実装・検証記録

記録日: 2026-09-28 JST  
対象: `Dropbox\www\studio\character-relationship-chart`  
判定: **実装済み・実機確認待ち。第5段階は未完了、第6段階は未着手。**

## 反映状況と参照元

Dropboxから取得した現行72ソースファイルを基準に、作業用コピーへ実装した。Git基準は `c681271e907da7aa6b6fe6dc9e8d3b916937054d`。開始時点の未コミット `MGMT.md` と、Git未追跡だがDropbox上に存在する `docs/PROCESS_CHART.md` を保全した。`MGMT.md` のassignmentは維持し、実装対象にしていない。

Dropbox接続のアップロード操作は既存ファイルの上書きに対応していないため、**Dropboxの元ファイルは変更していない**。削除・再作成による代替もしない。完成した更新ファイルと配布物を `character-relationship-chart-stage5-update.zip` にまとめた。展開後の `README-update-ja.md` に、内容照合付きの反映手順を記載している。

着手・再開時に、README、MGMT、工程表、設計・開発文書、TESTING、package.json、core、media、web、src、test、第4段階の反映・再確認記録、プロジェクト指示を確認した。IDAD正本は更新日時 `2026-09-25T21:10:07Z` のものを確認し、目的・工程・実装・検証・次の指示を分けて進めた。開発用バックアップ、commit/push、公開・デプロイは行っていない。

## 利用者から見た変更

- 対応する実行環境で「直接保存用に開く」と「保存」を表示する。利用者が選んだ元ファイルだけを保存先にする。
- 保存対象はGUIで「反映」済みのJSONC。未反映のフォームを保存操作で反映しない。
- 元ファイルが外部で変わっていれば、競合を表示して直接保存を止める。図・フォーム・反映済み設定は保持する。
- 権限拒否や保存失敗でも「設定をダウンロード」で反映済み編集を退避できる。未反映フォームは従来どおり必要な内容を反映してからダウンロードする。
- 非対応環境、通常のファイル読込、ドロップ、サンプルでは、第4段階の読込・編集・ダウンロードを利用する。
- 保存完了後の再読込が一致した場合だけ、その時点で保存した設定を未保存判定の基準にする。保存中にさらに反映した編集や未反映フォームは引き続き保護する。

## 保存・競合の仕組み

`web/file-access.js` にAPI検出、権限要求、UTF-8の読込・書込・比較を閉じ込めた。`web/host.js` が当該ページ内だけでハンドル・読込時の全バイト・停止状態を保持する。core、共有UI契約、VS Codeの保存処理にはブラウザAPIを持ち込まない。

1. 直接保存用に正常に開いたファイルの生バイトを基準にする。UTF-8の不正なバイト列は直接保存経路では拒否し、BOMを保持する。
2. 保存クリックに続けてreadwrite権限を要求する。許可されなければ書込を始めない。
3. 元ファイルを再読込し、基準と全バイトを比較する。更新日時・サイズだけでは判定しない。
4. 書込ストリームを作成した後、さらに元ファイルを確認する。反映済み文字列のスナップショットをUTF-8で書き、close直前にも元内容を確認する。
5. 競合・close前の失敗ではストリームをabortする。close後に再読込し、保存対象のバイトと一致することを確認する。
6. 競合、closeの失敗、保存後の不一致・読込失敗、abort失敗など、結果が不明な場合はそのハンドルへの直接保存を停止する。自動再送・自動マージ・自動採用はしない。

二重保存や保存中の設定切替は拒否し、後から自動実行するキューは作らない。読込失敗・切替取消・対応する表示データだけの読込では既存の設定と保存先を維持する。ページの再起動後にハンドルや権限が残ることを前提としない。

保存が確認できても新しい反映済みJSONCが保存スナップショットと異なれば未保存を維持する。ダウンロード開始は保存完了の証明にしない。別設定への切替確認・離脱確認は従来どおりで、保存中も離脱確認の対象にする。

## APIの条件と技術的な限界

実装時に次の公式資料を確認した。

- [MDN: showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker): 安全なコンテキスト、利用者の操作、限定的なブラウザ対応。
- [MDN: requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission): readwrite権限の要求と結果。
- [MDN: createWritable](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable): closeまでの書込反映、keepExistingData、exclusiveモード。
- [WHATWG File System](https://fs.spec.whatwg.org/): ハンドルと書込ストリームの処理。

ブラウザ名だけで可否を決めず、secure contextと必要なAPIの存在を検出する。実際の権限・実装・ポリシーによる拒否は実行時に扱う。`exclusive` はOS上の別エディターまで排他する保証として扱わない。

**最後の比較とcloseによる確定の間を、比較条件付きの1操作にはできない。** その間に別アプリが書き込む競合窓は残る。保存後の照合は不一致を検出するが、すでに失われた外部内容を回復する保証にはならない。保存操作中は他のエディター・同期ツールから同じファイルへ書き込まない運用が必要。完全な同時更新排他が必須なら、このAPIだけで完了とせず、別工程で保存方式を見直す。

## 実行した検証

環境: Linux、Node.js v24.19.0、npm 11.9.0、jsdom 26.1.0、Chromium Headless 153.0.8010.0、Playwright。検証用のブラウザ・DOM依存は配布物に含めていない。Webセキュリティを無効化する起動オプションは使っていない。

| 検証 | 結果 |
| --- | --- |
| `npm run check` | 19ファイル成功 |
| `npm test` | 96件成功、失敗・スキップ0 |
| `npm run test:web` | 13件成功、失敗・スキップ0 |
| `node --test test/ui-dom-check.js test/web-dom-check.js` | 25件成功（共通UI12、Web13） |
| `node test/web-browser-check.js` | 既存の実ブラウザ8操作群成功。GUI・ダウンロード・再読込・狭い画面・CSP・オフライン |
| `node test/web-save-browser-check.js` | 実ブラウザUI＋模擬ハンドルで5操作群成功。実ダウンロードも再解析 |
| `node test/web-native-file-check.js` | 実ファイルへのネイティブ読込成功。pickerはAbortError、readwrite権限denied。拒否時に元ファイル・編集・ダウンロードを保持 |
| `npm run build:web` | 成功、9ファイル |
| `npm run package` | 成功、53エントリーのVSIX |
| 配布物の照合・展開動作 | Web全9ファイルと現行ビルドが一致。VSIXのコード・依存・manifest・除外対象を確認。展開WebでGUI編集・UTF-8ダウンロード、展開VSIXのcoreで6人物・8経路を確認 |

模擬試験では、人物・グループ・関係・全体設定、ID変更時の参照、複数所属、日本語・BOM・CRLF・タブ・コメント、同じサイズでの外部変更、空白だけの変更、create/write中の競合、権限拒否、読込・write・close・abort失敗、保存後不一致、保存中の追加編集、切替取消、未反映フォーム保持を確認した。変更対象外のJSONC保持特性は既存coreをそのまま使い、配列編集に伴う隣接範囲の整形という従来の制約も維持した。

通常操作の実ブラウザ試験でHTTP(S)要求は0件。ネットワークをofflineにしてfile URLで実行した。永続化、自動保存、Web独自Undo、表示データ出力、SVG、本格再編は追加していない。

共通core・src・schema・package-lockの16ファイルは取得時とSHA-256一致。共有エディターの変更はWeb向け保存案内文のみ。表示名、識別子、版数0.1.0、本番依存jsonc-parser 3.3.1を維持した。VS Code保存・Undo境界・競合・GUIは模擬APIとDOMで回帰確認した。

パッケージ作成時は、作業環境に複製したnode_modulesの実行リンク不備で初回失敗したが、作業環境のリンクを復元して再実行し成功した。ソース・依存指定・lockfileの変更による回避はしていない。

今回の実行ログと照合結果は `verification/stage5/` に追加し、第4段階以前の記録は上書きしていない。

## 未確認事項と完了判定

ネイティブの元ファイルへの**保存成功**、OSの選択UI・許可UI、保存後の実ファイル再読込、実エディターとの競合停止は、このHeadless環境では確認できていない。模擬ハンドルでの成功を代用しない。Windows/macOS・他ブラウザ、実VS Code導入・Extension Host・実Undoも未確認。

完了条件1（対応環境での実ファイル保存）と7（必要な実機確認）の証拠が不足するため、MGMTでは第5段階を未完了とした。実装・自動検証・配布物の作成は済んでいるが、第6段階へ進める判定にはしていない。

[実機確認手順](../docs/STAGE5_ACCEPTANCE.md) に従い、利用するPCでサンプルの作業用コピーを使って直接保存・再読込・外部変更時の停止を確認する。その結果を追記してから段階の完了条件を再判定する。

## 成果物

| ファイル | エントリー数 | バイト数 | SHA-256 |
| --- | ---: | ---: | --- |
| `dist/character-relationship-chart-web-stage5.zip` | 9 | 54635 | `5d285657e67246170983649abdc47ab69863571aa5430b9b6acbadf4b2140921` |
| `dist/character-relationship-chart-stage5.vsix` | 53 | 425720 | `3988a98a233078a3baf4f06c1f4611c39b5ac84468cd7b2abab5161862d19dae` |

Web ZIPは現行の9生成ファイルと全バイト一致。VSIXはVSCEがREADMEの相対リンクをGitHub URLへ変換する標準処理を照合したうえで、それ以外の同梱ソース・依存は全バイト一致。自動生成されたmanifestは名称・版数・識別子を別途照合した。第4段階の古い配布物ではない。

更新ZIPには、取得済み現行ファイルとの差分に当たる完成ファイル、上記2配布物、検証記録、変更明細、反映手順とSHA-256照合用の補助スクリプトを含める。`.git`、node_modules、認証情報、非公開データ、開発用バックアップは含めない。未変更ファイルは更新せず、取得後に行われた変更はハッシュ不一致として停止する。ファイル単位で反映するため全体を一括で戻す仕組みではない。停止した場合は理由と反映済み一覧を確認する。補助スクリプトのLinux検証8項目は成功し、Windows上の実行は未確認。

## 主な更新ファイルと次工程

- 保存実装: `web/file-access.js`（新規）、`web/host.js`、`web/main.js`、`web/index.html`、`web/style.css`。
- 共通画面・検査: `media/editor.js` のWeb向け文言、`package.json` の構文検査、`.vscodeignore` の管理文書除外。
- テスト: `test/web-save.test.js`、`test/web-save-browser-check.js`、`test/web-native-file-check.js`（新規）、`test/web-dom-check.js`。
- 文書: README、Web README、設計・開発・配布文書、TESTING、CHANGELOG、MGMT、工程表、実機確認手順、第6段階の条件付きプロンプト。

IDADに沿う次作業は第5段階の実機確認・完了判定。推奨は標準的な高性能モデル／標準モード。不具合調査が必要なら高推論。第6段階は第5段階完了後に高性能モデル／高推論モードで進める。実行指示は [工程表の次の実行指示](../docs/PROCESS_CHART.md) と [第6段階プロンプト案](../docs/STAGE6_PROMPT.md) を参照する。
