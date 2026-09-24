'use strict';
// Optional real-browser flow: install Playwright separately from runtime deps.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { buildWeb } = require('../scripts/build-web');

(async () => {
  const out = await buildWeb(), capture = process.env.CRC_CAPTURE_DIR;
  if (capture) await fs.mkdir(capture, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CRC_BROWSER_EXECUTABLE ? { executablePath: process.env.CRC_BROWSER_EXECUTABLE } : {}),
    args: process.env.CRC_BROWSER_ARGS ? JSON.parse(process.env.CRC_BROWSER_ARGS) : []
  });
  const report = { browser: browser.version(), checks: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, offline: true });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(path.join(out, 'index.html')).href);
    await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    assert.equal(await page.locator('.edge').count(), 8);
    for (const id of ['edit-config', 'config-editor', 'save-view', 'reload-view', 'open-view', 'open-source', 'export']) assert.equal(await page.locator('#' + id).isVisible(), false);
    report.checks.push('offline file-URL startup, sample and read-only controls');
    if (capture) await page.screenshot({ path: path.join(capture, 'web-desktop.png') });

    const first = page.locator('.node').first(), before = await first.getAttribute('transform'), box = await first.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 35, { steps: 8 }); await page.mouse.up();
    assert.equal(await page.locator('#details').isVisible(), false); assert.notEqual(await first.getAttribute('transform'), before);
    await first.click(); assert.equal(await page.locator('#details').isVisible(), true); assert.equal(await page.locator('.detail-edit').count(), 0);
    await page.locator('#close-details').click();
    await page.locator('#search').fill('no-such-character'); assert.equal(await page.locator('.node.faded').count(), 6);
    await page.locator('#search').fill('');
    await page.locator('#more-menu summary').click(); const zoom = await page.locator('#zoom').textContent();
    await page.locator('#zoom-in').click(); assert.notEqual(await page.locator('#zoom').textContent(), zoom);
    await page.locator('#more-menu summary').click();
    report.checks.push('real pointer drag versus click, search, details and zoom');

    const input = (name, text) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
    const data = '{ // comment\n"nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"from":"a","to":"b","label":"Together"}]}';
    await page.locator('#web-files').setInputFiles(input('任意名.jsonc', data));
    await page.waitForFunction(() => document.getElementById('web-file').textContent === '任意名.jsonc');
    assert.equal(await page.locator('.node').count(), 2); assert.equal(await page.locator('#search').inputValue(), '');
    await page.locator('#web-view').setInputFiles(input('任意名.jsonc.view.json', JSON.stringify({ version: 1, positions: { a: { x: 321, y: 123, source: ',' } }, camera: { x: 90, y: 110, scale: 1.4, width: 1000, height: 680 } })));
    await page.waitForFunction(() => document.querySelector('.node').getAttribute('transform') === 'translate(321 123)');
    assert.match(await page.locator('#viewport').getAttribute('transform'), /scale\(1\.4\)$/);
    await page.locator('#web-files').setInputFiles(input('bad.jsonc', '{\nINVALID'));
    await page.waitForFunction(() => !document.getElementById('error').hidden);
    assert.equal(await page.locator('.node').count(), 2); assert.match(await page.locator('#error').textContent(), /2行/);
    report.checks.push('local JSONC and matching sidecar, camera restoration and invalid-input recovery');

    await page.evaluate(value => {
      const transfer = new DataTransfer(); transfer.items.add(new File([value], 'drop.jsonc'));
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }, data);
    await page.waitForFunction(() => document.getElementById('web-file').textContent === 'drop.jsonc');
    assert.equal(await page.locator('#error').isVisible(), false);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await page.locator('#web-sample').click(); await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    report.checks.push('file drop and continued reading after a cached-page transition');
    await page.setViewportSize({ width: 390, height: 780 });
    await page.locator('#fit').click(); await page.locator('.node').first().click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#details').isVisible(), true);
    if (capture) await page.screenshot({ path: path.join(capture, 'web-narrow.png') });
    await page.locator('#close-details').click(); await page.locator('#focus').click();
    assert.equal(await page.locator('.web-bar').isVisible(), false); await page.locator('#exit-focus').click();
    assert.equal(await page.locator('.web-bar').isVisible(), true);
    await page.reload(); await page.waitForFunction(() => document.querySelectorAll('.node').length === 6);
    assert.equal(await page.locator('#details').isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.checks.push('390px layout, focus mode, refresh reset and zero application network requests');

    // Test the actual policy without relaxing browser web security.
    const policy = await page.evaluate(async () => {
      const violations = []; document.addEventListener('securitypolicyviolation', e => violations.push(e.effectiveDirective));
      const script = document.createElement('script'); script.textContent = 'window.forbiddenInlineScript = true'; document.head.append(script);
      await fetch('https://example.com/blocked-by-viewer-policy').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 50));
      return { ran: !!window.forbiddenInlineScript, violations };
    });
    assert.equal(policy.ran, false); assert.ok(policy.violations.includes('script-src-elem')); assert.ok(policy.violations.includes('connect-src'));
    report.checks.push('CSP blocks inline scripts and outbound connections');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
