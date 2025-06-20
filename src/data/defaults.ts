import { type ColorMode, infiniteExtent, type NodeOrigin } from "@xyflow/system";
import type { JSX } from "solid-js";

import type {
  ConnectionLineType,
  DefaultEdgeOptions,
  DefaultNodeOptions,
  SelectionMode,
} from "@/shared/types";
import type { ConnectionMode, Edge, Node } from "@/types";

export const getDefaultFlowStateProps = <NodeType extends Node, EdgeType extends Edge>() =>
  ({
    id: "1",
    nodes: [] as NodeType[],
    edges: [] as EdgeType[],
    nodeOrigin: [0, 0] as NodeOrigin,
    nodeExtent: infiniteExtent,
    defaultNodeOptions: {} as DefaultNodeOptions,
    defaultEdgeOptions: {} as DefaultEdgeOptions,
    colorMode: "system" as ColorMode,
    colorModeSSR: "light" as Omit<ColorMode, "system">,
    connectionMode: "strict" as ConnectionMode,
    connectionLineType: "default" as ConnectionLineType,
    connectionRadius: 20,
    nodeDragThreshold: 1,
    minZoom: 0.5,
    maxZoom: 2,
    selectionMode: "partial" as SelectionMode,
    fitViewQueued: false,
    noPanClass: "nopan",
    noDragClass: "nodrag",
    noWheelClass: "nowheel",
    autoPanOnNodeDrag: true,
    autoPanOnConnect: true,
    autoPanOnNodeFocus: true,
    autoPanSpeed: 15,
    elevateEdgesOnSelect: true,
    nodesDraggable: true,
    nodesConnectable: true,
    nodesFocusable: true,
    edgesFocusable: true,
    elementsSelectable: true,
    selectNodesOnDrag: true,
    elevateNodesOnSelect: true,
    onlyRenderVisibleElements: false,
    disableKeyboardA11y: false,
    defaultMarkerColor: "#b1b1b7",
    ariaLiveMessage: "" as string,
    style: {} as JSX.CSSProperties,
  }) as const;
