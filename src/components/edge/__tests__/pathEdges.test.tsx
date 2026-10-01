import { render } from "@solidjs/testing-library";
import { getBezierPath, getSmoothStepPath, getStraightPath, Position } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";
import type { Edge, EdgeProps, EdgeTypes, Node } from "@/types";

import { BezierEdge, SmoothStepEdge, StepEdge, StraightEdge } from "..";

// The built-in edge components: the path each draws is @xyflow/system's for
// the edge's resolved endpoints. The renderer's built-ins carry no DOM id;
// the public components (used inside a custom edge) put the given id on it.

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 300, y: 200 }, data: {}, width: 100, height: 40 },
];

const renderEdge = async (edge: Edge, edgeTypes?: EdgeTypes) => {
  let internal!: ReturnType<typeof useInternalSolidFlow>;
  const Probe = () => ((internal = useInternalSolidFlow()), null);
  const { container } = render(() => (
    <SolidFlow
      defaultNodes={nodes}
      defaultEdges={[edge]}
      edgeTypes={edgeTypes}
      width={800}
      height={600}
    >
      <Probe />
    </SolidFlow>
  ));
  await tick();
  const row = internal.actions.getResolvedEdge(edge.id)!;
  const endpoints = {
    sourceX: row.sourceX,
    sourceY: row.sourceY,
    targetX: row.targetX,
    targetY: row.targetY,
    sourcePosition: row.sourcePosition,
    targetPosition: row.targetPosition,
  };
  const path = container.querySelector<SVGPathElement>(".solid-flow__edge-path")!;
  return { endpoints, path };
};

describe("built-in edges", () => {
  it.each([
    ["default", (e: Parameters<typeof getBezierPath>[0]) => getBezierPath(e)[0]],
    ["straight", (e: Parameters<typeof getBezierPath>[0]) => getStraightPath(e)[0]],
    [
      "step",
      (e: Parameters<typeof getBezierPath>[0]) => getSmoothStepPath({ ...e, borderRadius: 0 })[0],
    ],
    ["smoothstep", (e: Parameters<typeof getBezierPath>[0]) => getSmoothStepPath(e)[0]],
  ] as const)("%s draws its path, with no DOM id", async (type, expected) => {
    const { endpoints, path } = await renderEdge({ id: "e1", source: "a", target: "b", type });
    expect(path.getAttribute("d")).toBe(expected(endpoints));
    expect(path.hasAttribute("id")).toBe(false);
  });

  it("pass their path options through", async () => {
    const bezier = await renderEdge({
      id: "e1",
      source: "a",
      target: "b",
      pathOptions: { curvature: 0.9 },
    });
    expect(bezier.path.getAttribute("d")).toBe(
      getBezierPath({ ...bezier.endpoints, curvature: 0.9 })[0],
    );
  });
});

describe("public edge components", () => {
  // Inside a custom edge: the given id lands on the path, the path options apply.
  const renderCustom = (custom: (props: EdgeProps) => ReturnType<typeof BezierEdge>) =>
    renderEdge({ id: "e1", source: "a", target: "b", type: "custom" }, { custom });
  const at = (p: EdgeProps) => ({
    source: p.source,
    target: p.target,
    get sourceX() {
      return p.sourceX;
    },
    get sourceY() {
      return p.sourceY;
    },
    get targetX() {
      return p.targetX;
    },
    get targetY() {
      return p.targetY;
    },
    get sourcePosition() {
      return p.sourcePosition;
    },
    get targetPosition() {
      return p.targetPosition;
    },
  });

  it("BezierEdge", async () => {
    const { endpoints, path } = await renderCustom((p) => (
      <BezierEdge {...at(p)} id="custom-path" pathOptions={{ curvature: 0.5 }} />
    ));
    expect(path.getAttribute("d")).toBe(getBezierPath({ ...endpoints, curvature: 0.5 })[0]);
    expect(path.getAttribute("id")).toBe("custom-path");
  });

  it("StraightEdge", async () => {
    const { endpoints, path } = await renderCustom((p) => (
      <StraightEdge {...at(p)} id="custom-path" />
    ));
    expect(path.getAttribute("d")).toBe(getStraightPath(endpoints)[0]);
    expect(path.getAttribute("id")).toBe("custom-path");
  });

  it("StepEdge", async () => {
    const { endpoints, path } = await renderCustom((p) => (
      <StepEdge {...at(p)} id="custom-path" pathOptions={{ offset: 7 }} />
    ));
    expect(path.getAttribute("d")).toBe(
      getSmoothStepPath({ ...endpoints, borderRadius: 0, offset: 7 })[0],
    );
    expect(path.getAttribute("id")).toBe("custom-path");
  });

  it("SmoothStepEdge", async () => {
    const { endpoints, path } = await renderCustom((p) => (
      <SmoothStepEdge
        {...at(p)}
        id="custom-path"
        pathOptions={{ borderRadius: 3, offset: 7, stepPosition: 0.3 }}
      />
    ));
    expect(path.getAttribute("d")).toBe(
      getSmoothStepPath({ ...endpoints, borderRadius: 3, offset: 7, stepPosition: 0.3 })[0],
    );
    expect(path.getAttribute("id")).toBe("custom-path");
    expect(endpoints.sourcePosition).toBe(Position.Bottom);
  });
});
