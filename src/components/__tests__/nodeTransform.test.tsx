import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import { useSolidFlow } from "../../hooks/useSolidFlow";
import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * A node's transform is its own DOM write (a render effect over the row's
 * absolute position), separate from the style object: a move must update
 * the transform, keep the user's style keys and the flow-owned ones, and a
 * user `transform` never applies (the flow's wins, as before).
 */
describe("NodeWrapper transform", () => {
  it("positions the node, follows a move, and keeps the other style keys", async () => {
    let api!: ReturnType<typeof useSolidFlow<Node>>;
    const Probe = () => {
      api = useSolidFlow<Node>();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[
          {
            id: "a",
            position: { x: 10, y: 20 },
            data: { label: "a" },
            width: 100,
            height: 40,
            style: { color: "red", transform: "rotate(45deg)" },
          },
        ]}
        edges={[]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    const el = container.querySelector<HTMLElement>('.solid-flow__node[data-id="a"]')!;
    expect(el.style.transform).toBe("translate(10px, 20px)");
    expect(el.style.color).toBe("red");
    expect(el.style.width).toBe("100px");
    expect(el.style.zIndex).toBe("0");

    api.commands.updateNode("a", { position: { x: 300, y: 40 } });
    flush();
    await tick();
    expect(el.style.transform).toBe("translate(300px, 40px)");
    expect(el.style.color).toBe("red");
    expect(el.style.width).toBe("100px");
  });
});
