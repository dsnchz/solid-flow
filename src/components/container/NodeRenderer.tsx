import { For, onCleanup } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
import type { Node, NodeEvents } from "@/types";

import { NodeWrapper } from "../graph/node/NodeWrapper";

export type NodeRendererProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  readonly nodeClickDistance: number;
};

export const NodeRenderer = <NodeType extends Node = Node>(props: NodeRendererProps<NodeType>) => {
  const { actions, store } = useInternalSolidFlow<NodeType>();

  const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
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
    resizeObserver.disconnect();
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
