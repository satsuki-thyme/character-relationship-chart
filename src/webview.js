'use strict';
const crypto = require('node:crypto');
function escapeAttribute(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function getHtml(webview, extensionUri, Uri) {
  const nonce = crypto.randomBytes(18).toString('base64');
  const resource = name => escapeAttribute(webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', name)).toString());
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};`;
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
<link rel="stylesheet" href="${resource('style.css')}"><title>Character Relationship Chart</title></head>
<body>
<header class="toolbar" role="toolbar" aria-label="相関図の操作">
  <h1 id="title">相関図</h1>
  <label class="search-box"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="名前・説明を検索" aria-label="名前や説明を検索"></label>
  <button id="edit-config" title="人物・グループ・関係を編集" disabled>編集</button>
  <button id="fit" title="図全体が収まるように表示">全体</button>
  <button id="toggle-details" aria-expanded="false" aria-controls="details" title="詳細欄を開閉">詳細</button>
  <button id="focus" title="操作欄を隠して高さを最大にする">図だけ</button>
  <details id="more-menu"><summary aria-label="その他の操作" title="その他の操作">⋯</summary><div class="menu-panel">
    <p id="description"></p>
    <label class="layout-label">配置 <select id="layout" aria-label="配置方法"><option value="auto">自動</option><option value="circle">円形</option></select></label>
    <div class="zoom-controls"><button id="zoom-out" aria-label="縮小">−</button><span id="zoom">100%</span><button id="zoom-in" aria-label="拡大">＋</button></div>
    <button id="reset">配置をリセット</button><button id="save-view">配置を今すぐ保存</button>
    <button id="reload-view" title="保存前の配置変更を破棄し、ファイルを読み込む">配置を再読込</button>
    <button id="open-view">表示データを開く</button><button id="open-source">設定を開く ↗</button>
    <button id="export">SVG保存</button>
    <div id="legend" aria-label="グループの凡例"></div><span id="stats" aria-live="polite"></span>
    <span id="storage-file"></span>
  </div></details>
</header>
<button id="exit-focus" hidden title="操作欄を戻す（Esc）">操作欄を戻す</button>
<div id="storage-error" role="alert" hidden></div>
<div id="error" role="alert" hidden></div>
<main><div id="canvas-wrap"><svg id="canvas" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="人物・項目の相関図" tabindex="0"><defs id="defs"></defs><g id="viewport"><g id="edges"></g><g id="nodes"></g></g></svg><div id="empty" hidden>まだ人物・項目がありません。<br>「編集」からキャラクターを追加してください。</div><div class="canvas-hint">ドラッグで移動 · ホイールで拡大縮小 · クリックで詳細</div></div>
<aside id="details" hidden aria-label="人物・関係の詳細"><div class="aside-top"><span class="eyebrow">DETAILS</span><button id="close-details" title="詳細欄を閉じる" aria-label="詳細欄を閉じる">×</button></div><button id="clear-selection" class="clear-button">選択を解除</button><div id="detail-content"></div></aside></main>
<dialog id="config-editor" aria-labelledby="editor-title">
  <div class="editor-top"><div><h2 id="editor-title">相関図を編集</h2><p>人物・所属・つながりを設定ファイルに保存</p></div><button id="edit-close" aria-label="編集を閉じる">×</button></div>
  <nav id="edit-tabs" aria-label="編集する項目"></nav>
  <div class="editor-body"><div class="editor-list-pane"><button id="edit-add" type="button">追加</button><div id="edit-list"></div></div>
    <form id="edit-form"><h3 id="edit-heading"></h3><fieldset id="edit-fields"></fieldset></form>
  </div>
  <div id="edit-confirm" role="alert" hidden></div>
  <div class="editor-bottom"><p id="edit-message" role="status"></p><div class="editor-actions"><span id="edit-state"></span><button id="edit-delete" type="button" class="danger">削除</button><button id="edit-reload" type="button">再読込</button><button id="edit-save" type="submit" form="edit-form" class="primary">保存して反映</button></div></div>
</dialog>
<footer><span id="status">読み込み中…</span><span id="storage-status"></span></footer>
<script nonce="${nonce}" src="${resource('graph.js')}"></script><script nonce="${nonce}" src="${resource('editor.js')}"></script><script nonce="${nonce}" src="${resource('main.js')}"></script>
</body></html>`;
}
module.exports = { getHtml };
