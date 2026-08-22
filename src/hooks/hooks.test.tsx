import { render } from "@solidjs/testing-library";
import type { JSX } from "@solidjs/web";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "~/components/SolidFlow";
import type { Node } from "~/types";

import { useColorMode } from "./useColorMode";
import { useEdges, useNodes, useViewport } from "./useGraph";
import { useNodesInitialized, useViewportInitialized } from "./useInitialized";
import { useNodeConnections } from "./useNodeConnections";
import { useSolidFlow } from "./useSolidFlow";

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const renderWithFlow = (
  Probe: () => JSX.Element,
  props: { nodes?: Node[]; colorMode?: "light" | "dark" } = {},
) =>
  render(() => (
    <SolidFlow
      nodes={props.nodes ?? [makeNode({ id: "a" })]}
      edges={[]}
      colorMode={props.colorMode}
      width={800}
      height={600}
    >
      <Probe />
    </SolidFlow>
  ));

describe("useSolidFlow: { flow, commands }", () => {
  it("returns stable flow/commands identities with the commands spread as aliases", async () => {
    let checked = false;

    renderWithFlow(() => {
      const api = useSolidFlow();
      const again = useSolidFlow();

      // stable identities: safe to destructure anywhere in the tree
      expect(api.flow).toBe(again.flow);
      expect(api.commands).toBe(again.commands);
      // top-level aliases ARE the commands
      expect(api.fitView).toBe(api.commands.fitView);
      expect(api.updateNode).toBe(api.commands.updateNode);
      expect(api.setNodes).toBe(api.commands.setNodes);
      checked = true;
      return null;
    });
    await tick();

    expect(checked).toBe(true);
  });

  it("flow reads and commands writes round-trip; deprecated getters still work", async () => {
    let api!: ReturnType<typeof useSolidFlow>;

    renderWithFlow(() => {
      api = useSolidFlow();
      return null;
    });
    await tick();

    api.commands.updateNodeData("a", { label: "updated" });
    await tick();

    expect(api.flow.internalNodes.a?.data).toMatchObject({ label: "updated" });
    // deprecated aliases keep working through the deprecation cycle
    expect(api.getNode("a")?.data).toMatchObject({ label: "updated" });
    expect(api.getNodes().map((n) => n.id)).toEqual(["a"]);
    expect(api.getViewport()).toEqual(api.flow.viewport);
    expect(api.getZoom()).toBe(api.flow.viewport.zoom);
    expect(api.getInternalNode("a")).toBe(api.flow.internalNodes.a);
  });
});

describe("hooks", () => {
  it("useNodes and useEdges expose the graph reactively", async () => {
    let probedIds: string[] = [];

    renderWithFlow(() => {
      const nodes = useNodes();
      const edges = useEdges();
      probedIds = nodes().map((n) => n.id);
      expect(edges()).toHaveLength(0);
      return null;
    });
    await tick();

    expect(probedIds).toEqual(["a"]);
  });

  it("useViewport exposes the current viewport", async () => {
    const probe = vi.fn();

    renderWithFlow(() => {
      const viewport = useViewport();
      probe(viewport());
      return null;
    });
    await tick();

    expect(probe).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), zoom: 1 }),
    );
  });

  it("useColorMode resolves the configured color mode", async () => {
    let mode: string | undefined;

    renderWithFlow(
      () => {
        const colorMode = useColorMode();
        mode = colorMode();
        return null;
      },
      { colorMode: "dark" },
    );
    await tick();

    expect(mode).toBe("dark");
  });

  it("useNodesInitialized flips true once nodes are measured", async () => {
    const states: boolean[] = [];
    let read: (() => boolean) | undefined;

    renderWithFlow(() => {
      const initialized = useNodesInitialized();
      states.push(initialized());
      read = initialized;
      return null;
    });

    expect(states[0]).toBe(false);
    await tick();
    expect(read!()).toBe(true);
  });

  it("useViewportInitialized flips true once the pan/zoom instance mounts", async () => {
    let read: (() => boolean) | undefined;

    renderWithFlow(() => {
      const initialized = useViewportInitialized();
      read = initialized;
      return null;
    });
    await tick();

    expect(read!()).toBe(true);
  });

  it("useSolidFlow exposes graph helpers", async () => {
    let helpers: ReturnType<typeof useSolidFlow> | undefined;

    renderWithFlow(() => {
      helpers = useSolidFlow();
      return null;
    });
    await tick();

    expect(helpers!.getNode("a")?.id).toBe("a");
    expect(helpers!.getNodes().map((n) => n.id)).toEqual(["a"]);
    expect(helpers!.getEdges()).toHaveLength(0);
  });

  it("useNodeConnections tracks connections for a node as edges come and go", async () => {
    let connections!: ReturnType<typeof useNodeConnections>;
    let flow!: ReturnType<typeof useSolidFlow>;

    render(() => (
      <SolidFlow
        nodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 100 } })]}
        edges={[]}
        width={800}
        height={600}
      >
        {(() => {
          const Probe = () => {
            connections = useNodeConnections(() => ({ id: "a" }));
            flow = useSolidFlow();
            return null;
          };
          return <Probe />;
        })()}
      </SolidFlow>
    ));
    await tick();
    expect(connections()).toHaveLength(0);

    flow.addEdges({ id: "e1", source: "a", target: "b" });
    await tick();
    expect(connections()).toHaveLength(1);
    expect(connections()[0]).toMatchObject({ source: "a", target: "b", edgeId: "e1" });

    await flow.deleteElements({ edges: [{ id: "e1" }] });
    await tick();
    expect(connections()).toHaveLength(0);
  });

  it("throws a descriptive error when used outside <SolidFlow>", () => {
    // 2.0 regression guard: contexts created with an undefined default throw
    // ContextNotFoundError on read, before our guard runs — the null sentinel
    // keeps the library's own error message reachable.
    createRoot((dispose) => {
      expect(() => useSolidFlow()).toThrow(/wrapped with <SolidFlow>/);
      expect(() => useNodes()()).toThrow(/wrapped with <SolidFlow>/);
      dispose();
    });
  });
});
