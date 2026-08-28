import { expect, gotoExample, test } from "./helpers";

// Draft-then-commit persistence pattern (Persistence example): async server
// truth seeds the flow through a <Loading> boundary; edits accumulate in the
// flow-owned draft; Save batch-submits and a failed save keeps the draft.
test.describe("persistence pattern", () => {
  test("loads from async server truth, drafts an edit, batch-saves", async ({ page }) => {
    await gotoExample(page, "Persistence");

    // Async seed: the three server nodes arrive after the fake latency.
    await expect(page.locator(".solid-flow__node")).toHaveCount(3);

    await page.getByRole("button", { name: "add node" }).click();
    await expect(page.locator(".solid-flow__node")).toHaveCount(4);

    await page.getByRole("button", { name: "Save to server" }).click();
    await expect(page.getByTestId("save-status")).toHaveText(/Saved — server holds 4 nodes/);
  });

  test("failed save keeps the draft and retry succeeds", async ({ page }) => {
    await gotoExample(page, "Persistence");
    await expect(page.locator(".solid-flow__node")).toHaveCount(3);

    await page.getByRole("button", { name: "add node" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save to server" }).click();
    await expect(page.getByTestId("save-status")).toHaveText(/Save failed: .* draft kept/);

    // Draft intact after the failure — retry lands the same 4 nodes.
    await expect(page.locator(".solid-flow__node")).toHaveCount(4);
    await page.getByRole("button", { name: "Save to server" }).click();
    await expect(page.getByTestId("save-status")).toHaveText(/Saved — server holds 4 nodes/);
  });
});
