import { expect, gotoExample, nodeById, test } from "./helpers";

test.describe("controlled store-prop replacement", () => {
  test("toggle handle pos flips every handle through a wholesale setNodes map", async ({
    page,
  }) => {
    await gotoExample(page, "Overview");

    // Regression (3eb07c9): provider-adopted flows silently dropped
    // `setNodes(() => nodes.map(...))` because the store-proxy identity
    // never changes — the reset effect now tracks structure.
    const sourceHandle = nodeById(page, "2").locator(".solid-flow__handle.source").first();
    await expect(sourceHandle).toHaveClass(/solid-flow__handle-bottom/);

    await page.getByRole("button", { name: "toggle handle pos" }).click();
    await expect(sourceHandle).toHaveClass(/solid-flow__handle-right/);

    await page.getByRole("button", { name: "toggle handle pos" }).click();
    await expect(sourceHandle).toHaveClass(/solid-flow__handle-bottom/);
  });
});
