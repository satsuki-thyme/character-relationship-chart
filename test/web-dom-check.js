'use strict';
// Optional distribution-level DOM suite; jsdom stays outside runtime dependencies.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const { buildWeb } = require('../scripts/build-web');
const { parseConfig } = require('../packages/core/config');
const { parseState, encodeState } = require('../packages/core/view-state');
let output;
test.before(async () => { output = await fs.mkdtemp(path.join(os.tmpdir(), 'relations-web-')); await buildWeb(output); });
test.after(async () => { if (output) await fs.rm(output, { recursive: true, force: true }); });
const text = '{ // retained\n"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","label":"Together"},{"from":"b","to":"a","label":"Other"}]}';
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } assert.fail('Timed out waiting for the built Web page'); }
async function page(setup = () => {}) {
  const errors = [], forbidden = [], assets = [], downloads = [], urls = new Map(), confirms = [];
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
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.confirm = text => { confirms.push(text); return false; };
      w.SVGElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 1000, height: 680 });
      w.SVGElement.prototype.setPointerCapture = function () {};
      w.SVGElement.prototype.releasePointerCapture = function () {};
      w.SVGElement.prototype.hasPointerCapture = () => false;
      const block = name => () => { forbidden.push(name); throw new Error('Forbidden: ' + name); };
      for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'showSaveFilePicker']) w[name] = block(name);
      w.navigator.sendBeacon = block('sendBeacon');
      w.URL.createObjectURL = blob => { const url = 'blob:local-' + urls.size; urls.set(url, blob); return url; };
      w.URL.revokeObjectURL = url => urls.delete(url);
      w.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, blob: urls.get(this.href) }); };
      w.Storage.prototype.setItem = block('storage');
      Object.defineProperty(w, 'indexedDB', { get: block('indexedDB') });
      w.addEventListener('error', event => errors.push(event.error));
      setup(w);
    }
  });
  const w = dom.window, $ = id => w.document.getElementById(id);
  try { await until(() => w.document.querySelectorAll('.node').length === 6); } catch (error) { const detail = error.message + ': ' + errors.map(e => e.stack || String(e)).join('\n') + ' status=' + $('error')?.textContent; w.close(); throw new Error(detail); }
  return { dom, w, $, errors, forbidden, assets, downloads, confirms,
    fill(id, value) { $(id).value = value; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); },
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
test('built Web page starts offline with shared editing UI and no direct or view storage', async () => {
  const f = await page();
  try {
    assert.equal(f.w.document.querySelectorAll('.edge').length, 8);
    assert.equal(f.w.acquireVsCodeApi, undefined); assert.equal(typeof f.w.RelationsEditor, 'function');
    assert.equal(f.$('edit-config').disabled, false); assert.equal(f.$('web-download').disabled, false);
    assert.equal(f.$('edit-save').textContent, '反映');
    for (const id of ['save-view', 'reload-view', 'open-view', 'open-source', 'export', 'storage-status']) {
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
    assert.equal(f.w.document.querySelectorAll('img').length, 0); assert.equal(f.w.document.querySelectorAll('.detail-edit').length, 1);
    assert.equal(f.$('web-files').value, '');
    assert.equal(f.$('config-editor').open, false);
  } finally { f.close(); }
});
test('Web view changes require discard confirmation and labels remain above edges', async () => {
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
    f.$('web-sample').click(); await until(() => f.confirms.length === 1);
    assert.equal(f.w.document.querySelectorAll('.node').length, 2);
    f.w.confirm = () => true;
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
test('bad input keeps the last valid chart; valid empty JSONC can be populated using the editor', async () => {
  const f = await page();
  try {
    await f.source();
    f.choose('web-files', [f.file('bad.jsonc', '{\nINVALID')]); await until(() => !f.$('error').hidden);
    assert.equal(f.w.document.querySelectorAll('.node').length, 2); assert.match(f.$('error').textContent, /2行/);
    f.choose('web-files', [f.file('new.jsonc', text), f.file('new.jsonc.view.json', '{broken')]); await pause();
    assert.equal(f.$('web-file').textContent, 'cast.jsonc');
    await f.source('{"nodes":[],"edges":[]}', 'empty.jsonc');
    assert.equal(f.$('empty').hidden, false); assert.match(f.$('empty').textContent, /編集/);
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

const editable = '{\r\n\t// keep header\r\n\t"title": "Original",\r\n\t"groups": [{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],\r\n\t"nodes": [\r\n\t\t{"id":"a","label":"A","groups":["g1","g2"]},\r\n\t\t/* keep neighbor */ {"id":"b", "label":"B"}\r\n\t],\r\n\t"edges": [{"from":"a","to":"b","label":"Link"}]\r\n}\r\n';
const tab = (f, kind) => f.w.document.querySelector(`[data-kind="${kind}"]`).click();
async function submit(f) {
  f.$('edit-form').dispatchEvent(new f.w.Event('submit', { bubbles: true, cancelable: true }));
  await pause(); assert.equal(f.$('edit-message').classList.contains('is-error'), false, f.$('edit-message').textContent);
}
async function remove(f) { f.$('edit-delete').click(); f.$('edit-confirm').querySelector('.primary').click(); await pause(); }
function readBlob(f, blob) { return new Promise((resolve, reject) => { const reader = new f.w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob, 'UTF-8'); }); }
async function download(f) {
  const count = f.downloads.length; f.$('web-download').click(); await until(() => f.downloads.length === count + 1);
  const result = f.downloads.at(-1); return { name: result.name, text: await readBlob(f, result.blob) };
}
test('shared Web GUI edits every entity and downloaded JSONC round-trips comments, text and references', async () => {
  const f = await page();
  try {
    await f.source(editable, '人物.jsonc'); f.$('edit-config').click();
    f.fill('field-title', '日本語の図'); f.fill('field-description', 'Description'); await submit(f);
    tab(f, 'groups'); f.$('edit-add').click(); f.fill('field-id', 'team'); f.fill('field-label', 'Team'); await submit(f);
    f.fill('field-id', 'crew'); f.fill('field-label', 'Crew'); await submit(f);
    tab(f, 'nodes'); f.$('edit-add').click(); f.fill('field-id', 'c'); f.fill('field-label', 'C');
    for (const id of ['g1', 'crew']) f.w.document.querySelector(`input[name="groups"][value="${id}"]`).click();
    await submit(f); assert.equal(f.w.document.querySelectorAll('.node').length, 3);
    tab(f, 'edges'); f.$('edit-add').click(); f.fill('field-from', 'c'); f.fill('field-to', 'b'); f.fill('field-label', 'New'); await submit(f);
    f.fill('field-label', 'Changed'); f.fill('field-shape', 'curved'); await submit(f);
    tab(f, 'nodes'); f.$('edit-list').lastElementChild.click(); f.fill('field-id', 'hero'); f.fill('field-label', 'Hero'); await submit(f);
    tab(f, 'groups'); f.$('edit-list').lastElementChild.click(); f.fill('field-id', 'crew2'); await submit(f);
    f.$('edit-close').click(); const exported = await download(f), expected = parseConfig(exported.text).config;
    assert.equal(exported.name, '人物.jsonc'); assert.equal(expected.title, '日本語の図');
    assert.deepEqual(expected.nodes[2].groups, ['g1', 'crew2']); assert.equal(expected.edges[1].from, 'hero');
    assert.equal(expected.edges[1].shape, 'curved'); assert.match(exported.text, /\t\/\/ keep header\r\n/);
    assert.match(exported.text, /\t\t\/\* keep neighbor \*\//);
    assert.ok(exported.text.includes('\t\t{"id":"a","label":"A","groups":["g1","g2"]}'));
    assert.equal(exported.text.replace(/\r\n/g, '').includes('\n'), false);
    assert.equal(f.downloads.length, 1, 'editing itself never downloads');
    f.w.confirm = () => true; await f.source(exported.text, exported.name);
    await until(() => f.$('title').textContent === '日本語の図');
    assert.equal(f.w.document.querySelectorAll('.node').length, 3); assert.match(f.$('legend').textContent, /Crew/);
    const reexported = await download(f); assert.equal(reexported.text, exported.text);
    f.$('edit-config').click(); tab(f, 'groups'); f.$('edit-list').lastElementChild.click(); await remove(f);
    tab(f, 'edges'); f.$('edit-list').lastElementChild.click(); await remove(f);
    assert.equal(f.w.document.querySelectorAll('.edge').length, 1);
    tab(f, 'nodes'); f.$('edit-list').firstElementChild.click(); await remove(f);
    assert.equal(f.w.document.querySelectorAll('.edge').length, 0, 'deleting a node deletes its incident relations');
    tab(f, 'general'); f.fill('field-title', ''); f.fill('field-description', ''); await submit(f);
    f.$('edit-close').click(); const final = parseConfig((await download(f)).text).config;
    assert.deepEqual(final.nodes.find(n => n.id === 'hero').groups, ['g1']);
    assert.equal(final.title, undefined); assert.equal(final.description, undefined);
    assert.equal(final.nodes.length, 2); assert.equal(final.groups.length, 2);
  } finally { f.close(); }
});
test('node ID changes retain temporary dragged positions and selected details', async () => {
  const f = await page();
  try {
    await f.source(editable); gesture(f, true); await pause(); gesture(f, false);
    const transform = f.w.document.querySelector('.node').getAttribute('transform');
    f.w.document.querySelector('.detail-edit').click(); f.fill('field-id', 'renamed'); await submit(f);
    assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), transform);
    assert.match(f.$('detail-content').textContent, /ID: renamed/);
    assert.equal(f.w.document.querySelectorAll('.node.selected').length, 1);
    f.$('edit-close').click(); const value = parseConfig((await download(f)).text).config;
    assert.equal(value.edges[0].from, 'renamed'); assert.deepEqual(value.nodes[0].groups, ['g1', 'g2']);
  } finally { f.close(); }
});
test('invalid edits/imports and download generation failures retain the graph and GUI values', async () => {
  const f = await page();
  try {
    await f.source(editable); f.$('edit-config').click(); tab(f, 'nodes'); f.fill('field-id', 'b'); f.fill('field-label', 'Do not lose this');
    f.$('edit-form').dispatchEvent(new f.w.Event('submit', { bubbles: true, cancelable: true })); await pause();
    assert.equal(f.$('edit-message').classList.contains('is-error'), true);
    assert.equal(f.$('field-label').value, 'Do not lose this'); assert.equal(f.w.document.querySelectorAll('.node').length, 2);
    f.choose('web-files', [f.file('invalid.jsonc', '{broken')]); await until(() => !f.$('error').hidden);
    assert.equal(f.$('field-label').value, 'Do not lose this'); assert.equal(f.$('edit-save').disabled, false);
    f.fill('field-id', 'a'); await submit(f); assert.equal(f.$('error').hidden, true);
    const create = f.w.URL.createObjectURL; f.w.URL.createObjectURL = () => { throw new Error('generation denied'); };
    f.$('web-download').click(); await until(() => f.$('web-message').textContent.includes('generation denied'));
    assert.equal(f.$('field-label').value, 'Do not lose this'); assert.equal(f.$('config-editor').open, true);
    assert.equal(f.downloads.length, 0); assert.equal(f.$('web-download').disabled, false);
    f.w.URL.createObjectURL = create; f.$('edit-close').click();
    assert.equal(parseConfig((await download(f)).text).config.nodes[0].label, 'Do not lose this');
  } finally { f.close(); }
});
test('source replacement protects unsubmitted input and changed text until explicitly discarded', async () => {
  const f = await page();
  try {
    await f.source(); f.$('edit-config').click(); f.fill('field-title', 'Draft');
    const before = new f.w.Event('beforeunload', { cancelable: true }); f.w.dispatchEvent(before); assert.equal(before.defaultPrevented, true);
    f.choose('web-files', [f.file('next.jsonc', '{"title":"Next","nodes":[],"edges":[]}')]);
    await until(() => f.confirms.length === 1);
    assert.equal(f.$('field-title').value, 'Draft'); assert.equal(f.w.document.querySelectorAll('.node').length, 2);
    await submit(f); f.$('edit-close').click(); await download(f);
    f.choose('web-files', [f.file('next.jsonc', text)]); await until(() => f.confirms.length === 2);
    assert.equal(f.$('title').textContent, 'Draft');
    f.w.confirm = () => true; await f.source('{"title":"Next","nodes":[],"edges":[]}', 'next.jsonc');
    assert.equal(f.$('title').textContent, 'Next');
    const after = new f.w.Event('beforeunload', { cancelable: true }); f.w.dispatchEvent(after); assert.equal(after.defaultPrevented, false);
  } finally { f.close(); }
});

function directFixture() {
  const disk = { bytes: Buffer.from(text), permission: 'granted', writes: 0, closes: 0, fail: '', picker: '' };
  const handle = { kind: 'file', name: 'direct.jsonc',
    async getFile() { return new File([disk.bytes], this.name); },
    async requestPermission() { return disk.permission; },
    async createWritable() {
      if (disk.fail === 'create') throw new Error('create failed');
      let bytes;
      return { async write(value) { disk.writes++; bytes = Buffer.from(value); if (disk.fail === 'write') throw new Error('write failed'); },
        async close() { disk.closes++; disk.bytes = bytes; }, async abort() {} };
    }
  };
  return { disk, handle, setup(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    Object.defineProperty(w, 'isSecureContext', { value: true });
    w.FileSystemFileHandle = class { createWritable() {} };
    w.showOpenFilePicker = async () => {
      if (disk.picker) throw Object.assign(new Error('picker failed'), { name: disk.picker });
      return [handle];
    };
  } };
}
async function openDirect(f) { f.$('web-direct-open').click(); await until(() => f.$('web-file').textContent === 'direct.jsonc'); }
async function editTitle(f, value) {
  f.$('edit-config').click(); f.fill('field-title', value); f.$('edit-save').click();
  await until(() => f.$('title').textContent === value); await pause(); f.$('edit-close').click();
}
test('direct-save UI only exposes supported actions and picker cancellation/failure preserves the document', async () => {
  const fallback = await page();
  try { assert.equal(fallback.$('web-direct-open').hidden, true); assert.equal(fallback.$('web-save').hidden, true); assert.match(fallback.$('web-save-note').textContent, /直接保存を利用できません/); }
  finally { fallback.close(); }
  const native = directFixture(), f = await page(native.setup);
  try {
    assert.equal(f.$('web-save').hidden, false); assert.equal(f.$('web-save').disabled, true);
    for (const name of ['AbortError', 'SecurityError']) {
      native.disk.picker = name; f.$('web-direct-open').click(); await pause();
      assert.equal(f.$('web-file').textContent, 'characters.relations.jsonc'); assert.equal(f.$('web-download').disabled, false);
    }
    assert.match(f.$('web-message').textContent, /ダウンロード方式/);
    native.disk.picker = ''; await openDirect(f); assert.equal(f.$('web-save').disabled, false);
  } finally { f.close(); }
});
test('direct save keeps unapplied form input and only clears the applied document dirty state', async () => {
  const native = directFixture(), f = await page(native.setup);
  try {
    await openDirect(f); await editTitle(f, '保存する内容');
    f.$('edit-config').click(); f.fill('field-title', '未反映の入力');
    f.$('web-save').click(); await until(() => f.$('web-message').textContent.includes('内容を確認しました'));
    assert.equal(parseConfig(native.disk.bytes.toString()).config.title, '保存する内容');
    assert.equal(f.$('field-title').value, '未反映の入力'); assert.equal(f.$('title').textContent, '保存する内容');
    assert.match(f.$('web-message').textContent, /未反映のフォーム入力は保存していません/);
    const leave = new f.w.Event('beforeunload', { cancelable: true }); f.w.dispatchEvent(leave); assert.equal(leave.defaultPrevented, true);
    f.choose('web-files', [f.file('other.jsonc', text)]); await until(() => f.confirms.length === 1);
    assert.equal(f.$('field-title').value, '未反映の入力'); assert.equal(f.$('web-file').textContent, 'direct.jsonc');
    f.$('edit-save').click(); await until(() => f.$('title').textContent === '未反映の入力'); await pause(); f.$('edit-close').click();
    f.$('web-save').click(); await until(() => native.disk.closes === 2); await pause();
    const cleanLeave = new f.w.Event('beforeunload', { cancelable: true }); f.w.dispatchEvent(cleanLeave); assert.equal(cleanLeave.defaultPrevented, false);
    f.$('web-sample').click(); await until(() => f.$('web-file').textContent === 'characters.relations.jsonc');
    assert.equal(f.confirms.length, 1); assert.equal(f.$('web-save').disabled, true);
  } finally { f.close(); }
});
test('conflict, permission denial and write failure preserve chart, draft and download fallback', async () => {
  for (const fault of ['conflict', 'denied', 'create', 'write']) {
    const native = directFixture(), f = await page(native.setup);
    try {
      await openDirect(f); await editTitle(f, '退避する編集');
      f.$('edit-config').click(); f.fill('field-title', '入力を保持');
      if (fault === 'conflict') native.disk.bytes = Buffer.from(text + '\n// external');
      if (fault === 'denied') native.disk.permission = 'denied';
      if (['create', 'write'].includes(fault)) native.disk.fail = fault;
      const before = Buffer.from(native.disk.bytes), nodes = f.w.document.querySelectorAll('.node').length;
      f.$('web-save').click(); await until(() => f.$('web-message').textContent.includes('退避できます'));
      assert.deepEqual(native.disk.bytes, before); assert.equal(native.disk.closes, 0);
      assert.equal(f.$('field-title').value, '入力を保持'); assert.equal(f.$('title').textContent, '退避する編集');
      assert.equal(f.w.document.querySelectorAll('.node').length, nodes); assert.equal(f.$('web-download').disabled, false);
      if (fault === 'conflict') { assert.match(f.$('web-message').textContent, /外部で変更/); assert.equal(f.$('web-save').disabled, true); }
      f.$('edit-save').click(); await until(() => f.$('title').textContent === '入力を保持'); await pause(); f.$('edit-close').click();
      f.$('web-download').click(); await until(() => f.downloads.length === 1);
      const out = await new Promise((resolve, reject) => { const r = new f.w.FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsText(f.downloads[0].blob); });
      assert.equal(parseConfig(out).config.title, '入力を保持'); assert.deepEqual(native.disk.bytes, before);
      const leave = new f.w.Event('beforeunload', { cancelable: true }); f.w.dispatchEvent(leave); assert.equal(leave.defaultPrevented, true);
    } finally { f.close(); }
  }
});

async function downloadValue(f, button = 'web-view-download') {
  const count = f.downloads.length; f.$(button).click(); await until(() => f.downloads.length > count);
  const download = f.downloads.at(-1);
  const text = await new Promise((resolve, reject) => { const reader = new f.w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(download.blob, 'UTF-8'); });
  return { name: download.name, text };
}
function displayFixture() {
  const config = directFixture(), sidecar = directFixture(); sidecar.handle.name = 'direct.jsonc.view.json';
  sidecar.disk.bytes = Buffer.from(encodeState({ version: 1, positions: { a: { x: 321, y: 123, source: ',' } },
    camera: { x: 90, y: 110, scale: 1.4, width: 1000, height: 680 }, ui: { details: false, focus: false } }));
  const f = { config, sidecar, selected: config.handle, newTarget: null };
  f.setup = w => { config.setup(w); w.showOpenFilePicker = async () => [f.selected];
    w.showSaveFilePicker = async options => { assert.equal(options.suggestedName, 'direct.jsonc.view.json'); return f.newTarget || sidecar.handle; }; };
  return f;
}
test('view download captures positions, camera, layout and UI; download preserves dirty state and no writer is needed', async () => {
  const f = await page();
  try {
    await f.source(); f.$('layout').value = 'circle'; f.$('layout').dispatchEvent(new f.w.Event('change')); gesture(f, true); f.$('zoom-in').click(); f.$('toggle-details').click();
    const position = f.w.document.querySelector('.node').getAttribute('transform'), camera = f.$('viewport').getAttribute('transform');
    const output = await downloadValue(f), saved = parseState(output.text);
    assert.equal(output.name, 'cast.jsonc.view.json'); assert.equal(saved.layout, 'circle'); assert.equal(saved.ui.details, true); assert.ok(saved.positions.a);
    assert.match(f.$('web-view-status').textContent, /未保存の変更/);
    f.$('zoom-out').click(); f.$('toggle-details').click();
    f.choose('web-view', [f.file(output.name, output.text)]); await until(() => f.confirms.length === 1);
    assert.notEqual(f.$('viewport').getAttribute('transform'), camera);
    f.w.confirm = () => true; f.choose('web-view', [f.file(output.name, output.text)]); await until(() => f.$('web-file').textContent.includes('.view.json')); await pause();
    assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), position); assert.equal(f.$('viewport').getAttribute('transform'), camera);
    assert.equal(f.$('layout').value, 'circle'); assert.equal(f.$('details').hidden, false);
    assert.match(f.$('web-view-status').textContent, /変更なし/); assert.equal(f.$('web-view-save').hidden, true); assert.equal(f.$('web-view-save-as').hidden, true);
  } finally { f.close(); }
});
test('view-only replacement retains config and unsubmitted draft; node rename is exported under the new ID', async () => {
  const f = await page();
  try {
    await f.source(); gesture(f, true); f.$('edit-config').click(); f.w.document.querySelector('[data-kind="nodes"]').click();
    f.fill('field-id', 'hero'); f.$('edit-save').click(); await until(() => f.w.document.querySelector('.node').getAttribute('aria-label') === 'A'); await pause();
    f.fill('field-label', '未反映の人物名'); const output = await downloadValue(f);
    assert.ok(parseState(output.text).positions.hero); assert.equal(parseState(output.text).positions.a, undefined);
    f.w.confirm = () => true; f.choose('web-view', [f.file(output.name, output.text)]); await pause();
    assert.equal(f.$('field-label').value, '未反映の人物名'); assert.equal(f.$('config-editor').open, true);
    assert.equal(f.w.document.querySelector('.node .name').textContent, 'A');
    assert.equal(f.$('web-file').textContent, 'cast.jsonc + cast.jsonc.view.json');
  } finally { f.close(); }
});
test('existing view target is explicit, verified save affects only sidecar and keeps the form draft', async () => {
  const native = displayFixture(), f = await page(native.setup);
  try {
    await openDirect(f); await pause(); native.selected = native.sidecar.handle;
    f.$('web-direct-view-open').click(); await until(() => f.$('web-file').textContent.includes('.view.json')); await pause();
    assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), 'translate(321 123)');
    assert.equal(native.sidecar.disk.writes, 0); f.$('zoom-in').click(); await editTitle(f, '反映済みの設定');
    f.$('edit-config').click(); f.fill('field-title', '未反映の入力');
    f.$('web-view-save').click(); await until(() => native.sidecar.disk.closes === 1); await pause();
    assert.match(f.$('web-message').textContent, /内容を確認しました/); assert.match(f.$('web-view-status').textContent, /変更なし/);
    assert.equal(native.config.disk.bytes.toString(), text); assert.equal(parseState(native.sidecar.disk.bytes.toString()).camera.scale, 1.4 * 1.2);
    assert.equal(f.$('field-title').value, '未反映の入力'); assert.match(f.$('status').textContent, /未保存/);
  } finally { f.close(); }
});
test('new view target refuses existing bytes; an empty explicit target saves and selection cancellation preserves work', async () => {
  const native = displayFixture(), f = await page(native.setup);
  try {
    await openDirect(f); f.$('zoom-in').click();
    f.$('web-view-save-as').click(); await until(() => f.$('web-message').textContent.includes('中身のある既存ファイル'));
    assert.equal(native.sidecar.disk.writes, 0); assert.equal(f.$('web-view-save').disabled, true);
    const blank = directFixture(); blank.handle.name = 'direct.jsonc.view.json'; blank.disk.bytes = Buffer.alloc(0); native.newTarget = blank.handle;
    f.$('web-view-save-as').click(); await until(() => blank.disk.closes === 1); await pause();
    assert.match(f.$('web-message').textContent, /内容を確認しました/); assert.equal(f.$('web-view-save').disabled, false);
    const saved = parseState(blank.disk.bytes.toString());
    assert.deepEqual(Object.keys(saved.positions), ['a', 'b']);
    [...f.w.document.querySelectorAll('.node')].forEach((node, i) => {
      const position = saved.positions[['a', 'b'][i]];
      assert.equal(node.getAttribute('transform'), `translate(${position.x} ${position.y})`);
      assert.equal(position.source, ',');
    });
    assert.equal(native.config.disk.writes, 0);
    f.$('zoom-in').click(); f.w.showSaveFilePicker = async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); };
    f.$('web-view-save-as').click(); await pause(); assert.match(f.$('web-view-status').textContent, /未保存/);
    f.$('web-view-save').click(); await until(() => blank.disk.closes === 2); assert.equal(native.sidecar.disk.closes, 0);
  } finally { f.close(); }
});
test('view conflict/permission/write failure preserves config, positions, camera, draft and view download', async () => {
  for (const fault of ['conflict', 'denied', 'write']) {
    const native = displayFixture(), f = await page(native.setup);
    try {
      await openDirect(f); native.selected = native.sidecar.handle; f.$('web-direct-view-open').click(); await until(() => f.$('web-file').textContent.includes('.view.json')); await pause();
      f.$('zoom-in').click(); f.$('edit-config').click(); f.fill('field-title', '保持する入力');
      if (fault === 'conflict') native.sidecar.disk.bytes = Buffer.from(native.sidecar.disk.bytes.toString().replace('321', '322'));
      if (fault === 'denied') native.sidecar.disk.permission = 'denied'; if (fault === 'write') native.sidecar.disk.fail = 'write';
      const original = Buffer.from(native.sidecar.disk.bytes), camera = f.$('viewport').getAttribute('transform');
      f.$('web-view-save').click(); await until(() => f.$('web-message').textContent.includes('退避できます'));
      assert.deepEqual(native.sidecar.disk.bytes, original); assert.equal(native.config.disk.bytes.toString(), text); assert.equal(native.sidecar.disk.closes, 0);
      assert.equal(f.$('field-title').value, '保持する入力'); assert.equal(f.$('viewport').getAttribute('transform'), camera); assert.equal(f.$('web-save').disabled, false);
      if (fault === 'conflict') assert.equal(f.$('web-view-save').disabled, true);
      const output = await downloadValue(f); assert.equal(parseState(output.text).positions.a.x, 321); assert.equal(parseState(output.text).camera.scale, 1.4 * 1.2);
      assert.match(f.$('web-view-status').textContent, /未保存/);
    } finally { f.close(); }
  }
});
test('view capture records focus state and fixed-coordinate signatures without changing the config', async () => {
  const f = await page();
  try {
    await f.source('{"nodes":[{"id":"a","label":"A","x":100,"y":200}],"edges":[]}'); gesture(f, true); f.$('focus').click();
    const output = await downloadValue(f), saved = parseState(output.text);
    assert.equal(saved.ui.focus, true); assert.equal(saved.positions.a.source, '100,200');
    f.$('exit-focus').click(); f.w.confirm = () => true;
    f.choose('web-files', [f.file('cast.jsonc', '{"nodes":[{"id":"a","label":"A","x":400,"y":500}],"edges":[]}'), f.file(output.name, output.text)]);
    await until(() => f.w.document.querySelector('.node').getAttribute('transform') === 'translate(400 500)');
    assert.equal(f.w.document.body.classList.contains('focus-mode'), true); f.$('exit-focus').click();
  } finally { f.close(); }
});
