'use strict';
const jsonc = require('jsonc-parser');
const { parseConfig } = require('./config');
const fields = {
  general: ['title', 'description', 'layout'],
  nodes: ['id', 'label', 'group', 'groups', 'description', 'color', 'x', 'y'],
  groups: ['id', 'label', 'color'],
  edges: ['from', 'to', 'label', 'description', 'color', 'arrow', 'style', 'setId', 'shape']
};
function editConfig(text, operation) {
  const parsed = parseConfig(text);
  if (!parsed.config) throw new Error('設定にエラーがあります。設定ファイルを修正してから編集してください。');
  const { kind, action, index, value } = operation || {};
  if (!Object.hasOwn(fields, kind) || !['save', 'add', 'delete'].includes(action) || (kind === 'general' && action !== 'save')) throw new Error('未対応の編集操作です。');
  const data = parsed.config, list = data[kind] || [];
  if (kind !== 'general' && action !== 'add' && (!Number.isInteger(index) || index < 0 || index >= list.length)) throw new Error('編集対象が見つかりません。設定を再読込してください。');
  if (action !== 'delete' && (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !fields[kind].includes(k)))) throw new Error('編集する項目が不正です。');
  // Apply each change against the preceding text; unchanged comments and properties stay intact.
  const indent = text.match(/\n([\t ]+)"/), eol = text.includes('\r\n') ? '\r\n' : '\n';
  const options = { formattingOptions: { insertSpaces: !indent?.[1].includes('\t'), tabSize: indent?.[1].length || 2, eol } };
  const set = (p, v) => { text = jsonc.applyEdits(text, jsonc.modify(text, p, v, options)); };
  const patch = (path, before, after) => {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) set([...path, key], after[key]);
    }
  };
  let rename;
  if (kind === 'general') {
    for (const key of fields.general) if (JSON.stringify(data[key]) !== JSON.stringify(value[key])) set([key], value[key]);
  } else if (action === 'add') {
    if (!data[kind]) set([kind], []);
    set([kind, -1], value);
  } else if (action === 'save') {
    const old = list[index]; patch([kind, index], old, value);
    if ((kind === 'nodes' || kind === 'groups') && old.id !== value.id) {
      rename = { kind, from: old.id, to: value.id };
      if (kind === 'nodes') data.edges.forEach((e, i) => { for (const end of ['from', 'to']) if (e[end] === old.id) set(['edges', i, end], value.id); });
      else data.nodes.forEach((n, i) => {
        if (n.group === old.id) set(['nodes', i, 'group'], value.id);
        if (n.groups?.includes(old.id)) set(['nodes', i, 'groups'], n.groups.map(id => id === old.id ? value.id : id));
      });
    }
  } else {
    const old = list[index]; set([kind, index], undefined);
    if (kind === 'nodes') {
      for (let i = data.edges.length - 1; i >= 0; i--) if (data.edges[i].from === old.id || data.edges[i].to === old.id) set(['edges', i], undefined);
    } else if (kind === 'groups') data.nodes.forEach((n, i) => {
      if (n.group === old.id) set(['nodes', i, 'group'], undefined);
      if (n.groups?.includes(old.id)) set(['nodes', i, 'groups'], n.groups.filter(id => id !== old.id));
    });
  }
  // In the GUI a set's explicit shape is edited as a unit, so changing it never requires an invalid intermediate file.
  if (kind === 'edges' && action !== 'delete' && value.setId && ['straight', 'curved'].includes(value.shape)) {
    data.edges.forEach((edge, i) => {
      if ((action !== 'save' || i !== index) && edge.setId === value.setId && edge.shape && edge.shape !== 'auto' && edge.shape !== value.shape) set(['edges', i, 'shape'], value.shape);
    });
  }
  const result = parseConfig(text);
  if (result.issues.length) throw new Error(result.issues.slice(0, 4).map(e => e.message).join('\n'));
  return { text, rename, config: result.config, index: action === 'add' ? (result.config[kind]?.length || 1) - 1 : action === 'delete' ? null : index };
}
module.exports = { editConfig };
