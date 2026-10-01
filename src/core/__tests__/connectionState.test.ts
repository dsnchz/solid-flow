// @vitest-environment node
import {
  type ConnectionInProgress,
  type Handle,
  infiniteExtent,
  initialConnection,
  Position,
  type Transform,
} from "@xyflow/system";
import { createMemo, createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { InternalNode, Node } from "@/types";

import { createConnectionState } from "../connectionState";
import { connectionKey } from "../projections/connections";
import { buildRow, computeRowState } from "../projections/internalNodeRow";

// The connection gesture's state, headless: the raw state, its renderer-space
// projection, and the per-handle views handles subscribe to (each changes on
// what that handle cares about, never per pointer move).

const node: Node = { id: "a", position: { x: 0, y: 0 }, data: {} };
const fromNode: InternalNode = buildRow(
  node,
  node,
  computeRowState(
    node,
    {
      selected: false,
      dragging: false,
      position: node.position,
      measurement: undefined,
      rootParentIndex: undefined,
    },
    { nodeOrigin: [0, 0], nodeExtent: infiniteExtent, elevateNodesOnSelect: true },
    undefined,
  ),
);

const handle = (nodeId: string, type: "source" | "target", id: string | null): Handle => ({
  id,
  nodeId,
  type,
  position: Position.Right,
  x: 0,
  y: 0,
  width: 4,
  height: 4,
});

const inProgress = (
  overrides: Partial<ConnectionInProgress<InternalNode>> = {},
): ConnectionInProgress<InternalNode> => ({
  inProgress: true,
  isValid: null,
  from: { x: 0, y: 0 },
  fromHandle: handle("a", "source", "s1"),
  fromPosition: Position.Right,
  fromNode,
  to: { x: 5, y: 5 },
  toHandle: null,
  toPosition: Position.Left,
  toNode: null,
  pointer: { x: 5, y: 5 },
  ...overrides,
});

const setup = () => {
  const [transform, setTransform] = createSignal<Transform>([0, 0, 1]);
  let dispose!: () => void;
  let state!: ReturnType<typeof createConnectionState>;
  let fromHandleRuns = 0;
  createRoot((d) => {
    dispose = d;
    state = createConnectionState({ transform });
    createMemo(() => {
      state.fromHandle();
      fromHandleRuns++;
    });
  });
  flush();
  return { state, setTransform, fromHandleRuns: () => fromHandleRuns, dispose };
};

describe("createConnectionState", () => {
  it("projects an in-progress connection's end into renderer space", () => {
    const { state, setTransform, dispose } = setup();
    expect(state.projected()).toBe(state.connection());

    setTransform([10, 20, 2]);
    state.setConnection(inProgress({ to: { x: 30, y: 60 } }));
    flush();
    // screen point (30, 60) under translate (10, 20) at zoom 2
    expect(state.projected().to).toEqual({ x: 10, y: 20 });
    expect(state.connection().to).toEqual({ x: 30, y: 60 });
    dispose();
  });

  it("changes its from-handle view per gesture, not per move", () => {
    const { state, fromHandleRuns, dispose } = setup();
    const runs = fromHandleRuns();

    state.setConnection(inProgress({ to: { x: 1, y: 1 } }));
    flush();
    expect(fromHandleRuns()).toBe(runs + 1);

    state.setConnection(inProgress({ to: { x: 2, y: 2 } }));
    flush();
    expect(fromHandleRuns()).toBe(runs + 1);
    expect(state.fromHandle()).toMatchObject({ nodeId: "a", type: "source", id: "s1" });
    dispose();
  });

  it("keys the hover target by handle, with its validity", () => {
    const { state, dispose } = setup();
    const b = connectionKey("b", "target", "t1");
    const c = connectionKey("c", "target", null);

    state.setConnection(inProgress({ toHandle: handle("b", "target", "t1"), isValid: true }));
    flush();
    expect({ ...state.targetByHandle }).toEqual({ [b]: "valid" });

    state.setConnection(inProgress({ toHandle: handle("c", "target", null), isValid: false }));
    flush();
    expect({ ...state.targetByHandle }).toEqual({ [c]: "invalid" });

    state.cancel();
    flush();
    expect({ ...state.targetByHandle }).toEqual({});
    expect(state.connection()).toEqual(initialConnection);
    dispose();
  });

  it("keys the origin and its excluded sibling, from a drag or a click-connect start", () => {
    const { state, dispose } = setup();
    state.setConnection(inProgress());
    flush();
    expect({ ...state.originByHandle }).toEqual({
      [connectionKey("a", "source", "s1")]: "from",
      [connectionKey("a", "target", "s1")]: "excluded",
    });

    state.cancel();
    state.setClickConnectStartHandle({ nodeId: "b", type: "target", id: null });
    flush();
    expect({ ...state.originByHandle }).toEqual({
      [connectionKey("b", "target", null)]: "from",
      [connectionKey("b", "source", null)]: "excluded",
    });

    state.setClickConnectStartHandle(undefined);
    flush();
    expect({ ...state.originByHandle }).toEqual({});
    dispose();
  });
});
