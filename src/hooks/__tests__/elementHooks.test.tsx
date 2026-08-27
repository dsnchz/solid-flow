import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { useEdge, useNode, useSelectedEdges, useSelectedNodes } from "@/hooks";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { SolidFlow } from "../../components/SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "a" }, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 0 }, data: { label: "b" }, width: 100, height: 40 },
];

describe("element hooks (xyflow#5868 parity)", () => {
  it("useNode / useEdge resolve reactively by id", async () => {
    let node!: ReturnType<typeof useNode>;
    let edge!: ReturnType<typeof useEdge>;
    let missing!: ReturnType<typeof useNode>;
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      node = useNode(() => "a");
      edge = useEdge(() => "e1");
      missing = useNode(() => "nope");
      api = useSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow
        defaultNodes={nodes}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    expect(node()?.id).toBe("a");
    expect(edge()?.id).toBe("e1");
    expect(missing()).toBeUndefined();

    // Reactive: a position write is visible through the hook.
    api.updateNode("a", { position: { x: 42, y: 7 } });
    await tick();
    expect(node()?.position).toEqual({ x: 42, y: 7 });
  });

  it("useSelectedNodes / useSelectedEdges track selection", async () => {
    let selectedNodes!: ReturnType<typeof useSelectedNodes>;
    let selectedEdges!: ReturnType<typeof useSelectedEdges>;
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      selectedNodes = useSelectedNodes();
      selectedEdges = useSelectedEdges();
      api = useSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow
        defaultNodes={nodes}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    expect(selectedNodes()).toHaveLength(0);

    api.updateNode("a", { selected: true });
    api.updateEdge("e1", { selected: true });
    await tick();
    expect(selectedNodes().map((n) => n.id)).toEqual(["a"]);
    expect(selectedEdges().map((e) => e.id)).toEqual(["e1"]);
  });
});
