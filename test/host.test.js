'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const createHost = require('../media/vscode-host');
const { harness } = require('./helpers/vscode-harness');
const { getHtml } = require('../src/webview');
const empty = { nodes: [], edges: [] };
function fixture(post) {
  const events = new EventTarget(), sent = [], states = [];
  const host = createHost({ setState: value => states.push(value), postMessage: value => { sent.push(value); post?.(value); } }, events);
  return { host, sent, states, events, receive: data => events.dispatchEvent(new MessageEvent('message', { data })) };
}
test('the host keeps ordered view operations and legacy state clearing out of shared UI', t => {
  const f = fixture(); t.after(() => f.host.dispose());
  assert.deepEqual(f.states, [null]);
  const state = { version: 1, positions: { hero: { x: 10, y: 20, source: ',' } } };
  f.host.ready(); f.host.updateView(state); f.host.saveView(); f.host.reloadView(); f.host.openView(); f.host.openSource(); f.host.exportSvg('<svg/>');
  assert.deepEqual(f.sent, [{ type: 'ready' }, { type: 'viewState', state }, { type: 'saveView' }, { type: 'reloadView' }, { type: 'openViewFile' }, { type: 'openSource' }, { type: 'export', svg: '<svg/>' }]);
  assert.equal(f.host.postMessage, undefined); assert.equal(f.host.setState, undefined);
});
test('host subscriptions route valid updates, including invalid-config reports, and can unsubscribe', t => {
  const f = fixture(); t.after(() => f.host.dispose()); const updates = [], views = [], statuses = [];
  const off = f.host.onConfig(value => updates.push(value));
  f.host.onView(value => views.push(value)); f.host.onStorage(value => statuses.push(value));
  for (const message of [null, [], 'x', {}, { type: 'update' }, { type: 'update', documentVersion: 1, issues: [null] }, { type: 'init', viewState: [] }, { type: 'storage', status: 'unknown' }, { type: '__proto__' }]) f.receive(message);
  assert.equal(updates.length + views.length + statuses.length, 0);
  f.receive({ type: 'init', viewState: { version: 1 }, fileName: '人物.jsonc.view.json' });
  f.receive({ type: 'update', config: empty, graph: { ...empty, groups: [] }, documentVersion: 1, issues: [] });
  f.receive({ type: 'update', documentVersion: 2, issues: [{ line: 1, message: '書式エラー' }] });
  f.receive({ type: 'storage', status: 'error', message: '外部変更' });
  assert.equal(updates.length, 2); assert.equal(updates[1].config, undefined); assert.equal(views[0].fileName, '人物.jsonc.view.json'); assert.equal(statuses[0].message, '外部変更');
  off(); f.receive({ type: 'update', documentVersion: 3, issues: [] }); assert.equal(updates.length, 2);
});
test('edit promises correlate out-of-order replies and ignore duplicate or unknown requests', async t => {
  const f = fixture(); t.after(() => f.host.dispose());
  const operation = { kind: 'general', action: 'save', value: { title: '新しい図' } };
  const first = f.host.editConfig(operation, 3), second = f.host.editConfig(operation, 4);
  const [a, b] = f.sent; assert.notEqual(a.requestId, b.requestId); assert.equal(a.baseVersion, 3); assert.deepEqual(a.operation, operation);
  f.receive({ type: 'editResult', requestId: 999, ok: false });
  f.receive({ type: 'editResult', requestId: b.requestId, ok: false, message: '外部変更' });
  assert.equal((await second).message, '外部変更');
  f.receive({ type: 'editResult', requestId: a.requestId, ok: true, config: empty, documentVersion: 5, index: null });
  assert.equal((await first).documentVersion, 5);
  f.receive({ type: 'editResult', requestId: a.requestId, ok: false });
});
test('synchronous replies, send failures, and disposal settle pending edits', async () => {
  let sync;
  sync = fixture(message => sync.receive({ type: 'editResult', requestId: message.requestId, ok: false, message: 'rejected' }));
  assert.equal((await sync.host.editConfig({}, 1)).ok, false); sync.host.dispose();
  const failed = fixture(() => { throw new Error('通信失敗'); });
  await assert.rejects(failed.host.editConfig({}, 1), /通信失敗/); failed.host.dispose();
  const closed = fixture(), updates = []; closed.host.onConfig(value => updates.push(value));
  const rejected = assert.rejects(closed.host.editConfig({}, 1), /保存結果/);
  closed.events.dispatchEvent(new Event('pagehide')); await rejected;
  closed.receive({ type: 'update', documentVersion: 1, issues: [] }); assert.equal(updates.length, 0);
  await assert.rejects(closed.host.editConfig({}, 1), /閉じられ/); closed.host.dispose();
});
test('shared UI modules can be loaded without a VS Code API and start only with an injected host', () => {
  const context = { window: {} }; vm.createContext(context);
  for (const file of ['main.js', 'editor.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../media', file), 'utf8');
    assert.doesNotMatch(source, /acquireVsCodeApi|postMessage|addEventListener\(['"]message|setState\(/);
    vm.runInContext(source, context);
  }
  assert.equal(typeof context.window.RelationsUi, 'function'); assert.equal(typeof context.window.RelationsEditor, 'function');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../media/style.css'), 'utf8'), /--vscode-/);
});
test('Webview composition supplies nonce-protected adapter scripts and local shared markup', () => {
  const Uri = { joinPath: (_, ...parts) => ({ toString: () => 'https://local.test/' + parts.join('/') }) };
  const webview = { asWebviewUri: value => value, cspSource: 'https://local.test' };
  const html = getHtml(webview, {}, Uri);
  const scripts = [...html.matchAll(/<script nonce="([^"]+)" src="([^"]+)"><\/script>/g)];
  assert.deepEqual(scripts.map(match => path.basename(match[2])), ['graph.js', 'editor.js', 'main.js', 'vscode-host.js', 'vscode-bootstrap.js']);
  assert.equal(new Set(scripts.map(match => match[1])).size, 1);
  assert.ok(html.includes(`script-src &#39;nonce-${scripts[0][1]}&#39;`)); assert.doesNotMatch(html, /unsafe-inline/);
  assert.ok(html.includes(fs.readFileSync(path.join(__dirname, '../media/ui.html'), 'utf8')));
  assert.match(html, /vscode-theme\.css/);
  for (const match of scripts) assert.ok(fs.existsSync(path.join(__dirname, '../media', path.basename(match[2]))));
});
test('the adapter integrates with extension storage, GUI edits, stale revisions, and SVG export', async () => {
  const h = harness(), f = fixture();
  try {
    const doc = h.document(h.Uri.parse('file:///work/人物.jsonc'), '{ // keep\n"nodes":[{"id":"a","label":"A"}],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);
    const panel = h.created[0], configs = [], views = [];
    panel.webview.postMessage = async message => { f.receive(structuredClone(message)); return true; };
    f.host.onConfig(value => configs.push(value)); f.host.onView(value => views.push(value));
    const deliver = async () => { while (f.sent.length) await panel.receive(f.sent.shift()); };
    f.host.ready(); await deliver(); assert.equal(configs.at(-1).graph.nodes[0].label, 'A'); assert.equal(views.length, 1);
    f.host.updateView({ version: 1, positions: { a: { x: 88, y: 99, source: ',' } } }); f.host.saveView(); await deliver();
    const pending = f.host.editConfig({ kind: 'nodes', action: 'save', index: 0, value: { id: 'renamed', label: '名前' } }, 1);
    await deliver(); assert.equal((await pending).ok, true); assert.match(doc.text, /keep/);
    assert.equal(JSON.parse(h.files.get(doc.uri.toString() + '.view.json')).positions.renamed.x, 88);
    const before = doc.text, stale = f.host.editConfig({ kind: 'general', action: 'save', value: { title: 'stale' } }, 1);
    await deliver(); assert.equal((await stale).ok, false); assert.equal(doc.text, before);
    doc.save = async () => false;
    const failed = f.host.editConfig({ kind: 'general', action: 'save', value: { title: '未保存の入力' } }, doc.version);
    await deliver(); assert.equal((await failed).ok, false); assert.equal(doc.isDirty, true); assert.match(doc.text, /未保存の入力/);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>図</text></svg>', target = h.Uri.parse('file:///work/export.svg');
    h.selections.push(target); f.host.exportSvg(svg); await deliver(); assert.equal(h.files.get(target.toString()).toString(), svg);
    doc.text = '{invalid'; doc.version++; await h.changed.fire({ document: doc }); await new Promise(resolve => setTimeout(resolve, 230));
    assert.equal(configs.at(-1).config, undefined); assert.ok(configs.at(-1).issues.length);
    assert.deepEqual(h.errors, []);
  } finally { f.host.dispose(); await h.dispose(); }
});
