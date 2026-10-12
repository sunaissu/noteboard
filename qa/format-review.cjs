const { clickEditorTool } = require('./editor-tools.cjs');
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/');
    const editor = page.locator('.sunaissu-document-editor');
    const headingStyles = node => { const s = getComputedStyle(node); return [s.fontSize, s.lineHeight, s.letterSpacing, s.fontWeight]; };
    const visualStyle = await editor.locator('h1').evaluate(headingStyles);
    assert.equal(visualStyle[0], '32px');
    assert.equal(await editor.locator('li[data-task]').first().evaluate(node => getComputedStyle(node).listStyleType), 'none');
    const pane = editor.locator('.sunaissu-document-write-pane');
    assert.equal(await pane.evaluate(node => getComputedStyle(node).overflowY), 'auto');
    await pane.evaluate(node => node.scrollTop = node.scrollHeight);
    assert.ok(await pane.evaluate(node => node.scrollTop > 0));
    await expect(editor.getByRole('link', { name: 'link', exact: true })).toBeInViewport();
    await pane.evaluate(node => node.scrollTop = 0);
    await editor.screenshot({ path: __dirname + '/artifacts/format-desktop-light.png', animations: 'disabled' });
    await clickEditorTool(page, 'Preview');
    assert.deepEqual(await editor.locator('h1').evaluate(headingStyles), visualStyle);
    await expect(editor.locator('.rich-task-box').first()).toHaveCSS('display', 'inline-flex');
    await clickEditorTool(page, 'Visual');
    for (const theme of ['light','dark']) {
      await page.locator('.inspector').getByRole('button', { name: theme, exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await editor.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await expect(editor.getByRole('button', { name: 'More', exact: true })).toBeVisible();
      await editor.screenshot({ path: __dirname + '/artifacts/format-mobile-' + theme + '.png', animations: 'disabled' });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await editor.screenshot({ path: __dirname + '/artifacts/format-desktop-dark.png', animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log('Formatting checks passed: heading isolation, visual/preview parity, task layout, scrolling, mobile overflow, light/dark themes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
