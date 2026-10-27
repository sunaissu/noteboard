const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createElement, serializeBoard } = require('../dist/index.js');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  });
  try {
    const stale = serializeBoard(
      [createElement('rectangle', { id: 'previous-browser-board', width: 100, height: 80 })],
      { panX: 200, panY: 300, zoom: 2 },
      { boardId: 'playground', threadId: 'local' },
    );
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(snapshot => {
        const key = 'noteboard:draft:local-playground-v1';
        localStorage.setItem(key, JSON.stringify(snapshot));
        window.boardStorageCalls = [];
        for (const method of ['getItem', 'setItem', 'removeItem']) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (storageKey, ...args) {
            if (String(storageKey).startsWith('noteboard:draft:')) {
              window.boardStorageCalls.push({ method, key: storageKey });
            }
            return original.call(this, storageKey, ...args);
          };
        }
      }, stale);
      await page.goto('http://127.0.0.1:5175');
      const controls = page.getByRole('complementary', { name: 'Playground controls' });
      const count = controls.locator('.metrics strong').first();
      const exportSession = async () => {
        const waiting = page.waitForEvent('download');
        await controls.getByRole('button', { name: 'Export JSON', exact: true }).click();
        const file = await waiting;
        return JSON.parse(await fs.readFile(await file.path(), 'utf8'));
      };
      await expect(count).toHaveText('5');
      await expect(page.getByRole('region', { name: 'Board recovery' })).toHaveCount(0);
      assert.ok((await exportSession()).elements.every(element => element.id !== 'previous-browser-board'));

      await controls.getByLabel('Board template').selectOption('planning');
      await controls.getByRole('button', { name: 'Insert template', exact: true }).click();
      await expect(count).toHaveText('11');
      assert.equal((await exportSession()).elements.length, 11, 'host state receives local edits');
      await page.waitForTimeout(750); // Exceed the removed 600 ms autosave delay.
      assert.deepEqual(await page.evaluate(() => window.boardStorageCalls), []);

      await controls.locator('input[type=file]').setInputFiles({
        name: 'host-selected-board.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(stale)),
      });
      await page.getByRole('button', { name: 'Replace board', exact: true }).click();
      await expect(count).toHaveText('1');
      const restored = await exportSession();
      assert.deepEqual(restored.elements.map(element => element.id), ['previous-browser-board']);
      assert.deepEqual(restored.viewport, stale.viewport, 'explicit host restore retains its viewport');
      await page.reload();
      await expect(count).toHaveText('5');
      await expect(page.getByRole('region', { name: 'Board recovery' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry draft save', exact: true })).toHaveCount(0);
      assert.deepEqual(await page.evaluate(() => window.boardStorageCalls), []);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Legacy board drafts ignored; no snapshot storage reads/writes; host edits, explicit restore/export and reload passed on desktop and mobile');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
