'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWebHost } = require('../web/host');
const { createHistory } = require('../web/history');
const { encodeState } = require('../packages/core/view-state');
const source = '\uFEFF{\r\n\t// keep コメント\r\n\t"title":"元の図","groups":[{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],\r\n\t"nodes":[{"id":"a","label":"A","groups":["g1","g2"]},{"id":"b","label":"B"}],\r\n\t"edges":[{"from":"a","to":"b","label":"関係","shape":"curved"}]\r\n}\r\n';
const view = { version: 1, layout: 'auto', configLayout: 'auto', positions: { a: { x: 40, y: 20, source: ',' }, b: { x: 200, y: 100, source: ',' } }, camera: { x: 10, y: 20, scale: 1 }, ui: { details: false, focus: false } };
function file(name, content) {
  const disk = { bytes: Buffer.from(content), writes: 0, hooks: {} };
  const handle = { kind: 'file', name,
    async getFile() { await disk.hooks.read?.(); return new File([disk.bytes], name); },
    async requestPermission() { await disk.hooks.permission?.(); return 'granted'; },
    async isSameEntry(other) { return other === handle; },
    async createWritable() { let next; return {
      async write(bytes) { disk.writes++; next = Buffer.from(bytes); await disk.hooks.write?.(); },
      async close() { disk.bytes = next; await disk.hooks.close?.(); }, async abort() {}
    }; }
  };
  return { disk, handle };
}
async function fixture() {
  const config = file('cast.jsonc', source), sidecar = file('cast.jsonc.view.json', encodeState(view));
  const f = { config, sidecar, pending: false, allow: true, latest: null, downloads: [] };
  f.host = createWebHost({ readText: x => x.text(), downloadText: (text, name) => f.downloads.push({ text, name }),
    confirmReplace: () => f.allow, canTravel: () => !f.pending });
  f.host.onConfig(x => { f.latest = x; });
  assert.equal((await f.host.openHandle(config.handle)).ok, true);
  assert.equal((await f.host.openViewHandle(sidecar.handle)).ok, true);
  f.edit = async (op = { kind: 'general', action: 'save', value: { title: '改訂' } }) => {
    const r = await f.host.editConfig(op, f.latest.documentVersion); assert.equal(r.ok, true, r.message); return r;
  };
  f.move = x => { const next = f.host.getViewState(); next.positions.a.x = x; assert.equal(f.host.updateView(next).ok, true); };
  f.snapshot = async () => { await f.host.downloadConfig(); return { text: f.downloads.at(-1).text, view: encodeState(f.host.getViewState()) }; };
  return f;
}
test('all main GUI edits round-trip exact JSONC, memberships, relation references and positions', async () => {
  const f = await fixture(), snapshots = [await f.snapshot()];
  const operations = [
    { kind: 'general', action: 'save', value: { title: '物語', layout: 'circle' } },
    { kind: 'nodes', action: 'save', index: 0, value: { id: 'hero', label: '主人公', groups: ['g2', 'g1'] } },
    { kind: 'groups', action: 'save', index: 0, value: { id: 'crew', label: '仲間' } },
    { kind: 'edges', action: 'save', index: 0, value: { from: 'hero', to: 'b', label: '信頼', shape: 'straight', arrow: 'both', style: 'dashed' } },
    { kind: 'nodes', action: 'delete', index: 0 },
    { kind: 'groups', action: 'delete', index: 0 }
  ];
  for (const operation of operations) { await f.edit(operation); snapshots.push(await f.snapshot()); }
  for (let i = operations.length - 1; i >= 0; i--) {
    const version = f.latest.documentVersion; assert.equal(f.host.undo().ok, true);
    assert.ok(f.latest.documentVersion > version); assert.deepEqual(await f.snapshot(), snapshots[i]);
  }
  assert.equal(f.host.hasEdits(), false); assert.equal(f.host.hasViewEdits(), false);
  for (let i = 1; i < snapshots.length; i++) { assert.equal(f.host.redo().ok, true); assert.deepEqual(await f.snapshot(), snapshots[i]); }
  assert.equal(f.config.disk.writes + f.sidecar.disk.writes, 0);
  assert.match(snapshots.at(-1).text, /\t\/\/ keep コメント\r\n/);
});
test('an ID edit and synchronous rendered-layout capture are one history step', async () => {
  const f = await fixture(), before = await f.snapshot();
  f.host.onConfig(message => {
    if (message.rename) {
      const next = f.host.getViewState(); next.positions.b.x = 333; f.host.updateView(next);
    }
  });
  await f.edit({ kind: 'nodes', action: 'save', index: 0, value: { id: 'hero', label: 'Hero', groups: ['g1','g2'] } });
  const after = await f.snapshot(); assert.equal(f.host.getHistoryState().undoCount, 1);
  assert.equal(f.latest.config.edges[0].from, 'hero'); assert.equal(f.host.getViewState().positions.hero.x, 40);
  f.host.undo(); assert.deepEqual(await f.snapshot(), before);
  f.host.redo(); assert.deepEqual(await f.snapshot(), after);
});
test('new config or view edit discards Redo; no-op capture and failed edit do not', async () => {
  const f = await fixture(); await f.edit(); f.move(80); f.host.undo();
  f.host.updateView(f.host.getViewState()); assert.equal(f.host.getHistoryState().redoCount, 1);
  const bad = await f.host.editConfig({ kind: 'nodes', action: 'save', index: 0, value: { id: 'b', label: 'bad' } }, f.latest.documentVersion);
  assert.equal(bad.ok, false); assert.equal(f.host.getHistoryState().redoCount, 1);
  await f.edit({ kind: 'general', action: 'save', value: { title: 'branch' } }); assert.equal(f.host.redo().ok, false);
  f.host.undo(); f.move(200); assert.equal(f.host.redo().ok, false);
});
test('confirmed config and view saves stay outside history and have independent dirty comparisons', async () => {
  const f = await fixture(); await f.edit(); f.move(80);
  assert.equal((await f.host.saveConfig()).ok, true); assert.equal(f.host.hasEdits(), false); assert.equal(f.host.hasViewEdits(), true);
  assert.equal((await f.host.saveView()).ok, true); const configBytes = Buffer.from(f.config.disk.bytes), viewBytes = Buffer.from(f.sidecar.disk.bytes);
  f.host.undo(); assert.equal(f.host.hasEdits(), false); assert.equal(f.host.hasViewEdits(), true);
  f.host.undo(); assert.equal(f.host.hasEdits(), true); assert.equal(f.host.hasViewEdits(), true);
  assert.deepEqual(f.config.disk.bytes, configBytes); assert.deepEqual(f.sidecar.disk.bytes, viewBytes);
  f.host.redo(); f.host.redo(); assert.equal(f.host.hasEdits(), false); assert.equal(f.host.hasViewEdits(), false);
  f.host.undo(); assert.equal((await f.host.saveView()).ok, true, 'uses saved raw bytes, not the history baseline');
  f.host.undo(); assert.equal((await f.host.saveConfig()).ok, true);
});
for (const fault of ['conflict', 'uncertain']) test(`${fault} latches survive Undo/Redo and never adopt external bytes`, async () => {
  const f = await fixture(); await f.edit(); f.move(77);
  if (fault === 'conflict') { f.config.disk.bytes = Buffer.from(source + ' '); f.sidecar.disk.bytes = Buffer.from(encodeState(view) + ' '); }
  else { f.config.disk.hooks.close = f.sidecar.disk.hooks.close = () => { throw new Error('unknown outcome'); }; }
  assert.equal((await f.host.saveConfig()).status, fault); assert.equal((await f.host.saveView()).status, fault);
  const writes = f.config.disk.writes + f.sidecar.disk.writes;
  f.host.undo(); f.host.undo(); f.host.redo(); f.host.redo();
  assert.equal(f.host.getSaveState().blocked, true); assert.equal(f.host.getViewSaveState().blocked, true);
  assert.equal((await f.host.saveConfig()).status, 'blocked'); assert.equal((await f.host.saveView()).status, 'blocked');
  assert.equal(f.config.disk.writes + f.sidecar.disk.writes, writes);
  assert.equal((await f.host.downloadConfig()).ok, true); assert.equal((await f.host.downloadView()).ok, true);
});
for (const kind of ['config', 'view', 'save-as']) test(`Undo/Redo during ${kind} save are rejected; subsequent edits remain dirty`, async () => {
  const f = await fixture(); await f.edit(); f.move(99);
  let release, entered; const started = new Promise(resolve => { entered = resolve; });
  const dest = kind === 'config' ? f.config : kind === 'view' ? f.sidecar : file('cast.jsonc.view.json', '');
  dest.disk.hooks.write = () => { entered(); return new Promise(resolve => { release = resolve; }); };
  const saving = kind === 'config' ? f.host.saveConfig() : kind === 'view' ? f.host.saveView() : f.host.saveViewAs(async () => dest.handle);
  await started; const before = await f.snapshot(), history = f.host.getHistoryState();
  assert.equal(f.host.undo().ok, false); assert.equal(f.host.redo().ok, false); assert.deepEqual(await f.snapshot(), before);
  assert.deepEqual(f.host.getHistoryState(), history);
  if (kind === 'config') await f.edit({ kind: 'general', action: 'save', value: { title: '保存中の追加' } }); else f.move(170);
  release(); assert.equal((await saving).ok, true);
  assert.equal(kind === 'config' ? f.host.hasEdits() : f.host.hasViewEdits(), true);
  f.host.undo(); assert.equal(kind === 'config' ? f.host.hasEdits() : f.host.hasViewEdits(), false);
  assert.equal(f.host.getViewSaveState().available, true);
});
test('pending forms reject history without changing the version, state or stack', async () => {
  const f = await fixture(); await f.edit(); const before = await f.snapshot(), version = f.latest.documentVersion;
  f.pending = true; assert.equal(f.host.undo().ok, false); assert.equal(f.host.getHistoryState().undoCount, 1);
  assert.deepEqual(await f.snapshot(), before); assert.equal(f.latest.documentVersion, version);
  f.pending = false; assert.equal(f.host.undo().ok, true);
  assert.equal((await f.host.editConfig({ kind: 'general', action: 'save', value: {} }, version)).ok, false);
});
test('view-only reload clears history but preserves config and its target; failed/cancelled loads keep history', async () => {
  const f = await fixture(); await f.edit(); f.move(77); const original = await f.snapshot();
  f.allow = false; assert.equal((await f.host.openViewHandle(f.sidecar.handle)).cancelled, true);
  assert.equal(f.host.getHistoryState().undoCount, 2); assert.deepEqual(await f.snapshot(), original);
  assert.equal((await f.host.openFiles([new File(['{bad'], 'bad.jsonc')])).ok, false);
  assert.equal(f.host.getHistoryState().undoCount, 2);
  f.allow = true; assert.equal((await f.host.openViewHandle(f.sidecar.handle)).ok, true);
  assert.equal(f.host.getHistoryState().undoCount, 0); assert.equal(f.host.getHistoryState().redoCount, 0);
  assert.equal((await f.snapshot()).text, original.text); assert.equal(f.host.hasEdits(), true); assert.equal(f.host.hasViewEdits(), false);
  assert.equal((await f.host.saveConfig()).ok, true);
});
test('same-named different source starts with no old history, positions or save target', async () => {
  const f = await fixture(); await f.edit(); f.move(77); f.host.undo();
  assert.equal((await f.host.openFiles([new File(['{"nodes":[{"id":"other","label":"別作品"}],"edges":[]}'], 'cast.jsonc')])).ok, true);
  assert.equal(f.host.undo().ok, false); assert.equal(f.host.redo().ok, false);
  assert.deepEqual(Object.keys(f.host.getViewState().positions || {}), []);
  assert.equal(f.host.getSaveState().available, false); assert.equal(f.host.getViewSaveState().available, false);
});
for (const sidecar of [false, true]) test(`Undo invalidates a slow ${sidecar ? 'view' : 'source'} read and old versions`, async () => {
  const f = await fixture(); await f.edit(); f.move(77);
  let release; const read = new Promise(resolve => { release = resolve; });
  const target = sidecar ? f.sidecar : f.config; target.disk.hooks.read = () => read;
  const pending = sidecar ? f.host.openViewHandle(target.handle) : f.host.openHandle(target.handle);
  f.host.undo(); const before = await f.snapshot(); release();
  assert.equal((await pending).stale, true); assert.deepEqual(await f.snapshot(), before);
  assert.equal(f.host.getHistoryState().redoCount, 1);
});
test('history limits discard oldest entries and disposal releases history', async () => {
  const h = createHistory({ steps: 2, bytes: 1000 }), s = n => ({ text: String(n), view: '' });
  h.record(s(0), s(1)); h.record(s(1), s(2)); h.record(s(2), s(3));
  assert.deepEqual(h.state(), { undoCount: 2, redoCount: 0, limited: true });
  assert.deepEqual(h.undo(), s(2)); assert.deepEqual(h.undo(), s(1)); assert.equal(h.undo(), null);
  assert.deepEqual(h.redo(), s(2)); h.record(s(2), s(4)); assert.equal(h.redo(), null);
  const small = createHistory({ bytes: 10 }); small.record(s(1), { text: '123456', view: '' }); assert.equal(small.state().undoCount, 0); assert.equal(small.state().limited, true);
  const f = await fixture(); await f.edit(); f.host.dispose(); assert.equal(f.host.getHistoryState().undoCount, 0); assert.equal(f.host.undo().ok, false);
});

test('resize/output capture preserves Redo and the saved view baseline, including fractional camera centres', async () => {
  const f = await fixture(), state = f.host.getViewState();
  state.camera = { x: 0.123456789123, y: -271.01234567, scale: 1.2, width: 801, height: 677 };
  f.host.updateView(state); await f.host.saveView(); await f.edit(); f.host.undo();
  const history = f.host.getHistoryState();
  for (const width of [390, 1440, 1023.8125, 801]) {
    const next = f.host.getViewState(), c = next.camera, height = width / 3 + 127;
    c.x += (width - c.width) / 2; c.y += (height - c.height) / 2;
    c.width = width; c.height = height;
    f.host.updateView(next); f.host.updateView(next, { record: false });
    assert.equal(f.host.hasViewEdits(), false);
    assert.deepEqual(f.host.getHistoryState(), history);
  }
  const changed = f.host.getViewState(); changed.camera.x += 0.125;
  f.host.updateView(changed); assert.equal(f.host.hasViewEdits(), true);
  assert.equal(f.host.getHistoryState().redoCount, 0);
  f.host.undo(); assert.equal(f.host.hasViewEdits(), false);
});
