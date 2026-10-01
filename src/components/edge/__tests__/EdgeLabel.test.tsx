import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { EdgeProps, Node } from "@/types";

import { EdgeLabel } from "../EdgeLabel";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
});

// The public EdgeLabel contract, pinned before its props handling changes:
// skip-undefined defaults, the flow-owned style keys around the user's
// style, the class list, extra attributes on the element, and click-select.
const renderLabel = async (Label: (props: EdgeProps) => ReturnType<typeof EdgeLabel>) => {
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => ((api = useSolidFlow()), null);
  const { container } = render(() => (
    <SolidFlow
      defaultNodes={[makeNode("a", 0), makeNode("b", 300)]}
      defaultEdges={[{ id: "e1", source: "a", target: "b", type: "labelled" }]}
      edgeTypes={{ labelled: Label }}
      width={800}
      height={600}
    >
      <Probe />
    </SolidFlow>
  ));
  await tick();
  const label = () => container.querySelector<HTMLElement>(".solid-flow__edge-label")!;
  return { api: () => api, label };
};

describe("EdgeLabel", () => {
  it("defaults x/y to 0 (also for explicit undefined) and renders no size", async () => {
    const { label } = await renderLabel(() => <EdgeLabel x={undefined}>text</EdgeLabel>);
    expect(label().textContent).toBe("text");
    expect(label().style.transform).toBe("translate(-50%, -50%) translate(0px,0px)");
    expect(label().style.width).toBe("");
    expect(label().style.pointerEvents).toBe("all");
    expect(label().getAttribute("role")).toBe("button");
    expect(label().getAttribute("tabindex")).toBe("-1");
  });

  it("applies position, size, class, transparent, and the user's style over the flow's", async () => {
    const [x, setX] = createSignal(10);
    const { label } = await renderLabel(() => (
      <EdgeLabel
        x={x()}
        y={20}
        width={80}
        height={30}
        transparent
        class="mine"
        style={{ color: "red", cursor: "help" }}
      >
        text
      </EdgeLabel>
    ));
    expect(label().style.transform).toContain("translate(10px,20px)");
    expect(label().style.width).toBe("80px");
    expect(label().style.height).toBe("30px");
    expect(label().classList.contains("solid-flow__edge-label")).toBe(true);
    expect(label().classList.contains("transparent")).toBe(true);
    expect(label().classList.contains("mine")).toBe(true);
    expect(label().style.color).toBe("red");
    expect(label().style.cursor).toBe("help");

    setX(40);
    await tick();
    expect(label().style.transform).toContain("translate(40px,20px)");
  });

  it("puts extra attributes on the element, reactively", async () => {
    const [title, setTitle] = createSignal("one");
    const { label } = await renderLabel(() => (
      <EdgeLabel data-testid="lbl" title={title()}>
        text
      </EdgeLabel>
    ));
    expect(label().getAttribute("data-testid")).toBe("lbl");
    expect(label().getAttribute("title")).toBe("one");
    setTitle("two");
    await tick();
    expect(label().getAttribute("title")).toBe("two");
  });

  it("selects its edge on click only with selectEdgeOnClick", async () => {
    // Svelte Flow parity (1.x and 2.0): the label is moved into the label
    // layer, so a click bubbles through the DOM there and never reaches the
    // edge; `selectEdgeOnClick` is what selects.
    const [selectOnClick, setSelectOnClick] = createSignal(false);
    const { api, label } = await renderLabel(() => (
      <EdgeLabel selectEdgeOnClick={selectOnClick()}>text</EdgeLabel>
    ));
    expect(label().style.cursor).toBe("");
    fireEvent.click(label());
    await tick();
    expect(api().flow.selection.edges).toHaveLength(0);

    setSelectOnClick(true);
    await tick();
    expect(label().style.cursor).toBe("pointer");
    fireEvent.click(label());
    await tick();
    expect(api().flow.selection.edges.map((e) => e.id)).toEqual(["e1"]);
  });

  it("lives in the flow's label layer and leaves it when the label unmounts", async () => {
    const [show, setShow] = createSignal(true);
    const { label } = await renderLabel(() => <>{show() ? <EdgeLabel>text</EdgeLabel> : null}</>);
    expect(label().parentElement?.classList.contains("solid-flow__edge-labels")).toBe(true);
    setShow(false);
    await tick();
    expect(label()).toBeNull();
  });
});
