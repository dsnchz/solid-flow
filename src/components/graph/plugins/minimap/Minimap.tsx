import {
  getBoundsOfRects,
  getInternalNodesBounds,
  getNodeDimensions,
  nodeHasDimensions,
  type PanelPosition,
  XYMinimap,
} from "@xyflow/system";
import clsx from "clsx";
import {
  createEffect,
  createMemo,
  createSignal,
  Index,
  type JSX,
  mergeProps,
  onCleanup,
  onMount,
  type ParentProps,
  Show,
  splitProps,
} from "solid-js";

import { Panel } from "@/components/container";
import { useInternalSolidFlow } from "@/components/contexts";
import type { Node } from "@/shared/types";

import MinimapNode from "./MinimapNode";

export type GetMiniMapNodeAttribute<NodeType extends Node> = (node: NodeType) => string;

export type MiniMapProps<NodeType extends Node> = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "style"
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
  // onClick: (event: MouseEvent, position: XYPosition) => void;
  // onNodeClick: (event: MouseEvent, node: Node) => void;
  readonly pannable?: boolean;
  readonly zoomable?: boolean;
  /** Invert the direction when panning the minimap viewport */
  readonly inversePan?: boolean;
  /** Step size for zooming in/out */
  readonly zoomStep?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAttrFunction = <NodeType extends Node>(func: any): GetMiniMapNodeAttribute<NodeType> =>
  func instanceof Function ? func : () => func;

export const Minimap = <NodeType extends Node>(
  props: ParentProps<Partial<MiniMapProps<NodeType>>>,
) => {
  const { store, nodeLookup } = useInternalSolidFlow<NodeType>();

  const _props = mergeProps(
    {
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
    },
    props,
  );

  const [local, paneProps] = splitProps(_props, [
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
  ]);

  const nodeColorFunc = () =>
    local.nodeColor === undefined ? undefined : getAttrFunction(local.nodeColor);

  const nodeStrokeColorFunc = () => getAttrFunction(local.nodeStrokeColor);
  const nodeClassFunc = () => getAttrFunction(local.nodeClass);

  const shapeRendering = () =>
    // @ts-expect-error - TS doesn't know about chrome
    typeof window === "undefined" || !!window.chrome ? "crispEdges" : "geometricPrecision";

  const labelledBy = createMemo(() => `solid-flow__minimap-desc-${store.id}`);

  const getViewBB = () => ({
    x: -store.viewport.x / store.viewport.zoom,
    y: -store.viewport.y / store.viewport.zoom,
    width: store.width / store.viewport.zoom,
    height: store.height / store.viewport.zoom,
  });

  const getBoundingRect = () => {
    const viewBB = getViewBB();
    return nodeLookup.size > 0
      ? getBoundsOfRects(getInternalNodesBounds(nodeLookup), viewBB)
      : viewBB;
  };

  const getScaledWidth = () => getBoundingRect().width / local.width;
  const getScaledHeight = () => getBoundingRect().height / local.height;
  const getViewScale = () => Math.max(getScaledWidth(), getScaledHeight());

  const getViewWidth = () => getViewScale() * local.width;
  const getViewHeight = () => getViewScale() * local.height;
  const getOffset = () => 5 * getViewScale();

  const getX = () => {
    const boundingRect = getBoundingRect();
    return boundingRect.x - (getViewWidth() - boundingRect.width) / 2 - getOffset();
  };

  const getY = () => {
    const boundingRect = getBoundingRect();
    return boundingRect.y - (getViewHeight() - boundingRect.height) / 2 - getOffset();
  };

  const getViewboxWidth = () => getViewWidth() + getOffset() * 2;
  const getViewboxHeight = () => getViewHeight() + getOffset() * 2;

  const strokeWidth = () =>
    local.maskStrokeWidth ? local.maskStrokeWidth * getViewScale() : undefined;

  let prevNodeIds: string[] = [];
  const nodeIds = () => {
    const currentNodeIds = store.nodes.map((node) => node.id);
    const currentSet = new Set(currentNodeIds);

    if (
      prevNodeIds.length !== currentNodeIds.length ||
      !prevNodeIds.every((id) => currentSet.has(id))
    ) {
      prevNodeIds = currentNodeIds;
    }

    return prevNodeIds;
  };

  return (
    <Panel
      position={local.position}
      data-testid="solid-flow__minimap"
      class={clsx(["solid-flow__minimap", local.class])}
      style={{
        "--xy-minimap-background-color-props": local.bgColor,
        ...local.style,
      }}
      {...paneProps}
    >
      <Show when={store.panZoom}>
        {(panZoom) => {
          const [ref, setRef] = createSignal<SVGSVGElement>();

          onMount(() => {
            const minimap = XYMinimap({
              domNode: ref()!,
              panZoom: panZoom(),
              getTransform: () => store.transform,
              getViewScale,
            });

            createEffect(() => {
              minimap.update({
                translateExtent: store.translateExtent,
                width: store.width,
                height: store.height,
                inversePan: local.inversePan,
                zoomStep: local.zoomStep,
                pannable: local.pannable,
                zoomable: local.zoomable,
              });
            });

            onCleanup(() => {
              minimap.destroy();
            });
          });

          return (
            <svg
              ref={setRef}
              width={local.width}
              height={local.height}
              viewBox={`${getX()} ${getY()} ${getViewboxWidth()} ${getViewboxHeight()}`}
              class="solid-flow__minimap-svg"
              role="img"
              aria-labelledby={labelledBy()}
              style={{
                "--xy-minimap-mask-background-color-props": local.maskColor,
                "--xy-minimap-mask-stroke-color-props": local.maskStrokeColor,
                "--xy-minimap-mask-stroke-width-props": strokeWidth(),
              }}
            >
              <title id={labelledBy()}>{store.ariaLabelConfig["minimap.ariaLabel"]}</title>
              <Index each={nodeIds()}>
                {(nodeId) => {
                  const node = createMemo(() => nodeLookup.get(nodeId()));

                  const nodeVisible = () =>
                    Boolean(node() && nodeHasDimensions(node()!) && !node()!.hidden);

                  return (
                    <Show when={nodeVisible() && getNodeDimensions(node()!)}>
                      {(nodeDimensions) => (
                        <MinimapNode
                          x={node()!.internals.positionAbsolute.x}
                          y={node()!.internals.positionAbsolute.y}
                          borderRadius={local.nodeBorderRadius}
                          strokeWidth={local.nodeStrokeWidth}
                          shapeRendering={shapeRendering()}
                          width={nodeDimensions().width}
                          height={nodeDimensions().height}
                          selected={node()!.selected}
                          color={nodeColorFunc()?.call(null, node()!)}
                          strokeColor={nodeStrokeColorFunc().call(null, node()!)}
                          class={nodeClassFunc().call(null, node()!)}
                        />
                      )}
                    </Show>
                  );
                }}
              </Index>
              <path
                class="solid-flow__minimap-mask"
                d={`M${getX() - getOffset()},${getY() - getOffset()}h${getViewboxWidth() + getOffset() * 2}v${
                  getViewboxHeight() + getOffset() * 2
                }h${-getViewboxWidth() - getOffset() * 2}z
            M${getViewBB().x},${getViewBB().y}h${getViewBB().width}v${getViewBB().height}h${-getViewBB().width}z`}
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
