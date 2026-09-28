import { render } from "@solidjs/testing-library";
import type { XYResizerChange, XYResizerChildChange } from "@xyflow/system";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { NodeResizer } from "../NodeResizer";

// jsdom cannot drive XYResizer's d3-drag gesture, so the system boundary is
// replaced: each control's `onChange` is captured and fed the change shapes
// the real XYResizer emits (x/y set together on a top/left resize, children
// repositioned with `position` only).
const resizer = vi.hoisted(() => ({
  onChange: new Map<string, (change: XYResizerChange, children: XYResizerChildChange[]) => void>(),
}));

vi.mock("@xyflow/system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/system")>();
  return {
    ...actual,
    XYResizer: (params: Parameters<typeof actual.XYResizer>[0]) => {
      resizer.onChange.set(params.nodeId, params.onChange);
      return { update: () => {}, destroy: () => {} };
    },
  };
});

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const ResizableNode = () => <NodeResizer />;

const renderFlow = async (nodes: Node[]) => {
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => ((api = useSolidFlow()), null);
  render(() => (
    <SolidFlow nodes={nodes} nodeTypes={{ resizable: ResizableNode }} width={800} height={600}>
      <Probe />
    </SolidFlow>
  ));
  await tick();
  const node = (id: string) => api.flow.nodes.find((n) => n.id === id)!;
  return { node };
};

describe("NodeResizeControl onChange", () => {
  it("keeps a repositioned child's size when its parent resizes from the top-left", async () => {
    const { node } = await renderFlow([
      {
        id: "p",
        type: "resizable",
        position: { x: 100, y: 100 },
        data: {},
        width: 200,
        height: 200,
      },
      { id: "c", parentId: "p", position: { x: 10, y: 10 }, data: {}, width: 50, height: 30 },
    ]);

    resizer.onChange.get("p")!({ x: 80, y: 90, width: 220, height: 210 }, [
      { id: "c", position: { x: 30, y: 20 } },
    ]);
    await tick();

    expect(node("c").position).toEqual({ x: 30, y: 20 });
    expect(node("c").width).toBe(50);
    expect(node("c").height).toBe(30);
    expect(node("p").position).toEqual({ x: 80, y: 90 });
    expect(node("p").width).toBe(220);
    expect(node("p").height).toBe(210);
  });

  it("moves a node whose new position has a zero coordinate", async () => {
    const { node } = await renderFlow([
      { id: "a", type: "resizable", position: { x: 50, y: 0 }, data: {}, width: 100, height: 40 },
      { id: "b", type: "resizable", position: { x: 20, y: 60 }, data: {}, width: 100, height: 40 },
    ]);

    // Left-edge resize of a node on the y = 0 line: y stays 0.
    resizer.onChange.get("a")!({ x: 30, y: 0, width: 120, height: 40 }, []);
    // Top-left resize that lands exactly on the x = 0 line.
    resizer.onChange.get("b")!({ x: 0, y: 50, width: 120, height: 50 }, []);
    await tick();

    expect(node("a").position).toEqual({ x: 30, y: 0 });
    expect(node("a").width).toBe(120);
    expect(node("b").position).toEqual({ x: 0, y: 50 });
    expect(node("b").width).toBe(120);
    expect(node("b").height).toBe(50);
  });

  it("leaves nodes the change does not name untouched", async () => {
    const { node } = await renderFlow([
      { id: "a", type: "resizable", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
      { id: "z", position: { x: 300, y: 300 }, data: {}, width: 70, height: 20 },
    ]);

    resizer.onChange.get("a")!({ width: 140, height: 60 }, []);
    await tick();

    expect(node("a").position).toEqual({ x: 0, y: 0 });
    expect(node("a").width).toBe(140);
    expect(node("a").height).toBe(60);
    expect(node("z").position).toEqual({ x: 300, y: 300 });
    expect(node("z").width).toBe(70);
    expect(node("z").height).toBe(20);
  });
});
