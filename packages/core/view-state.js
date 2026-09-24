'use strict';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = o => o && typeof o === 'object' && !Array.isArray(o);
function normalizeState(input, legacy = false) {
  if (!object(input)) throw new Error('表示データはJSONオブジェクトにしてください。');
  if (!legacy) {
    if (input.version !== 1) throw new Error('表示データの version は 1 にしてください。');
    for (const key of Object.keys(input)) if (!['version', 'layout', 'configLayout', 'positions', 'camera', 'ui'].includes(key)) throw new Error(`表示データに未対応の項目「${key}」があります。`);
  }
  const out = { version: 1, positions: Object.create(null) };
  for (const key of ['layout', 'configLayout']) if (input[key] !== undefined) {
    if (!['auto', 'circle'].includes(input[key])) throw new Error(`${key} は auto / circle を指定してください。`);
    out[key] = input[key];
  }
  if (input.positions !== undefined) {
    if (!object(input.positions) || Object.keys(input.positions).length > 200) throw new Error('positions は200個以内の位置の一覧にしてください。');
    for (const id of Object.keys(input.positions).sort()) {
      const p = input.positions[id];
      if (!id.trim() || id.length > 100 || !object(p) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 20000 || Math.abs(p.y) > 20000 || typeof p.source !== 'string' || p.source.length > 100) throw new Error(`人物「${id}」の保存座標が不正です。`);
      if (!legacy && Object.keys(p).some(k => !['x', 'y', 'source'].includes(k))) throw new Error(`人物「${id}」の座標に未対応の項目があります。`);
      out.positions[id] = { x: p.x, y: p.y, source: p.source };
    }
  }
  if (input.camera !== undefined) {
    const c = input.camera;
    if (!object(c) || !['x', 'y', 'scale'].every(k => Number.isFinite(c[k])) || c.scale < .01 || c.scale > 4 || Math.abs(c.x) > 1000000 || Math.abs(c.y) > 1000000) throw new Error('表示位置・倍率が不正です。');
    if (!legacy && Object.keys(c).some(k => !['x', 'y', 'scale', 'width', 'height'].includes(k))) throw new Error('表示位置・倍率に未対応の項目があります。');
    out.camera = { x: c.x, y: c.y, scale: c.scale };
    if (c.width !== undefined || c.height !== undefined) {
      if (!Number.isFinite(c.width) || !Number.isFinite(c.height) || c.width <= 0 || c.height <= 0 || c.width > 100000 || c.height > 100000) throw new Error('保存時の画面サイズが不正です。');
      out.camera.width = c.width; out.camera.height = c.height;
    }
  }
  if (input.ui !== undefined) {
    if (!object(input.ui)) throw new Error('ui はオブジェクトにしてください。');
    out.ui = {};
    for (const key of ['details', 'focus']) if (own(input.ui, key)) {
      if (typeof input.ui[key] !== 'boolean') throw new Error(`ui.${key} は true / false を指定してください。`);
      out.ui[key] = input.ui[key];
    }
    if (!legacy && Object.keys(input.ui).some(k => !['details', 'focus'].includes(k))) throw new Error('ui に未対応の項目があります。');
  }
  return out;
}
function encodeState(value, legacy = false) { return JSON.stringify(normalizeState(value, legacy), null, 2) + '\n'; }
const VIEW_LIMITS = { text: 200000 };
function parseState(text) {
  if (typeof text !== 'string') throw new TypeError('表示データにはJSON文字列を指定してください。');
  if (text.length > VIEW_LIMITS.text) throw new Error('表示データが大きすぎます。200,000文字以内にしてください。');
  return normalizeState(JSON.parse(text.replace(/^\uFEFF/, '')));
}
module.exports = { normalizeState, encodeState, parseState, VIEW_LIMITS };
