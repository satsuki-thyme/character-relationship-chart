'use strict';
// Optional shared-UI regression suite; jsdom is a verification-only dependency.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const { createWebHost } = require('../web/host');
const { parseConfig } = require('../packages/core/config');
const { parseState } = require('../packages/core/view-state');
const root = path.resolve(__dirname, '..');
const sample = fs.readFileSync(path.join(root, 'examples/characters.relations.jsonc'), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 25));
function fixture() {
  const dom = new JSDOM('<!doctype html><body>' + fs.readFileSync(path.join(root, 'media/ui.html'), 'utf8') + '</body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, errors = [], captures = new Set();
  w.addEventListener('error', event => errors.push(event.error));
  w.ResizeObserver = class { observe() {} };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 680 });
  w.SVGElement.prototype.setPointerCapture = id => captures.add(id);
  w.SVGElement.prototype.hasPointerCapture = id => captures.has(id);
  w.SVGElement.prototype.releasePointerCapture = id => captures.delete(id);
  w.requestAnimationFrame = callback => w.setTimeout(callback, 0);
  for (const file of ['packages/core/graph.js', 'media/editor.js', 'media/main.js']) w.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  const $ = id => w.document.getElementById(id), nodes = () => [...w.document.querySelectorAll('.node')];
  const positions = () => nodes().map(node => node.getAttribute('transform'));
  const pointer = (target, type, x = 200, y = 200, id = 1) => {
    const event = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: id }); target.dispatchEvent(event);
  };
  const drag = (index, end = 'pointerup', id = 1) => {
    pointer(nodes()[index], 'pointerdown', 200, 200, id);
    pointer($('canvas'), 'pointermove', 250, 230, id);
    pointer($('canvas'), end, 250, 230, id);
  };
  return { dom, w, $, nodes, positions, pointer, drag, captures, errors,
    close() { w.close(); assert.deepEqual(errors, []); } };
}
function file(name, text) { return { name, text, size: Buffer.byteLength(text) }; }
async function web() {
  const f = fixture(), downloads = [];
  const host = createWebHost({ readText: async file => file.text, downloadText: (text, name) => downloads.push({ text, name }) });
  const ui = f.w.RelationsUi(host);
  assert.equal((await host.openFiles([file('cast.jsonc', sample)])).ok, true); await tick();
  return { ...f, host, ui, downloads, close() { host.dispose(); f.close(); } };
}
test('all rendered auto-layout positions, camera and UI survive serialized pair reload', async () => {
  const f = await web();
  try {
    f.drag(0); f.$('zoom-in').click(); f.$('toggle-details').click(); await tick();
    const before = f.positions(), camera = f.$('viewport').getAttribute('transform');
    assert.equal(f.ui.captureView().ok, true); await f.host.downloadView();
    const saved = f.downloads.at(-1), state = parseState(saved.text);
    assert.equal(Object.keys(state.positions).length, 6, 'every rendered position must be in the actual saved JSON');
    before.forEach((transform, i) => { const node = parseConfig(sample).graph.nodes[i]; assert.equal(transform, `translate(${state.positions[node.id].x} ${state.positions[node.id].y})`); });
    assert.equal((await f.host.openFiles([file('cast.jsonc', sample), file(saved.name, saved.text)])).ok, true); await tick();
    assert.deepEqual(f.positions(), before); assert.equal(f.$('viewport').getAttribute('transform'), camera);
    assert.equal(f.$('details').hidden, false); assert.equal(f.$('layout').value, 'auto');
  } finally { f.close(); }
});
test('circle/focus reload preserves state; view-only reload keeps unsubmitted form and config', async () => {
  const f = await web();
  try {
    f.$('layout').value = 'circle'; f.$('layout').dispatchEvent(new f.w.Event('change')); f.drag(1);
    f.$('focus').click(); await tick(); const before = f.positions(); f.ui.captureView(); await f.host.downloadView();
    const saved = f.downloads.at(-1); await f.host.downloadConfig(); const config = f.downloads.at(-1);
    f.$('edit-config').click(); f.$('field-title').value = 'unsubmitted draft'; f.$('field-title').dispatchEvent(new f.w.Event('input', { bubbles: true }));
    assert.equal((await f.host.openFiles([file(saved.name, saved.text)])).ok, true); await tick();
    assert.deepEqual(f.positions(), before); assert.equal(f.$('layout').value, 'circle');
    assert.equal(f.w.document.body.classList.contains('focus-mode'), true);
    assert.equal(f.$('field-title').value, 'unsubmitted draft'); assert.equal(f.ui.hasPendingEdits(), true);
    await f.host.downloadConfig(); assert.equal(f.downloads.at(-1).text, config.text);
    await f.host.openFiles([file('other.jsonc', '{"nodes":[{"id":"new","label":"N"}],"edges":[]}')]); await tick();
    assert.equal(f.nodes().length, 1); assert.deepEqual(Object.keys(f.host.getViewState().positions), ['new']);
    assert.equal(f.$('details').hidden, true); assert.equal(f.w.document.body.classList.contains('focus-mode'), false);
  } finally { f.close(); }
});
test('fixed-coordinate signatures and renamed IDs round-trip without changing references or comments', async () => {
  const f = await web();
  try {
    const source = '{ // keep\n"groups":[{"id":"g","label":"G"},{"id":"h","label":"H"}],"nodes":[{"id":"a","label":"A","groups":["g","h"],"x":100,"y":200},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b"}]}';
    await f.host.openFiles([file('fixed.jsonc', source)]); await tick(); f.drag(0);
    const update = await f.host.editConfig({ kind: 'nodes', action: 'save', index: 0, value: { id: 'hero', label: 'A', groups: ['g','h'], x: 100, y: 200 } }, 2);
    assert.equal(update.ok, true, update.message); const before = f.positions(); f.ui.captureView(); await f.host.downloadView(); const view = f.downloads.at(-1);
    await f.host.downloadConfig(); const config = f.downloads.at(-1); const state = parseState(view.text);
    assert.equal(state.positions.hero.source, '100,200'); assert.equal(state.positions.a, undefined);
    assert.equal(parseConfig(config.text).config.edges[0].from, 'hero'); assert.match(config.text, /keep/);
    await f.host.openFiles([file(config.name, config.text), file(view.name, view.text)]); await tick(); assert.deepEqual(f.positions(), before);
    const changed = config.text.replace(/"x"\s*:\s*100/, '"x":101');
    await f.host.openFiles([file(config.name, changed), file(view.name, view.text)]); await tick();
    assert.equal(f.nodes()[0].getAttribute('transform'), 'translate(101 200)', 'changed source coordinates supersede a saved override');
  } finally { f.close(); }
});
for (const scope of ['web', 'vscode-contract']) {
  test(`${scope}: capture loss, cancel and page transitions end dragging without activating selection`, async () => {
    const f = fixture(), callbacks = {}, updates = [];
    const host = scope === 'web' ? createWebHost({ readText: async file => file.text }) : {
      onConfig: fn => { callbacks.config = fn; }, onView: fn => { callbacks.view = fn; }, onStorage() {},
      ready() {}, updateView: state => updates.push(structuredClone(state)), editConfig() {},
      saveView() {}, reloadView() {}, openView() {}, openSource() {}, exportSvg() {}
    };
    f.w.RelationsUi(host);
    if (scope === 'web') await host.openFiles([file('cast.jsonc', sample)]);
    else { callbacks.view({ viewState: { version: 1 } }); callbacks.config(parseConfig(sample)); }
    await tick();
    try {
      for (const end of ['pointerup','pointercancel','lostpointercapture','blur','pagehide','hidden']) {
        f.pointer(f.nodes()[0], 'pointerdown'); f.pointer(f.$('canvas'), 'pointermove', 235, 220);
        if (['blur','pagehide'].includes(end)) f.w.dispatchEvent(new f.w.Event(end));
        else if (end === 'hidden') { Object.defineProperty(f.w.document, 'hidden', { value: true, configurable: true }); f.w.document.dispatchEvent(new f.w.Event('visibilitychange')); Object.defineProperty(f.w.document, 'hidden', { value: false, configurable: true }); }
        else { if(end === 'lostpointercapture') f.captures.clear(); f.pointer(f.$('canvas'), end, 235, 220); }
        assert.equal(f.$('canvas').classList.contains('dragging'), false, end+' must clear the interaction');
        assert.equal(f.captures.size, 0); assert.equal(f.$('details').hidden, true);
        const camera = f.$('viewport').getAttribute('transform'), before = f.positions(); f.drag(1); await tick();
        assert.notEqual(f.positions()[1], before[1]); assert.equal(f.$('viewport').getAttribute('transform'), camera);
        assert.equal(f.positions()[2], before[2]); f.drag(2); f.drag(3);
      }
      const before = f.positions(), camera = f.$('viewport').getAttribute('transform');
      f.pointer(f.$('canvas'), 'pointerdown'); f.pointer(f.$('canvas'), 'pointermove', 225, 215); f.pointer(f.$('canvas'), 'pointerup', 225, 215);
      assert.deepEqual(f.positions(), before); assert.notEqual(f.$('viewport').getAttribute('transform'), camera);
      f.drag(4); assert.notEqual(f.positions()[4], before[4]);
      const start = f.positions(); f.pointer(f.nodes()[0], 'pointerdown', 200, 200, 1);
      f.pointer(f.nodes()[1], 'pointerdown', 200, 200, 2); f.pointer(f.$('canvas'), 'pointermove', 260, 240, 2); f.pointer(f.$('canvas'), 'pointerup', 260, 240, 2);
      assert.deepEqual(f.positions(), start, 'a second pointer cannot replace the active gesture');
      f.pointer(f.$('canvas'), 'pointercancel', 200, 200, 1);
    } finally { if (scope === 'web') host.dispose(); f.close(); }
  });
}
