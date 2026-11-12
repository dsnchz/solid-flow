import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { settle } from "@/__tests__/settle";
import { useInternalSolidFlow } from "@/contexts";

import { SolidFlow } from "../SolidFlow";

// The element's z-index follows the row's z (its own render effect): a
// selection elevates it, a deselection drops it back, and a user `z-index`
// in `style` never applies (the flow owns stacking, as with `transform`).
describe("node element z-index", () => {
  it("follows selection, and the user style cannot override it", async () => {
    let api!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      api = useInternalSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow
        nodes={[
          {
            id: "a",
            position: { x: 0, y: 0 },
            data: {},
            width: 100,
            height: 40,
            style: { "z-index": 7, color: "red" },
          },
        ]}
        edges={[]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await settle();
    const el = container.querySelector<HTMLElement>('.solid-flow__node[data-id="a"]')!;
    expect(el.style.zIndex).toBe("0");
    expect(el.style.color).toBe("red");

    api.actions.addSelectedNodes(["a"]);
    flush();
    expect(el.style.zIndex).toBe("1000");

    api.actions.unselectNodesAndEdges();
    flush();
    expect(el.style.zIndex).toBe("0");
    expect(el.style.color).toBe("red");
  });
});
