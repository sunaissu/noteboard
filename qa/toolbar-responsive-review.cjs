const { chromium, firefox, webkit, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const engine = process.env.BOARD_BROWSER || 'chromium';
const base = process.env.BOARD_REVIEW_URL || 'http://127.0.0.1:5180';
const playground = process.env.BOARD_PLAYGROUND_URL || 'http://127.0.0.1:5175';
const quick = process.argv.includes('--quick');
const featuresOnly = process.argv.includes('--features-only');
const crossOnly = process.argv.includes('--cross-only');
const floatingOnly = process.argv.includes('--floating-only');
const sizes = quick ? [[390, 844], [568, 320], [1440, 900]] : [
  [320, 568], [390, 844], [568, 320], [844, 390],
  [768, 1024], [1024, 768], [900, 1440], [1440, 900],
];
const positions = ['top', 'bottom', 'left', 'right'];
const report = [], errors = [];
let outcome = { status: 'running' };
fs.mkdirSync('qa/artifacts', { recursive: true });

// Use actual clipping and hit testing: a positive DOM bounding box alone does
// not catch controls hidden by a scroll container or a higher floating panel.
async function reachable(locator, label) {
  await expect(locator, label).toBeVisible();
  await expect.poll(() => locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!(r.width > 0 && r.height > 0 && hit && (el === hit || el.contains(hit)))) return false;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), p = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (r.left < p.left - 1 || r.right > p.right + 1)) return false;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (r.top < p.top - 1 || r.bottom > p.bottom + 1)) return false;
    }
    return true;
  }), { message: label + ' is fully reachable', timeout: 3000 }).toBe(true);
}

async function inspectGeometry(page, label) {
  // Layout reservations are measured by ResizeObserver after a selection or
  // viewport change. Let the browser deliver that measurement before sampling.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const measure = () => page.evaluate(() => {
    const board = document.querySelector('.noteboard-canvas'), bounds = board.getBoundingClientRect();
    const nodes = [
      ['toolbar', board.querySelector('[data-noteboard-toolbar]')],
      ['shapes', board.querySelector('[data-noteboard-shapes]')],
      ['properties', board.querySelector('[aria-label="Object properties"]')],
      ['settings', board.querySelector('[title="Settings"]')],
      ['zoom', board.querySelector('[title="Reset zoom to 100%"]')?.parentElement],
      ['presentation', board.querySelector('[aria-label="Presentation controls"]')],
      ['timer', board.querySelector('[role="timer"]')],
    ].filter(([, el]) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const panels = nodes.map(([name, el]) => ({ name, ...rect(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    const overlaps = panels.flatMap((a, index) => panels.slice(index + 1).filter(b =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
    ).map(b => a.name + '/' + b.name));
    const smallButtons = nodes.filter(([name]) => name === 'toolbar' || name === 'shapes').flatMap(([name, el]) =>
      [...el.querySelectorAll('button')].filter(button => button.getBoundingClientRect().width < 43.5 || button.getBoundingClientRect().height < 43.5)
        .map(button => ({ panel: name, name: button.getAttribute('aria-label'), ...rect(button) })));
    return { bounds: rect(board), panels, overlaps, smallButtons, documentOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  const settled = data => !data.overlaps.length && data.panels.every(panel => panel.left >= data.bounds.left - 1 && panel.right <= data.bounds.right + 1 && panel.top >= data.bounds.top - 1 && panel.bottom <= data.bounds.bottom + 1);
  let data = await measure();
  if (!settled(data)) {
    // WebKit can deliver the ResizeObserver update after a second animation
    // frame. Keep a bounded retry and assert the final geometry below so real
    // overlap failures retain their useful panel names and measurements.
    await expect.poll(async () => { data = await measure(); return settled(data); }, { timeout: 2000, intervals: [50, 100, 200] }).toBe(true).catch(() => {});
  }
  report.push({ label, ...data });
  for (const panel of data.panels) {
    assert.ok(panel.left >= data.bounds.left - 1 && panel.right <= data.bounds.right + 1 && panel.top >= data.bounds.top - 1 && panel.bottom <= data.bounds.bottom + 1, `${label}: ${panel.name} within board: ${JSON.stringify(panel)}`);
  }
  assert.deepEqual(data.overlaps, [], `${label}: floating controls overlap`);
  assert.deepEqual(data.smallButtons, [], `${label}: drawing controls keep 44px targets`);
  assert.equal(data.documentOverflow, false, `${label}: page must not overflow sideways`);
}

async function scrollEnds(page, locator, vertical, label) {
  const buttons = locator.locator('button'), first = buttons.first(), last = buttons.last();
  const before = await page.evaluate(() => ({ page: [scrollX, scrollY], board: window.board?.getViewport() }));
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Wheel events also check that the floating strips do not pan the canvas.
  const scrollsVertically = vertical || await locator.evaluate(el => el.scrollHeight > el.clientHeight + 1);
  await page.mouse.wheel(scrollsVertically ? 0 : -2000, scrollsVertically ? -2000 : 0);
  await reachable(first, label + ' first control');
  await page.mouse.wheel(scrollsVertically ? 0 : 2000, scrollsVertically ? 2000 : 0);
  await reachable(last, label + ' last control');
  await page.mouse.wheel(scrollsVertically ? 0 : -2000, scrollsVertically ? -2000 : 0);
  await reachable(first, label + ' return to first control');
  assert.deepEqual(await page.evaluate(() => ({ page: [scrollX, scrollY], board: window.board?.getViewport() })), before, label + ': wheel scrolling stays inside toolbar');
}

async function settingsAndLibrary(page, label) {
  const board = page.getByLabel('Noteboard canvas', { exact: true });
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await settings.tap(); else await settings.click();
  const panel = page.getByRole('region', { name: 'Board settings', exact: true });
  await expect(panel).toBeVisible();
  await reachable(panel.getByRole('button', { name: 'Close settings', exact: true }), label + ' close settings');
  const grid = panel.getByRole('switch', { name: 'Show grid', exact: true });
  await grid.focus();
  await reachable(grid, label + ' grid toggle');
  const checked = await grid.getAttribute('aria-checked');
  if (touch) await grid.tap(); else await grid.click();
  await expect(grid).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
  const last = panel.getByTitle('Clear all elements', { exact: true });
  await last.focus();
  await reachable(last, label + ' last settings control');
  await reachable(panel.getByRole('button', { name: 'Close settings', exact: true }), label + ' persistent settings close');
  assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, label + ' settings width');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(settings).toBeFocused();

  await page.evaluate(() => window.board.focusElements(['label']));
  await board.focus();
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search commands').fill('Board workspace:');
  await page.keyboard.press('Enter');
  const section = page.getByLabel('Workspace section');
  if (await section.isVisible()) await section.selectOption('Library');
  else await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByLabel('Workspace item name').fill('Responsive library item');
  await page.getByRole('button', { name: 'Save selection to library', exact: true }).click();
  const preview = page.getByRole('button', { name: 'Preview insertion', exact: true });
  await preview.focus();
  await reachable(preview, label + ' library preview action');
  const previewCanvas = page.getByRole('dialog').locator('canvas').first();
  assert.ok(await previewCanvas.evaluate(el => el.getBoundingClientRect().height <= el.parentElement.getBoundingClientRect().height + 1), label + ' library thumbnail fits its reserved height');
  await preview.click();
  const apply = page.getByRole('button', { name: 'Apply preview', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel preview', exact: true });
  await reachable(apply, label + ' apply library preview');
  await reachable(cancel, label + ' cancel library preview');
  await cancel.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(board).toBeFocused();
}

async function exercise(page, label, position, takeScreenshot) {
  const toolbar = page.locator('[data-noteboard-toolbar]');
  const properties = page.getByRole('region', { name: 'Object properties' });
  await expect(toolbar).toBeVisible();
  await inspectGeometry(page, label + ' expanded');
  await scrollEnds(page, toolbar, position === 'left' || position === 'right', label + ' toolbar');
  await properties.getByTitle('Collapse panel', { exact: true }).click();
  await inspectGeometry(page, label + ' collapsed');
  await reachable(properties.getByTitle('Expand panel', { exact: true }), label + ' expand properties');
  await properties.getByTitle('Expand panel', { exact: true }).click();
  const rectangle = toolbar.getByRole('button', { name: 'Rectangle', exact: true });
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await rectangle.tap(); else await rectangle.click();
  const picker = page.locator('[data-noteboard-shapes]');
  await expect(picker).toBeVisible();
  // ResizeObserver changes reserve space after opening the picker.
  await expect.poll(() => picker.evaluate(el => el.offsetWidth), { timeout: 3000 }).toBeGreaterThan(0);
  await inspectGeometry(page, label + ' shapes expanded');
  await scrollEnds(page, picker, position === 'left' || position === 'right', label + ' shapes');
  if (takeScreenshot) await page.screenshot({ path: `qa/artifacts/toolbar-${engine}-${label.replaceAll(' ', '-')}.png`, animations: 'disabled' });
  await properties.getByTitle('Collapse panel', { exact: true }).click();
  await inspectGeometry(page, label + ' shapes collapsed');
  await scrollEnds(page, toolbar, position === 'left' || position === 'right', label + ' toolbar with shapes');
}

(async () => {
  const browser = await { chromium, firefox, webkit }[engine].launch({ headless: true, ...(engine === 'chromium' ? { executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
  let activePage;
  try {
    for (const theme of crossOnly || floatingOnly ? [] : ['light', 'dark']) for (const [width, height] of sizes) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1100, colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: 'reduce' });
      const page = await context.newPage();
      activePage = page;
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(5000);
      for (const position of featuresOnly ? [] : positions) {
        // Same-edge requests exercise the component's resolved opposite edge;
        // left/right mobile properties then become a top horizontal panel.
        const label = `${theme}-${width}x${height}-${position}`;
        await page.goto(`${base}/?local=1&workspace=1&toolbar=${position}&position=${position}&theme=${theme}`);
        await page.waitForFunction(() => window.board);
        await page.evaluate(() => window.board.focusElements(['label']));
        await exercise(page, label, position, [390, 568, 768, 1024, 1440].includes(width) && (position === 'left' || position === 'right'));
      }
      await page.goto(`${base}/?local=1&workspace=1&theme=${theme}`);
      await page.waitForFunction(() => window.board);
      await settingsAndLibrary(page, `${theme}-${width}x${height}`);
      await context.close();
      console.log(`${engine} ${theme} ${width}x${height}: ${featuresOnly ? '' : 'all four edges, '}settings and library passed`);
    }

    if (!featuresOnly && !floatingOnly && !quick) {
      for (const [width, height] of engine === 'chromium' || crossOnly ? [[390, 844], [568, 320], [1024, 768]] : []) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage(); activePage = page;
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(5000);
        for (const toolbarPosition of positions) for (const propertiesPosition of positions) {
          const label = `cross-${width}x${height}-${toolbarPosition}-${propertiesPosition}`;
          await page.goto(`${base}/?local=1&toolbar=${toolbarPosition}&position=${propertiesPosition}&theme=light`);
          await page.waitForFunction(() => window.board);
          await page.evaluate(() => window.board.focusElements(['label']));
          await exercise(page, label, toolbarPosition, toolbarPosition === 'right' && propertiesPosition === 'bottom');
        }
        await context.close();
        console.log(`${engine} ${width}x${height}: all 16 independent toolbar/properties combinations passed`);
      }

      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' }); activePage = page;
      await page.goto(`${base}/?local=1&toolbar=left&position=top&theme=dark`);
      await page.waitForFunction(() => window.board);
      await page.locator('[data-noteboard-toolbar]').getByRole('button', { name: 'Rectangle', exact: true }).click();
      const properties = page.getByRole('region', { name: 'Object properties' });
      await properties.getByTitle('Collapse panel', { exact: true }).click();
      for (const [width, height] of [[390, 844], [844, 390], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await expect(properties.getByTitle('Expand panel', { exact: true })).toBeVisible();
        await expect(page.locator('[data-noteboard-shapes]').getByRole('button', { name: 'Rectangle', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await inspectGeometry(page, `rotation-${width}x${height}-collapsed`);
        await properties.getByTitle('Expand panel', { exact: true }).click();
        await inspectGeometry(page, `rotation-${width}x${height}-expanded`);
        await page.screenshot({ path: `qa/artifacts/toolbar-rotation-${engine}-${width}x${height}.png`, animations: 'disabled' });
        await properties.getByTitle('Collapse panel', { exact: true }).click();
      }
      await page.close();
      console.log(`${engine}: portrait/landscape/portrait preserves active shape and collapsed state`);
    }

    if (!featuresOnly && !crossOnly && !quick) {
      for (const theme of ['light', 'dark']) for (const [width, height] of [[320, 568], [390, 844], [568, 320], [1024, 768]]) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
        const page = await context.newPage(); activePage = page;
        page.on('pageerror', error => errors.push(error.message));
        for (const position of positions) {
          const label = `floating-${theme}-${width}x${height}-${position}`;
          await page.goto(`${base}/?local=1&workspace=1&toolbar=${position}&position=${position}&theme=${theme}`);
          await page.waitForFunction(() => window.board);
          await page.getByLabel('Noteboard canvas', { exact: true }).focus();
          await page.keyboard.press('Control+k');
          await page.getByLabel('Search commands').fill('Board workspace:');
          await page.keyboard.press('Enter');
          await page.getByLabel('Workspace item name').fill('Presentation viewport with a long descriptive name');
          await page.getByRole('button', { name: 'Save viewpoint', exact: true }).click();
          await page.getByRole('button', { name: 'Start presentation', exact: true }).click();
          await inspectGeometry(page, label + ' presentation');
          await scrollEnds(page, page.getByRole('group', { name: 'Presentation controls' }), false, label + ' presentation');
          const end = page.getByRole('button', { name: 'End presentation', exact: true });
          await end.focus();
          await reachable(end, label + ' end presentation');
          if (position === 'top') await page.screenshot({ path: `qa/artifacts/presentation-final-${engine}-${theme}-${width}x${height}.png`, animations: 'disabled' });
          await end.tap();
          await page.evaluate(async () => {
            const workshop = window.workspaceFixture.session.workshop;
            await workshop.dispatch({ type: 'timer', operation: 'reset', durationMs: 60000 }, workshop.getSnapshot().revision);
            await workshop.dispatch({ type: 'timer', operation: 'start' }, workshop.getSnapshot().revision);
          });
          await expect(page.getByRole('timer')).toBeVisible();
          await inspectGeometry(page, label + ' timer');
          await reachable(page.getByRole('timer'), label + ' visible timer');
          if (position === 'right') await page.screenshot({ path: `qa/artifacts/timer-final-${engine}-${theme}-${width}x${height}.png`, animations: 'disabled' });
          if (height === 320) {
            await page.getByLabel('Noteboard canvas', { exact: true }).focus();
            await page.keyboard.press('Control+k');
            await page.getByLabel('Search commands').fill('Board workspace:');
            await page.keyboard.press('Enter');
            await page.getByRole('button', { name: 'Start presentation', exact: true }).click();
            await inspectGeometry(page, label + ' presentation with timer');
            await scrollEnds(page, page.getByRole('group', { name: 'Presentation controls' }), false, label + ' presentation with timer');
            await end.focus();
            await reachable(end, label + ' end presentation with timer');
            await reachable(page.getByRole('timer'), label + ' timer during presentation');
            await page.screenshot({ path: `qa/artifacts/floating-combined-${engine}-${theme}-${position}.png`, animations: 'disabled' });
            await end.tap();
          }
        }
        await context.close();
        console.log(`${engine} ${theme} ${width}x${height}: presentation and timer coexist with all four toolbar edges`);
      }
    }

    // Use the actual demo's controls, rather than only query-param fixtures.
    if (featuresOnly || floatingOnly) { assert.deepEqual(errors, [], 'No uncaught page errors'); outcome = { status: 'passed' }; return; }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    activePage = page;
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(playground);
    const controls = page.getByRole('complementary', { name: 'Playground controls' });
    for (const position of ['left', 'right']) {
      await controls.getByRole('group', { name: 'Toolbar position', exact: true }).getByRole('button', { name: position, exact: true }).click();
      await controls.getByRole('group', { name: 'Properties position', exact: true }).getByRole('button', { name: 'top', exact: true }).click();
      const toolbar = page.locator('[data-noteboard-toolbar]');
      await toolbar.getByRole('button', { name: 'Rectangle', exact: true }).scrollIntoViewIfNeeded();
      await toolbar.getByRole('button', { name: 'Rectangle', exact: true }).click();
      await toolbar.scrollIntoViewIfNeeded();
      await inspectGeometry(page, `playground-390x844-${position}`);
      await reachable(toolbar.getByRole('button', { name: 'Rectangle', exact: true }), `playground ${position} Rectangle`);
      await page.screenshot({ path: `qa/artifacts/toolbar-playground-${position}.png`, animations: 'disabled' });
    }
    assert.deepEqual(errors, [], 'No uncaught page errors');
    outcome = { status: 'passed' };
    console.log(`${report.length} toolbar/layout states passed; actual playground side controls passed`);
  } catch (error) {
    outcome = { status: 'failed', message: error.message };
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `qa/artifacts/toolbar-failure-${engine}.png`, animations: 'disabled' });
    throw error;
  } finally {
    const suffix = crossOnly ? '-cross' : featuresOnly ? '-features' : floatingOnly ? '-floating' : quick ? '-quick' : '';
    fs.writeFileSync(`qa/artifacts/toolbar-responsive-${engine}${suffix}.json`, JSON.stringify({ engine, ...outcome, results: report, errors }, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
