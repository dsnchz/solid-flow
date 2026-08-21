import type { InternalNodeBase, NodeBase, NodeLookup, ParentLookup } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import { adoptUserNodes, calculateZ, isManualZIndexMode } from "./xyflow";

type TestNode = NodeBase;

const makeNode = (overrides: Partial<TestNode> & { id: string }): TestNode => ({
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});

const adopt = (nodes: TestNode[], options?: Parameters<typeof adoptUserNodes>[3]) => {
  const nodeLookup: NodeLookup<InternalNodeBase<TestNode>> = new Map();
  const parentLookup: ParentLookup<InternalNodeBase<TestNode>> = new Map();
  const nodesInitialized = adoptUserNodes(nodes, nodeLookup, parentLookup, options);
  return { nodeLookup, parentLookup, nodesInitialized };
};

describe("isManualZIndexMode", () => {
  it("is true only for 'manual'", () => {
    expect(isManualZIndexMode("manual")).toBe(true);
    expect(isManualZIndexMode("basic")).toBe(false);
    expect(isManualZIndexMode("auto")).toBe(false);
    expect(isManualZIndexMode(undefined)).toBe(false);
  });
});

describe("calculateZ", () => {
  it("defaults to 0 for a plain node", () => {
    expect(calculateZ(makeNode({ id: "a" }), 1000)).toBe(0);
  });

  it("uses the node's explicit zIndex", () => {
    expect(calculateZ(makeNode({ id: "a", zIndex: 5 }), 1000)).toBe(5);
  });

  it("elevates selected nodes by selectedNodeZ", () => {
    expect(calculateZ(makeNode({ id: "a", zIndex: 5, selected: true }), 1000)).toBe(1005);
  });

  it("ignores selection elevation in manual mode", () => {
    expect(calculateZ(makeNode({ id: "a", zIndex: 5, selected: true }), 1000, "manual")).toBe(5);
  });
});

describe("adoptUserNodes", () => {
  it("populates the node lookup with absolute positions", () => {
    const { nodeLookup } = adopt([makeNode({ id: "a", position: { x: 100, y: 50 } })]);

    const internal = nodeLookup.get("a")!;
    expect(internal.internals.positionAbsolute).toEqual({ x: 100, y: 50 });
    expect(internal.internals.userNode.id).toBe("a");
  });

  it("reports nodesInitialized=false while non-hidden nodes are unmeasured", () => {
    expect(adopt([makeNode({ id: "a" })]).nodesInitialized).toBe(false);
  });

  it("reports nodesInitialized=true when all nodes are measured", () => {
    const { nodesInitialized } = adopt([
      makeNode({ id: "a", measured: { width: 100, height: 40 } }),
    ]);
    expect(nodesInitialized).toBe(true);
  });

  it("does not let hidden unmeasured nodes block initialization", () => {
    const { nodesInitialized } = adopt([
      makeNode({ id: "a", measured: { width: 100, height: 40 } }),
      makeNode({ id: "b", hidden: true }),
    ]);
    expect(nodesInitialized).toBe(true);
  });

  it("reuses the internal node when the user node reference is unchanged", () => {
    const node = makeNode({ id: "a" });
    const nodeLookup: NodeLookup<InternalNodeBase<TestNode>> = new Map();
    const parentLookup: ParentLookup<InternalNodeBase<TestNode>> = new Map();

    adoptUserNodes([node], nodeLookup, parentLookup, { checkEquality: true });
    const first = nodeLookup.get("a");
    adoptUserNodes([node], nodeLookup, parentLookup, { checkEquality: true });

    expect(nodeLookup.get("a")).toBe(first);
  });

  it("elevates selected nodes to z=1000 by default", () => {
    const { nodeLookup } = adopt([makeNode({ id: "a", selected: true })]);
    expect(nodeLookup.get("a")!.internals.z).toBe(1000);
  });

  it("does not elevate selected nodes when elevateNodesOnSelect is false", () => {
    const { nodeLookup } = adopt([makeNode({ id: "a", selected: true })], {
      elevateNodesOnSelect: false,
    });
    expect(nodeLookup.get("a")!.internals.z).toBe(0);
  });

  it("does not elevate selected nodes in manual zIndexMode", () => {
    const { nodeLookup } = adopt([makeNode({ id: "a", selected: true })], {
      zIndexMode: "manual",
    });
    expect(nodeLookup.get("a")!.internals.z).toBe(0);
  });

  it("positions child nodes relative to their parent", () => {
    const { nodeLookup, parentLookup } = adopt([
      makeNode({ id: "parent", position: { x: 100, y: 100 } }),
      makeNode({ id: "child", position: { x: 10, y: 20 }, parentId: "parent" }),
    ]);

    expect(nodeLookup.get("child")!.internals.positionAbsolute).toEqual({ x: 110, y: 120 });
    expect(parentLookup.get("parent")!.has("child")).toBe(true);
  });

  it("renders children above their parent", () => {
    const { nodeLookup } = adopt([
      makeNode({ id: "parent", position: { x: 0, y: 0 }, zIndex: 4 }),
      makeNode({ id: "child", position: { x: 10, y: 10 }, parentId: "parent" }),
    ]);

    expect(nodeLookup.get("child")!.internals.z).toBeGreaterThan(
      nodeLookup.get("parent")!.internals.z,
    );
  });

  it("assigns root parent z increments in auto zIndexMode", () => {
    const { nodeLookup } = adopt(
      [
        makeNode({ id: "p1", position: { x: 0, y: 0 } }),
        makeNode({ id: "c1", position: { x: 5, y: 5 }, parentId: "p1" }),
        makeNode({ id: "p2", position: { x: 200, y: 0 } }),
        makeNode({ id: "c2", position: { x: 5, y: 5 }, parentId: "p2" }),
      ],
      { zIndexMode: "auto" },
    );

    const p1 = nodeLookup.get("p1")!;
    const p2 = nodeLookup.get("p2")!;

    expect(p1.internals.rootParentIndex).toBe(1);
    expect(p2.internals.rootParentIndex).toBe(2);
    // each root parent block sits above the previous one (increment = 10 per index)
    expect(p1.internals.z).toBe(10);
    expect(p2.internals.z).toBe(20);
    expect(nodeLookup.get("c1")!.internals.z).toBeGreaterThan(p1.internals.z);
    expect(nodeLookup.get("c2")!.internals.z).toBeGreaterThan(p2.internals.z);
  });

  it("keeps plain nodes at z=0 in auto zIndexMode", () => {
    const { nodeLookup } = adopt([makeNode({ id: "a" })], { zIndexMode: "auto" });
    expect(nodeLookup.get("a")!.internals.z).toBe(0);
  });
});
