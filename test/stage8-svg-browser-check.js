'use strict';
// Actual Chromium rendering/downloads; file handles and injected failures are doubles.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web');
(async () => {
  const out = process.env.CRC_WEB_DIR || await buildWeb(await fs.mkdtemp(path.join(os.tmpdir(), 'crc-svg-')));
  const capture = process.env.CRC_CAPTURE_DIR;
  if (capture) await fs.mkdir(capture, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}), args: JSON.parse(process.env.CRC_BROWSER_ARGS || '[]') });
  const report = { browser: browser.version(), handles: 'simulated', checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    page.on('dialog', d => d.accept());
    await page.addInitScript(() => {
      const t = window.svgTest = { failBlob: false, failSerialize: false, types: [], pending: 0, revoked: 0, writes: 0, source: '', pickerCancel: false };
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL), serialize = XMLSerializer.prototype.serializeToString;
      URL.createObjectURL = blob => { if (t.failBlob && blob.type.startsWith('image/svg+xml')) throw new Error('injected SVG download failure'); t.types.push(blob.type); t.pending++; return create(blob); };
      URL.revokeObjectURL = url => { t.revoked++; revoke(url); };
      XMLSerializer.prototype.serializeToString = function (node) { if (t.failSerialize) throw new Error('injected serialization failure'); return serialize.call(this, node); };
      t.handle = { name: '人物.jsonc', kind: 'file', async getFile() { return new File([t.source], this.name); }, async requestPermission() { return 'granted'; }, async createWritable() { let data; return { async write(bytes) { data = bytes; t.writes++; }, async close() { t.source = new TextDecoder().decode(data); }, async abort() {} }; } };
      window.showOpenFilePicker = async () => { if (t.pickerCancel) throw new DOMException('cancelled', 'AbortError'); return [t.handle]; };
      Storage.prototype.setItem = () => { throw new Error('unexpected persistence'); };
    });
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    const click = id => page.locator('#' + id).click();
    const stable = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const coords = () => page.locator('.node').evaluateAll(nodes => nodes.map(n => n.getAttribute('transform')));
    const state = () => page.evaluate(() => ({ coords: Array.from(document.querySelectorAll('.node'), n => n.getAttribute('transform')), status: document.getElementById('status').textContent, view: document.getElementById('web-view-status').textContent, history: document.getElementById('web-history-note').textContent, undo: document.getElementById('web-undo').disabled, redo: document.getElementById('web-redo').disabled, save: document.getElementById('web-save').disabled, blocked: document.getElementById('web-save-note').textContent, writes: svgTest.writes }));
    const download = async (id = 'export', keyboard = false) => {
      const pending = page.waitForEvent('download');
      if (keyboard) await page.keyboard.press('Enter'); else await click(id);
      const file = await pending; assert.equal(await file.failure(), null);
      return { name: file.suggestedFilename(), text: await fs.readFile(await file.path(), 'utf8') };
    };
    const xml = async text => page.evaluate(text => {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      return { error: !!doc.querySelector('parsererror'), title: doc.querySelector('title')?.textContent,
        nodes: Array.from(doc.querySelectorAll('g[transform]'), n => n.getAttribute('transform')),
        paths: Array.from(doc.querySelectorAll('path[stroke]'), n => ({ d: n.getAttribute('d'), dash: n.getAttribute('stroke-dasharray'), width: n.getAttribute('stroke-width'), end: n.getAttribute('marker-end'), start: n.getAttribute('marker-start') })),
        active: !!doc.querySelector('script,foreignObject,image,iframe,a,style,[onclick],[onload],[class],[tabindex]'),
        external: Array.from(doc.querySelectorAll('*')).some(e => Array.from(e.attributes).some(a => /href$/i.test(a.name) && !a.value.startsWith('#'))),
        viewBox: doc.documentElement.getAttribute('viewBox'),
        markersValid: Array.from(doc.querySelectorAll('[marker-end],[marker-start]')).every(e => ['marker-end','marker-start'].every(k => !e.hasAttribute(k) || doc.querySelector(e.getAttribute(k).slice(4,-1)))),
        noFade: !doc.querySelector('[opacity], [style]') };
    }, text);
    const sample = await download(); assert.equal(sample.name, 'characters.relations.svg');
    const sampleXml = await xml(sample.text); assert.equal(sampleXml.error, false); assert.equal(sampleXml.nodes.length, 6); assert.equal(sampleXml.markersValid, true);
    assert.equal(await page.evaluate(() => svgTest.types.at(-1)), 'image/svg+xml;charset=utf-8');
    if (capture) await fs.writeFile(path.join(capture, 'sample.svg'), sample.text);
    report.checks.push('real UTF-8 SVG download, filename, MIME, XML parse, all nodes and arrow references');

    await page.locator('#search').fill('ア');
    await page.locator('.edge').first().dispatchEvent('click');
    await page.locator('#canvas').focus(); await page.keyboard.press('+'); await stable();
    const beforeOutput = await state(), selected = await download();
    assert.deepEqual(await state(), beforeOutput); const selectedXml = await xml(selected.text);
    assert.deepEqual(selectedXml.nodes, sampleXml.nodes); assert.deepEqual(selectedXml.paths, sampleXml.paths); assert.equal(selectedXml.noFade, true);
    report.checks.push('search/selection/zoom do not filter, dim, thicken or crop SVG; output leaves history/save state unchanged');

    const config = { title: '長い題名の確認'.repeat(12) + ' <script>alert(1)</script>', description: '説明 & <img src=x onerror=alert(1)>',
      groups: [{ id:'g1',label:'仲間',color:'#dd6633' },{ id:'g2',label:'家族',color:'#3399bb' }],
      nodes: [{id:'a',label:'日本語 & <script>',groups:['g1','g2'],x:-280,y:0},{id:'b',label:'B',x:280,y:0},{id:'c',label:'C',x:0,y:250}],
      edges: [{from:'a',to:'b',label:'直線',shape:'straight',style:'dashed',arrow:'both'},{from:'a',to:'b',label:'曲線 & <',shape:'curved',style:'dotted',arrow:'none'},{from:'b',to:'c',label:'自動',shape:'auto',arrow:'forward'},{from:'a',to:'a',label:'自己関係',shape:'curved',arrow:'both'}] };
    // 'to' is the existing one-way arrow value; use the schema's default by omitting it.
    delete config.edges[2].arrow;
    const source = '// retained comment\n' + JSON.stringify(config, null, 2);
    await page.locator('#web-files').setInputFiles({ name:'人物.jsonc',mimeType:'application/json',buffer:Buffer.from(source) });
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 3); await stable();
    const rich = await download(), richXml = await xml(rich.text);
    assert.equal(rich.name,'人物.svg'); assert.equal(richXml.title,config.title); assert.equal(richXml.active,false); assert.equal(richXml.external,false); assert.equal(richXml.markersValid,true);
    assert.ok(richXml.paths.some(p=>/7(?:px)?[, ]+5/.test(p.dash))); assert.ok(richXml.paths.some(p=>/2(?:px)?[, ]+5/.test(p.dash))); assert.ok(richXml.paths.some(p=>p.start&&p.end));
    assert.equal(richXml.paths.length,4); assert.ok(richXml.paths.some(p=>/[CQ]/.test(p.d)));
    const standalone = path.join(capture || out,'rich.svg'); await fs.writeFile(standalone,rich.text);
    const rendered = await context.newPage(); await rendered.goto(pathToFileURL(standalone).href);
    const extent = await rendered.locator('svg').evaluate(svg=>{ const b=svg.viewBox.baseVal; return Array.from(svg.querySelectorAll('text')).every(t=>{const r=t.getBBox();const m=t.getCTM();const sm=svg.getCTM().inverse().multiply(m);const points=[new DOMPoint(r.x,r.y),new DOMPoint(r.x+r.width,r.y+r.height)].map(p=>p.matrixTransform(sm));return points.every(p=>p.x>=b.x-1&&p.x<=b.x+b.width+1&&p.y>=b.y-1&&p.y<=b.y+b.height+1);}); });
    assert.equal(extent,true,'title and labels must fit SVG viewBox');
    if(capture)await rendered.screenshot({path:path.join(capture,'svg-rendered.png')}); await rendered.close();
    report.checks.push('straight/curved/auto/self/multiple edges, line styles, arrows, memberships, escaped text and long title render in standalone SVG');

    await click('edit-config'); await page.locator('#field-title').fill('編集した題名'); await click('edit-save');
    await page.waitForFunction(()=>document.getElementById('edit-message').textContent.startsWith('相関図に反映')); await click('edit-close');
    assert.equal((await xml((await download()).text)).title,'編集した題名');
    await click('web-undo'); const undoState=await state(); assert.equal((await xml((await download()).text)).title,config.title); assert.deepEqual(await state(),undoState);
    await click('web-redo'); assert.equal((await xml((await download()).text)).title,'編集した題名');
    report.checks.push('GUI edits, Undo and Redo are reflected in SVG without discarding Redo');
    const beforeTheme = await state();
    await page.evaluate(() => { document.body.style.setProperty('--bg', '#ffffff'); document.body.style.setProperty('--fg', '#222222'); document.body.style.setProperty('--line', '#334455'); }); await stable();
    const light = await download(); assert.match(light.text, /fill="rgb\(255, 255, 255\)"/); assert.match(light.text, /fill="rgb\(34, 34, 34\)"/); assert.doesNotMatch(light.text, /var\(/);
    assert.deepEqual(await state(), beforeTheme);
    if (capture) await fs.writeFile(path.join(capture, 'light.svg'), light.text);
    await page.evaluate(() => document.body.removeAttribute('style')); await stable();
    report.checks.push('light and dark computed theme colors are embedded without external CSS or state changes');

    await click('fit'); await stable(); const node=await page.locator('.node').first().boundingBox();
    await page.mouse.move(node.x+20,node.y+20);await page.mouse.down();await page.mouse.move(node.x+85,node.y+45,{steps:5});await page.mouse.up();
    const moved=await coords(); assert.notDeepEqual(moved,richXml.nodes); assert.deepEqual((await xml((await download()).text)).nodes,moved);
    const configFile=await download('web-download'),viewFile=await download('web-view-download'); assert.match(configFile.text,/retained comment/);
    await page.locator('#web-files').setInputFiles([{name:configFile.name,mimeType:'application/json',buffer:Buffer.from(configFile.text)},{name:viewFile.name,mimeType:'application/json',buffer:Buffer.from(viewFile.text)}]);
    await page.waitForFunction(()=>document.getElementById('web-file').textContent.includes('.view.json'));await stable();assert.deepEqual((await xml((await download()).text)).nodes,moved);
    report.checks.push('dragged coordinates survive SVG output, actual JSONC/view downloads and reimport');

    await page.locator('#canvas').focus();await page.keyboard.press('+');await click('web-undo');const beforeFailure=await state();
    for(const flag of ['failBlob','failSerialize']){
      await page.evaluate(flag=>{svgTest[flag]=true;},flag);await click('export');
      await page.waitForFunction(()=>document.getElementById('web-message').textContent.includes('SVGをダウンロードできません'));
      assert.deepEqual(await state(),beforeFailure);assert.equal(await page.locator('body > svg').count(),0);
      await page.evaluate(flag=>{svgTest[flag]=false;},flag);await download();assert.deepEqual(await state(),beforeFailure);
    }
    report.checks.push('Blob/serialization failures preserve layout, dirty flags and Redo; retry succeeds without temporary SVG leaks');

    await click('edit-config');await page.locator('#field-title').fill('未反映の草稿');const count=await page.evaluate(()=>svgTest.pending);
    await page.locator('#export').dispatchEvent('click'); // Fault-injection dispatch; native modal correctly prevents a physical click.
    assert.equal(await page.locator('#field-title').inputValue(),'未反映の草稿');assert.equal(await page.evaluate(()=>svgTest.pending),count);assert.match(await page.locator('#web-message').textContent(),/未反映/);
    await click('edit-close');await page.locator('#edit-confirm button').first().click();
    report.checks.push('unapplied modal input is neither exported nor discarded (synthetic behind-modal dispatch)');

    await page.evaluate(source=>{svgTest.source=source;},source);await click('web-direct-open');await stable();
    await click('web-save');await page.waitForFunction(()=>document.getElementById('web-message').textContent.includes('内容を確認'));assert.equal(await page.locator('#export').isEnabled(),true);await download();
    await page.evaluate(()=>{svgTest.source+=' ';});await click('web-save');await page.waitForFunction(()=>document.getElementById('web-save-note').textContent.includes('停止'));
    const blocked=await state();await download();assert.deepEqual(await state(),blocked);
    await page.evaluate(()=>{svgTest.pickerCancel=true;});await click('web-direct-open');assert.deepEqual(await state(),blocked);
    report.checks.push('SVG remains available after verified-save notification and conflict stop; output and cancelled picker keep stop/state intact (simulated handles)');

    for(const viewport of [{width:320,height:640},{width:390,height:844},{width:768,height:480}]){
      await page.setViewportSize(viewport);await stable();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.ok((await page.locator('#canvas').boundingBox()).height>=80);
      await page.locator('#web-view-download').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#export').evaluate(e=>e===document.activeElement),true);
      const b=await page.locator('#export').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=viewport.width&&b.y>=0&&b.y+b.height<=viewport.height);
      await download('export',true);
      await page.locator('#more-menu summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#more-menu').evaluate(e=>e.open),true);await page.keyboard.press('Tab');await page.keyboard.press('Escape');assert.equal(await page.locator('#more-menu').evaluate(e=>e.open),false);assert.equal(await page.locator('#more-menu summary').evaluate(e=>e===document.activeElement),true);
      if(capture)await page.screenshot({path:path.join(capture,`web-${viewport.width}.png`)});
    }
    report.checks.push('320/390/768px layouts retain chart and reachable outputs; Tab/Enter download and Escape menu work');

    await page.locator('#web-files').setInputFiles({name:'bad.jsonc',mimeType:'application/json',buffer:Buffer.from('{bad')});await page.waitForFunction(()=>!document.getElementById('error').hidden);
    assert.equal(await page.locator('#export').isDisabled(),true);assert.equal(await page.locator('.node').count(),3);
    await page.locator('#web-files').setInputFiles({name:'empty.jsonc',mimeType:'application/json',buffer:Buffer.from('{"nodes":[],"edges":[]}')});await page.waitForFunction(()=>document.querySelectorAll('.node').length===0);assert.equal(await page.locator('#export').isDisabled(),true);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    report.checks.push('invalid and empty config block SVG; invalid read preserves prior chart; zero page errors or HTTP(S) requests offline');
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
