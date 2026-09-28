import { render } from "@solidjs/testing-library";
import { createSignal, For, Show } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Edge, Node, OnSelectionChange } from "@/types";

import { useOnSelectionChange } from "../useOnSelectionChange";
import { useSolidFlow } from "../useSolidFlow";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 300, y: 0 }, data: {}, width: 100, height: 40 },
];
const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

/** The ids each call received, in call order. */
const calls = (spy: ReturnType<typeof vi.fn<OnSelectionChange>>) =>
  spy.mock.calls.map(([params]) => ({
    nodes: params.nodes.map((n) => n.id),
    edges: params.edges.map((e) => e.id),
  }));

const renderFlow = (listeners: OnSelectionChange[]) => {
  let api!: ReturnType<typeof useSolidFlow>;
  const [mounted, setMounted] = createSignal(true);
  const Listener = (props: { onChange: OnSelectionChange }) => {
    useOnSelectionChange(props.onChange);
    return null;
  };
  const Probe = () => ((api = useSolidFlow()), null);
  render(() => (
    <SolidFlow nodes={nodes} edges={edges} width={800} height={600}>
      <Probe />
      <Show when={mounted()}>
        <For each={listeners}>{(onChange) => <Listener onChange={onChange} />}</For>
      </Show>
    </SolidFlow>
  ));
  return { api: () => api, setMounted };
};

describe("useOnSelectionChange", () => {
  it("reports the initial selection, then every change of the selected ids", async () => {
    const spy = vi.fn<OnSelectionChange>();
    const { api } = renderFlow([spy]);
    await tick();
    expect(calls(spy)).toEqual([{ nodes: [], edges: [] }]);

    api().updateNode("a", { selected: true });
    await tick();
    api().updateEdge("e1", { selected: true });
    await tick();
    api().updateNode("a", { selected: false });
    await tick();

    expect(calls(spy)).toEqual([
      { nodes: [], edges: [] },
      { nodes: ["a"], edges: [] },
      { nodes: ["a"], edges: ["e1"] },
      { nodes: [], edges: ["e1"] },
    ]);
  });

  it("does not report a write that leaves the selected ids unchanged", async () => {
    const spy = vi.fn<OnSelectionChange>();
    const { api } = renderFlow([spy]);
    api().updateNode("a", { selected: true });
    await tick();
    spy.mockClear();

    api().updateNodeData("a", { label: "renamed" });
    api().updateNode("b", { position: { x: 400, y: 0 } });
    await tick();

    expect(spy).not.toHaveBeenCalled();
  });

  it("serves several listeners, and stops calling one when its component unmounts", async () => {
    const first = vi.fn<OnSelectionChange>();
    const second = vi.fn<OnSelectionChange>();
    const { api, setMounted } = renderFlow([first, second]);
    await tick();

    api().updateNode("b", { selected: true });
    await tick();
    expect(calls(first).at(-1)).toEqual({ nodes: ["b"], edges: [] });
    expect(calls(second).at(-1)).toEqual({ nodes: ["b"], edges: [] });

    setMounted(false);
    await tick();
    first.mockClear();
    second.mockClear();
    api().updateNode("a", { selected: true });
    await tick();

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
