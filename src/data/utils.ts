import {
  type ConnectionMode,
  infiniteExtent,
  type NodeOrigin,
  type SnapGrid,
} from "@xyflow/system";

import type {
  ConnectionLineType,
  DefaultEdgeOptions,
  DefaultNodeOptions,
  Edge,
  Node,
  SelectionMode,
} from "@/shared/types";

export const getDefaultFlowStateProps = <NodeType extends Node, EdgeType extends Edge>() =>
  ({
    id: "1",
    nodes: [] as NodeType[],
    edges: [] as EdgeType[],
    nodeOrigin: [0, 0] as NodeOrigin,
    nodeExtent: infiniteExtent,
    defaultNodeOptions: {} as DefaultNodeOptions,
    defaultEdgeOptions: {} as DefaultEdgeOptions,
    connectionMode: "strict" as ConnectionMode,
    connectionLineType: "default" as ConnectionLineType,
    connectionRadius: 20,
    nodeDragThreshold: 1,
    minZoom: 0.5,
    maxZoom: 2,
    height: 500,
    width: 500,
    selectionMode: "full" as SelectionMode,
    snapGrid: [15, 15] as SnapGrid,
    snapToGrid: false,
    autoPanOnNodeDrag: true,
    autoPanOnConnect: true,
    nodesDraggable: true,
    nodesConnectable: true,
    elementsSelectable: true,
    selectNodesOnDrag: true,
    elevateNodesOnSelect: false,
    fitView: false,
    onlyRenderVisibleElements: false,
    defaultMarkerColor: "#b1b1b7",
  }) as const;
