import { render } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { Edge, Node } from "@/types";

import { SolidFlow } from "../SolidFlow";
import { SolidFlowProvider } from "../SolidFlowProvider";

// The uncontrolled contract (React Flow parity): `defaultNodes`/`defaultEdges`
// seed flow-OWNED stores once. The flow owns membership — commands and
// connections write through and persist (there is no controlled re-seed to
// clobber them), and the default arrays are initial-only.
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: { label: `node-${overrides.id}` },
  width: 100,
  height: 40,
  ...overrides,
});

describe("uncontrolled flows (defaultNodes/defaultEdges)", () => {
  it("renders from defaultNodes/defaultEdges without nodes/edges props", async () => {
    const { container } = render(() => (
      <SolidFlow
        defaultNodes={[makeNode({ id: "a" }), makeNode({ id: "b", position: { x: 200, y: 0 } })]}
        defaultEdges={[{ id: "e1", source: "a", target: "b" }]}
        width={800}
        height={600}
      />
    ));
    await tick();

    expect(container.querySelector('[data-id="a"]')).not.toBeNull();
    expect(container.querySelector('[data-id="b"]')).not.toBeNull();
    expect(container.querySelector('.solid-flow__edge[data-id="e1"]')).not.toBeNull();
  });

  it("flow owns membership: command writes persist", async () => {
    let api!: ReturnType<typeof useSolidFlow>;
    const Probe = () => {
      api = useSolidFlow();
      return null;
    };
    const { container } = render(() => (
      <SolidFlow defaultNodes={[makeNode({ id: "a" })]} width={800} height={600}>
        <Probe />
      </SolidFlow>
    ));
    await tick();

    api.addNodes(makeNode({ id: "added", position: { x: 200, y: 0 } }));
    api.addEdges({ id: "eAdded", source: "a", target: "added" } as Edge);
    flush();
    await tick();

    expect(container.querySelector('[data-id="added"]')).not.toBeNull();
    expect(container.querySelector('.solid-flow__edge[data-id="eAdded"]')).not.toBeNull();
    expect(api.flow.nodes).toHaveLength(2);
    expect(api.flow.edges).toHaveLength(1);

    await api.deleteElements({ nodes: [{ id: "a" }] });
    flush();
    await tick();
    expect(container.querySelector('[data-id="a"]')).toBeNull();
    // The edge lost its source node and goes with it.
    expect(api.flow.nodes).toHaveLength(1);
  });

  it("defaultNodes is initial-only: later prop values are ignored", async () => {
    const [defaults, setDefaults] = createSignal([makeNode({ id: "a" })]);
    const { container } = render(() => (
      <SolidFlow defaultNodes={defaults()} width={800} height={600} />
    ));
    await tick();
    expect(container.querySelector('[data-id="a"]')).not.toBeNull();

    setDefaults([makeNode({ id: "replacement" })]);
    flush();
    await tick();

    // Unlike the controlled `nodes` prop, swapping defaultNodes re-seeds nothing.
    expect(container.querySelector('[data-id="a"]')).not.toBeNull();
    expect(container.querySelector('[data-id="replacement"]')).toBeNull();
  });

  it("adopts defaults through a provider-created flow (late setConfig path)", async () => {
    // A provider creates the flow state BEFORE the inner SolidFlow's props
    // exist — defaults arrive later via setConfig and must seed exactly once.
    const { container } = render(() => (
      <SolidFlowProvider>
        <SolidFlow
          defaultNodes={[makeNode({ id: "late" })]}
          defaultEdges={[]}
          width={800}
          height={600}
        />
      </SolidFlowProvider>
    ));
    await tick();

    expect(container.querySelector('[data-id="late"]')).not.toBeNull();
  });

  it("warns when both nodes and defaultNodes are supplied (nodes wins)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = render(() => (
        <SolidFlow
          nodes={[makeNode({ id: "controlled" })]}
          defaultNodes={[makeNode({ id: "ignored" })]}
          width={800}
          height={600}
        />
      ));
      await tick();

      expect(container.querySelector('[data-id="controlled"]')).not.toBeNull();
      expect(container.querySelector('[data-id="ignored"]')).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("defaultNodes"));
    } finally {
      warn.mockRestore();
    }
  });
});
