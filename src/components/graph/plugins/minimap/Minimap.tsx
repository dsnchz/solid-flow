import {
  getBoundsOfRects,
  getInternalNodesBounds,
  getNodeDimensions,
  nodeHasDimensions,
  type PanelPosition,
  type Transform,
  XYMinimap,
} from "@xyflow/system";
import clsx from "clsx";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  mergeProps,
  onCleanup,
  onMount,
  type ParentProps,
  Show,
} from "solid-js";

import { Panel } from "@/components/container";
import { useFlowStore } from "@/components/contexts";
import type { Node } from "@/shared/types";

import MinimapNode from "./MinimapNode";

export type GetMiniMapNodeAttribute<NodeType extends Node> = (node: NodeType) => string;

export type MiniMapProps<NodeType extends Node> = {
  /** Background color of minimap */
  readonly bgColor: string;
  /** Color of nodes on the minimap */
  readonly nodeColor: string | GetMiniMapNodeAttribute<NodeType>;
  /** Stroke color of nodes on the minimap */
  readonly nodeStrokeColor: string | GetMiniMapNodeAttribute<NodeType>;
  /** Class applied to nodes on the minimap */
  readonly nodeClass: string | GetMiniMapNodeAttribute<NodeType>;
  /** Border radius of nodes on the minimap */
  readonly nodeBorderRadius: number;
  /** Stroke width of nodes on the minimap */
  readonly nodeStrokeWidth: number;
  /** Color of the mask representing viewport */
  readonly maskColor: string;
  /** Stroke color of the mask representing viewport */
  readonly maskStrokeColor: string;
  /** Stroke width of the mask representing viewport */
  readonly maskStrokeWidth: number;
  /** Position of the minimap on the pane
   * @example PanelPosition.TopLeft, PanelPosition.TopRight,
   * PanelPosition.BottomLeft, PanelPosition.BottomRight
   */
  readonly position: PanelPosition;
  /** Class applied to container */
  readonly class: string;
  /** Style applied to container */
  readonly style: JSX.CSSProperties;
  /** The aria-label applied to container */
  readonly ariaLabel: string | null;
  /** Width of minimap */
  readonly width: number;
  /** Height of minimap */
  readonly height: number;
  // onClick: (event: MouseEvent, position: XYPosition) => void;
  // onNodeClick: (event: MouseEvent, node: Node) => void;
  readonly pannable: boolean;
  readonly zoomable: boolean;
  /** Invert the direction when panning the minimap viewport */
  readonly inversePan: boolean;
  /** Step size for zooming in/out */
  readonly zoomStep: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAttrFunction = <NodeType extends Node>(func: any): GetMiniMapNodeAttribute<NodeType> =>
  func instanceof Function ? func : () => func;

const Minimap = <NodeType extends Node>(props: ParentProps<Partial<MiniMapProps<NodeType>>>) => {
  const { store } = useFlowStore<NodeType>();
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

  const getNodeColorFunc = () =>
    _props.nodeColor === undefined ? undefined : getAttrFunction(_props.nodeColor);

  const getNodeStrokeColorFunc = () => getAttrFunction(_props.nodeStrokeColor);
  const getNodeClassFunc = () => getAttrFunction(_props.nodeClass);

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
    return store.nodeLookup.size > 0
      ? getBoundsOfRects(getInternalNodesBounds(store.nodeLookup), viewBB)
      : viewBB;
  };

  const getTransform = () => {
    const viewport = store.viewport;
    return [viewport.x, viewport.y, viewport.zoom] as Transform;
  };

  const getScaledWidth = () => getBoundingRect().width / _props.width;
  const getScaledHeight = () => getBoundingRect().height / _props.height;
  const getViewScale = () => Math.max(getScaledWidth(), getScaledHeight());

  const getViewWidth = () => getViewScale() * _props.width;
  const getViewHeight = () => getViewScale() * _props.height;
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
    _props.maskStrokeWidth ? _props.maskStrokeWidth * getViewScale() : undefined;

  const getStyle = () => {
    const bgColor = _props.bgColor ? { "--xy-minimap-background-color-props": _props.bgColor } : {};
    return { ..._props.style, ...bgColor };
  };

  return (
    <Panel
      position={_props.position}
      style={getStyle()}
      class={clsx(["solid-flow__minimap", _props.class])}
      data-testid="solid-flow__minimap"
    >
      <Show when={store.panZoom}>
        {(panZoom) => {
          const [ref, setRef] = createSignal<SVGSVGElement>();

          onMount(() => {
            const minimap = XYMinimap({
              domNode: ref()!,
              panZoom: panZoom(),
              getTransform,
              getViewScale,
            });

            createEffect(() => {
              minimap.update({
                translateExtent: store.translateExtent,
                width: store.width,
                height: store.height,
                inversePan: _props.inversePan,
                zoomStep: _props.zoomStep,
                pannable: _props.pannable,
                zoomable: _props.zoomable,
              });
            });

            onCleanup(() => {
              minimap.destroy();
            });
          });

          return (
            <svg
              ref={setRef}
              width={_props.width}
              height={_props.height}
              viewBox={`${getX()} ${getY()} ${getViewboxWidth()} ${getViewboxHeight()}`}
              class="solid-flow__minimap-svg"
              role="img"
              aria-labelledby={labelledBy()}
              style={{
                "--xy-minimap-mask-background-color-props": _props.maskColor,
                "--xy-minimap-mask-stroke-color-props": _props.maskStrokeColor,
                "--xy-minimap-mask-stroke-width-props": strokeWidth(),
              }}
            >
              <Show when={_props.ariaLabel}>
                {(ariaLabel) => <title id={labelledBy()}>{ariaLabel()}</title>}
              </Show>
              <For each={store.nodes}>
                {(userNode) => {
                  const node = () => store.nodeLookup.get(userNode.id)!;

                  return (
                    <Show when={nodeHasDimensions(node()) && getNodeDimensions(node())}>
                      {(nodeDimensions) => (
                        <MinimapNode
                          x={node().internals.positionAbsolute.x}
                          y={node().internals.positionAbsolute.y}
                          borderRadius={_props.nodeBorderRadius}
                          strokeWidth={_props.nodeStrokeWidth}
                          shapeRendering={shapeRendering()}
                          width={nodeDimensions().width}
                          height={nodeDimensions().height}
                          selected={node().selected}
                          color={getNodeColorFunc()?.call(null, node())}
                          strokeColor={getNodeStrokeColorFunc().call(null, node())}
                          class={getNodeClassFunc().call(null, node()!)}
                        />
                      )}
                    </Show>
                  );
                }}
              </For>
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

export default Minimap;
