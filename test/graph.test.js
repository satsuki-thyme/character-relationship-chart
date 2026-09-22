'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../media/graph');
const fixture={nodes:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}],edges:[{index:0,from:'a',to:'b',arrow:'forward'},{index:1,from:'b',to:'a',arrow:'forward'},{index:2,from:'a',to:'a',arrow:'both'}]};
test('layout is deterministic and does not mutate configuration',()=>{
  const before=JSON.stringify(fixture); const a=G.layout(fixture,'auto'),b=G.layout(fixture,'auto');
  assert.deepEqual(a,b); assert.equal(JSON.stringify(fixture),before);
  assert.ok(a.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
});
test('fixed coordinates and dragged positions survive layout, changed config wins',()=>{
  const config={nodes:[{id:'a',x:20,y:30},{id:'b'}],edges:[]};
  assert.equal(G.layout(config,'auto')[0].x,20);
  const moved={a:{x:500,y:600,source:'20,30'}};
  assert.equal(G.layout(config,'auto',moved)[0].x,500);
  config.nodes[0].x=25; assert.equal(G.layout(config,'auto',moved)[0].x,25);
});
test('reverse and parallel edges use separate routes and labels',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:400,y:0}];
  const paths=G.routes(nodes,fixture.edges.slice(0,2));
  assert.notEqual(paths[0].d,paths[1].d); assert.ok(paths[0].label.y*paths[1].label.y<0);
});
test('self loops and overlapping nodes remain finite',()=>{
  const nodes=fixture.nodes.map(n=>({...n,x:0,y:0})); const paths=G.routes(nodes,fixture.edges);
  assert.ok(paths[2].d.includes(' C ')); assert.ok(paths.every(p=>!p.d.includes('NaN')&&!p.d.includes('Infinity')));
  const bounds=G.bounds(nodes,paths); assert.ok(bounds.height>G.HEIGHT);
});
test('200 nodes can be laid out without instability',()=>{
  const config={nodes:Array.from({length:200},(_,i)=>({id:String(i)})),edges:[]};
  assert.ok(G.layout(config,'auto').every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
});
test('wrapping preserves surrogate pairs and truncates clearly',()=>{
  assert.deepEqual(G.wrap('😀😄😁😆',2,1),['😀…']);
  assert.deepEqual(G.wrap('日本語',3,2),['日本語']);
});
test('a relation curves around a card between its endpoints',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:600,y:0},{id:'middle',x:300,y:0}];
  const [route]=G.routes(nodes,[{index:0,from:'a',to:'b',arrow:'forward',label:'関係'}]);
  assert.ok(Math.abs(route.label.y)>65);
  assert.ok(route.extra.every(p=>Math.abs(p.x-300)>G.WIDTH/2+10||Math.abs(p.y)>G.HEIGHT/2+10));
});
test('setId creates equally spaced parallel paths even with opposite arrow directions',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:600,y:0}];
  const edges=[{index:0,from:'a',to:'b',setId:'pair',arrow:'forward'},{index:1,from:'b',to:'a',setId:'pair',arrow:'forward'}];
  const [a,b]=G.routes(nodes,edges);assert.equal(a.parallel.centerOffset,b.parallel.centerOffset);
  for(let i=0;i<a.samples.length;i++){assert.ok(Math.abs(a.samples[i].x-b.samples[i].x)<1e-8);assert.ok(Math.abs(Math.abs(a.samples[i].y-b.samples[i].y)-48)<1e-8);}
  const firstX=Number(b.d.split(' ')[1]);assert.ok(firstX>400);
});
test('a whole parallel set takes one shared detour around an obstructing card',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:600,y:0},{id:'c',x:300,y:0}];
  const edges=[{index:0,from:'a',to:'b',setId:'pair',arrow:'forward'},{index:1,from:'b',to:'a',setId:'pair',arrow:'forward'}];
  const [a,b]=G.routes(nodes,edges);assert.notEqual(a.parallel.centerOffset,0);assert.equal(a.parallel.centerOffset,b.parallel.centerOffset);
  for(let i=0;i<a.samples.length;i++)assert.ok(Math.abs(Math.hypot(a.samples[i].x-b.samples[i].x,a.samples[i].y-b.samples[i].y)-48)<1e-6);
  assert.ok([a,b].every(r=>r.extra.every(p=>Math.abs(p.x-300)>G.WIDTH/2||Math.abs(p.y)>G.HEIGHT/2)));
});
test('set membership is independent of array adjacency and special IDs remain valid',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:600,y:0}];
  const edges=[{index:0,from:'a',to:'b',setId:'__proto__',arrow:'none'},{index:1,from:'a',to:'b',arrow:'none'},{index:2,from:'b',to:'a',setId:'__proto__',arrow:'both'}];
  const routes=G.routes(nodes,edges);assert.equal(routes.length,3);assert.equal(routes[0].parallel.centerOffset,routes[2].parallel.centerOffset);assert.equal(routes[1].parallel,undefined);
});
test('straight lines remain straight through obstacles and opposing set members are parallel',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:600,y:300},{id:'block',x:300,y:150}];
  const edges=[{index:0,from:'a',to:'b',shape:'straight',arrow:'forward',setId:'s'},{index:1,from:'b',to:'a',shape:'straight',arrow:'both',setId:'s'}];
  const paths=G.routes(nodes,edges);for(const r of paths){assert.match(r.d,/^M [-.\d]+ [-.\d]+ L [-.\d]+ [-.\d]+$/);assert.equal(r.extra.length,2);}
  const [a,b]=paths.map(r=>{const [p,q]=r.extra;return {x:q.x-p.x,y:q.y-p.y};});assert.ok(Math.abs(a.x*b.y-a.y*b.x)<1e-7);assert.notEqual(paths[0].d,paths[1].d);
  assert.ok(Number(paths[1].d.split(' ')[1])>500);
});
test('explicit curved mode bends a single unobstructed edge and a parallel set',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:600,y:0}];
  const one=G.routes(nodes,[{index:0,from:'a',to:'b',shape:'curved',arrow:'forward'}])[0];assert.match(one.d,/Q/);assert.ok(Math.abs(one.label.y)>30);
  const set=G.routes(nodes,[{index:0,from:'a',to:'b',setId:'s',shape:'curved',arrow:'forward'},{index:1,from:'b',to:'a',setId:'s',shape:'curved',arrow:'forward'}]);assert.ok(set.every(r=>Math.abs(r.parallel.centerOffset)>0));
});
