'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parseConfig} = require('../src/config');
const minimal = { nodes: [{id:'a',label:'人物A'},{id:'b',label:'人物B'}], edges: [{from:'a',to:'b'}] };
const parse = value => parseConfig(JSON.stringify(value));

test('bundled Japanese sample is valid and preserves asymmetric parallel edges', () => {
  const {graph,issues}=parseConfig(fs.readFileSync(path.join(__dirname,'../examples/characters.relations.jsonc'),'utf8'));
  assert.deepEqual(issues,[]); assert.equal(graph.nodes.length,6); assert.equal(graph.edges.length,8);
  assert.equal(graph.edges[0].arrow,'none'); assert.equal(graph.edges[1].arrow,'forward');
  assert.equal(graph.nodes[0].color,graph.groups[0].color);
});
test('comments, trailing commas, BOM and comment-like strings are supported', () => {
  const {graph,issues}=parseConfig('\ufeff{ // comment\n"nodes":[{"id":"a","label":"https://x/*y*/"},],/*yes*/"edges":[],}');
  assert.deepEqual(issues,[]); assert.equal(graph.nodes[0].label,'https://x/*y*/');
});
test('syntax errors carry a source offset for the VS Code problem list', () => {
  const result=parseConfig('{\n"nodes": [}\n'); assert.ok(result.issues.length); assert.ok(result.issues[0].offset>0); assert.equal(result.graph,undefined);
});
test('duplicate JSON keys and node IDs are rejected', () => {
  assert.match(parseConfig('{"nodes":[],"nodes":[],"edges":[]}').issues[0].message,/重複/);
  assert.match(parse({nodes:[{id:'a',label:'A'},{id:'a',label:'B'}],edges:[]}).issues[0].message,/重複/);
});
test('undefined endpoints and undefined groups are rejected', () => {
  const data=structuredClone(minimal); data.edges[0].to='missing'; data.nodes[0].group='missing';
  assert.equal(parse(data).issues.length,2);
});
test('invalid color, arrow, style and unknown fields are rejected', () => {
  const data=structuredClone(minimal); Object.assign(data.edges[0],{color:'url(https://x)',arrow:'other',style:'other',lable:'typo'});
  assert.equal(parse(data).issues.length,4);
});
test('coordinates must be paired, finite and bounded', () => {
  const data=structuredClone(minimal); data.nodes[0].x=5;
  assert.match(parse(data).issues[0].message,/両方/);
  data.nodes[0].y=20001; assert.match(parse(data).issues[0].message,/座標/);
  data.nodes[0].y=-100; assert.deepEqual(parse(data).issues,[]);
});
test('empty diagrams are valid; null, wrong collections and excessive size are not', () => {
  assert.deepEqual(parse({nodes:[],edges:[]}).issues,[]);
  assert.ok(parse(null).issues.length); assert.ok(parse({nodes:{},edges:[]}).issues.length);
  assert.ok(parse({nodes:Array.from({length:201},(_,i)=>({id:String(i),label:'人'})),edges:[]}).issues.length);
});
test('special IDs and markup remain plain data', () => {
  const r=parse({nodes:[{id:'__proto__',label:'<script>alert(1)</script>'},{id:'constructor',label:'B'}],edges:[{from:'__proto__',to:'constructor'}]});
  assert.deepEqual(r.issues,[]); assert.equal(r.graph.nodes[0].label,'<script>alert(1)</script>'); assert.equal({}.polluted,undefined);
});
test('defaults support the smallest useful configuration', () => {
  const {graph}=parse(minimal); assert.equal(graph.layout,'auto'); assert.equal(graph.edges[0].arrow,'forward'); assert.equal(graph.edges[0].style,'solid');
});
test('sets accept opposing directions, reject blank IDs and different endpoint pairs',()=>{
  const config={nodes:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}],edges:[{from:'a',to:'b',setId:'same'},{from:'b',to:'a',setId:'same'}]};
  assert.deepEqual(parse(config).issues,[]);config.edges[1].to='c';assert.match(parse(config).issues[0].message,/同じ2つ/);
  config.edges[1].setId=' ';assert.ok(parse(config).issues.length);
});
test('multiple group memberships retain order, legacy group support and primary color',()=>{
  const data=structuredClone(minimal);data.groups=[{id:'g1',label:'一',color:'#123'},{id:'g2',label:'二',color:'#456'}];data.nodes[0].groups=['g2','g1'];data.nodes[1].group='g1';
  const r=parse(data);assert.deepEqual(r.issues,[]);assert.deepEqual(r.graph.nodes[0].groups,['g2','g1']);assert.equal(r.graph.nodes[0].color,'#456');assert.deepEqual(r.graph.nodes[1].groups,['g1']);
  data.nodes[0].groups=['g1','g1'];assert.match(parse(data).issues[0].message,/重複/);
  data.nodes[0].groups=['missing'];assert.match(parse(data).issues[0].message,/ありません/);
  data.nodes[0].groups=['g1'];data.nodes[0].group='g1';assert.match(parse(data).issues[0].message,/どちらか/);
});
test('explicit line shape is validated and inherited by the same set',()=>{
  const data=structuredClone(minimal);data.edges=[{from:'a',to:'b',setId:'pair',shape:'straight'},{from:'b',to:'a',setId:'pair'}];
  assert.deepEqual(parse(data).graph.edges.map(e=>e.shape),['straight','straight']);
  data.edges[1].shape='curved';assert.match(parse(data).issues[0].message,/同じ shape/);
  data.edges=[{from:'a',to:'a',shape:'straight'}];assert.match(parse(data).issues[0].message,/自分自身/);
  data.edges[0].shape='other';assert.match(parse(data).issues[0].message,/いずれか/);
});
test('arbitrary jsonc files have explorer and editor context menu entries',()=>{
  const pkg=require('../package.json');
  for(const name of ['explorer/context','editor/context'])assert.match(pkg.contributes.menus[name].find(m=>m.command==='characterRelationshipChart.open').when,/resourceExtname == \.jsonc/);
});
