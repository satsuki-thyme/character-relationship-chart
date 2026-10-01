'use strict';
// Actual Chromium rendering/input + production UI/adapter/extension.
// The VS Code API and filesystem are simulated; this is not Extension Host.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const { harness } = require('./helpers/vscode-harness');
const { parseConfig } = require('../packages/core/config');
const root = path.resolve(__dirname, '..');
const sample = fs.readFileSync(path.join(root, 'examples/characters.relations.jsonc'), 'utf8');
const h = harness(), uri = h.Uri.parse('file:///work/cast.jsonc'), doc = h.document(uri, sample);
let panel, visibility, origin;
const create = h.vscode.window.createWebviewPanel;
h.vscode.window.createWebviewPanel = (...args) => {
  const p = create(...args), subscribe = p.onDidChangeViewState;
  p.onDidChangeViewState = fn => { visibility = fn; return subscribe(fn); };
  return p;
};
const bridge = `(() => {
  let cursor = 0, pending = Promise.resolve();
  const send = message => { pending = pending.then(async () => {
    const response = await fetch('/messages', {method:'POST',body:JSON.stringify(message)});
    if (!response.ok) throw Error(await response.text());
  }); };
  window.acquireVsCodeApi = () => ({setState(){},postMessage:send});
  const pump = async () => { await pending; const r = await (await fetch('/messages?cursor='+cursor)).json(); cursor=r.cursor;
    for(const message of r.messages)window.dispatchEvent(new MessageEvent('message',{data:message})); };
  setInterval(()=>pump().catch(e=>{throw e;}),40);
})();`;
async function open() { await h.commands.get('characterRelationshipChart.open')(uri); panel = h.created.at(-1); }
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (url.pathname === '/vscode' || url.pathname === '/reopen') {
      if (url.pathname === '/reopen') { panel.dispose(); await new Promise(r=>setTimeout(r,40)); await open(); }
      const nonce = panel.webview.html.match(/<script nonce="([^"]+)"/)[1];
      const html = panel.webview.html.replaceAll('file://'+root,origin).replaceAll('vscode-webview://test',origin)
        .replace("default-src &#39;none&#39;;", "default-src &#39;none&#39;; connect-src &#39;self&#39;;")
        .replace('<script nonce=', `<script nonce="${nonce}">${bridge}</script><script nonce=`);
      response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);return;
    }
    if (/^\/(?:media\/[\w.-]+|packages\/core\/graph\.js)$/.test(url.pathname)) {
      const file = url.pathname === '/media/main.js' && process.env.CRC_SHARED_UI_MAIN ? path.resolve(process.env.CRC_SHARED_UI_MAIN) : path.join(root,url.pathname);
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(file));return;
    }
    if (url.pathname === '/notify') { panel.visible=false;await visibility({webviewPanel:panel});panel.visible=true;await visibility({webviewPanel:panel});response.end('{}');return; }
    if (url.pathname === '/source-save') { doc.text+='\n// same settings';doc.version++;await doc.save();response.end('{}');return; }
    if (url.pathname === '/saved') { response.setHeader('Content-Type','application/json');response.end(h.files.get(uri.toString()+'.view.json') || 'null');return; }
    if (url.pathname === '/messages') {
      if (request.method==='POST') { let body='';for await(const chunk of request)body+=chunk;await panel.receive(JSON.parse(body));response.end('{}');return; }
      const cursor=Number(url.searchParams.get('cursor'))||0;
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify({cursor:h.messages.length,messages:h.messages.slice(cursor)}));return;
    }
    response.writeHead(404);response.end('not found');
  } catch(error) { response.writeHead(500);response.end(error.stack); }
});
const settle = page => page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const snapshot = page => page.evaluate(()=>({ positions:[...document.querySelectorAll('.node')].map(n=>n.getAttribute('transform')),camera:document.getElementById('viewport').getAttribute('transform'),details:!document.getElementById('details').hidden }));
async function drag(page,index,dx=42,dy=28) {
  const before=await snapshot(page),box=await page.locator('.node').nth(index).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:5});await page.mouse.up();await settle(page);
  const after=await snapshot(page);assert.notEqual(after.positions[index],before.positions[index]);assert.equal(after.camera,before.camera);
  before.positions.forEach((p,i)=>{if(i!==index)assert.equal(after.positions[i],p);});
}
(async()=>{
  await open(); await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CRC_BROWSER_EXECUTABLE?{executablePath:process.env.CRC_BROWSER_EXECUTABLE}:{}),args:process.env.CRC_BROWSER_ARGS?JSON.parse(process.env.CRC_BROWSER_ARGS):[]});
  const report={browser:browser.version(),host:'production UI/adapter/extension + simulated VS Code API/filesystem',checks:[],checkpoints:{},failures:[]};
  const check=async(label,fn)=>{try{await fn();report.checks.push(label);}catch(error){report.failures.push({label,error:error.stack});}};
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/vscode');await page.waitForSelector('.node');await settle(page);
    await check('direct save and repeated actual extension visibility/config notifications preserve every coordinate',async()=>{
      await drag(page,0);await drag(page,1);await page.locator('#zoom-in').dispatchEvent('click');await page.locator('#toggle-details').click();await settle(page);
      const before=await snapshot(page);report.checkpoints.beforeSave=before;
      await page.locator('#save-view').dispatchEvent('click');await page.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('保存済み'));
      const state=await (await page.request.get(origin+'/saved')).json();report.checkpoints.saved=state;
      parseConfig(sample).graph.nodes.forEach((node,i)=>assert.equal(`translate(${state.positions[node.id].x} ${state.positions[node.id].y})`,before.positions[i]));
      assert.equal(Object.keys(state.positions).length,6);
      for(let i=0;i<3;i++){await page.request.get(origin+'/notify');await page.waitForTimeout(120);assert.deepEqual(await snapshot(page),before);}
      await page.request.get(origin+'/source-save');await page.waitForTimeout(120);assert.deepEqual(await snapshot(page),before);
      report.checkpoints.afterNotifications=await snapshot(page);
    });
    await check('opening sidecar, subsequent save, close/reopen, and explicit reload retain saved arrangement',async()=>{
      const before=report.checkpoints.beforeSave;assert.ok(before);
      await page.locator('#open-view').dispatchEvent('click');await page.waitForTimeout(120);await page.request.get(origin+'/notify');await page.waitForTimeout(120);
      assert.deepEqual(await snapshot(page),before);
      // Save again after redisplay: the broken implementation silently replaces
      // the correct first snapshot with its recalculated arrangement here.
      await page.locator('#save-view').dispatchEvent('click');await page.waitForTimeout(150);
      await page.goto(origin+'/reopen');await page.waitForSelector('.node');await settle(page);assert.deepEqual(await snapshot(page),before);
      report.checkpoints.reopened=await snapshot(page);
      await page.locator('#reload-view').dispatchEvent('click');await page.waitForTimeout(150);assert.deepEqual(await snapshot(page),before);
      if(process.env.CRC_CAPTURE_DIR){fs.mkdirSync(process.env.CRC_CAPTURE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CRC_CAPTURE_DIR,'vscode-redisplay-restored.png')});}
    });
    await check('reset/circle and consecutive native drags remain usable after redisplay',async()=>{
      await page.locator('#layout').selectOption('circle',{force:true});await settle(page);
      await drag(page,0,20,14);await drag(page,1,18,10);const before=await snapshot(page);
      await page.request.get(origin+'/notify');await page.waitForTimeout(120);assert.deepEqual(await snapshot(page),before);
      await page.locator('#reset').dispatchEvent('click');await settle(page);assert.notDeepEqual((await snapshot(page)).positions,before.positions);
      await drag(page,0,15,15);await drag(page,1,14,10);await drag(page,2,10,12);assert.deepEqual(errors,[]);assert.deepEqual(h.errors,[]);
    });
    await page.close();
  } finally { await browser.close();await h.dispose();await new Promise(r=>server.close(r)); }
  console.log(JSON.stringify(report,null,2));if(report.failures.length)process.exitCode=1;
})().catch(async error=>{console.error(error);await h.dispose();server.close();process.exitCode=1;});
