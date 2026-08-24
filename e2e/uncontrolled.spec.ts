import { centerOf, drag, expect, gotoExample, handleOf, test } from "./helpers";

// The uncontrolled contract, end to end: the flow owns membership, so a
// completed connection persists with NO onConnect adoption (the exact step
// controlled flows require — see quick-start.spec.ts for the contrast), and
// command writes land in the flow-owned store.
test.describe("uncontrolled flow", () => {
  test("connections persist without adoption; commands own membership", async ({ page }) => {
    await gotoExample(page, "Uncontrolled");
    await expect(page.locator(".solid-flow__node")).toHaveCount(3);
    await expect(page.locator(".solid-flow__edge")).toHaveCount(1);

    // Connect input 1 -> output 3. No onConnect handler exists in this
    // example — the edge must still be there after the flow settles.
    const from = await centerOf(handleOf(page, "1", "source"));
    const to = await centerOf(handleOf(page, "3", "target"));
    await drag(page, from, to, 16);

    await expect(page.locator(".solid-flow__edge")).toHaveCount(2);
    await page.waitForTimeout(200);
    await expect(page.locator(".solid-flow__edge")).toHaveCount(2);

    // Command writes persist and the reactive read surface follows.
    await page.getByRole("button", { name: "Add node" }).click();
    await expect(page.locator(".solid-flow__node")).toHaveCount(4);
    await expect(page.getByTestId("node-count")).toHaveText("nodes: 4");
  });
});
