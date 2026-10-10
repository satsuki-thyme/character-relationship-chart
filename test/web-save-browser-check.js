'use strict';
// Real Chromium UI with controlled file-handle doubles. This does NOT certify
// the OS picker, native write permission prompt or native local-file writes.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web');
const { parseConfig } = require('../packages/core/config');
(async () => {
  const out = await buildWeb(), capture = process.env.CRC_CAPTURE_DIR;
  if (capture) await fs.mkdir(capture, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : [] });
  const report = { browser: browser.version(), fileHandles: 'simulated; native external-file success NOT tested', checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.addInitScript(() => {
      window.disk = { text: '\uFEFF{\r\n\t// keep コメント\r\n\t"nodes":[{"id":"a","label":"A","groups":["g1","g2"]},{"id":"b","label":"B"}],\r\n\t"groups":[{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],\r\n\t"edges":[{"from":"a","to":"b","label":"Link"}]\r\n}\r\n', permission: 'granted', writes: 0, closes: 0, fail: '' };
      window.fakeHandle = { kind: 'file', name: '人物.jsonc',
        async getFile() { return new File([disk.text], this.name); },
        async requestPermission() { return disk.permission; },
        async createWritable() {
          let bytes;
          return { async write(b) { disk.writes++; bytes = b; if (disk.fail === 'write') throw new Error('write failed'); },
            async close() { disk.closes++; disk.text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes); }, async abort() {} };
        }
      };
      window.showOpenFilePicker = async () => [window.fakeHandle];
    });
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    assert.equal(await page.locator('#web-save').isEnabled(), false);
    await page.locator('#web-direct-open').click(); await page.waitForFunction(() => document.getElementById('web-file').textContent === '人物.jsonc');
    const tab = kind => page.locator(`[data-kind="${kind}"]`).click();
    const apply = async () => { await page.locator('#edit-save').click(); await page.waitForFunction(() => document.getElementById('edit-message').textContent.startsWith('相関図に反映しました')); };
    const save = async () => { await page.locator('#web-save').click(); await page.waitForFunction(() => document.getElementById('web-save').textContent === '設定を保存'); };
    await page.locator('#edit-config').click(); await page.locator('#field-title').fill('保存する相関図'); await apply();
    await tab('nodes'); await page.locator('#field-id').fill('hero'); await apply();
    await tab('groups'); await page.locator('#field-id').fill('crew'); await apply();
    await tab('edges'); await page.locator('#field-label').fill('友情'); await apply(); await page.locator('#edit-close').click();
    await save(); assert.match(await page.locator('#web-message').textContent(), /内容を確認しました/);
    const saved = await page.evaluate(() => disk.text), config = parseConfig(saved).config;
    assert.equal(config.title, '保存する相関図'); assert.deepEqual(config.nodes[0].groups, ['crew', 'g2']); assert.equal(config.edges[0].from, 'hero'); assert.equal(config.edges[0].label, '友情');
    assert.ok(saved.startsWith('\uFEFF')); assert.match(saved, /\t\/\/ keep コメント\r\n/); assert.equal(saved.replace(/\r\n/g, '').includes('\n'), false);
    // Config saving cannot mark the renamed IDs in the view snapshot as saved.
    assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); return e.defaultPrevented; }), true);
    assert.match(await page.locator('#web-view-status').textContent(), /未保存/);
    report.checks.push('applied general/person/group/relation edits, references, multiple membership, exact JSONC and verified dirty clearing (handle double)');
    if (capture) await page.screenshot({ path: path.join(capture, 'stage5-saved.png') });

    // Reopen the saved bytes, explicitly discarding the unsaved view snapshot.
    page.once('dialog', d => d.accept()); await page.locator('#web-direct-open').click();
    await page.locator('#edit-config').click(); await tab('general'); await page.locator('#field-title').fill('退避する編集'); await apply();
    await page.locator('#field-title').fill('未反映の入力');
    // A modal prevents physical clicks on the outer Save button; dispatching a
    // click here specifically verifies that Save never applies a pending form.
    await page.locator('#web-save').dispatchEvent('click'); await page.waitForFunction(() => disk.closes === 2);
    assert.equal(await page.locator('#field-title').inputValue(), '未反映の入力');
    assert.equal(parseConfig(await page.evaluate(() => disk.text)).config.title, '退避する編集');
    assert.match(await page.locator('#web-message').textContent(), /未反映のフォーム入力/);
    await page.locator('#field-title').fill('競合前の編集'); await apply(); await page.locator('#edit-close').click();
    await page.evaluate(() => { disk.text += '// 外部の更新'; }); const external = await page.evaluate(() => disk.text);
    await save(); assert.match(await page.locator('#web-message').textContent(), /外部で変更/);
    assert.equal(await page.evaluate(() => disk.text), external); assert.equal(await page.locator('#title').textContent(), '競合前の編集');
    assert.equal(await page.locator('#web-save').isEnabled(), false);
    if (capture) await page.screenshot({ path: path.join(capture, 'stage5-conflict.png') });
    const downloadEvent = page.waitForEvent('download'); await page.locator('#web-download').click(); const download = await downloadEvent;
    const bytes = await fs.readFile(await download.path()); assert.equal(parseConfig(bytes.toString()).config.title, '競合前の編集');
    assert.equal(await page.evaluate(() => disk.text), external);
    report.checks.push('unapplied form preservation, conflict stops commit, actual UTF-8 browser download retains work');
    let dismissed;
    const dismissedPromise = new Promise(resolve => { dismissed = resolve; });
    page.once('dialog', async dialog => { await dialog.dismiss(); dismissed(); });
    await page.locator('#web-sample').click(); await dismissedPromise;
    assert.equal(await page.locator('#title').textContent(), '競合前の編集');
    report.checks.push('cancelled replacement and download keep dirty state and current chart');

    for (const fault of ['denied', 'write']) {
      page.once('dialog', d => d.accept()); await page.locator('#web-direct-open').click();
      await page.waitForFunction(() => !document.getElementById('web-save').disabled);
      await page.locator('#edit-config').click(); await tab('general'); await page.locator('#field-title').fill('失敗しても保持'); await apply(); await page.locator('#edit-close').click();
      await page.evaluate(f => { disk.permission = f === 'denied' ? 'denied' : 'granted'; disk.fail = f; }, fault);
      const before = await page.evaluate(() => disk.text); await save();
      assert.match(await page.locator('#web-message').textContent(), /退避できます/);
      assert.equal(await page.evaluate(() => disk.text), before); assert.equal(await page.locator('#title').textContent(), '失敗しても保持');
    }
    report.checks.push('permission denial and stream write failure preserve edits (injected faults)');
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.checks.push('offline file URL, zero HTTP(S) requests and zero page errors');
    await context.close();
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
