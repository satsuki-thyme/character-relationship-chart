'use strict';
const { createWebHost } = require('./host');
const sample = require('../examples/characters.relations.jsonc');
window.RelationsGraph = require('../packages/core/graph');
require('../media/editor');
require('../media/main');

const $ = id => document.getElementById(id);
const host = createWebHost({ confirmReplace: () => !hasChanges() || window.confirm('このページには編集した内容があります。必要な内容を反映・ダウンロード済みか確認してください。破棄して別の設定を開きますか？') });
const ui = window.RelationsUi(host);
function hasChanges() { return host.hasEdits() || ui.hasPendingEdits(); }
function warnOnLeave(event) { if (hasChanges()) { event.preventDefault(); event.returnValue = ''; } }
function syncLeaveWarning() {
  window.removeEventListener('beforeunload', warnOnLeave);
  if (hasChanges()) window.addEventListener('beforeunload', warnOnLeave);
}
host.onConfig(message => { $('web-download').disabled = !message.config; syncLeaveWarning(); });
for (const type of ['input', 'change', 'click']) $('config-editor').addEventListener(type, syncLeaveWarning);
async function open(files) {
  const result = await host.openFiles(files);
  if (result.ok) {
    $('web-file').textContent = result.fileName + (result.viewName ? ` + ${result.viewName}` : '');
    $('web-open-view').disabled = false;
    $('web-message').textContent = '';
    syncLeaveWarning();
  }
}
function sampleFile() {
  return new File([sample], 'characters.relations.jsonc', { type: 'application/json' });
}
$('web-open').addEventListener('click', () => $('web-files').click());
$('web-open-view').addEventListener('click', () => $('web-view').click());
$('web-download').addEventListener('click', async () => {
  if (ui.hasPendingEdits()) { $('web-message').textContent = '編集画面の入力を反映してからダウンロードしてください。'; return; }
  $('web-download').disabled = true;
  const result = await host.downloadConfig();
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
window.addEventListener('pagehide', event => { if (!event.persisted) host.dispose(); });
void open([sampleFile()]);
