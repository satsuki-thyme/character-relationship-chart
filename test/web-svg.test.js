'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWebHost } = require('../web/host');
const source = '{// retained\n"nodes":[{"id":"a","label":"A"}],"edges":[]}';
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>人物 &amp; 関係</text></svg>';
const file = (name, text) => ({ name, text, size: Buffer.byteLength(text) });
async function fixture(options = {}) {
  const downloads = [], configs = [];
  const host = createWebHost({ readText: f => f.text, downloadText: (text, name, type) => downloads.push({ text, name, type }), ...options });
  host.onConfig(c => configs.push(c));
  await host.openFiles([file('人物.JSONC', source)]);
  return { host, downloads, configs };
}
const state = h => ({ history: h.getHistoryState(), sourceDirty: h.hasEdits(), viewDirty: h.hasViewEdits(), view: h.getViewState(), save: h.getSaveState(), viewSave: h.getViewSaveState() });
test('SVG output has the source stem and SVG MIME without changing document or history', async () => {
  const f = await fixture();
  await f.host.editConfig({ kind: 'general', action: 'save', value: { title: 'Changed', description: '', layout: 'auto' } }, f.configs.at(-1).documentVersion);
  f.host.updateView({ version: 1, positions: { a: { x: 20, y: 30, source: ',' } } });
  f.host.undo(); const before = state(f.host), version = f.configs.at(-1).documentVersion;
  assert.equal((await f.host.exportSvg(svg)).ok, true);
  assert.deepEqual(f.downloads, [{ text: svg, name: '人物.svg', type: 'image/svg+xml;charset=utf-8' }]);
  assert.deepEqual(state(f.host), before); assert.equal(f.configs.at(-1).documentVersion, version);
  assert.equal(f.host.redo().ok, true);
});
test('SVG download rejection retains redo and edits and can be retried', async () => {
  let fails = true; const f = await fixture({ downloadText() { if (fails) throw new Error('output denied'); } });
  f.host.updateView({ version: 1, layout: 'circle' }); f.host.undo(); const before = state(f.host);
  const result = await f.host.exportSvg(svg); assert.equal(result.ok, false); assert.match(result.message, /output denied/);
  assert.deepEqual(state(f.host), before); fails = false; assert.equal((await f.host.exportSvg(svg)).ok, true); assert.deepEqual(state(f.host), before);
});
test('SVG rejects pending form, invalid payload and disposed host without downloading', async () => {
  let pending = true; const f = await fixture({ canTravel: () => !pending });
  assert.match((await f.host.exportSvg(svg)).message, /未反映/); pending = false;
  for (const value of [null, 123, 'not SVG', '<svg/>', svg.padEnd(8 * 1024 * 1024)]) assert.equal((await f.host.exportSvg(value)).ok, false);
  f.host.dispose(); assert.equal((await f.host.exportSvg(svg)).ok, false); assert.equal(f.downloads.length, 0);
});
test('SVG output preserves conflict-stopped config and view destinations', async () => {
  const f = await fixture();
  const handle = (name, text) => ({ kind: 'file', name, text, writes: 0,
    async getFile() { return new File([this.text], this.name); }, async requestPermission() { return 'granted'; },
    async createWritable() { this.writes++; throw new Error('must not write'); } });
  const config = handle('人物.jsonc', source), view = handle('人物.jsonc.view.json', '{"version":1}');
  await f.host.openHandle(config); await f.host.openViewHandle(view);
  config.text += ' '; view.text += ' ';
  assert.equal((await f.host.saveConfig()).ok, false); assert.equal((await f.host.saveView()).ok, false);
  assert.equal(f.host.getSaveState().blocked, true); assert.equal(f.host.getViewSaveState().blocked, true);
  const before = state(f.host); assert.equal((await f.host.exportSvg(svg)).ok, true);
  assert.deepEqual(state(f.host), before); assert.equal(config.writes + view.writes, 0);
});
