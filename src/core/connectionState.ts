import {
  type ConnectionState,
  type Handle,
  initialConnection,
  pointToRendererPoint,
  type Transform,
} from "@xyflow/system";
import { createMemo, createProjection, createSignal } from "solid-js";

import type { InternalNode, Node } from "@/types";

import { connectionKey } from "./projections/connections";

export type ConnectionStateSource = {
  /** The viewport transform the in-progress end is projected through. */
  readonly transform: () => Transform;
};

type HandleIdentity = Pick<Handle, "id" | "nodeId" | "type">;

const handleIdentityEquals = (a: HandleIdentity | null, b: HandleIdentity | null) =>
  a === b || (!!a && !!b && a.nodeId === b.nodeId && a.type === b.type && a.id === b.id);

/**
 * The connection gesture's state: the raw state XYHandle writes on every
 * pointer move, a click-connect origin, and the views the flow reads. The
 * raw state is a FRESH object per move, so handles never read it: each
 * handle subscribes to a view that changes on what it cares about (the
 * gesture's origin, the hover target), never per move.
 */
export const createConnectionState = <NodeType extends Node = Node>(
  source: ConnectionStateSource,
) => {
  const [connection, setConnection] =
    createSignal<ConnectionState<InternalNode<NodeType>>>(initialConnection);
  const [clickConnectStartHandle, setClickConnectStartHandle] = createSignal<
    HandleIdentity | undefined
  >(undefined);

  // B4 (audit): memoized — the getter spread the state and ran
  // pointToRendererPoint on every read (ConnectionLine reads it 10x per
  // render, Zoom/Pane once per gesture event).
  const projected = createMemo(
    (): ConnectionState<InternalNode<NodeType>> => {
      const state = connection();
      if (!state.inProgress) return state;
      return { ...state, to: pointToRendererPoint(state.to, source.transform()) };
    },
    { name: "projectedConnection" },
  );

  // Per-handle reads, equality-cut: at 10k nodes a handle reading the raw
  // state was ~20k indicator computations per mousemove (the bulk of a
  // 422ms/move connection gesture, spatial-index bench). It changes once
  // per gesture.
  const fromHandle = createMemo(() => connection().fromHandle ?? null, {
    equals: handleIdentityEquals,
    // Every handle subscribes (rc.7 HUGE_FAN_OUT) BY DESIGN: it changes once
    // per gesture and each subscriber does O(1) work — see docs/ARCHITECTURE.md.
    name: "connectionFromHandle",
  });

  // The hover-target as a KEYED record: a toHandle/isValid flip re-runs only
  // the subscribers of the two affected keys (the handle left and the handle
  // entered) instead of every handle in the graph — the difference between a
  // ~400ms hitch and O(2) work when snapping onto a handle at 10k nodes.
  const targetByHandle = createProjection<Record<string, "valid" | "invalid">>(
    (draft) => {
      const state = connection();
      const toHandle = state.inProgress ? state.toHandle : null;
      const key = toHandle
        ? connectionKey(toHandle.nodeId, toHandle.type, toHandle.id ?? null)
        : null;
      for (const existing of Object.keys(draft)) {
        if (existing !== key) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
          delete draft[existing];
        }
      }
      if (key) draft[key] = state.isValid ? "valid" : "invalid";
    },
    {},
    { key: null, name: "connectionTargetByHandle" },
  );

  // The connection ORIGIN as a keyed record (perf P2): starting a gesture
  // once flipped every handle's possible-target indicator computation
  // (~490ms at 10k). The indicator is now derived from ROOT-level classes in
  // CSS; the only per-handle state left is "am I the origin" (connectingfrom
  // styling) and "am I excluded as a target" (loose mode excludes the origin
  // node's same-id handles) — both keyed, so a gesture start touches the
  // origin's keys instead of every handle. Sources: an in-flight drag
  // connection, else a click-connect origin.
  const originByHandle = createProjection<Record<string, "from" | "excluded">>(
    (draft) => {
      const from = connection().fromHandle ?? clickConnectStartHandle();
      const fromKey = from ? connectionKey(from.nodeId, from.type, from.id ?? null) : null;
      const siblingKey = from
        ? connectionKey(from.nodeId, from.type === "source" ? "target" : "source", from.id ?? null)
        : null;
      for (const existing of Object.keys(draft)) {
        if (existing !== fromKey && existing !== siblingKey) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing a keyed entry from a store draft IS a dynamic delete
          delete draft[existing];
        }
      }
      if (fromKey) draft[fromKey] = "from";
      if (siblingKey) draft[siblingKey] = "excluded";
    },
    {},
    { key: null, name: "connectionOriginByHandle" },
  );

  return {
    /** The raw state (XYHandle's coordinates). */
    connection,
    setConnection,
    clickConnectStartHandle,
    setClickConnectStartHandle,
    /** The state with its in-progress end in renderer space. */
    projected,
    fromHandle,
    targetByHandle,
    originByHandle,
    /** Back to no connection (a click-connect origin is kept). */
    cancel: () => setConnection({ ...initialConnection }),
  };
};
