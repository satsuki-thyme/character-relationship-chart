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
function stateUri(source) { return source.with({ path: source.path + '.view.json' }); }
function createStorage(vscode) {
  const fs = vscode.workspace.fs, stores = new Map();
  async function readBytes(uri) {
    try { return Buffer.from(await fs.readFile(uri)); }
    catch (error) { if (error.code === 'FileNotFound') return null; throw error; }
  }
  async function readText(uri) { const bytes = await readBytes(uri); return bytes === null ? null : bytes.toString('utf8'); }
  function assertClean(uri) {
    if (vscode.workspace.textDocuments.some(d => d.uri.toString() === uri.toString() && d.isDirty)) throw new Error('表示データのファイルに未保存の編集があります。先に保存し、「配置を再読込」を押してください。');
  }
  async function writeFile(uri, bytes, expected) {
    assertClean(uri);
    const original = await readBytes(uri);
    if (expected !== undefined && (original === null ? null : original.toString('utf8')) !== expected) throw new Error('表示データが外部で変更されています。上書きを止めました。「配置を再読込」でファイルを読み込んでください。');
    if (original !== null && original.equals(Buffer.from(bytes))) return;
    assertClean(uri); await fs.writeFile(uri, bytes);
  }
  function forSource(source) {
    const uri = stateUri(source), key = uri.toString();
    if (stores.has(key)) return stores.get(key);
    let raw, queue = Promise.resolve();
    const store = {
      uri, get raw() { return raw; },
      async load() {
        await queue; const text = await readText(uri);
        if (text !== null && text.length > 200000) throw new Error('表示データが大きすぎます。200,000文字以内にしてください。');
        const value = text === null ? normalizeState({ version: 1 }) : normalizeState(JSON.parse(text.replace(/^\uFEFF/, '')));
        raw = text; return value;
      },
      async changed() { await queue; return (await readText(uri)) !== raw; },
      save(value) {
        const text = encodeState(value);
        const task = queue.then(async () => {
          if (raw === undefined) throw new Error('表示データを読み込めていないため、保存を止めました。「配置を再読込」で確認してください。');
          if (text === raw) return;
          await writeFile(uri, Buffer.from(text, 'utf8'), raw); raw = text;
        });
        queue = task.catch(() => {}); return task;
      },
      settled() { return queue; }
    };
    stores.set(key, store); return store;
  }
  async function migrateValue(source, value) {
    const text = encodeState(value, true), uri = stateUri(source), existing = await readText(uri);
    if (existing === null) await writeFile(uri, Buffer.from(text), null);
    else normalizeState(JSON.parse(existing.replace(/^\uFEFF/, ''))); // The current file takes precedence over obsolete private state.
  }
  async function migrateLegacy(context) {
    const failures = [];
    for (const key of context.workspaceState.keys().filter(k => k.startsWith('view:'))) {
      const value = context.workspaceState.get(key);
      try { await migrateValue(vscode.Uri.parse(key.slice(5)), value); await context.workspaceState.update(key, undefined); }
      catch (error) { failures.push({ source: key.slice(5), error: String(error.message || error) }); }
    }
    return failures;
  }
  return { forSource, readBytes, readText, writeFile, migrateLegacy, migrateValue, async settle() { await Promise.all([...stores.values()].map(s => s.settled())); } };
}
module.exports = { normalizeState, encodeState, stateUri, createStorage };
