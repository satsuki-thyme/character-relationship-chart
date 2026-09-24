'use strict';
// Optional distribution-level DOM suite; jsdom stays outside runtime dependencies.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const { buildWeb } = require('../scripts/build-web');
let output;
test.before(async () => { output = await fs.mkdtemp(path.join(os.tmpdir(), 'relations-web-')); await buildWeb(output); });
test.after(async () => { if (output) await fs.rm(output, { recursive: true, force: true }); });
const text = '{ // retained\n"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","label":"Together"},{"from":"b","to":"a","label":"Other"}]}';
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } assert.fail('Timed out waiting for the built Web page'); }
async function page() {
  const errors = [], forbidden = [], assets = [];
  class LocalAssets extends ResourceLoader {
    fetch(url, options) {
      assert.ok(url.startsWith(pathToFileURL(output + path.sep).href), 'Unexpected external asset: ' + url);
      assets.push(url); return super.fetch(url, options);
    }
  }
  const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error));
  const dom = await JSDOM.fromFile(path.join(output, 'index.html'), {
    resources: new LocalAssets(), runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console,
    beforeParse(w) {
      w.ResizeObserver = class { observe() {} };
      w.SVGElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 1000, height: 680 });
      w.SVGElement.prototype.setPointerCapture = function () {};
      w.SVGElement.prototype.releasePointerCapture = function () {};
      w.SVGElement.prototype.hasPointerCapture = () => false;
      const block = name => () => { forbidden.push(name); throw new Error('Forbidden: ' + name); };
      for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'showSaveFilePicker']) w[name] = block(name);
      w.navigator.sendBeacon = block('sendBeacon'); w.URL.createObjectURL = block('download');
      w.Storage.prototype.setItem = block('storage');
      Object.defineProperty(w, 'indexedDB', { get: block('indexedDB') });
      w.addEventListener('error', event => errors.push(event.error));
    }
  });
  const w = dom.window, $ = id => w.document.getElementById(id);
  try { await until(() => w.document.querySelectorAll('.node').length === 6); } catch (error) { const detail = error.message + ': ' + errors.map(e => e.stack || String(e)).join('\n') + ' status=' + $('error')?.textContent; w.close(); throw new Error(detail); }
  return { dom, w, $, errors, forbidden, assets,
    file(name, value) { return new w.File([value], name, { type: 'application/json' }); },
    choose(id, files) { Object.defineProperty($(id), 'files', { value: files, configurable: true }); $(id).dispatchEvent(new w.Event('change')); },
    async source(value = text, name = 'cast.jsonc') { this.choose('web-files', [this.file(name, value)]); await until(() => $('web-file').textContent === name); await pause(); },
    close() { w.dispatchEvent(new w.Event('pagehide')); w.close(); assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); }
  };
}
function pointer(f, target, type, x, y) {
  const event = new f.w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event);
}
function gesture(f, moved) {
  pointer(f, f.w.document.querySelector('.node'), 'pointerdown', 200, 200);
  if (moved) pointer(f, f.$('canvas'), 'pointermove', 250, 230);
  pointer(f, f.$('canvas'), 'pointerup', moved ? 250 : 200, moved ? 230 : 200);
}
test('built Web page starts from file URLs without VS Code, network, storage or editing UI', async () => {
  const f = await page();
  try {
    assert.equal(f.w.document.querySelectorAll('.edge').length, 8);
    assert.equal(f.w.acquireVsCodeApi, undefined); assert.equal(f.w.RelationsEditor, undefined);
    for (const id of ['edit-config', 'config-editor', 'save-view', 'reload-view', 'open-view', 'open-source', 'export', 'storage-status']) {
      assert.equal(f.$(id).hidden, true, id); assert.equal(f.w.getComputedStyle(f.$(id)).display, 'none', id);
      f.$(id).click();
    }
    assert.equal(f.assets.length, 3);
  } finally { f.close(); }
});
test('file picker uses the real FileReader and displays input strings as text', async () => {
  const f = await page();
  try {
    await f.source(text.replace('"A"', '"<img src=x onerror=alert(1)>"'), '<unsafe>.jsonc');
    gesture(f, false);
    assert.equal(f.$('details').hidden, false); assert.match(f.$('detail-content').textContent, /<img src=x/);
    assert.equal(f.w.document.querySelectorAll('img, .detail-edit').length, 0);
    assert.equal(f.$('web-files').value, '');
    assert.equal(f.$('config-editor').open, false);
  } finally { f.close(); }
});
test('Web drag, click, search and zoom stay temporary and all labels remain above edges', async () => {
  const f = await page();
  try {
    await f.source(); const before = f.w.document.querySelector('.node').getAttribute('transform');
    gesture(f, true); await pause();
    assert.equal(f.$('details').hidden, true); assert.notEqual(f.w.document.querySelector('.node').getAttribute('transform'), before);
    gesture(f, false); assert.equal(f.$('details').hidden, false);
    const zoom = f.$('zoom').textContent; f.$('zoom-in').click(); assert.notEqual(f.$('zoom').textContent, zoom);
    f.$('search').value = 'missing'; f.$('search').dispatchEvent(new f.w.Event('input'));
    assert.equal(f.w.document.querySelectorAll('.node.faded').length, 2);
    for (const line of f.w.document.querySelectorAll('.edge-line')) for (const label of f.w.document.querySelectorAll('.edge-label, .edge-label-bg')) assert.ok(line.compareDocumentPosition(label) & f.w.Node.DOCUMENT_POSITION_FOLLOWING);
    f.$('web-sample').click(); await until(() => f.w.document.querySelectorAll('.node').length === 6);
    assert.equal(f.$('search').value, ''); assert.equal(f.$('details').hidden, true);
    assert.equal(f.w.document.querySelectorAll('.selected').length, 0);
  } finally { f.close(); }
});
test('matching display data restores positions and camera; another source resets both', async () => {
  const f = await page();
  try {
    await f.source();
    f.choose('web-view', [f.file('cast.jsonc.view.json', JSON.stringify({ version: 1, positions: { a: { x: 321, y: 123, source: ',' } }, camera: { x: 90, y: 110, scale: 1.4, width: 1000, height: 680 } }))]);
    await until(() => f.$('web-file').textContent.includes('.view.json')); await pause();
    assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), 'translate(321 123)');
    assert.equal(f.$('viewport').getAttribute('transform'), 'translate(90 110) scale(1.4)');
    await f.source(text, 'different.jsonc');
    assert.notEqual(f.w.document.querySelector('.node').getAttribute('transform'), 'translate(321 123)');
    assert.notEqual(f.$('viewport').getAttribute('transform'), 'translate(90 110) scale(1.4)');
  } finally { f.close(); }
});
test('bad input keeps the last valid chart; valid empty JSONC gives a read-only message', async () => {
  const f = await page();
  try {
    await f.source();
    f.choose('web-files', [f.file('bad.jsonc', '{\nINVALID')]); await until(() => !f.$('error').hidden);
    assert.equal(f.w.document.querySelectorAll('.node').length, 2); assert.match(f.$('error').textContent, /2行/);
    f.choose('web-files', [f.file('new.jsonc', text), f.file('new.jsonc.view.json', '{broken')]); await pause();
    assert.equal(f.$('web-file').textContent, 'cast.jsonc');
    await f.source('{"nodes":[],"edges":[]}', 'empty.jsonc');
    assert.equal(f.$('empty').hidden, false); assert.doesNotMatch(f.$('empty').textContent, /編集|追加/);
    assert.equal(f.$('error').hidden, true);
  } finally { f.close(); }
});
test('dropping files loads the pair and cancelled selection leaves the chart alone', async () => {
  const f = await page();
  try {
    const event = new f.w.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [f.file('drop.jsonc', text), f.file('drop.jsonc.view.json', '{"version":1,"layout":"circle","configLayout":"auto"}')] } });
    f.w.document.dispatchEvent(event); await until(() => f.$('web-file').textContent.startsWith('drop.jsonc +'));
    assert.equal(event.defaultPrevented, true); assert.equal(f.$('layout').value, 'circle');
    f.choose('web-files', []); await pause(); assert.equal(f.w.document.querySelectorAll('.node').length, 2);
  } finally { f.close(); }
});
