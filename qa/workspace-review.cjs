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
    await page.goto("http://127.0.0.1:5180/?local=1&workspace=1&theme="+(process.env.BOARD_THEME||"light"));
    await page.waitForFunction(() => window.board);
    await page.evaluate(() => localStorage.clear());
    const board = page.getByLabel("Noteboard canvas", { exact: true });
    const command = async (query) => {
      await board.focus();
      await page.keyboard.press("Control+k");
      await page.getByLabel("Search commands").fill(query);
      await page.keyboard.press("Enter");
    };
    const workspace = async () => {
      await command("Board workspace:");
      await expect(
        page.getByRole("dialog", { name: "Board workspace", exact: true }),
      ).toBeVisible();
    };
    const close = () =>
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .click();
    const count = () =>
      page.evaluate(
        () => window.board.getElements().filter((e) => !e.isDeleted).length,
      );
    await page.evaluate(() => {
      window.board.focusElements(["label"]);
      window.board.setViewport({ panX: 100, panY: 50, zoom: 1.2 });
    });
    await workspace();
    await page.getByLabel("Workspace item name").fill("Saved camera");
    await page
      .getByRole("button", { name: "Save viewpoint", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Saved camera", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Workspace item name").fill("Saved selection");
    await page
      .getByRole("button", { name: "Save selection", exact: true })
      .click();
    await close();
    await page.reload();
    await page.waitForFunction(() => window.board);
    await workspace();
    await page
      .getByRole("button", { name: "Saved camera", exact: true })
      .click();
    assert.equal(
      (await page.evaluate(() => window.board.getViewport())).zoom,
      1.2,
    );
    await page
      .getByRole("button", { name: "Saved selection", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "1 members selected",
    );
    await close();
    await page.evaluate(() => window.board.focusElements(["label"]));
    await workspace();
    await page.getByRole("tab", { name: "Library", exact: true }).click();
    await page.getByLabel("Workspace item name").fill("Reusable card");
    await page
      .getByRole("button", { name: "Save selection to library" })
      .click();
    await expect(page.getByText("Reusable card · symbol")).toBeVisible();
    const before = await count();
    await page.getByRole("button", { name: "Preview insertion" }).click();
    assert.equal(await count(), before);
    await page.getByRole("button", { name: "Apply preview" }).click();
    assert.equal(await count(), before + 1);
    await close();
    await board.focus();
    await page.keyboard.press("Control+z");
    assert.equal(await count(), before);
    console.log(
      "Persistent viewpoints, bookmarks, symbol preview and one-step undo passed",
    );
    await workspace();
    await page.getByRole("tab", { name: "Diagram", exact: true }).click();
    await page
      .getByLabel("Diagram CSV")
      .fill('id,label,target\na,"Start, here",b\nb,Finish,');
    await page.getByRole("button", { name: "Preview diagram import" }).click();
    await expect(
      page.getByRole("region", { name: "Workspace preview" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Apply preview" }).click();
    assert.equal(await count(), before + 3);
    await page.getByText("Relationships", { exact: true }).click();
    await expect(
      page.getByRole("list", { name: "Object relationships" }),
    ).toContainText("Start, here");
    await close();
    await page.evaluate(() => window.board.focusElements(["label"]));
    await workspace();
    await page.getByRole("tab", { name: "Objects", exact: true }).click();
    await page.getByLabel("Object link target").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Set link", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Unsupported link scheme",
    );
    await page.getByLabel("Object link target").fill("https://example.com");
    await page.getByRole("button", { name: "Set link", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () =>
          window.board.getElements().find((e) => e.id === "label").link.target,
      ),
      "https://example.com",
    );
    await page.getByText("Connection ports", { exact: true }).click();
    await page.getByLabel("Port name", { exact: true }).fill("Output");
    await page.getByRole("button", { name: "Add port", exact: true }).click();
    await expect(page.getByLabel("Rename port Output")).toBeVisible();
    await page.getByLabel("Rename port Output").fill("Result");
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.board.getElements().find((e) => e.id === "label").ports[0]
              .name,
        ),
      )
      .toBe("Result");
    await close();
    console.log(
      "Diagram import, relationship navigation, safe links and port controls passed",
    );
    await page.evaluate(() => {
      window.board.setElements([
        window.boardApi.createElement("sticky-note", {
          id: "note",
          x: 400,
          y: 300,
          width: 200,
          height: 150,
          text: "Vote for this",
        }),
      ]);
      window.workspaceFixture.room.syncElements(window.board.getElements());
      window.board.focusElements(["note"]);
    });
    await command("Collaboration:");
    await page.getByLabel("Comment message").fill("Discuss this idea");
    await page
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(
      page
        .getByRole("article")
        .getByText("Reviewer: Discuss this idea", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Reopen", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Vote", exact: true }).click();
    await expect(page.getByText(/1 \/ 3 votes used/)).toBeVisible();
    await page
      .getByRole("button", { name: "Reveal votes", exact: true })
      .click();
    await expect(page.getByText(/Results revealed/)).toBeVisible();
    await page.getByLabel("Minutes", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Set timer", exact: true }).click();
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await expect(page.getByRole("timer")).toBeVisible();
    await close();
    console.log(
      "Comment creation/resolution, voting and moderator timer passed",
    );
    await page.evaluate(() => {
      window.board.setElements([
        window.boardApi.createElement("text", {
          id: "text",
          x: 400,
          y: 300,
          text: "Hello",
          fontSize: 20,
          width: 60,
          height: 25,
        }),
      ]);
      window.board.focusElements(["text"]);
    });
    await board.focus();
    await page.keyboard.press("Control+Shift+Backquote");
    await page.keyboard.press("Enter");
    const editor = page.getByRole("textbox", { name: "Edit object text" });
    await editor.fill("Hello local");
    await expect
      .poll(() =>
        page.evaluate(
          () => localStorage.getItem("noteboard:text-intents:review") || "",
        ),
      )
      .toContain("Hello local");
    await page.keyboard.press("Control+Escape");
    assert.equal(
      await page.evaluate(
        () => window.board.getElements().find((e) => e.id === "text").text,
      ),
      "Hello",
    );
    const pdf = await page.evaluate(async () => {
      const a = window.boardApi;
      const elements = [
        a.createElement("rectangle", {
          id: "vector",
          x: 0,
          y: 0,
          width: 1200,
          height: 1000,
          text: "Selectable PDF text",
          roughness: 0,
        }),
      ];
      const blob = await a.exportBoardPdf(elements, {
        paper: "letter",
        paginate: true,
      });
      const text = await blob.text();
      return {
        size: blob.size,
        pages: (text.match(/\/Type \/Page\b/g) || []).length,
        header: text.slice(0, 8),
      };
    });
    assert.ok(pdf.size > 1000);
    assert.equal(pdf.pages, 6);
    assert.ok(pdf.header.startsWith("%PDF"));
    console.log("Durable text intent/cancel and multipage vector PDF passed");
    for (const size of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(size);
      await workspace();
      for (const tab of [
        "Library",
        "Diagram",
        "Objects",
        "Styles",
        "Versions",
      ]) {
        if(await page.getByLabel("Workspace section").isVisible())await page.getByLabel("Workspace section").selectOption(tab);else await page.getByRole("tab", { name: tab, exact: true }).click();
        const box = await page.getByRole("dialog").boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= size.width + 1);
        assert.equal(
          await page
            .getByRole("dialog")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
        );
      }
      await page.screenshot({
        path: `qa/artifacts/workspace-${engine}-${size.width}.png`,
      });
      await close();
    }
    assert.deepEqual(errors, []);
    console.log(engine + " workspace browser review passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
