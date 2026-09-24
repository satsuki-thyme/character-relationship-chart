'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStorage,normalizeState,stateUri}=require('../src/storage');
function fixture() {
  const files=new Map(),writes=[],states=new Map(),deleted=[],textDocuments=[];let fail=false;
  class Uri {constructor(path){this.path=path;}toString(){return 'file://'+this.path;}with(o){return new Uri(o.path);}static parse(s){return new Uri(s.slice(7));}static joinPath(u,p){return new Uri(u.path+'/'+p);}}
  const miss=()=>Object.assign(new Error('missing'),{code:'FileNotFound'});
  const vscode={Uri,workspace:{textDocuments,workspaceFolders:[{uri:new Uri('/work')}],fs:{
    readFile:async u=>{if(!files.has(u.path))throw miss();return Buffer.from(files.get(u.path));},
    writeFile:async(u,b)=>{if(fail)throw Object.assign(new Error('read only'),{code:'NoPermissions'});files.set(u.path,Buffer.from(b).toString());writes.push(u.path);},
    stat:async u=>{if(!files.has(u.path))throw miss();return {};}}}};
  const context={workspaceState:{keys:()=>[...states.keys()],get:k=>states.get(k),update:async(k,v)=>{assert.equal(v,undefined);assert.ok([...files.keys()].some(p=>p.endsWith('.view.json')));states.delete(k);deleted.push(k);}}};
  const source=new Uri('/work/cast.relations.jsonc'),store=createStorage(vscode);
  return {files,writes,states,deleted,textDocuments,context,source,store,Uri,setFail:v=>{fail=v;}};
}
const state={version:1,layout:'auto',configLayout:'auto',positions:{hero:{x:123,y:456,source:','}},camera:{x:10,y:20,scale:1,width:800,height:600},ui:{details:false,focus:true}};
test('display state persists beside the source and a different machine can load it',async()=>{
  const h=fixture(),store=h.store.forSource(h.source);await store.load();await store.save(state);
  const name='/work/cast.relations.jsonc.view.json';assert.ok(h.files.has(name));assert.ok(!h.files.get(name).includes('file://'));assert.deepEqual(JSON.parse(h.files.get(name)),state);
  const second=fixture();second.files.set(name,h.files.get(name));assert.equal((await second.store.forSource(second.source).load()).positions.hero.x,123);
});
test('state updates write only the sidecar, create no backups, and equal state is a no-op',async()=>{
  const h=fixture(),s=h.store.forSource(h.source);await s.load();await s.save(state);const before=h.files.get(s.uri.path);
  await s.save({...state,layout:'circle'});const backups=[...h.files].filter(([p])=>/\.(?:backup-)?\d{4}-\d{2}-\d{2}-\d{2,}\.json$/.test(p));assert.equal(backups.length,0);assert.equal(h.files.size,1);assert.notEqual(h.files.get(s.uri.path),before);
  const count=h.writes.length;await s.save({...state,layout:'circle'});assert.equal(h.writes.length,count);
});
test('external file changes are not overwritten by pending local edits',async()=>{
  const h=fixture(),s=h.store.forSource(h.source);await s.load();await s.save(state);const external=JSON.stringify({...state,layout:'circle'});h.files.set(s.uri.path,external);
  await assert.rejects(()=>s.save({...state,ui:{focus:false}}),/外部/);assert.equal(h.files.get(s.uri.path),external);
});
test('malformed and unsaved state files are preserved',async()=>{
  const h=fixture(),s=h.store.forSource(h.source);h.files.set(s.uri.path,'{ broken');await assert.rejects(()=>s.load());await assert.rejects(()=>s.save(state),/読み込めていない/);assert.equal(h.files.get(s.uri.path),'{ broken');
  h.files.set(s.uri.path,JSON.stringify(state));await s.load();h.textDocuments.push({uri:s.uri,isDirty:true});await assert.rejects(()=>s.save({...state,layout:'circle'}),/未保存/);
});
test('rapid saves are serialized and the final view wins',async()=>{
  const h=fixture(),s=h.store.forSource(h.source);await s.load();await Promise.all([s.save(state),s.save({...state,layout:'circle'}),s.save({...state,ui:{focus:false}})]);
  assert.equal(JSON.parse(h.files.get(s.uri.path)).ui.focus,false);assert.equal(h.writes.length,3);
});
test('legacy state is deleted only after successful file migration',async()=>{
  const h=fixture();h.states.set('view:'+h.source.toString(),{...state,uri:h.source.toString()});assert.deepEqual(await h.store.migrateLegacy(h.context),[]);
  assert.equal(h.states.size,0);assert.equal(h.deleted.length,1);assert.equal(JSON.parse(h.files.get(stateUri(h.source).path)).positions.hero.y,456);
});
test('migration prefers the current shared file without creating backup files',async()=>{
  const h=fixture();h.files.set(stateUri(h.source).path,JSON.stringify({...state,layout:'circle'}));h.states.set('view:'+h.source.toString(),state);await h.store.migrateLegacy(h.context);
  assert.equal(JSON.parse(h.files.get(stateUri(h.source).path)).layout,'circle');assert.equal(h.files.size,1);assert.equal(h.writes.length,0);assert.equal(h.states.size,0);
});
test('a failed migration retains the original state instead of losing data',async()=>{
  const h=fixture();h.states.set('view:'+h.source.toString(),state);h.setFail(true);const errors=await h.store.migrateLegacy(h.context);assert.equal(errors.length,1);assert.equal(h.states.size,1);assert.equal(h.deleted.length,0);
});
test('portable state excludes absolute source paths and rejects invalid coordinates',()=>{
  assert.throws(()=>normalizeState({...state,uri:'file:///private'}),/未対応/);assert.throws(()=>normalizeState({...state,camera:{x:0,y:0,scale:Infinity}}),/倍率/);
  const legacy=normalizeState({...state,uri:'file:///private'},true);assert.equal(legacy.uri,undefined);
});
test('an oversized existing view file blocks migration without deleting legacy state',async()=>{
  const h=fixture(),existing=JSON.stringify(state).padEnd(200001,' ');
  h.files.set(stateUri(h.source).path,existing);h.states.set('view:'+h.source.toString(),state);
  assert.equal((await h.store.migrateLegacy(h.context)).length,1);
  assert.equal(h.states.size,1);assert.equal(h.deleted.length,0);assert.equal(h.writes.length,0);
  assert.equal(h.files.get(stateUri(h.source).path),existing);
});
