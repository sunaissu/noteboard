const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
// Budgets cover a developer build on the recorded machine, not every device.
const budgets = {
  1000: { loadMs: 1500, panMs: 350, selectMs: 350, exportMs: 5000 },
  10000: { loadMs: 6000, panMs: 1800, selectMs: 1800, exportMs: 15000 },
  strokeResizeMs: 500,
  heapBytes: 400 * 1024 * 1024,
};
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.goto("http://127.0.0.1:5180/?local=1");
    await page.waitForFunction(() => window.board);
    const results = [];
    for (const count of [1000, 10000]) {
      const result = await page.evaluate(async (count) => {
        const a = window.boardApi,
          b = window.board,
          frame = () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          items = Array.from({ length: count }, (_, i) =>
            a.createElement("rectangle", {
              id: "perf-" + i,
              x: (i % 100) * 50,
              y: Math.floor(i / 100) * 40,
              width: 35,
              height: 25,
              roughness: 0,
            }),
          );
        let start = performance.now();
        b.setElements(items);
        await frame();
        const loadMs = performance.now() - start;
        start = performance.now();
        b.setViewport({ panX: -100, panY: -100, zoom: 1 });
        await frame();
        const panMs = performance.now() - start;
        start = performance.now();
        b.focusElements(["perf-50"]);
        await frame();
        const selectMs = performance.now() - start;
        start = performance.now();
        await a.exportBoardImage(items, "png", { scale: 0.2 });
        const exportMs = performance.now() - start;
        return {
          count,
          loadMs,
          panMs,
          selectMs,
          exportMs,
          heap: performance.memory?.usedJSHeapSize ?? null,
        };
      }, count);
      results.push(result);
      for (const key of ["loadMs", "panMs", "selectMs", "exportMs"])
        assert.ok(
          result[key] < budgets[count][key],
          `${count} ${key} ${result[key]} exceeds ${budgets[count][key]}`,
        );
      if (result.heap) assert.ok(result.heap < budgets.heapBytes);
    }
    const strokeResizeMs = await page.evaluate(() => {
      const a = window.boardApi,
        pen = a.createElement("pen", {
          x: 0,
          y: 0,
          width: 1000,
          height: 200,
          points: Array.from({ length: 100000 }, (_, i) => ({
            x: i / 100,
            y: Math.sin(i) * 100,
            pressure: 0.5,
          })),
        });
      const start = performance.now();
      const resized = a.resizeElement(pen, 2, 2);
      if (
        resized.points.length !== 100000 ||
        resized.points[99999].pressure !== 0.5
      )
        throw new Error("Stroke data lost");
      return performance.now() - start;
    });
    assert.ok(strokeResizeMs < budgets.strokeResizeMs);
    const report = {
      at: new Date().toISOString(),
      browser: browser.version(),
      platform: os.platform(),
      cpu: os.cpus()[0].model,
      memoryGiB: os.totalmem() / 1024 ** 3,
      budgets,
      results,
      strokeResizeMs,
    };
    await fs.writeFile(
      "qa/artifacts/performance-review.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
