import type { JSX } from "@solidjs/web";
import { isServer } from "@solidjs/web";
import { For, onCleanup } from "solid-js";

import { NodeWrapper } from "@/components/node/NodeWrapper";
import { useInternalSolidFlow } from "@/contexts";
import type { Node, NodeEvents } from "@/types";

export type NodeRendererProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  readonly nodeClickDistance: number;
};

/** Internal renderer iterating the node id list into `NodeWrapper`s; owns the shared measurement `ResizeObserver`. */
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
