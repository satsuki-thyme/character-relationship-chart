'use strict';
// Actual Chromium rendering/downloads, with controlled file-handle doubles.
// Native OS pickers and external-file writes are probed separately.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web');
const { parseConfig } = require('../packages/core/config'), { parseState } = require('../packages/core/view-state');
(async () => {
  const out = await buildWeb(), capture = process.env.CRC_CAPTURE_DIR;
  if (capture) await fs.mkdir(capture, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : [] });
  const report = { browser: browser.version(), fileHandles: 'simulated; native OS picker/write NOT certified', checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.addInitScript(() => {
      window.disk = {
        config: { text: '\uFEFF{\r\n\t// keep コメント\r\n\t"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","label":"Link","shape":"curved"}]\r\n}\r\n', writes: 0, closes: 0 },
        view: { text: '{"version":1,"positions":{"a":{"x":321,"y":123,"source":","}},"camera":{"x":90,"y":110,"scale":1.4,"width":1000,"height":680},"ui":{"details":false,"focus":false}}', writes: 0, closes: 0 },
        blank: { text: '', writes: 0, closes: 0 }
      };
      window.handles = {};
      for (const key of ['config', 'view', 'blank']) {
        const d = disk[key]; window.handles[key] = { kind: 'file', name: key === 'config' ? '人物.jsonc' : '人物.jsonc.view.json',
          async getFile() { return new File([d.text], this.name); }, async isSameEntry(other) { return this === other; },
          async requestPermission() { return d.denied ? 'denied' : 'granted'; },
          async createWritable() { let bytes; return {
            async write(value) { d.writes++; bytes = value; if (d.fail === 'write') throw new Error('injected write'); },
            async close() { d.closes++; if (d.fail === 'close') throw new Error('injected close'); d.text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes); if (d.fail === 'verify') d.text += ' '; },
            async abort() {} }; }
        };
      }
      window.openKey = 'config'; window.saveKey = 'view';
      window.showOpenFilePicker = async () => [handles[openKey]];
      window.showSaveFilePicker = async options => { window.lastSuggested = options.suggestedName; return handles[saveKey]; };
    });
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    const untilFile = name => page.waitForFunction(value => document.getElementById('web-file').textContent === value, name);
    const discard = () => page.once('dialog', d => d.accept());
    const cameraCenter = () => page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = document.getElementById('canvas').getBoundingClientRect();
      const [, x, y, scale] = document.getElementById('viewport').getAttribute('transform').match(/translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)/).map(Number);
      return { x: (rect.width / 2 - x) / scale, y: (rect.height / 2 - y) / scale, scale };
    });
    const input = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
    const download = async (id, modal = false) => { const pending = page.waitForEvent('download'); if (modal) await page.locator('#' + id).dispatchEvent('click'); else await page.locator('#' + id).click(); const file = await pending; return { name: file.suggestedFilename(), text: await fs.readFile(await file.path(), 'utf8') }; };
    const data = '{ // untouched\n"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","shape":"straight"}]}';
    await page.locator('#web-files').setInputFiles(input('cast.jsonc', data)); await untilFile('cast.jsonc');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const node = page.locator('.node').first(), beforeDrag = await node.getAttribute('transform'), box = await node.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 6 }); await page.mouse.up();
    assert.notEqual(await node.getAttribute('transform'), beforeDrag, 'pointer gesture changed the node position');
    await page.locator('#more-menu summary').click(); await page.locator('#zoom-in').click(); await page.locator('#more-menu summary').click();
    await page.locator('#toggle-details').click();
    const dragged = await node.getAttribute('transform'); const viewDownload = await download('web-view-download'), state = parseState(viewDownload.text);
    assert.equal(viewDownload.name, 'cast.jsonc.view.json'); assert.ok(state.positions.a); assert.equal(state.ui.details, true);
    assert.match(await page.locator('#web-view-status').textContent(), /未保存/);
    report.checks.push('real pointer drag, zoom and details are exported as validated UTF-8 view data; download stays dirty');

    await page.locator('#edit-config').click(); await page.locator('[data-kind="nodes"]').click(); await page.locator('#field-id').fill('hero'); await page.locator('#edit-save').click();
    await page.waitForFunction(() => document.getElementById('edit-message').textContent.startsWith('相関図に反映しました')); await page.locator('#edit-close').click();
    const renamedView = await download('web-view-download'), renamedConfig = await download('web-download');
    assert.ok(parseState(renamedView.text).positions.hero); assert.equal(parseState(renamedView.text).positions.a, undefined);
    assert.equal(parseConfig(renamedConfig.text).config.edges[0].from, 'hero'); assert.match(renamedConfig.text, /untouched/);
    discard(); await page.locator('#web-files').setInputFiles(input('cast.jsonc', data)); await untilFile('cast.jsonc');
    // Same-name reads are asynchronous: the unchanged file label cannot signal
    // completion. Wait for the renamed ID to actually return to the source ID.
    await page.waitForFunction(() => document.querySelector('.node .group-name')?.textContent === 'a');
    assert.notEqual(await node.getAttribute('transform'), dragged); assert.equal(await page.locator('#web-view-save').isEnabled(), false);
    await page.locator('#web-files').setInputFiles([input(renamedConfig.name, renamedConfig.text), input(renamedView.name, renamedView.text)]); await untilFile('cast.jsonc + cast.jsonc.view.json');
    assert.equal(await node.getAttribute('transform'), dragged); assert.equal(await page.locator('#details').isVisible(), true);
    report.checks.push('node ID/config references and positions follow rename; downloaded pair restores and same-name source resets old layout');

    await page.locator('#web-direct-open').click(); await untilFile('人物.jsonc');
    await page.evaluate(() => { window.openKey = 'view'; }); await page.locator('#web-direct-view-open').click(); await untilFile('人物.jsonc + 人物.jsonc.view.json');
    assert.equal(await node.getAttribute('transform'), 'translate(321 123)'); assert.equal(await page.evaluate(() => disk.view.writes), 0);
    await page.locator('#more-menu summary').click(); await page.locator('#zoom-in').click(); await page.locator('#more-menu summary').click();
    await page.locator('#web-view-save').click(); await page.waitForFunction(() => disk.view.closes === 1);
    assert.match(await page.locator('#web-message').textContent(), /内容を確認しました/); assert.match(await page.locator('#web-view-status').textContent(), /変更なし/);
    assert.equal(await page.evaluate(() => disk.config.writes), 0); assert.equal(parseState(await page.evaluate(() => disk.view.text)).camera.scale, 1.4 * 1.2);
    report.checks.push('explicit existing sidecar selection, byte-verified save and independent config target (handle doubles)');

    for (const fault of ['conflict', 'denied', 'write', 'close', 'verify']) {
      await page.evaluate(() => { disk.view.denied = false; disk.view.fail = ''; });
      if (fault !== 'conflict') discard();
      await page.locator('#web-direct-view-open').click();
      await page.waitForFunction(() => !document.getElementById('web-view-save').disabled);
      await page.locator('#more-menu summary').click(); await page.locator('#zoom-in').click(); await page.locator('#more-menu summary').click();
      await page.locator('#edit-config').click(); await page.locator('[data-kind="general"]').click(); await page.locator('#field-title').fill('保持する未反映入力');
      await page.evaluate(f => { if (f === 'conflict') disk.view.text += ' '; if (f === 'denied') disk.view.denied = true; else disk.view.fail = f; }, fault);
      const before = await page.evaluate(() => disk.view.text), camera = await cameraCenter();
      // The modal intentionally stays open: a dispatched outer-button event
      // verifies preservation without applying or discarding the live form.
      await page.locator('#web-view-save').dispatchEvent('click'); await page.waitForFunction(() => document.getElementById('web-message').textContent.includes('退避できます'));
      const afterCamera = await cameraCenter();
      for (const key of ['x', 'y', 'scale']) assert.ok(Math.abs(afterCamera[key] - camera[key]) < 1e-6, key + ' retained across message-driven resize');
      assert.equal(await page.locator('#web-save').isEnabled(), true);
      if (fault !== 'verify') assert.equal(await page.evaluate(() => disk.view.text), before);
      if (['conflict', 'close', 'verify'].includes(fault)) assert.equal(await page.locator('#web-view-save').isEnabled(), false);
      const fallback = await download('web-view-download', true); assert.ok(parseState(fallback.text).positions.a);
      assert.equal(await page.locator('#field-title').inputValue(), '保持する未反映入力');
      await page.locator('#edit-close').click(); await page.locator('#edit-confirm .primary').click();
    }
    report.checks.push('sidecar conflict, denied permission, write/close/readback mismatch preserve camera/draft/download and block uncertain retries (injected faults)');

    await page.evaluate(() => { disk.view.denied = false; disk.view.fail = ''; window.saveKey = 'view'; });
    await page.locator('#web-view-save-as').click(); await page.waitForFunction(() => document.getElementById('web-message').textContent.includes('中身のある既存ファイル'));
    const existing = await page.evaluate(() => disk.view.text); await page.evaluate(() => { window.saveKey = 'blank'; });
    await page.locator('#web-view-save-as').click(); await page.waitForFunction(() => disk.blank.closes === 1);
    assert.equal(await page.evaluate(() => window.lastSuggested), '人物.jsonc.view.json'); assert.equal(await page.evaluate(() => disk.view.text), existing);
    assert.equal(await page.evaluate(() => disk.config.writes), 0); assert.ok(parseState(await page.evaluate(() => disk.blank.text)).positions.a);
    report.checks.push('new/empty target selection writes only the chosen target; nonempty target refused');
    if (capture) await page.screenshot({ path: path.join(capture, 'stage6-desktop.png') });
    await page.setViewportSize({ width: 390, height: 850 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok((await page.locator('#canvas').boundingBox()).height > 100);
    if (capture) await page.screenshot({ path: path.join(capture, 'stage6-narrow.png') });
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.checks.push('390px controls/canvas, zero page errors and zero normal-operation HTTP(S) requests offline');
    const fallback = await context.newPage();
    await fallback.addInitScript(() => { window.showOpenFilePicker = window.showSaveFilePicker = undefined; });
    await fallback.goto(pathToFileURL(path.join(out, 'index.html')).href); await fallback.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    for (const id of ['web-direct-open', 'web-view-save', 'web-view-save-as', 'web-direct-view-open']) assert.equal(await fallback.locator('#' + id).isVisible(), false);
    const pending = fallback.waitForEvent('download'); await fallback.locator('#web-view-download').click(); const exported = await pending;
    assert.equal(exported.suggestedFilename(), 'characters.relations.jsonc.view.json'); parseState(await fs.readFile(await exported.path(), 'utf8'));
    report.checks.push('API-unsupported browser retains shared editor and both download paths');
    await context.close(); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
