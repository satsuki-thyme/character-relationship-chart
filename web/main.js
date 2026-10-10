'use strict';
const { createWebHost } = require('./host');
const { supportsDirectSave, supportsViewSaveAs } = require('./file-access');
const sample = require('../examples/characters.relations.jsonc');
window.RelationsGraph = require('../packages/core/graph');
require('../media/editor');
require('../media/main');

const $ = id => document.getElementById(id);
const directSave = supportsDirectSave(window);
const viewSaveAs = supportsViewSaveAs(window);
const host = createWebHost({ canTravel: () => !ui.hasPendingEdits(), confirmReplace: scope => scope === 'view'
  ? !host.hasViewEdits() || window.confirm('配置・倍率・表示状態に未保存の変更があります。表示データをダウンロード済みか確認してください。変更を破棄して表示データを読み込みますか？')
  : !hasChanges() || window.confirm('このページには編集した設定・表示データ・入力があります。必要な内容を反映・保存またはダウンロード済みか確認してください。破棄して別の設定を開きますか？') });
const ui = window.RelationsUi(host, { onExportResult(result) {
  if (pageDisposed) return;
  $('web-message').classList.toggle('danger', !result.ok);
  $('web-message').textContent = result.ok
    ? `「${result.fileName}」のダウンロードを開始しました。ブラウザの保存先を確認してください。SVGは図の画像です。編集用の設定・表示データは別に保存してください。`
    : `SVGをダウンロードできませんでした: ${result.message} 設定・配置・入力は保持しています。`;
} });
// Reuse the shared export control and renderer; keep three output purposes
// visible together without a second, divergent SVG implementation.
$('web-svg-actions').append($('export'));
$('export').textContent = 'SVGをダウンロード';
$('export').title = '図全体をSVG画像として出力（設定・表示データの保存とは別）';
let pageDisposed = false;
function syncHistory() {
  if (pageDisposed) return;
  const state = host.getHistoryState(), pending = ui.hasPendingEdits();
  $('web-undo').disabled = !state.canUndo || pending;
  $('web-redo').disabled = !state.canRedo || pending;
  $('web-history-note').textContent = pending
    ? '未反映の入力を保持しています。反映するか、編集画面で破棄を選んでから取り消し・やり直しできます。'
    : state.busy ? '保存が終わるまで取り消し・やり直しを待ってください。'
      : `取り消し ${state.undoCount} ／ やり直し ${state.redoCount}。ページ内の履歴です。${state.limited ? '上限に達した古い履歴は除外しました。' : ''}`;
}
function travel(direction) {
  // Finish an active gesture, but do not turn viewport compensation or an
  // output-only capture into a new edit (which would discard Redo).
  if (!ui.hasPendingEdits() && !host.getHistoryState().busy) ui.finishInteraction();
  const result = host[direction]();
  $('web-message').classList.toggle('danger', !result.ok);
  $('web-message').textContent = result.ok
    ? `${direction === 'undo' ? '取り消し' : 'やり直し'}ました。実ファイルは変更していません。必要な設定・表示データを保存してください。`
    : result.message;
  syncHistory(); syncLeaveWarning();
}
host.onHistoryState(() => queueMicrotask(syncHistory));
for (const [id, direction] of [['web-undo', 'undo'], ['web-redo', 'redo']]) $(id).addEventListener('click', () => travel(direction));
for (const type of ['input', 'change', 'click', 'submit']) $('config-editor').addEventListener(type, () => queueMicrotask(syncHistory));
document.addEventListener('keydown', event => {
  // Text controls keep their browser-native text Undo, including IME input.
  if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)
    || event.target.closest('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (key === 'z' || (key === 'y' && !event.shiftKey)) {
    event.preventDefault(); travel(key === 'y' || event.shiftKey ? 'redo' : 'undo');
  }
});
syncHistory();
function hasChanges() { return host.hasEdits() || host.hasViewEdits() || ui.hasPendingEdits() || host.getSaveState().saving; }
function warnOnLeave(event) { if (hasChanges()) { event.preventDefault(); event.returnValue = ''; } }
function syncLeaveWarning() {
  window.removeEventListener('beforeunload', warnOnLeave);
  if (hasChanges()) window.addEventListener('beforeunload', warnOnLeave);
}
host.onConfig(message => { $('web-download').disabled = $('web-view-download').disabled = !message.config; syncLeaveWarning(); });
function syncSave() {
  const state = host.getSaveState();
  $('web-direct-open').hidden = $('web-save').hidden = !directSave;
  $('web-save').disabled = !state.available || state.saving;
  $('web-save').textContent = state.saving ? '設定を保存中…' : '設定を保存';
  for (const id of ['web-open', 'web-direct-open', 'web-sample', 'web-open-view', 'web-direct-view-open']) $(id).disabled = state.saving;
  $('web-save-note').textContent = state.blocked
    ? '直接保存を停止しています。編集結果をダウンロードして退避し、元ファイルを確認して開き直してください。'
    : state.available ? '「設定を保存」は開いた元ファイルを更新します。「設定をダウンロード」は編集結果のコピーを出力します。'
      : directSave ? '元ファイルを更新するには「直接保存用に開く」を使ってください。通常の読込・ドロップ・サンプルではダウンロードを使えます。'
        : 'この環境では直接保存を利用できません。「設定をダウンロード」で編集結果を保存できます。';
  const view = host.getViewSaveState(), loaded = !!view.fileName;
  $('web-direct-view-open').hidden = $('web-view-save').hidden = !directSave;
  $('web-view-save-as').hidden = !viewSaveAs;
  $('web-open-view').disabled = $('web-direct-view-open').disabled = !loaded || state.saving;
  $('web-view-save').disabled = !view.available || state.saving;
  $('web-view-save').textContent = view.saving ? '表示データを保存中…' : '表示データを保存';
  $('web-view-save-as').disabled = !loaded || state.saving;
  $('web-view-status').textContent = loaded ? `表示データ: ${view.fileName} — ${view.dirty ? '未保存の変更あり' : view.hasFile ? '読込・保存時から変更なし' : 'まだファイルへ保存していません'}` : '';
  $('web-view-note').textContent = view.blocked
    ? '表示データの直接保存を停止しています。表示データをダウンロードして退避し、保存先を確認して開き直してください。設定本体の保存状態は別です。'
    : view.available ? '「表示データを保存」は選択済みの表示データだけを更新します。設定本体は別に保存してください。'
      : directSave || viewSaveAs ? '表示データはダウンロードできます。既存ファイルは直接保存用に開き、新規保存先には同名の空ファイルを選びます。設定の隣のファイルを自動探索しません。'
        : '表示データはダウンロードで保存できます。設定本体と対応する名前で一緒に保管してください。';
  syncLeaveWarning();
}
host.onSaveState(syncSave); syncSave();
for (const type of ['input', 'change', 'click']) $('config-editor').addEventListener(type, syncLeaveWarning);
function opened(result) {
  if (result.ok) {
    $('web-file').textContent = result.fileName + (result.viewName ? ` + ${result.viewName}` : '');
    $('web-open-view').disabled = false;
    $('web-message').textContent = ''; $('web-message').classList.remove('danger');
    syncLeaveWarning();
  } else if (result.message) $('web-message').textContent = result.message;
}
async function open(files) { opened(await host.openFiles(files)); }
function sampleFile() {
  return new File([sample], 'characters.relations.jsonc', { type: 'application/json' });
}
$('web-open').addEventListener('click', () => $('web-files').click());
$('web-direct-open').addEventListener('click', async () => {
  if (host.getSaveState().saving) return;
  $('web-direct-open').disabled = true;
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false,
      types: [{ description: '相関図の設定（JSONC / JSON）', accept: { 'application/json': ['.jsonc', '.json'] } }] });
    if (handle) opened(await host.openHandle(handle));
  } catch (error) {
    if (error.name !== 'AbortError') $('web-message').textContent = '直接保存用に開けませんでした。「設定を開く」で読み込んでダウンロード方式を使えます。現在の編集内容は保持しています。';
  } finally { syncSave(); }
});
$('web-open-view').addEventListener('click', () => $('web-view').click());
$('web-direct-view-open').addEventListener('click', async () => {
  if (host.getSaveState().saving) return;
  $('web-direct-view-open').disabled = true;
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false,
      types: [{ description: '相関図の表示データ（.view.json）', accept: { 'application/json': ['.json'] } }] });
    if (handle) opened(await host.openViewHandle(handle));
  } catch (error) {
    if (error.name !== 'AbortError') $('web-message').textContent = '表示データを直接保存用に開けませんでした。現在の設定・配置・入力は保持しています。ダウンロードでも退避できます。';
  } finally { syncSave(); }
});
function viewResult(result) {
  if (result.status === 'cancelled') { syncSave(); return; }
  $('web-message').classList.toggle('danger', !result.ok);
  $('web-message').textContent = result.ok
    ? `「${result.fileName}」を保存し、内容を確認しました。${result.dirty ? '保存中の新しい表示変更は未保存です。' : ''} 設定本体と未反映の入力は別に扱います。`
    : `${result.message || '表示データを保存できませんでした。'} 設定・配置・入力はこのページに残っています。「表示データをダウンロード」で退避できます。`;
  syncSave();
}
$('web-view-save').addEventListener('click', async () => {
  const captured = ui.captureView();
  viewResult(captured?.ok === false ? captured : await host.saveView());
});
$('web-view-save-as').addEventListener('click', async () => {
  const captured = ui.captureView();
  if (captured?.ok === false) { viewResult(captured); return; }
  viewResult(await host.saveViewAs(suggestedName => window.showSaveFilePicker({ suggestedName,
    types: [{ description: '相関図の表示データ（.view.json）', accept: { 'application/json': ['.json'] } }] })));
});
$('web-view-download').addEventListener('click', async () => {
  const captured = ui.captureView();
  const result = captured?.ok === false ? captured : await host.downloadView();
  $('web-message').classList.toggle('danger', !result.ok);
  $('web-message').textContent = result.ok
    ? `「${result.fileName}」のダウンロードを開始しました。保存先を確認してください。設定本体・未反映の入力は含めません。`
    : `表示データをダウンロードできませんでした: ${result.message} 配置・設定・入力は保持しています。`;
  syncLeaveWarning();
});
$('web-save').addEventListener('click', async () => {
  const result = await host.saveConfig();
  $('web-message').classList.toggle('danger', !result.ok);
  $('web-message').textContent = result.ok
    ? `「${result.fileName}」を保存し、内容を確認しました。${result.dirty ? '保存中に反映された新しい編集は未保存です。' : ''}${ui.hasPendingEdits() ? '未反映のフォーム入力は保存していません。' : ''}`
    : `${result.message || '保存できませんでした。'} 編集内容はこのページに残っています。「設定をダウンロード」で退避できます。`;
  syncSave();
});
$('web-download').addEventListener('click', async () => {
  if (ui.hasPendingEdits()) { $('web-message').textContent = '編集画面の入力を反映してからダウンロードしてください。'; return; }
  $('web-download').disabled = true;
  const result = await host.downloadConfig();
  $('web-message').classList.toggle('danger', !result.ok);
  $('web-download').disabled = false;
  $('web-message').textContent = result.ok ? `「${result.fileName}」のダウンロードを開始しました。ブラウザの保存先を確認してください。` : `ダウンロードできませんでした: ${result.message} 編集内容はこのページに残っています。もう一度試してください。`;
});
for (const id of ['web-files', 'web-view']) $(id).addEventListener('change', event => {
  const files = Array.from(event.target.files);
  event.target.value = ''; // Choosing the same file again rereads its current bytes.
  if (files.length) void open(files);
});
$('web-sample').addEventListener('click', () => void open([sampleFile()]));
document.addEventListener('dragover', event => {
  if (Array.from(event.dataTransfer?.types || []).includes('Files')) {
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; document.body.classList.add('file-drop');
  }
});
document.addEventListener('dragleave', event => { if (!event.relatedTarget) document.body.classList.remove('file-drop'); });
document.addEventListener('drop', event => {
  document.body.classList.remove('file-drop');
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length) { event.preventDefault(); void open(files); }
});
// Closing the page releases the only in-memory document. Nothing is persisted.
window.addEventListener('pagehide', event => { if (!event.persisted) { pageDisposed = true; host.dispose(); } });
void open([sampleFile()]);
