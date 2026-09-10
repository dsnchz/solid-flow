import { centerOf, expect, gotoExample, nodeById, test } from "./helpers";

type Probe = { __bench: { api: { flow: { dragging: boolean } } } };
const flowDragging = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as Probe).__bench.api.flow.dragging);

test.describe("flow-level dragging flag", () => {
  test("node drags set flow.dragging for their duration (minimap per-frame sampling keys off it)", async ({
    page,
  }) => {
    await gotoExample(page, "StressTest", "&x=5&y=5&fit=0&minimap=1");
    const node = nodeById(page, "2-2");
    await expect(node).toBeVisible();
    expect(await flowDragging(page)).toBe(false);

    const from = await centerOf(node);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 30, { steps: 4 });
    await page.waitForTimeout(30);
    // Mid-gesture: previously only PANE drags ever set this flag, so the
    // minimap's per-frame bounds sampling never ran during node drags.
    expect(await flowDragging(page)).toBe(true);

    await page.mouse.up();
    await page.waitForTimeout(30);
    expect(await flowDragging(page)).toBe(false);
  });
});
