import { For, type JSX, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

import type { Node, NodeEvents } from "../../types";
import { useInternalSolidFlow } from "../contexts";
import { NodeWrapper } from "../graph/node/NodeWrapper";

export type NodeRendererProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  readonly nodeClickDistance: number;
};

export const NodeRenderer = <NodeType extends Node = Node>(
  props: NodeRendererProps<NodeType>,
): JSX.Element => {
  const { actions, store } = useInternalSolidFlow<NodeType>();

  // Nodes are measured in the browser only; during SSR the observer is absent
  // and NodeWrapper's measurement effect never runs.
  const resizeObserver = isServer
    ? undefined
    : new ResizeObserver((entries: ResizeObserverEntry[]) => {
        actions.requestUpdateNodeInternals(
          entries.map((entry: ResizeObserverEntry) => {
            const id = entry.target.getAttribute("data-id") as string;
            return [
              id,
              {
                id,
                nodeElement: entry.target as HTMLDivElement,
                force: true,
              },
            ];
          }),
        );
      });

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  return (
    <div class="solid-flow__container solid-flow__nodes">
      <For each={store.visibleNodeIds}>
        {(nodeId) => {
          return (
            <NodeWrapper
              nodeId={nodeId}
              resizeObserver={resizeObserver}
              nodeClickDistance={props.nodeClickDistance}
              onNodeClick={props.onNodeClick}
              onNodePointerEnter={props.onNodePointerEnter}
              onNodePointerMove={props.onNodePointerMove}
              onNodePointerLeave={props.onNodePointerLeave}
              onNodeDrag={props.onNodeDrag}
              onNodeDragStart={props.onNodeDragStart}
              onNodeDragStop={props.onNodeDragStop}
              onNodeContextMenu={props.onNodeContextMenu}
            />
          );
        }}
      </For>
    </div>
  );
};
