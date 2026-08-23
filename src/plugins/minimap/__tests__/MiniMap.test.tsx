import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Node } from "@/types";

import { MiniMap } from "../MiniMap";
import type { MiniMapNodeProps } from "../MiniMapNode";

const nodes: Node[] = [
  {
    id: "a",
    position: { x: 0, y: 0 },
    data: {},
    width: 100,
    height: 40,
    style: { background: "rgb(255, 0, 0)" },
  },
  { id: "b", position: { x: 200, y: 100 }, data: {}, width: 100, height: 40 },
];

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("MiniMap", () => {
  it("renders the default rounded-rect node per visible node", async () => {
    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={[]} width={800} height={600}>
        <MiniMap />
      </SolidFlow>
    ));
    await tick();

    const rects = container.querySelectorAll(".solid-flow__minimap-node");
    expect(rects).toHaveLength(2);
    // upstream parity: the node's own background feeds the default fill
    expect((rects[0] as SVGElement).style.fill).toBe("rgb(255, 0, 0)");
  });

  it("renders a custom nodeComponent with the full MiniMapNodeProps (issue #12)", async () => {
    const seen: MiniMapNodeProps[] = [];
    const CustomNode = (props: MiniMapNodeProps) => {
      seen.push(props);
      return <circle class="custom-mini-node" cx={props.x} cy={props.y} r={4} />;
    };

    const { container } = render(() => (
      <SolidFlow nodes={nodes} edges={[]} width={800} height={600}>
        <MiniMap nodeComponent={CustomNode} />
      </SolidFlow>
    ));
    await tick();

    expect(container.querySelectorAll(".custom-mini-node")).toHaveLength(2);
    expect(container.querySelectorAll(".solid-flow__minimap-node")).toHaveLength(0);

    const a = seen.find((p) => p.id === "a")!;
    expect(a).toBeDefined();
    expect({ x: a.x, y: a.y, width: a.width, height: a.height }).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
    expect(a.style).toMatchObject({ background: "rgb(255, 0, 0)" });
    expect(a.shapeRendering).toBeDefined();
  });
});
