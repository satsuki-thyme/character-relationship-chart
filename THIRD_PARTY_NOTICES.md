# 第三者ライセンス

## jsonc-parser 3.3.1

JSONCの解析とコメントを保持した編集に使用します。Microsoft製、MIT License。
ソース: https://github.com/microsoft/node-jsonc-parser

VSIXには実行時コードと同ライブラリの `LICENSE.md` を同梱します。次の表記も保持してください。

```text
The MIT License (MIT)

Copyright (c) Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 開発用ツール

`@vscode/vsce` 4.0.0（MIT）はVS Code公式のパッケージ作成ツールです。開発用依存としてlockfileで固定し、VSIXの実行時依存には含めません。開発用の間接依存の条件は、それぞれのパッケージのLICENSEおよびpackage-lock.jsonを参照してください。プロジェクトのMIT Licenseは第三者コードのライセンスを置き換えません。
