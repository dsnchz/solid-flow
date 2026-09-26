import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import type { EdgeProps, Node } from "@/types";

import { BaseEdge } from "../edge/BaseEdge";
import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

const linePath = (props: EdgeProps) =>
  `M${props.sourceX},${props.sourceY} L${props.targetX},${props.targetY}`;

/**
 * BaseEdge is the public edge primitive custom edges build on: extra
 * attributes must reach the path (and stay reactive), the interaction path
 * follows `interactionWidth`, and the label renders through EdgeLabel.
 */
describe("BaseEdge", () => {
  it("renders the path with its class, style, markers and extra attributes, reactively", async () => {
    const [dash, setDash] = createSignal("4 2");
    const DashEdge = (props: EdgeProps) => (
      <BaseEdge
        path={linePath(props)}
        class="dash-edge"
        style={{ stroke: "red" }}
        markerEnd={props.markerEnd}
        stroke-dasharray={dash()}
        stroke-linecap="round"
      />
    );
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[
          { id: "e1", source: "a", target: "b", type: "dash", markerEnd: { type: "arrow" } },
        ]}
        edgeTypes={{ dash: DashEdge }}
        width={800}
        height={600}
      />
    ));
    await tick();

    const path = container.querySelector<SVGPathElement>(
      '.solid-flow__edge[data-id="e1"] .solid-flow__edge-path',
    )!;
    expect(path).not.toBeNull();
    expect(path.getAttribute("class")).toBe("solid-flow__edge-path dash-edge");
    expect(path.getAttribute("d")).toMatch(/^M.* L.*$/);
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.style.stroke).toBe("red");
    expect(path.getAttribute("marker-end")).toMatch(/^url\('#.*'\)$/);
    expect(path.getAttribute("stroke-dasharray")).toBe("4 2");
    expect(path.getAttribute("stroke-linecap")).toBe("round");

    setDash("1 1");
    await tick();
    expect(path.getAttribute("stroke-dasharray")).toBe("1 1");
  });

  it("renders the interaction path at the default width, and follows interactionWidth", async () => {
    const [width, setWidth] = createSignal<number | undefined>(undefined);
    const PlainEdge = (props: EdgeProps) => (
      <BaseEdge path={linePath(props)} interactionWidth={width()} />
    );
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b", type: "plain" }]}
        edgeTypes={{ plain: PlainEdge }}
        width={800}
        height={600}
      />
    ));
    await tick();

    const interaction = () =>
      container.querySelector<SVGPathElement>(
        '.solid-flow__edge[data-id="e1"] .solid-flow__edge-interaction',
      );
    expect(interaction()!.getAttribute("stroke-width")).toBe("20");
    expect(interaction()!.getAttribute("d")).toBe(
      container
        .querySelector('.solid-flow__edge[data-id="e1"] .solid-flow__edge-path')!
        .getAttribute("d"),
    );

    setWidth(0);
    await tick();
    expect(interaction()).toBeNull();

    setWidth(8);
    await tick();
    expect(interaction()!.getAttribute("stroke-width")).toBe("8");
  });

  it("renders the label through EdgeLabel only when a label is given", async () => {
    const [label, setLabel] = createSignal<string | undefined>(undefined);
    const LabelEdge = (props: EdgeProps) => (
      <BaseEdge path={linePath(props)} label={label()} labelX={10} labelY={20} />
    );
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b", type: "labelled" }]}
        edgeTypes={{ labelled: LabelEdge }}
        width={800}
        height={600}
      />
    ));
    await tick();
    expect(container.querySelector(".solid-flow__edge-label")).toBeNull();

    setLabel("hello");
    await tick();
    const el = container.querySelector<HTMLElement>(".solid-flow__edge-label")!;
    expect(el.textContent).toBe("hello");
    expect(el.style.transform).toContain("translate(10px,20px)");

    setLabel(undefined);
    await tick();
    expect(container.querySelector(".solid-flow__edge-label")).toBeNull();
  });
});
