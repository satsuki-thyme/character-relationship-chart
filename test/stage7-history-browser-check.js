'use strict';
// Real Chromium rendering, keyboard, gestures and downloads. Save handles below
// are explicit doubles; this does not certify native picker/write permissions.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web');
const { parseConfig } = require('../packages/core/config');
(async () => {
  const out = process.env.CRC_WEB_DIR || await buildWeb(await fs.mkdtemp(path.join(os.tmpdir(), 'crc-history-')));
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : [] });
  const report = { browser: browser.version(), handles: 'simulated', checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, offline: true });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.addInitScript(() => {
      window.historyTest = { source: '\uFEFF{\r\n// keep コメント\r\n"groups":[{"id":"g1","label":"One"},{"id":"g2","label":"Two"}],"nodes":[{"id":"a","label":"A","groups":["g1","g2"]},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","shape":"curved","label":"Link"}]\r\n}', config: null, view: null, open: 'config' };
      const t = window.historyTest;
      t.config = { text: t.source, writes: 0 }; t.view = { text: '{"version":1}', writes: 0 };
      t.handles = {};
      for (const key of ['config','view']) {
        const d = t[key]; t.handles[key] = { kind: 'file', name: key === 'config' ? 'cast.jsonc' : 'cast.jsonc.view.json',
          async getFile() { return new File([d.text], this.name); }, async isSameEntry(other) { return this === other; },
          async requestPermission() { return 'granted'; }, async createWritable() { let bytes; return {
            async write(value) { d.writes++; bytes = value; if (d.slow) await new Promise(resolve => { d.release = resolve; }); },
            async close() { d.text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes); if (d.uncertain) throw new Error('injected unknown result'); }, async abort() {}
          }; }
        };
      }
      window.showOpenFilePicker = async () => [t.handles[t.open]];
      window.showSaveFilePicker = async () => t.handles.view;
      t.storageCalls = [];
      Storage.prototype.setItem = function () { t.storageCalls.push('storage'); throw new Error('unexpected persistence'); };
    });
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    const click = id => page.locator('#' + id).click();
    const coords = () => page.locator('.node').evaluateAll(nodes => nodes.map(n => n.getAttribute('transform')));
    const downloaded = async id => {
      const pending = page.waitForEvent('download'); await click(id); const file = await pending;
      return { name: file.suggestedFilename(), text: await fs.readFile(await file.path(), 'utf8') };
    };
    const apply = async () => { await click('edit-save'); await page.waitForFunction(() => document.getElementById('edit-message').textContent.startsWith('相関図に反映しました')); };
    const sourceOpen = async () => {
      await page.evaluate(() => { historyTest.open = 'config'; }); page.once('dialog', d => d.accept()); await click('web-direct-open');
      await page.waitForFunction(() => document.getElementById('web-file').textContent === 'cast.jsonc');
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    };
    await sourceOpen(); assert.equal(await page.locator('#web-undo').isDisabled(), true);
    const initial = await coords(), box = await page.locator('.node').first().boundingBox();
    await page.mouse.move(box.x + 15, box.y + 15); await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, { steps: 8 }); await page.mouse.up();
    const moved = await coords(); assert.notDeepEqual(moved, initial); await click('web-undo'); assert.deepEqual(await coords(), initial); await click('web-redo'); assert.deepEqual(await coords(), moved);
    report.checks.push('real pointer gesture is one reversible step; all node coordinates return');

    await click('edit-config'); await page.locator('[data-kind="nodes"]').click(); await page.locator('#field-id').fill('hero'); await apply(); await click('edit-close');
    const renamed = await coords(), config = await downloaded('web-download'), view = await downloaded('web-view-download');
    assert.match(config.text, /keep コメント/); assert.deepEqual(parseConfig(config.text).config.nodes[0].groups, ['g1','g2']); assert.equal(parseConfig(config.text).config.edges[0].from, 'hero');
    assert.ok(JSON.parse(view.text).positions.hero); await click('web-undo'); assert.deepEqual(await coords(), moved);
    assert.equal(parseConfig((await downloaded('web-download')).text).config.nodes[0].id, 'a');
    await click('web-redo'); assert.deepEqual(await coords(), renamed);
    report.checks.push('ID, memberships, edge reference, comments and actual UTF-8 config/view downloads round-trip');

    await click('web-save'); await page.waitForFunction(() => document.getElementById('web-message').textContent.includes('内容を確認しました'));
    await page.evaluate(() => { historyTest.view.text = ''; }); await click('web-view-save-as');
    await page.waitForFunction(() => document.getElementById('web-message').textContent.includes('設定本体と未反映'));
    const saved = await page.evaluate(() => ({ config: historyTest.config.text, view: historyTest.view.text, writes: historyTest.config.writes + historyTest.view.writes }));
    await click('web-undo'); assert.match(await page.locator('#status').textContent(), /未保存/); assert.match(await page.locator('#web-view-status').textContent(), /未保存/);
    await click('web-redo'); assert.doesNotMatch(await page.locator('#status').textContent(), /未保存/); assert.doesNotMatch(await page.locator('#web-view-status').textContent(), /未保存/);
    assert.deepEqual(await page.evaluate(() => ({ config: historyTest.config.text, view: historyTest.view.text, writes: historyTest.config.writes + historyTest.view.writes })), saved);
    report.checks.push('verified save snapshots are retained and Undo/Redo never writes either real-target double');

    await click('edit-config'); await page.locator('#field-title').fill('未反映の入力');
    await page.locator('#edit-heading').click(); await page.keyboard.press('Control+z');
    assert.equal(await page.locator('#field-title').inputValue(), '未反映の入力'); assert.match(await page.locator('#web-message').textContent(), /未反映/);
    await page.locator('#field-title').focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await coords(), renamed, 'text Undo did not invoke page history');
    await page.locator('#field-title').fill('分岐'); await apply(); await click('edit-close');
    await page.locator('#canvas').focus(); await page.keyboard.press('Control+z');
    assert.equal(await page.locator('#web-redo').isEnabled(), true);
    await page.keyboard.press('Control+Shift+z'); assert.match((await downloaded('web-download')).text, /分岐/);
    await click('web-undo'); await click('edit-config'); await page.locator('#field-title').fill('別の編集'); await apply(); await click('edit-close');
    assert.equal(await page.locator('#web-redo').isDisabled(), true);
    report.checks.push('unapplied form and native text Undo are preserved; page keyboard Undo/Redo and new-edit branch work');

    await page.evaluate(() => { historyTest.config.slow = true; }); await click('web-save');
    await page.waitForFunction(() => typeof historyTest.config.release === 'function');
    assert.equal(await page.locator('#web-undo').isDisabled(), true); await page.locator('#canvas').focus(); await page.keyboard.press('Control+z');
    assert.match(await page.locator('#web-message').textContent(), /保存中/);
    await page.evaluate(() => { historyTest.config.slow = false; historyTest.config.release(); });
    await page.waitForFunction(() => document.getElementById('web-message').textContent.includes('内容を確認しました'));
    report.checks.push('history is refused during an in-flight save without dropping input or changing the saved snapshot');

    await page.evaluate(() => { historyTest.config.text += ' '; }); await click('web-save');
    await page.waitForFunction(() => document.getElementById('web-save-note').textContent.includes('停止'));
    await click('web-undo'); await click('web-redo'); assert.equal(await page.locator('#web-save').isDisabled(), true);
    assert.equal((await downloaded('web-download')).name, 'cast.jsonc');
    await click('edit-config'); await page.locator('#field-title').fill('保存しない草稿');
    await page.evaluate(() => { historyTest.open = 'view'; });
    await page.locator('#web-direct-view-open').dispatchEvent('click');
    await page.waitForFunction(() => document.getElementById('web-file').textContent.includes('.view.json'));
    assert.equal(await page.locator('#field-title').inputValue(), '保存しない草稿');
    assert.equal(await page.locator('#web-redo').isDisabled(), true); assert.equal(await page.locator('#web-undo').isDisabled(), true);
    report.checks.push('conflict stop survives history; downloads remain available; sidecar-only reload preserves draft and resets history');

    await click('edit-close'); await page.locator('#edit-confirm button').first().click();
    page.once('dialog', d => d.accept()); await page.locator('#web-files').setInputFiles({ name: 'cast.jsonc', mimeType: 'application/json', buffer: Buffer.from('{"nodes":[{"id":"other","label":"別作品"}],"edges":[]}') });
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 1);
    assert.equal(await page.locator('#web-undo').isDisabled(), true); assert.equal(await page.locator('#web-redo').isDisabled(), true); assert.equal(await page.locator('#web-save').isDisabled(), true);
    await page.setViewportSize({ width: 390, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (process.env.CRC_CAPTURE_DIR) { await fs.mkdir(process.env.CRC_CAPTURE_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.CRC_CAPTURE_DIR, 'stage7-narrow.png'), fullPage: true }); }
    assert.deepEqual(await page.evaluate(() => historyTest.storageCalls), []); assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.checks.push('same-name source isolation, 390px layout, file URL/offline use, no storage writes or HTTP(S) requests');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
