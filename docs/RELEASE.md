# GitHub公開・配布手順

対象リポジトリは `satsuki-thyme/character-relationship-chart`。既存の `origin` を使い、新しいリポジトリは作りません。公開準備の時点でGitHub側は空、ローカルはmainブランチの初回コミット前でした。

## 公開するソース

README、LICENSE、第三者ライセンス、package.json、package-lock.json、src、media、packages/core、web、scripts、schema、examples、test、docs、TESTING.md、CHANGELOG.md、`.gitignore`、`.vscodeignore`、`.vscode/launch.json` が対象です。

`node_modules`、VSIX・ZIP、dist、verification、テスト生成物、`backup-YYYY-MM-DD-NN` 付きバックアップ、ローカル設定、認証ファイル、個人用作品は対象外です。個人データはリポジトリ外か `private/` に置いてください。`.view.json` を一律には除外していません。公開用サンプルの配置を共有する場合は `examples/` 内のものを確認して追加できます。

`.gitignore` は既に追跡されたファイルを除外しません。現在の初回公開以後も、コミット候補と履歴を確認します。トークン等が履歴に入っていた場合は公開前に失効と履歴対処を行います。

## 整備時のバックアップ規則

`.git` の有無を問わず、既存ファイルは更新内容を完成させ、直前の原本との一致と未使用番号を確認してから、元ファイルそのものを同じディレクトリのバックアップ名へ改名します。改名成功・元データ保持を確認した後、元のパス・名前へ更新版を書き、内容を検証します。コピーによるバックアップや直接上書きでは代替しません。新規ファイルにはバックアップは不要です。日付はAsia/Tokyoです。

| 元ファイル | バックアップ名の例 |
| --- | --- |
| `README.md` | `README.backup-2026-09-23-01.md` |
| `package-lock.json` | `package-lock.backup-2026-09-23-01.json` |
| `.gitignore`（拡張子なし） | `.gitignore.backup-2026-09-23-01` |
| `LICENSE`（拡張子なし） | `LICENSE.backup-2026-09-23-01` |

日付はバックアップ作成日、末尾の連番は同じ元ファイル・同じ日付について `01` から増やします。同名のバックアップを上書きしません。旧形式の既存バックアップは、元の日付と連番を保って `backup-` を追加しています。

`.gitignore` と `.vscodeignore` は、拡張子の有無・ディレクトリの深さを問わず新形式を除外します。旧形式のバックアップを再び持ち込んだ場合のため、旧形式の除外も維持しています。ソースZIPも公開対象ファイルだけで作り、バックアップを含めません。

この規則はソースや配布ファイルを整備するときのものです。拡張機能自身は、設定・配置・SVGの保存時にバックアップを自動作成しません。元に戻すときは、該当バックアップの内容で元ファイルを置き換えます。

## 公開前の確認と初回push

以下は管理者が公開を決めた後に実行する手順です。準備作業だけでGitHubへpushしたことを意味しません。

```sh
git status --short --branch
git remote -v
npm ci
npm run check
npm test
npm run package
git add .
git diff --cached --stat
git diff --cached --name-only
git diff --cached
```

ソース一覧にバックアップ、生成物、作品データ、個人用パス、秘密情報がないことを確認します。不要なファイルがあれば、初回コミット前は `git rm --cached -- 対象ファイル` でステージから外せます（作業ファイルは残ります）。

```sh
git commit -m "公開用ソースを整備"
git push -u origin main
```

Gitの名前・メールアドレスはコミットに記録されます。初回コミット前に自身の公開用設定を確認してください。共同作業や既存の更新がある場合は現在のブランチ・差分を確認し、上書きpushはしません。

## 利用者向けVSIX

生成された `character-relationship-chart.vsix` はソース管理に含めません。公開後にGitHub Releasesへ添付すると、利用者はNode.jsやnpmを用意せず導入できます。リリースを作る場合は、バージョン0.1.0とソースのコミットを対応付け、添付するVSIXの表示名・依存同梱・除外内容を確認します。

Marketplace公開は別作業です。現在のpublisherは手動VSIX配布用の `local` であり、Marketplace登録済みとみなさないでください。

## 初回利用者として確認

バックアップやnode_modulesを含まないソースだけを別ディレクトリへ展開し、READMEの `npm ci` から実行します。作成したVSIXをデスクトップ版VS Codeに入れ、サンプル作成→表示→GUI編集→保存→開き直しまで確認します。検証済み範囲と残りは [TESTING.md](../TESTING.md) を参照してください。

## 第2段階のパッケージ確認

`packages/core/` のJavaScriptとpackage.json、および `media/` の共有UI・アダプターがVSIXに必要です。Webviewが読み込む `packages/core/graph.js` の欠落に注意します。`jsonc-parser` とそのLICENSEを従来どおり同梱します。`test/`、`change-details/`、管理文書、coreの説明文書はVSIXに含めません。第2段階の手動検証用VSIXは `dist/character-relationship-chart-stage2.vsix`。公開版数・拡張IDは今回変更していません。

## 第3段階の配布物（当時の記録）

- `npm run build:web` で `dist/web/` を生成し、その中身を `character-relationship-chart-web-stage3.zip` にまとめる。ZIPの直下に `index.html` を置く。
- Web版には `index.html`、`app.js`、`shared.css`、`web.css`、英語と日本語のREADME、プロジェクトとjsonc-parserのLICENSE、サンプルJSONCの9ファイルを含める。VS Codeアダプター・GUIエディター・開発依存・個人データは含めない。
- ZIPを別の場所へ展開し、オフラインで `index.html` を直接開いて、ファイルの読込・表示操作を確認する。配布物の一部だけを移動しない。
- `npm run package` で共有UI変更を含むVSIXも作成する。第3段階の手動確認用は `dist/character-relationship-chart-stage3.vsix`。`web/`、`scripts/`、esbuild、Playwright、jsdomはVSIXに含めない。
- 拡張ID・表示名・版数は第2段階と同じ。両方の配布物と元ソースの内容を照合し、検証範囲を `TESTING.md` に記録する。公開やアップロード先の新設は別途決める。

## 第4段階の配布物（当時の記録）

- `npm run build:web` で `dist/web/` を生成し、直下にindex.htmlがある `dist/character-relationship-chart-web-stage4.zip` を作る。第3段階と同じ9ファイル構成で、app.jsには共有エディターと実coreの編集処理も含む。VS Codeアダプター、開発・検証依存、外部資産は含めない。
- 展開した配布物をオフラインで開き、GUIの「反映」→編集画面を閉じる→「設定をダウンロード」→実際に得たファイルの再読込を確認する。元ファイルへの直接上書きや表示データの保存は実装しない。
- `npm run package` で共有UI変更に対応するVSIXを再生成する。手動確認用は `dist/character-relationship-chart-stage4.vsix`。拡張ID・表示名・版数・依存は第3段階と同じ。Web専用ファイルとテストはVSIXへ含めない。
- 配布物と検証済みソースを照合し、結果は `TESTING.md` と `change-details/` に残す。公開・デプロイ・Marketplace作業はこの段階に含めない。

## 第5段階の配布物（2026-09-28 JST完了）

- `npm run build:web` 後の `dist/web/` 直下9ファイルを `dist/character-relationship-chart-web-stage5-completed.zip` にまとめる。直接保存機能を含む新しいapp.jsであることを確認する。
- `npm run package` 後のVSIXを `dist/character-relationship-chart-stage5-completed.vsix` とする。Webファイル・検証依存・工程表・受入手順を除外し、表示名・拡張ID・版数を維持する。
- ZIPを別の場所へ展開し、全エントリーのバイト一致、オフライン起動を確認する。VSIXの実行コードを検証済みソースと照合する。ハッシュは変更明細に記録し、古い配布物と区別する。
- 利用者の実機で通常保存・再読込と外部変更時の警告・保存停止を確認し、第5段階の完了判定を記録した。初回の `stage5` 配布物は保存し、今回の `stage5-completed` 配布物とはハッシュで区別する。実行コードは同じで、配布READMEの完了記録だけが変わる。OS・ブラウザ版数と未提示の個別試験を確認済みへ読み替えない。

## 第6段階の配布物（2026-10-01 JST、実機確認待ち）

- `npm run build:web` の9ファイルを `dist/character-relationship-chart-web-stage6.zip` へ格納し、展開後の全バイト一致・オフライン・設定と表示の実ダウンロード／再読込を検証する。
- `npm run package` の結果を `dist/character-relationship-chart-stage6.vsix` とする。実行コードとソースを照合し、Web・prompt・test・verification・開発依存を除外する。識別子と0.1.0は維持。
- 配布物の生成は実機受入完了を意味しない。ネイティブ表示データ書込の成功は第6段階受入で確認する。第5段階の完了版・過去記録を置き換えない。
- commit/push・公開・デプロイは今回の対象外。反映用パッケージは取得時差分と各SHA-256を守り、`.git` を要求する。バックアップ作成・ユーザー差分の強制置換はしない。

## 第8段階の配布（2026-10-10 JST）

`dist/character-relationship-chart-web-stage8-2026-10-10.zip` と `dist/character-relationship-chart-stage8-2026-10-10.vsix` を指定配布物とする。同じmanifest 0.1.0なのでファイル名とSHA-256で識別する。VSIXにはWeb・試験・受入/実行指示・バックアップを含めない。Webは全展開してindex.htmlを開く。利用者受入は `docs/STAGE8_ACCEPTANCE.md`。GitHub/Marketplace公開・pushは今回未実施。
