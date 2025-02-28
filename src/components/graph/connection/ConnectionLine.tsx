import {
  getBezierPath,
  getConnectionStatus,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/system";
import clsx from "clsx";
import { type JSX, type ParentProps, Show } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { ConnectionLineComponent, Node } from "@/shared/types";

type ConnectionLineProps<NodeType extends Node = Node> = {
  readonly style: string | JSX.CSSProperties;
  readonly containerStyle: string | JSX.CSSProperties;
  readonly component: ConnectionLineComponent<NodeType>;
};

const ConnectionLine = <NodeType extends Node = Node>(
  props: ParentProps<Partial<ConnectionLineProps<NodeType>>>,
) => {
  const { store } = useFlowStore<NodeType>();

  return (
    <Show when={store.connection.inProgress}>
      <svg
        class="solid-flow__container solid-flow__connectionline"
        width={store.width}
        height={store.height}
        style={props.containerStyle}
      >
        <g class={clsx(["solid-flow__connection", getConnectionStatus(store.connection.isValid)])}>
          <Show when={props.component} fallback={<InternalConnectionLine style={props.style} />}>
            {(CustomComponent) => {
              const UserConnectionLine = CustomComponent();

              return (
                <UserConnectionLine
                  connectionLineType={store.connectionLineType}
                  connectionLineStyle={props.style}
                  fromNode={store.connection.fromNode!}
                  fromHandle={store.connection.fromHandle!}
                  fromX={store.connection.from!.x}
                  fromY={store.connection.from!.y}
                  toX={store.connection.to!.x}
                  toY={store.connection.to!.y}
                  fromPosition={store.connection.fromPosition!}
                  toPosition={store.connection.toPosition!}
                  connectionStatus={getConnectionStatus(store.connection.isValid)}
                  toNode={store.connection.toNode!}
                  toHandle={store.connection.toHandle!}
                />
              );
            }}
          </Show>
        </g>
      </svg>
    </Show>
  );
};

type InternalConnectionLineProps<NodeType extends Node = Node> = Pick<
  ConnectionLineProps<NodeType>,
  "style"
>;

const InternalConnectionLine = <NodeType extends Node = Node>(
  props: Partial<InternalConnectionLineProps<NodeType>>,
) => {
  const { store } = useFlowStore<NodeType>();

  const path = () => {
    if (!store.connection.inProgress) return undefined;

    const pathParams = {
      sourceX: store.connection.from.x,
      sourceY: store.connection.from.y,
      sourcePosition: store.connection.fromPosition,
      targetX: store.connection.to.x,
      targetY: store.connection.to.y,
      targetPosition: store.connection.toPosition,
    } as const;

    switch (store.connectionLineType) {
      case "default":
        return getBezierPath(pathParams)[0];
      case "step":
        return getSmoothStepPath({
          ...pathParams,
          borderRadius: 0,
        })[0];
      case "smoothstep":
        return getSmoothStepPath(pathParams)[0];
      default:
        return getStraightPath(pathParams)[0];
    }
  };

  return <path class="solid-flow__connection-path" fill="none" style={props.style} d={path()} />;
};

export default ConnectionLine;
