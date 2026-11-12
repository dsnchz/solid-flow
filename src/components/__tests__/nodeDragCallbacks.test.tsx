import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
});

type Call = { name: string; target: string | null; nodes: string[] };

/**
 * A d3-drag gesture in jsdom: mousedown on the element, moves and mouseup on
 * its window. d3-drag listens on `event.view`, which fireEvent leaves null.
 */
const dragElement = (el: Element) => {
  const view = el.ownerDocument.defaultView!;
  const mouse = (target: EventTarget, type: string, clientX: number, clientY: number) => {
    const event = new view.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
    // jsdom rejects its own window as `view` in the init dictionary.
    Object.defineProperty(event, "view", { value: view });
    target.dispatchEvent(event);
  };
  mouse(el, "mousedown", 50, 20);
  mouse(view, "mousemove", 80, 30);
  mouse(view, "mousemove", 120, 40);
  mouse(view, "mouseup", 120, 40);
};

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
    await tick();

    dragElement(container.querySelector('.solid-flow__node[data-id="a"]')!);
    await tick();

    expect(calls.map((c) => c.name)).toEqual(["start", "drag", "stop"]);
    for (const call of calls) expect(call).toMatchObject({ target: "a", nodes: ["a"] });
  });

  it("a drag of the selection box reports no target and every selected node", async () => {
    const { calls, container, internal } = renderRecorded();
    await tick();
    internal().actions.addSelectedNodes(["a", "b"]);
    internal().actions.setSelectionRectMode("nodes");
    flush();
    await tick();

    const box = container.querySelector(".solid-flow__selection-wrapper");
    expect(box).not.toBeNull();
    dragElement(box!);
    await tick();

    expect(calls.map((c) => c.name)).toEqual(["start", "drag", "stop"]);
    for (const call of calls) expect(call).toMatchObject({ target: null, nodes: ["a", "b"] });
  });
});
