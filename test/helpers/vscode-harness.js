'use strict';
const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
const base = path.resolve(__dirname, '../..');
function harness() {
  const commands = new Map(), documents = new Map(), files = new Map(), messages = [], created = [], warnings = [], infos = [];
  const errors = [], selections = [], diag = new Map(), states = new Map(), stateWrites = [], watchers = [], diagnosticNames = [], serializers = new Map();
  function emitter() { const callbacks = new Set(); return { on(cb) { callbacks.add(cb); return { dispose() { callbacks.delete(cb); } }; }, async fire(e) { for (const cb of [...callbacks]) await cb(e); }, size() { return callbacks.size; } }; }
  const changed = emitter(), saved = emitter(), renamed = emitter();
  class Uri {
    constructor(value) { const url = new URL(value); this.scheme=url.protocol.slice(0,-1);this.path=decodeURIComponent(url.pathname); }
    toString() { return `${this.scheme}://${this.path}`; }
    with(parts) { const u=new Uri(this.toString());Object.assign(u,parts);return u; }
    static parse(s) { return new Uri(s); }
    static joinPath(uri,...segments) { return uri.with({path:path.posix.join(uri.path,...segments)}); }
  }
  const missing=()=>Object.assign(new Error('Not found'),{code:'FileNotFound'});
  function document(uri, text) {
    const doc={uri,languageId:uri.path.endsWith('.jsonc')?'jsonc':'json',isDirty:false,version:1,text,
      async save(){files.set(this.uri.toString(),Buffer.from(this.text));this.isDirty=false;await saved.fire(this);return true;},
      getText(){return this.text;},positionAt(offset){const lines=this.text.slice(0,offset).split('\n');return {line:lines.length-1,character:lines.at(-1).length};}};
    documents.set(uri.toString(),doc);files.set(uri.toString(),Buffer.from(text));return doc;
  }
  function panel(viewType) {
    const received=emitter(), viewChanged=emitter(), disposed=emitter();
    const item={viewType,visible:true,disposed:false,reveals:0,webview:{cspSource:'vscode-webview://test',asWebviewUri:uri=>uri,postMessage:async m=>{messages.push(m);return true;},onDidReceiveMessage:received.on},
      onDidChangeViewState:viewChanged.on,onDidDispose:disposed.on,reveal(){this.reveals++;},dispose(){if(this.disposed)return;this.disposed=true;void disposed.fire();},receive:received.fire};
    created.push(item);return item;
  }
  const vscode={Uri,WorkspaceEdit:class{constructor(){this.edits=[];}replace(uri,range,text){this.edits.push({uri,range,text});}},RelativePattern:class{constructor(base,pattern){this.baseUri=base;this.pattern=pattern;}},ViewColumn:{One:1,Beside:2},DiagnosticSeverity:{Error:0},Range:class {constructor(a,b){this.start=a;this.end=b;}},Diagnostic:class {constructor(range,message,severity){Object.assign(this,{range,message,severity});}},
    languages:{createDiagnosticCollection:name=>{diagnosticNames.push(name);return {set:(u,v)=>diag.set(u.toString(),v),delete:u=>diag.delete(u.toString()),dispose:()=>diag.clear()};}},
    commands:{registerCommand:(id,fn)=>{commands.set(id,fn);return {dispose(){commands.delete(id);}};}},
    workspace:{async applyEdit(edit){for(const e of edit.edits){const doc=documents.get(e.uri.toString());doc.text=e.text;doc.version++;doc.isDirty=true;await changed.fire({document:doc});}return true;},get textDocuments(){return [...documents.values()];},workspaceFolders:[{uri:Uri.parse('file:///work')}],
      fs:{readFile:async u=>{if(!files.has(u.toString()))throw missing();return files.get(u.toString());},writeFile:async(u,bytes)=>files.set(u.toString(),Buffer.from(bytes)),stat:async u=>{if(!files.has(u.toString()))throw missing();return {}; },rename:async(a,b)=>{if(!files.has(a.toString()))throw missing();files.set(b.toString(),files.get(a.toString()));files.delete(a.toString());}},
      openTextDocument:async u=>{if(documents.has(u.toString()))return documents.get(u.toString());if(!files.has(u.toString()))throw missing();return document(u,files.get(u.toString()).toString());},
      createFileSystemWatcher:()=>{const a=emitter(),b=emitter(),c=emitter();const w={onDidChange:a.on,onDidCreate:b.on,onDidDelete:c.on,change:a.fire,create:b.fire,delete:c.fire,dispose(){this.disposed=true;}};watchers.push(w);return w;},onDidChangeTextDocument:changed.on,onDidSaveTextDocument:saved.on,onDidRenameFiles:renamed.on},
    window:{showErrorMessage:async m=>errors.push(m),showInformationMessage:async m=>infos.push(m),showWarningMessage:async m=>warnings.push(m),
      showOpenDialog:async()=>[],showSaveDialog:async()=>selections.shift(),showTextDocument:async doc=>{vscode.window.activeTextEditor={document:doc};return {};},createWebviewPanel:panel,
      registerWebviewPanelSerializer:(id,serializer)=>{serializers.set(id,serializer);return {dispose(){serializers.delete(id);}};}}};
  const context={extensionUri:Uri.parse('file://'+base),subscriptions:[],workspaceState:{keys:()=>[...states.keys()],get:(k,d)=>states.get(k)||d,update:async(k,v)=>{stateWrites.push({key:k,value:v});if(v===undefined)states.delete(k);else states.set(k,structuredClone(v));}}};
  const module={exports:{}};const realRequire=createRequire(path.join(base,'src/extension.js'));
  new Function('require','module','exports',fs.readFileSync(path.join(base,'src/extension.js'),'utf8'))(id=>id==='vscode'?vscode:realRequire(id),module,module.exports);
  module.exports.activate(context);
  files.set(Uri.joinPath(context.extensionUri,'examples','characters.relations.jsonc').toString(),fs.readFileSync(path.join(base,'examples/characters.relations.jsonc')));
  const dispose=async()=>{for(const s of [...context.subscriptions].reverse())s.dispose();await module.exports.deactivate();};
  return {vscode,Uri,commands,document,created,messages,errors,infos,selections,files,diag,changed,renamed,states,stateWrites,watchers,diagnosticNames,serializers,dispose};
}
module.exports = { harness };
