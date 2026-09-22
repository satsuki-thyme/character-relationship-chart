'use strict';
const jsonc = require('jsonc-parser');

const PALETTE = ['#55b8ad', '#c29de8', '#e4b66a', '#78aee8', '#e797b0', '#92bb74'];
const LIMITS = { nodes: 200, edges: 1000, groups: 50, text: 2 * 1024 * 1024 };
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseConfig(text) {
  const issues = [];
  const fail = (message, path = [], offset, length) => {
    const node = tree && jsonc.findNodeAtLocation(tree, path);
    issues.push({ message, offset: offset ?? node?.offset ?? 0, length: Math.max(1, length ?? node?.length ?? 1) });
  };
  let tree;
  if (text.length > LIMITS.text) return { issues: [{ message: '設定ファイルは2 Mi文字以内にしてください。', offset: 0, length: 1 }] };
  const errors = [];
  const input = text.charCodeAt(0) === 0xfeff ? ' ' + text.slice(1) : text;
  tree = jsonc.parseTree(input, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) return { issues: errors.slice(0, 30).map(e => ({
    message: `JSONの書式に誤りがあります（${jsonc.printParseErrorCode(e.error)}）。`, offset: e.offset, length: Math.max(e.length, 1)
  })) };
  if (!tree || tree.type !== 'object') {
    fail('設定全体を { } で囲んだオブジェクトにしてください。');
    return { issues };
  }
  // Duplicate keys are almost always an editing mistake; JSON.parse alone misses them.
  function duplicateKeys(node) {
    if (node.type === 'object') {
      const keys = new Set();
      for (const property of node.children || []) {
        const key = property.children[0];
        if (keys.has(key.value)) fail(`「${key.value}」が同じオブジェクト内で重複しています。`, [], key.offset, key.length);
        keys.add(key.value);
      }
    }
    for (const child of node.children || []) duplicateKeys(child);
  }
  duplicateKeys(tree);
  const data = jsonc.getNodeValue(tree);
  const object = (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { fail('オブジェクトを指定してください。', path); return false; }
    return true;
  };
  const fields = (value, allowed, path) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`未対応の項目「${key}」があります。`, [...path, key]);
  };
  const string = (value, path, required = false, max = 200) => {
    if (value === undefined && !required) return;
    if (typeof value !== 'string' || (required && !value.trim()) || (typeof value === 'string' && value.length > max)) {
      fail(`${required ? '空でない' : ''}文字列（${max}文字以内）を指定してください。`, path);
    }
  };
  const color = (value, path) => {
    if (value !== undefined && (typeof value !== 'string' || !COLOR.test(value))) fail('色は #55b8ad または #abc の形式で指定してください。', path);
  };
  const option = (value, choices, path) => {
    if (value !== undefined && !choices.includes(value)) fail(`${choices.join(' / ')} のいずれかを指定してください。`, path);
  };
  const array = (value, path, max, required) => {
    if (value === undefined && !required) return [];
    if (!Array.isArray(value)) { fail('配列 [ ] を指定してください。', path); return []; }
    if (value.length > max) fail(`要素数を${max}個以下にしてください。`, path);
    return value.slice(0, max);
  };
  fields(data, ['$schema', 'version', 'title', 'description', 'layout', 'groups', 'nodes', 'edges'], []);
  string(data.$schema, ['$schema'], false, 2000);
  if (data.version !== undefined && data.version !== 1) fail('version は 1 を指定してください。', ['version']);
  string(data.title, ['title']); string(data.description, ['description'], false, 4000);
  option(data.layout, ['auto', 'circle'], ['layout']);
  const groups = array(data.groups, ['groups'], LIMITS.groups, false);
  const nodes = array(data.nodes, ['nodes'], LIMITS.nodes, true);
  const edges = array(data.edges, ['edges'], LIMITS.edges, true);
  const groupIds = new Set(), nodeIds = new Set();
  groups.forEach((g, i) => {
    const p = ['groups', i]; if (!object(g, p)) return;
    fields(g, ['id', 'label', 'color'], p);
    string(g.id, [...p, 'id'], true, 100); string(g.label, [...p, 'label'], true);
    color(g.color, [...p, 'color']);
    if (groupIds.has(g.id)) fail(`グループID「${g.id}」が重複しています。`, [...p, 'id']);
    groupIds.add(g.id);
  });
  nodes.forEach((n, i) => {
    const p = ['nodes', i]; if (!object(n, p)) return;
    fields(n, ['id', 'label', 'group', 'groups', 'description', 'color', 'x', 'y'], p);
    string(n.id, [...p, 'id'], true, 100); string(n.label, [...p, 'label'], true);
    string(n.group, [...p, 'group'], false, 100); string(n.description, [...p, 'description'], false, 4000);
    color(n.color, [...p, 'color']);
    if (nodeIds.has(n.id)) fail(`人物・項目ID「${n.id}」が重複しています。`, [...p, 'id']);
    nodeIds.add(n.id);
    if (n.group !== undefined && n.groups !== undefined) fail('group と groups はどちらか一方だけ指定してください。', p);
    const memberships = array(n.groups, [...p, 'groups'], LIMITS.groups, false);
    const seenGroups = new Set();
    memberships.forEach((id, j) => {
      const location = [...p, 'groups', j]; string(id, location, true, 100);
      if (!groupIds.has(id)) fail(`グループ「${id}」が groups にありません。`, location);
      if (seenGroups.has(id)) fail(`所属グループ「${id}」が重複しています。`, location);
      seenGroups.add(id);
    });
    if (n.group !== undefined && !groupIds.has(n.group)) fail(`グループ「${n.group}」が groups にありません。`, [...p, 'group']);
    if ((n.x === undefined) !== (n.y === undefined)) fail('固定位置には x と y の両方が必要です。', p);
    for (const axis of ['x', 'y']) if (n[axis] !== undefined && (typeof n[axis] !== 'number' || !Number.isFinite(n[axis]) || Math.abs(n[axis]) > 20000)) {
      fail('座標は -20000〜20000 の数値で指定してください。', [...p, axis]);
    }
  });
  const sets = new Map(), setShapes = new Map();
  edges.forEach((e, i) => {
    const p = ['edges', i]; if (!object(e, p)) return;
    fields(e, ['from', 'to', 'label', 'description', 'color', 'arrow', 'style', 'setId', 'shape'], p);
    for (const end of ['from', 'to']) {
      string(e[end], [...p, end], true, 100);
      if (typeof e[end] === 'string' && !nodeIds.has(e[end])) fail(`人物・項目「${e[end]}」が nodes にありません。`, [...p, end]);
    }
    if (e.setId !== undefined) {
      string(e.setId, [...p, 'setId'], true, 100);
      const pair = JSON.stringify([e.from, e.to].sort());
      if (sets.has(e.setId) && sets.get(e.setId) !== pair) fail('同じ setId は同じ2つの人物・項目を結ぶ線に指定してください。', [...p, 'setId']);
      sets.set(e.setId, pair);
      if (e.shape && e.shape !== 'auto') {
        if (setShapes.has(e.setId) && setShapes.get(e.setId) !== e.shape) fail('同じ setId の線には同じ shape を指定してください。', [...p, 'shape']);
        setShapes.set(e.setId, e.shape);
      }
      if (e.from === e.to) fail('setId は異なる2つの人物・項目を結ぶ線に指定してください。', [...p, 'setId']);
    }
    string(e.label, [...p, 'label']); string(e.description, [...p, 'description'], false, 4000);
    color(e.color, [...p, 'color']);
    option(e.arrow, ['forward', 'both', 'none'], [...p, 'arrow']);
    option(e.style, ['solid', 'dashed', 'dotted'], [...p, 'style']);
    option(e.shape, ['auto', 'straight', 'curved'], [...p, 'shape']);
    if (e.from === e.to && e.shape === 'straight') fail('自分自身を結ぶ線は auto または curved にしてください。', [...p, 'shape']);
  });
  if (issues.length) return { issues: issues.slice(0, 30) };
  const normalizedGroups = groups.map((g, i) => ({ ...g, color: g.color || PALETTE[i % PALETTE.length] }));
  const groupMap = new Map(normalizedGroups.map(g => [g.id, g]));
  return { issues: [], config: data, graph: {
    title: data.title || '相関図', description: data.description || '', layout: data.layout || 'auto',
    groups: normalizedGroups,
    nodes: nodes.map(n => {
      const memberships = n.groups || (n.group !== undefined ? [n.group] : []);
      return { ...n, groups: memberships, description: n.description || '', color: n.color || groupMap.get(memberships[0])?.color || PALETTE[0] };
    }),
    edges: edges.map((e, i) => ({ ...e, index: i, label: e.label || '', description: e.description || '', arrow: e.arrow || 'forward', style: e.style || 'solid', shape: (e.setId && setShapes.get(e.setId)) || e.shape || 'auto' }))
  } };
}
module.exports = { parseConfig, LIMITS };
