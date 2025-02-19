import type {
  ConnectionLineType,
  ConnectionMode,
  CoordinateExtent,
  IsValidConnection,
  NodeOrigin,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnMove,
  OnMoveEnd,
  OnMoveStart,
  PanelPosition,
  PanOnScrollMode,
  ProOptions,
  Viewport,
} from "@xyflow/system";
import type { JSX } from "solid-js";

import type {
  DefaultEdgeOptions,
  Edge,
  EdgeTypes,
  FitViewOptions,
  Node,
  NodeTypes,
  OnBeforeDelete,
  OnDelete,
} from "@/shared/types";
import type {
  GraphMultiTargetHandler,
  GraphTargetContextHandler,
  GraphTargetHandler,
  MouseOrTouchEventHandler,
} from "@/shared/types/events";

export type SolidFlowProps = {
  readonly initialNodes: Node[];
  readonly initialEdges: Edge[];
  readonly initialWidth: number;
  readonly initialHeight: number;
  readonly fitView: boolean;
  readonly nodeOrigin: NodeOrigin;
};

type EventProps = {
  readonly onInit: () => void;
  readonly onEdgeCreate: (edge: Edge) => void;
  readonly onConnect: OnConnect;
  readonly onConnectStart: OnConnectStart;
  readonly onConnectEnd: OnConnectEnd;
  readonly onBeforeDelete: OnBeforeDelete;
  readonly onError: (error: Error) => void;
  readonly onDelete: OnDelete;
  readonly onMove: OnMove;
  readonly onMoveStart: OnMoveStart;
  readonly onMoveEnd: OnMoveEnd;
  readonly onPaneClick: MouseOrTouchEventHandler;
  readonly onPaneContextMenu: MouseOrTouchEventHandler;
  readonly isValidConnection: IsValidConnection;

  readonly onNodeClick: GraphTargetHandler<Node>;
  readonly onNodeContextMenu: GraphTargetHandler<Node>;
  readonly onNodeMouseEnter: GraphTargetHandler<Node>;
  readonly onNodeMouseLeave: GraphTargetHandler<Node>;
  readonly onNodeMouseMove: GraphTargetHandler<Node>;
  readonly onNodeDrag: GraphTargetContextHandler<Node>;
  readonly onNodeDragStart: GraphTargetContextHandler<Node>;
  readonly onNodeDragStop: GraphTargetContextHandler<Node>;
  readonly onNodeSelectionContextMenu?: GraphMultiTargetHandler<Node>;
  readonly onNodeSelectionClick?: GraphMultiTargetHandler<Node>;

  readonly onEdgeClick: GraphTargetHandler<Edge>;
  readonly onEdgeContextMenu: GraphTargetHandler<Edge>;
  readonly onEdgeMouseEnter: GraphTargetHandler<Edge>;
  readonly onEdgeMouseLeave: GraphTargetHandler<Edge>;
  readonly onEdgeMouseMove: GraphTargetHandler<Edge>;
};

export type FlowProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> = EventProps & {
  readonly id: string;
  readonly class: string;
  readonly style: JSX.CSSProperties;
  readonly colorMode: "light" | "dark";
  readonly defaultMarkerColor: string;
  readonly nodes: NodeType[];
  readonly nodeTypes: NodeTypes;
  readonly edges: EdgeType[];
  readonly edgeTypes: EdgeTypes;
  readonly nodeOrigin: NodeOrigin;
  readonly viewport: Viewport;
  readonly initialViewport: Viewport;
  readonly width: number;
  readonly height: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly fitView: boolean;
  readonly fitViewOptions: FitViewOptions;
  readonly paneClickDistance: number;
  readonly nodeClickDistance: number;
  readonly selectionKey: string;
  readonly selectionMode: string;
  readonly panActivationKey: string;
  readonly multiSelectionKey: string;
  readonly zoomActivationKey: string;
  readonly nodesDraggable: boolean;
  readonly nodesConnectable: boolean;
  readonly nodeDragThreshold: number;
  readonly elementsSelectable: boolean;
  readonly snapGrid: [number, number];
  readonly deleteKey: string;
  readonly connectionRadius: number;
  readonly connectionMode: ConnectionMode;
  readonly connectionLineType: ConnectionLineType;
  readonly connectionLineStyle: string;
  readonly connectionLineContainerStyle: string;
  readonly connectionLineContent: JSX.Element;
  readonly translateExtent: CoordinateExtent;
  readonly nodeExtent: CoordinateExtent;
  readonly onlyRenderVisibleElements: boolean;
  readonly panOnScrollMode: PanOnScrollMode;
  readonly preventScrolling: boolean;
  readonly zoomOnScroll: boolean;
  readonly zoomOnDoubleClick: boolean;
  readonly zoomOnPinch: boolean;
  readonly panOnScroll: boolean;
  readonly panOnDrag: boolean | number[];
  readonly selectionOnDrag: boolean;
  readonly autoPanOnConnect: boolean;
  readonly autoPanOnNodeDrag: boolean;
  readonly attributionPosition: PanelPosition;
  readonly proOptions: ProOptions;
  readonly defaultEdgeOptions: DefaultEdgeOptions;
  readonly children: JSX.Element;
};
