import { centerOf, drag, expect, gotoExample, handleOf, pathMidpoint, test } from "./helpers";

test.describe("edge reconnect", () => {
  test("dragging a reconnect anchor retargets the edge and fires all callbacks", async ({
    page,
  }) => {
    await gotoExample(page, "EdgeReconnect");
    const status = page.getByTestId("reconnect-status");
    await expect(status).toContainText("select the edge");

    // Select the edge by clicking ON its curve (the bbox center of a bezier
    // is usually off the path, so compute the true midpoint).
    const midpoint = await pathMidpoint(
      page.locator('.solid-flow__edge[data-id="e1"] .solid-flow__edge-path'),
    );
    await page.mouse.click(midpoint.x, midpoint.y);
    await expect(page.locator(".solid-flow__edgeupdater")).toHaveCount(2);
    // One element per anchor, the edge label itself (as Svelte Flow), and the
    // updater's move cursor wins over the label's.
    await expect(page.locator(".solid-flow__edge-label.solid-flow__edgeupdater")).toHaveCount(2);
    await expect(page.locator(".solid-flow__edgeupdater-target")).toHaveCSS("cursor", "move");

    // Drag the target-end anchor from Target A onto Target B's handle.
    const anchor = await centerOf(page.locator(".solid-flow__edgeupdater-target"));
    const dropHandle = await centerOf(handleOf(page, "3", "target"));
    await drag(page, anchor, dropHandle, 16);

    // The #13 regression ended every gesture with `valid: null`.
    await expect(status).toContainText("reconnected e1: now 1 -> 3");
    await expect(status).toContainText("gesture ended (valid: true)");
  });
});
