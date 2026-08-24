import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";

// Geometry: an 800x600 container at the default [0, 0, 1] transform gives a
// culling rect of [-400, 1200] x [-300, 900] (bucketed dims + 0.5 overscan,
// see core culling tests). FAR_X is safely outside it; nodes carry explicit
// width/height so the jsdom measurement stubs (setupTests.ts) measure them.
const FAR_X = 5000;

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const makeEdge = (overrides: Partial<Edge> & { id: string; source: string; target: string }) =>
  ({ ...overrides }) as Edge;

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const renderFlow = (props: {
  nodes: Node[];
  edges?: Edge[];
  onlyRenderVisibleElements?: boolean;
  probeRef?: (api: ReturnType<typeof useSolidFlow>) => void;
}) => {
  const Probe = () => {
    props.probeRef?.(useSolidFlow());
    return null;
  };

  return render(() => (
    <SolidFlow
      nodes={props.nodes}
      edges={props.edges ?? []}
      onlyRenderVisibleElements={props.onlyRenderVisibleElements}
      width={800}
      height={600}
    >
      <Probe />
    </SolidFlow>
  ));
};

describe("unmount culling (onlyRenderVisibleElements)", () => {
  it("default: off-viewport elements stay mounted, hidden by the CSS tier", async () => {
    const { container } = renderFlow({
      nodes: [makeNode({ id: "near" }), makeNode({ id: "far", position: { x: FAR_X, y: 0 } })],
    });
    await tick();

    const far = container.querySelector<HTMLElement>('[data-id="far"]');
    expect(far).not.toBeNull();
    expect(far!.style.visibility).toBe("hidden");
    expect(far!.style.pointerEvents).toBe("none");
    expect(container.querySelector<HTMLElement>('[data-id="near"]')!.style.visibility).toBe(
      "visible",
    );
  });

  it("opt-in: unmounts off-viewport nodes and edges, keeping the data graph intact", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const { container } = renderFlow({
      nodes: [
        makeNode({ id: "near" }),
        makeNode({ id: "farA", position: { x: FAR_X, y: 0 } }),
        makeNode({ id: "farB", position: { x: FAR_X + 200, y: 100 } }),
      ],
      edges: [
        makeEdge({ id: "eNear", source: "near", target: "farA" }),
        makeEdge({ id: "eFar", source: "farA", target: "farB" }),
      ],
      onlyRenderVisibleElements: true,
      probeRef: (a) => (api = a),
    });
    await tick();

    // Far nodes mounted once (measurement must not starve), then unmounted.
    expect(container.querySelector('[data-id="near"]')).not.toBeNull();
    expect(container.querySelector('[data-id="farA"]')).toBeNull();
    expect(container.querySelector('[data-id="farB"]')).toBeNull();

    // The near-anchored edge's segment box reaches the viewport; the far-only
    // edge is culled out of the DOM.
    expect(container.querySelector('.solid-flow__edge[data-id="eNear"]')).not.toBeNull();
    expect(container.querySelector('.solid-flow__edge[data-id="eFar"]')).toBeNull();

    // Rendering changed, the data graph did not.
    expect(api.flow.nodes).toHaveLength(3);
    expect(api.flow.edges).toHaveLength(2);
  });

  it("never unmounts selected elements", async () => {
    const { container } = renderFlow({
      nodes: [
        makeNode({ id: "near" }),
        makeNode({ id: "far", position: { x: FAR_X, y: 0 }, selected: true }),
      ],
      onlyRenderVisibleElements: true,
    });
    await tick();

    expect(container.querySelector('[data-id="far"]')).not.toBeNull();
  });

  it("never unmounts the node holding focus; releases it on focusout", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const { container } = renderFlow({
      nodes: [makeNode({ id: "a" })],
      onlyRenderVisibleElements: true,
      probeRef: (p) => (api = p),
    });
    await tick();

    const node = container.querySelector<HTMLElement>('[data-id="a"]')!;
    fireEvent.focusIn(node);
    api.updateNode("a", { position: { x: FAR_X, y: 0 } });
    await tick();

    // Off-viewport but focused: stays mounted (the CSS tier may still hide it).
    expect(container.querySelector('[data-id="a"]')).not.toBeNull();

    fireEvent.focusOut(node);
    await tick();
    expect(container.querySelector('[data-id="a"]')).toBeNull();
  });

  it("remounts nodes when the viewport reaches them, at their cached size", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const { container } = renderFlow({
      nodes: [makeNode({ id: "far", position: { x: FAR_X, y: 0 } })],
      onlyRenderVisibleElements: true,
      probeRef: (p) => (api = p),
    });
    await tick();
    expect(container.querySelector('[data-id="far"]')).toBeNull();

    await api.setViewport({ x: -4800, y: 0, zoom: 1 });
    await tick();

    const far = container.querySelector<HTMLElement>('[data-id="far"]');
    expect(far).not.toBeNull();
    // Cached measurement: visible immediately, no unmeasured flash.
    expect(far!.style.visibility).toBe("visible");
  });

  it("unobserves an unmounted node's element from the shared ResizeObserver", async () => {
    const unobserve = vi.spyOn(ResizeObserver.prototype, "unobserve");
    try {
      let api!: ReturnType<typeof useSolidFlow>;
      const { container } = renderFlow({
        nodes: [makeNode({ id: "a" })],
        onlyRenderVisibleElements: true,
        probeRef: (p) => (api = p),
      });
      await tick();

      const element = container.querySelector<HTMLElement>('[data-id="a"]')!;
      api.updateNode("a", { position: { x: FAR_X, y: 0 } });
      await tick();

      expect(container.querySelector('[data-id="a"]')).toBeNull();
      expect(unobserve).toHaveBeenCalledWith(element);
    } finally {
      unobserve.mockRestore();
    }
  });
});
