import { Index, onCleanup } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { Node, NodeEventCallbacks } from "@/shared/types";

import NodeWrapper from "../graph/node/NodeWrapper";

export type NodeRendererProps<NodeType extends Node = Node> = Partial<
  NodeEventCallbacks<NodeType>
> & {
  readonly nodeClickDistance: number;
};

const NodeRenderer = <NodeType extends Node = Node>(props: NodeRendererProps<NodeType>) => {
  const { store, updateNodeInternals } = useFlowStore<NodeType>();

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
      <Index each={store.visibleNodes}>
        {(node) => {
          return (
            <NodeWrapper
              node={node()}
              nodeClickDistance={props.nodeClickDistance}
              resizeObserver={resizeObserver}
              onNodeClick={props.onNodeClick}
              onNodeContextMenu={props.onNodeContextMenu}
              onNodeDrag={props.onNodeDrag}
              onNodeDragStart={props.onNodeDragStart}
              onNodeDragStop={props.onNodeDragStop}
              onNodeMouseEnter={props.onNodeMouseEnter}
              onNodeMouseMove={props.onNodeMouseMove}
              onNodeMouseLeave={props.onNodeMouseLeave}
            />
          );
        }}
      </Index>
    </div>
  );
};

export default NodeRenderer;
