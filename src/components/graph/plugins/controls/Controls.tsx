import type { PanelPosition } from "@xyflow/system";
import clsx from "clsx";
import { type JSX, mergeProps, type ParentProps, Show, splitProps } from "solid-js";

import { Panel } from "@/components/container";
import { useInternalSolidFlow } from "@/components/contexts";
import type { FitViewOptions } from "@/shared/types";

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

export const Controls = (props: ParentProps<ControlsProps>) => {
  const { store, actions } = useInternalSolidFlow();

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

  const [local, rest] = splitProps(_props, [
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
  ]);

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
    void actions.fitView(local.fitViewOptions);
  };

  const onToggleInteractivity = () => {
    const newValue = !getIsInteractive();

    actions.setNodesDraggable(newValue);
    actions.setNodesConnectable(newValue);
    actions.setElementsSelectable(newValue);
  };

  const buttonProps = () => ({
    bgColor: local.buttonBgColor,
    bgColorHover: local.buttonBgColorHover,
    color: local.buttonColor,
    colorHover: local.buttonColorHover,
    borderColor: local.buttonBorderColor,
  });

  return (
    <Panel
      class={clsx(["solid-flow__controls", local.orientation, local.class])}
      position={local.position}
      data-testid="solid-flow__controls"
      aria-label={store.ariaLabelConfig["controls.ariaLabel"]}
      style={local.style}
      {...rest}
    >
      {local.beforeControls}
      <Show when={local.showZoom}>
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
      <Show when={local.showFitView}>
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
      <Show when={local.showLock}>
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
      {local.children}
      {local.afterControls}
    </Panel>
  );
};
