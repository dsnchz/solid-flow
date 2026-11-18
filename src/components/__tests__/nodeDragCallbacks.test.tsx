import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { settle } from "@/__tests__/settle";
import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

type Call = { name: string; target: string | null; nodes: string[] };

/**
 * A d3-drag gesture in jsdom: mousedown at the first point, moves through the
 * rest, mouseup at the last, then the click the browser dispatches after a
 * release over the element; all on the element. They bubble to its window,
 * where d3-drag listens (`event.view`, which fireEvent leaves null). A real
 * event always targets a node: XYDrag 1.0 asks the element whether it
 * contains the mouseup's target.
 */
const gesture = (el: Element, points: readonly (readonly [number, number])[]) => {
  const view = el.ownerDocument.defaultView!;
  const mouse = (type: string, [clientX, clientY]: readonly [number, number]) => {
    const event = new view.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
    // jsdom rejects its own window as `view` in the init dictionary.
    Object.defineProperty(event, "view", { value: view });
    el.dispatchEvent(event);
  };
  const last = points[points.length - 1]!;
  mouse("mousedown", points[0]!);
  for (const point of points.slice(1)) mouse("mousemove", point);
  mouse("mouseup", last);
  mouse("click", last);
};

const dragElement = (el: Element) =>
  gesture(el, [
    [50, 20],
    [80, 30],
    [120, 40],
  ]);

// The three node-drag callbacks receive the user node that was grabbed (null
// for a drag of the multi-selection box) and the dragged nodes; `onNodeDrag`
// fires per move.
describe("node drag callbacks", () => {
  const renderRecorded = () => {
    const calls: Call[] = [];
    const record =
      (name: string) =>
      ({ targetNode, nodes }: { targetNode: Node | null; nodes: Node[] }) =>
        calls.push({ name, target: targetNode?.id ?? null, nodes: nodes.map((n) => n.id) });
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      return null;
    };
    const rendered = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
        width={800}
        height={600}
        onNodeDragStart={record("start")}
        onNodeDrag={record("drag")}
        onNodeDragStop={record("stop")}
      >
        <Probe />
      </SolidFlow>
    ));
    return { calls, container: rendered.container, internal: () => internal };
  };

  it("a node drag reports the grabbed node as the target", async () => {
    const { calls, container } = renderRecorded();
    await settle();

    dragElement(container.querySelector('.solid-flow__node[data-id="a"]')!);
    await settle();

    expect(calls.map((c) => c.name)).toEqual(["start", "drag", "stop"]);
    for (const call of calls) expect(call).toMatchObject({ target: "a", nodes: ["a"] });
  });

  it("a drag of the selection box reports no target and every selected node", async () => {
    const { calls, container, internal } = renderRecorded();
    await settle();
    internal().actions.addSelectedNodes(["a", "b"]);
    internal().actions.setSelectionRectMode("nodes");
    await settle();

    const box = container.querySelector(".solid-flow__selection-wrapper");
    expect(box).not.toBeNull();
    dragElement(box!);
    await settle();

    expect(calls.map((c) => c.name)).toEqual(["start", "drag", "stop"]);
    for (const call of calls) expect(call).toMatchObject({ target: null, nodes: ["a", "b"] });
  });
});

// @xyflow/system 1.0 (nodeClickDistance removed): a node click is swallowed
// only after a drag that actually moved nodes, whatever the pointer did.
describe("node click after a pointer gesture", () => {
  const renderClicks = () => {
    const onNodeClick = vi.fn();
    const rendered = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0)]}
        width={800}
        height={600}
        onNodeClick={onNodeClick}
      />
    ));
    return {
      onNodeClick,
      node: () => rendered.container.querySelector('.solid-flow__node[data-id="a"]')!,
    };
  };

  it("fires after a jitter under the drag threshold", async () => {
    const { onNodeClick, node } = renderClicks();
    await settle();

    gesture(node(), [
      [50, 20],
      [50.5, 20],
    ]);
    await settle();

    expect(onNodeClick).toHaveBeenCalledTimes(1);
  });

  it("is swallowed after a drag that moved the node", async () => {
    const { onNodeClick, node } = renderClicks();
    await settle();

    dragElement(node());
    await settle();

    expect(onNodeClick).not.toHaveBeenCalled();
  });
});
