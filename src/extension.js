'use strict';
const vscode = require('vscode');
const { parseConfig } = require('./config');
const { editConfig } = require('./edit');
const { getHtml } = require('./webview');
const { createStorage, normalizeState, stateUri } = require('./storage');
const VIEW = 'characterRelationshipChart.preview.v2';
let finishWrites = async () => {};
function activate(context) {
  const panels = new Map(), pendingWrites = new Set(), storage = createStorage(vscode);
  const diagnostics = vscode.languages.createDiagnosticCollection('character-relationship-chart');
  context.subscriptions.push(diagnostics);
  const safe = fn => async (...args) => { try { return await fn(...args); } catch (e) { await vscode.window.showErrorMessage(`相関図: ${e.message || e}`); } };
  const describe = uri => uri.path.split('/').pop() || '設定ファイル';
  async function migrate() {
    const failures = await storage.migrateLegacy(context);
    if (failures.length) await vscode.window.showErrorMessage(`相関図: 旧版のデータ${failures.length}件をファイルへ移行できませんでした。元のデータは残しています。保存先を確認して「旧版データをファイルへ移行」を実行してください。`);
  }
  const migration = migrate();
  const track = promise => { pendingWrites.add(promise); promise.finally(() => pendingWrites.delete(promise)).catch(() => {}); return promise; };
  async function open(uri) {
    await migration;
    if (!uri?.scheme) {
      const active = vscode.window.activeTextEditor?.document;
      if (active && ['json', 'jsonc'].includes(active.languageId)) uri = active.uri;
      else { const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { '相関図の設定': ['jsonc', 'json'] }, openLabel: '相関図を表示' }); if (!picked?.[0]) return; uri = picked[0]; }
    }
    if (uri.scheme === 'untitled') { await vscode.window.showInformationMessage('先に設定ファイルを .jsonc などの名前で保存してください。'); return; }
    const existing = panels.get(uri.toString());
    if (existing) { existing.panel.reveal(vscode.ViewColumn.Beside); return; }
    const document = await vscode.workspace.openTextDocument(uri);
    const panel = vscode.window.createWebviewPanel(VIEW, `相関図: ${describe(uri)}`, vscode.ViewColumn.Beside, {});
    await attach(panel, document);
  }
  async function attach(panel, initialDocument) {
    let document = initialDocument, key = document.uri.toString(), store = storage.forSource(document.uri);
    const webview = panel.webview, handlers = [];
    let ready = false, disposed = false, editing = false, textTimer, stateTimer, watchTimer, watcher;
    let viewState = { version: 1 }, dirtyView = false, revision = 0, storageError = '', blocked = false;
    const post = message => { if (!disposed && ready) void webview.postMessage(message); };
    const storageStatus = (status, message = '') => post({ type: 'storage', status, message, fileName: describe(store.uri), exists: store.raw !== null && store.raw !== undefined });
    async function loadView(notify = true) {
      clearTimeout(stateTimer);
      try { viewState = await store.load(); dirtyView = false; blocked = false; storageError = ''; }
      catch (e) { storageError = String(e.message || e); blocked = true; }
      if (notify) { post({ type: 'init', viewState, fileName: describe(store.uri), restored: true }); storageStatus(storageError ? 'error' : 'saved', storageError); }
    }
    await loadView(false);
    function update() {
      if (disposed) return;
      const { graph, issues, config } = parseConfig(document.getText());
      diagnostics.set(document.uri, issues.map(issue => {
        const range = new vscode.Range(document.positionAt(issue.offset), document.positionAt(issue.offset + issue.length));
        const d = new vscode.Diagnostic(range, issue.message, vscode.DiagnosticSeverity.Error); d.source = 'Character Relationship Chart'; return d;
      }));
      panel.title = `相関図: ${graph?.title || describe(document.uri)}`;
      post({ type: 'update', graph, config, documentVersion: document.version, issues: issues.map(issue => ({ ...issue, line: document.positionAt(issue.offset).line + 1 })), fileName: describe(document.uri), dirty: document.isDirty });
    }
    async function flush() {
      clearTimeout(stateTimer); if (!dirtyView || blocked) return;
      const savedRevision = revision, target = store, value = viewState;
      try {
        await target.save(value);
        if (savedRevision === revision && target === store) { dirtyView = false; storageError = ''; storageStatus('saved'); }
      } catch (e) {
        storageError = String(e.message || e); blocked = true; storageStatus('error', storageError);
        if (disposed) await vscode.window.showErrorMessage(`相関図: 表示データを保存できませんでした（${describe(target.uri)}）。${storageError}`);
      }
    }
    async function reload() { clearTimeout(stateTimer); await store.settled(); await loadView(); update(); }
    async function externalChange(uri) {
      if (uri.toString() !== store.uri.toString() || disposed) return;
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => { void safe(async () => {
        if (!(await store.changed())) return;
        if (dirtyView) { blocked = true; storageError = '表示データが外部で変更されています。上書きを止めました。「配置を再読込」で確認してください。'; storageStatus('error', storageError); return; }
        await loadView(); update();
      })(); }, 120);
    }
    function watch() {
      watcher?.dispose();
      const parent = store.uri.with({ path: store.uri.path.slice(0, store.uri.path.lastIndexOf('/')) || '/' });
      watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(parent, '*'));
      watcher.onDidChange(externalChange); watcher.onDidCreate(externalChange); watcher.onDidDelete(externalChange);
    }
    async function retarget(next) {
      await track(flush()); const oldStore = store, nextUri = stateUri(next.uri);
      if ((await storage.readBytes(oldStore.uri)) !== null && (await storage.readBytes(nextUri)) === null) await vscode.workspace.fs.rename(oldStore.uri, nextUri, { overwrite: false });
      diagnostics.delete(document.uri); panels.delete(key); document = next; key = next.uri.toString();
      store = storage.forSource(next.uri); panels.set(key, record); await loadView(); watch(); update();
    }
    const record = { panel, retarget, flush }; panels.set(key, record);
    handlers.push(webview.onDidReceiveMessage(safe(async message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') { ready = true; post({ type: 'init', viewState, fileName: describe(store.uri) }); storageStatus(storageError ? 'error' : dirtyView ? 'pending' : 'saved', storageError); update(); }
      else if (message.type === 'editConfig') {
        const reply = result => post({ type: 'editResult', requestId: message.requestId, ...result });
        if (editing) { reply({ ok: false, message: '前の編集を保存中です。少し待ってからやり直してください。' }); return; }
        editing = true;
        try {
          if (!Number.isInteger(message.baseVersion) || message.baseVersion !== document.version) throw new Error('設定が別の場所で変更されています。入力内容を確認し、再読込してから編集してください。');
          if (!message.operation || JSON.stringify(message.operation).length > 100000) throw new Error('編集内容が不正です。');
          const before = document.getText(), version = document.version;
          const next = editConfig(before, message.operation);
          if (!document.isDirty && (await storage.readText(document.uri))?.replace(/^\uFEFF/, '') !== before.replace(/^\uFEFF/, '')) throw new Error('設定ファイルが外部で変更されています。ファイルの読込完了後にやり直してください。');
          if (document.version !== version) throw new Error('編集中に設定が変更されました。再読込してください。');
          if (next.text !== before) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(before.length)), next.text);
            if (!(await vscode.workspace.applyEdit(edit))) throw new Error('設定に編集を反映できませんでした。読み取り専用でないか確認してください。');
          }
          if (!(await document.save())) throw new Error('ファイルへの保存に失敗しました。変更はテキストエディターに未保存のまま残っています。設定ファイルを開いて保存してください。');
          if (next.rename?.kind === 'nodes' && Object.hasOwn(viewState.positions || {}, next.rename.from)) {
            const positions = Object.assign(Object.create(null), viewState.positions); positions[next.rename.to] = positions[next.rename.from]; delete positions[next.rename.from];
            viewState = normalizeState({ ...viewState, positions }); dirtyView = true; revision++;
            post({ type: 'init', viewState, fileName: describe(store.uri) }); await track(flush());
          }
          update(); reply({ ok: true, index: next.index, config: parseConfig(document.getText()).config, documentVersion: document.version });
        } catch (error) { update(); reply({ ok: false, message: String(error.message || error) }); }
        finally { editing = false; }
      }
      else if (message.type === 'openSource') await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
      else if (message.type === 'viewState') {
        if (!message.state || JSON.stringify(message.state).length > 200000) return;
        viewState = normalizeState(message.state); revision++; dirtyView = true;
        if (!blocked) { storageStatus('pending'); clearTimeout(stateTimer); stateTimer = setTimeout(() => track(flush()), 700); }
      } else if (message.type === 'saveView') await track(flush());
      else if (message.type === 'reloadView') await reload();
      else if (message.type === 'openViewFile') {
        if ((await storage.readBytes(store.uri)) === null) dirtyView = true;
        await track(flush());
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(store.uri), { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
      } else if (message.type === 'export' && typeof message.svg === 'string' && message.svg.length < 8 * 1024 * 1024) {
        if (!message.svg.startsWith('<svg') || !message.svg.includes('http://www.w3.org/2000/svg')) return;
        const defaultUri = document.uri.with({ path: document.uri.path.replace(/\.jsonc?$/i, '') + '.svg' });
        const target = await vscode.window.showSaveDialog({ defaultUri, filters: { 'SVG画像': ['svg'] }, saveLabel: '相関図を保存' });
        if (!target) return; await storage.writeFile(target, Buffer.from(message.svg, 'utf8')); await vscode.window.showInformationMessage(`相関図を保存しました: ${describe(target)}`);
      }
    })));
    handlers.push(vscode.workspace.onDidChangeTextDocument(event => { if (event.document.uri.toString() !== key) return; document = event.document; clearTimeout(textTimer); textTimer = setTimeout(update, 180); }));
    handlers.push(vscode.workspace.onDidSaveTextDocument(saved => { if (saved.uri.toString() === key) { document = saved; update(); } else void externalChange(saved.uri); }));
    handlers.push(panel.onDidChangeViewState(() => { if (panel.visible) update(); }));
    handlers.push(panel.onDidDispose(() => {
      disposed = true; track(flush()); clearTimeout(textTimer); clearTimeout(watchTimer); watcher?.dispose(); panels.delete(key); diagnostics.delete(document.uri);
      for (const handler of handlers) handler.dispose();
    }));
    watch(); webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] }; webview.html = getHtml(webview, context.extensionUri, vscode.Uri);
  }
  context.subscriptions.push(vscode.commands.registerCommand('characterRelationshipChart.open', safe(open)));
  context.subscriptions.push(vscode.commands.registerCommand('characterRelationshipChart.migrateLegacy', safe(async () => { await migration; await migrate(); })));
  context.subscriptions.push(vscode.commands.registerCommand('characterRelationshipChart.createSample', safe(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const uri = await vscode.window.showSaveDialog({ defaultUri: folder ? vscode.Uri.joinPath(folder, 'characters.relations.jsonc') : undefined, filters: { '相関図の設定（コメント可）': ['jsonc'] }, saveLabel: 'サンプル設定を作成' });
    if (!uri) return;
    if (vscode.workspace.textDocuments.some(d => d.uri.toString() === uri.toString() && d.isDirty)) throw new Error('保存先に未保存の編集があります。先に保存するか、別の名前を選んでください。');
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, 'examples', 'characters.relations.jsonc'));
    await storage.writeFile(uri, bytes); const document = await vscode.workspace.openTextDocument(uri); await vscode.window.showTextDocument(document, vscode.ViewColumn.One); await open(uri);
  })));
  context.subscriptions.push(vscode.workspace.onDidRenameFiles(safe(async event => { for (const file of event.files) { const record = panels.get(file.oldUri.toString()); if (record) await record.retarget(await vscode.workspace.openTextDocument(file.newUri)); } })));
  // This serializer is only for retiring v1.0's persisted webview state.
  context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('characterRelationshipChart.preview', {
    async deserializeWebviewPanel(panel, state) {
      try { await migration; if (!state?.uri) { panel.dispose(); return; } const uri = vscode.Uri.parse(state.uri); await storage.migrateValue(uri, state); await attach(panel, await vscode.workspace.openTextDocument(uri)); }
      catch (e) { panel.dispose(); await vscode.window.showErrorMessage(`相関図: 旧版の画面を復元できませんでした。${e.message || e}`); }
    }
  }));
  finishWrites = async () => { await Promise.all([...panels.values()].map(r => r.flush())); await Promise.all([...pendingWrites]); await storage.settle(); };
  context.subscriptions.push({ dispose() { for (const { panel } of [...panels.values()]) panel.dispose(); } });
}
async function deactivate() { await finishWrites(); }
module.exports = { activate, deactivate };
