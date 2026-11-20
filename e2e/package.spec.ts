import { expect, test } from "./helpers";

// The published package, consumed as a Vite + @solidjs/vite-plugin app
// consumes it (e2e/package/): the app compiles the shipped JSX build with its
// own Solid compiler. Everything else in the suite compiles src/ or uses the
// pre-compiled build, so this is the only check of that path. It caught a
// bundler step that merged NodeWrapper's declarations into one `let` with the
// node element's JSX: Solid's compiler emits that element's setup before the
// whole statement, so its click handler was read before its declaration and
// the app crashed on load (Cannot access 'onSelectNodeHandler' before
// initialization).
const FIXTURE = "http://localhost:3014/";

test("an app compiling the shipped JSX build renders and interacts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(FIXTURE);
  await expect(page.locator(".solid-flow__node")).toHaveCount(4);
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll(".solid-flow__edge").length))
    .toBe(3);
  await expect(page.locator('.solid-flow__node[data-id="untyped"]')).toContainText(
    "untyped default",
  );
  await expect(page.locator(".count")).toHaveText("count: 1");
  await expect(page.getByText("custom label")).toBeVisible();
  await expect(page.locator(".solid-flow__minimap")).toBeVisible();
  await expect(page.locator(".portal-content")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        // Set by the fixture's Probe component (e2e/package/main.tsx).
        const fixture = window as unknown as { __flow: { flow: { nodesInitialized: boolean } } };
        return fixture.__flow.flow.nodesInitialized;
      }),
    )
    .toBe(true);

  // A click runs the node's own handlers (the one the crash read too early).
  await page.locator('.solid-flow__node[data-id="untyped"]').click();
  await expect(page.locator('.solid-flow__node[data-id="untyped"]')).toHaveClass(/selected/);

  expect(errors).toEqual([]);
});
