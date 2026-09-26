import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import { Handle } from "../handle";
import { SolidFlow } from "../SolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number, type?: string): Node => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  width: 100,
  height: 40,
  ...(type ? { type } : {}),
});

/**
 * Handle is the public connection point custom nodes place themselves:
 * extra props reach the element as attributes (and stay reactive), the
 * defaults hold, and the flow's own attributes are not overridable.
 */
describe("Handle", () => {
  it("renders a source handle at the top with its connectable defaults", async () => {
    const PlainNode = () => <Handle type="source" position="top" />;
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0, "plain")]}
        edges={[]}
        nodeTypes={{ plain: PlainNode }}
        width={800}
        height={600}
      />
    ));
    await tick();
    const handle = container.querySelector<HTMLElement>(".solid-flow__handle")!;
    expect(handle).not.toBeNull();
    expect(handle.classList.contains("solid-flow__handle-top")).toBe(true);
    expect(handle.classList.contains("source")).toBe(true);
    expect(handle.classList.contains("connectablestart")).toBe(true);
    expect(handle.classList.contains("connectableend")).toBe(true);
    expect(handle.getAttribute("data-handlepos")).toBe("top");
    expect(handle.getAttribute("data-nodeid")).toBe("a");
    expect(handle.getAttribute("data-handleid")).toBeNull();
    expect(handle.getAttribute("role")).toBe("button");
    expect(handle.getAttribute("tabindex")).toBe("-1");
  });

  it("passes extra attributes and event props through to the element, reactively", async () => {
    const [title, setTitle] = createSignal("first");
    const entered: string[] = [];
    const TitledNode = () => (
      <Handle
        type="target"
        position="left"
        id="in"
        class="custom-handle"
        style={{ width: "12px" }}
        title={title()}
        data-testid="handle-in"
        onMouseEnter={() => entered.push("in")}
      />
    );
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0, "titled")]}
        edges={[]}
        nodeTypes={{ titled: TitledNode }}
        width={800}
        height={600}
      />
    ));
    await tick();
    const handle = container.querySelector<HTMLElement>('[data-testid="handle-in"]')!;
    expect(handle).not.toBeNull();
    expect(handle.classList.contains("solid-flow__handle")).toBe(true);
    expect(handle.classList.contains("solid-flow__handle-left")).toBe(true);
    expect(handle.classList.contains("custom-handle")).toBe(true);
    expect(handle.classList.contains("target")).toBe(true);
    expect(handle.style.width).toBe("12px");
    expect(handle.getAttribute("title")).toBe("first");
    expect(handle.getAttribute("data-handleid")).toBe("in");
    expect(handle.getAttribute("data-id")).toMatch(/-a-in-target$/);

    setTitle("second");
    await tick();
    expect(handle.getAttribute("title")).toBe("second");

    fireEvent.mouseEnter(handle);
    expect(entered).toEqual(["in"]);
  });

  it("keeps the flow's own attributes over a colliding extra prop", async () => {
    const ClashNode = () => <Handle type="source" position="top" data-nodeid="not-me" role="img" />;
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode("a", 0, "clash")]}
        edges={[]}
        nodeTypes={{ clash: ClashNode }}
        width={800}
        height={600}
      />
    ));
    await tick();
    const handle = container.querySelector<HTMLElement>(".solid-flow__handle")!;
    expect(handle.getAttribute("data-nodeid")).toBe("a");
    expect(handle.getAttribute("role")).toBe("button");
  });
});
