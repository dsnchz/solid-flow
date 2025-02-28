import type {
  OnMove,
  OnMoveEnd,
  OnMoveStart,
  PanOnScrollMode as SystemPanOnScrollMode,
  Viewport,
} from "@xyflow/system";
import { createSignal, type ParentProps } from "solid-js";

import createZoomable from "@/actions/createZoomable";
import { useFlowStore } from "@/components/contexts";
import type { PanOnScrollMode } from "@/shared/types";

export type ZoomProps = {
  readonly initialViewport?: Viewport;
  readonly panOnScrollMode: PanOnScrollMode;
  readonly onMove?: OnMove;
  readonly onMoveStart?: OnMoveStart;
  readonly onMoveEnd?: OnMoveEnd;
  readonly preventScrolling: boolean;
  readonly zoomOnScroll: boolean;
  readonly zoomOnDoubleClick: boolean;
  readonly zoomOnPinch: boolean;
  readonly panOnScroll: boolean;
  readonly panOnDrag: boolean | number[];
  readonly paneClickDistance: number;
};

const Zoom = (props: ParentProps<ZoomProps>) => {
  const flowStore = useFlowStore();
  const { store } = flowStore;
  const [ref, setRef] = createSignal<HTMLDivElement>();

  const viewPort = () => props.initialViewport || { x: 0, y: 0, zoom: 1 };
  const panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;
  const panOnScroll = () => store.panActivationKeyPressed || props.panOnScroll;

  createZoomable(ref, () => ({
    initialViewport: viewPort(),
    zoomOnScroll: props.zoomOnScroll,
    zoomOnDoubleClick: props.zoomOnDoubleClick,
    zoomOnPinch: props.zoomOnPinch,
    panOnScroll: panOnScroll(),
    panOnDrag: panOnDrag(),
    panOnScrollSpeed: 0.5,
    panOnScrollMode: props.panOnScrollMode as SystemPanOnScrollMode,
    preventScrolling: typeof props.preventScrolling === "boolean" ? props.preventScrolling : true,
    noPanClassName: "nopan",
    noWheelClassName: "nowheel",
    userSelectionActive: !!store.selectionRect,
    paneClickDistance: props.paneClickDistance,
    onPanZoomStart: props.onMoveStart,
    onPanZoom: props.onMove,
    onPanZoomEnd: props.onMoveEnd,
  }));

  return (
    <div ref={setRef} class="solid-flow__container solid-flow__zoom">
      {props.children}
    </div>
  );
};

export default Zoom;
