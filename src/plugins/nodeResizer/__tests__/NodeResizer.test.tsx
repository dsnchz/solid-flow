import { render } from "@solidjs/testing-library";
import type { XYResizer } from "@xyflow/system";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Node } from "@/types";

import { NodeResizeControl } from "../NodeResizeControl";
import { NodeResizer, type NodeResizerProps } from "../NodeResizer";

// The props contract of NodeResizer and its controls, pinned before their
// props handling changes (8 controls per resizable node). jsdom cannot drive
// XYResizer's d3-drag gesture, so the system boundary records what each
// control hands it: the latest update options per control element, and the
// destroy calls.
type XYResizerUpdateParams = Parameters<ReturnType<typeof XYResizer>["update"]>[0];

const resizer = vi.hoisted(() => ({
  options: new Map<Element, XYResizerUpdateParams>(),
  destroyed: 0,
}));

vi.mock("@xyflow/system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/system")>();
  return {
    ...actual,
    XYResizer: (params: Parameters<typeof actual.XYResizer>[0]) => ({
      update: (options: XYResizerUpdateParams) => resizer.options.set(params.domNode, options),
      destroy: () => {
        resizer.destroyed++;
      },
    }),
  };
});

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const node: Node = { id: "n", type: "resizable", position: { x: 0, y: 0 }, data: {} };

const renderResizer = async (Resizer: () => ReturnType<typeof NodeResizer>, zoom = 1) => {
  const result = render(() => (
    <SolidFlow
      nodes={[node]}
      nodeTypes={{ resizable: Resizer }}
      initialViewport={{ x: 0, y: 0, zoom }}
      width={800}
      height={600}
    />
  ));
  await tick();
  const controls = () =>
    Array.from(result.container.querySelectorAll<HTMLDivElement>(".solid-flow__resize-control"));
  // "top" is the top line, "top-left" the top-left handle
  const control = (position: string) => {
    const variant = position.includes("-") ? "handle" : "line";
    const parts = position.split("-");
    return controls().find(
      (el) => el.classList.contains(variant) && parts.every((part) => el.classList.contains(part)),
    )!;
  };
  return { ...result, controls, control };
};

describe("NodeResizer", () => {
  it("renders four lines and four handles with their variant and position classes", async () => {
    const { controls } = await renderResizer(() => <NodeResizer />);

    expect(controls().map((el) => el.getAttribute("class"))).toEqual([
      "solid-flow__resize-control line nodrag top",
      "solid-flow__resize-control line nodrag right",
      "solid-flow__resize-control line nodrag bottom",
      "solid-flow__resize-control line nodrag left",
      "solid-flow__resize-control handle nodrag top left",
      "solid-flow__resize-control handle nodrag top right",
      "solid-flow__resize-control handle nodrag bottom left",
      "solid-flow__resize-control handle nodrag bottom right",
    ]);
  });

  it("gives lineClass/lineStyle to the lines and handleClass/handleStyle to the handles", async () => {
    const { controls } = await renderResizer(() => (
      <NodeResizer
        lineClass="my-line"
        lineStyle={{ opacity: "0.5" }}
        handleClass="my-handle"
        handleStyle={{ opacity: "0.25" }}
      />
    ));

    const lines = controls().slice(0, 4);
    const handles = controls().slice(4);
    for (const line of lines) {
      expect(line.classList.contains("my-line")).toBe(true);
      expect(line.classList.contains("my-handle")).toBe(false);
      expect(line.style.opacity).toBe("0.5");
    }
    for (const handle of handles) {
      expect(handle.classList.contains("my-handle")).toBe(true);
      expect(handle.classList.contains("my-line")).toBe(false);
      expect(handle.style.opacity).toBe("0.25");
    }
  });

  it("renders nothing while not visible, and follows visible", async () => {
    const [visible, setVisible] = createSignal(false);
    const { controls } = await renderResizer(() => <NodeResizer visible={visible()} />);
    expect(controls()).toHaveLength(0);

    setVisible(true);
    flush();
    expect(controls()).toHaveLength(8);
  });

  it("scales handles against the zoom unless autoScale is off; lines never scale", async () => {
    const zoomedOut = await renderResizer(() => <NodeResizer />, 0.5);
    expect(zoomedOut.control("top-left").style.getPropertyValue("scale")).toBe("2");
    expect(zoomedOut.control("top").style.getPropertyValue("scale")).toBe("");
    zoomedOut.unmount();

    const fixed = await renderResizer(() => <NodeResizer autoScale={false} />, 0.5);
    expect(fixed.control("top-left").style.getPropertyValue("scale")).toBe("");
  });

  it("puts extra attributes on every control and follows them", async () => {
    const [label, setLabel] = createSignal("resize");
    const { controls } = await renderResizer(() => (
      <NodeResizer data-testid="ctl" aria-label={label()} />
    ));

    for (const el of controls()) {
      expect(el.getAttribute("data-testid")).toBe("ctl");
      expect(el.getAttribute("aria-label")).toBe("resize");
    }
    setLabel("grow");
    flush();
    for (const el of controls()) expect(el.getAttribute("aria-label")).toBe("grow");
  });

  it("hands XYResizer each control's position, the default boundaries and the callbacks", async () => {
    resizer.options.clear();
    const onResize = vi.fn();
    const { control } = await renderResizer(() => <NodeResizer onResize={onResize} />);

    const options = resizer.options.get(control("bottom-right"))!;
    expect(options.controlPosition).toBe("bottom-right");
    expect(options.boundaries).toEqual({
      minWidth: 10,
      minHeight: 10,
      maxWidth: Number.MAX_VALUE,
      maxHeight: Number.MAX_VALUE,
    });
    expect(options.keepAspectRatio).toBe(false);
    expect(options.onResize).toBe(onResize);
    expect(resizer.options.get(control("left"))!.controlPosition).toBe("left");
  });

  it("follows boundary and aspect-ratio props", async () => {
    resizer.options.clear();
    const [props, setProps] = createSignal<Partial<NodeResizerProps>>({ minWidth: 50 });
    const { control } = await renderResizer(() => (
      <NodeResizer minWidth={props().minWidth} keepAspectRatio={props().keepAspectRatio} />
    ));
    expect(resizer.options.get(control("top-left"))!.boundaries.minWidth).toBe(50);

    setProps({ minWidth: 80, keepAspectRatio: true });
    flush();
    const options = resizer.options.get(control("top-left"))!;
    expect(options.boundaries.minWidth).toBe(80);
    expect(options.keepAspectRatio).toBe(true);
  });

  it("destroys every control's XYResizer on unmount", async () => {
    const { unmount } = await renderResizer(() => <NodeResizer />);
    const before = resizer.destroyed;
    unmount();
    expect(resizer.destroyed - before).toBe(8);
  });
});

describe("NodeResizeControl on its own", () => {
  it("defaults to a bottom-right handle, or a right line, and renders its children", async () => {
    const { controls } = await renderResizer(() => (
      <>
        <NodeResizeControl>
          <span class="grip" />
        </NodeResizeControl>
        <NodeResizeControl variant="line" class="mine" style={{ opacity: "0.5" }} />
      </>
    ));

    expect(controls()[0]!.getAttribute("class")).toBe(
      "solid-flow__resize-control handle nodrag bottom right",
    );
    expect(controls()[0]!.querySelector(".grip")).not.toBeNull();
    expect(controls()[1]!.getAttribute("class")).toBe(
      "solid-flow__resize-control line nodrag right mine",
    );
    expect(controls()[1]!.style.opacity).toBe("0.5");
  });
});
