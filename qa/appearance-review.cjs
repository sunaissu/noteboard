const { chromium, webkit, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = process.env.BOARD_BROWSER || 'chromium';

(async () => {
  const browser = await { chromium, webkit }[engine].launch({
    headless: true,
    ...(engine === 'chromium' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 850 }, reducedMotion: 'reduce', colorScheme: 'light' });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5175');
    const board = page.getByLabel('Noteboard canvas', { exact: true });
    const controls = page.getByRole('complementary', { name: 'Playground controls' });
    const appearance = controls.getByLabel('Appearance', { exact: true });
    await expect(board).toHaveAttribute('data-noteboard-scrollbar', 'native');
    const documentStyle = await page.evaluate(() => ({ width: getComputedStyle(document.documentElement).scrollbarWidth, color: getComputedStyle(document.documentElement).scrollbarColor }));
    for (const theme of ['dark', 'light']) {
      await controls.getByRole('button', { name: theme, exact: true }).click();
      await expect(board).toHaveAttribute('data-theme', theme);
    }
    await controls.getByRole('button', { name: 'system', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(board).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(board).toHaveAttribute('data-theme', 'light');
    for (const [scheme, primary, secondary] of [
      ['ocean', '#2563eb', '#06b6d4'], ['forest', '#15803d', '#ca8a04'], ['plum', '#9333ea', '#db2777'],
    ]) {
      await controls.getByLabel('Color scheme', { exact: true }).selectOption(scheme);
      await expect(controls.getByLabel('Primary', { exact: true })).toHaveValue(primary);
      await expect(controls.getByLabel('Secondary', { exact: true })).toHaveValue(secondary);
    }
    await controls.getByLabel('Primary', { exact: true }).fill('#123456');
    await expect(controls.getByLabel('Color scheme', { exact: true })).toHaveValue('custom');
    await expect(board.locator('[data-noteboard-toolbar] button[aria-pressed=true]').first()).toHaveCSS('color', 'rgb(18, 52, 86)');

    await appearance.selectOption('custom');
    await controls.getByLabel('Thumb color', { exact: true }).fill('#e11d48');
    await controls.getByLabel('Transparent track', { exact: true }).uncheck();
    await controls.getByLabel('Track color', { exact: true }).fill('#172554');
    await controls.getByLabel('Thin scrollbar', { exact: true }).check();
    await board.getByRole('button', { name: 'Settings', exact: true }).click();
    const checkScrollbar = async (transparent = false) => {
      const state = await page.evaluate(() => {
        const inspector = document.querySelector('.inspector');
        const panel = [...document.querySelectorAll('.noteboard-settings-panel div')].find(el => getComputedStyle(el).overflowY === 'auto');
        const inspect = el => {
          const s = getComputedStyle(el);
          return { width: s.scrollbarWidth, color: s.scrollbarColor, thumb: getComputedStyle(el, '::-webkit-scrollbar-thumb').backgroundColor, track: getComputedStyle(el, '::-webkit-scrollbar-track').backgroundColor, size: getComputedStyle(el, '::-webkit-scrollbar').width };
        };
        return { modern: CSS.supports('scrollbar-color', 'red blue'), inspector: inspect(inspector), panel: inspect(panel) };
      });
      for (const style of [state.inspector, state.panel]) {
        if (state.modern) {
          assert.equal(style.width, 'thin');
          assert.equal(style.color, transparent ? 'rgb(225, 29, 72) rgba(0, 0, 0, 0)' : 'rgb(225, 29, 72) rgb(23, 37, 84)');
        } else {
          assert.equal(style.width, 'auto');
          assert.equal(style.thumb, 'rgb(225, 29, 72)');
          assert.equal(style.track, transparent ? 'rgba(0, 0, 0, 0)' : 'rgb(23, 37, 84)');
          assert.equal(style.size, '8px');
        }
      }
    };
    await checkScrollbar();
    await controls.getByLabel('Transparent track', { exact: true }).check();
    await checkScrollbar(true);
    const closeSettings = board.getByRole('button', { name: 'Close settings', exact: true });
    if (await closeSettings.isVisible()) await closeSettings.click();
    await appearance.selectOption('hidden');
    await expect(controls).toHaveCSS('scrollbar-width', 'none');
    await controls.evaluate(el => { el.scrollTop = 0; el.focus(); });
    await page.keyboard.press('PageDown');
    await expect.poll(() => controls.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await appearance.selectOption('native');
    await expect(controls).toHaveCSS('scrollbar-width', 'auto');
    if (await page.evaluate(() => CSS.supports('scrollbar-color', 'red blue'))) await expect(controls).toHaveCSS('scrollbar-color', 'auto');
    assert.deepEqual(await page.evaluate(() => ({ width: getComputedStyle(document.documentElement).scrollbarWidth, color: getComputedStyle(document.documentElement).scrollbarColor })), documentStyle);
    await appearance.selectOption('custom');
    await controls.evaluate(el => { el.scrollTop = 0; });
    fs.mkdirSync('qa/artifacts', { recursive: true });
    await page.screenshot({ path: 'qa/artifacts/appearance-' + engine + '-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await appearance.selectOption('custom');
    await controls.getByLabel('Color scheme', { exact: true }).selectOption('forest');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: 'qa/artifacts/appearance-' + engine + '-mobile.png', fullPage: true });
    await appearance.selectOption('hidden');
    const playground = page.getByRole('region', { name: 'Noteboard playground', exact: true });
    await expect(playground).toHaveCSS('scrollbar-width', 'none');
    await playground.evaluate(el => { el.scrollTop = 0; el.focus(); });
    await page.keyboard.press('PageDown');
    await expect.poll(() => playground.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    assert.deepEqual(errors, []);
    console.log(engine + ': themes, schemes, custom colors, transparent/hidden/native scrollbars, nested panels, host scrollers, keyboard scrolling and mobile layout passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
