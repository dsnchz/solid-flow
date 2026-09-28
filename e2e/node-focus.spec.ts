import { expect, gotoExample, test } from "./helpers";

// The default theme hides the browser focus outline on every selectable
// node, custom types included (React Flow / Svelte Flow style.css): focus
// shows as selection styling instead.
test("a focused custom node shows no browser outline", async ({ page }) => {
  await gotoExample(page, "CustomNode");
  const custom = page
    .locator(
      ".solid-flow__node.selectable:not(.solid-flow__node-default):not(.solid-flow__node-input):not(.solid-flow__node-output)",
    )
    .first();
  await custom.focus();
  await expect(custom).toBeFocused();
  await expect(custom).toHaveCSS("outline-style", "none");
});
