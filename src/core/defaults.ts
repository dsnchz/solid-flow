import type { JSX } from "@solidjs/web";
import {
  type ColorMode,
  createDevWarn,
  infiniteExtent,
  type IsValidConnection,
  type NodeOrigin,
  type OnError,
  type ZIndexMode,
} from "@xyflow/system";

import type {
  ConnectionLineType,
  ConnectionMode,
  DefaultEdgeOptions,
  SelectionMode,
} from "@/types";

export const getDefaultFlowStateProps = () =>
  ({
    id: "1",
    // nodes/edges/defaultNodes/defaultEdges deliberately have NO defaults:
    // controlled-vs-uncontrolled mode is "is this prop present", so absence
    // must survive the merge (see createFlowState's seeding).
    nodeOrigin: [0, 0] as NodeOrigin,
    nodeExtent: infiniteExtent,
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
    fitView: false,
    noPanClass: "nopan",
    noDragClass: "nodrag",
    noWheelClass: "nowheel",
    autoPanOnNodeDrag: true,
    autoPanOnConnect: true,
    autoPanOnNodeFocus: true,
    autoPanOnSelection: true,
    autoPanSpeed: 15,
    elevateEdgesOnSelect: true,
    nodesDraggable: true,
    nodesConnectable: true,
    nodesFocusable: true,
    edgesFocusable: true,
    elementsSelectable: true,
    selectNodesOnDrag: true,
    elevateNodesOnSelect: true,
    zIndexMode: "basic" as ZIndexMode,
    onlyRenderVisibleElements: false,
    disableKeyboardA11y: false,
    defaultMarkerColor: "#b1b1b7",
    ariaLiveMessage: "" as string,
    style: {} as JSX.CSSProperties,
    isValidConnection: (() => true) as IsValidConnection,
    onFlowError: createDevWarn("Solid Flow", "https://solidflow.dev/") as OnError,
  }) as const;
