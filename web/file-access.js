'use strict';
const { LIMITS } = require('../packages/core/config');

// Local-file handles and permission checks never enter the shared core/UI.
function supportsDirectSave(scope = globalThis) {
  return scope.isSecureContext === true && typeof scope.showOpenFilePicker === 'function'
    && typeof scope.FileSystemFileHandle?.prototype?.createWritable === 'function';
}
function supportsViewSaveAs(scope = globalThis) {
  return scope.isSecureContext === true && typeof scope.showSaveFilePicker === 'function'
    && typeof scope.FileSystemFileHandle?.prototype?.createWritable === 'function';
}
function writableHandle(handle) {
  return handle?.kind === 'file' && typeof handle.getFile === 'function'
    && typeof handle.createWritable === 'function' && typeof handle.requestPermission === 'function';
}
function equalBytes(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
async function readOriginal(handle, limit = LIMITS.text) {
  const file = await handle.getFile();
  if (file.size > limit * 4) throw new Error('元ファイルが大きすぎるため確認できません。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { file, bytes };
}
async function openOriginal(handle, limit = LIMITS.text) {
  const snapshot = await readOriginal(handle, limit);
  // Preserve BOM and reject lossy decoding on the direct-write path.
  return { ...snapshot, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(snapshot.bytes) };
}
async function writeOriginal(handle, baseline, text, isActive, limit = LIMITS.text) {
  let stream, phase = 'permission', blocked = false;
  const active = () => { if (!isActive()) throw new Error('保存処理を中断しました。'); };
  async function unchanged() {
    const { bytes } = await readOriginal(handle, limit); active();
    if (!equalBytes(bytes, baseline)) {
      const error = new Error('元ファイルが外部で変更されています。上書きを停止しました。');
      error.conflict = true; throw error;
    }
  }
  try {
    active();
    // Invoke before any slow reads, while the Save button's activation is live.
    if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
      return { ok: false, status: 'denied', message: '書込権限が許可されませんでした。' };
    }
    active(); phase = 'read'; await unchanged();
    phase = 'create'; stream = await handle.createWritable({ keepExistingData: false, mode: 'exclusive' }); active();
    // The picker/permission/stream creation may take time. Recheck after opening
    // the swap file and again immediately before committing it.
    phase = 'read'; await unchanged();
    const bytes = new TextEncoder().encode(text);
    phase = 'write'; await stream.write(bytes); active();
    phase = 'read'; await unchanged();
    phase = 'close'; await stream.close(); stream = null; active();
    phase = 'verify'; const saved = await readOriginal(handle, limit); active();
    if (!equalBytes(saved.bytes, bytes)) throw new Error('保存後に読み戻した内容が一致しません。');
    return { ok: true, status: 'saved', bytes };
  } catch (error) {
    blocked = !!error.conflict || phase === 'close' || phase === 'verify';
    if (stream) {
      try { await stream.abort(); } catch { blocked = true; }
    }
    const status = error.conflict ? 'conflict' : blocked ? 'uncertain' : 'error';
    return { ok: false, status, blocked, message: status === 'uncertain'
      ? '保存結果を確認できません。自動再送はしません。元ファイルの内容を確認してください。'
      : String(error.message || error) };
  }
}
module.exports = { supportsDirectSave, supportsViewSaveAs, writableHandle, openOriginal, writeOriginal };
