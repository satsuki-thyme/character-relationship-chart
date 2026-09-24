'use strict';
// Optional DOM regression suite: jsdom 26.1.0 (kept out of runtime dependencies).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const { harness } = require('./helpers/vscode-harness');
const { parseConfig } = require('../src/config');
const base = path.resolve(__dirname, '..');
function dom() {
  const result = new JSDOM('<!doctype html><html><body>' + fs.readFileSync(path.join(base, 'media/ui.html'), 'utf8') + '</body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = result.window;
  w.ResizeObserver = class { observe() {} };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.SVGElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 1000, height: 680 });
  w.SVGElement.prototype.hasPointerCapture = () => false;
  w.requestAnimationFrame = callback => w.setTimeout(callback, 0);
  for (const file of ['packages/core/graph.js', 'media/editor.js', 'media/main.js']) w.eval(fs.readFileSync(path.join(base, file), 'utf8'));
  w.SVGElement.prototype.setPointerCapture = function () {};
  w.SVGElement.prototype.releasePointerCapture = function () {};
  return result;
}
const text = '{ // keep this comment\n"title":"図","nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","label":"仲間"}]}';
const turn = () => new Promise(resolve => setImmediate(resolve));
function ui(result) {
  const w = result.window, $ = id => w.document.getElementById(id);
  return {
    $, click: id => $(id).click(),
    fill(id, value) { $(id).value = value; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); },
    submit() { $('edit-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); }
  };
}
async function connected(source = text) {
  const h = harness(), result = dom(), w = result.window, doc = h.document(h.Uri.parse('file:///work/任意名.jsonc'), source);
  await h.commands.get('characterRelationshipChart.open')(doc.uri);
  const panel = h.created[0], errors = [], states = [];
  let queue = Promise.resolve(), acquired = 0;
  w.addEventListener('error', event => errors.push(event.error));
  panel.webview.postMessage = async message => { w.dispatchEvent(new w.MessageEvent('message', { data: structuredClone(message) })); return true; };
  w.acquireVsCodeApi = () => { acquired++; return { setState: value => states.push(value), postMessage: message => { const copy = structuredClone(message); queue = queue.then(() => panel.receive(copy)); } }; };
  for (const file of ['vscode-host.js', 'vscode-bootstrap.js']) w.eval(fs.readFileSync(path.join(base, 'media', file), 'utf8'));
  const flush = async () => { await queue; await turn(); };
  await flush();
  return { ...ui(result), h, result, w, doc, panel, errors, states, acquired, flush, async close() { w.dispatchEvent(new w.Event('pagehide')); result.window.close(); await h.dispose(); } };
}
function pointer(f, target, type, x, y, pointerId = 1) {
  const event = new f.w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
}
function gesture(f, index, moved, finish = 'pointerup') {
  const node = f.w.document.querySelectorAll('.node')[index], canvas = f.$('canvas');
  pointer(f, node, 'pointerdown', 200, 200);
  if (moved) pointer(f, canvas, 'pointermove', 250, 230);
  pointer(f, canvas, finish, moved ? 250 : 200, moved ? 230 : 200);
}
const crossed = JSON.stringify({
  nodes: [{ id: 'a', label: 'A', x: -300, y: 0 }, { id: 'b', label: 'B', x: 300, y: 0 },
    { id: 'c', label: 'C', x: 0, y: -240 }, { id: 'd', label: 'D', x: 0, y: 240 }],
  edges: [{ from: 'a', to: 'b', label: 'First', shape: 'straight' },
    { from: 'c', to: 'd', label: 'Second', shape: 'straight' },
    { from: 'd', to: 'a', shape: 'curved' }]
});
test('dragging saves and reloads node positions without opening details; a subsequent click opens details', async () => {
  const f = await connected();
  try {
    assert.equal(f.$('details').hidden, true);
    gesture(f, 0, true);
    f.$('canvas').dispatchEvent(new f.w.MouseEvent('click', { bubbles: true }));
    f.click('save-view'); await f.flush();
    assert.equal(f.$('details').hidden, true);
    const saved = JSON.parse(f.h.files.get(f.doc.uri.toString() + '.view.json'));
    assert.equal(saved.ui.details, false); assert.ok(Number.isFinite(saved.positions.a.x));
    const before = f.w.document.querySelector('.node').getAttribute('transform');
    f.click('reload-view'); await f.flush();
    assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), before);
    gesture(f, 0, false); await f.flush();
    assert.equal(f.$('details').hidden, false); assert.equal(f.$('detail-content').querySelector('h2').textContent, 'A');
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
test('dragging another node preserves the current detail and selection; cancellation never activates a node', async () => {
  const f = await connected();
  try {
    gesture(f, 0, false); await f.flush();
    gesture(f, 1, true); await f.flush();
    assert.equal(f.$('detail-content').querySelector('h2').textContent, 'A');
    assert.equal(f.w.document.querySelectorAll('.node')[0].getAttribute('aria-pressed'), 'true');
    f.click('close-details');
    gesture(f, 1, false, 'pointercancel'); await f.flush();
    assert.equal(f.$('details').hidden, true);
    assert.equal(f.w.document.querySelectorAll('.node')[0].getAttribute('aria-pressed'), 'true');
    gesture(f, 1, true, 'pointercancel'); await f.flush();
    assert.equal(f.$('details').hidden, true);
  } finally { await f.close(); }
});
test('small pointer movement remains a click and keyboard selection still opens details', async () => {
  const f = await connected();
  try {
    pointer(f, f.w.document.querySelector('.node'), 'pointerdown', 200, 200);
    pointer(f, f.$('canvas'), 'pointermove', 202, 201);
    pointer(f, f.$('canvas'), 'pointerup', 202, 201);
    assert.equal(f.$('details').hidden, false);
    f.click('close-details');
    f.w.document.querySelectorAll('.node')[1].dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(f.$('details').hidden, false); assert.equal(f.$('detail-content').querySelector('h2').textContent, 'B');
  } finally { await f.close(); }
});
test('every edge label and its background paint above every edge, including after drag and selection', async () => {
  const f = await connected(crossed);
  try {
    const checkOrder = () => {
      const lines = [...f.w.document.querySelectorAll('.edge-line')];
      const labels = [...f.w.document.querySelectorAll('.edge-label, .edge-label-bg')];
      assert.equal(lines.length, 3); assert.equal(labels.length, 4);
      for (const line of lines) for (const label of labels) assert.ok(line.compareDocumentPosition(label) & f.w.Node.DOCUMENT_POSITION_FOLLOWING);
    };
    checkOrder();
    f.w.document.querySelector('.edge-label-bg').dispatchEvent(new f.w.MouseEvent('click', { bubbles: true }));
    assert.equal(f.$('detail-content').querySelector('h2').textContent, 'First');
    assert.equal(f.w.document.querySelector('.edge[data-edge="0"]').getAttribute('aria-pressed'), 'true');
    f.w.document.querySelector('.edge[data-edge="1"]').dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(f.$('detail-content').querySelector('h2').textContent, 'Second');
    gesture(f, 0, true); await f.flush(); await new Promise(resolve => f.w.setTimeout(resolve, 10));
    checkOrder();
    f.fill('search', 'A');
    const label = f.w.document.querySelectorAll('.edge-label-bg')[1];
    assert.equal(label.closest('.faded') !== null, true);
  } finally { await f.close(); }
});
test('exported SVG paints all labels above all edge paths and retains arrow markers', async () => {
  const f = await connected(crossed);
  try {
    const target = f.h.Uri.parse('file:///work/layers.svg'); f.h.selections.push(target); f.click('export'); await f.flush();
    const svg = new f.w.DOMParser().parseFromString(f.h.files.get(target.toString()).toString(), 'image/svg+xml');
    assert.equal(svg.querySelector('parsererror'), null);
    const labels = [...svg.querySelectorAll('text')].filter(e => ['First', 'Second'].includes(e.textContent));
    const lines = [...svg.querySelectorAll('path[marker-end]')];
    assert.equal(labels.length, 2); assert.equal(lines.length, 3);
    for (const line of lines) for (const label of labels) assert.ok(line.compareDocumentPosition(label) & f.w.Node.DOCUMENT_POSITION_FOLLOWING);
    for (const line of lines) assert.ok(svg.querySelector(line.getAttribute('marker-end').slice(4, -1)));
  } finally { await f.close(); }
});
test('shared UI renders and submits through an injected host with no VS Code or message transport', async () => {
  const result = dom(), w = result.window, u = ui(result), callbacks = { config: [], view: [], storage: [] }, calls = [];
  const current = parseConfig(text);
  const host = {
    onConfig: callback => callbacks.config.push(callback), onView: callback => callbacks.view.push(callback), onStorage: callback => callbacks.storage.push(callback),
    ready() { callbacks.view.forEach(fn => fn({ viewState: { version: 1 } })); callbacks.config.forEach(fn => fn({ ...current, documentVersion: 7, dirty: false })); },
    editConfig: async (operation, version) => { calls.push({ operation, version }); throw Error('保存先に書き込めません'); },
    updateView: state => calls.push({ view: structuredClone(state) }), saveView() {}, reloadView() {}, openView() {}, openSource() {}, exportSvg: svg => calls.push({ svg })
  };
  try {
    assert.equal(w.acquireVsCodeApi, undefined); assert.equal(w.createVsCodeHost, undefined);
    w.RelationsUi(host);
    assert.equal(w.document.querySelectorAll('.node').length, 2); assert.equal(w.document.querySelectorAll('.edge').length, 1);
    u.click('edit-config'); u.fill('field-title', '保つ入力'); u.submit(); await turn();
    assert.equal(calls[0].version, 7); assert.equal(u.$('field-title').value, '保つ入力'); assert.match(u.$('edit-message').textContent, /書き込めません/); assert.equal(u.$('edit-save').disabled, false);
  } finally { w.close(); }
});
test('VS Code bootstrap, GUI edit, source open, sidecar save/reload and SVG work through the adapter', async () => {
  const f = await connected();
  try {
    assert.equal(f.acquired, 1); assert.deepEqual(f.states, [null]); assert.equal(f.w.document.querySelectorAll('.node').length, 2);
    assert.equal(f.h.files.has(f.doc.uri.toString() + '.view.json'), false);
    f.click('edit-config'); f.fill('field-title', '編集した図'); f.submit(); await f.flush();
    assert.match(f.doc.text, /編集した図/); assert.match(f.doc.text, /keep this comment/); assert.equal(f.$('title').textContent, '編集した図'); assert.match(f.$('edit-message').textContent, /保存しました/);
    f.click('edit-close'); f.click('toggle-details'); f.click('save-view'); await f.flush();
    assert.equal(JSON.parse(f.h.files.get(f.doc.uri.toString() + '.view.json')).ui.details, true);
    f.click('reload-view'); await f.flush(); assert.equal(f.$('details').hidden, false);
    f.click('open-source'); await f.flush(); assert.equal(f.h.vscode.window.activeTextEditor.document, f.doc);
    const target = f.h.Uri.parse('file:///work/result.svg'); f.h.selections.push(target); f.click('export'); await f.flush();
    const svg = f.h.files.get(target.toString()).toString(); assert.match(svg, /<svg/); assert.match(svg, /編集した図/); assert.doesNotMatch(svg, /edge-hit|class="selection"/);
    assert.deepEqual(f.errors, []); assert.deepEqual(f.h.errors, []);
  } finally { await f.close(); }
});
test('an update newer than the save response remains current when the promise settles', async () => {
  const result = dom(), w = result.window, u = ui(result), callbacks = [];
  let resolveSave;
  const initial = parseConfig(text), newer = parseConfig(text.replace('"図"', '"新しい外部編集"'));
  try {
    w.RelationsEditor({ onConfig: fn => callbacks.push(fn), editConfig: () => new Promise(resolve => { resolveSave = resolve; }) });
    callbacks[0]({ ...initial, documentVersion: 1 }); u.click('edit-config'); u.fill('field-title', '保存する入力'); u.submit();
    resolveSave({ ok: true, config: initial.config, documentVersion: 2, index: null });
    callbacks[0]({ ...newer, documentVersion: 3 }); await turn();
    assert.equal(u.$('field-title').value, '新しい外部編集'); assert.equal(u.$('edit-save').disabled, false);
  } finally { w.close(); }
});
test('external configuration changes preserve a dirty GUI draft and disable stale saving', async () => {
  const f = await connected();
  try {
    f.click('edit-config'); f.fill('field-title', 'まだ保存しない入力');
    f.doc.text = f.doc.text.replace('"図"', '"外部変更"'); f.doc.version++;
    await f.panel.receive({ type: 'ready' });
    assert.equal(f.$('title').textContent, '外部変更'); assert.equal(f.$('field-title').value, 'まだ保存しない入力'); assert.equal(f.$('edit-save').disabled, true);
    f.submit(); await f.flush(); assert.doesNotMatch(f.doc.text, /まだ保存しない入力/);
    assert.match(f.$('edit-message').textContent, /別の場所で変更/); assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
test('failed disk writes retain GUI and text-editor changes, then reload allows retry', async () => {
  const f = await connected();
  try {
    const save = f.doc.save; f.doc.save = async () => false;
    f.click('edit-config'); f.fill('field-title', '保存に失敗した入力'); f.submit(); await f.flush();
    assert.equal(f.$('field-title').value, '保存に失敗した入力'); assert.match(f.$('edit-message').textContent, /未保存/); assert.equal(f.doc.isDirty, true);
    assert.equal(f.h.files.get(f.doc.uri.toString()).toString(), text);
    f.doc.save = save; f.click('edit-reload'); assert.equal(f.$('edit-confirm').hidden, false);
    f.$('edit-confirm').querySelector('button.primary').click(); f.submit(); await f.flush();
    assert.equal(f.doc.isDirty, false); assert.match(f.h.files.get(f.doc.uri.toString()).toString(), /保存に失敗した入力/); assert.equal(f.$('edit-save').disabled, false); assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
test('invalid configuration preserves the last valid chart and blocks editing and SVG export', async () => {
  const f = await connected();
  try {
    f.doc.text = '{invalid'; f.doc.version++;
    await f.panel.receive({ type: 'ready' });
    assert.equal(f.w.document.querySelectorAll('.node').length, 2); assert.equal(f.$('error').hidden, false); assert.equal(f.$('edit-config').disabled, true); assert.equal(f.$('export').disabled, true);
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
test('invalid unsolicited messages cannot interrupt UI, and markup in a name stays text', async () => {
  const f = await connected();
  try {
    for (const data of [null, {}, 'noise', { type: 'update' }, { type: 'init', viewState: [] }]) f.w.dispatchEvent(new f.w.MessageEvent('message', { data }));
    f.doc.text = f.doc.text.replace('"A"', '"<img src=x onerror=alert(1)>"'); f.doc.version++;
    await f.panel.receive({ type: 'ready' });
    assert.equal(f.w.document.querySelectorAll('#nodes img').length, 0); assert.match(f.$('nodes').textContent, /<img/); assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
