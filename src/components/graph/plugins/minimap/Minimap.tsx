import {
  getBoundsOfRects,
  getInternalNodesBounds,
  getNodeDimensions,
  nodeHasDimensions,
  type PanelPosition,
} from "@xyflow/system";
import clsx from "clsx";
import { createMemo, For, JSX, type ParentComponent, Show } from "solid-js";

import { Panel } from "@/components/container";
import { useFlowStore } from "@/components/contexts";
import type { Node } from "@/shared/types";

// @ts-expect-error 6133
import { interactive } from "./interactive";
import MinimapNode from "./MinimapNode";

export type GetMiniMapNodeAttribute = (node: Node) => string;

export type MiniMapProps = {
  /** Background color of minimap */
  readonly bgColor: string;
  /** Color of nodes on the minimap */
  readonly nodeColor: string | GetMiniMapNodeAttribute;
  /** Stroke color of nodes on the minimap */
  readonly nodeStrokeColor: string | GetMiniMapNodeAttribute;
  /** Class applied to nodes on the minimap */
  readonly nodeClass: string | GetMiniMapNodeAttribute;
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
const getAttrFunction = (func: any): GetMiniMapNodeAttribute =>
  func instanceof Function ? func : () => func;

const defaultWidth = 200;
const defaultHeight = 150;

const Minimap: ParentComponent<Partial<MiniMapProps>> = (props) => {
  const { store } = useFlowStore();

  const getNodeColorFunc = () =>
    props.nodeColor === undefined ? undefined : getAttrFunction(props.nodeColor);
  const getNodeStrokeColorFunc = () => getAttrFunction(props.nodeStrokeColor ?? "transparent");
  const getNodeClassFunc = () => getAttrFunction(props.nodeClass ?? "");

  const shapeRendering =
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

  const getElementWidth = () => props.width ?? defaultWidth;
  const getElementHeight = () => props.height ?? defaultHeight;

  const getScaledWidth = () => getBoundingRect().width / getElementWidth();
  const getScaledHeight = () => getBoundingRect().height / getElementHeight();
  const getViewScale = () => Math.max(getScaledWidth(), getScaledHeight());

  const getViewWidth = () => getViewScale() * getElementWidth();
  const getViewHeight = () => getViewScale() * getElementHeight();
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
    props.maskStrokeWidth ? props.maskStrokeWidth * getViewScale() : undefined;

  const getStyle = () => {
    const baseStyle = props.style || {};
    const bgColor = props.bgColor ? { "--xy-minimap-background-color-props": props.bgColor } : {};
    return { ...baseStyle, ...bgColor };
  };

  return (
    <Panel
      position={props.position ?? "bottom-right"}
      style={getStyle()}
      class={clsx(["solid-flow__minimap", props.class])}
      data-testid="solid-flow__minimap"
    >
      <Show when={store.panZoom}>
        {(panZoom) => (
          <svg
            width={getElementWidth()}
            height={getElementHeight()}
            viewBox={`${getX()} ${getY()} ${getViewboxWidth()} ${getViewboxHeight()}`}
            class="solid-flow__minimap-svg"
            role="img"
            aria-labelledby={labelledBy()}
            style={{
              "--xy-minimap-mask-background-color-props": props.maskColor,
              "--xy-minimap-mask-stroke-color-props": props.maskStrokeColor,
              "--xy-minimap-mask-stroke-width-props": strokeWidth(),
            }}
            use:interactive={{
              panZoom: panZoom(),
              viewport: store.viewport,
              getViewScale,
              translateExtent: store.translateExtent,
              width: store.width,
              height: store.height,
              inversePan: props.inversePan,
              zoomStep: props.zoomStep,
              pannable: props.pannable ?? true,
              zoomable: props.zoomable ?? true,
            }}
          >
            <Show when={props.ariaLabel}>
              {(label) => <title id={labelledBy()}>{label()}</title>}
            </Show>
            <For each={store.nodes}>
              {(userNode) => {
                const node = store.nodeLookup.get(userNode.id);
                if (!node || !nodeHasDimensions(node)) return null;

                const nodeDimensions = getNodeDimensions(node);
                return (
                  <MinimapNode
                    x={node.internals.positionAbsolute.x}
                    y={node.internals.positionAbsolute.y}
                    {...nodeDimensions}
                    selected={node.selected}
                    color={getNodeColorFunc()?.call(null, node)}
                    borderRadius={props.nodeBorderRadius ?? 5}
                    strokeColor={getNodeStrokeColorFunc().call(null, node)}
                    strokeWidth={props.nodeStrokeWidth ?? 2}
                    shapeRendering={shapeRendering}
                    class={getNodeClassFunc().call(null, node)}
                  />
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
        )}
      </Show>
    </Panel>
  );
};

export default Minimap;
