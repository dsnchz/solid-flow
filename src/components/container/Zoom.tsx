import {
  type OnMove,
  type OnMoveEnd,
  type OnMoveStart,
  PanOnScrollMode,
  type Transform,
  type Viewport,
} from "@xyflow/system";
import { type ParentComponent } from "solid-js";

// @ts-expect-error 6133
import zoom from "@/actions/zoom";
import { useFlowStore } from "@/components/contexts";

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

const Zoom: ParentComponent<ZoomProps> = (props) => {
  const flowStore = useFlowStore();
  const { store, setStore } = flowStore;

  const viewPort = () => props.initialViewport || { x: 0, y: 0, zoom: 1 };
  const panOnDrag = () => store.panActivationKeyPressed || props.panOnDrag;
  const panOnScroll = () => store.panActivationKeyPressed || props.panOnScroll;

  const onTransformChange = (transform: Transform) => {
    const [x, y, zoom] = transform;
    setStore("viewport", { x, y, zoom });
  };

  return (
    <div
      class="solid-flow__zoom"
      use:zoom={{
        initialViewport: viewPort(),
        onPanZoomStart: props.onMoveStart,
        onPanZoom: props.onMove,
        onPanZoomEnd: props.onMoveEnd,
        zoomOnScroll: props.zoomOnScroll,
        zoomOnDoubleClick: props.zoomOnDoubleClick,
        zoomOnPinch: props.zoomOnPinch,
        panOnScroll: panOnScroll(),
        panOnDrag: panOnDrag(),
        panOnScrollSpeed: 0.5,
        panOnScrollMode: props.panOnScrollMode || PanOnScrollMode.Free,
        preventScrolling:
          typeof props.preventScrolling === "boolean" ? props.preventScrolling : true,
        noPanClassName: "nopan",
        noWheelClassName: "nowheel",
        userSelectionActive: !!store.selectionRect,
        paneClickDistance: props.paneClickDistance,
        onTransformChange,
      }}
    >
      {props.children}
    </div>
  );
};

export default Zoom;
