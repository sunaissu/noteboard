const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const report = [];
const root = 'http://127.0.0.1:5180';
const imageRoot = 'qa/artifacts';
fs.mkdirSync(imageRoot, { recursive: true });

async function inspect(locator) {
  return locator.evaluate(el => {
    const box = el.getBoundingClientRect(), board = el.closest('.noteboard-canvas').getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    const clippedBy = [];
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
      if ((/(auto|scroll|hidden|clip)/.test(style.overflowX) && (box.left < rect.left - 1 || box.right > rect.right + 1)) ||
          (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (box.top < rect.top - 1 || box.bottom > rect.bottom + 1))) {
        clippedBy.push(parent.getAttribute('aria-label') || parent.tagName);
      }
    }
    return {
      rect: { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom },
      board: { x: board.x, y: board.y, width: board.width, height: board.height, right: board.right, bottom: board.bottom },
      bounded: box.left >= board.left - 1 && box.right <= board.right + 1 && box.top >= board.top - 1 && box.bottom <= board.bottom + 1,
      hit: !!hit && (hit === el || el.contains(hit)),
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      active: document.activeElement === el,
      clippedBy,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
      page.setDefaultTimeout(4000);
      const board = page.getByLabel('Noteboard canvas', { exact: true });
      const ready = async (extra = '') => {
        await page.goto(root + '/?local=1&workspace=1' + extra);
        await page.waitForFunction(() => window.board);
      };
      const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const capture = async name => page.screenshot({ path: `${imageRoot}/overlay-${width}x${height}-${name}.png`, animations: 'disabled' });
      const run = async (name, task) => {
        try { await task(); }
        catch (error) { report.push({ width, height, name, error: String(error) }); await capture(name + '-failure'); }
      };

      await run('context', async () => {
        await ready(); await board.focus();
        await page.evaluate(() => window.board.focusElements(['label']));
        const canvas = board.locator('canvas').first();
        const freePoint = await canvas.evaluate(el => {
          const box = el.getBoundingClientRect();
          for (const y of [0.5, 0.65, 0.8, 0.35, 0.2]) for (const x of [0.5, 0.7, 0.3, 0.9, 0.1]) {
            if (document.elementFromPoint(box.x + box.width * x, box.y + box.height * y) === el) return { x: box.width * x, y: box.height * y };
          }
          return null;
        });
        assert.ok(freePoint, 'some canvas area remains available');
        await canvas.click({ button: 'right', position: freePoint });
        const menu = page.getByRole('menu', { name: 'Board actions' });
        await expect(menu).toBeVisible(); await frame();
        report.push({ width, height, name: 'context menu', ...await inspect(menu) });
        await page.keyboard.press('End'); await frame();
        const last = menu.locator('button:not(:disabled)').last();
        report.push({ width, height, name: 'context last keyboard item', ...await inspect(last) });
        await capture('context-last');
        await page.keyboard.press('Home'); await frame();
        report.push({ width, height, name: 'context first keyboard item', ...await inspect(menu.locator('button:not(:disabled)').first()) });
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
        report.push({ width, height, name: 'context focus returned', passed: await board.evaluate(el => document.activeElement === el) });
      });

      await run('keyboard-text', async () => {
        await ready(); await page.evaluate(() => window.board.focusElements(['label']));
        await board.focus(); await page.keyboard.press('Control+Shift+Backquote'); await frame();
        const instructions = page.getByRole('region', { name: 'Keyboard Canvas help', exact: true });
        report.push({ width, height, name: 'keyboard instructions', ...await inspect(instructions) });
        if (await instructions.locator('summary').count()) {
          await instructions.locator('summary').click();
          await frame();
          report.push({ width, height, name: 'expanded keyboard instructions', ...await inspect(instructions) });
          await instructions.focus(); await page.keyboard.press('Escape');
          await expect(board).toBeFocused();
        }
        await capture('keyboard');
        await page.keyboard.press('Enter');
        const input = page.getByRole('textbox', { name: 'Edit object text', exact: true });
        await expect(input).toBeFocused(); await frame();
        report.push({ width, height, name: 'inline text short', ...await inspect(input) });
        await input.fill(Array.from({ length: 18 }, (_, i) => `Mobile text line ${i + 1}`).join('\n'));
        await frame();
        report.push({ width, height, name: 'inline text long', ...await inspect(input) });
        await input.press('Control+Home');
        assert.ok(await input.evaluate(el => el.scrollTop <= 2), 'first text line is accessible within the textarea padding');
        await input.press('Control+End');
        assert.ok(await input.evaluate(el => el.scrollHeight <= el.clientHeight + 1 || el.scrollTop > 0), 'last text line is accessible');
        await capture('text-long');
        await page.evaluate(() => window.board.setElements([]));
        await input.press('Control+Enter');
        const recovered = page.getByRole('textbox', { name: 'Recovered text' });
        await expect(recovered).toBeVisible();
        report.push({ width, height, name: 'text recovery alert', ...await inspect(page.getByRole('alert')) });
        const dismiss = page.getByRole('alert').getByRole('button', { name: 'Dismiss' });
        await dismiss.focus(); await frame();
        report.push({ width, height, name: 'text recovery dismiss', ...await inspect(dismiss) });
        await capture('text-recovery'); await dismiss.click();
      });

      await run('drawing-help', async () => {
        await ready(); await board.focus(); await page.keyboard.press('3');
        await page.keyboard.press('Control+Shift+Backquote'); await frame();
        const help = page.getByRole('region', { name: 'Keyboard Canvas help', exact: true });
        report.push({ width, height, name: 'drawing keyboard help', ...await inspect(help) });
        if (await help.locator('summary').count()) {
          const summary = help.locator('summary');
          await summary.click(); await frame();
          report.push({ width, height, name: 'expanded compact drawing help', ...await inspect(help) });
          await help.focus(); await page.keyboard.press('End');
          assert.ok(await help.evaluate(el => el.scrollHeight <= el.clientHeight + 1 || el.scrollTop > 0), 'expanded keyboard help scrolls to all instructions');
          await page.keyboard.press('Escape'); await expect(board).toBeFocused();
        }
        await capture('drawing-help');
      });

      await run('quick-connect', async () => {
        await ready(); await page.evaluate(() => window.board.focusElements(['label'])); await frame();
        for (const direction of ['left', 'right', 'up', 'down']) {
          const button = page.getByRole('button', { name: 'Connect shape ' + direction, exact: true });
          report.push({ width, height, name: 'quick connect ' + direction, ...await inspect(button) });
        }
        await capture('quick-connect');
      });

      await run('bend', async () => {
        await ready(); await page.evaluate(() => window.board.focusElements(['arrow'])); await frame();
        const add = page.getByRole('button', { name: 'Add connector bend', exact: true });
        report.push({ width, height, name: 'add bend', ...await inspect(add) });
        await add.click(); await frame();
        const bend = page.getByRole('button', { name: 'Connector bend 1', exact: true });
        report.push({ width, height, name: 'bend control', ...await inspect(bend) });
        await capture('connector-bend');
        await bend.focus(); await page.keyboard.press('ArrowDown');
        const before = await page.evaluate(() => JSON.stringify(window.board.getElements().find(el => el.id === 'arrow').points));
        const bendBox = await bend.boundingBox();
        await page.mouse.move(bendBox.x + bendBox.width / 2, bendBox.y + bendBox.height / 2);
        await page.mouse.down(); await page.mouse.move(bendBox.x + bendBox.width / 2, bendBox.y + bendBox.height / 2 + 10); await page.mouse.up();
        assert.notEqual(await page.evaluate(() => JSON.stringify(window.board.getElements().find(el => el.id === 'arrow').points)), before, 'docked or inline bend remains draggable');
      });

      await run('timer', async () => {
        await ready('&toolbar=right&position=right');
        await page.evaluate(() => window.board.focusElements(['label']));
        await board.focus(); await page.keyboard.press('Control+k');
        await page.getByRole('textbox', { name: 'Search commands' }).fill('Collaboration:');
        await page.keyboard.press('Enter');
        await page.getByLabel('Minutes', { exact: true }).fill('1');
        await page.getByRole('button', { name: 'Set timer', exact: true }).click();
        await page.getByRole('button', { name: 'Start timer', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
        const timer = page.getByRole('timer');
        await expect(timer).toBeVisible(); await frame();
        report.push({ width, height, name: 'workshop timer', ...await inspect(timer) });
        const overlaps = await timer.evaluate(el => {
          const box = el.getBoundingClientRect();
          return [...document.querySelectorAll('[data-noteboard-toolbar],[data-noteboard-shapes],[aria-label="Object properties"],[aria-label="Zoom in"],[title="Settings"]')].filter(control => {
            const other = control.getBoundingClientRect();
            return Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 && Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1;
          }).map(control => control.getAttribute('aria-label') || control.title || 'toolbar');
        });
        assert.deepEqual(overlaps, [], 'timer avoids floating controls');
        await capture('timer');
        await board.focus(); await page.keyboard.press('Control+Shift+Backquote'); await frame();
        const help = page.getByRole('region', { name: 'Keyboard Canvas help', exact: true });
        report.push({ width, height, name: 'keyboard help beside active timer', ...await inspect(help) });
        const timerBox = await timer.boundingBox(), helpBox = await help.boundingBox();
        assert.ok(Math.min(timerBox.x + timerBox.width, helpBox.x + helpBox.width) - Math.max(timerBox.x, helpBox.x) <= 1 || Math.min(timerBox.y + timerBox.height, helpBox.y + helpBox.height) - Math.max(timerBox.y, helpBox.y) <= 1, 'timer and keyboard help remain separate');
        await capture('timer-help');
        await board.focus(); await page.keyboard.press('3'); await frame();
        report.push({ width, height, name: 'timer beside drawing controls', ...await inspect(timer) });
        report.push({ width, height, name: 'keyboard help beside timer and shapes', ...await inspect(help) });
        for (const locator of [page.locator('[data-noteboard-toolbar]'), page.locator('[data-noteboard-shapes]')]) {
          const stripBox = await locator.boundingBox(), currentTimer = await timer.boundingBox(), currentHelp = await help.boundingBox();
          for (const overlay of [currentTimer, currentHelp]) assert.ok(Math.min(stripBox.x + stripBox.width, overlay.x + overlay.width) - Math.max(stripBox.x, overlay.x) <= 1 || Math.min(stripBox.y + stripBox.height, overlay.y + overlay.height) - Math.max(stripBox.y, overlay.y) <= 1, 'active timer and help avoid drawing strips');
        }
        await capture('timer-shapes-help');
      });
      await page.close();
    }
  } finally {
    fs.writeFileSync(`${imageRoot}/overlay-responsive.json`, JSON.stringify(report, null, 2));
    await browser.close();
    const failures = report.filter(row => row.error || row.bounded === false || row.hit === false || row.passed === false || row.clippedBy?.length);
    console.log(JSON.stringify(failures, null, 2));
    assert.deepEqual(failures, [], 'all overlay controls stay visible and reachable');
    console.log(`${report.length} mobile overlay checks passed`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
