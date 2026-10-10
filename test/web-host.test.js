'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWebHost } = require('../web/host');
const { parseConfig, LIMITS } = require('../packages/core/config');
const { VIEW_LIMITS } = require('../packages/core/view-state');
const source = '{ // comment\n"nodes":[{"id":"a","label":"A"}],"edges":[]}';
const file = (name, text) => ({ name, text, size: Buffer.byteLength(text) });
function fixture(readText = f => Promise.resolve(f.text), options = {}) {
  const downloads = [], host = createWebHost({ readText, downloadText: (text, fileName) => downloads.push({ text, fileName }), ...options }), configs = [], views = [];
  host.onConfig(value => configs.push(value)); host.onView(value => views.push(value)); host.ready();
  return { host, configs, views, downloads };
}
test('Web host reads shared JSONC and exposes memory editing and explicit view capture', async () => {
  const f = fixture(), input = file('任意名.jsonc', '\uFEFF' + source), original = { ...input };
  const result = await f.host.openFiles([input]);
  assert.equal(result.ok, true); assert.equal(result.fileName, input.name);
  assert.deepEqual(f.configs[0].graph, parseConfig(input.text).graph);
  assert.equal(f.views[0].reset, true); assert.deepEqual(input, original);
  for (const key of ['reloadView', 'openSource', 'openView']) assert.equal(f.host[key], undefined);
  assert.equal(typeof f.host.updateView, 'function'); assert.equal(typeof f.host.saveView, 'function');
  assert.deepEqual(f.host.capabilities, { edit: true, persistEdits: false, viewStorage: false, viewCapture: true, openSource: false, exportSvg: true });
});
test('Web source and matching view are validated atomically; invalid data retains the current document', async () => {
  const f = fixture(); await f.host.openFiles([file('old.jsonc', source)]);
  const next = file('new.jsonc', source.replace('"A"', '"New"'));
  assert.equal((await f.host.openFiles([next, file('new.jsonc.view.json', '{broken')])).ok, false);
  assert.equal(f.views.length, 1);
  const view = file('old.jsonc.view.json', '{"version":1,"positions":{"a":{"x":321,"y":123,"source":","}}}');
  assert.equal((await f.host.openFiles([view])).ok, true);
  assert.equal(f.configs.at(-1).fileName, 'old.jsonc'); assert.equal(f.views.at(-1).reset, false);
  assert.equal(f.views.at(-1).viewState.positions.a.x, 321);
  assert.equal((await f.host.openFiles([next, file('new.jsonc.view.json', '{"version":1}')])).ok, true);
  assert.equal(f.configs.at(-1).graph.nodes[0].label, 'New');
});
test('Web rejects ambiguous, unsupported and mismatched input without reading sibling files', async () => {
  let reads = 0; const f = fixture(v => { reads++; return v.text; });
  for (const inputs of [[], [file('a.view.json', '{}')], [file('a.txt', source)], [file('a.json', source), file('b.json', source)], [file('a.json', source), file('b.json.view.json', '{}')], Array(3).fill(file('a.json', source))]) {
    assert.equal((await f.host.openFiles(inputs)).ok, false);
  }
  assert.equal(reads, 0); assert.equal(f.views.length, 0);
});
test('Web enforces byte and core character limits and reports JSONC line numbers', async () => {
  let reads = 0; const f = fixture(v => { reads++; return v.text; });
  assert.equal((await f.host.openFiles([{ name: 'huge.jsonc', size: LIMITS.text * 4 + 1 }])).ok, false);
  assert.equal(reads, 0);
  await f.host.openFiles([file('long.jsonc', source.padEnd(LIMITS.text + 1, ' '))]); assert.equal(f.configs.at(-1).graph, undefined);
  await f.host.openFiles([file('bad.jsonc', '{\n"nodes": [\nINVALID\n]}')]); assert.equal(f.configs.at(-1).issues[0].line, 3);
  await f.host.openFiles([file('a.jsonc', source)]);
  const view = file('a.jsonc.view.json', '{"version":1}'.padEnd(VIEW_LIMITS.text + 1, ' '));
  assert.equal((await f.host.openFiles([view])).ok, false);
  assert.match(f.configs.at(-1).issues[0].message, /200,000/);
});
test('the latest Web read wins even when older reads resolve or fail later', async () => {
  const pending = new Map(), f = fixture(v => new Promise((resolve, reject) => pending.set(v.name, { resolve, reject })));
  const first = f.host.openFiles([file('slow.jsonc', source)]);
  const second = f.host.openFiles([file('new.jsonc', source)]);
  pending.get('new.jsonc').resolve(source); assert.equal((await second).ok, true);
  pending.get('slow.jsonc').reject(new Error('old failure')); assert.equal((await first).stale, true);
  assert.equal(f.configs.length, 1); assert.equal(f.configs[0].fileName, 'new.jsonc');
  const third = f.host.openFiles([file('later.jsonc', source)]);
  await f.host.openFiles([file('wrong.txt', source)]);
  pending.get('later.jsonc').resolve(source); assert.equal((await third).stale, true);
  assert.equal(f.views.length, 1);
});
test('Web read errors preserve the last valid chart and rereading the same file works', async () => {
  let fail = false; const f = fixture(v => fail ? Promise.reject(new Error('read denied')) : v.text);
  const input = file('a.jsonc', source); await f.host.openFiles([input]);
  fail = true; assert.equal((await f.host.openFiles([input])).ok, false);
  assert.equal(f.views.length, 1); assert.match(f.configs.at(-1).issues[0].message, /read denied/);
  fail = false; input.text = source.replace('"A"', '"Updated"');
  assert.equal((await f.host.openFiles([input])).ok, true); assert.equal(f.configs.at(-1).graph.nodes[0].label, 'Updated');
});
test('Web subscriptions can be removed and disposal ignores pending reads', async () => {
  let resolve; const f = fixture(() => new Promise(r => { resolve = r; }));
  let called = 0; const remove = f.host.onConfig(() => called++); remove();
  const pending = f.host.openFiles([file('a.jsonc', source)]); f.host.dispose(); resolve(source);
  assert.equal((await pending).stale, true); assert.equal(called, 0); assert.equal(f.configs.length, 0);
  assert.equal((await f.host.openFiles([file('a.jsonc', source)])).stale, true);
});

const editable = '\uFEFF{\r\n\t// keep header\r\n\t"title": "Original",\r\n\t"groups": [{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],\r\n\t"nodes": [\r\n\t\t{"id":"a","label":"A","groups":["g1","g2"]},\r\n\t\t/* keep neighbor */ {"id":"b", "label":"B"}\r\n\t],\r\n\t"edges": [{"from":"a","to":"b","label":"Link"}]\r\n}\r\n';
async function apply(f, operation) {
  const result = await f.host.editConfig(operation, f.configs.at(-1).documentVersion);
  assert.equal(result.ok, true, result.message); return result;
}
test('Web editing uses core semantics for every entity, memberships, references and deletion', async () => {
  const f = fixture(), input = file('人物.jsonc', editable); await f.host.openFiles([input]);
  await apply(f, { kind: 'general', action: 'save', value: { title: '新しい図', description: '説明', layout: 'circle' } });
  await apply(f, { kind: 'nodes', action: 'save', index: 0, value: { id: 'hero', label: 'Hero', groups: ['g1', 'g2'] } });
  assert.deepEqual(f.configs.at(-1).rename, { kind: 'nodes', from: 'a', to: 'hero' });
  assert.equal(f.configs.at(-1).config.edges[0].from, 'hero');
  await apply(f, { kind: 'groups', action: 'save', index: 0, value: { id: 'renamed', label: 'Renamed' } });
  assert.deepEqual(f.configs.at(-1).config.nodes[0].groups, ['renamed', 'g2']);
  await apply(f, { kind: 'groups', action: 'add', value: { id: 'g3', label: 'Three' } });
  await apply(f, { kind: 'nodes', action: 'add', value: { id: 'c', label: 'C', groups: ['g2', 'g3'] } });
  await apply(f, { kind: 'edges', action: 'add', value: { from: 'c', to: 'hero', label: 'New' } });
  await apply(f, { kind: 'edges', action: 'save', index: 1, value: { from: 'c', to: 'hero', label: 'Changed', shape: 'curved' } });
  assert.equal(f.configs.at(-1).config.edges[1].shape, 'curved');
  await apply(f, { kind: 'edges', action: 'delete', index: 1 });
  await apply(f, { kind: 'nodes', action: 'delete', index: 0 });
  assert.deepEqual(f.configs.at(-1).config.edges, []);
  await apply(f, { kind: 'groups', action: 'delete', index: 2 });
  assert.deepEqual(f.configs.at(-1).config.nodes[1].groups, ['g2']);
  await apply(f, { kind: 'general', action: 'save', value: { layout: 'auto' } });
  assert.equal(f.configs.at(-1).config.title, undefined);
  assert.equal(input.text, editable); assert.equal(f.host.hasEdits(), true);
});
test('downloads retain UTF-8 text, BOM, CRLF, tabs and untouched comments and can be reloaded', async () => {
  for (const name of ['人物.jsonc', '人物.json']) {
    const f = fixture(); await f.host.openFiles([file(name, editable)]);
    await apply(f, { kind: 'general', action: 'save', value: { title: '日本語のタイトル' } });
    assert.equal((await f.host.downloadConfig()).ok, true);
    const out = f.downloads[0]; assert.equal(out.fileName, name);
    assert.ok(out.text.startsWith('\uFEFF')); assert.match(out.text, /\t\/\/ keep header\r\n/);
    assert.match(out.text, /\t\t\/\* keep neighbor \*\/ \{"id":"b", "label":"B"\}/);
    assert.equal(out.text.replace(/\r\n/g, '').includes('\n'), false);
    const config = f.configs.at(-1).config, reloaded = fixture();
    await reloaded.host.openFiles([file(out.fileName, out.text)]);
    assert.deepEqual(reloaded.configs.at(-1).config, config);
    assert.equal(f.host.hasEdits(), true, 'a requested download cannot prove the user saved it');
  }
});
test('invalid edits and download failures retain the valid document and allow retries', async () => {
  let denied = true; const captured = [], f = fixture(undefined, { downloadText: (text, name) => { if (denied) throw new Error('generation denied'); captured.push({ text, name }); } });
  await f.host.openFiles([file('retry.jsonc', editable)]);
  const before = f.configs.at(-1), count = f.configs.length;
  for (const operation of [
    { kind: 'nodes', action: 'save', index: 0, value: { id: 'b', label: 'Duplicate' } },
    { kind: 'edges', action: 'add', value: { from: 'missing', to: 'b' } },
    { kind: 'general', action: 'save', value: { description: 'x'.repeat(100001) } }
  ]) assert.equal((await f.host.editConfig(operation, before.documentVersion)).ok, false);
  assert.equal(f.configs.length, count); assert.equal(f.host.hasEdits(), false);
  await apply(f, { kind: 'general', action: 'save', value: { title: 'Keep this' } });
  const valid = f.configs.at(-1);
  assert.match((await f.host.downloadConfig()).message, /generation denied/);
  assert.equal(f.configs.at(-1), valid);
  denied = false; assert.equal((await f.host.downloadConfig()).ok, true);
  assert.equal(parseConfig(captured[0].text).config.title, 'Keep this');
});
test('a failed import leaves current edits usable and sidecar import does not reset them', async () => {
  const f = fixture(); await f.host.openFiles([file('cast.jsonc', source)]);
  await apply(f, { kind: 'general', action: 'save', value: { title: 'Edited' } });
  const version = f.configs.at(-1).documentVersion;
  await f.host.openFiles([file('invalid.jsonc', '{broken')]);
  assert.equal(f.configs.at(-1).documentVersion, version); assert.equal(f.configs.at(-1).config.title, 'Edited');
  await f.host.openFiles([file('cast.jsonc.view.json', '{"version":1}')]);
  assert.equal(f.configs.at(-1).documentVersion, version); assert.equal(f.host.hasEdits(), true);
  await apply(f, { kind: 'general', action: 'save', value: { title: 'Retry' } });
  await f.host.downloadConfig(); assert.equal(parseConfig(f.downloads[0].text).config.title, 'Retry');
});
test('edits supersede a slow import and stale form versions cannot alter a newer document', async () => {
  let resolve; const f = fixture(input => input.name === 'slow.jsonc' ? new Promise(r => { resolve = r; }) : input.text);
  await f.host.openFiles([file('cast.jsonc', source)]); const oldVersion = f.configs.at(-1).documentVersion;
  const pending = f.host.openFiles([file('slow.jsonc', source)]);
  await apply(f, { kind: 'general', action: 'save', value: { title: 'Newest edit' } });
  resolve(source); assert.equal((await pending).stale, true);
  assert.equal((await f.host.editConfig({ kind: 'nodes', action: 'delete', index: 0 }, oldVersion)).ok, false);
  assert.equal(f.configs.at(-1).config.title, 'Newest edit');
});
test('replacement confirmation occurs after validation and cancellation retains the document', async () => {
  let allow = false, asked = 0; const f = fixture(undefined, { confirmReplace: () => { asked++; return allow; } });
  await f.host.openFiles([file('cast.jsonc', source)]);
  await apply(f, { kind: 'general', action: 'save', value: { title: 'Retained' } });
  await f.host.openFiles([file('broken.jsonc', '{broken')]); assert.equal(asked, 0);
  assert.equal((await f.host.openFiles([file('new.jsonc', source)])).cancelled, true);
  assert.equal(f.host.hasEdits(), true); await f.host.downloadConfig();
  assert.equal(f.downloads[0].fileName, 'cast.jsonc');
  assert.equal(parseConfig(f.downloads[0].text).config.title, 'Retained');
  allow = true; assert.equal((await f.host.openFiles([file('new.jsonc', source)])).ok, true);
  assert.equal(f.configs.at(-1).reset, true); assert.equal(f.host.hasEdits(), false);
});
test('editing and downloading require an active document', async () => {
  const f = fixture();
  assert.equal((await f.host.editConfig({}, 0)).ok, false); assert.equal((await f.host.downloadConfig()).ok, false);
  await f.host.openFiles([file('cast.jsonc', source)]); f.host.dispose();
  assert.equal((await f.host.editConfig({}, 1)).ok, false); assert.equal((await f.host.downloadConfig()).ok, false);
  assert.deepEqual(f.downloads, []);
});
