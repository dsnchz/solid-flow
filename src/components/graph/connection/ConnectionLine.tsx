import {
  ConnectionLineType,
  getBezierPath,
  getConnectionStatus,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/system";
import clsx from "clsx";
import { type ParentComponent, Show } from "solid-js";

import { useFlowStore } from "@/components/contexts";

type ConnectionLineProps = {
  containerStyle: string;
  style: string;
  isCustomComponent: boolean;
};

const ConnectionLine: ParentComponent<Partial<ConnectionLineProps>> = (props) => {
  const { store } = useFlowStore();

  const path = () => {
    if (!store.connection.inProgress || props.isCustomComponent) {
      return undefined;
    }

    const { from, to, fromPosition, toPosition } = store.connection;
    const pathParams = {
      sourceX: from.x,
      sourceY: from.y,
      sourcePosition: fromPosition,
      targetX: to.x,
      targetY: to.y,
      targetPosition: toPosition,
    };

    switch (store.connectionLineType) {
      case ConnectionLineType.Bezier:
        return getBezierPath(pathParams)[0];
      case ConnectionLineType.Step:
        return getSmoothStepPath({
          ...pathParams,
          borderRadius: 0,
        })[0];
      case ConnectionLineType.SmoothStep:
        return getSmoothStepPath(pathParams)[0];
      default:
        return getStraightPath(pathParams)[0];
    }
  };

  return (
    <Show when={store.connection.inProgress}>
      <svg
        width={store.width}
        height={store.height}
        class="solid-flow__connectionline"
        style={props.containerStyle}
      >
        <g class={clsx(["solid-flow__connection", getConnectionStatus(store.connection.isValid)])}>
          {props.children}
          <Show when={!props.isCustomComponent}>
            <path d={path()} style={props.style} fill="none" class="solid-flow__connection-path" />
          </Show>
        </g>
      </svg>
    </Show>
  );
};

export default ConnectionLine;
