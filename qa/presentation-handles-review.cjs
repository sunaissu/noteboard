const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseline = process.argv.includes('--baseline');
const results = [];
fs.mkdirSync('qa/artifacts', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[390, 844], [568, 320]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
      await page.goto('http://127.0.0.1:5180/?local=1&workspace=1');
      await page.waitForFunction(() => window.board);
      const board = page.getByLabel('Noteboard canvas', { exact: true });
      const handles = page.locator('button[aria-label^="Connect shape "],button[aria-label^="Connector bend "],button[aria-label="Add connector bend"]');
      const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const start = async name => {
        await board.focus(); await page.keyboard.press('Control+k');
        await page.getByRole('textbox', { name: 'Search commands' }).fill('Board workspace:');
        await page.keyboard.press('Enter');
        await page.getByRole('textbox', { name: 'Workspace item name' }).fill(name);
        await page.getByRole('button', { name: 'Save viewpoint', exact: true }).click();
        await page.getByRole('button', { name: 'Start presentation', exact: true }).click();
        await expect(page.getByRole('group', { name: 'Presentation controls' })).toBeVisible();
        await frame();
      };
      const stop = async () => {
        const end = page.getByRole('button', { name: 'End presentation', exact: true });
        await end.focus();
        assert.ok(await end.evaluate(el => {
          const box = el.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return hit === el || el.contains(hit);
        }), 'End presentation is reachable');
        await end.click();
      };

      for (const [id, expected] of [['label', 4], ['arrow', 1]]) {
        await page.evaluate(id => window.board.focusElements([id]), id);
        await expect(handles).toHaveCount(expected);
        await start(`Focused ${id} ${width}`);
        const during = await handles.count();
        results.push({ width, height, scenario: id + ' presentation', handlesDuring: during });
        if (!baseline) assert.equal(during, 0, 'presentation hides selected-object editing handles');
        await page.screenshot({ path: `qa/artifacts/presentation-${width}x${height}-${id}.png`, animations: 'disabled' });
        await stop();
        await expect(handles).toHaveCount(expected);
        results.push({ width, height, scenario: id + ' restored', handlesAfter: await handles.count() });
      }

      await page.evaluate(() => window.board.focusElements(['label']));
      await board.focus(); await page.keyboard.press('Control+Shift+Backquote');
      await start(`Keyboard presentation ${width}`);
      const help = page.getByRole('region', { name: 'Keyboard Canvas help', exact: true });
      const presentation = page.getByRole('group', { name: 'Presentation controls', exact: true });
      const helpBox = await help.count() ? await help.boundingBox() : null;
      const controlsBox = await presentation.boundingBox();
      if (!baseline) {
        await expect(page.locator('[data-keyboard-canvas]')).toBeVisible();
        await expect(help).toHaveCount(0);
      }
      const overlap = helpBox ? Math.min(helpBox.x + helpBox.width, controlsBox.x + controlsBox.width) - Math.max(helpBox.x, controlsBox.x) > 1 && Math.min(helpBox.y + helpBox.height, controlsBox.y + controlsBox.height) - Math.max(helpBox.y, controlsBox.y) > 1 : false;
      results.push({ width, height, scenario: 'keyboard presentation', overlap, helpBox, controlsBox });
      if (!baseline) assert.equal(overlap, false, 'keyboard help does not cover presentation controls');
      await page.screenshot({ path: `qa/artifacts/presentation-${width}x${height}-keyboard.png`, animations: 'disabled' });
      await stop(); await expect(help).toBeVisible();
      results.push({ width, height, scenario: 'keyboard help restored', visible: true });
      await board.focus(); await page.keyboard.press('3');
      await start(`Drawing presentation ${width}`);
      const drawingHelp = await help.count() ? await help.boundingBox() : null;
      const drawingControls = await presentation.boundingBox();
      if (!baseline) {
        await expect(page.locator('[data-keyboard-canvas]')).toBeVisible();
        await expect(help).toHaveCount(0);
      }
      const drawingOverlap = drawingHelp ? Math.min(drawingHelp.x + drawingHelp.width, drawingControls.x + drawingControls.width) - Math.max(drawingHelp.x, drawingControls.x) > 1 && Math.min(drawingHelp.y + drawingHelp.height, drawingControls.y + drawingControls.height) - Math.max(drawingHelp.y, drawingControls.y) > 1 : false;
      results.push({ width, height, scenario: 'drawing keyboard presentation', overlap: drawingOverlap, helpBox: drawingHelp, controlsBox: drawingControls });
      if (!baseline) assert.equal(drawingOverlap, false, 'drawing help does not cover presentation controls');
      await page.screenshot({ path: `qa/artifacts/presentation-${width}x${height}-drawing.png`, animations: 'disabled' });
      await stop(); await expect(help).toBeVisible();
      results.push({ width, height, scenario: 'drawing help restored', visible: true });
      await page.close();
    }
    console.log(`${results.length} focused presentation checks ${baseline ? 'recorded before fixes' : 'passed'}`);
  } finally {
    fs.writeFileSync(`qa/artifacts/presentation-handles${baseline ? '-before' : ''}.json`, JSON.stringify(results, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
