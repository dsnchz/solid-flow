import type { JSX } from "@solidjs/web";
import type { ConnectionState } from "@xyflow/system";
import {
  getBezierPath,
  getConnectionStatus,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/system";
import { createMemo, type ParentProps, Show } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import type { ConnectionLineComponentProps, ConnectionLineType, InternalNode, Node } from "@/types";

type ConnectionLineProps<NodeType extends Node = Node> = {
  readonly style: JSX.CSSProperties;
  readonly type: ConnectionLineType;
  readonly component: (props: ConnectionLineComponentProps<NodeType>) => JSX.Element;
  readonly containerStyle: string | JSX.CSSProperties;
};

/** Internal component rendering the in-progress connection line. */
const ConnectionLine = <NodeType extends Node = Node>(
  props: ParentProps<Partial<ConnectionLineProps<NodeType>>>,
): JSX.Element => {
  const { store } = useInternalSolidFlow<NodeType>();
  const connectionStatus = () => getConnectionStatus(store.connection.isValid);

  // Narrow the discriminated union ONCE (audit D5): inside the Show callback
  // the in-progress variant's fields are non-null by type, not by assertion.
  const inProgress = createMemo(() => {
    const state = store.connection;
    return state.inProgress ? state : null;
  });

  return (
    <Show when={inProgress()}>
      {(connection) => (
        <svg
          class="solid-flow__container solid-flow__connectionline"
          width={store.width}
          height={store.height}
          style={props.containerStyle}
        >
          <g class={["solid-flow__connection", connectionStatus()]}>
            <Show
              when={props.component}
              fallback={<InternalConnectionLine style={props.style} connection={connection()} />}
            >
              {(CustomComponent) => {
                const UserConnectionLine = CustomComponent();

                return (
                  <UserConnectionLine
                    connectionLineType={store.connectionLineType}
                    connectionLineStyle={props.style}
                    fromNode={connection().fromNode}
                    fromHandle={connection().fromHandle}
                    fromX={connection().from.x}
                    fromY={connection().from.y}
                    toX={connection().to.x}
                    toY={connection().to.y}
                    fromPosition={connection().fromPosition}
                    toPosition={connection().toPosition}
                    connectionStatus={connectionStatus()}
                    toNode={connection().toNode}
                    toHandle={connection().toHandle}
                  />
                );
              }}
            </Show>
          </g>
        </svg>
      )}
    </Show>
  );
};

type InProgressConnection<NodeType extends Node> = Extract<
  ConnectionState<InternalNode<NodeType>>,
  { inProgress: true }
>;

type InternalConnectionLineProps<NodeType extends Node = Node> = Pick<
  ConnectionLineProps<NodeType>,
  "style"
> & { readonly connection: InProgressConnection<NodeType> };

const InternalConnectionLine = <NodeType extends Node = Node>(
  props: Partial<InternalConnectionLineProps<NodeType>> &
    Pick<InternalConnectionLineProps<NodeType>, "connection">,
) => {
  const { store } = useInternalSolidFlow<NodeType>();

  const path = () => {
    const pathParams = {
      sourceX: props.connection.from.x,
      sourceY: props.connection.from.y,
      sourcePosition: props.connection.fromPosition,
      targetX: props.connection.to.x,
      targetY: props.connection.to.y,
      targetPosition: props.connection.toPosition,
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
