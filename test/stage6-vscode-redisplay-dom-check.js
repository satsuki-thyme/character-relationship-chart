'use strict';
// Real shared UI + VS Code adapter + extension, with a simulated VS Code API.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const { harness } = require('./helpers/vscode-harness');
const { parseConfig } = require('../packages/core/config');
const G = require('../packages/core/graph');
const root = path.resolve(__dirname, '..');
const sample = fs.readFileSync(path.join(root, 'examples/characters.relations.jsonc'), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
async function connected(source = sample) {
  const h = harness(), uri = h.Uri.parse('file:///work/cast.jsonc'), doc = h.document(uri, source);
  const viewEvents = new Map(), create = h.vscode.window.createWebviewPanel;
  h.vscode.window.createWebviewPanel = (...args) => {
    const panel = create(...args), subscribe = panel.onDidChangeViewState;
    panel.onDidChangeViewState = fn => { viewEvents.set(panel, fn); return subscribe(fn); };
    return panel;
  };
  let queue = Promise.resolve(), current;
  const outgoing = [], errors = [];
  const flush = async () => { await queue; await tick(); await queue; };
  async function open() {
    await h.commands.get('characterRelationshipChart.open')(uri);
    const panel = h.created.at(-1);
    const dom = new JSDOM('<!doctype html><body>' + fs.readFileSync(path.join(root, 'media/ui.html'), 'utf8') + '</body>', { runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.addEventListener('error', event => errors.push(event.error));
    w.ResizeObserver = class { observe() {} };
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; };
    w.SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 680 });
    const capture = new Set();
    w.SVGElement.prototype.setPointerCapture = id => capture.add(id);
    w.SVGElement.prototype.hasPointerCapture = id => capture.has(id);
    w.SVGElement.prototype.releasePointerCapture = id => capture.delete(id);
    w.requestAnimationFrame = fn => w.setTimeout(fn, 0);
    panel.webview.postMessage = async message => { w.dispatchEvent(new w.MessageEvent('message', { data: structuredClone(message) })); return true; };
    w.acquireVsCodeApi = () => ({ setState() {}, postMessage(message) { outgoing.push(structuredClone(message)); queue = queue.then(() => panel.receive(structuredClone(message))); } });
    for (const file of ['packages/core/graph.js', 'media/editor.js', 'media/main.js', 'media/vscode-host.js', 'media/vscode-bootstrap.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    current = { w, panel, dom }; await flush();
  }
  await open();
  const $ = id => current.w.document.getElementById(id);
  const nodes = () => [...current.w.document.querySelectorAll('.node')];
  const positions = () => nodes().map(node => node.getAttribute('transform'));
  const saved = () => JSON.parse(h.files.get(uri.toString() + '.view.json'));
  function pointer(target, type, x, y, pointerId = 1) {
    const e = new current.w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: pointerId }); target.dispatchEvent(e);
  }
  function drag(index) { pointer(nodes()[index], 'pointerdown', 200, 200); pointer($('canvas'), 'pointermove', 265, 245); pointer($('canvas'), 'pointerup', 265, 245); }
  async function redisplay() {
    current.panel.visible = false; await viewEvents.get(current.panel)({ webviewPanel: current.panel });
    current.panel.visible = true; await viewEvents.get(current.panel)({ webviewPanel: current.panel }); await flush();
  }
  async function reopen() {
    current.w.dispatchEvent(new current.w.Event('pagehide')); await flush();
    current.w.close(); current.panel.dispose(); await flush(); await open();
  }
  return { h, doc, $, nodes, positions, saved, drag, redisplay, reopen, flush, outgoing,
    async close() { current.w.close(); await h.dispose(); assert.deepEqual(errors, []); assert.deepEqual(h.errors, []); } };
}
function assertSaved(f, expected) {
  const graph = parseConfig(f.doc.text).graph, state = f.saved();
  assert.equal(Object.keys(state.positions).length, graph.nodes.length);
  graph.nodes.forEach((node, i) => {
    const p = state.positions[node.id];
    assert.equal(`translate(${p.x} ${p.y})`, expected[i], 'saved coordinates of ' + node.id);
    assert.equal(p.source, G.signature(node));
  });
}
test('VS Code save, open sidecar, visibility/config notifications, reload and close/reopen retain EVERY rendered position', async () => {
  const f = await connected();
  try {
    f.drag(0); f.drag(1); f.$('zoom-in').click(); f.$('toggle-details').click(); await f.flush();
    const before = f.positions(), camera = f.$('viewport').getAttribute('transform');
    f.$('save-view').click(); await f.flush(); assertSaved(f, before);
    // This is the real extension listener invoked by a view-state change.
    await f.redisplay(); assert.deepEqual(f.positions(), before, 'same-config redisplay must not rerun auto-layout around sparse drag pins');
    assert.equal(f.$('viewport').getAttribute('transform'), camera);
    f.$('open-view').click(); await f.flush(); await f.redisplay();
    assert.equal(f.h.vscode.window.activeTextEditor.document.uri.toString(), f.doc.uri.toString() + '.view.json');
    assert.deepEqual(f.positions(), before); assertSaved(f, before);
    // A repeated source save publishes another normalized graph, even when
    // the document version changes only because of a JSONC comment.
    f.doc.text += '\n// unchanged settings'; f.doc.version++; await f.doc.save(); await f.flush();
    assert.deepEqual(f.positions(), before); assertSaved(f, before);
    f.$('zoom-out').click(); await f.flush(); f.$('save-view').click(); await f.flush(); assertSaved(f, before);
    await f.reopen(); assert.deepEqual(f.positions(), before);
    f.$('reload-view').click(); await f.flush(); assert.deepEqual(f.positions(), before); assert.equal(f.$('details').hidden, false); assertSaved(f, before);
  } finally { await f.close(); }
});
test('VS Code unsaved layout and draft form survive unchanged notifications before first autosave', async () => {
  const f = await connected();
  try {
    f.$('edit-config').click(); f.$('field-title').value = 'draft kept';
    f.$('field-title').dispatchEvent(new (f.$('field-title').ownerDocument.defaultView.Event)('input', { bubbles: true }));
    f.drag(0); const before = f.positions(); await f.redisplay();
    assert.deepEqual(f.positions(), before); assert.equal(f.$('field-title').value, 'draft kept');
    const last = f.outgoing.filter(m => m.type === 'viewState').at(-1);
    assert.equal(Object.keys(last.state.positions).length, 6); assert.equal(f.doc.getText(), sample);
  } finally { await f.close(); }
});
test('real setting changes still recalculate auto layout, honor fixed coordinates, prune IDs and switch layout', async () => {
  const f = await connected();
  try {
    f.drag(0); const before = f.positions(), pin = f.outgoing.filter(m => m.type === 'viewState').at(-1).state.positions.alto;
    const value = JSON.parse(sample.replace(/\/\/[^\n]*/g, ''));
    value.nodes[2].x = 100; value.nodes[2].y = 200;
    f.doc.text = JSON.stringify(value); f.doc.version++; await f.doc.save(); await f.flush();
    const graph = parseConfig(f.doc.text).graph, expected = G.layout(graph, 'auto', { alto: pin }).map(n => `translate(${n.x} ${n.y})`);
    assert.deepEqual(f.positions(), expected); assert.notDeepEqual(f.positions(), before);
    assert.equal(f.positions()[2], 'translate(100 200)');
    value.layout = 'circle'; value.nodes = value.nodes.filter(n => n.id !== 'lina'); value.edges = value.edges.filter(e => e.from !== 'lina' && e.to !== 'lina');
    f.doc.text = JSON.stringify(value); f.doc.version++; await f.doc.save(); await f.flush();
    assert.equal(f.$('layout').value, 'circle'); assert.equal(f.nodes().length, 5);
    f.$('reset').click(); f.$('save-view').click(); await f.flush();
    assert.equal(f.saved().positions.lina, undefined);
    assert.deepEqual(f.positions(), G.layout(parseConfig(f.doc.text).graph, 'circle').map(n => `translate(${n.x} ${n.y})`));
  } finally { await f.close(); }
});
test('GUI ID rename, source coordinate change and layout controls keep existing saved-layout rules', async () => {
  const source = '{ // preserve\n"nodes":[{"id":"a","label":"A","x":100,"y":200},{"id":"b","label":"B"},{"id":"c","label":"C"}],"edges":[{"from":"a","to":"b"},{"from":"b","to":"c"}]}';
  const f = await connected(source);
  try {
    f.drag(0); f.$('save-view').click(); await f.flush(); const pinned = f.saved().positions.a;
    await f.h.created.at(-1).receive({ type:'editConfig', requestId:901, baseVersion:f.doc.version, operation:{kind:'nodes', action:'save', index:0, value:{id:'hero',label:'A',groups:[],x:100,y:200}} }); await f.flush();
    assert.equal(f.positions()[0], `translate(${pinned.x} ${pinned.y})`); assert.equal(f.saved().positions.a, undefined); assert.ok(f.saved().positions.hero);
    assert.equal(parseConfig(f.doc.text).config.edges[0].from, 'hero'); assert.match(f.doc.text, /preserve/);
    f.doc.text = f.doc.text.replace(/"x"\s*:\s*100/, '"x":101'); f.doc.version++; await f.doc.save(); await f.flush();
    assert.equal(f.positions()[0], 'translate(101 200)');
    f.$('layout').value = 'circle'; f.$('layout').dispatchEvent(new (f.$('layout').ownerDocument.defaultView.Event)('change')); const circle = f.positions();
    await f.redisplay(); assert.deepEqual(f.positions(), circle); assert.equal(f.$('layout').value, 'circle');
    f.$('reset').click(); assert.deepEqual(f.positions(), G.layout(parseConfig(f.doc.text).graph, 'circle').map(n => `translate(${n.x} ${n.y})`));
  } finally { await f.close(); }
});
