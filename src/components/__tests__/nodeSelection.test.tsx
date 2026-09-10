import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { useInternalSolidFlow } from "@/contexts";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const makeNode = (id: string, x: number, y: number, width = 100, height = 40): Node => ({
  id,
  position: { x, y },
  data: {},
  width,
  height,
});

/**
 * The multi-selection wrapper (NodeSelection) derives its box from the KEYED
 * selected-presence record, not a tracked scan of every node. These tests pin
 * the wiring: the wrapper appears in "nodes" selection-rect mode sized to the
 * union of the selected rows, and follows a selected row's move.
 */
describe("NodeSelection wrapper bounds", () => {
  const renderProbed = (nodes: Node[]) => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      api = useSolidFlow();
      return null;
    };
    const rendered = render(() => (
      <SolidFlow defaultNodes={nodes} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    const wrapper = () =>
      rendered.container.querySelector<HTMLElement>(".solid-flow__selection-wrapper");
    return { rendered, internal: () => internal, api: () => api, wrapper };
  };

  it("sizes the wrapper to the union of the selected nodes and ignores unselected ones", () => {
    const { internal, wrapper } = renderProbed([
      makeNode("a", 0, 0),
      makeNode("b", 300, 200, 50, 50),
      makeNode("far", 2000, 2000),
    ]);
    flush();
    expect(wrapper()).toBeNull();

    internal().actions.addSelectedNodes(["a", "b"]);
    internal().actions.setSelectionRectMode("nodes");
    flush();

    const el = wrapper()!;
    expect(el).not.toBeNull();
    expect(el.style.width).toBe("350px");
    expect(el.style.height).toBe("250px");
    expect(el.style.transform).toBe("translate(0px, 0px)");
  });

  it("follows a selected row's position write (the per-frame drag path)", () => {
    const { internal, api, wrapper } = renderProbed([makeNode("a", 0, 0), makeNode("b", 100, 0)]);
    flush();
    internal().actions.addSelectedNodes(["a", "b"]);
    internal().actions.setSelectionRectMode("nodes");
    flush();
    expect(wrapper()!.style.width).toBe("200px");

    api().commands.updateNode("a", { position: { x: 50, y: 30 } });
    flush();
    expect(wrapper()!.style.width).toBe("150px");
    expect(wrapper()!.style.height).toBe("70px");
    expect(wrapper()!.style.transform).toBe("translate(50px, 0px)");
  });
});
