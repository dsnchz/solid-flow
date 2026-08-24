import { centerOf, expect, getViewport, gotoExample, nodeById, test } from "./helpers";

// Focus-loss hardening: both upstream-xyflow bugs we fixed on our side.
// The gestures here are frozen mid-flight on purpose — CDP input is trusted,
// and the mouse button stays "down" across the blur, exactly like Alt+Tab.
test.describe("focus-loss hardening", () => {
  test("window blur mid-drag finalizes the gesture — the node stops chasing the cursor (xyflow#5852)", async ({
    page,
  }) => {
    await gotoExample(page, "Overview");

    const node = nodeById(page, "2");
    const start = await centerOf(node);

    // Freeze a node drag mid-flight (button held, d3 gesture active).
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 100, start.y - 60, { steps: 8 });

    const atBlur = await centerOf(node);
    expect(atBlur.x).toBeGreaterThan(start.x); // the drag really was active

    // Alt+Tab equivalent: the window blurs while the button is still down,
    // so the window-level mouseup never arrives on its own.
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));

    // The cursor keeps moving with the button still down — the finalized
    // node must stay where the blur left it instead of following.
    await page.mouse.move(atBlur.x + 200, atBlur.y + 120, { steps: 8 });
    const afterMove = await centerOf(node);
    expect(Math.abs(afterMove.x - atBlur.x)).toBeLessThan(2);
    expect(Math.abs(afterMove.y - atBlur.y)).toBeLessThan(2);

    await page.mouse.up();
  });

  test("a stuck selection modifier heals on the next pointer interaction (xyflow#5679)", async ({
    page,
  }) => {
    await gotoExample(page, "Overview");
    const before = await getViewport(page);

    // Simulate the macOS-screenshot-HUD scenario: Shift's keydown registered
    // but the OS overlay swallowed the keyup WITHOUT blurring the window.
    // (Synthetic keyboard events reach KeyHandler's window listener.)
    await page.evaluate(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true })),
    );

    // A real drag on empty pane WITHOUT Shift held: the pointerdown's
    // modifier flags must heal the stuck state, so this pans instead of
    // drawing a selection box. Same empty-corner path as pan-zoom.spec.
    await page.mouse.move(200, 650);
    await page.mouse.down();
    await page.mouse.move(300, 580, { steps: 6 });
    await expect(page.locator(".solid-flow__selection")).toHaveCount(0);
    await page.mouse.move(420, 520, { steps: 6 });
    await page.mouse.up();

    const after = await getViewport(page);
    expect(after.x - before.x).toBeGreaterThan(150);
    expect(after.y - before.y).toBeLessThan(-80);
  });
});
