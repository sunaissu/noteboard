const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');

(async () => {
 const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/passive event listener/.test(message.text())) errors.push(message.text()); });
  async function openBoard(position = 'top') {
   await page.goto('http://127.0.0.1:5191/?mode=board&position=' + position);
   await page.waitForFunction(() => window.board?.getElements().length === 4);
   await page.evaluate(() => { window.board.focusElements(['label', 'arrow', 'star', 'pen']); document.body.style.minHeight = '2200px'; });
   if (!position.includes('readonly')) await expect(page.getByRole('region', { name: 'Object properties' })).toBeVisible();
  }
  const viewport = () => page.evaluate(() => window.board.getSession().viewport);
  const pageScroll = () => page.evaluate(() => window.scrollY);
  async function wheel(x, y, dx, dy) {
   await page.mouse.move(x, y); await page.mouse.wheel(dx, dy);
   // Wait for the browser's asynchronous wheel/scroll dispatch, including chaining.
   await page.waitForTimeout(180);
  }
  await openBoard();
  const panel = page.getByRole('region', { name: 'Object properties' });
  assert.ok((await panel.boundingBox()).height <= 220);
  const before = await viewport();
  await wheel(950, 600, 0, 300);
  assert.equal(await pageScroll(), 0, 'canvas wheel must not scroll the host page');
  assert.ok((await viewport()).panY < before.panY, 'canvas wheel must still pan');
  await page.keyboard.down('Shift'); await wheel(950, 600, 0, 100); await page.keyboard.up('Shift');
  assert.ok((await viewport()).panX < before.panX, 'Shift+wheel pans horizontally');
  const zoomBefore = await viewport();
  await page.keyboard.down('Control'); await wheel(950, 600, 0, -100); await page.keyboard.up('Control');
  assert.ok((await viewport()).zoom > zoomBefore.zoom);
  assert.equal(await pageScroll(), 0);
  const strip = panel.locator('[data-property-scroll]');
  const stripBounds = await strip.boundingBox();
  const fixed = await viewport();
  await wheel(stripBounds.x + 50, stripBounds.y + 15, 0, 250);
  assert.ok(await strip.evaluate(node => node.scrollLeft > 0), 'vertical wheel navigates horizontal controls');
  assert.deepEqual(await viewport(), fixed, 'properties must not pan the board');
  await strip.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  await wheel(stripBounds.x + 50, stripBounds.y + 15, 0, 600);
  assert.equal(await pageScroll(), 0, 'properties must not chain scroll at their edge');
  await panel.getByRole('tab', { name: 'Text', exact: true }).click();
  await panel.getByRole('tabpanel').filter({ visible: true }).getByTitle('Bold', { exact: true }).click();
  await page.waitForFunction(() => window.board.getElements().find(item => item.id === 'label').fontWeight === 'bold');
  await panel.getByRole('tab', { name: 'Text', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(panel.getByRole('tab', { name: 'Star', exact: true })).toBeFocused();
  await expect(panel.getByRole('tab', { name: 'Star', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.evaluate(() => window.board.focusElements(['label']));
  await expect(panel.getByRole('tab', { name: 'Appearance', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: 'qa/artifacts/properties-compact-desktop.png' });
  // Scrolling outside the component must still work normally.
  await wheel(6, 20, 0, 200); assert.ok(await pageScroll() > 0);
  for (const position of ['left', 'right']) {
   await openBoard(position);
   const body = panel.locator('[data-property-scroll]');
   const bounds = await body.boundingBox();
   await wheel(bounds.x + 40, bounds.y + 100, 0, 200);
   assert.ok(await body.evaluate(node => node.scrollTop > 0));
   await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
   await wheel(bounds.x + 40, bounds.y + 100, 0, 800);
   assert.equal(await pageScroll(), 0);
   await body.evaluate(node => { node.scrollTop = 0; });
   await wheel(bounds.x + 40, bounds.y + 100, 0, -800);
   assert.equal(await pageScroll(), 0);
  }
  for (const position of ['top', 'bottom']) {
   await page.setViewportSize({ width: 390, height: 844 }); await openBoard(position);
   assert.ok((await panel.boundingBox()).height <= 220);
   for(const category of ['appearance','text','shadow']) { await panel.getByLabel('Property category').selectOption(category);await expect(panel.getByLabel('Property category')).toHaveValue(category); }
   await panel.getByLabel('Property category').selectOption('appearance');
   await page.evaluate(() => scrollTo(0, 0));
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.screenshot({ path: 'qa/artifacts/properties-compact-mobile-' + position + '.png' });
  }
  for (const position of ['top', 'bottom']) {
   await openBoard(position + '&toolbar=' + position);
   const overlaps = await page.evaluate(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect();
    const panel = bounds('[aria-label="Object properties"]'), toolbar = bounds('[data-noteboard-toolbar]');
    const zoom = bounds('[title="Reset zoom to 100%"]'), settings = bounds('[title="Settings"]');
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return overlaps(panel, toolbar) || overlaps(panel, zoom) || overlaps(panel, settings) || overlaps(toolbar, settings);
   });
   assert.equal(overlaps, false, 'panels sharing an edge must not overlap');
   await panel.getByTitle('Collapse panel', { exact: true }).click();
   assert.ok((await panel.boundingBox()).height < 60);
  }
  await openBoard('top&readonly');
  const readOnlyViewport = await viewport();
  await wheel(180, 400, 0, 150);
  assert.ok((await viewport()).panY < readOnlyViewport.panY);
  assert.equal(await pageScroll(), 0);
  console.log('Properties height, categories, keyboard access, canvas pan/zoom and nested scroll boundaries passed');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5174/');
  const bar = page.locator('.sunaissu-document-toolbar');
  for (const name of ['Bold', 'Italic', 'Bullet list', 'Numbered list', 'Link', 'Image', 'Table', 'Find & replace', 'Outline', 'Markdown']) {
   await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(bar.locator('.document-menu-popup')).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(page.getByLabel('Image URL')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(bar.getByRole('button', { name: 'Image', exact: true })).toBeFocused();
  await page.screenshot({ path: 'qa/artifacts/editor-direct-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await expect(bar.getByRole('button', { name: 'Image', exact: true })).toBeVisible();
  await bar.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.getByLabel('Markdown source')).toBeVisible();
  await page.screenshot({ path: 'qa/artifacts/editor-direct-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('Direct editor controls, focus restoration, views and narrow layout passed');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
