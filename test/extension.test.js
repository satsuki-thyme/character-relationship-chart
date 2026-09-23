'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { harness } = require('./helpers/vscode-harness');
test('preview reuses panels, reports errors and cleans event handlers',async()=>{
  const h=harness();try{
    const pkg=require('../package.json');
    assert.deepEqual([...h.commands.keys()].sort(),pkg.contributes.commands.map(c=>c.command).sort());
    assert.deepEqual([...h.serializers.keys()].map(id=>'onWebviewPanel:'+id).sort(),[...pkg.activationEvents].sort());
    assert.deepEqual(h.diagnosticNames,[pkg.name]);
    const doc=h.document(h.Uri.parse('file:///work/test.relations.jsonc'),'{"nodes":[{"id":"a","label":"A"}],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);await h.created[0].receive({type:'ready'});
    assert.equal(h.created[0].viewType,'characterRelationshipChart.preview.v2');
    assert.equal(h.messages.at(-1).graph.nodes[0].label,'A');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);assert.equal(h.created.length,1);assert.equal(h.created[0].reveals,1);
    doc.text='{ invalid';doc.isDirty=true;await h.changed.fire({document:doc});await new Promise(r=>setTimeout(r,230));
    assert.ok(h.messages.at(-1).issues.length);assert.equal(h.messages.at(-1).graph,undefined);assert.ok(h.diag.get(doc.uri.toString()).length);
    h.created[0].dispose();assert.equal(h.changed.size(),0);assert.equal(h.diag.size,0);assert.deepEqual(h.errors,[]);
  }finally{await h.dispose();}
});
test('sample creation overwrites the selected file without creating a backup',async()=>{
  const h=harness();try{
    const uri=h.Uri.parse('file:///work/characters.relations.jsonc');h.files.set(uri.toString(),Buffer.from('old content'));
    const count=h.files.size;h.selections.push(uri);await h.commands.get('characterRelationshipChart.createSample')();
    assert.equal(h.files.size,count);assert.match(h.files.get(uri.toString()).toString(),/星明かりの旅/);assert.equal(h.created.length,1);assert.deepEqual(h.errors,[]);
  }finally{await h.dispose();}
});
test('sample creation refuses to overwrite unsaved edits',async()=>{
  const h=harness();try{
    const uri=h.Uri.parse('file:///work/characters.relations.jsonc'),doc=h.document(uri,'original');doc.isDirty=true;doc.text='unsaved';
    h.selections.push(uri);await h.commands.get('characterRelationshipChart.createSample')();
    assert.equal(h.files.get(uri.toString()).toString(),'original');assert.match(h.errors[0],/未保存/);assert.equal(h.created.length,0);
  }finally{await h.dispose();}
});
test('SVG export overwrites the chosen file without creating a backup',async()=>{
  const h=harness();try{
    const doc=h.document(h.Uri.parse('file:///work/test.relations.jsonc'),'{"nodes":[],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);const uri=h.Uri.parse('file:///work/test.svg');
    h.files.set(uri.toString(),Buffer.from('old svg'));h.selections.push(uri);
    const svg='<svg xmlns="http://www.w3.org/2000/svg"><text>人物</text></svg>';
    await h.created[0].receive({type:'export',svg});
    assert.equal(h.files.get(uri.toString()).toString(),svg);
    assert.equal([...h.files.entries()].filter(([p,v])=>/test\.(?:backup-)?\d{4}-\d{2}-\d{2}-\d{2,}\.svg$/.test(p)&&v.toString()==='old svg').length,0);assert.deepEqual(h.errors,[]);
  }finally{await h.dispose();}
});
test('VS Code file rename retargets the preview',async()=>{
  const h=harness();try{
    const a=h.document(h.Uri.parse('file:///work/a.jsonc'),'{"nodes":[],"edges":[]}');
    const b=h.document(h.Uri.parse('file:///work/b.jsonc'),'{"nodes":[],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(a.uri);await h.created[0].receive({type:'ready'});
    await h.renamed.fire({files:[{oldUri:a.uri,newUri:b.uri}]});assert.equal(h.messages.at(-1).fileName,'b.jsonc');
    await h.commands.get('characterRelationshipChart.open')(b.uri);assert.equal(h.created.length,1);
  }finally{await h.dispose();}
});
test('preview gestures save to the sidecar, flush on close, and never store a Memento value',async()=>{
  const h=harness();try{
    const doc=h.document(h.Uri.parse('file:///work/cast.relations.jsonc'),'{"nodes":[],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);await h.created[0].receive({type:'ready'});
    const state={version:1,positions:{a:{x:25,y:70,source:','}},ui:{focus:true}};
    await h.created[0].receive({type:'viewState',state});
    await h.created[0].receive({type:'saveView'});
    const key=doc.uri.toString()+'.view.json';assert.equal(JSON.parse(h.files.get(key)).positions.a.x,25);
    await h.created[0].receive({type:'viewState',state:{...state,ui:{focus:false}}});h.created[0].dispose();await h.dispose();
    assert.equal(JSON.parse(h.files.get(key)).ui.focus,false);assert.ok(h.stateWrites.every(w=>w.value===undefined));assert.deepEqual(h.errors,[]);
  }finally{await h.dispose();}
});
test('an external display file update reloads the preview while preserving its source',async()=>{
  const h=harness();try{
    const doc=h.document(h.Uri.parse('file:///work/cast.relations.jsonc'),'{"nodes":[],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);await h.created[0].receive({type:'ready'});
    const uri=doc.uri.with({path:doc.uri.path+'.view.json'});
    h.files.set(uri.toString(),Buffer.from(JSON.stringify({version:1,layout:'circle',configLayout:'auto',positions:{}})));
    await h.watchers[0].change(uri);await new Promise(r=>setTimeout(r,180));
    const init=h.messages.filter(m=>m.type==='init').at(-1);assert.equal(init.viewState.layout,'circle');assert.equal(h.messages.at(-1).fileName,'cast.relations.jsonc');assert.deepEqual(h.errors,[]);
  }finally{await h.dispose();}
});
test('source rename also moves its sidecar without writing private state',async()=>{
  const h=harness();try{
    const a=h.document(h.Uri.parse('file:///work/a.jsonc'),'{"nodes":[],"edges":[]}'),b=h.document(h.Uri.parse('file:///work/b.jsonc'),'{"nodes":[],"edges":[]}');
    h.files.set(a.uri.toString()+'.view.json',Buffer.from(JSON.stringify({version:1,positions:{},layout:'circle'})));
    await h.commands.get('characterRelationshipChart.open')(a.uri);await h.created[0].receive({type:'ready'});
    await h.renamed.fire({files:[{oldUri:a.uri,newUri:b.uri}]});assert.ok(!h.files.has(a.uri.toString()+'.view.json'));
    assert.equal(JSON.parse(h.files.get(b.uri.toString()+'.view.json')).layout,'circle');assert.deepEqual(h.stateWrites,[]);
  }finally{await h.dispose();}
});
test('GUI saves into an arbitrary filename through the text document without backups',async()=>{
  const h=harness();try{
    const uri=h.Uri.parse('file:///work/登場人物.jsonc'),doc=h.document(uri,'{ // comment\n"nodes":[{"id":"a","label":"A"}],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(uri);await h.created[0].receive({type:'ready'});
    assert.equal(h.messages.at(-1).documentVersion,1);assert.equal(h.messages.at(-1).config.nodes[0].label,'A');
    const count=h.files.size;
    await h.created[0].receive({type:'editConfig',requestId:1,baseVersion:1,operation:{kind:'nodes',action:'save',index:0,value:{id:'a',label:'新しい名前',groups:[]}}});
    assert.equal(h.messages.at(-1).ok,true);assert.equal(doc.version,2);assert.equal(doc.isDirty,false);assert.match(h.files.get(uri.toString()).toString(),/新しい名前/);assert.match(doc.text,/comment/);assert.equal(h.files.size,count);
  }finally{await h.dispose();}
});
test('GUI rejects a stale document revision and retains unsaved edits on save failure',async()=>{
  const h=harness();try{
    const doc=h.document(h.Uri.parse('file:///work/free.jsonc'),'{"nodes":[],"edges":[]}');await h.commands.get('characterRelationshipChart.open')(doc.uri);await h.created[0].receive({type:'ready'});
    const operation={kind:'nodes',action:'add',value:{id:'a',label:'A'}};
    await h.created[0].receive({type:'editConfig',requestId:1,baseVersion:0,operation});assert.equal(h.messages.at(-1).ok,false);assert.equal(doc.text,'{"nodes":[],"edges":[]}');
    doc.save=async()=>false;await h.created[0].receive({type:'editConfig',requestId:2,baseVersion:1,operation});assert.equal(h.messages.at(-1).ok,false);assert.match(h.messages.at(-1).message,/未保存/);assert.equal(doc.isDirty,true);assert.match(doc.text,/"A"/);assert.equal(h.files.get(doc.uri.toString()).toString(),'{"nodes":[],"edges":[]}');
  }finally{await h.dispose();}
});
test('renaming a node through the GUI preserves its dragged position in the sidecar',async()=>{
  const h=harness();try{
    const doc=h.document(h.Uri.parse('file:///work/free.jsonc'),'{"nodes":[{"id":"a","label":"A"}],"edges":[]}');
    await h.commands.get('characterRelationshipChart.open')(doc.uri);await h.created[0].receive({type:'ready'});
    await h.created[0].receive({type:'viewState',state:{version:1,positions:{a:{x:88,y:99,source:','}}}});
    await h.created[0].receive({type:'editConfig',requestId:1,baseVersion:1,operation:{kind:'nodes',action:'save',index:0,value:{id:'new',label:'A'}}});
    assert.equal(h.messages.at(-1).ok,true);const state=JSON.parse(h.files.get(doc.uri.toString()+'.view.json'));assert.equal(state.positions.new.x,88);assert.equal(state.positions.a,undefined);
    await h.created[0].receive({type:'editConfig',requestId:2,baseVersion:2,operation:{kind:'nodes',action:'save',index:0,value:{id:'__proto__',label:'A'}}});
    assert.equal(h.messages.at(-1).ok,true);assert.equal(JSON.parse(h.files.get(doc.uri.toString()+'.view.json')).positions.__proto__.x,88);
  }finally{await h.dispose();}
});
test('a UTF-8 BOM on disk does not falsely reject a GUI edit of the text document',async()=>{
  const h=harness();try{
    const doc=h.document(h.Uri.parse('file:///work/bom.jsonc'),'{"nodes":[],"edges":[]}');h.files.set(doc.uri.toString(),Buffer.from('\ufeff'+doc.text));
    await h.commands.get('characterRelationshipChart.open')(doc.uri);await h.created[0].receive({type:'ready'});
    await h.created[0].receive({type:'editConfig',requestId:1,baseVersion:1,operation:{kind:'general',action:'save',value:{title:'BOM対応'}}});assert.equal(h.messages.at(-1).ok,true);
  }finally{await h.dispose();}
});
