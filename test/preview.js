'use strict';
// Local manual UI fixture. Uses disposable in-memory files and the real extension.
// Run: node test/preview.js; open http://127.0.0.1:8765/vscode or /standalone.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { harness } = require('./helpers/vscode-harness');
const base = path.resolve(__dirname, '..'), sessions = new Map();
let serial = 0;
const controls = `<div id="qa-controls">
検証用: <button data-case="external">外部変更</button><button data-case="invalid">不正な設定</button><button data-case="failure">保存失敗</button><button data-case="normal">保存復旧</button><span id="qa-result"></span></div>`;
function bridge(id, standalone) {
  return `(() => {
    const endpoint = '/session/${id}', queue = []; let cursor = 0, busy = false, acquired = false;
    const listeners = { update: new Set(), init: new Set(), storage: new Set() }, edits = new Map(); let serial = 0;
    const accept = message => {
      if (!${standalone}) { window.dispatchEvent(new MessageEvent('message', { data: message })); return; }
      if (message.type === 'editResult') { edits.get(message.requestId)?.(message); edits.delete(message.requestId); }
      else for (const listener of listeners[message.type] || []) listener(message);
    };
    async function pump() {
      if (busy) return; busy = true;
      try {
        while (queue.length) await fetch(endpoint, { method: 'POST', body: JSON.stringify(queue.shift()) });
        const result = await (await fetch(endpoint + '?cursor=' + cursor)).json(); cursor = result.cursor;
        for (const message of result.messages) accept(message);
        document.getElementById('qa-result').textContent = result.summary;
      } catch (error) { document.getElementById('qa-result').textContent = error.message; }
      finally { busy = false; }
    }
    const send = message => { queue.push(message); void pump(); };
    if (${standalone}) {
      // Test-only host: no acquireVsCodeApi, window message listener or VS adapter.
      const listen = (type, callback) => { listeners[type].add(callback); return () => listeners[type].delete(callback); };
      window.fixtureHost = {
        onConfig: callback => listen('update', callback), onView: callback => listen('init', callback), onStorage: callback => listen('storage', callback),
        ready: () => send({ type: 'ready' }), updateView: state => send({ type: 'viewState', state }),
        saveView: () => send({ type: 'saveView' }), reloadView: () => send({ type: 'reloadView' }),
        openSource: () => send({ type: 'openSource' }), openView: () => send({ type: 'openViewFile' }), exportSvg: svg => send({ type: 'export', svg }),
        editConfig: (operation, baseVersion) => new Promise(resolve => { const requestId = ++serial; edits.set(requestId, resolve); send({ type: 'editConfig', requestId, operation, baseVersion }); })
      };
    } else {
      window.acquireVsCodeApi = () => { if (acquired) throw Error('acquired twice'); acquired = true; return { postMessage: send, setState: value => { if (value !== null) throw Error('unexpected persistence'); } }; };
    }
    document.querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => send({ simulate: button.dataset.case })));
    setInterval(pump, 100);
  })();`;
}
async function createSession(standalone, origin) {
  const h = harness(), doc = h.document(h.Uri.parse('file:///work/登場人物.jsonc'), fs.readFileSync(path.join(base, 'examples/characters.relations.jsonc'), 'utf8'));
  await h.commands.get('characterRelationshipChart.open')(doc.uri);
  const id = String(++serial), panel = h.created[0]; sessions.set(id, { h, doc, panel, save: doc.save });
  let html = panel.webview.html.replaceAll('file://' + base, origin).replaceAll('vscode-webview://test', origin).replace("default-src &#39;none&#39;;", "default-src &#39;none&#39;; connect-src &#39;self&#39;;");
  const nonce = html.match(/<script nonce="([^"]+)"/)[1];
  html = html.replace('</head>', `<link rel="stylesheet" href="${origin}/preview.css"></head>`);
  html = html.replace('<script nonce=', controls + `<script nonce="${nonce}">${bridge(id, standalone)}</script><script nonce=`);
  if (standalone) html = html.replace(/<script[^>]+src="[^"]*vscode-(?:host|bootstrap)\.js"><\/script>/g, '').replace(/<link[^>]+href="[^"]*vscode-theme\.css">/g, '').replace('</body>', `<script nonce="${nonce}">RelationsUi(window.fixtureHost);</script></body>`);
  return html;
}
const server = http.createServer(async (request, response) => {
  try {
    const origin = 'http://127.0.0.1:8765', url = new URL(request.url, origin);
    if (request.method === 'GET' && ['/vscode', '/standalone', '/'].includes(url.pathname)) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(await createSession(url.pathname === '/standalone', origin)); return;
    }
    if (request.method === 'GET' && url.pathname === '/preview.css') {
      response.setHeader('Content-Type', 'text/css'); response.end('body{padding-bottom:38px}#qa-controls{position:fixed;bottom:0;left:0;z-index:1000;background:#fff;color:#111;padding:4px;font:12px sans-serif}'); return;
    }
    if (request.method === 'GET' && /^\/media\/[\w.-]+$/.test(url.pathname)) {
      const file = path.join(base, url.pathname);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript'); response.end(fs.readFileSync(file)); return;
    }
    const session = sessions.get(url.pathname.split('/')[2]);
    if (!session || !url.pathname.startsWith('/session/')) { response.writeHead(404); response.end(); return; }
    const { h, doc, panel } = session;
    if (request.method === 'POST') {
      let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 8 * 1024 * 1024) throw Error('too large'); }
      const message = JSON.parse(body);
      if (message.simulate === 'failure') doc.save = async () => false;
      else if (message.simulate === 'normal') doc.save = session.save;
      else if (message.simulate) {
        doc.text = message.simulate === 'invalid' ? '{invalid' : doc.text.replace('星明かりの旅', '外部で変更した図'); doc.version++; doc.isDirty = true;
        await h.changed.fire({ document: doc });
      } else {
        if (message.type === 'export') h.selections.push(h.Uri.parse('file:///work/preview.svg'));
        await panel.receive(message);
      }
      response.end('{}'); return;
    }
    const messages = h.messages.slice(Number(url.searchParams.get('cursor')) || 0);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ cursor: h.messages.length, messages, summary: `版 ${doc.version} / 配置 ${h.files.has(doc.uri.toString() + '.view.json') ? '保存済み' : '未作成'} / SVG ${h.files.has('file:///work/preview.svg') ? '保存済み' : '未作成'}` }));
  } catch (error) { response.writeHead(500); response.end(String(error.stack || error)); }
});
server.listen(8765, '127.0.0.1', () => console.log('UI fixture: http://127.0.0.1:8765/vscode and /standalone'));
process.on('SIGINT', async () => { for (const { h } of sessions.values()) await h.dispose(); server.close(); process.exit(0); });
