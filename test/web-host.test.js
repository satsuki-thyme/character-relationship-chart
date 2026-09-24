'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createWebHost } = require('../web/host');
const { parseConfig, LIMITS } = require('../packages/core/config');
const { VIEW_LIMITS } = require('../packages/core/view-state');
const source = '{ // comment\n"nodes":[{"id":"a","label":"A"}],"edges":[]}';
const file = (name, text) => ({ name, text, size: Buffer.byteLength(text) });
function fixture(readText = f => Promise.resolve(f.text)) {
  const host = createWebHost({ readText }), configs = [], views = [];
  host.onConfig(value => configs.push(value)); host.onView(value => views.push(value)); host.ready();
  return { host, configs, views };
}
test('Web host reads the shared JSONC format and exposes no mutation operations', async () => {
  const f = fixture(), input = file('任意名.jsonc', '\uFEFF' + source), original = { ...input };
  const result = await f.host.openFiles([input]);
  assert.equal(result.ok, true); assert.equal(result.fileName, input.name);
  assert.deepEqual(f.configs[0].graph, parseConfig(input.text).graph);
  assert.equal(f.views[0].reset, true); assert.deepEqual(input, original);
  for (const key of ['editConfig', 'updateView', 'saveView', 'reloadView', 'exportSvg', 'openSource', 'openView']) assert.equal(f.host[key], undefined);
  assert.deepEqual(Object.values(f.host.capabilities), [false, false, false, false]);
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
