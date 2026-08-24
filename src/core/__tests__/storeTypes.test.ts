// @vitest-environment node
// Compile-time contract tests for the guided store APIs: the assertions here
// are the @ts-expect-error annotations, enforced by `tsc --noEmit` in the
// gate. The runtime bodies only keep vitest satisfied.
import { describe, expect, it } from "vitest";

import type { EdgeProps, NodeProps } from "@/types";

import { createEdgeStore } from "../createEdgeStore";
import { createNodeStore } from "../createNodeStore";

// used as types only (typeof) — the maps ARE the API surface under test
const _nodeTypes = {
  text: (props: NodeProps<{ content: string }, "text">) => props.data.content,
  counter: (props: NodeProps<{ count: number }, "counter">) => String(props.data.count),
};

const _edgeTypes = {
  labeled: (props: EdgeProps<{ label: string }, "labeled">) => props.data?.label,
};

describe("createNodeStore type contract", () => {
  it("narrows data by the node type discriminant", () => {
    const [nodes] = createNodeStore<typeof _nodeTypes>([
      { id: "a", position: { x: 0, y: 0 }, type: "text", data: { content: "hi" } },
      { id: "b", position: { x: 0, y: 0 }, type: "counter", data: { count: 1 } },
      // built-ins stay available alongside custom types
      { id: "c", position: { x: 0, y: 0 }, type: "input", data: { label: "in" } },
    ]);
    expect(nodes).toHaveLength(3);
  });

  it("rejects data that does not match the chosen type", () => {
    const [nodes] = createNodeStore<typeof _nodeTypes>([
      // @ts-expect-error - "text" nodes require { content: string }, not { count: number }
      { id: "a", position: { x: 0, y: 0 }, type: "text", data: { count: 3 } },
    ]);
    expect(nodes).toHaveLength(1);
  });

  it("rejects unknown type names", () => {
    const [nodes] = createNodeStore<typeof _nodeTypes>([
      // @ts-expect-error - "nope" is neither a built-in nor a registered custom type
      { id: "a", position: { x: 0, y: 0 }, type: "nope", data: {} },
    ]);
    expect(nodes).toHaveLength(1);
  });

  it("without the generic, custom type names are rejected (loud failure mode)", () => {
    const [nodes] = createNodeStore([
      // @ts-expect-error - custom types require createNodeStore<typeof _nodeTypes>
      { id: "a", position: { x: 0, y: 0 }, type: "text", data: { content: "hi" } },
    ]);
    expect(nodes).toHaveLength(1);
  });

  it("domAttributes accepts plain attributes but rejects event handlers and injection", () => {
    const [nodes] = createNodeStore([
      {
        id: "a",
        position: { x: 0, y: 0 },
        type: "default",
        data: { label: "x" },
        domAttributes: { tabindex: 3, "aria-live": "polite", title: "node a" },
      },
      {
        id: "b",
        position: { x: 0, y: 0 },
        type: "default",
        data: { label: "y" },
        // @ts-expect-error - event handlers are excluded from the escape hatch
        domAttributes: { onClick: () => {} },
      },
      {
        id: "c",
        position: { x: 0, y: 0 },
        type: "default",
        data: { label: "z" },
        // @ts-expect-error - content injection is excluded from the escape hatch
        domAttributes: { innerHTML: "<b>no</b>" },
      },
    ]);
    expect(nodes).toHaveLength(3);
  });
});

describe("createEdgeStore type contract", () => {
  it("narrows data by the edge type discriminant and rejects mismatches", () => {
    const [edges] = createEdgeStore<typeof _edgeTypes>([
      { id: "e1", source: "a", target: "b", type: "labeled", data: { label: "yes" } },
      { id: "e2", source: "a", target: "b", type: "step" },
      // @ts-expect-error - "labeled" edges require { label: string }
      { id: "e3", source: "a", target: "b", type: "labeled", data: { nope: true } },
    ]);
    expect(edges).toHaveLength(3);
  });
});

describe("SolidFlowNode / SolidFlowEdge (exported guided unions)", () => {
  it("carries the guided typing to plain arrays via satisfies", async () => {
    const { createStore } = await import("solid-js");
    type MyNodes = import("../createNodeStore").SolidFlowNode<typeof _nodeTypes>;

    const good = [
      { id: "a", position: { x: 0, y: 0 }, type: "text", data: { content: "hi" } },
    ] satisfies MyNodes[];
    const bad = [
      // @ts-expect-error - counter nodes require { count: number }
      { id: "b", position: { x: 0, y: 0 }, type: "counter", data: { content: "no" } },
    ] satisfies MyNodes[];
    void bad;

    const [store] = createStore<MyNodes[]>([...good]);
    expect(store).toHaveLength(1);
  });

  it("components with odd-but-legal signatures degrade to open data, not never", () => {
    const _oddTypes = {
      // takes no props at all — must not collapse this key to `never`
      static: () => "static",
    };

    const [nodes] = createNodeStore<typeof _oddTypes>([
      { id: "a", position: { x: 0, y: 0 }, type: "static", data: { free: "form" } },
    ]);
    expect(nodes).toHaveLength(1);
  });
});
