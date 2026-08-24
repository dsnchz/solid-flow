import { centerOf, expect, gotoExample, handleOf, test } from "./helpers";

test.describe("connect (handle to handle)", () => {
  test("dragging between handles creates an edge; the connection line is unclipped mid-gesture", async ({
    page,
  }) => {
    await gotoExample(page, "Overview");
    await expect(page.locator(".solid-flow__edge")).toHaveCount(3);

    const from = await centerOf(handleOf(page, "2", "source"));
    const to = await centerOf(handleOf(page, "A", "target"));

    // Freeze mid-gesture: only a real browser can hold a drag open here,
    // which is what makes the #18/#20 clip regression assertable at all.
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2 + 60, { steps: 8 });

    const connectionLine = page.locator(".solid-flow__connectionline");
    await expect(connectionLine).toBeVisible();
    await expect(page.locator(".solid-flow__connection-path")).toBeVisible();
    // #18/#20 pin: the mangled CSS selector shipped svg default overflow
    // (visible->hidden clip at flow origin) and lost the z-index raise.
    await expect(connectionLine).toHaveCSS("overflow", "visible");
    await expect(connectionLine).toHaveCSS("z-index", "1001");
    await expect(connectionLine).toHaveCSS("position", "absolute");

    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator(".solid-flow__edge")).toHaveCount(4);
    await expect(page.locator(".solid-flow__connectionline")).toHaveCount(0);
  });
});
