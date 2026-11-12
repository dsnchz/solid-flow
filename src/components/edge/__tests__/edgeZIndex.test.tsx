import { render } from "@solidjs/testing-library";
import type { ZIndexMode } from "@xyflow/system";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { settle } from "@/__tests__/settle";
import { cx } from "@/components/internal/dom";
import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Node } from "@/types";

// cx passes through, counted: how often an edge's class is rebuilt.
vi.mock("@/components/internal/dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/internal/dom")>();
  return { ...actual, cx: vi.fn(actual.cx) };
});
const edgeClassBuilds = () =>
  vi.mocked(cx).mock.calls.filter((args) => args[0] === "solid-flow__edge").length;

const makeNode = (id: string, x: number): Node => ({
  id,
  position: { x, y: 0 },
  data: {},
  width: 100,
  height: 40,
});

// The edge's DRAWN z-index is upstream's getElevatedEdgeZIndex: its own z,
// plus its endpoints' when one is selected and edges elevate on select. The
// endpoint part is added in EdgeWrapper, not in the edge row (round 65).
describe("edge z-index", () => {
  const renderFlow = async (
    elevateEdgesOnSelect?: () => boolean | undefined,
    options: { nodes?: Node[]; zIndexMode?: ZIndexMode } = {},
  ) => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => ((api = useSolidFlow()), null);
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={options.nodes ?? [makeNode("a", 0), makeNode("b", 300)]}
        defaultEdges={[{ id: "e1", source: "a", target: "b", zIndex: 2 }]}
        elevateEdgesOnSelect={elevateEdgesOnSelect?.()}
        zIndexMode={options.zIndexMode}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await settle();
    const wrapperZ = () =>
      container.querySelector<SVGElement>('.solid-flow__edge[data-id="e1"]')!.closest("svg")!.style
        .zIndex;
    return { api: () => api, wrapperZ };
  };

  it("rises with a selected endpoint, and falls back when it is deselected", async () => {
    const { api, wrapperZ } = await renderFlow();
    expect(wrapperZ()).toBe("2");

    api().commands.updateNode("a", { selected: true });
    await settle();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);

    api().commands.updateNode("a", { selected: false });
    await settle();
    expect(wrapperZ()).toBe("2");
  });

  it("redraws only the z: the edge's attributes are not rebuilt", async () => {
    const { api, wrapperZ } = await renderFlow();
    const builds = edgeClassBuilds();

    api().commands.updateNode("a", { selected: true });
    await settle();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);
    expect(edgeClassBuilds()).toBe(builds);
  });

  it("stays at the edge's own z without elevateEdgesOnSelect", async () => {
    const { api, wrapperZ } = await renderFlow(() => false);
    api().commands.updateNode("a", { selected: true });
    await settle();
    expect(wrapperZ()).toBe("2");
  });

  it("follows elevateEdgesOnSelect when it changes at runtime", async () => {
    const [elevate, setElevate] = createSignal(true);
    const { api, wrapperZ } = await renderFlow(elevate);
    api().commands.updateNode("a", { selected: true });
    await settle();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);

    setElevate(false);
    await settle();
    expect(wrapperZ()).toBe("2");

    setElevate(true);
    await settle();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);
  });

  it("ignores a selected endpoint in manual zIndexMode", async () => {
    const { api, wrapperZ } = await renderFlow(undefined, { zIndexMode: "manual" });
    api().commands.updateNode("a", { selected: true });
    await settle();
    expect(wrapperZ()).toBe("2");
  });

  it("adds a child endpoint's z without a selection", async () => {
    const parent: Node = { ...makeNode("p", 0), zIndex: 5 };
    const child: Node = { ...makeNode("a", 10), parentId: "p" };
    const { api, wrapperZ } = await renderFlow(undefined, {
      nodes: [parent, child, makeNode("b", 300)],
    });
    const childZ = api().flow.internalNodes.a!.internals.z;
    expect(childZ).toBeGreaterThan(5);
    expect(Number(wrapperZ())).toBe(2 + childZ);
  });

  it("follows an endpoint that is deleted and added again", async () => {
    const { api, wrapperZ } = await renderFlow();
    await api().commands.deleteElements({ nodes: [{ id: "a" }] });
    await settle();
    // deleteElements cascades the edge: both come back, the edge over the
    // node's new row
    api().commands.addNodes({ ...makeNode("a", 0), selected: true });
    api().commands.addEdges({ id: "e1", source: "a", target: "b", zIndex: 2 });
    await settle();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);

    api().commands.updateNode("a", { selected: false });
    await settle();
    expect(wrapperZ()).toBe("2");

    api().commands.updateNode("a", { selected: true });
    await settle();
    expect(Number(wrapperZ())).toBeGreaterThanOrEqual(1002);
  });
});
