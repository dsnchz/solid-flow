import { centerOf, drag, expect, getViewport, gotoExample, nodeById, test } from "./helpers";

// onNodesChange in a real browser: XYDrag's position writes, click
// selection and keyboard deletion pass through the callback, which drops
// some of them (playground/examples/node-changes).
test.describe("onNodesChange", () => {
  test("a dropped position change keeps the node in place; the others move", async ({ page }) => {
    await gotoExample(page, "NodeChanges");
    const locked = nodeById(page, "locked");
    const free = nodeById(page, "free");

    const lockedBefore = await centerOf(locked);
    await drag(page, lockedBefore, { x: lockedBefore.x + 80, y: lockedBefore.y + 60 });
    expect(await centerOf(locked)).toEqual(lockedBefore);
    // the click that started the drag selected it: select changes passed
    await expect(locked).toHaveClass(/\bselected\b/);

    const freeBefore = await centerOf(free);
    await drag(page, freeBefore, { x: freeBefore.x + 80, y: freeBefore.y + 60 });
    const freeAfter = await centerOf(free);
    expect(freeAfter.x - freeBefore.x).toBeGreaterThan(60);
    expect(freeAfter.y - freeBefore.y).toBeGreaterThan(40);
    await expect(page.getByTestId("last-changes")).toHaveText("position");
  });

  test("a dropped remove change keeps the node through a keyboard delete", async ({ page }) => {
    await gotoExample(page, "NodeChanges");
    const kept = nodeById(page, "kept");
    await kept.click();
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("last-changes")).toHaveText("remove");
    await expect(kept).toBeVisible();

    await nodeById(page, "free").click();
    await page.keyboard.press("Backspace");
    await expect(nodeById(page, "free")).toHaveCount(0);
  });

  test("NodeResizer sizes pass through it; a dropped one keeps the size", async ({ page }) => {
    await gotoExample(page, "NodeChanges");
    const { zoom } = await getViewport(page);
    const box = nodeById(page, "box");
    await box.click();
    const before = (await box.boundingBox())!;
    const handle = box.locator(".solid-flow__resize-control.handle.bottom.right");
    const corner = await centerOf(handle);

    // a small resize lands (flow width stays under 200)
    await drag(page, corner, { x: corner.x + 15, y: corner.y + 10 });
    await expect(page.getByTestId("last-changes")).toHaveText("dimensions");
    const grown = (await box.boundingBox())!;
    expect(grown.width).toBeGreaterThan(before.width + 5);

    // every frame past 200 flow units wide is dropped: the box stops there
    const corner2 = await centerOf(handle);
    await drag(page, corner2, { x: corner2.x + 400, y: corner2.y });
    const after = (await box.boundingBox())!;
    expect(after.width).toBeGreaterThan(grown.width);
    expect(after.width / zoom).toBeLessThanOrEqual(201);
  });
});
