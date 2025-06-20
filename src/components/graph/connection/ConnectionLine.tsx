import {
  getBezierPath,
  getConnectionStatus,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/system";
import clsx from "clsx";
import { type JSX, type ParentProps, Show } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
import type { Node } from "@/types";

import type { ConnectionLineComponentProps, ConnectionLineType } from "./types";

type ConnectionLineProps<NodeType extends Node = Node> = {
  readonly style: JSX.CSSProperties;
  readonly type: ConnectionLineType;
  readonly component: (props: ConnectionLineComponentProps<NodeType>) => JSX.Element;
  readonly containerStyle: string | JSX.CSSProperties;
};

const ConnectionLine = <NodeType extends Node = Node>(
  props: ParentProps<Partial<ConnectionLineProps<NodeType>>>,
) => {
  const { store } = useInternalSolidFlow<NodeType>();

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
  const { store } = useInternalSolidFlow<NodeType>();

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
      case "default": {
        const [path] = getBezierPath(pathParams);
        return path;
      }
      case "straight": {
        const [path] = getStraightPath(pathParams);
        return path;
      }
      case "step":
      case "smoothstep": {
        const [path] = getSmoothStepPath({
          ...pathParams,
          borderRadius: store.connectionLineType === "step" ? 0 : undefined,
        });
        return path;
      }
    }
  };

  return <path class="solid-flow__connection-path" fill="none" style={props.style} d={path()} />;
};

export default ConnectionLine;
