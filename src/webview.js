'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const uiMarkup = fs.readFileSync(path.join(__dirname, '..', 'media', 'ui.html'), 'utf8');
function escapeAttribute(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function getHtml(webview, extensionUri, Uri) {
  const nonce = crypto.randomBytes(18).toString('base64');
  const resource = name => escapeAttribute(webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', name)).toString());
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};`;
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
<link rel="stylesheet" href="${resource('style.css')}"><link rel="stylesheet" href="${resource('vscode-theme.css')}"><title>Character Relationship Chart</title></head>
<body>
${uiMarkup}
<script nonce="${nonce}" src="${resource('graph.js')}"></script><script nonce="${nonce}" src="${resource('editor.js')}"></script><script nonce="${nonce}" src="${resource('main.js')}"></script>
<script nonce="${nonce}" src="${resource('vscode-host.js')}"></script><script nonce="${nonce}" src="${resource('vscode-bootstrap.js')}"></script>
</body></html>`;
}
module.exports = { getHtml };
