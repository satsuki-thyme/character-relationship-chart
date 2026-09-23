/* global module */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createVsCodeHost = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createVsCodeHost(api, events) {
  'use strict';
  // The API stays in this closure. Shared UI only receives the host contract.
  const listeners = { update: new Set(), init: new Set(), storage: new Set() };
  const pending = new Map();
  let serial = 0, disposed = false;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const version = value => Number.isSafeInteger(value) && value >= 0;
  const config = value => object(value) && Array.isArray(value.nodes) && Array.isArray(value.edges);
  const optionalText = value => value === undefined || typeof value === 'string';
  function valid(message) {
    if (!object(message)) return false;
    if (message.type === 'init') return object(message.viewState) && optionalText(message.fileName);
    if (message.type === 'storage') return ['saved', 'pending', 'error'].includes(message.status) && optionalText(message.message) && optionalText(message.fileName);
    if (message.type === 'update') return version(message.documentVersion) && Array.isArray(message.issues)
      && message.issues.every(issue => object(issue) && typeof issue.message === 'string' && Number.isFinite(issue.line))
      && (message.config === undefined || config(message.config))
      && (message.graph === undefined || (config(message.graph) && Array.isArray(message.graph.groups)));
    if (message.type === 'editResult') return version(message.requestId) && typeof message.ok === 'boolean'
      && (message.ok ? config(message.config) && version(message.documentVersion) : optionalText(message.message));
    return false;
  }
  function receive(event) {
    const message = event.data;
    if (disposed || !valid(message)) return;
    if (message.type === 'editResult') {
      const request = pending.get(message.requestId);
      if (request) { pending.delete(message.requestId); request.resolve(message); }
      return;
    }
    for (const listener of listeners[message.type]) listener(message);
  }
  function subscribe(type, listener) {
    if (disposed) throw new Error('画面は既に閉じられています。');
    listeners[type].add(listener);
    return () => listeners[type].delete(listener);
  }
  function send(message) {
    if (disposed) throw new Error('画面は既に閉じられています。');
    api.postMessage(message);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    events.removeEventListener('message', receive);
    events.removeEventListener('pagehide', dispose);
    for (const set of Object.values(listeners)) set.clear();
    for (const request of pending.values()) request.reject(new Error('画面が閉じられたため、保存結果を確認できませんでした。'));
    pending.clear();
  }
  // Retire legacy Webview persistence; the sidecar remains the only view store.
  api.setState(null);
  events.addEventListener('message', receive);
  events.addEventListener('pagehide', dispose);
  return Object.freeze({
    onConfig: listener => subscribe('update', listener),
    onView: listener => subscribe('init', listener),
    onStorage: listener => subscribe('storage', listener),
    ready: () => send({ type: 'ready' }),
    updateView: state => send({ type: 'viewState', state }),
    saveView: () => send({ type: 'saveView' }),
    reloadView: () => send({ type: 'reloadView' }),
    openView: () => send({ type: 'openViewFile' }),
    openSource: () => send({ type: 'openSource' }),
    exportSvg: svg => send({ type: 'export', svg }),
    editConfig(operation, baseVersion) {
      if (disposed) return Promise.reject(new Error('画面は既に閉じられています。'));
      const requestId = ++serial;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        try { send({ type: 'editConfig', requestId, baseVersion, operation }); }
        catch (error) { pending.delete(requestId); reject(error); }
      });
    },
    dispose
  });
});
