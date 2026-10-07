'use strict';
const { parseConfig, LIMITS } = require('../packages/core/config');
const { editConfig: editText } = require('../packages/core/edit');
const { parseState, normalizeState, encodeState, VIEW_LIMITS } = require('../packages/core/view-state');
const { writableHandle, openOriginal, writeOriginal } = require('./file-access');
const { createHistory } = require('./history');

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

function createWebHost({ readText = readLocalFile, downloadText = downloadLocalFile, confirmReplace = () => true, canTravel = () => true } = {}) {
  const configListeners = new Set(), viewListeners = new Set(), saveListeners = new Set(), viewSaveListeners = new Set();
  const history = createHistory(), historyListeners = new Set();
  let groupingHistory = false;
  let serial = 0, version = 0, current = null, disposed = false;
  let documentText = '', originalText = '';
  let target = null, saving = false;
  let viewState = normalizeState({ version: 1 }), originalView = encodeState(viewState);
  let viewTarget = null, viewSaving = false, viewDirty = false, viewHasFile = false, initializingView = false;
  const busy = () => saving || viewSaving;
  const viewName = () => current ? current.fileName + '.view.json' : '';
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
  function saveState() { return { available: !!target && !target.blocked, saving: busy(), blocked: !!target?.blocked }; }
  function viewSaveState() { return { available: !!viewTarget && !viewTarget.blocked, saving: viewSaving, busy: busy(),
    blocked: !!viewTarget?.blocked, dirty: viewDirty, hasFile: viewHasFile, fileName: viewName() }; }
  const snapshot = () => ({ text: documentText, view: encodeState(viewState) });
  function sameView(a, b) {
    const left = JSON.parse(a), right = JSON.parse(b), x = left.camera, y = right.camera;
    // Screen dimensions are restoration metadata. Compare the preserved
    // centre with subpixel roundoff tolerance; never round stored coordinates.
    if (x?.width && x?.height && y?.width && y?.height) {
      if (Math.abs((x.x - x.width / 2) - (y.x - y.width / 2)) > 1e-7
        || Math.abs((x.y - x.height / 2) - (y.y - y.height / 2)) > 1e-7) return false;
      for (const key of ['x', 'y', 'width', 'height']) { delete x[key]; delete y[key]; }
    }
    return JSON.stringify(left) === JSON.stringify(right);
  }
  function recordSnapshot(before) {
    const after = snapshot();
    if (before.text !== after.text || !sameView(before.view, after.view)) history.record(before, after);
  }
  function historyState() {
    const state = history.state();
    return { ...state, busy: busy(), canUndo: !disposed && !busy() && state.undoCount > 0,
      canRedo: !disposed && !busy() && state.redoCount > 0 };
  }
  const notifySave = () => { emit(saveListeners, saveState()); emit(viewSaveListeners, viewSaveState()); emit(historyListeners, historyState()); };
  function travel(direction) {
    if (disposed || !current) return { ok: false, message: '先に設定を開いてください。' };
    if (busy()) return { ok: false, message: '保存中は取り消し・やり直しできません。完了を待ってください。' };
    if (!canTravel()) return { ok: false, message: '未反映の入力があります。反映するか、編集画面で破棄を選んでから操作してください。入力は保持しています。' };
    const previous = history[direction]();
    if (!previous) return { ok: false, message: '戻せる履歴がありません。' };
    // Versions and pending-read tokens only move forward. Saving destinations,
    // raw bytes, saved snapshots and blocked states are never history entries.
    serial++; version++; documentText = previous.text;
    viewState = parseState(previous.view); initializingView = false;
    current = { ...parseConfig(documentText), fileName: current.fileName, documentVersion: version, dirty: documentText !== originalText };
    viewDirty = !sameView(encodeState(viewState), originalView);
    groupingHistory = true;
    try {
      emit(viewListeners, { viewState: normalizeState(viewState), fileName: viewHasFile ? viewName() : '', deferLayout: true });
      emit(configListeners, { ...current, restoreView: true });
    } finally { groupingHistory = false; }
    notifySave();
    return { ok: true, documentVersion: version };
  }
  async function checkViewTarget(handle, snapshot) {
    if (!writableHandle(handle)) throw new Error('この表示データの保存先は直接保存に対応していません。');
    if (handle === target?.handle || (target && typeof handle.isSameEntry === 'function' && await handle.isSameEntry(target.handle))) {
      throw new Error('設定本体を表示データの保存先にはできません。');
    }
    if (snapshot.file.name !== viewName()) throw new Error(`表示データの保存先は「${viewName()}」を選択してください。`);
  }
  async function openFiles(input, handle = null, viewHandle = null) {
    if (busy()) return { ok: false, message: '保存中は設定・表示データを切り替えられません。完了を待ってください。' };
    const request = ++serial;
    if (disposed) return { stale: true };
    let source;
    try {
      const snapshot = handle ? await openOriginal(handle) : null;
      const viewSnapshot = viewHandle ? await openOriginal(viewHandle, VIEW_LIMITS.text) : null;
      if (disposed || request !== serial) return { stale: true };
      if (viewSnapshot) await checkViewTarget(viewHandle, viewSnapshot);
      const files = snapshot ? [snapshot.file] : viewSnapshot ? [viewSnapshot.file] : Array.from(input);
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
      const [text, viewText] = await Promise.all([source ? (snapshot ? snapshot.text : readText(source)) : null, view ? (viewSnapshot ? viewSnapshot.text : readText(view)) : null]);
      if (disposed || request !== serial) return { stale: true };
      if (source && typeof text !== 'string') throw new Error('設定を文字列として読み込めませんでした。');
      const parsed = source ? parseConfig(text) : current;
      if (parsed.issues.length) return failure(parsed.issues.map(issue => ({ ...issue,
        line: 1 + (text.slice(0, issue.offset).match(/\r\n|\r|\n/g) || []).length
      })), sourceName);
      // Parse both inputs before publishing either: an invalid sidecar must not
      // replace the current document or mix its layout with a new document.
      const loadedView = view ? parseState(viewText) : normalizeState({ version: 1 });
      if (current && ((source && !confirmReplace('source')) || (!source && viewDirty && !confirmReplace('view')))) return { cancelled: true };
      if (disposed || request !== serial) return { stale: true };
      if (source) {
        documentText = originalText = text;
        target = snapshot && writableHandle(handle) ? { handle, baseline: snapshot.bytes, blocked: false } : null;
        current = { ...parsed, fileName: sourceName, issues: [], documentVersion: ++version, dirty: false };
      }
      viewState = loadedView; originalView = encodeState(viewState); viewDirty = false; viewHasFile = !!view;
      viewTarget = viewSnapshot ? { handle: viewHandle, baseline: viewSnapshot.bytes, blocked: false } : null;
      history.clear(); // A validated source or sidecar read starts a new history scope.
      initializingView = true;
      // The UI may enrich/prune its copy; never share mutable host state.
      emit(viewListeners, { viewState: normalizeState(viewState), fileName: view?.name || '', reset: !!source });
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
      const before = snapshot();
      const next = editText(documentText, operation), parsed = parseConfig(next.text);
      // Commit only a validated result. Successful edits supersede pending reads.
      documentText = next.text; serial++;
      current = { ...parsed, fileName: current.fileName, documentVersion: ++version, dirty: documentText !== originalText };
      const positions = Object.assign(Object.create(null), viewState.positions);
      if (next.rename?.kind === 'nodes' && Object.hasOwn(positions, next.rename.from)) {
        positions[next.rename.to] = positions[next.rename.from]; delete positions[next.rename.from];
      }
      const ids = new Set(current.config.nodes.map(node => node.id));
      for (const id of Object.keys(positions)) if (!ids.has(id)) delete positions[id];
      viewState = normalizeState({ ...viewState, positions });
      viewDirty = !sameView(encodeState(viewState), originalView);
      // The synchronous UI capture includes the resulting layout in this edit.
      groupingHistory = true;
      try { emit(configListeners, { ...current, rename: next.rename }); }
      finally { groupingHistory = false; }
      recordSnapshot(before);
      notifySave();
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
    if (busy()) return { ok: false, message: '保存中です。完了を待ってください。' };
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
  function updateView(value, { initialize = false, record = true } = {}) {
    try {
      if (disposed || !current) throw new Error('先に設定ファイルを読み込んでください。');
      const before = snapshot(), initial = initialize && initializingView;
      const next = normalizeState(value), text = encodeState(next);
      if (initial) originalView = text;
      else if (text !== encodeState(viewState)) serial++; // supersede slow reads, not saves
      initializingView = false; viewState = next; viewDirty = !sameView(text, originalView);
      if (!initial && !groupingHistory && record) recordSnapshot(before);
      notifySave(); return { ok: true };
    } catch (error) { return { ok: false, message: String(error.message || error) }; }
  }
  async function downloadView() {
    try {
      if (disposed || !current) throw new Error('先に設定ファイルを読み込んでください。');
      const fileName = viewName().split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '') || 'characters.relations.jsonc.view.json';
      await downloadText(encodeState(viewState), fileName);
      return { ok: true, fileName };
    } catch (error) { return { ok: false, message: String(error.message || error) }; }
  }
  async function writeView(savingTarget, text) {
    const result = await writeOriginal(savingTarget.handle, savingTarget.baseline, text,
      () => !disposed && viewTarget === savingTarget, VIEW_LIMITS.text);
    if (disposed) return { ok: false, status: 'disposed' };
    if (!result.ok) { savingTarget.blocked = !!result.blocked; return result; }
    savingTarget.baseline = result.bytes; originalView = text; viewHasFile = true;
    viewDirty = !sameView(encodeState(viewState), text);
    return { ok: true, fileName: viewName(), dirty: viewDirty };
  }
  async function saveView() {
    if (disposed || !current || !viewTarget) return { ok: false, message: '表示データの保存先を選択してください。ダウンロードでも退避できます。' };
    if (busy()) return { ok: false, message: '保存中です。完了を待ってください。' };
    if (viewTarget.blocked) return { ok: false, status: 'blocked', message: '表示データの直接保存を停止しています。ダウンロードで退避して、保存先を確認して開き直してください。' };
    const savingTarget = viewTarget, text = encodeState(viewState);
    viewSaving = true; serial++; notifySave();
    try { return await writeView(savingTarget, text); }
    finally { viewSaving = false; if (!disposed) notifySave(); }
  }
  async function saveViewAs(pickHandle) {
    if (disposed || !current) return { ok: false, message: '先に設定ファイルを読み込んでください。' };
    if (busy()) return { ok: false, message: '保存中です。完了を待ってください。' };
    const text = encodeState(viewState), fileName = viewName();
    viewSaving = true; serial++; notifySave();
    try {
      // Invoke the picker in the original button activation. We neither look
      // for a neighbour of the config handle nor adopt nonempty targets here.
      const handle = await pickHandle(fileName);
      if (disposed) return { ok: false, status: 'disposed' };
      const snapshot = await openOriginal(handle, VIEW_LIMITS.text);
      await checkViewTarget(handle, snapshot);
      if (disposed) return { ok: false, status: 'disposed' };
      if (snapshot.bytes.length) return { ok: false, status: 'existing', message: '中身のある既存ファイルには書き込みません。「表示データを直接保存用に開く」で読み込んでから編集・保存してください。' };
      viewTarget = { handle, baseline: snapshot.bytes, blocked: false };
      return await writeView(viewTarget, text);
    } catch (error) { return { ok: false, status: error.name === 'AbortError' ? 'cancelled' : 'error', message: String(error.message || error) }; }
    finally { viewSaving = false; if (!disposed) notifySave(); }
  }
  return {
    capabilities: Object.freeze({ edit: true, persistEdits: false, viewStorage: false, viewCapture: true, openSource: false, exportSvg: false }),
    onConfig: callback => subscribe(configListeners, callback),
    onView: callback => subscribe(viewListeners, callback),
    onSaveState: callback => subscribe(saveListeners, callback),
    onViewSaveState: callback => subscribe(viewSaveListeners, callback),
    getSaveState: saveState,
    getHistoryState: historyState, onHistoryState: callback => subscribe(historyListeners, callback),
    undo: () => travel('undo'), redo: () => travel('redo'),
    getViewSaveState: viewSaveState, getViewState: () => normalizeState(viewState),
    ready() {}, openFiles: input => openFiles(input), openHandle: handle => openFiles(null, handle),
    openViewHandle: handle => openFiles(null, null, handle), editConfig, downloadConfig, saveConfig,
    updateView, downloadView, saveView, saveViewAs,
    hasEdits: () => !!current?.dirty,
    hasViewEdits: () => viewDirty,
    dispose() { disposed = true; serial++; configListeners.clear(); viewListeners.clear(); saveListeners.clear(); viewSaveListeners.clear();
      history.clear(); historyListeners.clear();
      current = target = viewTarget = null; documentText = originalText = ''; viewState = normalizeState({ version: 1 }); }
  };
}
module.exports = { createWebHost };
