import { nodeHasDimensions } from "@xyflow/system";
import { For, onCleanup } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { Node, NodeEventCallbacks } from "@/shared/types";

import NodeWrapper from "../graph/node/NodeWrapper";

export type NodeRendererProps<NodeType extends Node = Node> = Partial<
  NodeEventCallbacks<NodeType>
> & {
  readonly nodeClickDistance?: number;
};

const NodeRenderer = <NodeType extends Node = Node>(props: NodeRendererProps<NodeType>) => {
  const { store, updateNodeInternals } = useFlowStore<NodeType>();

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries: ResizeObserverEntry[]) => {
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
    resizeObserver?.disconnect();
  });

  return (
    <div class="solid-flow__nodes">
      <For each={store.visibleNodes}>
        {(node) => {
          const isSelectable = () =>
            !!(
              node.selectable ||
              (store.elementsSelectable && typeof node.selectable === "undefined")
            );

          const isDraggable = () =>
            !!(node.draggable || (store.nodesDraggable && typeof node.draggable === "undefined"));

          const isConnectable = () =>
            !!(
              node.connectable ||
              (store.nodesConnectable && typeof node.connectable === "undefined")
            );

          const zIndex = () => node.internals.z ?? 0;
          const deletable = () => node.deletable ?? true;
          const type = () => node.type ?? "default";

          return (
            <NodeWrapper
              node={node}
              id={node.id}
              data={node.data}
              selected={!!node.selected}
              hidden={!!node.hidden}
              positionX={node.internals.positionAbsolute.x}
              positionY={node.internals.positionAbsolute.y}
              style={node.style}
              class={node.class}
              sourcePosition={node.sourcePosition}
              targetPosition={node.targetPosition}
              dragging={node.dragging}
              dragHandle={node.dragHandle}
              width={node.width}
              height={node.height}
              initialWidth={node.initialWidth}
              initialHeight={node.initialHeight}
              measuredWidth={node.measured.width}
              measuredHeight={node.measured.height}
              parentId={node.parentId}
              nodeClickDistance={props.nodeClickDistance}
              resizeObserver={resizeObserver}
              isParent={store.parentLookup.has(node.id)}
              initialized={nodeHasDimensions(node)}
              zIndex={zIndex()}
              deletable={deletable()}
              type={type()}
              draggable={isDraggable()}
              selectable={isSelectable()}
              connectable={isConnectable()}
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
      </For>
    </div>
  );
};

export default NodeRenderer;
