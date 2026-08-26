import { centerOf, drag, expect, handleOf, test } from "./helpers";

// Async-seeded stores end to end: the Loading boundary holds the flow while
// the (simulated, 800ms) API resolves, then the graph appears and behaves
// like any controlled flow — including connection adoption.
test.describe("async-seeded flow", () => {
  test("loading fallback, then the fetched graph, then normal interaction", async ({ page }) => {
    await page.goto("/?example=AsyncData");

    // The boundary shows first — the flow is not mounted yet.
    await expect(page.getByTestId("graph-loading")).toBeVisible();
    expect(await page.locator(".solid-flow__node").count()).toBe(0);

    // The API resolves: fallback swaps for the fetched graph.
    await expect(page.locator(".solid-flow__node")).toHaveCount(3, { timeout: 5000 });
    await expect(page.getByTestId("graph-loading")).toHaveCount(0);
    await expect(page.locator(".solid-flow__edge")).toHaveCount(1);

    // Post-seed the store is ordinary: connect 1 -> 3 and adopt it.
    const from = await centerOf(handleOf(page, "1", "source"));
    const to = await centerOf(handleOf(page, "3", "target"));
    await drag(page, from, to, 16);
    await expect(page.locator(".solid-flow__edge")).toHaveCount(2);
  });
});
