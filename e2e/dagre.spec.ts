import { centerOf, expect, gotoExample, nodeById, test } from "./helpers";

// Pins the Dagre layout example: it once crashed on load with Solid 2.0's
// REACTIVE_WRITE_IN_OWNED_SCOPE guard (store writes during component setup).
// The shared fixture fails on any page error, so merely loading is half the
// test; the layout assertions cover the other half.
test.describe("dagre layout example", () => {
  test("lays out vertically on load and re-lays out horizontally on demand", async ({ page }) => {
    await gotoExample(page, "Dagre");

    // Initial TB layout: the input node sits above its child.
    const input = await centerOf(nodeById(page, "1"));
    const child = await centerOf(nodeById(page, "2"));
    expect(child.y).toBeGreaterThan(input.y + 20);

    await page.getByRole("button", { name: "horizontal layout" }).click();

    // LR layout: the child moves to the right of the input instead.
    await expect
      .poll(async () => {
        const a = await centerOf(nodeById(page, "1"));
        const b = await centerOf(nodeById(page, "2"));
        return b.x - a.x;
      })
      .toBeGreaterThan(20);
  });
});
