import { For, onCleanup } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
import { useVisibleElements } from "@/hooks/useVisibleElements";
import type { Node, NodeEvents } from "@/types";

import NodeWrapper from "../graph/node/NodeWrapper";

export type NodeRendererProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  readonly nodeClickDistance: number;
};

export const NodeRenderer = <NodeType extends Node = Node>(props: NodeRendererProps<NodeType>) => {
  const { updateNodeInternals } = useInternalSolidFlow<NodeType>();

  const { visibleNodeIds } = useVisibleElements<NodeType>();

  const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
    const updates = new Map();

    entries.forEach((entry: ResizeObserverEntry) => {
      const id = entry.target.getAttribute("data-id") as string;

      updates.set(id, {
        id,
        nodeElement: entry.target as HTMLDivElement,
        force: true,
      });
    });

    updateNodeInternals(updates);
  });

  onCleanup(() => {
    resizeObserver.disconnect();
  });

  return (
    <div class="solid-flow__container solid-flow__nodes">
      <For each={visibleNodeIds()}>
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
