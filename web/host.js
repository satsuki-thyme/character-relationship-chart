'use strict';
const { parseConfig, LIMITS } = require('../packages/core/config');
const { parseState, VIEW_LIMITS } = require('../packages/core/view-state');

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
function createWebHost({ readText = readLocalFile } = {}) {
  const configListeners = new Set(), viewListeners = new Set();
  let serial = 0, version = 0, current = null, disposed = false;
  const subscribe = (set, callback) => { set.add(callback); return () => set.delete(callback); };
  const emit = (set, message) => { for (const callback of set) callback(message); };
  const isView = file => /\.view\.json$/i.test(file.name);
  function check(file, limit) {
    if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || file.size < 0) throw new Error('ファイルを選択してください。');
    // Bound allocation before decoding; the core enforces the character limit.
    if (file.size > limit * 4) throw new Error('ファイルが大きすぎます。');
  }
  function failure(issues, fileName) {
    emit(configListeners, { issues, fileName, documentVersion: ++version });
    return { ok: false };
  }
  async function openFiles(input) {
    const request = ++serial;
    if (disposed) return { stale: true };
    let source;
    try {
      const files = Array.from(input);
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
      const [text, viewText] = await Promise.all([source ? readText(source) : null, view ? readText(view) : null]);
      if (disposed || request !== serial) return { stale: true };
      if (source && typeof text !== 'string') throw new Error('設定を文字列として読み込めませんでした。');
      const parsed = source ? parseConfig(text) : current;
      if (parsed.issues.length) return failure(parsed.issues.map(issue => ({ ...issue,
        line: 1 + (text.slice(0, issue.offset).match(/\r\n|\r|\n/g) || []).length
      })), sourceName);
      // Parse both inputs before publishing either: an invalid sidecar must not
      // replace the current document or mix its layout with a new document.
      const viewState = view ? parseState(viewText) : { version: 1 };
      current = { ...parsed, fileName: sourceName, issues: [], documentVersion: ++version };
      emit(viewListeners, { viewState, fileName: view?.name || '', reset: !!source });
      emit(configListeners, current);
      return { ok: true, fileName: sourceName, viewName: view?.name || '' };
    } catch (error) {
      if (disposed || request !== serial) return { stale: true };
      return failure([{ line: 1, message: error.message || 'ファイルを読み込めませんでした。' }], source?.name || current?.fileName || '');
    }
  }
  return {
    capabilities: Object.freeze({ edit: false, viewStorage: false, openSource: false, exportSvg: false }),
    onConfig: callback => subscribe(configListeners, callback),
    onView: callback => subscribe(viewListeners, callback),
    ready() {}, openFiles,
    dispose() { disposed = true; serial++; configListeners.clear(); viewListeners.clear(); current = null; }
  };
}
module.exports = { createWebHost };
