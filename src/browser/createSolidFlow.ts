import type { InternalNodeUpdate } from "@xyflow/system";
import { flush } from "solid-js";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "@/components/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "@/components/node";
import { createFlowState } from "@/core";
import type { SolidFlowProps } from "@/core/flowProps";
import type { BuiltInEdgeTypes, BuiltInNodeTypes, Edge, Node } from "@/types";

import { scheduleIdleCallback } from "./idle";
import { handleExpandParent, measureNodeInternals } from "./measure";

/** One measure request: node id plus the DOM element to measure. */
export type MeasureRequestEntry = [string, InternalNodeUpdate];

export const InitialNodeTypesMap = {
  input: InputNode,
  output: OutputNode,
  default: DefaultNode,
  group: GroupNode,
} satisfies BuiltInNodeTypes;

export const InitialEdgeTypesMap = {
  straight: StraightEdgeInternal,
  smoothstep: SmoothStepEdgeInternal,
  default: BezierEdgeInternal,
  step: StepEdgeInternal,
} satisfies BuiltInEdgeTypes;

/**
 * The browser wiring around the headless data graph ({@link createFlowState}
 * in src/core): injects the DOM-adjacent pieces — the color-scheme media
 * query and the built-in renderer maps — and owns the DOM measurement ingest
 * that feeds element geometry into the graph through its core seams.
 */
export const createSolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: SolidFlowProps<NodeType, EdgeType>,
) => {
  const state = createFlowState<NodeType, EdgeType>(props, {
    initialNodeTypes: InitialNodeTypesMap,
    initialEdgeTypes: InitialEdgeTypesMap,
  });

  const { store, nodeLookup, actions } = state;

  // DOM measurement ingest: batch measure requests, read element geometry at
  // idle, and feed the results into the graph via the core seams. The order
  // matters: measurement writes flush first so parent expansion computes
  // against this pass's geometry, then the user-graph changes land.
  let pendingEntries: MeasureRequestEntry[] | undefined = undefined;

  const requestUpdateNodeInternals = (updateEntries: MeasureRequestEntry[]) => {
    if (pendingEntries) {
      pendingEntries.push(...updateEntries);
      return;
    }

    pendingEntries = updateEntries;

    scheduleIdleCallback(() => {
      const updates = new Map(pendingEntries);
      pendingEntries = undefined;

      const { updatedInternals, measurementWrites, changes, parentExpandChildren } =
        measureNodeInternals(updates, nodeLookup, store.domNode, store.nodeExtent);

      if (!updatedInternals) return;

      actions.applyMeasurementWrites(measurementWrites);
      // Re-derive internalNodes now so parent expansion sees this pass's geometry.
      flush();

      if (parentExpandChildren.length > 0) {
        changes.push(
          ...handleExpandParent(
            parentExpandChildren,
            nodeLookup,
            (parentId) => store.nodes.filter((node) => node.parentId === parentId),
            store.nodeOrigin,
          ),
        );
      }

      actions.applyNodeChanges(changes);
      flush();
      actions.markInitialNodesMeasured();
    });
  };

  // commands.updateNodeInternals names the nodes; their elements are found
  // here, in the flow's DOM, and measured through this ingest (forced: the
  // caller knows something changed, e.g. a handle added after mount).
  actions.setMeasureRequester((ids) => {
    const updates: MeasureRequestEntry[] = [];
    for (const id of ids) {
      const nodeElement = store.domNode?.querySelector<HTMLDivElement>(
        `.solid-flow__node[data-id="${id}"]`,
      );
      if (nodeElement) updates.push([id, { id, nodeElement, force: true }]);
    }
    requestUpdateNodeInternals(updates);
  });

  return {
    ...state,
    actions: {
      ...actions,
      requestUpdateNodeInternals,
    } as const,
  } as const;
};
