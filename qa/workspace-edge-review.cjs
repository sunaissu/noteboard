const { chromium, firefox, webkit, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const engine = process.env.BOARD_BROWSER || "chromium";
(async () => {
  const browser = await { chromium, firefox, webkit }[engine].launch({
    headless: true,
    ...(engine === "chromium"
      ? {
          executablePath:
            "C:/Program Files/Google/Chrome/Application/chrome.exe",
        }
      : {}),
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5180/?local=1&workspace=1");
    await page.waitForFunction(() => window.board);
    const board = page.getByLabel("Noteboard canvas", { exact: true }),
      dialog = page.getByRole("dialog");
    const command = async (query) => {
      await board.focus();
      await page.keyboard.press("Control+k");
      await page.getByLabel("Search commands").fill(query);
      await page.keyboard.press("Enter");
    };
    const open = async (tab) => {
      await command("Board workspace:");
      await page.getByRole("tab", { name: tab, exact: true }).click();
    };
    const close = () =>
      dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.evaluate(() => window.board.focusElements(["label"]));
    await open("Styles");
    await page.getByLabel("Workspace item name").fill("Team style");
    await page.getByRole("button", { name: "Save selected style" }).click();
    await page.getByRole("button", { name: "Team style", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Style applied");
    await close();
    await open("Versions");
    await page.getByLabel("Revision name").fill("Before revision");
    await page
      .getByRole("button", { name: "Save revision", exact: true })
      .click();
    await page.getByRole("button", { name: /Before revision ·/ }).click();
    await page.evaluate(() =>
      window.board.setElements([
        ...window.board.getElements(),
        window.boardApi.createElement("rectangle", {
          id: "later",
          width: 100,
          height: 100,
        }),
      ]),
    );
    await page.getByRole("button", { name: "Apply preview" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Board changed");
    await page.getByRole("button", { name: /Before revision ·/ }).click();
    await page.getByRole("button", { name: "Apply preview" }).click();
    assert.equal(
      await page.evaluate(() =>
        window.board.getElements().some((el) => el.id === "later"),
      ),
      false,
    );
    await close();
    await board.focus();
    await page.keyboard.press("Control+z");
    assert.equal(
      await page.evaluate(() =>
        window.board.getElements().some((el) => el.id === "later"),
      ),
      true,
    );
    console.log(
      "Style presets, revision comparisons, stale restore blocking and undo passed",
    );
    await open("Objects");
    await page.getByText("Linked content and media", { exact: true }).click();
    await page.getByLabel("Document reference").fill("doc");
    await page.getByRole("button", { name: "Insert document card" }).click();
    let docId = await page.evaluate(
      () => window.board.getElements().find((e) => e.documentCard).id,
    );
    await close();
    await page.evaluate((id) => window.board.focusElements([id]), docId);
    await open("Objects");
    await page.getByText("Linked content and media", { exact: true }).click();
    await page.evaluate(() => {
      window.denyDocument = true;
    });
    await page.getByRole("button", { name: "Refresh document" }).click();
    assert.equal(
      await page.evaluate(
        (id) => window.board.getElements().find((e) => e.id === id).text,
        docId,
      ),
      "Document unavailable",
    );
    await close();await board.focus();await page.keyboard.press('Control+z');assert.equal(await page.evaluate(id=>window.board.getElements().find(e=>e.id===id).text,docId),'Document unavailable');await open('Objects');await page.getByText('Linked content and media',{exact:true}).click();
    await page.getByLabel("Calculation expression").fill("6*7");
    await page.getByRole("button", { name: "Insert calculation" }).click();
    assert.equal(
      await page.evaluate(
        () =>
          window.board.getElements().find((e) => e.calculation).calculation
            .result,
      ),
      "42",
    );
    const before = await page.evaluate(() => window.board.getElements().length);
    await page.getByRole("button", { name: "Choose existing media" }).click();
    await page.waitForFunction(() => window.finishMedia);
    await page.evaluate(() => window.workspaceFixture.setReadOnly(true));
    await expect(
      page.getByRole("button", { name: "Insert calculation" }),
    ).toBeDisabled();
    await expect(page.getByText("View only",{exact:true})).toBeVisible();
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 4;
      window.finishMedia({
        id: "late",
        name: "Late",
        width: 4,
        height: 4,
        dataUrl: canvas.toDataURL(),
      });
    });
    await expect(dialog.getByRole("alert")).toContainText("read-only");
    assert.equal(
      await page.evaluate(() => window.board.getElements().length),
      before,
    );
    await close();
    await page.evaluate(() => window.workspaceFixture.setReadOnly(false));
    await expect(page.getByRole("button",{name:"Select",exact:true})).toBeVisible();
    console.log(
      "Document permission revocation, calculation insertion and late media permission guard passed",
    );
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 100;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 50, 100);
      ctx.fillStyle = "blue";
      ctx.fillRect(50, 0, 50, 100);
      window.board.setElements([
        window.boardApi.createElement("image", {
          id: "crop",
          x: 400,
          y: 300,
          width: 100,
          height: 100,
          angle: 0.3,
          dataUrl: c.toDataURL(),
        }),
      ]);
      window.board.focusElements(["crop"]);
    });
    await open("Objects");
    await page.getByLabel("Crop x", { exact: true }).fill("0.5");
    await page.getByLabel("Crop width", { exact: true }).fill("0.5");
    await page.getByLabel("Image mask").selectOption("ellipse");
    await page.getByRole("button", { name: "Apply crop" }).click();
    assert.equal(
      await page.evaluate(() => window.board.getElements()[0].crop.x),
      0.5,
    );
    const svg = await page.evaluate(() =>
      window.boardApi.exportBoardSvg(window.board.getElements()),
    );
    assert.ok(svg.includes("clipPath"));
    assert.ok(svg.includes("<image"));
    await page.getByRole("button", { name: "Reset crop" }).click();
    assert.equal(
      await page.evaluate(() => window.board.getElements()[0].crop),
      undefined,
    );
    await close();
    await page.evaluate(() => {
      window.board.setElements([
        window.boardApi.createElement("rectangle", {
          id: "text-shape",
          x: 400,
          y: 250,
          width: 180,
          height: 200,
          angle: 0.4,
          text: "A long first line wraps inside the shape\nSecond paragraph",
          fontSize: 24,
        }),
      ]);
      window.board.focusElements(["text-shape"]);
    });
    await board.focus();
    await page.keyboard.press("Control+Shift+Backquote");
    await page.keyboard.press("Enter");
    const editor = page.getByRole("textbox", { name: "Edit object text" });
    await expect(editor).toBeVisible();
    const geometry = await editor.evaluate((el) => ({
      whiteSpace: getComputedStyle(el).whiteSpace,
      transform: getComputedStyle(el).transform,
      width: el.clientWidth,
    }));
    assert.equal(geometry.whiteSpace, "pre-wrap");
    assert.ok(geometry.transform.startsWith("matrix("));
    assert.ok(geometry.width > 100);
    await page.screenshot({ path: `qa/artifacts/text-overlay-${engine}.png` });
    await page.keyboard.press("Control+Enter");
    console.log(
      "Rotated crop/mask SVG export and multiline rotated editor geometry passed",
    );
    if (engine === "chromium") {
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await command("Copy selection to system clipboard");
      await page.waitForTimeout(100);
      await command("Paste board objects from system clipboard");
      await expect
        .poll(() => page.evaluate(() => window.board.getElements().length))
        .toBe(2);
    }
    await command("Collaboration:");
    await page.evaluate(()=>{const f=window.workspaceFixture;window.peer=f.room.connect({sessionId:'peer',userId:'peer',name:'Presenter',color:'#2563eb'});window.peer.awareness.publish({...window.peer.awareness.self,updatedAt:Date.now(),selection:['text-shape'],presenting:true,viewport:{panX:123,panY:456,zoom:.8},cursor:{x:200,y:300}});});
    await page.getByRole('button',{name:'Follow Presenter'}).click();await expect.poll(()=>page.evaluate(()=>window.board.getViewport().panX)).toBe(123);await page.evaluate(()=>window.board.setViewport({panX:789,panY:456,zoom:.8}));await expect(page.getByRole('button',{name:'Stop following'})).toBeDisabled();await page.evaluate(()=>window.peer.disconnect());await expect(page.getByRole('button',{name:'Follow Presenter'})).toHaveCount(0);assert.equal(await page.evaluate(()=>window.board.getViewport().panX),789);
    await page.getByLabel("Laser pointer trail").check();
    await close();
    const n = await page.evaluate(() => window.board.getElements().length);
    const box = await board.boundingBox();
    await page.mouse.move(box.x + 600, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 800, box.y + 300, { steps: 10 });
    await page.mouse.up();
    assert.equal(
      await page.evaluate(() => window.board.getElements().length),
      n,
    );
    await expect
      .poll(() => page.locator("polyline").first().getAttribute("points"), {
        timeout: 3000,
      })
      .toBe("");
    await page.locator('input[type=file][accept*="application/json"]').setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({elements:[{...await page.evaluate(()=>window.boardApi.createElement('rectangle',{id:'imported',width:100,height:80}))}],viewport:{zoom:1,panX:0,panY:0}}))});await expect(page.getByRole('dialog',{name:'Import board preview'})).toBeVisible();const beforeImport=await page.evaluate(()=>window.board.getElements().length);await page.getByRole('button',{name:'Cancel import'}).click();assert.equal(await page.evaluate(()=>window.board.getElements().length),beforeImport);
    assert.deepEqual(errors, []);
    console.log(engine + " workspace edge review passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
