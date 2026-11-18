import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { settle } from "@/__tests__/settle";

import { SolidFlow } from "../SolidFlow";

// Moving the selected node with an arrow key announces where it went, after
// the move (snapping and extent clamping included), as React Flow 13.0.2 and
// Svelte Flow 2.0.2 do (xyflow#6130).
describe("arrow-key node move", () => {
  it("announces the new position, not the previous one", async () => {
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[
          {
            id: "a",
            position: { x: 10, y: 20 },
            data: { label: "a" },
            width: 100,
            height: 40,
            selected: true,
          },
        ]}
        defaultEdges={[]}
        width={800}
        height={600}
      />
    ));
    await settle();

    const node = container.querySelector<HTMLElement>('.solid-flow__node[data-id="a"]')!;
    fireEvent.keyDown(node, { key: "ArrowRight" });
    await settle();

    expect(node.style.transform).toBe("translate(15px, 20px)");
    expect(container.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      "Moved selected node right. New position, x: 15, y: 20",
    );
  });
});
