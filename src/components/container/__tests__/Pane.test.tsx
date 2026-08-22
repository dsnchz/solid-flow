import { render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "~/components/SolidFlow";
import type { Node } from "~/types";

import type { PaneProps } from "../Pane";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const pointerInit = (x: number, y: number, extra: PointerEventInit = {}): PointerEventInit => ({
  bubbles: true,
  cancelable: true,
  pointerId: 1,
  isPrimary: true,
  button: 0,
  clientX: x,
  clientY: y,
  pointerType: "mouse",
  shiftKey: true,
  ...extra,
});

const pressShift = () =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
const releaseShift = () =>
  window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));

const renderSelectableFlow = (paneProps: Partial<PaneProps> = {}) =>
  render(() => (
    <SolidFlow
      nodes={[
        makeNode({ id: "a", position: { x: 20, y: 20 } }),
        makeNode({ id: "far", position: { x: 400, y: 400 } }),
      ]}
      edges={[]}
      width={800}
      height={600}
      // auto-pan reads container bounds, which jsdom reports as 0x0 — it would
      // treat every position as "near the edge" and pan forever. Disable for
      // deterministic assertions; the auto-pan math itself is upstream-owned.
      autoPanOnSelection={false}
      onSelectionStart={paneProps.onSelectionStart}
      onSelectionEnd={paneProps.onSelectionEnd}
    />
  ));

const dragSelect = (pane: HTMLElement, from: [number, number], to: [number, number]) => {
  pressShift();
  pane.dispatchEvent(new PointerEvent("pointerdown", pointerInit(...from)));
  const [fx, fy] = from;
  const [tx, ty] = to;
  const midpoint: [number, number] = [(fx + tx) / 2, (fy + ty) / 2];
  pane.dispatchEvent(new PointerEvent("pointermove", pointerInit(...midpoint)));
  pane.dispatchEvent(new PointerEvent("pointermove", pointerInit(...to)));
  pane.dispatchEvent(new PointerEvent("pointerup", pointerInit(...to, { buttons: 0 })));
  releaseShift();
};

describe("Pane drag selection", () => {
  it("selects nodes inside the selection rectangle", async () => {
    const onSelectionStart = vi.fn();
    const onSelectionEnd = vi.fn();
    const { container } = renderSelectableFlow({ onSelectionStart, onSelectionEnd });
    await tick();

    const pane = container.querySelector<HTMLElement>(".solid-flow__pane")!;
    dragSelect(pane, [5, 5], [200, 150]);
    await tick();

    expect(container.querySelector<HTMLElement>('[data-id="a"]')!.classList).toContain("selected");
    expect(container.querySelector<HTMLElement>('[data-id="far"]')!.classList).not.toContain(
      "selected",
    );
    expect(onSelectionStart).toHaveBeenCalledTimes(1);
    expect(onSelectionEnd).toHaveBeenCalledTimes(1);
  });

  it("shows the nodes selection box after selecting", async () => {
    const { container } = renderSelectableFlow();
    await tick();

    const pane = container.querySelector<HTMLElement>(".solid-flow__pane")!;
    dragSelect(pane, [5, 5], [200, 150]);
    await tick();

    expect(container.querySelector(".solid-flow__selection-wrapper")).not.toBeNull();
  });

  it("selects nothing when the rectangle covers empty space", async () => {
    const { container } = renderSelectableFlow();
    await tick();

    const pane = container.querySelector<HTMLElement>(".solid-flow__pane")!;
    dragSelect(pane, [200, 200], [300, 300]);
    await tick();

    expect(container.querySelectorAll(".solid-flow__node.selected")).toHaveLength(0);
    expect(container.querySelector(".solid-flow__selection-wrapper")).toBeNull();
  });

  it("prefers touch panning over drag selection when panOnDrag is button-specific", async () => {
    // upstream xyflow#5918: selectionOnDrag + mouse-button-specific panOnDrag
    const { container } = render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a", position: { x: 20, y: 20 } })]}
        edges={[]}
        width={800}
        height={600}
        selectionOnDrag
        panOnDrag={[1, 2]}
        autoPanOnSelection={false}
      />
    ));
    await tick();

    const pane = container.querySelector<HTMLElement>(".solid-flow__pane")!;

    // a mouse drag (over empty space) starts a selection rectangle...
    const mouse = (x: number, y: number): PointerEventInit =>
      pointerInit(x, y, { shiftKey: false });
    pane.dispatchEvent(new PointerEvent("pointerdown", mouse(200, 200)));
    pane.dispatchEvent(new PointerEvent("pointermove", mouse(320, 300)));
    await tick();
    expect(container.querySelector(".solid-flow__selection")).not.toBeNull();
    pane.dispatchEvent(new PointerEvent("pointerup", mouse(320, 300)));
    await tick();
    expect(container.querySelector(".solid-flow__selection")).toBeNull();

    // ...but the same gesture from a touch pointer defers to panning
    const touch = (x: number, y: number): PointerEventInit =>
      pointerInit(x, y, { shiftKey: false, pointerType: "touch" });
    pane.dispatchEvent(new PointerEvent("pointerdown", touch(200, 200)));
    pane.dispatchEvent(new PointerEvent("pointermove", touch(320, 300)));
    await tick();
    expect(container.querySelector(".solid-flow__selection")).toBeNull();
  });
});
