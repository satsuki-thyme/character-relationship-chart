'use strict';
const { createWebHost } = require('./host');
const sample = require('../examples/characters.relations.jsonc');
window.RelationsGraph = require('../packages/core/graph');
require('../media/main');

const $ = id => document.getElementById(id), host = createWebHost();
window.RelationsUi(host);
async function open(files) {
  const result = await host.openFiles(files);
  if (result.ok) {
    $('web-file').textContent = result.fileName + (result.viewName ? ` + ${result.viewName}` : '');
    $('web-open-view').disabled = false;
  }
}
function sampleFile() {
  return new File([sample], 'characters.relations.jsonc', { type: 'application/json' });
}
$('web-open').addEventListener('click', () => $('web-files').click());
$('web-open-view').addEventListener('click', () => $('web-view').click());
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
