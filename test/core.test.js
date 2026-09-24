'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const core = require('../packages/core');
const { harness } = require('./helpers/vscode-harness');
const coreRoot = path.resolve(__dirname, '../packages/core');

// Load the real dependency graph with no Node built-ins, process, Buffer, DOM or host APIs.
function isolatedCore() {
  const context = vm.createContext({}), modules = new Map();
  const jsoncEntry = require.resolve('jsonc-parser');
  const jsoncRoot = path.dirname(jsoncEntry);
  function load(file) {
    assert.ok(file.startsWith(coreRoot + path.sep) || file.startsWith(jsoncRoot + path.sep), file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const resolve = request => {
      if (request === 'jsonc-parser') return load(jsoncEntry);
      assert.ok(request.startsWith('./') || request.startsWith('../'), `Host dependency in core: ${request}`);
      const target = path.resolve(path.dirname(file), request);
      return load(target.endsWith('.js') ? target : target + '.js');
    };
    new vm.Script('(function(require, module, exports) {\n' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file })
      .runInContext(context)(resolve, module, module.exports);
    return module.exports;
  }
  return { api: load(path.join(coreRoot, 'index.js')), context };
}
const sample = fs.readFileSync(path.join(__dirname, '../examples/characters.relations.jsonc'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

test('the shared core parses, edits and lays out real data without host APIs', () => {
  const { api, context } = isolatedCore();
  assert.equal(vm.runInContext('[typeof window, typeof document, typeof process, typeof Buffer].join() ', context), 'undefined,undefined,undefined,undefined');
  const nodeResult = core.parseConfig(sample), portableResult = api.parseConfig(sample);
  assert.deepEqual(plain(portableResult), plain(nodeResult));
  const operation = { kind: 'nodes', action: 'save', index: 0, value: { ...nodeResult.config.nodes[0], id: 'renamed', label: 'Edited' } };
  const edit = api.editConfig(sample, operation);
  assert.deepEqual(plain(edit), plain(core.editConfig(sample, operation)));
  const graph = api.parseConfig(edit.text).graph;
  const positions = { renamed: { x: 120, y: 90, source: api.graph.signature(graph.nodes[0]) } };
  const state = api.parseState(api.encodeState({ version: 1, positions, ui: { details: false } }));
  const nodes = api.graph.layout(graph, 'circle', state.positions), routes = api.graph.routes(nodes, graph.edges);
  assert.equal(nodes[0].x, 120); assert.equal(nodes[0].y, 90); assert.equal(routes.length, graph.edges.length);
  assert.ok(Number.isFinite(api.graph.bounds(nodes, routes).width));
});
test('portable view parsing keeps strict JSON, BOM, validation and size limits', () => {
  const { api } = isolatedCore();
  const special = '{"version":1,"positions":{"__proto__":{"x":12,"y":34,"source":","}},"ui":{"details":false}}';
  const parsed = api.parseState('\uFEFF' + special);
  assert.equal(parsed.positions.__proto__.x, 12); assert.equal(Object.getPrototypeOf(parsed.positions), null);
  assert.deepEqual(plain(api.parseState(api.encodeState(parsed))), plain(parsed));
  for (const text of ['{"version":1,}', '{// no comments\n"version":1}', '{"version":2}', '{"version":1,"uri":"file:///private"}', '{"version":1,"camera":{"x":0,"y":0,"scale":5}}']) assert.throws(() => api.parseState(text));
  const minimum = '{"version":1}';
  assert.equal(api.parseState(minimum.padEnd(api.VIEW_LIMITS.text, ' ')).version, 1);
  assert.throws(() => api.parseState(minimum.padEnd(api.VIEW_LIMITS.text + 1, ' ')), /200,000/);
  assert.throws(() => api.parseState(null), /JSON/);
  assert.equal(api.normalizeState({ version: 1, uri: 'obsolete' }, true).uri, undefined);
});
test('the geometry module runs as a plain script without a DOM or CommonJS loader', () => {
  const context = vm.createContext({});
  new vm.Script(fs.readFileSync(path.join(coreRoot, 'graph.js'), 'utf8')).runInContext(context);
  const graph = core.parseConfig(sample).graph;
  const nodes = context.RelationsGraph.layout(graph, 'circle');
  assert.deepEqual(plain(nodes), plain(core.graph.layout(graph, 'circle')));
  assert.equal(context.RelationsGraph.routes(nodes, graph.edges).length, graph.edges.length);
});
test('VS Code permits the shared geometry asset and loads it before the UI', async () => {
  const h = harness();
  try {
    const doc = h.document(h.Uri.parse('file:///work/shared.jsonc'), sample);
    await h.commands.get('characterRelationshipChart.open')(doc.uri);
    const webview = h.created[0].webview;
    const roots = webview.options.localResourceRoots.map(uri => uri.path);
    assert.deepEqual(roots, [path.resolve(__dirname, '../media'), coreRoot]);
    assert.match(webview.html, /packages\/core\/graph\.js/);
    assert.ok(webview.html.indexOf('packages/core/graph.js') < webview.html.indexOf('media/main.js'));
    assert.doesNotMatch(webview.html, /media\/graph\.js/);
  } finally { await h.dispose(); }
});
