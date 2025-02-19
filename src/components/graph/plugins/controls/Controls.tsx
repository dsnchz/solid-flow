import clsx from "clsx";

import type { PanelPosition } from "@xyflow/system";

import ControlButton from "./ControlButton";
import { Plus, Minus, Fit, Lock, Unlock } from "./icons";
import { useFlowStore } from "@/components/contexts";
import type { FitViewOptions } from "@/shared/types";
import type { JSX, ParentComponent } from "solid-js";
import { Panel } from "@/components/container";
import { mergeProps, Show } from "solid-js/web";

type ControlsOrientation = "horizontal" | "vertical";

type ControlsProps = {
  /** Position of the controls on the pane
   * @example PanelPosition.TopLeft, PanelPosition.TopRight,
   * PanelPosition.BottomLeft, PanelPosition.BottomRight
   */
  readonly position: PanelPosition;
  /** Show button for zoom in/out */
  readonly showZoom: boolean;
  /** Show button for fit view */
  readonly showFitView: boolean;
  /** Show button for toggling interactivity */
  readonly showLock: boolean;
  readonly buttonBgColor: string;
  readonly buttonBgColorHover: string;
  readonly buttonColor: string;
  readonly buttonColorHover: string;
  readonly "aria-label": string;
  readonly style: JSX.CSSProperties;
  readonly class: string;
  readonly orientation: ControlsOrientation;
  readonly fitViewOptions: FitViewOptions;

  readonly beforeControls: JSX.Element;
  readonly afterControls: JSX.Element;
};

const Controls: ParentComponent<Partial<ControlsProps>> = (props) => {
  const { store, setStore, fitView, zoomIn, zoomOut } = useFlowStore();
  const _props = mergeProps(
    {
      position: "bottom-left" as PanelPosition,
      showZoom: true,
      showFitView: true,
      showLock: true,
      orientation: "vertical" as ControlsOrientation,
    },
    props,
  );

  const getMinZoomReached = () => store.viewport.zoom <= store.minZoom;
  const getMaxZoomReached = () => store.viewport.zoom >= store.maxZoom;
  const getIsInteractive = () =>
    store.nodesDraggable || store.nodesConnectable || store.elementsSelectable;

  const onZoomInHandler = () => {
    zoomIn();
  };

  const onZoomOutHandler = () => {
    zoomOut();
  };

  const onFitViewHandler = () => {
    fitView(_props.fitViewOptions);
  };

  const onToggleInteractivity = () => {
    const newValue = !getIsInteractive();

    setStore({
      nodesDraggable: newValue,
      nodesConnectable: newValue,
      elementsSelectable: newValue,
    });
  };

  const buttonProps = () => ({
    bgColor: _props.buttonBgColor,
    bgColorHover: _props.buttonBgColorHover,
    color: _props.buttonColor,
    colorHover: _props.buttonColorHover,
    borderColor: _props.buttonColorHover,
  });

  return (
    <Panel
      class={clsx(["solid-flow__controls", _props.orientation, _props.class])}
      position={_props.position}
      data-testid="solid-flow__controls"
      aria-label={_props["aria-label"] ?? "Solid Flow controls"}
      style={_props.style}
    >
      {_props.beforeControls}
      <Show when={_props.showZoom}>
        <>
          <ControlButton
            onClick={onZoomInHandler}
            class="solid-flow__controls-zoomin"
            title="zoom in"
            aria-label="zoom in"
            disabled={getMaxZoomReached()}
            {...buttonProps()}
          >
            <Plus />
          </ControlButton>
          <ControlButton
            onClick={onZoomOutHandler}
            class="solid-flow__controls-zoomout"
            title="zoom out"
            aria-label="zoom out"
            disabled={getMinZoomReached()}
            {...buttonProps()}
          >
            <Minus />
          </ControlButton>
        </>
      </Show>
      <Show when={_props.showFitView}>
        <ControlButton
          class="solid-flow__controls-fitview"
          onClick={onFitViewHandler}
          title="fit view"
          aria-label="fit view"
          {...buttonProps()}
        >
          <Fit />
        </ControlButton>
      </Show>
      <Show when={_props.showLock}>
        <ControlButton
          class="solid-flow__controls-interactive"
          onClick={onToggleInteractivity}
          title="toggle interactivity"
          aria-label="toggle interactivity"
          {...buttonProps()}
        >
          {getIsInteractive() ? <Unlock /> : <Lock />}
        </ControlButton>
      </Show>
      {_props.children}
      {_props.afterControls}
    </Panel>
  );
};

export default Controls;
