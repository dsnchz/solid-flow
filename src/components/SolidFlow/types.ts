import type {
  AriaLabelConfig,
  ColorMode,
  CoordinateExtent,
  IsValidConnection,
  NodeOrigin,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnError,
  OnMove,
  OnMoveEnd,
  OnMoveStart,
  OnReconnect,
  OnReconnectEnd,
  OnReconnectStart,
  PanelPosition,
  ProOptions,
  SnapGrid,
  Viewport,
} from "@xyflow/system";
import type { JSX } from "solid-js";
import type { Store } from "solid-js/store";

import type {
  ConnectionLineType,
  DefaultEdgeOptions,
  EdgeTypes,
  PanOnScrollMode,
  SelectionMode,
} from "@/shared/types";
import type {
  ConnectionMode,
  Edge,
  EdgeEvents,
  FitViewOptions,
  KeyDefinition,
  Node,
  NodeEvents,
  NodeSelectionEvents,
  NodeTypes,
  OnBeforeConnect,
  OnBeforeDelete,
  OnBeforeReconnect,
  OnDelete,
  OnSelectionChange,
  OnSelectionDrag,
  PaneEvents,
} from "@/types";

import type { ConnectionLineComponentProps } from "../graph/connection/types";

export type SolidFlowInitialProps = {
  readonly initialNodes: Node[];
  readonly initialEdges: Edge[];
  readonly initialWidth: number;
  readonly initialHeight: number;
  readonly fitView: boolean;
  readonly nodeOrigin: NodeOrigin;
};

export type SolidFlowProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = NodeEvents<NodeType> &
  NodeSelectionEvents<NodeType> &
  EdgeEvents<EdgeType> &
  PaneEvents & {
    /**
     * The id of the flow. This is necessary if you want to render multiple flows.
     */
    readonly id?: string;
    /** Sets a fixed width for the flow */
    readonly width?: number;
    /** Sets a fixed height for the flow */
    readonly height?: number;
    /**
     * An store of nodes to render in a flow.
     * @example
     * const [nodes] = createStore([
     *  {
     *    id: 'node-1',
     *    type: 'input',
     *    data: { label: 'Node 1' },
     *    position: { x: 250, y: 50 }
     *  }
     * ]);
     */
    readonly nodes?: Store<NodeType[]>;
    /**
     * An store of edges to render in a flow.
     * @example
     * const [edges] = createStore([
     *  {
     *    id: 'edge-1-2',
     *    source: 'node-1',
     *    target: 'node-2',
     *  }
     * ]);
     */
    readonly edges?: Store<EdgeType[]>;
    /**
     * Custom node types to be available in a flow.
     * Solid Flow matches a node's type to a component in the nodeTypes object.
     * @example
     * import CustomNode from './CustomNode';
     *
     * const nodeTypes = { nameOfNodeType: CustomNode };
     */
    readonly nodeTypes?: NodeTypes;
    /**
     * Custom edge types to be available in a flow.
     * Solid Flow matches an edge's type to a component in the edgeTypes object.
     * @example
     * import CustomEdge from './CustomEdge';
     *
     * const edgeTypes = { nameOfEdgeType: CustomEdge };
     */
    readonly edgeTypes?: EdgeTypes;
    /** Pressing down this key you can select multiple elements with a selection box.
     * @default 'Shift'
     */
    readonly selectionKey?: KeyDefinition | KeyDefinition[] | null;
    /** If a key is set, you can pan the viewport while that key is held down even if panOnScroll is set to false.
     *
     * By setting this prop to null you can disable this functionality.
     * @default 'Space'
     */
    readonly panActivationKey?: KeyDefinition | KeyDefinition[] | null;
    /** Pressing down this key deletes all selected nodes & edges.
     * @default 'Backspace'
     */
    readonly deleteKey?: KeyDefinition | KeyDefinition[] | null;
    /** Pressing down this key you can select multiple elements by clicking.
     * @default 'Meta' for macOS, "Ctrl" for other systems
     */
    readonly multiSelectionKey?: KeyDefinition | KeyDefinition[] | null;
    /** If a key is set, you can zoom the viewport while that key is held down even if panOnScroll is set to false.
     *
     * By setting this prop to null you can disable this functionality.
     * @default 'Meta' for macOS, "Ctrl" for other systems
     * */
    readonly zoomActivationKey?: KeyDefinition | KeyDefinition[] | null;
    /** If set, initial viewport will show all nodes & edges */
    readonly fitView?: boolean;
    /**
     * Options to be used in combination with fitView
     * @example
     * const fitViewOptions = {
     *  padding: 0.1,
     *  includeHiddenNodes: false,
     *  minZoom: 0.1,
     *  maxZoom: 1,
     *  duration: 200,
     *  nodes: [{id: 'node-1'}, {id: 'node-2'}], // nodes to fit
     * };
     */
    readonly fitViewOptions?: FitViewOptions<NodeType>;
    /**
     * Defines nodes relative position to its coordinates
     * @default [0, 0]
     * @example
     * [0, 0] // default, top left
     * [0.5, 0.5] // center
     * [1, 1] // bottom right
     */
    readonly nodeOrigin?: NodeOrigin;
    /**
     * With a threshold greater than zero you can control the distinction between node drag and click events.
     * If threshold equals 1, you need to drag the node 1 pixel before a drag event is fired.
     * @default 1
     */
    readonly nodeDragThreshold?: number;
    /**
     * Distance that the mouse can move between mousedown/up that will trigger a click
     * @default 0
     */
    readonly paneClickDistance?: number;
    /** Distance that the mouse can move between mousedown/up that will trigger a click
     * @default 0
     */
    readonly nodeClickDistance?: number;
    /**
     * The threshold in pixels that the mouse must move before a connection line starts to drag.
     * This is useful to prevent accidental connections when clicking on a handle.
     * @default 1
     */
    readonly connectionDragThreshold?: number;
    /** Minimum zoom level
     * @default 0.5
     */
    readonly minZoom?: number;
    /** Maximum zoom level
     * @default 2
     */
    readonly maxZoom?: number;
    /**
     * Sets the initial position and zoom of the viewport.
     * If a default viewport is provided but fitView is enabled, the default viewport will be ignored.
     * @default { zoom: 1, position: { x: 0, y: 0 } }
     * @example
     * const initialViewport = {
     *  zoom: 0.5,
     *  position: { x: 0, y: 0 }
     * };
     */
    readonly initialViewport?: Viewport;
    /** Custom viewport to be used instead of internal one */
    readonly viewport?: Store<Viewport>;
    /**
     * The radius around a handle where you drop a connection line to create a new edge.
     * @default 20
     */
    readonly connectionRadius?: number;
    /**
     * 'strict' connection mode will only allow you to connect source handles to target handles.
     * 'loose' connection mode will allow you to connect handles of any type to one another.
     * @default 'strict'
     */
    readonly connectionMode?: ConnectionMode;
    /** Provide a custom snippet to be used insted of the default connection line */
    readonly connectionLineComponent?: (
      props: ConnectionLineComponentProps<NodeType>,
    ) => JSX.Element;
    /** Styles to be applied to the connection line */
    readonly connectionLineStyle?: JSX.CSSProperties;
    /** Styles to be applied to the container of the connection line */
    readonly connectionLineContainerStyle?: JSX.CSSProperties;
    /**
     * When set to "partial", when the user creates a selection box by click and dragging
     * nodes that are only partially in the box are still selected.
     * @default 'full'
     */
    readonly selectionMode?: SelectionMode;
    /**
     * Controls if nodes should be automatically selected when being dragged
     */
    readonly selectNodesOnDrag?: boolean;
    /**
     * Grid all nodes will snap to
     * @example [20, 20]
     */
    readonly snapGrid?: SnapGrid;
    /** Color of edge markers
     * You can pass `null` to use the CSS variable `--xy-edge-stroke` for the marker color.
     * @example "#b1b1b7"
     */
    readonly defaultMarkerColor?: string;
    /**
     * Controls if all nodes should be draggable
     * @default true
     */
    readonly nodesDraggable?: boolean;
    /**
     * When `true`, the viewport will pan when a node is focused.
     * @default true
     */
    readonly autoPanOnNodeFocus?: boolean;
    /**
     * Controls if all nodes should be connectable to each other
     * @default true
     */
    readonly nodesConnectable?: boolean;
    /** Controls if all elements should (nodes & edges) be selectable
     * @default true
     */
    readonly elementsSelectable?: boolean;
    /**
     * When `true`, focus between nodes can be cycled with the `Tab` key and selected with the `Enter`
     * key. This option can be overridden by individual nodes by setting their `focusable` prop.
     * @default true
     */
    readonly nodesFocusable?: boolean;
    /**
     * When `true`, focus between edges can be cycled with the `Tab` key and selected with the `Enter`
     * key. This option can be overridden by individual edges by setting their `focusable` prop.
     * @default true
     */
    readonly edgesFocusable?: boolean;
    /**
     * By default the viewport extends infinitely. You can use this prop to set a boundary.
     * The first pair of coordinates is the top left boundary and the second pair is the bottom right.
     * @default @default [[-∞, -∞], [+∞, +∞]]
     * @example [[-1000, -10000], [1000, 1000]]
     */
    readonly translateExtent?: CoordinateExtent;
    /**
     * By default the nodes can be placed anywhere. You can use this prop to set a boundary.
     * The first pair of coordinates is the top left boundary and the second pair is the bottom right.
     * @default [[-∞, -∞], [+∞, +∞]]
     * @example [[-1000, -10000], [1000, 1000]]
     */
    readonly nodeExtent?: CoordinateExtent;
    /**
     * Disabling this prop will allow the user to scroll the page even when their pointer is over the flow.
     * @default true
     */
    readonly preventScrolling?: boolean;
    /**
     * Controls if the viewport should zoom by scrolling inside the container.
     * @default true
     */
    readonly zoomOnScroll?: boolean;
    /**
     * Controls if the viewport should zoom by double clicking somewhere on the flow
     * @default true
     */
    readonly zoomOnDoubleClick?: boolean;
    /**
     * Controls if the viewport should zoom by pinching on a touch screen
     * @default true
     */
    readonly zoomOnPinch?: boolean;
    /**
     * Controls if the viewport should pan by scrolling inside the container
     * Can be limited to a specific direction with panOnScrollMode
     * @default false
     */
    readonly panOnScroll?: boolean;
    /**
     * This prop is used to limit the direction of panning when panOnScroll is enabled.
     * The "free" option allows panning in any direction.
     * @default "free"
     * @example "horizontal" | "vertical"
     */
    readonly panOnScrollMode?: PanOnScrollMode;
    /**
     * Enableing this prop allows users to pan the viewport by clicking and dragging.
     * You can also set this prop to an array of numbers to limit which mouse buttons can activate panning.
     * @default true
     * @example [0, 2] // allows panning with the left and right mouse buttons
     * [0, 1, 2, 3, 4] // allows panning with all mouse buttons
     */
    readonly panOnDrag?: boolean | number[];
    /**
     * Select multiple elements with a selection box, without pressing down selectionKey.
     * @default false
     */
    readonly selectionOnDrag?: boolean;
    /**
     * You can enable this optimization to instruct Solid Flow to only render nodes and edges that would be visible in the viewport.
     * This might improve performance when you have a large number of nodes and edges but also adds an overhead.
     * @default false
     */
    readonly onlyRenderVisibleElements?: boolean;
    /**
     * You can enable this prop to automatically pan the viewport while making a new connection.
     * @default true
     */
    readonly autoPanOnConnect?: boolean;
    /**
     * You can enable this prop to automatically pan the viewport while dragging a node.
     * @default true
     */
    readonly autoPanOnNodeDrag?: boolean;
    /**
     * Defaults to be applied to all new edges that are added to the flow.
     * Properties on a new edge will override these defaults if they exist.
     * @example
     * const defaultEdgeOptions = {
     *  type: 'customEdgeType',
     *  animated: true
     * }
     */
    readonly defaultEdgeOptions?: DefaultEdgeOptions;
    /**
     * Controls color scheme used for styling the flow
     * @default 'system'
     * @example 'system' | 'light' | 'dark'
     */
    readonly colorMode?: ColorMode;
    /** Fallback color mode for SSR if colorMode is set to 'system' */
    readonly colorModeSSR?: Omit<ColorMode, "system">;
    /** Class to be applied to the flow container */
    readonly class?: string;
    /** Styles to be applied to the flow container */
    readonly style?: JSX.CSSProperties;
    /** Choose from the built-in edge types to be used for connections
     * @default 'default' | ConnectionLineType.Bezier
     * @example 'straight' | 'default' | 'step' | 'smoothstep' | 'bezier'
     * @example ConnectionLineType.Straight | ConnectionLineType.Default | ConnectionLineType.Step | ConnectionLineType.SmoothStep | ConnectionLineType.Bezier
     */
    readonly connectionLineType?: ConnectionLineType;
    /** Enabling this option will raise the z-index of nodes when they are selected.
     * @default true
     */
    readonly elevateNodesOnSelect?: boolean;
    /**
     * Enabling this option will raise the z-index of edges when they are selected,
     * or when the connected nodes are selected.
     * @default true
     */
    readonly elevateEdgesOnSelect?: boolean;
    /**
     * You can use this prop to disable keyboard accessibility features such as selecting nodes or
     * moving selected nodes with the arrow keys.
     * @default false
     */
    readonly disableKeyboardA11y?: boolean;
    /**
     * If a node is draggable, clicking and dragging that node will move it around the canvas. Adding
     * the `"nodrag"` class prevents this behavior and this prop allows you to change the name of that
     * class.
     * @default "nodrag"
     */
    readonly noDragClass?: string;
    /**
     * Typically, scrolling the mouse wheel when the mouse is over the canvas will zoom the viewport.
     * Adding the `"nowheel"` class to an element n the canvas will prevent this behavior and this prop
     * allows you to change the name of that class.
     * @default "nowheel"
     */
    readonly noWheelClass?: string;
    /**
     * If an element in the canvas does not stop mouse events from propagating, clicking and dragging
     * that element will pan the viewport. Adding the `"nopan"` class prevents this behavior and this
     * prop allows you to change the name of that class.
     * @default "nopan"
     */
    readonly noPanClass?: string;
    /** Toggles ability to make connections via clicking the handles */
    readonly clickConnect?: boolean;
    /**
     * This callback can be used to validate a new connection.
     * If you return `false`, the edge will not be added to your flow.
     * If you have custom connection logic its preferred to use this callback over the
     * `isValidConnection` prop on the handle component for performance reasons.
     */
    /**
     * Set position of the attribution
     * @default 'bottom-right'
     * @example 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
     */
    readonly attributionPosition?: PanelPosition;
    /**
     * By default, we render a small attribution in the corner of your flows that links back to the project.
     * You are free to remove this attribution but we ask that you take a quick look at our
     * {@link https://svelteflow.dev/learn/troubleshooting/remove-attribution | removing attribution guide}
     * before doing so.
     */
    readonly proOptions?: ProOptions;
    readonly isValidConnection?: IsValidConnection;
    /** This event handler is called when the user begins to pan or zoom the viewport */
    readonly onMoveStart?: OnMoveStart;
    /** This event handler is called when the user pans or zooms the viewport */
    readonly onMove?: OnMove;
    /** This event handler is called when the user stops panning or zooming the viewport */
    readonly onMoveEnd?: OnMoveEnd;
    /**
     * Ocassionally something may happen that causes Solid Flow to throw an error.
     * Instead of exploding your application, we log a message to the console and then call this event handler.
     * You might use it for additional logging or to show a message to the user.
     */
    readonly onFlowError?: OnError;
    /** This handler gets called when the user deletes nodes or edges.
     * @example
     * onDelete={({nodes, edges}) => {
     *  console.log('deleted nodes:', nodes);
     *  console.log('deleted edges:', edges);
     * }}
     */
    readonly onDelete?: OnDelete<NodeType, EdgeType>;
    /** This handler gets called before the user deletes nodes or edges and provides a way to abort the deletion by returning false. */
    readonly onBeforeDelete?: OnBeforeDelete<NodeType, EdgeType>;
    /** This handler gets called when a new edge is created. You can use it to modify the newly created edge. */
    readonly onBeforeConnect?: OnBeforeConnect<EdgeType>;
    /** This event gets fired when a connection successfully completes and an edge is created. */
    readonly onConnect?: OnConnect;
    /** When a user starts to drag a connection line, this event gets fired. */
    readonly onConnectStart?: OnConnectStart;
    /** When a user stops dragging a connection line, this event gets fired. */
    readonly onConnectEnd?: OnConnectEnd;
    /** This event gets fired when after an edge was reconnected*/
    readonly onReconnect?: OnReconnect<EdgeType>;
    /** This event gets fired when a user starts to reconnect an edge */
    readonly onReconnectStart?: OnReconnectStart<EdgeType>;
    /** This event gets fired when a user stops reconnecting an edge */
    readonly onReconnectEnd?: OnReconnectEnd<EdgeType>;
    /** This handler gets called when an edge is reconnected. You can use it to modify the edge before the update is applied. */
    readonly onBeforeReconnect?: OnBeforeReconnect<EdgeType>;
    /** A connection is started by clicking on a handle */
    readonly onClickConnectStart?: OnConnectStart;
    /** A connection is finished by clicking on a handle */
    readonly onClickConnectEnd?: OnConnectEnd;
    /** This handler gets called when the flow is finished initializing */
    readonly onInit?: () => void;
    /** This event handler gets called when the selected nodes & edges change */
    readonly onSelectionChange?: OnSelectionChange<NodeType, EdgeType>;
    /** This event handler gets called when a user starts to drag a selection box. */
    readonly onSelectionDragStart?: OnSelectionDrag<NodeType>;
    /** This event handler gets called when a user drags a selection box. */
    readonly onSelectionDrag?: OnSelectionDrag<NodeType>;
    /** This event handler gets called when a user stops dragging a selection box. */
    readonly onSelectionDragStop?: OnSelectionDrag<NodeType>;
    /** This event handler gets called when the user starts to drag a selection box */
    readonly onSelectionStart?: (event: PointerEvent) => void;
    /** This event handler gets called when the user finishes dragging a selection box */
    readonly onSelectionEnd?: (event: PointerEvent) => void;
    /**
     * Configuration for customizable labels, descriptions, and UI text. Provided keys will override the corresponding defaults.
     * Allows localization, customization of ARIA descriptions, control labels, minimap labels, and other UI strings.
     */
    readonly ariaLabelConfig?: Partial<AriaLabelConfig>;
  };
