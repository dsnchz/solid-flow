import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { useInternalSolidFlow } from "@/contexts";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

// Regression tests for the 2026-08-24 quality audit's Tier-1 findings
// (.agent/audit/2026-08-24-quality-audit.md). Each test failed against the
// pre-fix code.
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const renderProbed = (props: Record<string, unknown> = {}, nodes: Node[] = []) => {
  let internal!: ReturnType<typeof useInternalSolidFlow>;
  let api!: ReturnType<typeof useSolidFlow>;
  const Probe = () => {
    internal = useInternalSolidFlow();
    api = useSolidFlow();
    return null;
  };
  const rendered = render(() => (
    <SolidFlow defaultNodes={nodes} width={800} height={600} {...props}>
      <Probe />
    </SolidFlow>
  ));
  return {
    rendered,
    store: () => internal.store,
    nodeLookup: () => internal.nodeLookup,
    api: () => api,
  };
};

describe("audit fixes (Tier 1)", () => {
  it("A1: nodesConnectable is its own prop, not an alias of nodesDraggable", async () => {
    const { store } = renderProbed({ nodesConnectable: false, nodesDraggable: true });
    await tick();
    expect(store().nodesConnectable).toBe(false);
    expect(store().nodesDraggable).toBe(true);
  });

  it("A2: the flow id never leaks onto the DOM as an id attribute", async () => {
    const { rendered } = renderProbed();
    await tick();
    const wrapper = rendered.container.querySelector<HTMLElement>(
      '[data-testid="solid-flow__wrapper"]',
    )!;
    // The `id` prop names the flow instance (store.id), not the element —
    // defaulting it to "1" must not produce <div id="1"> on every flow.
    expect(wrapper.getAttribute("id")).toBeNull();
  });

  it("A3: computed node size wins over style width/height; style cannot defeat culling", async () => {
    const FAR_X = 5000;
    const { rendered } = renderProbed({}, [
      makeNode({ id: "sized", style: { width: "50px" } }),
      makeNode({
        id: "far",
        position: { x: FAR_X, y: 0 },
        style: { visibility: "visible" },
      }),
    ]);
    await tick();
    const container = rendered.container;

    // Explicit width prop (100) must beat style.width (50px).
    expect(container.querySelector<HTMLElement>('[data-id="sized"]')!.style.width).toBe("100px");
    // The CSS culling tier owns visibility; a user style must not resurrect
    // an off-viewport node.
    expect(container.querySelector<HTMLElement>('[data-id="far"]')!.style.visibility).toBe(
      "hidden",
    );
  });

  it("A4: programmatic deleteElements fires onDelete and the granular callbacks", async () => {
    const onDelete = vi.fn();
    const onNodesDelete = vi.fn();
    const { api } = renderProbed({ onDelete, onNodesDelete }, [makeNode({ id: "a" })]);
    await tick();

    await api().deleteElements({ nodes: [{ id: "a" }] });
    flush();
    await tick();

    expect(onNodesDelete).toHaveBeenCalledTimes(1);
    expect(onNodesDelete.mock.calls[0]![0]).toHaveLength(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0]![0].nodes).toHaveLength(1);
  });

  it("A5: screenToFlowPosition preserves fractional positions when snapping is off", async () => {
    const { api } = renderProbed();
    await tick();

    // No snapGrid configured: the guard must actually disable snapping
    // instead of rounding to a [1, 1] grid.
    const position = api().screenToFlowPosition({ x: 10.5, y: 20.25 });
    expect(position).toEqual({ x: 10.5, y: 20.25 });
  });

  it("A9 (contract pin): flow-level nodeExtent clamps the RENDERED position", async () => {
    // Extent clamps internals.positionAbsolute (the projection's job), never
    // the user's position data — upstream parity. The audit's A9 wiring fix
    // (the measure pass now receives store.nodeExtent) only aligns the
    // expandParent rect math with this same rule.
    const { nodeLookup, api } = renderProbed(
      {
        nodeExtent: [
          [0, 0],
          [300, 300],
        ],
      },
      [makeNode({ id: "out", position: { x: 900, y: 50 } })],
    );
    await tick();

    const internal = nodeLookup().get("out")!;
    expect(internal.internals.positionAbsolute.x).toBeLessThanOrEqual(300);
    // The user's data is untouched.
    expect(api().flow.nodes[0]!.position.x).toBe(900);
  });

  it("A8: getIntersectingNodes returns [] for an unknown node id instead of throwing", async () => {
    const { api } = renderProbed({}, [makeNode({ id: "a" })]);
    await tick();

    expect(api().getIntersectingNodes({ id: "does-not-exist" })).toEqual([]);
  });
});
