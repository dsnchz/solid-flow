import { centerOf, drag, expect, gotoExample, handleOf, nodeById, test } from "./helpers";

// Drives the README's Quick Start (playground/examples/quick-start mirrors it
// verbatim) so the first snippet everyone copies is provably correct.
test.describe("README quick start", () => {
  test("connect adopts exactly one edge into the controlled store; nudge moves via draft write", async ({
    page,
  }) => {
    await gotoExample(page, "QuickStart");
    await expect(page.locator(".solid-flow__edge")).toHaveCount(2);

    // Connect input node 1 -> output node 3. The flow inserts the edge for
    // rendering AND onConnect pushes it into the controlled store — the
    // structural re-seed must converge on exactly ONE edge, not two.
    const from = await centerOf(handleOf(page, "1", "source"));
    const to = await centerOf(handleOf(page, "3", "target"));
    await drag(page, from, to, 16);

    await expect(page.locator(".solid-flow__edge")).toHaveCount(3);
    // Stable after settling — no duplicate creeps in on the next flush.
    await page.waitForTimeout(200);
    await expect(page.locator(".solid-flow__edge")).toHaveCount(3);
    const ids = await page.$$eval(".solid-flow__edge", (els) =>
      els.map((el) => el.getAttribute("data-id")),
    );
    expect(new Set(ids).size).toBe(ids.length);

    // The draft-write path: the Nudge button mutates position in place.
    const before = await centerOf(nodeById(page, "1"));
    await page.getByRole("button", { name: "Nudge first node" }).click();
    const after = await centerOf(nodeById(page, "1"));
    expect(after.x).toBeGreaterThan(before.x);
  });
});
