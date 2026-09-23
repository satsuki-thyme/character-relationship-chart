# GitHub公開・配布手順

対象リポジトリは `satsuki-thyme/character-relationship-chart`。既存の `origin` を使い、新しいリポジトリは作りません。公開準備の時点でGitHub側は空、ローカルはmainブランチの初回コミット前でした。

## 公開するソース

README、LICENSE、第三者ライセンス、package.json、package-lock.json、src、media、schema、examples、test、docs、TESTING.md、CHANGELOG.md、`.gitignore`、`.vscodeignore`、`.vscode/launch.json` が対象です。

`node_modules`、VSIX・ZIP、dist、verification、テスト生成物、`backup-YYYY-MM-DD-NN` 付きバックアップ、ローカル設定、認証ファイル、個人用作品は対象外です。個人データはリポジトリ外か `private/` に置いてください。`.view.json` を一律には除外していません。公開用サンプルの配置を共有する場合は `examples/` 内のものを確認して追加できます。

`.gitignore` は既に追跡されたファイルを除外しません。現在の初回公開以後も、コミット候補と履歴を確認します。トークン等が履歴に入っていた場合は公開前に失効と履歴対処を行います。

## 整備時のバックアップ規則

`.git` フォルダがあるフォルダ以下では、バックアップを作らずに更新します。それ以外の既存ファイルでは、元の内容を同じディレクトリへ保存してから、同じパス・同じファイル名に更新します。新規ファイルにはバックアップは不要です。

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
