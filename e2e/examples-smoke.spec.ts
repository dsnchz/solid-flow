import { expect, test } from "./helpers";

// Every registered playground example must at least render its flow without
// throwing. The shared fixture fails a test on ANY uncaught page error, so
// this sweep catches setup-time crashes (like the Dagre example's
// REACTIVE_WRITE_IN_OWNED_SCOPE) the day they appear, without needing a
// dedicated spec per example. Keep this list in sync with
// playground/constants.tsx (SolidFlowExamplesMap).
const EXAMPLES = [
  "A11y",
  "AddNodeOnDrop",
  "AsyncData",
  "Backgrounds",
  "ColorMode",
  "CustomConnectionLine",
  "CustomNode",
  "Dagre",
  "DragNDrop",
  "EasyConnect",
  "EdgeReconnect",
  "Edges",
  "HandleConnect",
  "Interaction",
  "InteractiveMinimap",
  "Intersections",
  "MovingHandles",
  "NodeResizer",
  "NodeToolbar",
  "Overview",
  "Persistence",
  "QuickStart",
  "Remount",
  "Reset",
  "StressTest",
  "Subflows",
  "Switch",
  "TwoWayViewport",
  "Uncontrolled",
  "UpdateNode",
  "UpdateNodeInternals",
  "UseConnection",
  "UseNodesData",
  "UseSolidFlow",
  "Validation",
] as const;

test.describe("examples smoke sweep", () => {
  for (const example of EXAMPLES) {
    test(`${example} renders without page errors`, async ({ page }) => {
      await page.goto(`/?example=${example}`);
      // The flow container must mount (a crashed example shows the error
      // boundary instead); some examples legitimately start with no nodes,
      // so this asserts the flow itself, not its contents.
      await expect(page.locator(".solid-flow").first()).toBeVisible();
      // Let post-mount effects (measurement, fitView, subscriptions) run —
      // the fixture surfaces any error they throw at teardown.
      await page.waitForTimeout(150);
    });
  }
});
