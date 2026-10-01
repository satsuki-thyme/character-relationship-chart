'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWebHost } = require('../web/host');
const { parseState, encodeState, normalizeState, VIEW_LIMITS } = require('../packages/core/view-state');
const { parseConfig } = require('../packages/core/config');
const { supportsViewSaveAs } = require('../web/file-access');
const source = '\uFEFF{\r\n\t// untouched コメント\r\n\t"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b"}]\r\n}\r\n';
const view = { version: 1, layout: 'circle', configLayout: 'auto', positions: { a: { x: 321, y: 123, source: ',' } },
  camera: { x: 100, y: 110, scale: 1.4, width: 1000, height: 680 }, ui: { details: true, focus: false } };
function diskFile(name, text) {
  const disk = { bytes: Buffer.from(text), reads: 0, creates: 0, writes: 0, closes: 0, aborts: 0, permissions: 0, permission: 'granted', hooks: {} };
  const handle = { name, kind: 'file',
    async getFile() { disk.reads++; await disk.hooks.read?.(disk.reads); return new File([disk.bytes], name, { lastModified: 1 }); },
    async requestPermission() { disk.permissions++; await disk.hooks.permission?.(); return disk.permission; },
    async createWritable(options) {
      assert.deepEqual(options, { keepExistingData: false, mode: 'exclusive' }); disk.creates++; await disk.hooks.create?.(); let staged;
      return { async write(bytes) { disk.writes++; staged = Buffer.from(bytes); await disk.hooks.write?.(); },
        async close() { disk.closes++; await disk.hooks.close?.(); disk.bytes = staged; await disk.hooks.afterClose?.(); },
        async abort() { disk.aborts++; await disk.hooks.abort?.(); } };
    }, async isSameEntry(other) { return handle === other; }
  };
  return { disk, handle };
}
function fixture(name = '人物.jsonc') {
  const config = diskFile(name, source), sidecar = diskFile(name + '.view.json', '\uFEFF' + encodeState(view).replace(/\n/g, '\r\n'));
  const downloads = [], configs = [], notices = [], f = { config, sidecar, downloads, configs, notices, allow: true };
  f.host = createWebHost({ readText: file => file.text(), downloadText: (text, name) => downloads.push({ text, name }),
    confirmReplace: scope => { notices.push(scope); return f.allow; } });
  f.host.onConfig(message => configs.push(message));
  f.open = async () => { assert.equal((await f.host.openHandle(config.handle)).ok, true); assert.equal((await f.host.openViewHandle(sidecar.handle)).ok, true); };
  f.change = () => { const next = f.host.getViewState(); next.camera.scale = 2; assert.equal(f.host.updateView(next).ok, true); return next; };
  f.edit = async op => { const result = await f.host.editConfig(op || { kind: 'general', action: 'save', value: { title: '未保存の設定' } }, configs.at(-1).documentVersion); assert.equal(result.ok, true, result.message); };
  return f;
}
test('view downloads round-trip existing JSON/JSONC names and never write or mark downloads saved', async () => {
  for (const name of ['人物.jsonc', 'cast.relations.json']) {
    const f = fixture(name); await f.open(); const next = f.change(); next.camera.x = 9999;
    await f.host.downloadView(); const saved = f.downloads.at(-1);
    assert.equal(saved.name, name + '.view.json'); assert.equal(saved.text, encodeState({ ...view, camera: { ...view.camera, scale: 2 } }));
    assert.deepEqual(parseState(saved.text), f.host.getViewState()); assert.equal(f.host.hasViewEdits(), true);
    assert.equal(f.sidecar.disk.writes, 0); assert.equal(f.config.disk.writes, 0);
    await f.host.downloadConfig(); assert.equal(f.downloads.at(-1).text, source);
  }
});
test('capture validation and failed download keep view/config; subscriptions never share mutable state', async () => {
  const f = fixture(); let emitted;
  f.host.onView(message => { emitted = message.viewState; }); await f.open(); emitted.positions.a.x = -1;
  assert.equal(f.host.getViewState().positions.a.x, 321);
  f.change(); const before = encodeState(f.host.getViewState());
  for (const bad of [{ version: 2 }, { version: 1, camera: { x: 0, y: 0, scale: 9 } }, { ...view, mystery: true }]) assert.equal(f.host.updateView(bad).ok, false);
  assert.equal(encodeState(f.host.getViewState()), before);
  const host = createWebHost({ readText: f => f.text(), downloadText: () => { throw new Error('blocked download'); } });
  await host.openFiles([new File([source], 'a.jsonc')]); host.updateView(view);
  assert.equal((await host.downloadView()).ok, false); assert.deepEqual(host.getViewState(), normalizeState(view)); assert.equal(host.hasViewEdits(), true);
});
test('existing view save verifies UTF-8 bytes and clears only its own dirty state and baseline', async () => {
  const f = fixture(); await f.open(); assert.equal(f.sidecar.disk.permissions, 0); await f.edit(); f.change();
  const result = await f.host.saveView(); assert.equal(result.ok, true); assert.equal(result.dirty, false);
  assert.equal(f.sidecar.disk.bytes.toString(), encodeState(f.host.getViewState())); assert.equal(f.config.disk.bytes.toString(), source);
  assert.equal(f.host.hasEdits(), true); assert.equal(f.host.hasViewEdits(), false);
  f.host.updateView({ ...f.host.getViewState(), ui: { details: false, focus: true } });
  assert.equal((await f.host.saveConfig()).ok, true); assert.equal(f.host.hasEdits(), false); assert.equal(f.host.hasViewEdits(), true);
  assert.equal(parseConfig(f.config.disk.bytes.toString()).config.title, '未保存の設定');
  assert.equal((await f.host.saveView()).ok, true); assert.equal(f.host.hasViewEdits(), false); assert.equal(f.sidecar.disk.closes, 2);
});
test('same-size external change, BOM-only change and late conflicts stop only the view target', async () => {
  for (const fault of ['same-size', 'BOM', 'create', 'write']) {
    const f = fixture(); await f.open(); f.change(); await f.edit();
    const external = Buffer.from(f.sidecar.disk.bytes.toString().replace('321', '322'));
    if (fault === 'same-size') f.sidecar.disk.bytes = external;
    else if (fault === 'BOM') f.sidecar.disk.bytes = f.sidecar.disk.bytes.subarray(3);
    else f.sidecar.disk.hooks[fault] = () => { f.sidecar.disk.bytes = external; };
    const result = await f.host.saveView(); assert.equal(result.status, 'conflict', fault);
    assert.equal(f.sidecar.disk.closes, 0); assert.equal(f.host.getViewSaveState().blocked, true);
    assert.equal(f.host.getSaveState().blocked, false); assert.equal(f.host.getSaveState().available, true);
    assert.equal(f.host.getViewState().camera.scale, 2); assert.equal(f.host.hasViewEdits(), true);
    assert.equal((await f.host.saveConfig()).ok, true); await f.host.downloadView(); assert.equal(parseState(f.downloads.at(-1).text).camera.scale, 2);
  }
});
for (const phase of ['permission', 'create', 'write', 'close', 'verify', 'abort']) test(`view ${phase} failure retains content and follows the retry/uncertain policy`, async () => {
  const f = fixture(); await f.open(); f.change(); const original = Buffer.from(f.sidecar.disk.bytes);
  if (phase === 'verify') f.sidecar.disk.hooks.afterClose = () => { f.sidecar.disk.bytes = Buffer.from('changed after close'); };
  else {
    f.sidecar.disk.hooks[phase] = () => { throw new Error('injected ' + phase); };
    if (phase === 'abort') f.sidecar.disk.hooks.write = () => { throw new Error('injected write'); };
  }
  const result = await f.host.saveView(); assert.equal(result.ok, false);
  assert.equal(f.host.getViewSaveState().blocked, ['close', 'verify', 'abort'].includes(phase));
  assert.equal(f.host.getViewState().camera.scale, 2); assert.equal(f.host.hasViewEdits(), true); assert.equal(f.config.disk.writes, 0);
  if (phase !== 'verify') assert.deepEqual(f.sidecar.disk.bytes, original);
  const writes = f.sidecar.disk.writes;
  if (result.blocked) { await f.host.saveView(); assert.equal(f.sidecar.disk.writes, writes); }
  await f.host.downloadView(); assert.equal(parseState(f.downloads.at(-1).text).camera.scale, 2);
});
test('view permission denial preserves both save targets and allows an explicit retry', async () => {
  const f = fixture(); await f.open(); f.change(); f.sidecar.disk.permission = 'denied';
  assert.equal((await f.host.saveView()).status, 'denied'); assert.equal(f.sidecar.disk.creates, 0); assert.equal(f.host.hasViewEdits(), true);
  f.sidecar.disk.permission = 'granted'; assert.equal((await f.host.saveView()).ok, true);
});
test('view precommit read failures abort staging and preserve the original baseline', async () => {
  for (const checkpoint of [2, 3, 4]) {
    const f = fixture(); await f.open(); f.change();
    const original = Buffer.from(f.sidecar.disk.bytes); f.sidecar.disk.hooks.read = n => { if (n === checkpoint) throw new Error('read failed'); };
    assert.equal((await f.host.saveView()).ok, false); assert.equal(f.sidecar.disk.closes, 0); assert.deepEqual(f.sidecar.disk.bytes, original);
    assert.equal(f.host.hasViewEdits(), true);
    f.sidecar.disk.hooks = {}; assert.equal((await f.host.saveView()).ok, true);
  }
});
test('empty target selection saves current view, rejects nonempty/wrong/aliased targets without writes', async () => {
  const f = fixture(); await f.open(); f.change();
  for (const candidate of [diskFile('人物.jsonc.view.json', 'existing data'), diskFile('wrong.view.json', ''), f.config]) {
    const before = Buffer.from(candidate.disk.bytes);
    assert.equal((await f.host.saveViewAs(() => candidate.handle)).ok, false); assert.equal(candidate.disk.creates, 0); assert.deepEqual(candidate.disk.bytes, before);
  }
  const alias = diskFile('人物.jsonc.view.json', ''); alias.handle.isSameEntry = async () => true;
  assert.equal((await f.host.saveViewAs(() => alias.handle)).ok, false); assert.equal(alias.disk.creates, 0);
  const empty = diskFile('人物.jsonc.view.json', '');
  assert.equal((await f.host.saveViewAs(name => { assert.equal(name, empty.handle.name); return empty.handle; })).ok, true);
  assert.equal(empty.disk.bytes.toString(), encodeState(f.host.getViewState())); assert.equal(f.sidecar.disk.closes, 0);
  assert.equal(f.host.hasViewEdits(), false); assert.equal(f.config.disk.bytes.toString(), source);
});
test('cancelled picker and failed selection keep the previous target and layout', async () => {
  const f = fixture(); await f.open(); f.change();
  assert.equal((await f.host.saveViewAs(() => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); })).status, 'cancelled');
  assert.equal((await f.host.openViewHandle(diskFile('other.jsonc.view.json', encodeState(view)).handle)).ok, false);
  assert.equal((await f.host.openViewHandle(diskFile('人物.jsonc.view.json', '{bad').handle)).ok, false);
  assert.equal(f.host.getViewState().camera.scale, 2); assert.equal((await f.host.saveView()).ok, true); assert.equal(f.sidecar.disk.closes, 1);
});
test('source and view replacement confirmations protect changes; view-only reads preserve config edits/target', async () => {
  const f = fixture(); await f.open(); await f.edit(); f.change(); f.allow = false;
  assert.equal((await f.host.openFiles([new File([encodeState(view)], '人物.jsonc.view.json')])).cancelled, true);
  assert.equal(f.notices.at(-1), 'view'); assert.equal(f.host.getViewState().camera.scale, 2);
  assert.equal((await f.host.openFiles([new File([source], 'other.jsonc')])).cancelled, true); assert.equal(f.notices.at(-1), 'source');
  f.allow = true; assert.equal((await f.host.openFiles([new File([encodeState(view)], '人物.jsonc.view.json')])).ok, true);
  assert.equal(f.host.hasEdits(), true); assert.equal(f.host.hasViewEdits(), false); assert.equal(f.host.getViewSaveState().available, false);
  assert.equal((await f.host.saveConfig()).ok, true); assert.equal(f.config.disk.closes, 1);
});
test('different source including the same filename never inherits old layout/target; pair validation is atomic', async () => {
  const f = fixture(); await f.open(); f.change();
  assert.equal((await f.host.openFiles([new File([source], 'new.jsonc'), new File(['{bad'], 'new.jsonc.view.json')])).ok, false);
  assert.equal(f.host.getViewState().camera.scale, 2); assert.equal(f.host.getViewSaveState().available, true);
  assert.equal((await f.host.openFiles([new File([source.replace('"A"', '"Different"')], '人物.jsonc')])).ok, true);
  assert.equal(Object.keys(f.host.getViewState().positions).length, 0); assert.equal(f.host.getViewState().camera, undefined);
  assert.equal(f.host.getViewSaveState().available, false); assert.equal(f.host.getSaveState().available, false);
  assert.equal((await f.host.openFiles([new File([source], 'pair.jsonc'), new File([encodeState(view)], 'pair.jsonc.view.json')])).ok, true);
  assert.equal(f.host.getViewState().positions.a.x, 321);
});
test('node rename and deletion update captured IDs before any save; labels remain independent of IDs', async () => {
  const f = fixture(); await f.open();
  await f.edit({ kind: 'nodes', action: 'save', index: 0, value: { id: 'hero', label: 'Hero' } });
  assert.equal(f.host.getViewState().positions.hero.x, 321); assert.equal(f.host.getViewState().positions.a, undefined);
  await f.host.downloadView(); assert.equal(parseState(f.downloads.at(-1).text).positions.hero.source, ',');
  await f.edit({ kind: 'nodes', action: 'delete', index: 0 }); assert.equal(Object.keys(f.host.getViewState().positions).length, 0);
});
test('new view changes during a save stay dirty; concurrent saves/imports are not queued', async () => {
  const f = fixture(); await f.open(); f.change(); let release;
  f.sidecar.disk.hooks.write = () => new Promise(r => { release = r; }); const pending = f.host.saveView();
  while (!release) await new Promise(r => setImmediate(r));
  assert.equal((await f.host.saveConfig()).ok, false); assert.equal((await f.host.saveView()).ok, false);
  assert.equal((await f.host.saveViewAs(() => { throw new Error('must not pick'); })).ok, false);
  assert.equal((await f.host.openViewHandle(f.sidecar.handle)).ok, false); assert.equal((await f.host.openFiles([new File([source], 'new.jsonc')])).ok, false);
  f.host.updateView({ ...f.host.getViewState(), camera: { ...view.camera, scale: 3 } }); await f.edit(); release();
  assert.equal((await pending).dirty, true); assert.equal(parseState(f.sidecar.disk.bytes.toString()).camera.scale, 2);
  assert.equal(f.host.getViewState().camera.scale, 3); assert.equal(f.host.hasEdits(), true);
});
test('view edits supersede delayed imports, and disposal aborts a staged save', async () => {
  const f = fixture(); await f.open(); let release;
  const slow = diskFile('人物.jsonc.view.json', encodeState(view)); slow.handle.getFile = () => new Promise(r => { release = r; });
  const pending = f.host.openViewHandle(slow.handle); f.change(); release(new File([encodeState(view)], slow.handle.name));
  assert.equal((await pending).stale, true); assert.equal(f.host.getViewState().camera.scale, 2);
  f.sidecar.disk.hooks.write = () => new Promise(r => { release = r; }); const save = f.host.saveView();
  while (!f.sidecar.disk.writes) await new Promise(r => setImmediate(r)); f.host.dispose(); release();
  assert.equal((await save).ok, false); assert.equal(f.sidecar.disk.closes, 0); assert.equal(f.sidecar.disk.aborts, 1);
});
test('view API enforces active document, UTF-8 and size limits; save picker capability falls back safely', async () => {
  const f = fixture(); assert.equal((await f.host.downloadView()).ok, false); assert.equal(f.host.updateView(view).ok, false);
  await f.open(); const bad = diskFile('人物.jsonc.view.json', ''); bad.disk.bytes = Buffer.from([0xff]);
  assert.equal((await f.host.openViewHandle(bad.handle)).ok, false);
  bad.disk.bytes = Buffer.alloc(VIEW_LIMITS.text * 4 + 1); assert.equal((await f.host.openViewHandle(bad.handle)).ok, false);
  assert.equal(f.host.getViewState().positions.a.x, 321);
  const scope = { isSecureContext: true, showSaveFilePicker() {}, FileSystemFileHandle: { prototype: { createWritable() {} } } };
  assert.equal(supportsViewSaveAs(scope), true); assert.equal(supportsViewSaveAs({ ...scope, isSecureContext: false }), false);
  assert.equal(supportsViewSaveAs({ ...scope, showSaveFilePicker: undefined }), false);
});
