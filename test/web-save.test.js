'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWebHost } = require('../web/host');
const { supportsDirectSave } = require('../web/file-access');
const { parseConfig } = require('../packages/core/config');
const source = '\uFEFF{\r\n\t// 残すコメント\r\n\t"title": "元の図",\r\n\t"groups": [{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],\r\n\t"nodes": [{"id":"a","label":"A","groups":["g1","g2"]},{"id":"b","label":"B"}],\r\n\t"edges": [{"from":"a","to":"b","label":"Link"}]\r\n}\r\n';
const namedError = name => Object.assign(new Error(name), { name });
function fixture() {
  const disk = { bytes: Buffer.from(source), reads: 0, creates: 0, writes: 0, closes: 0, aborts: 0, permissions: 0, hooks: {}, permission: 'granted' };
  const handle = {
    kind: 'file', name: '人物.jsonc',
    async getFile() { disk.reads++; await disk.hooks.read?.(disk.reads); return new File([disk.bytes], this.name, { lastModified: 1 }); },
    async requestPermission(options) { assert.deepEqual(options, { mode: 'readwrite' }); disk.permissions++; await disk.hooks.permission?.(); return disk.permission; },
    async createWritable(options) {
      assert.deepEqual(options, { keepExistingData: false, mode: 'exclusive' }); disk.creates++; await disk.hooks.create?.(); let pending;
      return {
        async write(bytes) { disk.writes++; pending = Buffer.from(bytes); await disk.hooks.write?.(); },
        async close() { disk.closes++; await disk.hooks.close?.(); disk.bytes = pending; await disk.hooks.afterClose?.(); },
        async abort() { disk.aborts++; pending = null; await disk.hooks.abort?.(); }
      };
    }
  };
  const configs = [], downloads = [], states = [];
  const f = { disk, handle, configs, downloads, states, confirm: true };
  f.host = createWebHost({ readText: file => file.text(), confirmReplace: () => f.confirm,
    downloadText: (text, name) => downloads.push({ text, name }) });
  f.host.onConfig(c => configs.push(c)); f.host.onSaveState(s => states.push(s));
  f.open = () => f.host.openHandle(handle);
  f.edit = async (operation = { kind: 'general', action: 'save', value: { title: '編集結果' } }) => {
    const result = await f.host.editConfig(operation, configs.at(-1).documentVersion); assert.equal(result.ok, true, result.message);
  };
  return f;
}
test('direct save verifies exact UTF-8 bytes, preserves JSONC and advances the baseline only on success', async () => {
  const f = fixture(); assert.equal((await f.open()).ok, true);
  assert.equal(f.disk.permissions, 0, 'opening never asks for write access');
  await f.edit(); const version = f.configs.at(-1).documentVersion;
  await f.edit({ kind: 'nodes', action: 'save', index: 0, value: { id: 'hero', label: '主人公', groups: ['g1', 'g2'] } });
  await f.edit({ kind: 'groups', action: 'save', index: 0, value: { id: 'crew', label: '仲間' } });
  await f.edit({ kind: 'edges', action: 'save', index: 0, value: { from: 'hero', to: 'b', label: '信頼', shape: 'curved' } });
  const currentVersion = f.configs.at(-1).documentVersion; assert.ok(currentVersion > version);
  assert.equal((await f.host.saveConfig()).ok, true); assert.equal(f.host.hasEdits(), false);
  assert.equal(f.configs.at(-1).documentVersion, currentVersion);
  const saved = f.disk.bytes.toString('utf8'), parsed = parseConfig(saved);
  assert.equal(parsed.issues.length, 0); assert.equal(parsed.config.title, '編集結果');
  assert.deepEqual(parsed.config.nodes[0].groups, ['crew', 'g2']); assert.equal(parsed.config.edges[0].from, 'hero');
  assert.equal(parsed.config.edges[0].label, '信頼'); assert.equal(parsed.config.edges[0].shape, 'curved');
  assert.ok(saved.startsWith('\uFEFF')); assert.match(saved, /\t\/\/ 残すコメント\r\n/);
  assert.equal(saved.replace(/\r\n/g, '').includes('\n'), false);
  await f.edit(); assert.equal((await f.host.saveConfig()).ok, true, 'a second save uses the new baseline');
  assert.equal(f.disk.closes, 2); assert.equal((await f.open()).ok, true);
  assert.deepEqual(f.configs.at(-1).config, parseConfig(f.disk.bytes.toString()).config);
});
test('external changes including same-size comments and BOM-only changes stop before writing', async () => {
  for (const external of [source.replace('One', 'Two'), source.replace('残す', '変え'), source.slice(1), source + ' ']) {
    const f = fixture(); await f.open(); await f.edit(); f.disk.bytes = Buffer.from(external);
    const before = f.configs.at(-1); const result = await f.host.saveConfig();
    assert.equal(result.status, 'conflict'); assert.equal(f.disk.bytes.toString(), external);
    assert.equal(f.disk.creates, 0); assert.equal(f.host.hasEdits(), true); assert.equal(f.configs.at(-1), before);
    assert.equal(f.host.getSaveState().blocked, true);
    await f.host.downloadConfig(); assert.equal(parseConfig(f.downloads[0].text).config.title, '編集結果');
    assert.equal((await f.host.saveConfig()).status, 'blocked'); assert.equal(f.disk.permissions, 1);
  }
});
test('external edits during stream creation or staging abort without closing or overwriting', async () => {
  for (const phase of ['create', 'write']) {
    const f = fixture(); await f.open(); await f.edit();
    const external = source + '// external'; f.disk.hooks[phase] = () => { f.disk.bytes = Buffer.from(external); };
    assert.equal((await f.host.saveConfig()).status, 'conflict');
    assert.equal(f.disk.closes, 0); assert.equal(f.disk.aborts, 1); assert.equal(f.disk.bytes.toString(), external);
    assert.equal(f.host.hasEdits(), true);
  }
});
test('denied permission does not create a stream and explicit retry preserves the edit', async () => {
  const f = fixture(); await f.open(); await f.edit(); f.disk.permission = 'denied';
  assert.equal((await f.host.saveConfig()).status, 'denied'); assert.equal(f.disk.creates, 0);
  assert.equal(f.disk.bytes.toString(), source); assert.equal(f.host.hasEdits(), true);
  await f.host.downloadConfig(); assert.equal(f.host.hasEdits(), true);
  f.disk.permission = 'granted'; assert.equal((await f.host.saveConfig()).ok, true);
});
for (const phase of ['permission', 'create', 'write', 'close']) test(`${phase} failure retains valid config and source, and never retries itself`, async () => {
  const f = fixture(); await f.open(); await f.edit(); const before = f.configs.at(-1);
  f.disk.hooks[phase] = () => { throw namedError('NotAllowedError'); };
  const result = await f.host.saveConfig(); assert.equal(result.ok, false);
  assert.equal(f.disk.bytes.toString(), source); assert.equal(f.host.hasEdits(), true); assert.equal(f.configs.at(-1), before);
  assert.equal(f.disk.permissions, 1); assert.equal(f.host.getSaveState().saving, false);
  assert.equal(f.disk.aborts, ['write', 'close'].includes(phase) ? 1 : 0);
  await f.host.downloadConfig(); assert.match(f.downloads[0].text, /編集結果/);
});
test('read failure at every precommit checkpoint stops and aborts staged data', async () => {
  for (const read of [2, 3, 4]) {
    const f = fixture(); await f.open(); await f.edit();
    f.disk.hooks.read = n => { if (n === read) throw namedError('NotReadableError'); };
    assert.equal((await f.host.saveConfig()).ok, false); assert.equal(f.disk.closes, 0);
    assert.equal(f.disk.bytes.toString(), source); assert.equal(f.host.hasEdits(), true);
    assert.equal(f.disk.aborts, read === 2 ? 0 : 1);
  }
});
test('unverified commit and failed abort block further direct saves until reopened', async () => {
  for (const fault of ['readback', 'mismatch', 'close-after-commit', 'abort']) {
    const f = fixture(); await f.open(); await f.edit();
    if (fault === 'readback') f.disk.hooks.read = n => { if (n === 5) throw new Error('readback failed'); };
    if (fault === 'mismatch') f.disk.hooks.afterClose = () => { f.disk.bytes = Buffer.from(source + ' '); };
    if (fault === 'close-after-commit') f.disk.hooks.afterClose = () => { throw new Error('completion unknown'); };
    if (fault === 'abort') { f.disk.hooks.write = () => { throw new Error('write failed'); }; f.disk.hooks.abort = () => { throw new Error('abort failed'); }; }
    const before = f.configs.at(-1);
    assert.equal((await f.host.saveConfig()).status, 'uncertain'); assert.equal(f.configs.at(-1), before);
    assert.equal(f.host.hasEdits(), true); assert.equal(f.host.getSaveState().blocked, true);
    await f.host.downloadConfig(); assert.match(f.downloads[0].text, /編集結果/);
    const attempts = f.disk.permissions; assert.equal((await f.host.saveConfig()).ok, false); assert.equal(f.disk.permissions, attempts);
    f.disk.hooks = {}; assert.equal((await f.open()).ok, true); assert.equal(f.host.getSaveState().blocked, false);
  }
});
test('concurrent edit stays dirty, double-save and document replacement are not queued', async () => {
  const f = fixture(); await f.open(); await f.edit();
  let release; const held = new Promise(r => { release = r; }); f.disk.hooks.write = () => held;
  const pending = f.host.saveConfig();
  while (!f.disk.writes) await new Promise(r => setImmediate(r));
  assert.equal((await f.host.saveConfig()).ok, false);
  assert.equal((await f.host.openFiles([new File([source], 'other.jsonc')])).ok, false);
  await f.edit({ kind: 'general', action: 'save', value: { title: '保存待ち中の編集' } });
  release(); assert.equal((await pending).dirty, true); assert.equal(f.disk.closes, 1);
  assert.equal(parseConfig(f.disk.bytes.toString()).config.title, '編集結果');
  assert.equal(f.host.hasEdits(), true); assert.equal(f.configs.at(-1).config.title, '保存待ち中の編集');
  f.disk.hooks = {}; assert.equal((await f.host.saveConfig()).ok, true); assert.equal(f.host.hasEdits(), false);
});
test('cancelled or failed replacement and view-only reading retain the original handle and baseline', async () => {
  const f = fixture(); await f.open(); await f.edit(); f.confirm = false;
  assert.equal((await f.host.openFiles([new File([source], 'other.jsonc')])).cancelled, true);
  assert.equal((await f.host.openHandle({ getFile() { throw new Error('missing file'); } })).ok, false);
  assert.equal((await f.host.openFiles([new File(['{"version":1}'], f.handle.name + '.view.json')])).ok, true);
  assert.equal((await f.host.saveConfig()).ok, true); assert.equal(f.disk.closes, 1);
  f.confirm = true; await f.host.openFiles([new File([source], 'other.jsonc')]);
  assert.equal(f.host.getSaveState().available, false); assert.equal((await f.host.saveConfig()).ok, false);
  await f.edit(); await f.host.downloadConfig(); assert.equal(f.host.hasEdits(), true);
});
test('delayed handle reads cannot replace newer edits or files', async () => {
  const f = fixture(); await f.open(); let release;
  const handle = { getFile: () => new Promise(r => { release = r; }) };
  const pending = f.host.openHandle(handle); await f.edit(); release(new File([source], 'late.jsonc'));
  assert.equal((await pending).stale, true); assert.equal(f.configs.at(-1).fileName, f.handle.name);
  assert.equal((await f.host.saveConfig()).ok, true);
});
test('disposing a pending save aborts staging and emits no later updates', async () => {
  const f = fixture(); await f.open(); await f.edit(); let release;
  f.disk.hooks.write = () => new Promise(r => { release = r; }); const pending = f.host.saveConfig();
  while (!release) await new Promise(r => setImmediate(r));
  f.host.dispose(); const count = f.configs.length; release();
  assert.equal((await pending).ok, false); assert.equal(f.configs.length, count);
  assert.equal(f.disk.closes, 0); assert.equal(f.disk.aborts, 1); assert.equal(f.disk.bytes.toString(), source);
});
test('direct opening rejects invalid UTF-8 without losing the prior document', async () => {
  const f = fixture(); await f.open(); await f.edit(); f.disk.bytes = Buffer.from([0xff, 0xfe]);
  assert.equal((await f.open()).ok, false); assert.equal(f.host.hasEdits(), true);
  await f.host.downloadConfig(); assert.match(f.downloads[0].text, /編集結果/);
});
test('capability detection keeps unsupported/insecure browsers on the download path', () => {
  const scope = { isSecureContext: true, showOpenFilePicker() {}, FileSystemFileHandle: class { createWritable() {} } };
  assert.equal(supportsDirectSave(scope), true);
  for (const changed of [{ isSecureContext: false }, { showOpenFilePicker: undefined }, { FileSystemFileHandle: undefined }]) assert.equal(supportsDirectSave({ ...scope, ...changed }), false);
});
