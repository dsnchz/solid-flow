import { render } from "@solidjs/testing-library";
import { type JSX } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "~/components/SolidFlow";
import type { Node } from "~/types";

import { useColorMode } from "./useColorMode";
import { useEdges, useNodes, useViewport } from "./useGraph";
import { useNodesInitialized, useViewportInitialized } from "./useInitialized";
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
});
