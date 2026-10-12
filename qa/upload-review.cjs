const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const { clickEditorTool } = require('./editor-tools.cjs');

(async () => {
 const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  async function begin(source = false) {
   await page.goto('http://127.0.0.1:5191/?mode=upload' + (source ? '&source' : ''));
   if (source) await page.getByLabel('Markdown source').evaluate(el => { el.focus(); el.setSelectionRange(7, 7); });
   else await page.locator('.sunaissu-rich-text-editor p').first().click();
   await clickEditorTool(page, 'Image');
   const buffer = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
    return canvas.toDataURL().split(',')[1];
   }), 'base64');
   await page.locator('.document-image-upload input').setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer });
   await page.waitForFunction(() => Boolean(window.finishUpload));
  }
  for (const source of [false, true]) {
   await begin(source);
   if (source) await page.getByLabel('Markdown source').evaluate(el => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
   else await page.locator('.sunaissu-rich-text-editor p').last().click();
   await page.evaluate(() => window.finishUpload());
   await expect(page.getByRole('status')).toContainText('Image inserted');
   const value = await page.evaluate(() => window.uploadFixture.value);
   assert.ok(value.indexOf('Before.') < value.indexOf('![Uploaded picture]'));
   assert.ok(value.indexOf('![Uploaded picture]') < value.indexOf('After.'));
   assert.ok(value.includes('Literal \\*caption\\*'));
   await page.getByRole('button', { name: 'Undo', exact: true }).click();
   await page.waitForFunction(() => !window.uploadFixture.value.includes('uploaded.png'));
  }
  for (const scenario of ['cancel', 'edit', 'readonly', 'unmount']) {
   await begin();
   if (scenario === 'cancel') await page.getByRole('button', { name: 'Cancel upload' }).click();
   if (scenario === 'edit') await page.evaluate(() => window.uploadFixture.setValue('Changed by another editor'));
   if (scenario === 'readonly') await page.evaluate(() => window.uploadFixture.setReadOnly(true));
   if (scenario === 'unmount') await page.evaluate(() => window.uploadFixture.setMounted(false));
   await page.waitForFunction(() => window.uploadSignal.aborted);
   await page.evaluate(async () => { window.finishUpload(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
   assert.ok(!(await page.evaluate(() => window.uploadFixture.value)).includes('uploaded.png'), scenario);
  }
  assert.deepEqual(errors, []);
  console.log('Image upload stable anchors, captions, undo, cancellation, changed content, read-only and unmount guards passed');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
