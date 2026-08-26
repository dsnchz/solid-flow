import type { JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import {
  getBoundsOfRects,
  getInternalNodesBounds,
  getNodeDimensions,
  nodeHasDimensions,
  type PanelPosition,
  type Rect,
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
  untrack,
} from "solid-js";

import { Panel } from "@/components/container";
import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";
import { propDefaults } from "@/utils";

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
   * @example PanelPosition.TopLeft, PanelPosition.TopRight,
   * PanelPosition.BottomLeft, PanelPosition.BottomRight
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
};

const getAttrFunction = <NodeType extends Node>(
  value: string | GetMiniMapNodeAttribute<NodeType>,
): GetMiniMapNodeAttribute<NodeType> => (value instanceof Function ? value : () => value);

/** Miniature overview map of the whole flow, with optional pan/zoom interaction. */
export const MiniMap = <NodeType extends Node>(
  props: ParentProps<Partial<MiniMapProps<NodeType>>>,
): JSX.Element => {
  const { store, nodeLookup } = useInternalSolidFlow<NodeType>();

  const _props = propDefaults(props, {
    position: "bottom-right" as PanelPosition,
    nodeClass: "",
    nodeStrokeColor: "transparent",
    pannable: true,
    zoomable: true,
    width: 200,
    height: 150,
    nodeBorderRadius: 5,
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

  const nodeColorFunc = () =>
    _props.nodeColor === undefined ? undefined : getAttrFunction(_props.nodeColor);

  const nodeStrokeColorFunc = () => getAttrFunction(_props.nodeStrokeColor);
  const nodeClassFunc = () => getAttrFunction(_props.nodeClass);

  const shapeRendering =
    // @ts-expect-error - TS doesn't know about chrome
    typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";

  const labelledBy = createMemo(() => `solid-flow__minimap-desc-${store.id}`);

  // B1 (audit, bench round 7): every value below was an unmemoized helper
  // chain — the viewBox and mask-path expressions re-ran the FULL O(n)
  // getInternalNodesBounds scan ~30 times per drag/pan frame, which froze
  // the tab outright at 10k nodes (1.5s per mousemove at 2.5k). One memo
  // per level: exactly one bounds scan per graph/viewport change.
  const viewBB = createMemo(() => ({
    x: -store.viewport.x / store.viewport.zoom,
    y: -store.viewport.y / store.viewport.zoom,
    width: store.width / store.viewport.zoom,
    height: store.height / store.viewport.zoom,
  }));

  // Graph bounds are SAMPLED, not tracked (bench round 7's residual): the
  // previous memo ran the O(n) bounds scan through the reactive lookup, so
  // every position write during a drag re-ran it with a full subscription
  // teardown/rebuild — ~60ms of the 76ms minimap drag cost at 10k. The
  // untracked sample runs per animation frame while dragging, on membership
  // and measurement milestones, and on a coarse safety interval that
  // catches exotic write paths (programmatic moves outside drags).
  const rectsEqual = (a: Rect | null, b: Rect | null) =>
    a === b ||
    (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
  const sampleBounds = (): Rect | null =>
    untrack(() => {
      if (nodeLookup.size === 0) return null;
      const bounds = getInternalNodesBounds(nodeLookup);
      // Pre-measurement graphs yield an Infinity rect; folding that in
      // poisons viewScale with NaN, which XYMinimap writes into the SHARED
      // panZoom viewport. Treat as "no bounds yet".
      return Number.isFinite(bounds.x) && Number.isFinite(bounds.width) ? bounds : null;
    });
  const [graphBounds, setGraphBounds] = createSignal<Rect | null>(sampleBounds(), {
    equals: rectsEqual,
  });

  createEffect(
    () => store.dragging,
    (dragging) => {
      if (!dragging) {
        setGraphBounds(sampleBounds());
        return;
      }
      let raf = requestAnimationFrame(function tick() {
        setGraphBounds(sampleBounds());
        raf = requestAnimationFrame(tick);
      });
      return () => cancelAnimationFrame(raf);
    },
  );
  createEffect(
    () => ({ count: store.nodes.length, initialized: store.nodesInitialized }),
    () => {
      setGraphBounds(sampleBounds());
    },
  );
  createEffect(
    () => null,
    () => {
      const interval = setInterval(() => setGraphBounds(sampleBounds()), 500);
      return () => clearInterval(interval);
    },
  );

  const boundingRect = createMemo(() => {
    const view = viewBB();
    const bounds = graphBounds();
    return bounds ? getBoundsOfRects(bounds, view) : view;
  });

  const viewScale = createMemo(() =>
    Math.max(boundingRect().width / _props.width, boundingRect().height / _props.height),
  );

  const getViewWidth = () => viewScale() * _props.width;
  const getViewHeight = () => viewScale() * _props.height;
  const getOffset = () => 5 * viewScale();

  const getX = () => {
    const rect = boundingRect();
    return rect.x - (getViewWidth() - rect.width) / 2 - getOffset();
  };

  const getY = () => {
    const rect = boundingRect();
    return rect.y - (getViewHeight() - rect.height) / 2 - getOffset();
  };

  const getViewboxWidth = () => getViewWidth() + getOffset() * 2;
  const getViewboxHeight = () => getViewHeight() + getOffset() * 2;

  const strokeWidth = () =>
    _props.maskStrokeWidth ? _props.maskStrokeWidth * viewScale() : undefined;

  const nodeIds = createMemo(() => store.nodes.map((node) => node.id), {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
  });

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
      <Show when={store.panZoom}>
        {(panZoom) => {
          const [ref, setRef] = createSignal<SVGSVGElement>();

          // Mount the minimap controller on the svg (external system: XYMinimap)
          const [minimap, setMinimap] = createSignal<ReturnType<typeof XYMinimap>>();

          createEffect(
            () => ({ el: ref(), panZoom: panZoom() }),
            ({ el, panZoom }) => {
              if (!el) return;
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
              viewBox={`${getX()} ${getY()} ${getViewboxWidth()} ${getViewboxHeight()}`}
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
                  // Narrow once through Show: inside the callback the row is
                  // non-null by type, not by assertion (audit D).
                  const visibleNode = createMemo(() => {
                    const row = nodeLookup.get(nodeId());
                    return row && nodeHasDimensions(row) && !row.hidden ? row : null;
                  });

                  return (
                    <Show when={visibleNode()}>
                      {(node) => {
                        const dimensions = () => getNodeDimensions(node());
                        // Attribute callbacks receive the USER node (upstream
                        // parity), not the internal row.
                        const userNode = () => node().internals.userNode;
                        return (
                          <Dynamic
                            component={_props.nodeComponent ?? MiniMapNode}
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
                d={`M${getX() - getOffset()},${getY() - getOffset()}h${getViewboxWidth() + getOffset() * 2}v${
                  getViewboxHeight() + getOffset() * 2
                }h${-getViewboxWidth() - getOffset() * 2}z
            M${viewBB().x},${viewBB().y}h${viewBB().width}v${viewBB().height}h${-viewBB().width}z`}
                fill-rule="evenodd"
                pointer-events="none"
              />
            </svg>
          );
        }}
      </Show>
    </Panel>
  );
};
