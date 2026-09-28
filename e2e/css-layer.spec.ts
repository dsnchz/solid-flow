import { expect, gotoExample, nodeById, test } from "./helpers";

// The library CSS sits in the `xyflow` cascade layer (React Flow / Svelte
// Flow's next majors): any unlayered app rule wins over it, whatever the
// specificity, so apps restyle without selector games.
for (const css of ["style", "base"] as const) {
  test(`an unlayered app rule overrides the library (${css}.css)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await gotoExample(page, "QuickStart", css === "base" ? "&css=base" : "");
    const node = nodeById(page, "1");
    await node.click();
    // Each app selector is LESS specific than the library rule it beats:
    // `div` (0,0,1) against `.solid-flow__handle` (0,1,0), `[data-id]`
    // (0,1,0) against the selected node's border (0,2,0).
    await page.addStyleTag({
      content: `
        div { background-color: rgb(1, 2, 3); }
        [data-id] { border-top-color: rgb(4, 5, 6); }
      `,
    });
    await expect(node.locator(".solid-flow__handle").first()).toHaveCSS(
      "background-color",
      "rgb(1, 2, 3)",
    );
    await expect(node).toHaveCSS("border-top-color", "rgb(4, 5, 6)");
  });
}
