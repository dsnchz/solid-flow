import { expect, gotoExample, nodeById, test } from "./helpers";

test.describe("selection box", () => {
  test("shift-dragging a box on the pane selects the enclosed nodes", async ({ page }) => {
    await gotoExample(page, "Overview");
    await expect(page.locator(".solid-flow__node.selected")).toHaveCount(0);

    // A rectangle FULLY enclosing nodes "A" and "D" — Overview declares
    // selectionMode="full" (containment required) and node "2" is
    // selectable:false, so pick genuinely selectable neighbors and build
    // the box from real bounding boxes (fitView zoom scales screen size).
    const a = (await nodeById(page, "A").boundingBox())!;
    const b = (await nodeById(page, "D").boundingBox())!;
    const topLeft = { x: Math.min(a.x, b.x) - 40, y: Math.min(a.y, b.y) - 40 };
    const bottomRight = {
      x: Math.max(a.x + a.width, b.x + b.width) + 40,
      y: Math.max(a.y + a.height, b.y + b.height) + 40,
    };

    await page.keyboard.down("Shift");
    await page.mouse.move(topLeft.x, topLeft.y);
    await page.mouse.down();
    await page.mouse.move(bottomRight.x, bottomRight.y, { steps: 10 });

    // The selection rect is visible mid-gesture.
    await expect(page.locator(".solid-flow__selection")).toBeVisible();

    await page.mouse.up();
    await page.keyboard.up("Shift");

    await expect(nodeById(page, "A")).toHaveClass(/selected/);
    await expect(nodeById(page, "D")).toHaveClass(/selected/);
  });
});
