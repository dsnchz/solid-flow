import type { CoordinateExtent } from "@xyflow/system";

import type { FlowStoreSetter, SolidFlowStoreSetter } from "@/data/types";
import type { Edge, EdgeTypes } from "@/shared/types/edge";
import type { Node, NodeTypes } from "@/shared/types/node";

import type { FlowProps } from "./types";

type UpdatableStoreParams = {
  readonly nodeTypes: NodeTypes;
  readonly edgeTypes: EdgeTypes;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly translateExtent: CoordinateExtent;
};

export function updateStore<NodeType extends Node, EdgeType extends Edge>(
  setStore: SolidFlowStoreSetter<NodeType, EdgeType>,
  params: Partial<UpdatableStoreParams>,
) {
  const { nodeTypes, edgeTypes, minZoom, maxZoom, translateExtent } = params;

  if (nodeTypes !== undefined) {
    setStore("nodeTypes", nodeTypes);
  }

  if (edgeTypes !== undefined) {
    setStore("edgeTypes", edgeTypes);
  }

  if (minZoom !== undefined) {
    setStore("minZoom", minZoom);
  }

  if (maxZoom !== undefined) {
    setStore("maxZoom", maxZoom);
  }

  if (translateExtent !== undefined) {
    setStore("translateExtent", translateExtent);
  }
}

const getKeys = <T extends object>(obj: T) => Object.keys(obj) as Array<keyof T>;

export type UpdatableStoreProps = Pick<
  FlowProps,
  | "id"
  | "connectionLineType"
  | "connectionRadius"
  | "selectionMode"
  | "snapGrid"
  | "defaultMarkerColor"
  | "nodesDraggable"
  | "nodesConnectable"
  | "elementsSelectable"
  | "onlyRenderVisibleElements"
  | "isValidConnection"
  | "autoPanOnConnect"
  | "autoPanOnNodeDrag"
  | "connectionMode"
  | "onError"
  | "onDelete"
  | "onEdgeCreate"
  | "nodeDragThreshold"
  | "onConnect"
  | "onConnectStart"
  | "onConnectEnd"
  | "onBeforeDelete"
  | "nodeOrigin"
>;

export function updateStoreByKeys<NodeType extends Node, EdgeType extends Edge>(
  setStore: FlowStoreSetter<NodeType, EdgeType>,
  keys: Partial<UpdatableStoreProps>,
) {
  for (const key of getKeys(keys)) {
    if (keys[key] !== undefined) {
      setStore(key, keys[key]);
    }
  }
}
