import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
});

// The edge's DRAWN z-index is upstream's getElevatedEdgeZIndex: its own z,
// plus its endpoints' when one is selected and edges elevate on select. The
// endpoint part is added in EdgeWrapper, not in the edge row (round 65).
describe("edge z-index", () => {
  const renderFlow = async (elevateEdgesOnSelect?: boolean) => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => ((api = useSolidFlow()), null);
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b", zIndex: 2 }]}
        elevateEdgesOnSelect={elevateEdgesOnSelect}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    const wrapperZ = () =>
      container.querySelector<SVGElement>('.solid-flow__edge[data-id="e1"]')!.closest("svg")!.style
        .zIndex;
    return { api: () => api, wrapperZ };
  };

  it("rises with a selected endpoint, and falls back when it is deselected", async () => {
    const { api, wrapperZ } = await renderFlow();
    expect(wrapperZ()).toBe("2");

    api().commands.updateNode("a", { selected: true });
    flush();
    await tick();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);

    api().commands.updateNode("a", { selected: false });
    flush();
    await tick();
    expect(wrapperZ()).toBe("2");
  });

  it("stays at the edge's own z without elevateEdgesOnSelect", async () => {
    const { api, wrapperZ } = await renderFlow(false);
    api().commands.updateNode("a", { selected: true });
    flush();
    await tick();
    expect(wrapperZ()).toBe("2");
  });
});
