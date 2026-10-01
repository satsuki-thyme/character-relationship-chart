'use strict';
// Actual Chromium input/downloads. The VS Code fixture uses its real adapter
// and extension with a simulated VS Code API, not an Extension Host.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { spawn } = require('node:child_process'), { pathToFileURL } = require('node:url');
const { chromium } = require('playwright'), { buildWeb } = require('../scripts/build-web');
const { parseState } = require('../packages/core/view-state');
const root = path.resolve(__dirname, '..');
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = page => page.evaluate(() => {
  const canvas = document.getElementById('canvas'), rect = canvas.getBoundingClientRect();
  const [, x, y, scale] = document.getElementById('viewport').getAttribute('transform').match(/translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)/).map(Number);
  return { positions: [...document.querySelectorAll('.node')].map(node => node.getAttribute('transform')),
    camera: { x: (rect.width/2-x)/scale, y: (rect.height/2-y)/scale, scale },
    layout: document.getElementById('layout').value, details: !document.getElementById('details').hidden,
    focus: document.body.classList.contains('focus-mode') };
});
function equalSnapshot(actual, expected) {
  assert.deepEqual(actual.positions, expected.positions);
  for (const key of ['x','y','scale']) assert.ok(Math.abs(actual.camera[key]-expected.camera[key]) < 1e-6, 'camera '+key);
  for (const key of ['layout','details','focus']) assert.equal(actual[key], expected[key], key);
}
async function drag(page, index, dx = 30, dy = 18) {
  const before = await snapshot(page), box = await page.locator('.node').nth(index).boundingBox();
  await page.mouse.move(box.x+box.width/2, box.y+box.height/2); await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+dx, box.y+box.height/2+dy, { steps: 5 }); await page.mouse.up(); await settle(page);
  const after = await snapshot(page); assert.notEqual(after.positions[index], before.positions[index]);
  before.positions.forEach((p,i) => { if(i!==index) assert.equal(after.positions[i],p,'other node '+i); });
  assert.deepEqual(after.camera, before.camera, 'node drag must not pan');
  assert.equal(await page.locator('#canvas').evaluate(e=>e.classList.contains('dragging')), false);
}
async function pan(page) {
  const before = await snapshot(page), box = await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x+15,box.y+15); await page.mouse.down();
  await page.mouse.move(box.x+40,box.y+35,{steps:5}); await page.mouse.up(); await settle(page);
  const after = await snapshot(page); assert.deepEqual(after.positions,before.positions); assert.notDeepEqual(after.camera,before.camera);
}
(async () => {
  const out = process.env.CRC_WEB_DIR ? path.resolve(process.env.CRC_WEB_DIR) : await buildWeb();
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : [] });
  const report = { browser: browser.version(), vscode: 'actual shared UI/adapter + simulated VS Code API; no Extension Host', checks: [], failures: [] };
  let preview;
  const group = async (label, fn) => { try { await fn(); report.checks.push(label); } catch(error) { report.failures.push({ label, error: error.stack }); } };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
    const url = pathToFileURL(path.join(out,'index.html')).href;
    await group('Web auto/circle, all positions, zoom, pan, details/focus: actual JSON and restored DOM agree', async () => {
      const page = await context.newPage(), errors = [], requests = [];
      page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
      page.on('dialog',d=>d.accept());
      await page.goto(url); await page.waitForFunction(()=>document.querySelectorAll('.node').length===6); await settle(page);
      const config = await fs.readFile(path.join(root,'examples/characters.relations.jsonc'));
      const input = (name,buffer) => ({name,mimeType:'application/json',buffer});
      for (const mode of ['auto','circle']) {
        await page.locator('#more-menu summary').click(); await page.locator('#layout').selectOption(mode);
        await page.locator('#more-menu summary').click(); await drag(page,0,40,30); await pan(page);
        await page.locator('#more-menu summary').click(); await page.locator('#zoom-in').click(); await page.locator('#more-menu summary').click();
        if(mode==='auto') await page.locator('#toggle-details').click(); else await page.locator('#focus').click(); await settle(page);
        const before = await snapshot(page);
        // Focus mode hides the toolbar; dispatch only its save activation while
        // keeping that state for the actual serialization/download check.
        const [download] = await Promise.all([page.waitForEvent('download'), mode === 'circle' ? page.locator('#web-view-download').dispatchEvent('click') : page.locator('#web-view-download').click()]);
        const bytes = await fs.readFile(await download.path()), state = parseState(bytes.toString());
        assert.equal(download.suggestedFilename(),'characters.relations.jsonc.view.json'); assert.equal(Object.keys(state.positions).length,6);
        before.positions.forEach((transform,i)=>{const id=['alto','lina','kai','elna','noah','mira'][i];assert.equal(transform,`translate(${state.positions[id].x} ${state.positions[id].y})`);});
        await page.locator('#web-files').setInputFiles([input('characters.relations.jsonc',config),input(download.suggestedFilename(),bytes)]);
        await page.waitForFunction(()=>document.getElementById('web-file').textContent.includes(' + ')); await settle(page);
        equalSnapshot(await snapshot(page),before);
        if(process.env.CRC_CAPTURE_DIR) { await fs.mkdir(process.env.CRC_CAPTURE_DIR,{recursive:true}); await page.screenshot({path:path.join(process.env.CRC_CAPTURE_DIR,'roundtrip-'+mode+'.png')}); }
        if(mode==='auto') await page.locator('#toggle-details').click(); else await page.locator('#exit-focus').click();
        await page.locator('#web-files').setInputFiles(input('characters.relations.jsonc',config));
        await page.waitForFunction(()=>document.getElementById('web-file').textContent==='characters.relations.jsonc'); await settle(page);
      }
      assert.deepEqual(errors,[]); assert.deepEqual(requests,[]); await page.close();
    });
    await group('Web native pointer capture loss, consecutive A/B/C drags, canvas pan, tab and page return', async () => {
      const page = await context.newPage(); page.on('dialog',d=>d.accept());
      await page.goto(url); await page.waitForSelector('.node'); await settle(page);
      for (const i of [0,1,2,3,0]) await drag(page,i); await pan(page); await drag(page,1);
      await page.evaluate(()=>document.getElementById('canvas').addEventListener('pointerdown',e=>window.lastPointer=e.pointerId,true));
      const box = await page.locator('.node').first().boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
      await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+20,{steps:4});
      await page.evaluate(()=>document.getElementById('canvas').releasePointerCapture(lastPointer));
      await page.mouse.move(box.x+box.width/2+26,box.y+box.height/2+21);
      await page.waitForFunction(()=>!document.getElementById('canvas').classList.contains('dragging'),{},{timeout:3000});
      await page.mouse.up(); await drag(page,1); await drag(page,2);
      const other=await context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await page.bringToFront();
      for(const i of [0,1,2])await drag(page,i); await other.close();
      await page.goto('about:blank'); await page.goto(url); await page.waitForSelector('.node'); await settle(page);
      for(const i of [0,1,2])await drag(page,i); await pan(page); await drag(page,3); await page.close();
    });
    await context.close();
    preview = spawn(process.execPath,[path.join(root,'test/preview.js')],{cwd:root,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{preview.stdout.once('data',resolve);preview.once('error',reject);preview.once('exit',code=>reject(new Error('preview exit '+code)));});
    await group('VS Code shared UI and real adapter: complete saved layout reload, consecutive drag, capture loss and pan', async () => {
      const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message)); await page.goto('http://127.0.0.1:8765/vscode');
      await page.waitForFunction(()=>document.querySelectorAll('.node').length===6); await settle(page);
      for(const i of [0,1,2])await drag(page,i); await pan(page); await drag(page,3);
      const before=await snapshot(page); await page.locator('#more-menu summary').click();await page.locator('#save-view').click();
      await page.waitForFunction(()=>document.getElementById('storage-status').textContent.includes('保存済み'));await page.locator('#reload-view').click();
      await settle(page);equalSnapshot(await snapshot(page),before);await page.locator('#more-menu summary').click();
      await page.evaluate(()=>document.getElementById('canvas').addEventListener('pointerdown',e=>window.lastPointer=e.pointerId,true));
      const box=await page.locator('.node').first().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2+15,{steps:4});await page.evaluate(()=>document.getElementById('canvas').releasePointerCapture(lastPointer));
      await page.mouse.move(box.x+box.width/2+21,box.y+box.height/2+16);await page.waitForFunction(()=>!document.getElementById('canvas').classList.contains('dragging'),{},{timeout:3000});
      await page.mouse.up();await drag(page,1);await drag(page,2);await pan(page);assert.deepEqual(errors,[]);await ctx.close();
    });
  } finally { if(preview)preview.kill('SIGINT'); await browser.close(); }
  console.log(JSON.stringify(report,null,2)); if(report.failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
