'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {editConfig}=require('../src/edit'),{parseConfig}=require('../src/config');
const data={groups:[{id:'g1',label:'一'},{id:'g2',label:'二'}],nodes:[{id:'a',label:'A',group:'g1'},{id:'b',label:'B',groups:['g1','g2']}],edges:[{from:'a',to:'b',label:'友人',setId:'pair'},{from:'b',to:'a',setId:'pair'}]};
const source=()=>JSON.stringify(data,null,2);
test('GUI edits preserve untouched comments, BOM, CRLF, and fields',()=>{
  const text='\uFEFF{\r\n  // 図の注記\r\n  "title": "旧名", // タイトル\r\n  "nodes": [\r\n    // この注記は残す\r\n    { "id": "a", "label": "A", "description": "説明" }\r\n  ],\r\n  "edges": []\r\n}\r\n';
  const result=editConfig(text,{kind:'nodes',action:'save',index:0,value:{id:'a',label:'新名',description:'説明'}});
  assert.equal(result.text.charCodeAt(0),0xfeff);for(const note of ['// 図の注記','// タイトル','// この注記は残す'])assert.ok(result.text.includes(note));
  assert.ok(!result.text.replace(/\r\n/g,'').includes('\n'));assert.equal(result.config.nodes[0].description,'説明');
});
test('renaming a node updates both edge endpoints and returns the layout remap',()=>{
  const result=editConfig(source(),{kind:'nodes',action:'save',index:0,value:{id:'renamed',label:'新名',groups:['g1','g2']}});
  assert.equal(result.config.edges[0].from,'renamed');assert.equal(result.config.edges[1].to,'renamed');assert.equal(result.config.nodes[0].group,undefined);assert.deepEqual(result.config.nodes[0].groups,['g1','g2']);assert.deepEqual(result.rename,{kind:'nodes',from:'a',to:'renamed'});
});
test('renaming and deleting groups updates legacy and multiple memberships',()=>{
  const renamed=editConfig(source(),{kind:'groups',action:'save',index:0,value:{id:'new',label:'新グループ'}});
  assert.equal(renamed.config.nodes[0].group,'new');assert.deepEqual(renamed.config.nodes[1].groups,['new','g2']);
  const deleted=editConfig(renamed.text,{kind:'groups',action:'delete',index:0});assert.equal(deleted.config.nodes[0].group,undefined);assert.deepEqual(deleted.config.nodes[1].groups,['g2']);assert.equal(deleted.config.nodes.length,2);
});
test('deleting a character removes only its connected edges',()=>{
  const d=structuredClone(data);d.edges.push({from:'b',to:'b',shape:'curved'});
  const result=editConfig(JSON.stringify(d),{kind:'nodes',action:'delete',index:0});assert.equal(result.config.nodes.length,1);assert.equal(result.config.edges.length,1);assert.equal(result.config.edges[0].from,'b');
});
test('adding to missing groups and empty node/edge arrays produces valid JSONC',()=>{
  let text='{"nodes":[],"edges":[]}';
  for(const [kind,value] of [['groups',{id:'g',label:'グループ'}],['nodes',{id:'a',label:'A',groups:['g']}],['edges',{from:'a',to:'a',shape:'curved'}]])text=editConfig(text,{kind,action:'add',value}).text;
  assert.deepEqual(parseConfig(text).issues,[]);assert.equal(parseConfig(text).config.edges.length,1);
});
test('GUI validation rejects duplicate IDs, invalid membership and stale targets',()=>{
  assert.throws(()=>editConfig(source(),{kind:'nodes',action:'save',index:0,value:{id:'b',label:'重複'}}),/重複/);
  assert.throws(()=>editConfig(source(),{kind:'nodes',action:'save',index:0,value:{id:'a',label:'A',groups:['missing']}}),/ありません/);
  assert.throws(()=>editConfig(source(),{kind:'nodes',action:'save',index:500,value:{}}),/見つかりません/);
  assert.throws(()=>editConfig(source(),{kind:'__proto__',action:'save',value:{}}),/未対応/);
});
test('GUI shape changes update all explicit members of a parallel set together',()=>{
  const d=structuredClone(data);d.edges.forEach(e=>e.shape='straight');
  const result=editConfig(JSON.stringify(d),{kind:'edges',action:'save',index:0,value:{...d.edges[0],shape:'curved'}});
  assert.deepEqual(result.config.edges.map(e=>e.shape),['curved','curved']);
});
