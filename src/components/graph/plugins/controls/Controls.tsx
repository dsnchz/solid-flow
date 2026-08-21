import type { JSX } from "@solidjs/web";
import type { PanelPosition } from "@xyflow/system";
import clsx from "clsx";
import { omit, type ParentProps, Show } from "solid-js";

import { propDefaults } from "~/utils";

import type { FitViewOptions } from "../../../../types";
import { Panel } from "../../../container";
import { useInternalSolidFlow } from "../../../contexts";
import { ControlButton } from "./ControlButton";
import { Fit, Lock, Minus, Plus, Unlock } from "./icons";

type ControlsOrientation = "horizontal" | "vertical";

type ControlsProps = {
  /** Position of the controls on the pane
   * @example PanelPosition.TopLeft, PanelPosition.TopRight,
   * PanelPosition.BottomLeft, PanelPosition.BottomRight
   */
  readonly position?: PanelPosition;
  /** Show button for zoom in/out */
  readonly showZoom?: boolean;
  /** Show button for fit view */
  readonly showFitView?: boolean;
  /** Show button for toggling interactivity */
  readonly showLock?: boolean;
  readonly buttonBgColor?: string;
  readonly buttonBgColorHover?: string;
  readonly buttonColor?: string;
  readonly buttonColorHover?: string;
  readonly buttonBorderColor?: string;
  readonly style?: JSX.CSSProperties;
  readonly orientation?: ControlsOrientation;
  readonly fitViewOptions?: FitViewOptions;

  readonly beforeControls?: JSX.Element;
  readonly afterControls?: JSX.Element;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

export const Controls = (props: ParentProps<ControlsProps>): JSX.Element => {
  const { store, actions } = useInternalSolidFlow();

  const _props = propDefaults(props, {
    position: "bottom-left" as PanelPosition,
    showZoom: true,
    showFitView: true,
    showLock: true,
    orientation: "vertical" as ControlsOrientation,
  });

  const rest = omit(
    _props,
    "class",
    "position",
    "showZoom",
    "showFitView",
    "showLock",
    "orientation",
    "fitViewOptions",
    "beforeControls",
    "afterControls",
    "buttonBgColor",
    "buttonBgColorHover",
    "buttonColor",
    "buttonColorHover",
    "buttonBorderColor",
    "style",
    "children",
  );

  const getMinZoomReached = () => store.viewport.zoom <= store.minZoom;
  const getMaxZoomReached = () => store.viewport.zoom >= store.maxZoom;
  const getIsInteractive = () =>
    store.nodesDraggable || store.nodesConnectable || store.elementsSelectable;

  const onZoomInHandler = () => {
    void actions.zoomIn();
  };

  const onZoomOutHandler = () => {
    void actions.zoomOut();
  };

  const onFitViewHandler = () => {
    void actions.fitView(_props.fitViewOptions);
  };

  const onToggleInteractivity = () => {
    const newValue = !getIsInteractive();

    {
      actions.setNodesDraggable(newValue);
      actions.setNodesConnectable(newValue);
      actions.setElementsSelectable(newValue);
    }
  };

  const buttonProps = () => ({
    bgColor: _props.buttonBgColor,
    bgColorHover: _props.buttonBgColorHover,
    color: _props.buttonColor,
    colorHover: _props.buttonColorHover,
    borderColor: _props.buttonBorderColor,
  });

  return (
    <Panel
      class={clsx(["solid-flow__controls", _props.orientation, _props.class])}
      position={_props.position}
      data-testid="solid-flow__controls"
      aria-label={store.ariaLabelConfig["controls.ariaLabel"]}
      style={_props.style}
      {...rest}
    >
      {_props.beforeControls}
      <Show when={_props.showZoom}>
        <>
          <ControlButton
            onClick={onZoomInHandler}
            class="solid-flow__controls-zoomin"
            title={store.ariaLabelConfig["controls.zoomIn.ariaLabel"]}
            aria-label={store.ariaLabelConfig["controls.zoomIn.ariaLabel"]}
            disabled={getMaxZoomReached()}
            {...buttonProps()}
          >
            <Plus />
          </ControlButton>
          <ControlButton
            onClick={onZoomOutHandler}
            class="solid-flow__controls-zoomout"
            title={store.ariaLabelConfig["controls.zoomOut.ariaLabel"]}
            aria-label={store.ariaLabelConfig["controls.zoomOut.ariaLabel"]}
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
          title={store.ariaLabelConfig["controls.fitView.ariaLabel"]}
          aria-label={store.ariaLabelConfig["controls.fitView.ariaLabel"]}
          {...buttonProps()}
        >
          <Fit />
        </ControlButton>
      </Show>
      <Show when={_props.showLock}>
        <ControlButton
          class="solid-flow__controls-interactive"
          onClick={onToggleInteractivity}
          title={store.ariaLabelConfig["controls.interactive.ariaLabel"]}
          aria-label={store.ariaLabelConfig["controls.interactive.ariaLabel"]}
          {...buttonProps()}
        >
          <Show when={getIsInteractive()} fallback={<Lock />}>
            <Unlock />
          </Show>
        </ControlButton>
      </Show>
      {_props.children}
      {_props.afterControls}
    </Panel>
  );
};
