'use strict';
// Probe native APIs in headless Chromium. A CDP drag supplies a native external
// file handle; the picker bridge is test-only. A denied write is not a save pass.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web');
(async () => {
  const out = await buildWeb(), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'crc-native-'));
  const file = path.join(temp, 'native.jsonc'), original = '{"title":"Native","nodes":[],"edges":[]}';
  await fs.writeFile(file, original);
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : [] });
  const report = { browser: browser.version(), nativePicker: 'unverified', nativeSave: 'unverified' };
  try {
    const context = await browser.newContext({ offline: true }), page = await context.newPage();
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    report.capabilities = await page.evaluate(() => ({ secure: isSecureContext, picker: typeof showOpenFilePicker, writer: typeof FileSystemFileHandle?.prototype.createWritable }));
    if (report.capabilities.picker !== 'function') { console.log(JSON.stringify(report, null, 2)); return; }
    await page.evaluate(() => {
      const picker = window.showOpenFilePicker.bind(window);
      window.showOpenFilePicker = async options => {
        try { const handles = await picker(options); window.pickerProbe = 'returned native handles'; return handles; }
        catch (e) { window.pickerProbe = { name: e.name, message: e.message }; throw e; }
      };
      document.addEventListener('drop', event => { window.nativeHandlePromise = event.dataTransfer.items[0].getAsFileSystemHandle(); }, true);
    });
    await page.locator('#web-direct-open').click();
    await page.waitForFunction(() => window.pickerProbe, null, { timeout: 5000 }).catch(() => {});
    report.nativePicker = await page.evaluate(() => window.pickerProbe || 'no result within 5 seconds');
    const cdp = await context.newCDPSession(page), data = { items: [], files: [file], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, x: 100, y: 100, data });
    report.nativeRead = await page.evaluate(async () => {
      const handle = await window.nativeHandlePromise;
      window.showOpenFilePicker = async () => [handle]; // only selection is bridged
      return { text: await (await handle.getFile()).text(), permission: await handle.queryPermission({ mode: 'readwrite' }) };
    });
    assert.equal(report.nativeRead.text, original);
    await page.locator('#web-direct-open').click();
    await page.waitForFunction(() => document.getElementById('web-file').textContent === 'native.jsonc' && !document.getElementById('web-save').disabled);
    await page.locator('#edit-config').click(); await page.locator('#field-title').fill('Native edited'); await page.locator('#edit-save').click();
    await page.waitForFunction(() => document.getElementById('title').textContent === 'Native edited'); await page.locator('#edit-close').click();
    await page.locator('#web-save').click(); await page.waitForFunction(() => document.getElementById('web-save').textContent === '保存');
    report.message = await page.locator('#web-message').textContent();
    report.nativeSave = report.message.includes('内容を確認しました') ? 'native writer succeeded; selection bridged' : 'NOT VERIFIED: native save was refused';
    if (!report.message.includes('内容を確認しました')) {
      assert.equal(await fs.readFile(file, 'utf8'), original);
      assert.equal(await page.locator('#title').textContent(), 'Native edited');
      assert.equal(await page.locator('#web-download').isEnabled(), true);
      report.denialProtection = 'source unchanged, edits and download retained';
    }
    console.log(JSON.stringify(report, null, 2)); await context.close();
  } finally { await browser.close(); await fs.rm(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
