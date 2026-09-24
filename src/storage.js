'use strict';
const { normalizeState, encodeState, parseState } = require('../packages/core');
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
        const value = text === null ? normalizeState({ version: 1 }) : parseState(text);
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
    else parseState(existing); // The current file takes precedence over obsolete private state.
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
