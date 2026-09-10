import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node, NodeProps } from "@/types";

import { SolidFlow } from "../SolidFlow";

const Special = (props: NodeProps<{ label: string }>) => (
  <div data-testid="special">special:{props.data.label}</div>
);
const nodeTypes = { special: Special };

/**
 * The node component is resolved per row from `node.type`: a type change must
 * swap the rendered component in place (the wrapper element survives), and an
 * unknown type falls back to the default component. Pins the wiring so the
 * component-resolution mechanics can change without changing behavior.
 */
describe("node component follows node.type", () => {
  it("swaps the component when the type changes and falls back on unknown types", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "one" }, width: 100, height: 40 },
    ];
    const rendered = render(() => (
      <SolidFlow defaultNodes={nodes} nodeTypes={nodeTypes} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    flush();
    const wrapper = rendered.container.querySelector('[data-id="a"]')!;
    expect(rendered.queryByTestId("special")).toBeNull();
    expect(wrapper.textContent).toContain("one");

    api.commands.updateNode("a", { type: "special" });
    flush();
    expect(rendered.getByTestId("special")).toHaveTextContent("special:one");
    expect(rendered.container.querySelector('[data-id="a"]')).toBe(wrapper);
    expect(wrapper.classList.contains("solid-flow__node-special")).toBe(true);

    api.commands.updateNode("a", { type: "nope" });
    flush();
    expect(rendered.queryByTestId("special")).toBeNull();
    expect(wrapper.textContent).toContain("one");
  });
});
