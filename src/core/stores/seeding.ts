import { createEffect, createStore, isPending, untrack } from "solid-js";

import type { Edge, Node } from "@/types";

/**
 * The graph-membership slice of the flow's props: the two controlled axes
 * and their uncontrolled counterparts. Expressed structurally so the
 * headless tests can supply plain objects.
 */
export type GraphSeedSource<NodeType extends Node = Node, EdgeType extends Edge = Edge> = {
  readonly nodes?: readonly NodeType[];
  readonly edges?: readonly EdgeType[];
  readonly defaultNodes?: readonly NodeType[];
  readonly defaultEdges?: readonly EdgeType[];
};

/**
 * The controlled/uncontrolled seeding policy — the subtlest contract in the
 * library, extracted so it is headless-testable (WP3).
 *
 * Controlled vs uncontrolled, PER AXIS (React Flow defaultNodes/defaultEdges
 * parity). Controlled: the user's array/store owns membership and the reset
 * effects below track it. Uncontrolled: defaults seed the flow-owned store
 * once and commands/completed connections own membership (they already write
 * these stores; the only controlled-mode difference is that a re-seed
 * clobbers them). Mode is observable as `config().nodes !== undefined` —
 * nodes/edges deliberately have NO merged default, so absence survives the
 * prop merges. A provider-created flow starts with neither and adopts
 * whichever axis the inner SolidFlow supplies via setConfig (controlled
 * arrays through the reset effects; defaults through the one-shot adoption
 * effect).
 *
 * The stores are plain writable stores, NOT the projection form of
 * createStore: deriving from a store-proxy source rewraps every element on
 * structural writes, so a single addEdge/addNode would churn all row
 * identities and recreate the whole mapArray pipeline (verified empirically
 * on rc.1). Defaults are shallow-copied: the flow owns membership of its
 * store and must not splice the caller's array (runtime fields still write
 * onto the shared row objects, same as controlled mode).
 */
export const createSeededGraphStores = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: GraphSeedSource<NodeType, EdgeType>,
  config: () => GraphSeedSource<NodeType, EdgeType>,
) => {
  if (props.nodes !== undefined && props.defaultNodes !== undefined) {
    console.warn(
      "[solid-flow] Both `nodes` and `defaultNodes` were supplied; `nodes` wins and the flow is controlled. Pass one or the other.",
    );
  }
  if (props.edges !== undefined && props.defaultEdges !== undefined) {
    console.warn(
      "[solid-flow] Both `edges` and `defaultEdges` were supplied; `edges` wins and the flow is controlled. Pass one or the other.",
    );
  }

  // Defaults may come from an async-seeded store ("seed the flow from server
  // truth"). Component setup is untracked, so reading pending rows here is a
  // hard error — probe with isPending (the contract-blessed non-reading
  // check) and hand a pending seed to the one-shot adoption effect below,
  // whose tracked compute holds on NotReadyError and adopts on settle.
  // Even the prop GETTER is a pending read when the default comes from an
  // async store, so every access — including undefined-checks — must happen
  // inside isPending's accessor (absent prop -> accessor returns undefined
  // -> not pending) or behind a short-circuit that skips it while pending.
  const nodeDefaultsPending =
    props.nodes === undefined && isPending(() => props.defaultNodes?.length);
  const edgeDefaultsPending =
    props.edges === undefined && isPending(() => props.defaultEdges?.length);

  const [nodesStore, setNodesStore] = createStore<NodeType[]>(
    (props.nodes ?? (nodeDefaultsPending ? [] : [...(props.defaultNodes ?? [])])) as NodeType[],
  );
  const [edgesStore, setEdgesStore] = createStore<EdgeType[]>(
    (props.edges ?? (edgeDefaultsPending ? [] : [...(props.defaultEdges ?? [])])) as EdgeType[],
  );

  // Whether each axis has consumed its one-time seed (from either prop).
  // A provider-created flow (via setConfig) or a pending async default can
  // still adopt later, through the one-shot adoption effect.
  let nodeSeedAdopted =
    props.nodes !== undefined || (!nodeDefaultsPending && props.defaultNodes !== undefined);
  let edgeSeedAdopted =
    props.edges !== undefined || (!edgeDefaultsPending && props.defaultEdges !== undefined);

  // An undefined axis is uncontrolled (or a provider flow not yet adopted):
  // never re-seed it — defaults are initial-only by contract, and a re-seed
  // here would clobber flow-owned membership. A provider flow adopting a
  // controlled axis flips undefined -> array here and seeds through the same
  // path. The `{ next }` wrapper defeats the effect's equals check — a
  // store-proxy's identity is stable even when its contents changed, and the
  // per-element reads make the tracking STRUCTURAL (length + slot identity),
  // so wholesale replacement through a stable proxy still re-seeds.
  createEffect(
    () => {
      const next = config().nodes as NodeType[] | undefined;
      if (next) for (const node of next) void node;
      return { next };
    },
    ({ next }) => {
      if (!next) return;
      nodeSeedAdopted = true;
      setNodesStore(() => next);
    },
    { defer: true },
  );
  createEffect(
    () => {
      const next = config().edges as EdgeType[] | undefined;
      if (next) for (const edge of next) void edge;
      return { next };
    },
    ({ next }) => {
      if (!next) return;
      edgeSeedAdopted = true;
      setEdgesStore(() => next);
    },
    { defer: true },
  );

  // One-shot late adoption of DEFAULTS, one effect per axis. Two callers:
  // provider-created flows (defaults arrive via setConfig after the provider
  // seeded the store) and async defaults (pending at setup — the compute's
  // read throws NotReadyError, the effect holds, and adoption happens on
  // settle). Not deferred: a pending-at-mount default needs its initial run.
  // Each axis adopts at most once, and never over a controlled axis.
  createEffect(
    () => {
      const defaultNodes = config().defaultNodes;
      // Copy in the COMPUTE: row reads must happen in a tracking scope (the
      // body is untracked, and a pending source must throw HERE to hold).
      return defaultNodes ? ([...defaultNodes] as NodeType[]) : undefined;
    },
    (seed) => {
      if (seed && !nodeSeedAdopted && untrack(() => config().nodes) === undefined) {
        nodeSeedAdopted = true;
        setNodesStore(() => seed);
      }
    },
  );
  createEffect(
    () => {
      const defaultEdges = config().defaultEdges;
      return defaultEdges ? ([...defaultEdges] as EdgeType[]) : undefined;
    },
    (seed) => {
      if (seed && !edgeSeedAdopted && untrack(() => config().edges) === undefined) {
        edgeSeedAdopted = true;
        setEdgesStore(() => seed);
      }
    },
  );

  return { nodesStore, setNodesStore, edgesStore, setEdgesStore } as const;
};
