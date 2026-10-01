'use strict';
// Test-only CDP drop supplies real external-file handles. Only selection is
// bridged; getFile, permissions and createWritable remain native.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web'), { parseState } = require('../packages/core/view-state');
(async () => {
  const out = await buildWeb(), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'crc-native-view-'));
  const sourceName = 'native.jsonc', originalConfig = '{"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[]}';
  const originalView = '{"version":1,"positions":{"a":{"x":321,"y":123,"source":","}},"camera":{"x":90,"y":100,"scale":1.4,"width":1000,"height":680}}';
  await fs.writeFile(path.join(temp, sourceName), originalConfig); await fs.writeFile(path.join(temp, sourceName + '.view.json'), originalView);
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : [] });
  const report = { browser: browser.version(), nativeOpenPicker: 'unverified', nativeSavePicker: 'unverified', nativeViewSave: 'unverified' };
  try {
    const context = await browser.newContext({ offline: true }), page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href); await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    report.capabilities = await page.evaluate(() => ({ secure: isSecureContext, open: typeof showOpenFilePicker, save: typeof showSaveFilePicker }));
    if (report.capabilities.open !== 'function') { console.log(JSON.stringify(report, null, 2)); return; }
    await page.evaluate(() => {
      for (const name of ['showOpenFilePicker', 'showSaveFilePicker']) {
        const native = window[name].bind(window);
        window[name] = async options => { try { const result = await native(options); window[name + 'Probe'] = 'native handles returned'; return result; }
          catch (e) { window[name + 'Probe'] = { name: e.name, message: e.message }; throw e; } };
      }
      document.addEventListener('drop', event => { window.nativeHandlePromise = event.dataTransfer.items[0].getAsFileSystemHandle(); }, true);
    });
    await page.locator('#web-direct-open').click(); await page.waitForFunction(() => window.showOpenFilePickerProbe);
    report.nativeOpenPicker = await page.evaluate(() => window.showOpenFilePickerProbe);
    await page.locator('#web-view-save-as').click(); await page.waitForFunction(() => window.showSaveFilePickerProbe);
    report.nativeSavePicker = await page.evaluate(() => window.showSaveFilePickerProbe);
    const cdp = await context.newCDPSession(page);
    async function drop(file) { for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', {
      type, x: 100, y: 100, data: { items: [], files: [path.join(temp, file)], dragOperationsMask: 1 } }); }
    await drop(sourceName); await page.waitForFunction(() => document.getElementById('web-file').textContent === 'native.jsonc');
    await page.evaluate(async () => { window.nativeConfigHandle = await window.nativeHandlePromise; window.showOpenFilePicker = async () => [nativeConfigHandle]; });
    await page.locator('#web-direct-open').click(); await page.waitForFunction(() => !document.getElementById('web-save').disabled);
    await drop(sourceName + '.view.json'); await page.waitForFunction(() => document.getElementById('web-file').textContent.includes('.view.json'));
    report.nativeRead = await page.evaluate(async () => {
      window.nativeViewHandle = await window.nativeHandlePromise; window.showOpenFilePicker = async () => [nativeViewHandle];
      return { text: await (await nativeViewHandle.getFile()).text(), permission: await nativeViewHandle.queryPermission({ mode: 'readwrite' }), sameAsConfig: await nativeViewHandle.isSameEntry(nativeConfigHandle) };
    });
    assert.equal(report.nativeRead.text, originalView); assert.equal(report.nativeRead.sameAsConfig, false);
    await page.locator('#web-direct-view-open').click(); await page.waitForFunction(() => !document.getElementById('web-view-save').disabled);
    await page.locator('#more-menu summary').click(); await page.locator('#zoom-in').click(); await page.locator('#more-menu summary').click();
    const cameraCenter = () => page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = document.getElementById('canvas').getBoundingClientRect();
      const [, x, y, scale] = document.getElementById('viewport').getAttribute('transform').match(/translate\(([^ ]+) ([^)]+)\) scale\(([^)]+)\)/).map(Number);
      return { x: (rect.width / 2 - x) / scale, y: (rect.height / 2 - y) / scale, scale };
    });
    const camera = await cameraCenter();
    await page.locator('#web-view-save').click(); await page.waitForFunction(() => document.getElementById('web-view-save').textContent === '表示データを保存');
    report.message = await page.locator('#web-message').textContent();
    if (report.message.includes('内容を確認しました')) {
      assert.equal(parseState(await fs.readFile(path.join(temp, sourceName + '.view.json'), 'utf8')).camera.scale, 1.4 * 1.2);
      report.nativeViewSave = 'native writer succeeded; selection bridged';
    } else {
      assert.equal(await fs.readFile(path.join(temp, sourceName + '.view.json'), 'utf8'), originalView);
      const afterCamera = await cameraCenter();
      for (const key of ['x', 'y', 'scale']) assert.ok(Math.abs(afterCamera[key] - camera[key]) < 1e-6, key + ' retained across message-driven resize');
      assert.equal(await page.locator('#web-save').isEnabled(), true);
      const pending = page.waitForEvent('download'); await page.locator('#web-view-download').click(); const file = await pending;
      assert.equal(parseState(await fs.readFile(await file.path(), 'utf8')).camera.scale, 1.4 * 1.2);
      report.nativeViewSave = 'NOT VERIFIED: native write refused'; report.denialProtection = 'original config/view unchanged; camera, separate config target and actual view download retained';
    }
    assert.equal(await fs.readFile(path.join(temp, sourceName), 'utf8'), originalConfig); assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.httpRequests = requests.length; report.pageErrors = errors.length;
    await context.close(); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); await fs.rm(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
