import type { JSX } from "@solidjs/web";
import { dynamic } from "@solidjs/web";
import {
  getNodeDimensions,
  nodeHasDimensions,
  type PanelPosition,
  XYMinimap,
  type XYPosition,
} from "@xyflow/system";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  omit,
  type ParentProps,
  Show,
} from "solid-js";

import { Panel } from "@/components/container";
import { useInternalSolidFlow } from "@/contexts";
import { propDefaults } from "@/core/propDefaults";
import type { Node } from "@/types";

import { createMinimapBounds } from "./minimapBounds";
import { minimapFrame, minimapMaskPath } from "./minimapLayout";
import { MiniMapNode, type MiniMapNodeProps } from "./MiniMapNode";

/** Derives a per-node minimap attribute (color, stroke, class) from the node. */
export type GetMiniMapNodeAttribute<NodeType extends Node> = (node: NodeType) => string;

/** Props for the `MiniMap` plugin. */
export type MiniMapProps<NodeType extends Node> = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "style" | "onClick"
> & {
  /** Background color of minimap */
  readonly bgColor?: string;
  /** Color of nodes on the minimap */
  readonly nodeColor?: string | GetMiniMapNodeAttribute<NodeType>;
  /** Stroke color of nodes on the minimap */
  readonly nodeStrokeColor?: string | GetMiniMapNodeAttribute<NodeType>;
  /** Class applied to nodes on the minimap */
  readonly nodeClass?: string | GetMiniMapNodeAttribute<NodeType>;
  /** Border radius of nodes on the minimap */
  readonly nodeBorderRadius?: number;
  /** Stroke width of nodes on the minimap */
  readonly nodeStrokeWidth?: number;
  /** Color of the mask representing viewport */
  readonly maskColor?: string;
  /** Stroke color of the mask representing viewport */
  readonly maskStrokeColor?: string;
  /** Stroke width of the mask representing viewport */
  readonly maskStrokeWidth?: number;
  /** Position of the minimap on the pane
   * @example "top-left" | "top-right" | "bottom-left" | "bottom-right"
   */
  readonly position?: PanelPosition;
  /** Style applied to container */
  readonly style?: JSX.CSSProperties;
  /** The aria-label applied to container */
  readonly ariaLabel?: string | null;
  /** Width of minimap */
  readonly width?: number;
  /** Height of minimap */
  readonly height?: number;
  /** Called when the minimap pane is clicked, with the position in flow coordinates. */
  readonly onClick?: (event: MouseEvent, position: XYPosition) => void;
  /** Called when a node on the minimap is clicked. */
  readonly onNodeClick?: (event: MouseEvent, node: NodeType) => void;
  readonly pannable?: boolean;
  readonly zoomable?: boolean;
  /**
   * Custom component rendering each node on the minimap (receives
   * {@link MiniMapNodeProps}); defaults to the built-in rounded rect.
   */
  readonly nodeComponent?: (props: MiniMapNodeProps) => JSX.Element;
  /** Invert the direction when panning the minimap viewport */
  readonly inversePan?: boolean;
  /** Step size for zooming in/out */
  readonly zoomStep?: number;
  /**
   * Scales the padding around the graph inside the minimap (multiplied by
   * the minimap's view scale). Upstream parity.
   * @default 5
   */
  readonly offsetScale?: number;
};

const getAttrFunction = <NodeType extends Node>(
  value: string | GetMiniMapNodeAttribute<NodeType>,
): GetMiniMapNodeAttribute<NodeType> => (value instanceof Function ? value : () => value);

/** Miniature overview map of the whole flow, with optional pan/zoom interaction. */
export const MiniMap = <NodeType extends Node>(
  props: ParentProps<Partial<MiniMapProps<NodeType>>>,
): JSX.Element => {
  const { store, nodeLookup, dragOverlay, nodeGeometry, nodeGeometryChanges } =
    useInternalSolidFlow<NodeType>();

  const _props = propDefaults(props, {
    position: "bottom-right" as PanelPosition,
    nodeClass: "",
    nodeStrokeColor: "transparent",
    pannable: true,
    zoomable: true,
    width: 200,
    height: 150,
    nodeBorderRadius: 5,
    offsetScale: 5,
    nodeStrokeWidth: 2,
    style: {} as JSX.CSSProperties,
  });

  const paneProps = omit(
    _props,
    "class",
    "style",
    "position",
    "nodeClass",
    "nodeStrokeColor",
    "nodeColor",
    "pannable",
    "zoomable",
    "inversePan",
    "zoomStep",
    "offsetScale",
    "bgColor",
    "width",
    "height",
    "maskColor",
    "maskStrokeColor",
    "maskStrokeWidth",
    "nodeBorderRadius",
    "nodeStrokeWidth",
    "nodeComponent",
    "onClick",
    "onNodeClick",
  );

  // One `dynamic()` factory per MiniMap instance (rc.9 deprecates <Dynamic>:
  // it re-merged/omitted `component` per node and rebuilt a factory each
  // time); the source tracks the prop, so a runtime swap re-renders every
  // node with the new component.
  const NodeComponent = dynamic(() => _props.nodeComponent ?? MiniMapNode);
  const nodeColorFunc = () =>
    _props.nodeColor === undefined ? undefined : getAttrFunction(_props.nodeColor);

  const nodeStrokeColorFunc = () => getAttrFunction(_props.nodeStrokeColor);
  const nodeClassFunc = () => getAttrFunction(_props.nodeClass);

  const shapeRendering =
    // @ts-expect-error - TS doesn't know about chrome
    typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";

  const labelledBy = createMemo(() => `solid-flow__minimap-desc-${store.id}`);

  // What the minimap must show (minimapBounds.ts): the sampled graph
  // bounds joined with the visible viewport.
  const { viewBB, boundingRect } = createMinimapBounds({
    store,
    geometry: nodeGeometry,
    geometryChanges: nodeGeometryChanges,
    dragOverlay,
  });

  // The viewBox follows the bounding rect only (a pan inside the graph's
  // bounds changes neither); the mask also follows the viewport.
  const frame = createMemo(
    () =>
      minimapFrame({
        bounds: boundingRect(),
        width: _props.width,
        height: _props.height,
        offsetScale: _props.offsetScale,
      }),
    { name: "minimap.frame" },
  );
  const viewScale = () => frame().viewScale;

  const strokeWidth = () =>
    _props.maskStrokeWidth ? _props.maskStrokeWidth * viewScale() : undefined;

  // Membership from the flow's shared id list (ONE source) — mapping
  // store.nodes here re-read every row's id slot (rc.7 HUGE_FAN_IN).
  const nodeIds = createMemo(() => store.visibleNodeIds, {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
    name: "minimap.nodeIds",
  });

  // The svg, its nodes and mask, and its XYMinimap controller.
  const MiniMapSvg = () => {
    const [ref, setRef] = createSignal<SVGSVGElement>();

    // Mount the minimap controller on the svg (external system: XYMinimap)
    // once the flow's pan-zoom instance exists. The svg itself does not
    // wait for it: server rendering has no pan-zoom and must still
    // produce the node shapes and the mask.
    const [minimap, setMinimap] = createSignal<ReturnType<typeof XYMinimap>>();

    createEffect(
      () => ({ el: ref(), panZoom: store.panZoom }),
      ({ el, panZoom }) => {
        if (!el || !panZoom) return;
        const instance = XYMinimap({
          domNode: el,
          panZoom,
          getTransform: () => store.transform,
          getViewScale: viewScale,
        });
        setMinimap(instance);
        return () => {
          instance.destroy();
        };
      },
    );

    createEffect(
      () => ({
        instance: minimap(),
        options: {
          translateExtent: store.translateExtent,
          width: store.width,
          height: store.height,
          inversePan: _props.inversePan,
          zoomStep: _props.zoomStep,
          pannable: _props.pannable,
          zoomable: _props.zoomable,
        },
      }),
      ({ instance, options }) => {
        instance?.update(options);
      },
    );

    const onSvgClick = (event: MouseEvent) => {
      if (!_props.onClick) return;
      const [x, y] = minimap()?.pointer(event) ?? [0, 0];
      _props.onClick(event, { x, y });
    };

    const onSvgNodeClick = (event: MouseEvent, nodeId: string) => {
      const node = nodeLookup.get(nodeId)?.internals.userNode;
      if (node) _props.onNodeClick?.(event, node);
    };

    return (
      <svg
        ref={setRef}
        width={_props.width}
        height={_props.height}
        viewBox={`${frame().x} ${frame().y} ${frame().width} ${frame().height}`}
        class="solid-flow__minimap-svg"
        role="img"
        aria-labelledby={labelledBy()}
        onClick={_props.onClick ? onSvgClick : undefined}
        style={{
          "--xy-minimap-mask-background-color-props": _props.maskColor,
          "--xy-minimap-mask-stroke-color-props": _props.maskStrokeColor,
          "--xy-minimap-mask-stroke-width-props": strokeWidth(),
        }}
      >
        <title id={labelledBy()}>{store.ariaLabelConfig["minimap.ariaLabel"]}</title>
        <For keyed={false} each={nodeIds()}>
          {(nodeId) => {
            // The row resolves once, through Show (as NodeRenderer's
            // rows do): `when` returns the row itself, undefined while it
            // is missing, unmeasured or hidden, and the callback gets
            // Show's narrowed accessor (non-null by type, audit D).
            const visibleNode = () => {
              const row = nodeLookup.get(nodeId());
              return row && nodeHasDimensions(row) && !row.hidden ? row : undefined;
            };

            return (
              <Show when={visibleNode()}>
                {(node) => {
                  const dimensions = () => getNodeDimensions(node());
                  // Attribute callbacks receive the USER node (upstream
                  // parity), not the internal row.
                  const userNode = () => node().internals.userNode;
                  return (
                    <NodeComponent
                      id={nodeId()}
                      x={node().internals.positionAbsolute.x}
                      y={node().internals.positionAbsolute.y}
                      borderRadius={_props.nodeBorderRadius}
                      strokeWidth={_props.nodeStrokeWidth}
                      shapeRendering={shapeRendering}
                      width={dimensions().width}
                      height={dimensions().height}
                      selected={node().selected}
                      color={nodeColorFunc()?.call(null, userNode())}
                      strokeColor={nodeStrokeColorFunc().call(null, userNode())}
                      class={nodeClassFunc().call(null, userNode())}
                      style={node().style}
                      onClick={_props.onNodeClick ? onSvgNodeClick : undefined}
                    />
                  );
                }}
              </Show>
            );
          }}
        </For>
        <path
          class="solid-flow__minimap-mask"
          d={minimapMaskPath(frame(), viewBB())}
          fill-rule="evenodd"
          pointer-events="none"
        />
      </svg>
    );
  };

  return (
    <Panel
      position={_props.position}
      data-testid="solid-flow__minimap"
      class={["solid-flow__minimap", _props.class]}
      style={{
        "--xy-minimap-background-color-props": _props.bgColor,
        ..._props.style,
      }}
      {...paneProps}
    >
      <MiniMapSvg />
    </Panel>
  );
};
