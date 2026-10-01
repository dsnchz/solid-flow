// @vitest-environment node
import { infiniteExtent, type NodeHandleBounds, Position } from "@xyflow/system";
import { describe, expect, it } from "vitest";

import type { InternalNode, Node } from "@/types";

import {
  buildRow,
  computeRowState,
  type RowJoins,
  type RowSettings,
  type RowState,
  writeChangedLeaves,
} from "../projections/internalNodeRow";

// The internalNodes row derive's pure parts: what a row computes from its
// inputs (no tracking, no writes), the fresh row the reconcile path returns,
// and the leaf differ of the in-place path.

const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});

const settings = (overrides: Partial<RowSettings> = {}): RowSettings => ({
  nodeOrigin: [0, 0],
  nodeExtent: infiniteExtent,
  zIndexMode: "basic",
  elevateNodesOnSelect: true,
  ...overrides,
});

const joins = (node: Node, overrides: Partial<RowJoins> = {}): RowJoins => ({
  selected: !!node.selected,
  dragging: !!node.dragging,
  position: node.position,
  measurement: undefined,
  rootParentIndex: undefined,
  ...overrides,
});

const handleBounds: NodeHandleBounds = {
  source: [
    {
      id: "s",
      type: "source",
      nodeId: "a",
      position: Position.Bottom,
      x: 0,
      y: 0,
      width: 4,
      height: 4,
    },
  ],
  target: null,
};

describe("computeRowState", () => {
  it("places a plain node at its position, sized by its own width and height", () => {
    const node = makeNode({ id: "a", position: { x: 10, y: 20 }, width: 100, height: 40 });
    expect(computeRowState(node, joins(node), settings(), undefined)).toEqual({
      selected: false,
      dragging: false,
      positionX: 10,
      positionY: 20,
      measuredWidth: undefined,
      measuredHeight: undefined,
      x: 10,
      y: 20,
      z: 0,
      width: 100,
      height: 40,
      handleBounds: undefined,
      rootParentIndex: undefined,
    });
  });

  it("takes the measurement over the user's measured seed, with its handle bounds", () => {
    const node = makeNode({ id: "a", measured: { width: 1, height: 2 } });
    const state = computeRowState(
      node,
      joins(node, { measurement: { measured: { width: 80, height: 30 }, handleBounds } }),
      settings(),
      undefined,
    );
    expect([state.measuredWidth, state.measuredHeight]).toEqual([80, 30]);
    expect([state.width, state.height]).toEqual([80, 30]);
    expect(state.handleBounds).toBe(handleBounds);

    const seeded = computeRowState(node, joins(node), settings(), undefined);
    expect([seeded.measuredWidth, seeded.measuredHeight]).toEqual([1, 2]);
  });

  it("uses the joined position and dragging, not the user row's", () => {
    const node = makeNode({ id: "a", position: { x: 1, y: 1 } });
    const state = computeRowState(
      node,
      joins(node, { position: { x: 50, y: 60 }, dragging: true }),
      settings(),
      undefined,
    );
    expect([state.positionX, state.positionY, state.x, state.y]).toEqual([50, 60, 50, 60]);
    expect(state.dragging).toBe(true);
  });

  it("elevates a selected node unless elevation is off or z is manual", () => {
    const node = makeNode({ id: "a", zIndex: 5 });
    const selected = joins(node, { selected: true });
    expect(computeRowState(node, selected, settings(), undefined).z).toBe(1005);
    expect(
      computeRowState(node, selected, settings({ elevateNodesOnSelect: false }), undefined).z,
    ).toBe(5);
    expect(computeRowState(node, selected, settings({ zIndexMode: "manual" }), undefined).z).toBe(
      5,
    );
  });

  it("applies the node origin and clamps to the extent", () => {
    const node = makeNode({ id: "a", position: { x: 100, y: 100 }, width: 40, height: 20 });
    const centered = computeRowState(
      node,
      joins(node),
      settings({ nodeOrigin: [0.5, 0.5] }),
      undefined,
    );
    expect([centered.x, centered.y]).toEqual([80, 90]);

    const clamped = computeRowState(
      node,
      joins(node),
      settings({
        nodeExtent: [
          [0, 0],
          [50, 50],
        ],
      }),
      undefined,
    );
    expect([clamped.x, clamped.y]).toEqual([10, 30]);
  });

  it("stacks a root parent's z block by its auto index", () => {
    const node = makeNode({ id: "p" });
    const state = computeRowState(
      node,
      joins(node, { rootParentIndex: 2 }),
      settings({ zIndexMode: "auto" }),
      undefined,
    );
    expect(state.z).toBe(20);
    expect(state.rootParentIndex).toBe(2);
  });

  it("places a child relative to its parent row, above the parent's z", () => {
    const parentNode = makeNode({ id: "p" });
    const parent = buildRow(parentNode, parentNode, {
      ...computeRowState(parentNode, joins(parentNode), settings(), undefined),
      x: 100,
      y: 200,
      z: 7,
    });
    const child = makeNode({ id: "c", parentId: "p", position: { x: 5, y: 6 } });
    const state = computeRowState(child, joins(child), settings(), parent);
    expect([state.x, state.y, state.z]).toEqual([105, 206, 8]);
  });
});

describe("buildRow", () => {
  it("joins the state into the user row, with its own position and measured objects", () => {
    const userNode = makeNode({ id: "a", position: { x: 1, y: 2 }, type: "custom" });
    const state: RowState = {
      ...computeRowState(userNode, joins(userNode), settings(), undefined),
      selected: true,
    };
    const row = buildRow(userNode, userNode, state);
    expect(row).toMatchObject({
      id: "a",
      type: "custom",
      selected: true,
      dragging: false,
      position: { x: 1, y: 2 },
      measured: { width: undefined, height: undefined },
      internals: { positionAbsolute: { x: 1, y: 2 }, z: 0, handleBounds: undefined, userNode },
    });
    expect(row.position).not.toBe(userNode.position);
    expect("rootParentIndex" in row.internals).toBe(false);
  });

  it("carries the root parent index only when there is one", () => {
    const userNode = makeNode({ id: "p" });
    const state = computeRowState(
      userNode,
      joins(userNode, { rootParentIndex: 1 }),
      settings({ zIndexMode: "auto" }),
      undefined,
    );
    expect(buildRow(userNode, userNode, state).internals.rootParentIndex).toBe(1);
  });
});

describe("writeChangedLeaves", () => {
  const recordWrites = (row: InternalNode) => {
    const writes: string[] = [];
    const track = <T extends object>(target: T, path: string): T =>
      new Proxy(target, {
        get: (t, key) => {
          const value = Reflect.get(t, key);
          return value && typeof value === "object" && typeof key === "string"
            ? track(value, `${path}${key}.`)
            : value;
        },
        set: (t, key, value) => {
          writes.push(`${path}${String(key)}`);
          return Reflect.set(t, key, value);
        },
        deleteProperty: (t, key) => {
          writes.push(`delete ${path}${String(key)}`);
          return Reflect.deleteProperty(t, key);
        },
      });
    return { proxy: track(row, ""), writes };
  };

  const base = (): { node: Node; state: RowState } => {
    const node = makeNode({ id: "a", position: { x: 1, y: 2 }, width: 10, height: 10 });
    return { node, state: computeRowState(node, joins(node), settings(), undefined) };
  };

  it("writes nothing when nothing changed", () => {
    const { node, state } = base();
    const { proxy, writes } = recordWrites(buildRow(node, node, state));
    writeChangedLeaves(proxy, state, { ...state });
    expect(writes).toEqual([]);
  });

  it("writes only the changed leaves", () => {
    const { node, state } = base();
    const row = buildRow(node, node, state);
    const { proxy, writes } = recordWrites(row);
    writeChangedLeaves(proxy, state, { ...state, selected: true, z: 1000 });
    expect(writes).toEqual(["selected", "internals.z"]);
    expect(row.selected).toBe(true);
    expect(row.internals.z).toBe(1000);
  });

  it("writes a moved position and its absolute position as leaves", () => {
    const { node, state } = base();
    const row = buildRow(node, node, state);
    const { proxy, writes } = recordWrites(row);
    writeChangedLeaves(proxy, state, { ...state, positionX: 5, x: 5, dragging: true });
    expect(writes).toEqual([
      "dragging",
      "position.x",
      "position.y",
      "internals.positionAbsolute.x",
      "internals.positionAbsolute.y",
    ]);
    expect(row.position).toEqual({ x: 5, y: 2 });
    expect(row.internals.positionAbsolute).toEqual({ x: 5, y: 2 });
  });

  it("writes measurements and handle bounds, and deletes a dropped root parent index", () => {
    const { node, state } = base();
    const indexed = { ...state, rootParentIndex: 1 };
    const row = buildRow(node, node, indexed);
    const { proxy, writes } = recordWrites(row);
    writeChangedLeaves(proxy, indexed, {
      ...state,
      measuredWidth: 30,
      measuredHeight: 40,
      handleBounds,
    });
    expect(writes).toEqual([
      "measured.width",
      "measured.height",
      "internals.handleBounds",
      "delete internals.rootParentIndex",
    ]);
    expect(row.measured).toEqual({ width: 30, height: 40 });
    expect("rootParentIndex" in row.internals).toBe(false);
  });
});
