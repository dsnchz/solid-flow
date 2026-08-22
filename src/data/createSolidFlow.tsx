import { createMediaQuery } from "@solid-primitives/media";
import { flush } from "solid-js";

import {
  BezierEdgeInternal,
  SmoothStepEdgeInternal,
  StepEdgeInternal,
  StraightEdgeInternal,
} from "~/components/graph/edge";
import { DefaultNode, GroupNode, InputNode, OutputNode } from "~/components/graph/node";
import type { SolidFlowProps } from "~/components/SolidFlow/types";
import { createFlowState } from "~/core";
import type { BuiltInEdgeTypes, BuiltInNodeTypes, Edge, Node } from "~/types";
import { scheduleIdleCallback } from "~/utils";

import type { InternalUpdateEntry } from "./types";
import { handleExpandParent, measureNodeInternals } from "./xyflow";

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
    prefersDark: createMediaQuery("(prefers-color-scheme: dark)", props.colorModeSSR === "dark"),
    initialNodeTypes: InitialNodeTypesMap,
    initialEdgeTypes: InitialEdgeTypesMap,
  });

  const { store, nodeLookup, actions } = state;

  // DOM measurement ingest: batch measure requests, read element geometry at
  // idle, and feed the results into the graph via the core seams. The order
  // matters: measurement writes flush first so parent expansion computes
  // against this pass's geometry, then the user-graph changes land.
  let pendingEntries: InternalUpdateEntry[] | undefined = undefined;

  const requestUpdateNodeInternals = (updateEntries: InternalUpdateEntry[]) => {
    if (pendingEntries) {
      pendingEntries.push(...updateEntries);
      return;
    }

    pendingEntries = updateEntries;

    scheduleIdleCallback(() => {
      const updates = new Map(pendingEntries);
      pendingEntries = undefined;

      const { updatedInternals, measurementWrites, changes, parentExpandChildren } =
        measureNodeInternals(updates, nodeLookup, store.domNode);

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

  // commands.updateNodeInternals routes measure requests through this ingest
  actions.setMeasureRequester(requestUpdateNodeInternals);

  return {
    ...state,
    actions: {
      ...actions,
      requestUpdateNodeInternals,
    } as const,
  } as const;
};
