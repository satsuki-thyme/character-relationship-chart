'use strict';
const { parseConfig, LIMITS } = require('../packages/core/config');
const { editConfig: editText } = require('../packages/core/edit');
const { parseState, VIEW_LIMITS } = require('../packages/core/view-state');
const { writableHandle, openOriginal, writeOriginal } = require('./file-access');

function readLocalFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ファイルを読み込めませんでした。もう一度選択してください。'));
    reader.onabort = () => reject(new Error('ファイルの読込が中断されました。'));
    reader.readAsText(file, 'UTF-8');
  });
}

// Files and FileReader belong to this host; the core receives text only.
function downloadLocalFile(text, fileName) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let link;
  try {
    link = document.createElement('a');
    link.href = url; link.download = fileName; link.hidden = true;
    document.body.append(link); link.click();
  } catch (error) { URL.revokeObjectURL(url); throw error; }
  finally { link?.remove(); }
  // Give the browser time to consume the URL. A started download is not a
  // confirmation that the user saved it; the document stays marked as edited.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function createWebHost({ readText = readLocalFile, downloadText = downloadLocalFile, confirmReplace = () => true } = {}) {
  const configListeners = new Set(), viewListeners = new Set(), saveListeners = new Set();
  let serial = 0, version = 0, current = null, disposed = false;
  let documentText = '', originalText = '';
  let target = null, saving = false;
  const subscribe = (set, callback) => { set.add(callback); return () => set.delete(callback); };
  const emit = (set, message) => { for (const callback of set) callback(message); };
  const isView = file => /\.view\.json$/i.test(file.name);
  function check(file, limit) {
    if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || file.size < 0) throw new Error('ファイルを選択してください。');
    // Bound allocation before decoding; the core enforces the character limit.
    if (file.size > limit * 4) throw new Error('ファイルが大きすぎます。');
  }
  function failure(issues, fileName) {
    // A failed read does not invalidate the still-editable in-memory document.
    emit(configListeners, { config: current?.config, issues, fileName, documentVersion: version });
    return { ok: false };
  }
  function saveState() { return { available: !!target && !target.blocked, saving, blocked: !!target?.blocked }; }
  const notifySave = () => emit(saveListeners, saveState());
  async function openFiles(input, handle = null) {
    if (saving) return { ok: false, message: '保存中は設定を切り替えられません。完了を待ってください。' };
    const request = ++serial;
    if (disposed) return { stale: true };
    let source;
    try {
      const snapshot = handle ? await openOriginal(handle) : null;
      if (disposed || request !== serial) return { stale: true };
      const files = snapshot ? [snapshot.file] : Array.from(input);
      if (!files.length || files.length > 2) throw new Error('設定ファイル1つと、任意で対応する .view.json を選択してください。');
      for (const file of files) check(file, LIMITS.text);
      const sources = files.filter(file => !isView(file)), views = files.filter(isView);
      if (sources.length > 1 || views.length > 1) throw new Error('設定ファイルと表示データは、それぞれ1つだけ選択してください。');
      source = sources[0]; const view = views[0];
      if (source && !/\.(jsonc|json)$/i.test(source.name)) throw new Error('設定は .jsonc または .json ファイルを選択してください。');
      if (!source && !current) throw new Error('先に設定ファイルを読み込んでください。');
      const sourceName = source?.name || current.fileName;
      if (view) {
        check(view, VIEW_LIMITS.text);
        if (view.name !== sourceName + '.view.json') throw new Error(`表示データは「${sourceName}.view.json」を選択してください。`);
      }
      const [text, viewText] = await Promise.all([source ? (snapshot ? snapshot.text : readText(source)) : null, view ? readText(view) : null]);
      if (disposed || request !== serial) return { stale: true };
      if (source && typeof text !== 'string') throw new Error('設定を文字列として読み込めませんでした。');
      const parsed = source ? parseConfig(text) : current;
      if (parsed.issues.length) return failure(parsed.issues.map(issue => ({ ...issue,
        line: 1 + (text.slice(0, issue.offset).match(/\r\n|\r|\n/g) || []).length
      })), sourceName);
      // Parse both inputs before publishing either: an invalid sidecar must not
      // replace the current document or mix its layout with a new document.
      const viewState = view ? parseState(viewText) : { version: 1 };
      if (source && current && !confirmReplace()) return { cancelled: true };
      if (disposed || request !== serial) return { stale: true };
      if (source) {
        documentText = originalText = text;
        target = snapshot && writableHandle(handle) ? { handle, baseline: snapshot.bytes, blocked: false } : null;
        current = { ...parsed, fileName: sourceName, issues: [], documentVersion: ++version, dirty: false };
      }
      emit(viewListeners, { viewState, fileName: view?.name || '', reset: !!source });
      emit(configListeners, { ...current, reset: !!source });
      notifySave();
      return { ok: true, fileName: sourceName, viewName: view?.name || '' };
    } catch (error) {
      if (disposed || request !== serial) return { stale: true };
      return failure([{ line: 1, message: error.message || 'ファイルを読み込めませんでした。' }], source?.name || current?.fileName || '');
    }
  }
  async function editConfig(operation, baseVersion) {
    try {
      if (disposed || !current) throw new Error('先に設定ファイルを読み込んでください。');
      if (!Number.isSafeInteger(baseVersion) || baseVersion !== version) throw new Error('画面の設定が変更されています。入力を確認してから再読込してください。');
      if (!operation || JSON.stringify(operation).length > 100000) throw new Error('編集内容が不正です。');
      const next = editText(documentText, operation), parsed = parseConfig(next.text);
      // Commit only a validated result. Successful edits supersede pending reads.
      documentText = next.text; serial++;
      current = { ...parsed, fileName: current.fileName, documentVersion: ++version, dirty: documentText !== originalText };
      emit(configListeners, { ...current, rename: next.rename });
      return { ok: true, config: current.config, documentVersion: version, index: next.index };
    } catch (error) { return { ok: false, message: String(error.message || error) }; }
  }
  async function downloadConfig() {
    try {
      if (disposed || !current) throw new Error('先に設定ファイルを読み込んでください。');
      const fileName = current.fileName.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '') || 'characters.relations.jsonc';
      await downloadText(documentText, fileName);
      return { ok: true, fileName };
    } catch (error) { return { ok: false, message: String(error.message || error) }; }
  }
  async function saveConfig() {
    if (disposed || !current || !target) return { ok: false, message: '元ファイルへ保存できません。「設定をダウンロード」を使ってください。' };
    if (saving) return { ok: false, message: '保存中です。完了を待ってください。' };
    if (target.blocked) return { ok: false, status: 'blocked', message: '直接保存を停止しています。編集結果をダウンロードして退避し、元ファイルを確認して開き直してください。' };
    const savingTarget = target, text = documentText, fileName = current.fileName;
    saving = true; serial++; notifySave(); // Invalidate reads begun before Save.
    try {
      const result = await writeOriginal(savingTarget.handle, savingTarget.baseline, text, () => !disposed && target === savingTarget);
      if (disposed) return { ok: false, status: 'disposed' };
      if (!result.ok) { savingTarget.blocked = !!result.blocked; return result; }
      // Edits made while saving stay dirty. A successful save becomes the next
      // comparison baseline, never an externally changed or unverified file.
      savingTarget.baseline = result.bytes; originalText = text;
      current = { ...current, dirty: documentText !== text };
      // Same document version, no graph/view reset: preserve open form drafts.
      emit(configListeners, { config: current.config, issues: [], fileName, documentVersion: version, dirty: current.dirty });
      return { ok: true, fileName, dirty: current.dirty };
    } finally { saving = false; if (!disposed) notifySave(); }
  }
  return {
    capabilities: Object.freeze({ edit: true, persistEdits: false, viewStorage: false, openSource: false, exportSvg: false }),
    onConfig: callback => subscribe(configListeners, callback),
    onView: callback => subscribe(viewListeners, callback),
    onSaveState: callback => subscribe(saveListeners, callback),
    getSaveState: saveState,
    ready() {}, openFiles: input => openFiles(input), openHandle: handle => openFiles(null, handle), editConfig, downloadConfig, saveConfig,
    hasEdits: () => !!current?.dirty,
    dispose() { disposed = true; serial++; configListeners.clear(); viewListeners.clear(); saveListeners.clear(); current = target = null; documentText = originalText = ''; }
  };
}
module.exports = { createWebHost };
