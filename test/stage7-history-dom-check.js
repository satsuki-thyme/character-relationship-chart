'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const { createWebHost } = require('../web/host');
const G = require('../packages/core/graph');
const source = '{ // keep コメント\n"groups":[{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],"nodes":[{"id":"a","label":"A","groups":["g1","g2"]},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","shape":"curved","label":"Link"}]}';
const pause = () => new Promise(resolve => setTimeout(resolve, 25));
async function fixture() {
  const dom = new JSDOM('<!doctype html><body>' + fs.readFileSync(path.join(__dirname, '../media/ui.html'), 'utf8') + '</body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, $ = id => w.document.getElementById(id), errors = [], outputs = [];
  w.addEventListener('error', e => errors.push(String(e.error)));
  w.ResizeObserver = class { observe() {} };
  w.SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 680 });
  w.SVGElement.prototype.setPointerCapture = w.SVGElement.prototype.releasePointerCapture = () => {};
  w.SVGElement.prototype.hasPointerCapture = () => false;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.RelationsGraph = G;
  let ui;
  const host = createWebHost({ readText: f => f.text(), downloadText: (text, name) => outputs.push({ text, name }), canTravel: () => !ui.hasPendingEdits() });
  for (const file of ['editor.js', 'main.js']) w.eval(fs.readFileSync(path.join(__dirname, '../media', file), 'utf8'));
  ui = w.RelationsUi(host);
  await host.openFiles([new File([source], 'cast.jsonc')]); await pause();
  return { w, $, host, ui, outputs,
    coords: () => [...w.document.querySelectorAll('.node')].map(n => [n.getAttribute('aria-label'), n.getAttribute('transform')]),
    fill(name, value) { $('field-' + name).value = value; $('field-' + name).dispatchEvent(new w.Event('input', { bubbles: true })); },
    async apply() { $('edit-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await pause(); },
    open(kind = 'general') { $('edit-config').click(); if (kind !== 'general') w.document.querySelector(`[data-kind="${kind}"]`).click(); },
    async text() { await host.downloadConfig(); return outputs.at(-1).text; },
    close() { host.dispose(); w.close(); assert.deepEqual(errors, []); }
  };
}
function drag(f, x) {
  for (const [target, type, px] of [[f.w.document.querySelector('.node'), 'pointerdown', 200], [f.$('canvas'), 'pointermove', x], [f.$('canvas'), 'pointerup', x]]) {
    const e = new f.w.MouseEvent(type, { bubbles: true, button: 0, clientX: px, clientY: 200 });
    Object.defineProperty(e, 'pointerId', { value: 1 }); target.dispatchEvent(e);
  }
}
test('rendered drag and ID rename restore all positions, references and exact comments in one step', async () => {
  const f = await fixture();
  try {
    const initial = f.coords(); drag(f, 250); const moved = f.coords(); assert.notDeepEqual(moved, initial);
    assert.equal(f.host.getHistoryState().undoCount, 1); f.host.undo(); assert.deepEqual(f.coords(), initial); f.host.redo(); assert.deepEqual(f.coords(), moved);
    const raw = await f.text(); f.open('nodes'); f.fill('id', 'hero'); await f.apply();
    assert.equal(f.host.getHistoryState().undoCount, 2, 'ID and layout are one transaction');
    const renamed = f.coords(), text = await f.text(); assert.match(text, /"from":\s*"hero"/); assert.match(text, /keep コメント/);
    assert.equal(f.host.undo().ok, true); assert.equal(f.$('field-id').value, 'a'); assert.deepEqual(f.coords(), moved); assert.equal(await f.text(), raw);
    f.host.redo(); assert.equal(f.$('field-id').value, 'hero'); assert.deepEqual(f.coords(), renamed); assert.equal(await f.text(), text);
  } finally { f.close(); }
});
test('node deletion restores related edges and unmodified nodes retain their arrangement', async () => {
  const f = await fixture();
  try {
    drag(f, 260); const before = f.coords(); f.open('nodes'); f.$('edit-delete').click(); f.$('edit-confirm').querySelector('button').click(); await pause();
    assert.equal(f.w.document.querySelectorAll('.node').length, 1); assert.equal(f.w.document.querySelectorAll('.edge').length, 0);
    f.host.undo(); assert.deepEqual(f.coords(), before); assert.equal(f.w.document.querySelectorAll('.edge').length, 1);
    f.host.redo(); assert.equal(f.w.document.querySelectorAll('.node').length, 1);
  } finally { f.close(); }
});
test('view layout, zoom and UI flags round-trip without changing configuration or dirty baseline', async () => {
  const f = await fixture();
  try {
    const initial = f.coords(), raw = await f.text();
    f.$('layout').value = 'circle'; f.$('layout').dispatchEvent(new f.w.Event('change'));
    const circle = f.coords(); f.$('zoom-in').click(); const zoom = f.$('zoom').textContent;
    f.$('toggle-details').click(); assert.equal(f.$('details').hidden, false);
    f.host.undo(); assert.equal(f.$('details').hidden, true); assert.equal(f.$('zoom').textContent, zoom);
    f.host.undo(); f.host.undo(); assert.deepEqual(f.coords(), initial); assert.equal(f.$('layout').value, 'auto');
    assert.equal(f.host.hasEdits(), false); assert.equal(f.host.hasViewEdits(), false); assert.equal(await f.text(), raw);
    f.host.redo(); assert.deepEqual(f.coords(), circle); f.host.redo(); assert.equal(f.$('zoom').textContent, zoom); f.host.redo(); assert.equal(f.$('details').hidden, false);
  } finally { f.close(); }
});
test('unapplied and in-flight forms retain values and references and reject history', async () => {
  const f = await fixture();
  try {
    drag(f, 250); f.open('nodes'); f.fill('label', 'まだ反映しない');
    const before = f.coords(); assert.equal(f.host.undo().ok, false); assert.equal(f.$('field-label').value, 'まだ反映しない'); assert.deepEqual(f.coords(), before);
    const edit = f.host.editConfig; let release;
    f.host.editConfig = async (...args) => { const result = await edit(...args); await new Promise(resolve => { release = resolve; }); return result; };
    f.$('edit-form').dispatchEvent(new f.w.Event('submit', { cancelable: true })); await pause();
    assert.equal(f.ui.hasPendingEdits(), true); assert.equal(f.host.undo().ok, false);
    release(); await pause(); assert.equal(f.ui.hasPendingEdits(), false); f.host.undo(); assert.equal(f.$('field-label').value, 'A');
  } finally { f.close(); }
});
test('sidecar reload keeps an unapplied form and its config version while resetting history', async () => {
  const f = await fixture();
  try {
    f.open(); f.fill('title', 'draft'); f.$('zoom-in').click();
    const view = { version: 1, positions: { a: { x: 500, y: 100, source: ',' } } };
    await f.host.openFiles([new File([JSON.stringify(view)], 'cast.jsonc.view.json')]); await pause();
    assert.equal(f.$('field-title').value, 'draft'); assert.equal(f.host.getHistoryState().undoCount, 0);
    assert.equal(f.host.getHistoryState().redoCount, 0); assert.equal(f.$('edit-save').disabled, false);
    await f.apply(); assert.match(await f.text(), /draft/);
  } finally { f.close(); }
});
test('fixed-coordinate and config-layout edits undo to their matching rendered view', async () => {
  const f = await fixture();
  try {
    drag(f, 250); const before = f.coords(); f.open('nodes'); f.fill('x', '800'); f.fill('y', '300'); await f.apply();
    assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), 'translate(800 300)');
    f.host.undo(); assert.deepEqual(f.coords(), before); f.host.redo(); assert.equal(f.w.document.querySelector('.node').getAttribute('transform'), 'translate(800 300)');
    f.w.document.querySelector('[data-kind="general"]').click(); f.$('field-layout').value = 'circle'; f.$('field-layout').dispatchEvent(new f.w.Event('change', { bubbles: true }));
    await f.apply(); assert.equal(f.$('layout').value, 'circle'); f.host.undo(); assert.equal(f.$('layout').value, 'auto'); f.host.redo(); assert.equal(f.$('layout').value, 'circle');
  } finally { f.close(); }
});
